/**
 * CAI Intake - Template Parsing Service
 * 
 * Manages template-specific parsing features:
 * - Multi-page merging based on project code
 * - Confidence-based auto-accept (skip review if >95%)
 * - Audit logging for training feedback loop
 * - Template versioning validation
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { 
  mergeTemplatePages, 
  type TemplateParseResult,
  type ParsedTemplatePart,
} from "@/lib/ai/template-ocr";

// ============================================================
// CONFIGURATION
// ============================================================

/** Confidence threshold for auto-accept (skip review) */
export const AUTO_ACCEPT_CONFIDENCE_THRESHOLD = 0.95;

/** Maximum time to wait for related pages before processing (ms) */
export const MULTI_PAGE_WAIT_TIMEOUT_MS = 30000; // 30 seconds

// ============================================================
// TYPES
// ============================================================

export interface TemplateParseSession {
  sessionId: string;
  organizationId: string;
  userId: string;
  templateId: string;
  projectCode?: string;
  pages: TemplatePageResult[];
  totalExpectedPages?: number;
  status: "collecting" | "complete" | "merged" | "error";
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplatePageResult {
  pageNumber: number;
  fileId: string;
  fileName: string;
  parseResult: TemplateParseResult;
  rawParts: ParsedTemplatePart[];
  confidence: number;
  processingTimeMs: number;
}

export interface TemplateParseAudit {
  id: string;
  organizationId: string;
  userId: string;
  templateId: string;
  version: string;
  projectCode?: string;
  totalPages: number;
  totalParts: number;
  averageConfidence: number;
  autoAccepted: boolean;
  humanCorrected: boolean;
  correctionCount: number;
  processingTimeMs: number;
  createdAt: Date;
}

export interface MultiPageMergeResult {
  success: boolean;
  merged: boolean;
  projectCode: string;
  totalPages: number;
  parts: ParsedTemplatePart[];
  averageConfidence: number;
  autoAccept: boolean;
  errors: string[];
}

// ============================================================
// IN-MEMORY SESSION STORE
// For tracking multi-page template uploads
// ============================================================

const activeSessions = new Map<string, TemplateParseSession>();

/**
 * Generate a session key for grouping related pages
 */
function getSessionKey(orgId: string, projectCode: string): string {
  return `${orgId}:${projectCode}`;
}

// ============================================================
// MULTI-PAGE HANDLING
// ============================================================

/**
 * Register a parsed template page for potential multi-page merging
 */
export function registerTemplatePage(
  organizationId: string,
  userId: string,
  templateId: string,
  fileId: string,
  fileName: string,
  parseResult: TemplateParseResult,
  processingTimeMs: number
): {
  sessionId: string;
  isMultiPage: boolean;
  currentPage: number;
  totalExpectedPages?: number;
  readyToMerge: boolean;
} {
  const projectCode = parseResult.projectInfo?.projectCode || `single_${fileId}`;
  const pageNumber = parseResult.projectInfo?.page || 1;
  const totalPages = parseResult.projectInfo?.totalPages;
  
  const sessionKey = getSessionKey(organizationId, projectCode);
  
  // Get or create session
  let session = activeSessions.get(sessionKey);
  
  if (!session) {
    session = {
      sessionId: `tps_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organizationId,
      userId,
      templateId,
      projectCode: parseResult.projectInfo?.projectCode,
      pages: [],
      totalExpectedPages: totalPages,
      status: "collecting",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    activeSessions.set(sessionKey, session);
    
    logger.info("[TemplateParseService] Created new multi-page session", {
      sessionId: session.sessionId,
      projectCode,
      totalExpectedPages: totalPages,
    });
  }
  
  // Add this page to the session
  const pageResult: TemplatePageResult = {
    pageNumber,
    fileId,
    fileName,
    parseResult,
    rawParts: parseResult.parts,
    confidence: parseResult.confidence,
    processingTimeMs,
  };
  
  // Update or add page
  const existingPageIndex = session.pages.findIndex(p => p.pageNumber === pageNumber);
  if (existingPageIndex >= 0) {
    session.pages[existingPageIndex] = pageResult;
  } else {
    session.pages.push(pageResult);
  }
  
  // Update expected total if this page has it
  if (totalPages && !session.totalExpectedPages) {
    session.totalExpectedPages = totalPages;
  }
  
  session.updatedAt = new Date();
  
  // Check if all pages are collected
  const isMultiPage = (totalPages && totalPages > 1) || session.pages.length > 1;
  const readyToMerge = session.totalExpectedPages 
    ? session.pages.length >= session.totalExpectedPages
    : false;
  
  logger.info("[TemplateParseService] Registered template page", {
    sessionId: session.sessionId,
    pageNumber,
    totalPages: session.totalExpectedPages,
    pagesCollected: session.pages.length,
    isMultiPage,
    readyToMerge,
  });
  
  return {
    sessionId: session.sessionId,
    isMultiPage,
    currentPage: pageNumber,
    totalExpectedPages: session.totalExpectedPages,
    readyToMerge,
  };
}

/**
 * Get current status of a multi-page session
 */
export function getSessionStatus(sessionId: string): TemplateParseSession | null {
  for (const session of activeSessions.values()) {
    if (session.sessionId === sessionId) {
      return session;
    }
  }
  return null;
}

/**
 * Get session by project code
 */
export function getSessionByProjectCode(
  organizationId: string, 
  projectCode: string
): TemplateParseSession | null {
  const sessionKey = getSessionKey(organizationId, projectCode);
  return activeSessions.get(sessionKey) || null;
}

/**
 * Merge all pages in a session and return combined result
 */
export function mergeSessionPages(sessionId: string): MultiPageMergeResult {
  // Find session
  let session: TemplateParseSession | null = null;
  let sessionKey: string | null = null;
  
  for (const [key, s] of activeSessions.entries()) {
    if (s.sessionId === sessionId) {
      session = s;
      sessionKey = key;
      break;
    }
  }
  
  if (!session) {
    return {
      success: false,
      merged: false,
      projectCode: "",
      totalPages: 0,
      parts: [],
      averageConfidence: 0,
      autoAccept: false,
      errors: ["Session not found"],
    };
  }
  
  // Sort pages by page number
  const sortedPages = [...session.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  
  // Check for missing pages
  const missingPages: number[] = [];
  if (session.totalExpectedPages) {
    for (let i = 1; i <= session.totalExpectedPages; i++) {
      if (!sortedPages.some(p => p.pageNumber === i)) {
        missingPages.push(i);
      }
    }
  }
  
  if (missingPages.length > 0) {
    logger.warn("[TemplateParseService] Merging with missing pages", {
      sessionId,
      missingPages,
      totalExpected: session.totalExpectedPages,
    });
  }
  
  // Merge using template-ocr merge function
  const parseResults = sortedPages.map(p => p.parseResult);
  const mergedResult = mergeTemplatePages(parseResults);
  
  // Calculate average confidence
  const avgConfidence = sortedPages.length > 0
    ? sortedPages.reduce((sum, p) => sum + p.confidence, 0) / sortedPages.length
    : 0;
  
  // Determine if auto-accept
  const autoAccept = avgConfidence >= AUTO_ACCEPT_CONFIDENCE_THRESHOLD;
  
  // Update session status
  session.status = "merged";
  session.updatedAt = new Date();
  
  logger.info("[TemplateParseService] Pages merged", {
    sessionId,
    projectCode: session.projectCode,
    totalPages: sortedPages.length,
    totalParts: mergedResult.parts.length,
    avgConfidence,
    autoAccept,
  });
  
  return {
    success: true,
    merged: sortedPages.length > 1,
    projectCode: session.projectCode || "",
    totalPages: sortedPages.length,
    parts: mergedResult.parts,
    averageConfidence: avgConfidence,
    autoAccept,
    errors: missingPages.length > 0 
      ? [`Missing pages: ${missingPages.join(", ")}`]
      : [],
  };
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(maxAgeMs: number = MULTI_PAGE_WAIT_TIMEOUT_MS * 2): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, session] of activeSessions.entries()) {
    const age = now - session.updatedAt.getTime();
    if (age > maxAgeMs && session.status !== "merged") {
      activeSessions.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug("[TemplateParseService] Cleaned up expired sessions", { cleaned });
  }
  
  return cleaned;
}

// ============================================================
// CONFIDENCE-BASED AUTO-ACCEPT
// ============================================================

export interface AutoAcceptResult {
  shouldAutoAccept: boolean;
  confidence: number;
  threshold: number;
  reasons: string[];
}

/**
 * Determine if parts should be auto-accepted based on confidence
 */
export function checkAutoAccept(
  parts: ParsedTemplatePart[],
  templateId: string
): AutoAcceptResult {
  if (parts.length === 0) {
    return {
      shouldAutoAccept: false,
      confidence: 0,
      threshold: AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
      reasons: ["No parts to evaluate"],
    };
  }
  
  // Calculate average confidence
  const avgConfidence = parts.reduce((sum, p) => sum + p.confidence, 0) / parts.length;
  
  // Check for low-confidence parts
  const lowConfidenceParts = parts.filter(p => p.confidence < 0.8);
  
  // Check for missing required fields
  const missingFieldsParts = parts.filter(p => 
    !p.length || !p.width || !p.quantity
  );
  
  const reasons: string[] = [];
  let shouldAutoAccept = avgConfidence >= AUTO_ACCEPT_CONFIDENCE_THRESHOLD;
  
  if (lowConfidenceParts.length > 0) {
    reasons.push(`${lowConfidenceParts.length} parts with confidence < 0.8`);
    // Don't auto-accept if any part has low confidence
    if (lowConfidenceParts.some(p => p.confidence < 0.7)) {
      shouldAutoAccept = false;
    }
  }
  
  if (missingFieldsParts.length > 0) {
    reasons.push(`${missingFieldsParts.length} parts missing required fields`);
    shouldAutoAccept = false;
  }
  
  if (shouldAutoAccept) {
    reasons.push("All parts meet confidence threshold");
  }
  
  logger.debug("[TemplateParseService] Auto-accept check", {
    templateId,
    partsCount: parts.length,
    avgConfidence,
    threshold: AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
    shouldAutoAccept,
    lowConfidenceParts: lowConfidenceParts.length,
    missingFieldsParts: missingFieldsParts.length,
  });
  
  return {
    shouldAutoAccept,
    confidence: avgConfidence,
    threshold: AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
    reasons,
  };
}

// ============================================================
// AUDIT LOGGING
// ============================================================

/**
 * Log template parsing audit for training feedback
 * Uses the existing ParsingAccuracyLog model schema
 */
export async function logTemplateParseAudit(
  audit: Omit<TemplateParseAudit, "id" | "createdAt">
): Promise<string> {
  try {
    const record = await prisma.parsingAccuracyLog.create({
      data: {
        id: `tpa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        provider: "template", // Identifies this as template-based parsing
        sourceType: "cai_template",
        totalParts: audit.totalParts,
        correctParts: audit.autoAccepted ? audit.totalParts : Math.floor(audit.totalParts * audit.averageConfidence),
        accuracy: audit.averageConfidence,
        clientTemplateUsed: true, // CAI templates are always "client templates"
        // Store additional info in the parseJobId field as JSON-encoded metadata
        parseJobId: JSON.stringify({
          templateId: audit.templateId,
          version: audit.version,
          projectCode: audit.projectCode,
          totalPages: audit.totalPages,
          autoAccepted: audit.autoAccepted,
          humanCorrected: audit.humanCorrected,
          correctionCount: audit.correctionCount,
          organizationId: audit.organizationId,
          processingTimeMs: audit.processingTimeMs,
        }),
      },
    });
    
