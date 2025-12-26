/**
 * CAI Intake - Progress Tracking Types
 * 
 * Types for tracking OCR/parsing progress across file processing.
 * Based on Cabinet AI's progress tracking architecture.
 */

// ============================================================
// FILE STATUS & STAGES
// ============================================================

/** Status of an individual file in the processing queue */
export type OCRFileStatus = 
  | 'pending'      // Waiting to be processed
  | 'processing'   // Currently being processed
  | 'complete'     // Successfully processed
  | 'error'        // Processing failed
  | 'cancelled';   // Processing was cancelled

/** Processing stage for detailed progress tracking */
export type OCRStage = 
  | 'queued'       // In queue, not started
  | 'uploading'    // File being uploaded/read
  | 'detecting'    // Detecting file type/template
  | 'ocr'          // OCR/vision processing
  | 'parsing'      // Parsing extracted text
  | 'validating'   // Validating parsed data
  | 'done';        // Processing complete

// ============================================================
// FILE PROGRESS
// ============================================================

/** Progress information for a single file */
export interface OCRFileProgress {
  /** Index of the file in the batch */
  fileIndex: number;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSizeBytes?: number;
  /** Current processing status */
  status: OCRFileStatus;
  /** Current processing stage */
  stage: OCRStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of items/parts found so far */
  itemsFound: number;
  /** Timestamp when processing started */
  startedAt?: number;
  /** Timestamp when processing finished */
  finishedAt?: number;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Whether template was detected */
  templateDetected?: boolean;
  /** Template ID if detected */
  templateId?: string;
  /** Confidence score if available */
  confidence?: number;
}

// ============================================================
// OVERALL STATS
// ============================================================

/** Overall statistics for a processing session */
export interface OcrOverallStats {
  /** Total number of files in the batch */
  totalFiles: number;
  /** Number of files successfully processed */
  processedFiles: number;
  /** Number of files that failed */
  failedFiles: number;
  /** Number of files cancelled */
  cancelledFiles: number;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Total items/parts found across all files */
  totalItemsFound: number;
  /** Timestamp when processing started */
  startedAt: number;
  /** Timestamp of last update */
  lastUpdateAt: number;
  /** Estimated time to completion in seconds */
  etaSeconds?: number;
  /** Average confidence across processed files */
  averageConfidence?: number;
}

// ============================================================
// PROGRESS SNAPSHOT
// ============================================================

/** Complete progress snapshot for a session */
export interface OCRProgressSnapshot {
  /** Unique session identifier */
  sessionId: string;
  /** Overall session status */
  status: 'processing' | 'complete' | 'error' | 'cancelled';
  /** Overall statistics */
  overall: OcrOverallStats;
  /** Per-file progress information */
  files: OCRFileProgress[];
  /** Human-readable status message */
  message?: string;
  /** Whether cancellation was requested */
  cancelRequested?: boolean;
  /** Organization ID for multi-tenant isolation */
  organizationId?: string;
  /** User ID who initiated the session */
  userId?: string;
}

// ============================================================
// CLIENT-SIDE PROGRESS
// ============================================================

/** Progress data for client-side polling */
export interface OCRProgressClient extends OCRProgressSnapshot {
  /** Whether processing is still in progress */
  isProcessing: boolean;
}

// ============================================================
// PARSE RESULT WITH PROGRESS
// ============================================================

/** Extended parse result with progress metadata */
export interface ParseResultWithProgress {
  /** Session ID */
  sessionId: string;
  /** Success status */
  success: boolean;
  /** Parsed items */
  items: unknown[];
  /** Summary statistics */
  summary: {
    totalFiles: number;
    totalItems: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
  /** Per-file results */
  files: Array<{
    fileName: string;
    success: boolean;
    itemsCount: number;
    confidence: number;
    errors?: string[];
    warnings?: string[];
    templateDetected?: boolean;
    templateId?: string;
  }>;
}



