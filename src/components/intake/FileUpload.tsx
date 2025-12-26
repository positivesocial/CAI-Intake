"use client";

/**
 * CAI Intake - Smart File Upload
 * 
 * Enhanced file upload with:
 * - Queue management (add/remove files before processing)
 * - Start/Stop processing controls
 * - Real-time progress tracking with live item counts
 * - Batch processing support
 * - Comprehensive logging for debugging and improvement
 */

import * as React from "react";
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  QrCode,
  Play,
  Square,
  Trash2,
  Clock,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { parseTextBatch } from "@/lib/parsers/text-parser";
import { cn } from "@/lib/utils";
import { type ParsedPartResult } from "@/lib/ai";
import { detectTemplateQR, type QRDetectionResult } from "@/lib/ai/template-ocr";
import { toast } from "sonner";
import { fileUploadLogger, createFileContext } from "@/lib/logging/file-upload-logger";

type FileType = "pdf" | "image" | "excel" | "csv" | "text" | "unknown";
type ProcessingStatus = "queued" | "uploading" | "detecting_qr" | "processing" | "complete" | "error" | "cancelled";

interface UploadedFile {
  id: string;
  file: File;
  type: FileType;
  status: ProcessingStatus;
  progress: number;
  qrDetected?: QRDetectionResult | null;
  result?: {
    partsCount: number;
    confidence: number;
    method: string;
    processingTime?: number;
    metadata?: {
      edgeBanding: number;
      grooving: number;
      cncOps: number;
    };
  };
  error?: string;
}

interface BatchStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalPartsFound: number;
  startTime: number | null;
  elapsedSeconds: number;
}

function getFileType(file: File): FileType {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.includes("image") || ["png", "jpg", "jpeg", "webp"].includes(ext || ""))
    return "image";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    ["xlsx", "xls"].includes(ext || "")
  )
    return "excel";
  if (mime.includes("csv") || ext === "csv") return "csv";
  if (mime.includes("text") || ext === "txt") return "text";

  return "unknown";
}

