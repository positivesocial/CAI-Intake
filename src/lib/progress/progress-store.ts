/**
 * CAI Intake - Progress Store
 * 
 * In-memory store for tracking OCR/parsing progress across sessions.
 * Uses global storage to persist across hot reloads in development.
 */

import type { OCRProgressSnapshot } from "./types";

// ============================================================
// GLOBAL STORE
// ============================================================

// Use global to persist across hot reloads in development
const globalForProgress = globalThis as unknown as {
  ocrProgressStore: Map<string, OCRProgressSnapshot> | undefined;
  progressCleanupInterval: NodeJS.Timeout | undefined;
};

// Initialize the store
if (!globalForProgress.ocrProgressStore) {
  globalForProgress.ocrProgressStore = new Map();
}

const ocrProgressStore = globalForProgress.ocrProgressStore;

// Progress entries expire after 30 minutes
const PROGRESS_TTL_MS = 30 * 60 * 1000;

// Cleanup interval - run every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ============================================================
// STORE OPERATIONS
// ============================================================

/**
 * Get progress for a session
 */
export function getProgress(sessionId: string): OCRProgressSnapshot | null {
  const snapshot = ocrProgressStore.get(sessionId);
  if (!snapshot) return null;
  
  // Check if expired
  const age = Date.now() - snapshot.overall.lastUpdateAt;
  if (age > PROGRESS_TTL_MS) {
    ocrProgressStore.delete(sessionId);
    return null;
  }
  
  return snapshot;
}

/**
 * Set/update progress for a session
 */
export function setProgress(sessionId: string, snapshot: OCRProgressSnapshot): void {
  // Update timestamp
  snapshot.overall.lastUpdateAt = Date.now();
  ocrProgressStore.set(sessionId, snapshot);
}

/**
 * Delete progress for a session
 */
export function deleteProgress(sessionId: string): void {
  ocrProgressStore.delete(sessionId);
}

/**
 * Check if a session exists
 */
export function hasSession(sessionId: string): boolean {
  return ocrProgressStore.has(sessionId);
}

/**
 * Request cancellation for a session
 */
export function requestCancellation(sessionId: string): boolean {
  const snapshot = ocrProgressStore.get(sessionId);
  if (!snapshot) return false;
  
  if (snapshot.status !== 'processing') return false;
  
  snapshot.cancelRequested = true;
  snapshot.overall.lastUpdateAt = Date.now();
  ocrProgressStore.set(sessionId, snapshot);
  
  return true;
}

/**
 * Check if cancellation was requested for a session
 */
export function isCancellationRequested(sessionId: string): boolean {
  const snapshot = ocrProgressStore.get(sessionId);
  return snapshot?.cancelRequested ?? false;
}

/**
 * Get all active sessions (for admin/debugging)
 */
export function getActiveSessions(): string[] {
  return Array.from(ocrProgressStore.keys());
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  return ocrProgressStore.size;
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions(): void {
  ocrProgressStore.clear();
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Remove expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  for (const [sessionId, snapshot] of ocrProgressStore.entries()) {
    const age = now - snapshot.overall.lastUpdateAt;
    if (age > PROGRESS_TTL_MS) {
      expiredKeys.push(sessionId);
    }
  }
  
  for (const key of expiredKeys) {
    ocrProgressStore.delete(key);
  }
  
  if (expiredKeys.length > 0) {
    console.log(`[ProgressStore] Cleaned up ${expiredKeys.length} expired sessions`);
  }
}

// Start cleanup interval (only in non-edge runtime)
if (typeof globalForProgress.progressCleanupInterval === 'undefined') {
  // Check if we're in a Node.js environment (not edge)
  if (typeof setInterval !== 'undefined') {
    globalForProgress.progressCleanupInterval = setInterval(
      cleanupExpiredSessions,
      CLEANUP_INTERVAL_MS
    );
    
    // Don't block process exit
    if (globalForProgress.progressCleanupInterval.unref) {
      globalForProgress.progressCleanupInterval.unref();
    }
  }
}


