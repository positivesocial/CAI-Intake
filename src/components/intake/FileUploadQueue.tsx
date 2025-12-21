"use client";

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
  Clock,
  Scan,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { parseTextBatch } from "@/lib/parsers/text-parser";
import { cn } from "@/lib/utils";
import { getResilientProvider, type ResilientProgress } from "@/lib/ai/resilient-provider";
import type { AIParseResult } from "@/lib/ai/provider";
import { detectQRCode, type QRDetectionResult } from "@/lib/ai/template-ocr";
import { uploadFile, BUCKETS } from "@/lib/supabase/storage";
import { getLearningContext, type LearningContext } from "@/lib/learning";

// ============================================================
// TYPES
// ============================================================

type FileType = "pdf" | "image" | "excel" | "csv" | "text" | "unknown";

type ProcessingStage = 
  | "queued"
  | "uploading"
  | "detecting_qr"
  | "extracting"
  | "parsing"
  | "complete"
  | "error"
  | "paused";

interface FileProgress {
  stage: ProcessingStage;
  uploadPercent: number;
  processPercent: number;
  parsePercent: number;
  currentPage?: number;
  totalPages?: number;
  estimatedTimeMs?: number;
  startTime?: number;
}

interface UploadedFile {
  id: string;
  file: File;
  type: FileType;
  progress: FileProgress;
  qrDetected?: QRDetectionResult | null;
  storagePath?: string;
  learningApplied?: boolean;
  detectedClient?: string;
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

interface FileUploadQueueProps {
  maxConcurrent?: number;
  organizationId?: string;
}

// ============================================================
// HELPERS
// ============================================================

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

function getStageIcon(stage: ProcessingStage) {
  switch (stage) {
    case "queued":
      return Clock;
    case "uploading":
      return Upload;
    case "detecting_qr":
    case "extracting":
      return Scan;
    case "parsing":
      return Brain;
    case "complete":
      return CheckCircle;
    case "error":
      return AlertCircle;
    case "paused":
      return Pause;
    default:
      return Loader2;
  }
}

function getStageLabel(stage: ProcessingStage, progress: FileProgress): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "uploading":
      return `Uploading... ${progress.uploadPercent}%`;
    case "detecting_qr":
      return "Detecting template QR...";
    case "extracting":
      if (progress.totalPages && progress.totalPages > 1) {
        return `Extracting page ${progress.currentPage} of ${progress.totalPages}...`;
      }
      return "Extracting text...";
    case "parsing":
      return `AI parsing... ${progress.parsePercent}%`;
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    case "paused":
      return "Paused";
    default:
      return "Processing...";
  }
}

