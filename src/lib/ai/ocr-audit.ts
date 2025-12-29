/**
 * CAI Intake - OCR Audit Logging
 * 
 * Comprehensive audit trail for all OCR operations.
 * Enables debugging, accuracy tracking, and continuous improvement.
 */

import { logger } from "@/lib/logger";
import type { QualityMetrics } from "./ocr-utils";
import type { ReviewFlag } from "./ocr-validation";

// ============================================================
// TYPES
// ============================================================

export interface OCRAuditEntry {
  // Identification
  id: string;
  requestId: string;
  timestamp: Date;
  organizationId?: string;
  
  // Input Details
  input: {
    type: "image" | "pdf" | "text";
    fileName?: string;
    fileSizeKB: number;
    dimensions?: { width: number; height: number };
    pageCount?: number;
  };
  
  // Processing Details
  processing: {
    provider: "anthropic" | "openai";
    model: string;
    strategy: "single-pass" | "chunked" | "segmented";
    promptTokens?: number;
    completionTokens?: number;
    processingTimeMs: number;
    retryCount: number;
    usedFallback: boolean;
  };
  
  // Output Details
  output: {
    success: boolean;
    partsExtracted: number;
    sectionsDetected: string[];
    avgConfidence: number;
    qualityScore: number;
  };
  
  // Verification
  verification: {
    estimatedParts?: number;
    truncationDetected: boolean;
    validationPassed: boolean;
    reviewFlagsCount: number;
    needsReview: boolean;
    reviewReason?: string;
  };
  
  // Errors
  errors: string[];
  warnings: string[];
}

export interface AccuracyMetrics {
  period: "day" | "week" | "month";
  startDate: Date;
  endDate: Date;
  
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  
  avgPartsPerExtraction: number;
  avgConfidence: number;
  avgQualityScore: number;
  avgProcessingTimeMs: number;
  
  truncationRate: number;
  fallbackRate: number;
  reviewRate: number;
  retryRate: number;
  
  providerBreakdown: {
    anthropic: { count: number; avgTime: number };
    openai: { count: number; avgTime: number };
  };
  
  errorBreakdown: Record<string, number>;
}

// ============================================================
// AUDIT LOGGER
// ============================================================

/**
 * In-memory audit log for recent entries.
 * In production, this would be persisted to a database.
 */
const auditLog: OCRAuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 1000;

/**
 * Create a new audit entry ID.
 */
