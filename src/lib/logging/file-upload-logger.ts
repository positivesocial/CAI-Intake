/**
 * CAI Intake - File Upload Logger
 * 
 * Comprehensive logging for the Smart File Upload feature.
 * Provides detailed visibility into:
 * - File queuing and processing stages
 * - QR code detection
 * - AI parsing operations
 * - Storage operations
 * - Performance metrics
 * 
 * Enable verbose logging by setting LOG_LEVEL=debug in .env
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FileUploadLogContext {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  userId?: string;
  organizationId?: string;
}

export interface ProcessingStage {
  stage: "queued" | "upload_start" | "qr_detection" | "ai_processing" | "storage" | "complete" | "error";
  timestamp: number;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export interface AIProcessingMetrics {
  provider: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  processingTimeMs: number;
  partsExtracted: number;
  confidence: number;
}

export interface FileUploadSession {
  sessionId: string;
  startTime: number;
  files: Map<string, FileUploadLogContext>;
  stages: Map<string, ProcessingStage[]>;
  metrics: Map<string, AIProcessingMetrics>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const isDebug = process.env.LOG_LEVEL === "debug" || process.env.NODE_ENV === "development";
const isVerbose = process.env.FILE_UPLOAD_VERBOSE === "true";

// =============================================================================
// LOGGER CLASS
// =============================================================================

class FileUploadLogger {
  private currentSession: FileUploadSession | null = null;
  private readonly prefix = "📤 [FileUpload]";

  /**
   * Start a new upload session
   */
  startSession(): string {
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      files: new Map(),
      stages: new Map(),
      metrics: new Map(),
    };
    
    this.log("info", `Session started`, { sessionId });
    return sessionId;
  }

  /**
   * End the current session and output summary
   */
  endSession(): void {
    if (!this.currentSession) return;
    
    const duration = Date.now() - this.currentSession.startTime;
    const fileCount = this.currentSession.files.size;
    const successCount = Array.from(this.currentSession.stages.values())
      .filter(stages => stages.some(s => s.stage === "complete")).length;
    const errorCount = Array.from(this.currentSession.stages.values())
      .filter(stages => stages.some(s => s.stage === "error")).length;
    
    this.log("info", `Session ended`, {
      sessionId: this.currentSession.sessionId,
      totalDurationMs: duration,
      totalFiles: fileCount,
      successful: successCount,
      failed: errorCount,
      avgTimePerFile: fileCount > 0 ? Math.round(duration / fileCount) : 0,
    });
    
    // Output detailed summary in debug mode
    if (isDebug || isVerbose) {
      this.outputDetailedSummary();
    }
    
    this.currentSession = null;
  }

  /**
   * Register a file being added to the queue
   */
  fileQueued(context: FileUploadLogContext): void {
    if (this.currentSession) {
      this.currentSession.files.set(context.fileId, context);
      this.currentSession.stages.set(context.fileId, []);
    }
    
    this.recordStage(context.fileId, "queued", {
      fileName: context.fileName,
      fileType: context.fileType,
      sizeKB: Math.round(context.fileSizeBytes / 1024),
    });
  }

  /**
   * Log file processing start
   */
  processingStart(fileId: string): void {
    this.recordStage(fileId, "upload_start");
  }

  /**
   * Log QR detection phase
   */
  qrDetection(fileId: string, result: {
    found: boolean;
    templateId?: string;
    processingTimeMs: number;
  }): void {
    this.recordStage(fileId, "qr_detection", {
      qrFound: result.found,
      templateId: result.templateId,
      processingTimeMs: result.processingTimeMs,
    });
    
    if (result.found) {
      this.log("info", `QR template detected`, {
        fileId: fileId.substring(0, 8),
        templateId: result.templateId,
      });
    }
  }

  /**
   * Log AI processing phase
   */
  aiProcessingStart(fileId: string, details: {
    provider: string;
    model?: string;
    imageOptimization?: {
      originalSizeKB: number;
      optimizedSizeKB: number;
      reductionPercent: number;
    };
  }): void {
    this.recordStage(fileId, "ai_processing", {
      ...details,
      phase: "started",
    });
    
    if (details.imageOptimization && isDebug) {
      this.log("debug", `Image optimized`, {
        fileId: fileId.substring(0, 8),
        original: `${details.imageOptimization.originalSizeKB.toFixed(1)}KB`,
        optimized: `${details.imageOptimization.optimizedSizeKB.toFixed(1)}KB`,
        reduction: `${details.imageOptimization.reductionPercent.toFixed(0)}%`,
      });
    }
  }

  /**
   * Log AI processing completion
   */
  aiProcessingComplete(fileId: string, metrics: AIProcessingMetrics): void {
    if (this.currentSession) {
      this.currentSession.metrics.set(fileId, metrics);
    }
    
    this.log("info", `AI parsing complete`, {
      fileId: fileId.substring(0, 8),
      provider: metrics.provider,
      partsFound: metrics.partsExtracted,
      confidence: `${(metrics.confidence * 100).toFixed(0)}%`,
      processingTimeMs: metrics.processingTimeMs,
      tokens: metrics.totalTokens,
    });
  }

  /**
   * Log AI processing error
   */
  aiProcessingError(fileId: string, error: {
    code: string;
    message: string;
    details?: unknown;
  }): void {
    this.recordStage(fileId, "error", {
      phase: "ai_processing",
      errorCode: error.code,
      errorMessage: error.message,
    });
    
    this.log("error", `AI processing failed`, {
      fileId: fileId.substring(0, 8),
      errorCode: error.code,
      message: error.message,
      details: error.details,
    });
  }

  /**
   * Log file storage operation
   */
  fileStorage(fileId: string, result: {
    success: boolean;
    storagePath?: string;
    uploadedFileId?: string;
    error?: string;
  }): void {
    this.recordStage(fileId, "storage", {
      success: result.success,
      storagePath: result.storagePath,
      uploadedFileId: result.uploadedFileId,
    });
    
    if (result.success) {
      this.log("debug", `File stored`, {
        fileId: fileId.substring(0, 8),
        uploadedFileId: result.uploadedFileId,
        storagePath: result.storagePath,
      });
    } else {
      this.log("warn", `File storage failed`, {
        fileId: fileId.substring(0, 8),
        error: result.error,
      });
    }
  }

  /**
   * Log file processing complete
   */
  fileComplete(fileId: string, result: {
    partsCount: number;
    method: string;
    confidence: number;
    totalProcessingTimeMs: number;
    metadata?: {
      edgeBanding: number;
      grooving: number;
      cncOps: number;
    };
  }): void {
    this.recordStage(fileId, "complete", {
      ...result,
    });
    
    const fileContext = this.currentSession?.files.get(fileId);
    
    this.log("info", `✅ File processed successfully`, {
      fileId: fileId.substring(0, 8),
      fileName: fileContext?.fileName,
      parts: result.partsCount,
      method: result.method,
      confidence: `${(result.confidence * 100).toFixed(0)}%`,
      timeMs: result.totalProcessingTimeMs,
      edgeBanding: result.metadata?.edgeBanding ?? 0,
      grooves: result.metadata?.grooving ?? 0,
      cnc: result.metadata?.cncOps ?? 0,
    });
  }

  /**
   * Log file processing error
   */
  fileError(fileId: string, error: {
    stage: string;
    message: string;
    code?: string;
    details?: unknown;
  }): void {
    this.recordStage(fileId, "error", {
      stage: error.stage,
      errorCode: error.code,
      errorMessage: error.message,
    });
    
    const fileContext = this.currentSession?.files.get(fileId);
    
    this.log("error", `❌ File processing failed`, {
      fileId: fileId.substring(0, 8),
      fileName: fileContext?.fileName,
      stage: error.stage,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  /**
   * Log text parsing (for CSV/TXT files)
   */
  textParsing(fileId: string, result: {
    linesProcessed: number;
    partsExtracted: number;
    errors: number;
    processingTimeMs: number;
  }): void {
    this.log("debug", `Text parsed`, {
      fileId: fileId.substring(0, 8),
      lines: result.linesProcessed,
      parts: result.partsExtracted,
      errors: result.errors,
      timeMs: result.processingTimeMs,
    });
  }

  /**
   * Log PDF processing
   */
  pdfProcessing(fileId: string, phase: string, details: Record<string, unknown>): void {
    this.log("debug", `PDF ${phase}`, {
      fileId: fileId.substring(0, 8),
      ...details,
    });
  }

  /**
   * Log Python OCR service interaction
   */
  pythonOCR(fileId: string, result: {
    available: boolean;
    success?: boolean;
    method?: string;
    textLength?: number;
    tableCount?: number;
    confidence?: number;
    processingTimeMs?: number;
    error?: string;
  }): void {
    if (!result.available) {
      this.log("debug", `Python OCR not available`, {
        fileId: fileId.substring(0, 8),
      });
      return;
    }
    
    if (result.success) {
      this.log("info", `Python OCR extraction`, {
        fileId: fileId.substring(0, 8),
        method: result.method,
        textLength: result.textLength,
        tables: result.tableCount,
        confidence: result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : undefined,
        timeMs: result.processingTimeMs,
      });
    } else {
      this.log("warn", `Python OCR failed`, {
        fileId: fileId.substring(0, 8),
        error: result.error,
      });
    }
  }

  /**
   * Log batch processing stats
   */
  batchStats(stats: {
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    totalPartsFound: number;
    elapsedSeconds: number;
  }): void {
    this.log("info", `Batch progress`, {
      processed: `${stats.processedFiles}/${stats.totalFiles}`,
      failed: stats.failedFiles,
      partsFound: stats.totalPartsFound,
      elapsed: `${stats.elapsedSeconds}s`,
    });
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private recordStage(fileId: string, stage: ProcessingStage["stage"], details?: Record<string, unknown>): void {
    const stageEntry: ProcessingStage = {
      stage,
      timestamp: Date.now(),
      details,
    };
    
    if (this.currentSession) {
      const stages = this.currentSession.stages.get(fileId) || [];
      
      // Calculate duration from previous stage
      if (stages.length > 0) {
        stageEntry.durationMs = stageEntry.timestamp - stages[stages.length - 1].timestamp;
      }
      
      stages.push(stageEntry);
      this.currentSession.stages.set(fileId, stages);
    }
    
    if (isVerbose) {
      this.log("debug", `Stage: ${stage}`, {
        fileId: fileId.substring(0, 8),
        durationMs: stageEntry.durationMs,
        ...details,
      });
    }
  }

  private outputDetailedSummary(): void {
    if (!this.currentSession) return;
    
    console.log("\n" + "=".repeat(60));
    console.log(`${this.prefix} SESSION SUMMARY`);
    console.log("=".repeat(60));
    
    for (const [fileId, context] of this.currentSession.files) {
      const stages = this.currentSession.stages.get(fileId) || [];
      const metrics = this.currentSession.metrics.get(fileId);
      
      console.log(`\n📄 ${context.fileName}`);
      console.log(`   Type: ${context.fileType} | Size: ${Math.round(context.fileSizeBytes / 1024)}KB`);
      
      // Timeline
      console.log("   Timeline:");
      for (const stage of stages) {
        const icon = stage.stage === "error" ? "❌" : stage.stage === "complete" ? "✅" : "⏳";
        const duration = stage.durationMs ? ` (${stage.durationMs}ms)` : "";
        console.log(`     ${icon} ${stage.stage}${duration}`);
      }
      
      // AI Metrics
      if (metrics) {
        console.log(`   AI Processing:`);
        console.log(`     Provider: ${metrics.provider}`);
        console.log(`     Parts: ${metrics.partsExtracted} | Confidence: ${(metrics.confidence * 100).toFixed(0)}%`);
        console.log(`     Time: ${metrics.processingTimeMs}ms | Tokens: ${metrics.totalTokens ?? "N/A"}`);
      }
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
    if (level === "debug" && !isDebug) return;
    
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message: `${this.prefix} ${message}`,
      ...context,
    };
    
    const formatted = JSON.stringify(logData);
    
    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/** Global file upload logger instance */
export const fileUploadLogger = new FileUploadLogger();

/** Create a file-specific logger context */
export function createFileContext(file: File, fileId: string): FileUploadLogContext {
  return {
    fileId,
    fileName: file.name,
    fileType: file.type || "unknown",
    fileSizeBytes: file.size,
  };
}