function calculateOverallProgress(progress: FileProgress): number {
  // Weight: upload 20%, extraction 40%, parsing 40%
  return Math.round(
    progress.uploadPercent * 0.2 +
    progress.processPercent * 0.4 +
    progress.parsePercent * 0.4
  );
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ============================================================
// COMPONENT
// ============================================================

export function FileUploadQueue({
  maxConcurrent = 2,
  organizationId,
}: FileUploadQueueProps) {
  const addToInbox = useIntakeStore((state) => state.addToInbox);

  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [learningContext, setLearningContext] = React.useState<LearningContext | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const processingRef = React.useRef<Set<string>>(new Set());

  // Load learning context
  React.useEffect(() => {
    getLearningContext(organizationId)
      .then(setLearningContext)
      .catch(console.error);
  }, [organizationId]);

  // Process queue
  React.useEffect(() => {
    const processNext = async () => {
      // Find files that need processing
      const queued = files.filter(f => f.progress.stage === "queued");
      const processing = files.filter(f => 
        !["queued", "complete", "error", "paused"].includes(f.progress.stage)
      );

      // Start new files if under limit
      while (processing.length < maxConcurrent && queued.length > 0) {
        const next = queued.shift();
        if (next && !processingRef.current.has(next.id)) {
          processingRef.current.add(next.id);
          processFile(next);
          processing.push(next);
        }
      }

      setIsProcessing(processing.length > 0);
    };

    processNext();
  }, [files, maxConcurrent]);

  // ============================================================
  // FILE PROCESSING
  // ============================================================

  const updateFileProgress = (
    fileId: string,
    updates: Partial<UploadedFile>
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );
  };

  const processFile = async (uploadedFile: UploadedFile) => {
    const startTime = Date.now();

    try {
      // Stage 1: Upload to storage
      updateFileProgress(uploadedFile.id, {
        progress: {
          ...uploadedFile.progress,
          stage: "uploading",
          uploadPercent: 0,
          startTime,
        },
      });

      // Simulate upload progress (actual upload is instant for small files)
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(r => setTimeout(r, 50));
        updateFileProgress(uploadedFile.id, {
          progress: {
            ...uploadedFile.progress,
            stage: "uploading",
            uploadPercent: i,
            startTime,
          },
        });
      }

      // Upload to Supabase Storage
      const uploadResult = await uploadFile(uploadedFile.file, {
        bucket: BUCKETS.CUTLIST_FILES,
        folder: organizationId || "anonymous",
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      updateFileProgress(uploadedFile.id, {
        storagePath: uploadResult.path,
        progress: {
          ...uploadedFile.progress,
          stage: "uploading",
          uploadPercent: 100,
          startTime,
        },
      });

      // Stage 2: Process based on file type
      let parts: ParsedPartWithStatus[] = [];
      let method = "unknown";
      let confidence = 0;
      const metadata = { edgeBanding: 0, grooving: 0, cncOps: 0 };
      let qrResult: QRDetectionResult | null = null;

      switch (uploadedFile.type) {
        case "text":
        case "csv": {
          updateFileProgress(uploadedFile.id, {
            progress: {
              ...uploadedFile.progress,
              stage: "extracting",
              uploadPercent: 100,
              processPercent: 50,
              startTime,
            },
          });

          const text = await uploadedFile.file.text();
          const results = parseTextBatch(text, {
            sourceMethod: "file_upload",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
            learningContext: learningContext || undefined,
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
          method = learningContext?.clientTemplate
            ? `Parser + ${learningContext.clientTemplate.clientName}`
            : "Text Parser";
          break;
        }

        case "pdf":
        case "image": {
          // QR Detection for images
          if (uploadedFile.type === "image") {
            updateFileProgress(uploadedFile.id, {
              progress: {
                ...uploadedFile.progress,
                stage: "detecting_qr",
                uploadPercent: 100,
                processPercent: 10,
                startTime,
              },
            });

            try {
              const imageBuffer = await uploadedFile.file.arrayBuffer();
              qrResult = await detectQRCode(imageBuffer);
              updateFileProgress(uploadedFile.id, {
                qrDetected: qrResult,
              });
            } catch {
              // QR detection failed, continue
            }
          }

          // AI Processing
          updateFileProgress(uploadedFile.id, {
            progress: {
              ...uploadedFile.progress,
              stage: "extracting",
              uploadPercent: 100,
              processPercent: 30,
              startTime,
            },
          });

          // Use resilient provider (Claude primary, GPT fallback)
          const resilientProvider = getResilientProvider();

          // Progress callback for visual feedback
          const onProgress = (progress: ResilientProgress) => {
            updateFileProgress(uploadedFile.id, {
              progress: {
                ...uploadedFile.progress,
                stage: progress.stage === "parsing" ? "parsing" : "extracting",
                uploadPercent: 100,
                processPercent: progress.stage === "extracting" ? progress.percent : 100,
                parsePercent: progress.stage === "parsing" ? progress.percent : 0,
                currentPage: progress.currentPage,
                totalPages: progress.totalPages,
                startTime,
              },
            });
          };

          try {
            // Type for extended result with metadata
            type ExtendedParseResult = AIParseResult & { 
              metadata?: { provider: string; usedFallback: boolean } 
            };
            let aiResult: ExtendedParseResult;

            if (uploadedFile.type === "image") {
              const imageBuffer = await uploadedFile.file.arrayBuffer();
              const base64 = Buffer.from(imageBuffer).toString("base64");
              const mimeType = uploadedFile.file.type || "image/jpeg";
              const dataUrl = `data:${mimeType};base64,${base64}`;

              aiResult = await resilientProvider.parseImageResilient(dataUrl, {
                extractMetadata: true,
                confidence: "balanced",
                templateId: qrResult?.templateId,
                templateConfig: qrResult?.templateConfig,
                defaultMaterialId: "MAT-WHITE-18",
                defaultThicknessMm: 18,
                learningContext: learningContext || undefined,
                onProgress,
              });
            } else {
              // PDF processing - extract text first
              const pdfBuffer = await uploadedFile.file.arrayBuffer();
              let extractedText = "";
              let totalPages = 1;

              try {
                const pdfParseModule = await import("pdf-parse");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
                const pdfData = await pdfParse(Buffer.from(pdfBuffer));
                extractedText = pdfData.text;
                totalPages = pdfData.numpages || 1;

                // Update with page info
                onProgress({
                  stage: "extracting",
                  percent: 50,
                  totalPages,
                  currentPage: 1,
                  provider: "claude",
                });

                // Simulate page processing
                for (let page = 1; page <= totalPages; page++) {
                  onProgress({
                    stage: "extracting",
                    percent: 30 + Math.round((page / totalPages) * 70),
                    totalPages,
                    currentPage: page,
                    provider: "claude",
                  });
                  await new Promise(r => setTimeout(r, 100));
                }
              } catch {
                throw new Error("Could not extract text from PDF.");
              }

              if (!extractedText) {
                throw new Error("No text extracted from PDF.");
              }

              aiResult = await resilientProvider.parseTextResilient(extractedText, {
                extractMetadata: true,
                confidence: "balanced",
                defaultMaterialId: "MAT-WHITE-18",
                defaultThicknessMm: 18,
                learningContext: learningContext || undefined,
                onProgress,
              });
            }

            if (!aiResult.success) {
              throw new Error(aiResult.errors.join(", ") || "AI parsing failed");
            }

            parts = aiResult.parts.map((r) => ({
              ...r.part,
              _status: "pending" as const,
              _originalText: r.originalText,
            }));

            confidence = aiResult.totalConfidence;
            const providerUsed = aiResult.metadata?.provider || "claude";
            const usedFallback = aiResult.metadata?.usedFallback;
            method = qrResult?.templateId
              ? `AI + Template (${qrResult.templateId})`
              : usedFallback
                ? `${providerUsed === "gpt" ? "GPT-4" : "Claude"} (fallback)`
                : `${providerUsed === "claude" ? "Claude" : "GPT-4"} Vision`;

            // Count metadata
            for (const p of aiResult.parts) {
              if (p.extractedMetadata?.edgeBanding?.detected) metadata.edgeBanding++;
              if (p.extractedMetadata?.grooving?.detected) metadata.grooving++;
              if (p.extractedMetadata?.cncOperations?.detected) metadata.cncOps++;
            }
          } catch (aiError) {
            throw aiError;
          }
          break;
        }

        case "excel": {
          throw new Error("Use the Excel Import tab for spreadsheets");
        }

        default: {
          throw new Error("Unsupported file type");
        }
      }

      // Add to inbox
      if (parts.length > 0) {
        addToInbox(parts);
      }

      const processingTime = Date.now() - startTime;

      updateFileProgress(uploadedFile.id, {
        progress: {
          stage: "complete",
          uploadPercent: 100,
          processPercent: 100,
          parsePercent: 100,
          startTime,
        },
        learningApplied: !!learningContext?.clientTemplate,
        detectedClient: learningContext?.clientTemplate?.clientName,
        result: {
          partsCount: parts.length,
          confidence,
          method,
          processingTime,
          metadata: metadata.edgeBanding || metadata.grooving || metadata.cncOps
            ? metadata
            : undefined,
        },
      });
    } catch (error) {
      updateFileProgress(uploadedFile.id, {
        progress: {
          ...uploadedFile.progress,
          stage: "error",
        },
        error: error instanceof Error ? error.message : "Processing failed",
      });
    } finally {
      processingRef.current.delete(uploadedFile.id);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleFiles = async (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: getFileType(file),
      progress: {
        stage: "queued" as ProcessingStage,
        uploadPercent: 0,
        processPercent: 0,
        parsePercent: 0,
      },
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    processingRef.current.delete(id);
  };

  const retryFile = (file: UploadedFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === file.id
          ? {
              ...f,
              progress: {
                stage: "queued" as ProcessingStage,
                uploadPercent: 0,
                processPercent: 0,
                parsePercent: 0,
              },
              error: undefined,
            }
          : f
      )
    );
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.progress.stage !== "complete"));
  };

  const clearAll = () => {
    setFiles([]);
    processingRef.current.clear();
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

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const queuedCount = files.filter(f => f.progress.stage === "queued").length;
  const processingCount = files.filter(f => 
    !["queued", "complete", "error"].includes(f.progress.stage)
  ).length;
  const completedCount = files.filter(f => f.progress.stage === "complete").length;
  const errorCount = files.filter(f => f.progress.stage === "error").length;
  const totalParts = files.reduce((sum, f) => sum + (f.result?.partsCount || 0), 0);

  const visibleFiles = showCompleted
    ? files
    : files.filter(f => f.progress.stage !== "complete");

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Smart File Upload</CardTitle>
            <Badge variant="teal">AI-Powered</Badge>
          </div>
          
          {/* Provider indicator - Claude primary, GPT fallback */}
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Claude</span>
            </div>
            <span className="text-[var(--border)]">→</span>
            <div className="flex items-center gap-1 opacity-60">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>GPT</span>
            </div>
            <Badge variant="outline" className="ml-1">Auto-fallback</Badge>
          </div>
        </div>
        
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Upload images, PDFs, or text files. AI extracts parts with edge banding, grooving, and CNC data.
        </p>

        {/* Queue status */}
        {files.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs">
            {queuedCount > 0 && (
              <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                <Clock className="h-3 w-3" /> {queuedCount} queued
              </span>
            )}
            {processingCount > 0 && (
              <span className="flex items-center gap-1 text-[var(--cai-teal)]">
                <Loader2 className="h-3 w-3 animate-spin" /> {processingCount} processing
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" /> {completedCount} done ({totalParts} parts)
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" /> {errorCount} failed
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
              : "border-[var(--border)] hover:border-[var(--cai-teal)]"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
            PDF, images, TXT, CSV • Multiple files supported • AI extracts cutlist data
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-[var(--muted-foreground)]">
            <QrCode className="h-3.5 w-3.5" />
            <span>Scanned templates with QR codes get 99%+ accuracy</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* File list */}
        {files.length > 0 && (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide completed
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show completed ({completedCount})
                  </>
                )}
              </Button>
              
              <div className="flex items-center gap-2">
                {completedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={clearCompleted}
                  >
                    Clear completed
                  </Button>
                )}
                {files.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-red-600 hover:text-red-700"
                    onClick={clearAll}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            {/* File items */}
            <div className="space-y-2">
              {visibleFiles.map((uploadedFile) => {
                const Icon = getFileIcon(uploadedFile.type);
                const StageIcon = getStageIcon(uploadedFile.progress.stage);
                const overallProgress = calculateOverallProgress(uploadedFile.progress);

                return (
                  <div
                    key={uploadedFile.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border bg-[var(--card)]",
                      uploadedFile.progress.stage === "error"
                        ? "border-red-200 bg-red-50/50"
                        : uploadedFile.progress.stage === "complete"
                        ? "border-green-200 bg-green-50/50"
                        : "border-[var(--border)]"
                    )}
                  >
                    {/* File icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        uploadedFile.progress.stage === "error"
                          ? "bg-red-100"
                          : uploadedFile.progress.stage === "complete"
                          ? "bg-green-100"
                          : "bg-[var(--muted)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          uploadedFile.progress.stage === "error"
                            ? "text-red-600"
                            : uploadedFile.progress.stage === "complete"
                            ? "text-green-600"
                            : "text-[var(--muted-foreground)]"
                        )}
                      />
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        {uploadedFile.qrDetected?.templateId && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <QrCode className="h-3 w-3 mr-1" />
                            Template
                          </Badge>
                        )}
                        {uploadedFile.learningApplied && uploadedFile.detectedClient && (
                          <Badge variant="outline" className="text-xs shrink-0 border-purple-300 text-purple-700">
                            <Brain className="h-3 w-3 mr-1" />
                            {uploadedFile.detectedClient}
                          </Badge>
                        )}
                      </div>

                      {/* Progress bar and status */}
                      {!["complete", "error"].includes(uploadedFile.progress.stage) && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Progress
                              value={overallProgress}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-[var(--muted-foreground)] shrink-0 w-8">
                              {overallProgress}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                            <StageIcon className={cn(
                              "h-3 w-3",
                              uploadedFile.progress.stage !== "queued" && "animate-pulse"
                            )} />
                            <span>{getStageLabel(uploadedFile.progress.stage, uploadedFile.progress)}</span>
                            {uploadedFile.progress.startTime && (
                              <span className="ml-auto">
                                {formatTime(Date.now() - uploadedFile.progress.startTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Success result */}
                      {uploadedFile.progress.stage === "complete" && uploadedFile.result && (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-green-600">
                            Found {uploadedFile.result.partsCount} parts via{" "}
                            {uploadedFile.result.method}
                            {uploadedFile.result.confidence > 0 && (
                              <span className="ml-1 opacity-75">
                                ({Math.round(uploadedFile.result.confidence * 100)}% confidence)
                              </span>
                            )}
                            {uploadedFile.result.processingTime && (
                              <span className="ml-1 opacity-75">
                                • {formatTime(uploadedFile.result.processingTime)}
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

                      {/* Error message */}
                      {uploadedFile.progress.stage === "error" && (
                        <p className="text-xs text-red-600 mt-1">
                          {uploadedFile.error}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {uploadedFile.progress.stage === "error" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => retryFile(uploadedFile)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {!["uploading", "extracting", "parsing", "detecting_qr"].includes(
                        uploadedFile.progress.stage
                      ) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeFile(uploadedFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {["uploading", "extracting", "parsing", "detecting_qr"].includes(
                        uploadedFile.progress.stage
                      ) && (
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--cai-teal)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Supported formats */}
        <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3">
          <p className="font-medium mb-1">Supported file types:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">PDF (Claude + GPT fallback)</Badge>
            <Badge variant="outline">Images (AI Vision)</Badge>
            <Badge variant="outline">TXT (text parsing)</Badge>
            <Badge variant="outline">CSV (structured data)</Badge>
            <Badge variant="outline" className="border-[var(--cai-teal)] text-[var(--cai-teal)]">
              <QrCode className="h-3 w-3 mr-1" />
              QR Templates (99%+ accuracy)
            </Badge>
            {learningContext?.enabled && (
              <Badge variant="outline" className="border-purple-300 text-purple-700">
                <Brain className="h-3 w-3 mr-1" />
                Learning enabled
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

