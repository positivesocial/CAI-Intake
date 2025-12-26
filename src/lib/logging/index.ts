/**
 * CAI Intake - Logging Module
 * 
 * Centralized logging utilities for different parts of the application.
 * 
 * CONFIGURATION:
 * - LOG_LEVEL=debug - Enable debug logs
 * - FILE_UPLOAD_VERBOSE=true - Enable detailed file upload logging with session summaries
 * 
 * USAGE:
 * 
 * File Upload Logging:
 * ```typescript
 * import { fileUploadLogger, createFileContext } from "@/lib/logging/file-upload-logger";
 * 
 * // Start a session
 * fileUploadLogger.startSession();
 * 
 * // Log file queued
 * const context = createFileContext(file, fileId);
 * fileUploadLogger.fileQueued(context);
 * 
 * // Log processing stages
 * fileUploadLogger.processingStart(fileId);
 * fileUploadLogger.qrDetection(fileId, { found: true, templateId: "...", processingTimeMs: 100 });
 * fileUploadLogger.aiProcessingComplete(fileId, { provider: "...", partsExtracted: 5, ... });
 * fileUploadLogger.fileComplete(fileId, { partsCount: 5, method: "AI Vision", ... });
 * 
 * // End session (outputs summary in debug mode)
 * fileUploadLogger.endSession();
 * ```
 */

export { fileUploadLogger, createFileContext, type FileUploadLogContext, type AIProcessingMetrics } from "./file-upload-logger";


