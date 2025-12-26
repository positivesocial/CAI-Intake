/**
 * CAI Intake - Progress Helpers
 * 
 * Utility functions for managing progress tracking.
 */

import type {
  OCRProgressSnapshot,
  OCRFileProgress,
  OcrOverallStats,
  OCRFileStatus,
  OCRStage,
} from "./types";
import { generateId } from "@/lib/utils";

// ============================================================
// SESSION INITIALIZATION
// ============================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${generateId("S").slice(2)}`;
}

/**
 * Initialize progress tracking for a batch of files
 */
export function initProgress(
  sessionId: string,
  files: Array<{ name: string; size?: number }>,
  options?: {
    organizationId?: string;
    userId?: string;
  }
): OCRProgressSnapshot {
  const now = Date.now();
  
  const fileEntries: OCRFileProgress[] = files.map((file, index) => ({
    fileIndex: index,
    fileName: file.name,
    fileSizeBytes: file.size,
    status: 'pending' as OCRFileStatus,
    stage: 'queued' as OCRStage,
    progress: 0,
    itemsFound: 0,
  }));

  return {
    sessionId,
    status: 'processing',
    message: 'Queued for processing',
    files: fileEntries,
    overall: {
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      overallProgress: 0,
      totalItemsFound: 0,
      startedAt: now,
      lastUpdateAt: now,
    },
    cancelRequested: false,
    organizationId: options?.organizationId,
    userId: options?.userId,
  };
}

// ============================================================
// FILE UPDATES
// ============================================================

/**
 * Update progress for a specific file
 */
export function updateFile(
  snapshot: OCRProgressSnapshot,
  fileIndexOrName: number | string,
  updates: Partial<OCRFileProgress>,
  message?: string
): OCRProgressSnapshot {
  // Find file by index or name
  let fileIndex: number;
  if (typeof fileIndexOrName === 'number') {
    fileIndex = fileIndexOrName;
  } else {
    fileIndex = snapshot.files.findIndex(f => f.fileName === fileIndexOrName);
  }
  
  if (fileIndex < 0 || fileIndex >= snapshot.files.length) {
    console.warn(`[Progress] File not found: ${fileIndexOrName}`);
    return snapshot;
  }
  
  // Update file entry
  const updatedFile = { ...snapshot.files[fileIndex], ...updates };
  
  // Auto-set timestamps
  if (updates.status === 'processing' && !updatedFile.startedAt) {
    updatedFile.startedAt = Date.now();
  }
  if ((updates.status === 'complete' || updates.status === 'error' || updates.status === 'cancelled') && !updatedFile.finishedAt) {
    updatedFile.finishedAt = Date.now();
  }
  
  // Create new files array with update
  const newFiles = [...snapshot.files];
  newFiles[fileIndex] = updatedFile;
  
  // Recalculate overall stats
  const newSnapshot: OCRProgressSnapshot = {
    ...snapshot,
    files: newFiles,
    message: message ?? snapshot.message,
  };
  
  return recalcOverall(newSnapshot);
}

/**
 * Mark a file as started
 */
export function startFile(
  snapshot: OCRProgressSnapshot,
  fileIndex: number,
  message?: string
): OCRProgressSnapshot {
  return updateFile(snapshot, fileIndex, {
    status: 'processing',
    stage: 'uploading',
    progress: 5,
    startedAt: Date.now(),
  }, message ?? `Processing file ${fileIndex + 1}/${snapshot.files.length}...`);
}

/**
 * Update file stage
 */
export function updateFileStage(
  snapshot: OCRProgressSnapshot,
  fileIndex: number,
  stage: OCRStage,
  progress: number,
  message?: string
): OCRProgressSnapshot {
  return updateFile(snapshot, fileIndex, { stage, progress }, message);
}

/**
 * Mark a file as complete
 */
export function completeFile(
  snapshot: OCRProgressSnapshot,
  fileIndex: number,
  itemsFound: number,
  options?: {
    confidence?: number;
    templateDetected?: boolean;
    templateId?: string;
  }
): OCRProgressSnapshot {
  return updateFile(snapshot, fileIndex, {
    status: 'complete',
    stage: 'done',
    progress: 100,
    itemsFound,
    finishedAt: Date.now(),
    confidence: options?.confidence,
    templateDetected: options?.templateDetected,
    templateId: options?.templateId,
  }, undefined);
}

/**
 * Mark a file as failed
 */
export function failFile(
  snapshot: OCRProgressSnapshot,
  fileIndex: number,
  errorMessage: string
): OCRProgressSnapshot {
  return updateFile(snapshot, fileIndex, {
    status: 'error',
    progress: 0,
    errorMessage,
    finishedAt: Date.now(),
  }, `Error processing file: ${errorMessage}`);
}