    logger.info("[TemplateParseService] Audit logged", {
      auditId: record.id,
      templateId: audit.templateId,
      totalParts: audit.totalParts,
      avgConfidence: audit.averageConfidence,
      autoAccepted: audit.autoAccepted,
    });
    
    return record.id;
  } catch (error) {
    logger.error("[TemplateParseService] Failed to log audit", {
      error: error instanceof Error ? error.message : "Unknown error",
      templateId: audit.templateId,
    });
    throw error;
  }
}

/**
 * Update audit record when human makes corrections
 * Updates the correctParts count and recalculates accuracy
 */
export async function logHumanCorrections(
  auditId: string,
  correctionCount: number
): Promise<void> {
  try {
    // First, get the current record to update the metadata
    const current = await prisma.parsingAccuracyLog.findUnique({
      where: { id: auditId },
      select: { parseJobId: true, totalParts: true, correctParts: true },
    });
    
    if (!current) {
      logger.warn("[TemplateParseService] Audit record not found for corrections", { auditId });
      return;
    }
    
    // Parse existing metadata and update it
    let metadata: Record<string, unknown> = {};
    try {
      if (current.parseJobId) {
        metadata = JSON.parse(current.parseJobId);
      }
    } catch {
      // If parsing fails, start fresh
    }
    
    metadata.humanCorrected = true;
    metadata.correctionCount = correctionCount;
    
    // Update correctParts based on corrections
    const newCorrectParts = Math.max(0, current.totalParts - correctionCount);
    const newAccuracy = current.totalParts > 0 ? newCorrectParts / current.totalParts : 0;
    
    await prisma.parsingAccuracyLog.update({
      where: { id: auditId },
      data: {
        parseJobId: JSON.stringify(metadata),
        correctParts: newCorrectParts,
        accuracy: newAccuracy,
      },
    });
    
    logger.info("[TemplateParseService] Human corrections logged", {
      auditId,
      correctionCount,
      newCorrectParts,
      newAccuracy,
    });
  } catch (error) {
    logger.error("[TemplateParseService] Failed to log corrections", {
      auditId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================================
// TEMPLATE VERSION VALIDATION
// ============================================================

/**
 * Check if template version matches current org shortcodes
 */
export async function validateTemplateVersion(
  organizationId: string,
  templateVersion: string
): Promise<{
  valid: boolean;
  currentVersion: string;
  versionMismatch: boolean;
  message: string;
}> {
  try {
    // Get current shortcodes hash
    const [edgebandOps, grooveOps, drillingOps, cncOps] = await Promise.all([
      prisma.edgebandOperation.count({ where: { organizationId, isActive: true } }),
      prisma.grooveOperation.count({ where: { organizationId, isActive: true } }),
      prisma.drillingOperation.count({ where: { organizationId, isActive: true } }),
      prisma.cncOperation.count({ where: { organizationId, isActive: true } }),
    ]);
    
    // Simple version calculation based on total ops
    const totalOps = edgebandOps + grooveOps + drillingOps + cncOps;
    const currentVersion = `1.${totalOps}`;
    
    const versionMismatch = templateVersion !== currentVersion;
    
    return {
      valid: true, // Template is still parseable
      currentVersion,
      versionMismatch,
      message: versionMismatch
        ? `Template version ${templateVersion} differs from current ${currentVersion}. Some shortcodes may have changed.`
        : "Template version matches current configuration",
    };
  } catch (error) {
    logger.error("[TemplateParseService] Version validation failed", {
      organizationId,
      templateVersion,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    return {
      valid: true, // Allow parsing even if validation fails
      currentVersion: "unknown",
      versionMismatch: false,
      message: "Could not validate template version",
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  AUTO_ACCEPT_CONFIDENCE_THRESHOLD as CONFIDENCE_THRESHOLD,
};

