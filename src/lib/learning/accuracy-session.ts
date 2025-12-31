/**
 * CAI Intake - Accuracy Session Tracker
 * 
 * Tracks parsing sessions and logs accuracy when corrections are finalized.
 * Integrates with the corrections system to aggregate data.
 */

"use client";

import { logAccuracyFromCorrections } from "./accuracy";
import type { CutPart } from "@/lib/schema";

// ============================================================
// SESSION STORAGE
// ============================================================

interface ParsingSession {
  sessionId: string;
  startTime: Date;
  organizationId?: string;
  parseJobId?: string;
  provider?: "claude" | "gpt" | "python_ocr" | "pdf-parse";
  sourceType?: "pdf" | "image" | "text";
  sourceFileName?: string;
  clientName?: string;
  fewShotExamplesUsed?: number;
  patternsApplied?: number;
  clientTemplateUsed?: boolean;
  /** Original parts as parsed by AI */
  originalParts: Map<string, CutPart>;
  /** Parts after user corrections */
  correctedParts: Map<string, CutPart>;
  /** Whether accuracy has been logged for this session */
  logged: boolean;
}

// In-memory session storage (client-side only)
const sessions = new Map<string, ParsingSession>();

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Start a new parsing session
 */
export function startAccuracySession(
  sessionId: string,
  metadata: {
    organizationId?: string;
    parseJobId?: string;
    provider?: "claude" | "gpt" | "python_ocr" | "pdf-parse";
    sourceType?: "pdf" | "image" | "text";
    sourceFileName?: string;
    clientName?: string;
    fewShotExamplesUsed?: number;
    patternsApplied?: number;
    clientTemplateUsed?: boolean;
  }
): void {
  sessions.set(sessionId, {
    sessionId,
    startTime: new Date(),
    ...metadata,
    originalParts: new Map(),
    correctedParts: new Map(),
    logged: false,
  });
  
  console.debug(`📊 [Accuracy Session] Started session ${sessionId}`);
}

/**
 * Record original parsed parts for a session
 */
export function recordOriginalParts(
  sessionId: string,
  parts: CutPart[]
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(`📊 [Accuracy Session] Session ${sessionId} not found`);
    return;
  }

  for (const part of parts) {
    if (part.part_id) {
      session.originalParts.set(part.part_id, { ...part });
    }
  }

  console.debug(`📊 [Accuracy Session] Recorded ${parts.length} original parts for session ${sessionId}`);
}

/**
 * Record corrected parts for a session
 */
export function recordCorrectedParts(
  sessionId: string,
  parts: CutPart[]
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(`📊 [Accuracy Session] Session ${sessionId} not found`);
    return;
  }

  for (const part of parts) {
    session.correctedParts.set(part.part_id, { ...part });
  }

  console.debug(`📊 [Accuracy Session] Recorded ${parts.length} corrected parts for session ${sessionId}`);
}

/**
 * Update a specific corrected part
 */
export function updateCorrectedPart(
  sessionId: string,
  partId: string,
  part: CutPart
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.correctedParts.set(partId, { ...part });
}

/**
 * Finalize a session and log accuracy
 * Call this when the user saves a cutlist or exits the workflow
 */
export async function finalizeAccuracySession(
  sessionId: string
): Promise<{ success: boolean; accuracy?: number }> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return { success: false };
  }

  if (session.logged) {
    console.debug(`📊 [Accuracy Session] Session ${sessionId} already logged`);
    return { success: true };
  }

  // Convert maps to arrays
  const originalParts = Array.from(session.originalParts.values());
  const correctedParts = Array.from(session.correctedParts.values());

  // If no corrected parts recorded, use original as corrected (no changes made)
  const finalCorrectedParts = correctedParts.length > 0 ? correctedParts : originalParts;

  if (originalParts.length === 0) {
    console.debug(`📊 [Accuracy Session] No original parts to compare for session ${sessionId}`);
    sessions.delete(sessionId);
    return { success: false };
  }

  try {
    const entry = await logAccuracyFromCorrections(
      originalParts,
      finalCorrectedParts,
      {
        organizationId: session.organizationId,
        parseJobId: session.parseJobId,
        provider: session.provider,
        sourceType: session.sourceType,
        fewShotExamplesUsed: session.fewShotExamplesUsed,
        patternsApplied: session.patternsApplied,
        clientTemplateUsed: session.clientTemplateUsed,
        clientName: session.clientName,
      }
    );

    session.logged = true;
    
    // Clean up after a delay (keep for debugging)
    setTimeout(() => {
      sessions.delete(sessionId);
    }, 60000);

    return { 
      success: true, 
      accuracy: entry?.accuracy,
    };
  } catch (error) {
    console.error(`📊 [Accuracy Session] Failed to finalize session ${sessionId}:`, error);
    return { success: false };
  }
}

/**
 * Get session info (for debugging)
 */
export function getSessionInfo(sessionId: string): {
  exists: boolean;
  originalCount: number;
  correctedCount: number;
  logged: boolean;
} | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    exists: true,
    originalCount: session.originalParts.size,
    correctedCount: session.correctedParts.size,
    logged: session.logged,
  };
}

/**
 * Clean up a session without logging
 */
export function discardSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Get all active sessions (for debugging)
 */
export function getActiveSessions(): string[] {
  return Array.from(sessions.keys());
}