/**
 * Mark a file as cancelled
 */
export function cancelFile(
  snapshot: OCRProgressSnapshot,
  fileIndex: number
): OCRProgressSnapshot {
  return updateFile(snapshot, fileIndex, {
    status: 'cancelled',
    finishedAt: Date.now(),
  }, 'Processing cancelled');
}

// ============================================================
// OVERALL CALCULATIONS
// ============================================================

/**
 * Recalculate overall stats from file progress
 */
export function recalcOverall(snapshot: OCRProgressSnapshot): OCRProgressSnapshot {
  const files = snapshot.files;
  
  let processedFiles = 0;
  let failedFiles = 0;
  let cancelledFiles = 0;
  let totalItemsFound = 0;
  let totalProgress = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  
  for (const file of files) {
    totalProgress += file.progress;
    totalItemsFound += file.itemsFound;
    
    if (file.status === 'complete') {
      processedFiles++;
      if (file.confidence !== undefined) {
        confidenceSum += file.confidence;
        confidenceCount++;
      }
    } else if (file.status === 'error') {
      failedFiles++;
    } else if (file.status === 'cancelled') {
      cancelledFiles++;
    }
  }
  
  const overallProgress = files.length > 0 ? Math.round(totalProgress / files.length) : 0;
  const averageConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : undefined;
  
  // Calculate ETA based on progress rate
  const now = Date.now();
  const elapsed = now - snapshot.overall.startedAt;
  let etaSeconds: number | undefined;
  
  if (overallProgress > 0 && overallProgress < 100) {
    const progressPerMs = overallProgress / elapsed;
    const remainingProgress = 100 - overallProgress;
    const remainingMs = remainingProgress / progressPerMs;
    etaSeconds = Math.round(remainingMs / 1000);
  }
  
  // Determine overall status
  let status = snapshot.status;
  const allDone = processedFiles + failedFiles + cancelledFiles === files.length;
  
  if (allDone) {
    if (cancelledFiles > 0) {
      status = 'cancelled';
    } else if (failedFiles === files.length) {
      status = 'error';
    } else {
      status = 'complete';
    }
  }
  
  return {
    ...snapshot,
    status,
    overall: {
      ...snapshot.overall,
      processedFiles,
      failedFiles,
      cancelledFiles,
      overallProgress,
      totalItemsFound,
      lastUpdateAt: now,
      etaSeconds,
      averageConfidence,
    },
  };
}

/**
 * Mark entire session as complete
 */
export function completeSession(
  snapshot: OCRProgressSnapshot,
  message?: string
): OCRProgressSnapshot {
  const updated = recalcOverall(snapshot);
  return {
    ...updated,
    status: 'complete',
    message: message ?? `Completed processing ${updated.overall.processedFiles} files`,
    overall: {
      ...updated.overall,
      overallProgress: 100,
      etaSeconds: undefined,
    },
  };
}

/**
 * Mark entire session as error
 */
export function failSession(
  snapshot: OCRProgressSnapshot,
  message: string
): OCRProgressSnapshot {
  return {
    ...snapshot,
    status: 'error',
    message,
    overall: {
      ...snapshot.overall,
      lastUpdateAt: Date.now(),
      etaSeconds: undefined,
    },
  };
}

/**
 * Mark entire session as cancelled
 */
export function cancelSession(
  snapshot: OCRProgressSnapshot
): OCRProgressSnapshot {
  // Cancel all pending files
  const updatedFiles = snapshot.files.map(file => {
    if (file.status === 'pending' || file.status === 'processing') {
      return {
        ...file,
        status: 'cancelled' as OCRFileStatus,
        finishedAt: Date.now(),
      };
    }
    return file;
  });
  
  return recalcOverall({
    ...snapshot,
    status: 'cancelled',
    message: 'Processing cancelled by user',
    files: updatedFiles,
    cancelRequested: true,
  });
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Format ETA for display
 */
export function formatETA(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) return '';
  
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

/**
 * Get human-readable stage name
 */
export function getStageName(stage: OCRStage): string {
  const names: Record<OCRStage, string> = {
    queued: 'Queued',
    uploading: 'Reading file',
    detecting: 'Detecting format',
    ocr: 'Extracting text',
    parsing: 'Parsing data',
    validating: 'Validating',
    done: 'Complete',
  };
  return names[stage] ?? stage;
}

/**
 * Get progress weight for each stage (for smoother progress)
 */
export function getStageProgress(stage: OCRStage): number {
  const weights: Record<OCRStage, number> = {
    queued: 0,
    uploading: 10,
    detecting: 20,
    ocr: 50,
    parsing: 80,
    validating: 95,
    done: 100,
  };
  return weights[stage] ?? 0;
}