function generateAuditId(): string {
  return `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log an OCR operation for auditing.
 */
export function logOCRAudit(entry: Omit<OCRAuditEntry, "id" | "timestamp">): OCRAuditEntry {
  const fullEntry: OCRAuditEntry = {
    ...entry,
    id: generateAuditId(),
    timestamp: new Date(),
  };
  
  // Add to in-memory log
  auditLog.push(fullEntry);
  
  // Trim old entries
  while (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.shift();
  }
  
  // Log for debugging
  logger.info("📊 [OCR Audit] Operation logged", {
    auditId: fullEntry.id,
    requestId: fullEntry.requestId,
    success: fullEntry.output.success,
    partsExtracted: fullEntry.output.partsExtracted,
    qualityScore: fullEntry.output.qualityScore,
    processingTimeMs: fullEntry.processing.processingTimeMs,
    needsReview: fullEntry.verification.needsReview,
  });
  
  return fullEntry;
}

/**
 * Get recent audit entries.
 */
export function getRecentAuditEntries(limit: number = 100): OCRAuditEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Get audit entry by request ID.
 */
export function getAuditByRequestId(requestId: string): OCRAuditEntry | undefined {
  return auditLog.find(e => e.requestId === requestId);
}

/**
 * Calculate accuracy metrics for a time period.
 */
export function calculateAccuracyMetrics(
  period: "day" | "week" | "month"
): AccuracyMetrics {
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }
  
  const entries = auditLog.filter(e => e.timestamp >= startDate);
  
  if (entries.length === 0) {
    return {
      period,
      startDate,
      endDate: now,
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      avgPartsPerExtraction: 0,
      avgConfidence: 0,
      avgQualityScore: 0,
      avgProcessingTimeMs: 0,
      truncationRate: 0,
      fallbackRate: 0,
      reviewRate: 0,
      retryRate: 0,
      providerBreakdown: {
        anthropic: { count: 0, avgTime: 0 },
        openai: { count: 0, avgTime: 0 },
      },
      errorBreakdown: {},
    };
  }
  
  const successful = entries.filter(e => e.output.success);
  const failed = entries.filter(e => !e.output.success);
  
  const anthropicEntries = entries.filter(e => e.processing.provider === "anthropic");
  const openaiEntries = entries.filter(e => e.processing.provider === "openai");
  
  const errorBreakdown: Record<string, number> = {};
  for (const entry of entries) {
    for (const error of entry.errors) {
      const key = error.split(":")[0] || "Unknown";
      errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
    }
  }
  
  return {
    period,
    startDate,
    endDate: now,
    totalExtractions: entries.length,
    successfulExtractions: successful.length,
    failedExtractions: failed.length,
    avgPartsPerExtraction: entries.length > 0 
      ? entries.reduce((sum, e) => sum + e.output.partsExtracted, 0) / entries.length 
      : 0,
    avgConfidence: successful.length > 0 
      ? successful.reduce((sum, e) => sum + e.output.avgConfidence, 0) / successful.length 
      : 0,
    avgQualityScore: successful.length > 0 
      ? successful.reduce((sum, e) => sum + e.output.qualityScore, 0) / successful.length 
      : 0,
    avgProcessingTimeMs: entries.length > 0 
      ? entries.reduce((sum, e) => sum + e.processing.processingTimeMs, 0) / entries.length 
      : 0,
    truncationRate: entries.length > 0 
      ? entries.filter(e => e.verification.truncationDetected).length / entries.length 
      : 0,
    fallbackRate: entries.length > 0 
      ? entries.filter(e => e.processing.usedFallback).length / entries.length 
      : 0,
    reviewRate: entries.length > 0 
      ? entries.filter(e => e.verification.needsReview).length / entries.length 
      : 0,
    retryRate: entries.length > 0 
      ? entries.filter(e => e.processing.retryCount > 0).length / entries.length 
      : 0,
    providerBreakdown: {
      anthropic: {
        count: anthropicEntries.length,
        avgTime: anthropicEntries.length > 0 
          ? anthropicEntries.reduce((sum, e) => sum + e.processing.processingTimeMs, 0) / anthropicEntries.length 
          : 0,
      },
      openai: {
        count: openaiEntries.length,
        avgTime: openaiEntries.length > 0 
          ? openaiEntries.reduce((sum, e) => sum + e.processing.processingTimeMs, 0) / openaiEntries.length 
          : 0,
      },
    },
    errorBreakdown,
  };
}

// ============================================================
// AUDIT BUILDER (Fluent API)
// ============================================================

/**
 * Builder class for constructing audit entries.
 */
export class OCRAuditBuilder {
  private entry: Partial<OCRAuditEntry>;
  private startTime: number;
  
  constructor(requestId: string) {
    this.startTime = Date.now();
    this.entry = {
      requestId,
      input: {} as OCRAuditEntry["input"],
      processing: {
        retryCount: 0,
        usedFallback: false,
      } as OCRAuditEntry["processing"],
      output: {
        success: false,
        partsExtracted: 0,
        sectionsDetected: [],
        avgConfidence: 0,
        qualityScore: 0,
      },
      verification: {
        truncationDetected: false,
        validationPassed: false,
        reviewFlagsCount: 0,
        needsReview: false,
      },
      errors: [],
      warnings: [],
    };
  }
  
  setOrganization(orgId: string): this {
    this.entry.organizationId = orgId;
    return this;
  }
  
  setInput(input: OCRAuditEntry["input"]): this {
    this.entry.input = input;
    return this;
  }
  
  setProvider(provider: "anthropic" | "openai", model: string): this {
    this.entry.processing!.provider = provider;
    this.entry.processing!.model = model;
    return this;
  }
  
  setStrategy(strategy: "single-pass" | "chunked" | "segmented"): this {
    this.entry.processing!.strategy = strategy;
    return this;
  }
  
  setTokenUsage(prompt: number, completion: number): this {
    this.entry.processing!.promptTokens = prompt;
    this.entry.processing!.completionTokens = completion;
    return this;
  }
  
  incrementRetry(): this {
    this.entry.processing!.retryCount!++;
    return this;
  }
  
  setUsedFallback(used: boolean): this {
    this.entry.processing!.usedFallback = used;
    return this;
  }
  
  setOutput(output: Partial<OCRAuditEntry["output"]>): this {
    Object.assign(this.entry.output!, output);
    return this;
  }
  
  setQualityMetrics(metrics: QualityMetrics): this {
    this.entry.output!.partsExtracted = metrics.partsExtracted;
    this.entry.output!.avgConfidence = metrics.avgConfidence;
    this.entry.output!.qualityScore = metrics.qualityScore;
    return this;
  }
  
  setVerification(verification: Partial<OCRAuditEntry["verification"]>): this {
    Object.assign(this.entry.verification!, verification);
    return this;
  }
  
  setReviewFlags(flags: ReviewFlag[]): this {
    this.entry.verification!.reviewFlagsCount = flags.length;
    return this;
  }
  
  addError(error: string): this {
    this.entry.errors!.push(error);
    return this;
  }
  
  addWarning(warning: string): this {
    this.entry.warnings!.push(warning);
    return this;
  }
  
  /**
   * Finalize and log the audit entry.
   */
  finalize(): OCRAuditEntry {
    this.entry.processing!.processingTimeMs = Date.now() - this.startTime;
    
    return logOCRAudit(this.entry as Omit<OCRAuditEntry, "id" | "timestamp">);
  }
}

/**
 * Create a new audit builder for a request.
 */
export function createAuditBuilder(requestId: string): OCRAuditBuilder {
  return new OCRAuditBuilder(requestId);
}