function getFileIcon(type: FileType) {
  switch (type) {
    case "pdf":
      return FileText;
    case "image":
      return Image;
    case "excel":
    case "csv":
      return FileSpreadsheet;
    case "text":
      return FileText;
    default:
      return File;
  }
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function FileUpload() {
  const addToInbox = useIntakeStore((state) => state.addToInbox);
  const addPendingFileId = useIntakeStore((state) => state.addPendingFileId);

  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isCancelled, setIsCancelled] = React.useState(false);
  const [batchStats, setBatchStats] = React.useState<BatchStats>({
    totalFiles: 0,
    processedFiles: 0,
    failedFiles: 0,
    totalPartsFound: 0,
    startTime: null,
    elapsedSeconds: 0,
  });
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cancelRef = React.useRef(false);

  // Elapsed time timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && batchStats.startTime) {
      interval = setInterval(() => {
        setBatchStats((prev) => ({
          ...prev,
          elapsedSeconds: Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000),
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing, batchStats.startTime]);

  // Queue files without processing
  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      const id = crypto.randomUUID();
      const fileContext = createFileContext(file, id);
      
      // Log file being queued
      fileUploadLogger.fileQueued(fileContext);
      
      return {
        id,
        file,
        type: getFileType(file),
        status: "queued" as ProcessingStatus,
        progress: 0,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
    
    console.info(`📤 [FileUpload] ${newFiles.length} file(s) added to queue`, {
      files: newFiles.map(f => ({ name: f.file.name, type: f.type, size: `${(f.file.size / 1024).toFixed(1)}KB` })),
    });
  };

  // Start processing all queued files
  const startProcessing = async () => {
    const queuedFiles = files.filter((f) => f.status === "queued");
    if (queuedFiles.length === 0) {
      toast.error("No files to process", {
        description: "Add some files first, then click Start Processing.",
      });
      return;
    }

    // Start a new logging session
    const sessionId = fileUploadLogger.startSession();
    console.info(`📤 [FileUpload] Starting batch processing`, {
      sessionId,
      fileCount: queuedFiles.length,
      totalSize: `${(queuedFiles.reduce((s, f) => s + f.file.size, 0) / 1024).toFixed(1)}KB`,
      files: queuedFiles.map(f => f.file.name),
    });

    setIsProcessing(true);
    setIsCancelled(false);
    cancelRef.current = false;
    
    setBatchStats({
      totalFiles: queuedFiles.length,
      processedFiles: 0,
      failedFiles: 0,
      totalPartsFound: 0,
      startTime: Date.now(),
      elapsedSeconds: 0,
    });

    for (const uploadedFile of queuedFiles) {
      if (cancelRef.current) {
        console.info(`📤 [FileUpload] Processing cancelled by user`);
        // Mark remaining files as cancelled
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "queued" ? { ...f, status: "cancelled" as ProcessingStatus } : f
          )
        );
        break;
      }
      await processFile(uploadedFile);
    }

    setIsProcessing(false);
    
    // End the logging session
    fileUploadLogger.endSession();
    
    if (!cancelRef.current) {
      const stats = batchStats;
      console.info(`📤 [FileUpload] Batch complete`, {
        processed: stats.processedFiles,
        failed: stats.failedFiles,
        partsFound: stats.totalPartsFound,
        elapsed: `${stats.elapsedSeconds}s`,
      });
      toast.success("Processing complete!", {
        description: `Found ${stats.totalPartsFound} parts from ${stats.processedFiles} files.`,
      });
    }
  };

  // Stop processing
  const stopProcessing = () => {
    cancelRef.current = true;
    setIsCancelled(true);
    toast.info("Stopping...", {
      description: "Current file will complete, then processing will stop.",
    });
  };

  // Remove a file from the queue
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Clear all completed/error files
  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status === "queued"));
  };

  // Process a single file
  const processFile = async (uploadedFile: UploadedFile) => {
    const startTime = Date.now();
    const fileId = uploadedFile.id;
    
    console.info(`📤 [FileUpload] Processing file`, {
      fileId: fileId.substring(0, 8),
      name: uploadedFile.file.name,
      type: uploadedFile.type,
      size: `${(uploadedFile.file.size / 1024).toFixed(1)}KB`,
    });
    
    // Log processing start
    fileUploadLogger.processingStart(fileId);
    
    // Update to processing state
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadedFile.id
          ? { ...f, status: "processing" as ProcessingStatus, progress: 10 }
          : f
      )
    );

    try {
      let parts: ParsedPartWithStatus[] = [];
      let method = "unknown";
      let confidence = 0;
      const metadata = { edgeBanding: 0, grooving: 0, cncOps: 0 };

      switch (uploadedFile.type) {
        case "text":
        case "csv": {
          console.info(`📤 [FileUpload] Parsing text/CSV file`, { fileId: fileId.substring(0, 8) });
          const textStartTime = Date.now();
          
          const text = await uploadedFile.file.text();
          const lineCount = text.split('\n').length;
          
          console.debug(`📤 [FileUpload] Text file loaded`, {
            fileId: fileId.substring(0, 8),
            lines: lineCount,
            chars: text.length,
          });
          
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id ? { ...f, progress: 50 } : f
            )
          );
          
          const results = parseTextBatch(text, {
            sourceMethod: "file_upload",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
          });

          parts = results.parts
            .filter((r) => r.errors.length === 0)
            .map((r) => ({
              ...r.part,
              _status: "pending" as const,
              _originalText: r.originalText,
            }));

          confidence = parts.length > 0 
            ? parts.reduce((sum, p) => sum + (p.audit?.confidence || 0.8), 0) / parts.length 
            : 0;
          method = "Text Parser";
          
          // Log text parsing results
          fileUploadLogger.textParsing(fileId, {
            linesProcessed: lineCount,
            partsExtracted: parts.length,
            errors: results.parts.filter((r) => r.errors.length > 0).length,
            processingTimeMs: Date.now() - textStartTime,
          });
          break;
        }

        case "pdf":
        case "image": {
          let qrResult: QRDetectionResult | null = null;
          
          if (uploadedFile.type === "image") {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? { ...f, status: "detecting_qr" as ProcessingStatus, progress: 20 }
                  : f
              )
            );
            
            const qrStartTime = Date.now();
            try {
              console.debug(`📤 [FileUpload] Checking for QR template`, { fileId: fileId.substring(0, 8) });
              const imageBuffer = await uploadedFile.file.arrayBuffer();
              qrResult = await detectTemplateQR(imageBuffer);
              
              // Log QR detection result
              fileUploadLogger.qrDetection(fileId, {
                found: qrResult.found,
                templateId: qrResult.templateId,
                processingTimeMs: Date.now() - qrStartTime,
              });
              
              if (qrResult.found) {
                console.info(`📤 [FileUpload] QR template detected!`, {
                  fileId: fileId.substring(0, 8),
                  templateId: qrResult.templateId,
                  version: qrResult.templateVersion,
                });
              }
              
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadedFile.id ? { ...f, qrDetected: qrResult, progress: 30 } : f
                )
              );
            } catch (qrError) {
              // QR detection failed, continue without template
              console.debug(`📤 [FileUpload] QR detection failed (non-fatal)`, {
                fileId: fileId.substring(0, 8),
                error: qrError instanceof Error ? qrError.message : "Unknown error",
              });
            }
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, status: "processing" as ProcessingStatus, progress: 40 }
                : f
            )
          );

          try {
            const aiStartTime = Date.now();
            console.info(`📤 [FileUpload] Sending to AI for parsing`, {
              fileId: fileId.substring(0, 8),
              type: uploadedFile.type,
              hasTemplate: !!qrResult?.templateId,
            });
            
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress: 60 } : f
              )
            );

            const formData = new FormData();
            formData.append("file", uploadedFile.file);
            formData.append("fileType", uploadedFile.type);
            if (qrResult?.templateId) {
              formData.append("templateId", qrResult.templateId);
            }
            if (qrResult?.templateConfig) {
              formData.append("templateConfig", JSON.stringify(qrResult.templateConfig));
            }

            const response = await fetch("/api/v1/parse-file", {
              method: "POST",
              body: formData,
            });

            const data = await response.json();
            const aiEndTime = Date.now();

            if (!response.ok) {
              // Log AI error
              fileUploadLogger.aiProcessingError(fileId, {
                code: data.code || "API_ERROR",
                message: data.error || "Unknown API error",
                details: { status: response.status, statusText: response.statusText },
              });
              
              console.error(`📤 [FileUpload] AI API error`, {
                fileId: fileId.substring(0, 8),
                status: response.status,
                code: data.code,
                error: data.error,
              });
              
              if (data.code === "AI_NOT_CONFIGURED") {
                toast.error("AI processing is not available", {
                  description: "Please contact your system administrator to configure AI services.",
                });
              } else if (data.code === "PDF_NO_TEXT") {
                toast.error("Scanned PDF detected", {
                  description: "Take a screenshot of your cutlist and upload as an image instead.",
                  duration: 8000,
                });
              } else if (data.code === "PDF_EXTRACTION_FAILED") {
                toast.error("Could not read PDF", {
                  description: "Try uploading as an image (PNG/JPG) instead.",
                  duration: 6000,
                });
              } else if (data.code === "IMAGE_FORMAT_ERROR" || data.code === "IMAGE_ENCODE_ERROR") {
                toast.error("Image format issue", {
                  description: "Please convert your image to JPG or PNG format and try again.",
                  duration: 6000,
                });
              }
              throw new Error(data.error || "Failed to process file");
            }

            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress: 90 } : f
              )
            );

            if (!data.success) {
              fileUploadLogger.aiProcessingError(fileId, {
                code: "PARSE_FAILED",
                message: "AI parsing returned unsuccessful result",
                details: data,
              });
              throw new Error("AI parsing failed");
            }

            const aiParts = data.parts as ParsedPartResult[];
            parts = aiParts.map((r) => ({
              ...r.part,
              _status: "pending" as const,
              _originalText: r.originalText,
            }));

            confidence = data.totalConfidence;
            method = qrResult?.templateId 
              ? `AI + Template (${qrResult.templateId})`
              : "AI Vision";

            for (const p of aiParts) {
              if (p.extractedMetadata?.edgeBanding?.detected) metadata.edgeBanding++;
              if (p.extractedMetadata?.grooving?.detected) metadata.grooving++;
              if (p.extractedMetadata?.cncOperations?.detected) metadata.cncOps++;
            }

            // Log AI processing completion
            fileUploadLogger.aiProcessingComplete(fileId, {
              provider: "AI Vision",
              processingTimeMs: aiEndTime - aiStartTime,
              partsExtracted: parts.length,
              confidence: confidence,
            });
            
            console.info(`📤 [FileUpload] AI parsing successful`, {
              fileId: fileId.substring(0, 8),
              partsFound: parts.length,
              confidence: `${(confidence * 100).toFixed(0)}%`,
              aiTimeMs: aiEndTime - aiStartTime,
              totalTimeMs: data.processingTimeMs,
              edgeBanding: metadata.edgeBanding,
              grooving: metadata.grooving,
              cncOps: metadata.cncOps,
            });

            // Track uploaded file for linking to cutlist later
            if (data.uploadedFileId) {
              console.debug(`📤 [FileUpload] File saved to storage`, {
                fileId: fileId.substring(0, 8),
                uploadedFileId: data.uploadedFileId,
              });
              addPendingFileId(data.uploadedFileId);
              
              // Log storage
              fileUploadLogger.fileStorage(fileId, {
                success: true,
                uploadedFileId: data.uploadedFileId,
              });
            }
            
          } catch (aiError) {
            console.error(`📤 [FileUpload] AI processing failed`, {
              fileId: fileId.substring(0, 8),
              error: aiError instanceof Error ? aiError.message : "Unknown error",
            });
            throw aiError;
          }
          break;
        }

        case "excel": {
          console.warn(`📤 [FileUpload] Excel file not supported here`, {
            fileId: fileId.substring(0, 8),
            hint: "Use Excel Import tab instead",
          });
          
          fileUploadLogger.fileError(fileId, {
            stage: "validation",
            message: "Use the Excel Import tab for spreadsheets",
            code: "EXCEL_WRONG_TAB",
          });
          
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: "error" as ProcessingStatus,
                    error: "Use the Excel Import tab for spreadsheets",
                  }
                : f
            )
          );
          setBatchStats((prev) => ({ ...prev, failedFiles: prev.failedFiles + 1 }));
          return;
        }

        default: {
          fileUploadLogger.fileError(fileId, {
            stage: "validation",
            message: "Unsupported file type",
            code: "UNSUPPORTED_TYPE",
          });
          throw new Error("Unsupported file type");
        }
      }

      // Add to inbox
      if (parts.length > 0) {
        addToInbox(parts);
        console.info(`📤 [FileUpload] Parts added to inbox`, {
          fileId: fileId.substring(0, 8),
          count: parts.length,
        });
      }

      const processingTime = Date.now() - startTime;

      // Log file completion
      fileUploadLogger.fileComplete(fileId, {
        partsCount: parts.length,
        method,
        confidence,
        totalProcessingTimeMs: processingTime,
        metadata: metadata.edgeBanding || metadata.grooving || metadata.cncOps ? metadata : undefined,
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: "complete" as ProcessingStatus,
                progress: 100,
                result: {
                  partsCount: parts.length,
                  confidence,
                  method,
                  processingTime,
                  metadata: metadata.edgeBanding || metadata.grooving || metadata.cncOps ? metadata : undefined,
                },
              }
            : f
        )
      );

      // Update batch stats with animation effect
      setBatchStats((prev) => ({
        ...prev,
        processedFiles: prev.processedFiles + 1,
        totalPartsFound: prev.totalPartsFound + parts.length,
      }));
      
      // Log batch progress
      fileUploadLogger.batchStats({
        totalFiles: batchStats.totalFiles,
        processedFiles: batchStats.processedFiles + 1,
        failedFiles: batchStats.failedFiles,
        totalPartsFound: batchStats.totalPartsFound + parts.length,
        elapsedSeconds: batchStats.elapsedSeconds,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process file";
      
      // Log file error
      fileUploadLogger.fileError(fileId, {
        stage: "processing",
        message: errorMessage,
        code: "PROCESSING_ERROR",
        details: error,
      });
      
      console.error(`📤 [FileUpload] File processing failed`, {
        fileId: fileId.substring(0, 8),
        name: uploadedFile.file.name,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      });
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: "error" as ProcessingStatus,
                error: errorMessage,
              }
            : f
        )
      );
      setBatchStats((prev) => ({ ...prev, failedFiles: prev.failedFiles + 1 }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const queuedCount = files.filter((f) => f.status === "queued").length;
  const completedCount = files.filter((f) => f.status === "complete" || f.status === "error").length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Smart File Upload</CardTitle>
            <Badge variant="teal">AI-Powered</Badge>
          </div>
          
          {/* Processing Controls */}
          <div className="flex items-center gap-2">
            {queuedCount > 0 && !isProcessing && (
              <Button
                onClick={startProcessing}
                className="gap-2 bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
              >
                <Play className="h-4 w-4" />
                Start Processing ({queuedCount})
              </Button>
            )}
            
            {isProcessing && (
              <Button
                onClick={stopProcessing}
                variant="destructive"
                className="gap-2"
                disabled={isCancelled}
              >
                <Square className="h-4 w-4" />
                {isCancelled ? "Stopping..." : "Stop"}
              </Button>
            )}
            
            {completedCount > 0 && !isProcessing && (
              <Button
                onClick={clearCompleted}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Completed
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Add files to the queue, then click Start Processing. AI extracts parts with edge banding, grooving, and CNC data.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live Stats During Processing */}
        {isProcessing && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-[var(--muted)] rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--cai-teal)] tabular-nums">
                {batchStats.processedFiles}/{batchStats.totalFiles}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Files Processed</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold tabular-nums transition-all",
                batchStats.totalPartsFound > 0 && "text-green-600 animate-pulse"
              )}>
                <Package className="inline h-5 w-5 mr-1" />
                {batchStats.totalPartsFound}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Parts Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 tabular-nums">
                {batchStats.failedFiles}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums flex items-center justify-center gap-1">
                <Clock className="h-5 w-5" />
                {formatElapsedTime(batchStats.elapsedSeconds)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Elapsed</div>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <label
          className={cn(
            "block border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
              : "border-[var(--border)] hover:border-[var(--cai-teal)]",
            isProcessing && "opacity-50 pointer-events-none"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx,.xls"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            disabled={isProcessing}
          />
          <Upload
            className={cn(
              "h-12 w-12 mx-auto mb-4",
              isDragging
                ? "text-[var(--cai-teal)]"
                : "text-[var(--muted-foreground)]"
            )}
          />
          <p className="text-lg font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Files will be queued for processing
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-[var(--muted-foreground)]">
            <QrCode className="h-3.5 w-3.5" />
            <span>Scanned templates with QR codes get 99%+ accuracy</span>
          </div>
        </label>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((uploadedFile) => {
              const Icon = getFileIcon(uploadedFile.type);
              const isQueued = uploadedFile.status === "queued";
              const isActive = uploadedFile.status === "processing" || uploadedFile.status === "detecting_qr";

              return (
                <div
                  key={uploadedFile.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    isQueued && "border-dashed border-[var(--border)] bg-[var(--muted)]/30",
                    isActive && "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5 animate-pulse",
                    uploadedFile.status === "complete" && "border-green-200 bg-green-50",
                    uploadedFile.status === "error" && "border-red-200 bg-red-50",
                    uploadedFile.status === "cancelled" && "border-gray-200 bg-gray-50 opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      uploadedFile.status === "error"
                        ? "bg-red-100"
                        : uploadedFile.status === "complete"
                        ? "bg-green-100"
                        : isActive
                        ? "bg-[var(--cai-teal)]/20"
                        : "bg-[var(--muted)]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        uploadedFile.status === "error"
                          ? "text-red-600"
                          : uploadedFile.status === "complete"
                          ? "text-green-600"
                          : isActive
                          ? "text-[var(--cai-teal)]"
                          : "text-[var(--muted-foreground)]"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      {isQueued && (
                        <Badge variant="outline" className="text-xs">Queued</Badge>
                      )}
                      {uploadedFile.qrDetected?.templateId && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          <QrCode className="h-3 w-3 mr-1" />
                          Template
                        </Badge>
                      )}
                    </div>

                    {isActive && (
                      <div className="mt-1">
                        <Progress value={uploadedFile.progress} className="h-1" />
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          {uploadedFile.status === "detecting_qr" 
                            ? "Checking for template QR code..." 
                            : "Processing with AI..."}
                        </p>
                      </div>
                    )}

                    {uploadedFile.status === "complete" && uploadedFile.result && (
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-green-600">
                          Found {uploadedFile.result.partsCount} parts via{" "}
                          {uploadedFile.result.method}
                          {uploadedFile.result.confidence > 0 && (
                            <span className="ml-1 opacity-75">
                              ({Math.round(uploadedFile.result.confidence * 100)}% confidence)
                            </span>
                          )}
                        </p>
                        {uploadedFile.result.metadata && (
                          <div className="flex gap-2 text-xs text-[var(--muted-foreground)]">
                            {uploadedFile.result.metadata.edgeBanding > 0 && (
                              <span>📐 {uploadedFile.result.metadata.edgeBanding} with edging</span>
                            )}
                            {uploadedFile.result.metadata.grooving > 0 && (
                              <span>🔧 {uploadedFile.result.metadata.grooving} with grooves</span>
                            )}
                            {uploadedFile.result.metadata.cncOps > 0 && (
                              <span>⚙️ {uploadedFile.result.metadata.cncOps} with CNC</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {uploadedFile.status === "error" && (
                      <p className="text-xs text-red-600 mt-1">
                        {uploadedFile.error}
                      </p>
                    )}

                    {uploadedFile.status === "cancelled" && (
                      <p className="text-xs text-gray-500 mt-1">
                        Processing cancelled
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--cai-teal)]" />
                    )}
                    {uploadedFile.status === "complete" && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {uploadedFile.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    {(isQueued || uploadedFile.status === "complete" || uploadedFile.status === "error") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(uploadedFile.id)}
                        disabled={isProcessing && !isQueued}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Supported formats */}
        <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3">
          <p className="font-medium mb-1">Supported file types:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">PDF (AI extraction)</Badge>
            <Badge variant="outline">Images (AI Vision)</Badge>
            <Badge variant="outline">TXT (text parsing)</Badge>
            <Badge variant="outline">CSV (structured data)</Badge>
            <Badge variant="outline" className="border-[var(--cai-teal)] text-[var(--cai-teal)]">
              <QrCode className="h-3 w-3 mr-1" />
              QR Templates (99%+ accuracy)
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
