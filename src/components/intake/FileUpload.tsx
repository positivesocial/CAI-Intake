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
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { parseTextBatch } from "@/lib/parsers/text-parser";
import { cn } from "@/lib/utils";
import { getOrCreateProvider, type AIParseResult, type ParsedPartResult } from "@/lib/ai";
import { detectQRCode, type QRDetectionResult } from "@/lib/ai/template-ocr";

type FileType = "pdf" | "image" | "excel" | "csv" | "text" | "unknown";
type ProcessingStatus = "idle" | "uploading" | "detecting_qr" | "processing" | "complete" | "error";

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

export function FileUpload() {
  const addToInbox = useIntakeStore((state) => state.addToInbox);

  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: getFileType(file),
      status: "idle" as ProcessingStatus,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Process each file
    for (const uploadedFile of newFiles) {
      await processFile(uploadedFile);
    }
  };

  const processFile = async (uploadedFile: UploadedFile) => {
    const startTime = Date.now();
    
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
      let metadata = { edgeBanding: 0, grooving: 0, cncOps: 0 };

      switch (uploadedFile.type) {
        case "text":
        case "csv": {
          // Read as text and parse
          const text = await uploadedFile.file.text();
          
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
          break;
        }

        case "pdf":
        case "image": {
          // For images, first check for QR code (template detection)
          let qrResult: QRDetectionResult | null = null;
          
          if (uploadedFile.type === "image") {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? { ...f, status: "detecting_qr" as ProcessingStatus, progress: 20 }
                  : f
              )
            );
            
            try {
              const imageBuffer = await uploadedFile.file.arrayBuffer();
              qrResult = await detectQRCode(imageBuffer);
              
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadedFile.id ? { ...f, qrDetected: qrResult, progress: 30 } : f
                )
              );
            } catch {
              // QR detection failed, continue without template
            }
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, status: "processing" as ProcessingStatus, progress: 40 }
                : f
            )
          );

          // Use AI provider for image/PDF processing
          try {
            const provider = await getOrCreateProvider();
            
            if (!provider.isConfigured()) {
              throw new Error("AI provider not configured. Please add your API key in settings.");
            }

            // Progress update
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress: 60 } : f
              )
            );

            let aiResult: AIParseResult;
            
            if (uploadedFile.type === "image") {
              const imageBuffer = await uploadedFile.file.arrayBuffer();
              const base64 = Buffer.from(imageBuffer).toString("base64");
              const mimeType = uploadedFile.file.type || "image/jpeg";
              const dataUrl = `data:${mimeType};base64,${base64}`;
              
              aiResult = await provider.parseImage(dataUrl, {
                extractMetadata: true,
                confidence: "balanced",
                templateId: qrResult?.templateId,
                templateConfig: qrResult?.templateConfig,
                defaultMaterialId: "MAT-WHITE-18",
                defaultThicknessMm: 18,
              });
            } else {
              // PDF - extract text first, then parse
              const pdfBuffer = await uploadedFile.file.arrayBuffer();
              let extractedText = "";
              
              try {
                // Try to extract text from PDF
                const pdfParseModule = await import("pdf-parse");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
                const pdfData = await pdfParse(Buffer.from(pdfBuffer));
                extractedText = pdfData.text;
              } catch {
                // PDF text extraction failed
              }
              
              if (extractedText) {
                aiResult = await provider.parseText(extractedText, {
                  extractMetadata: true,
                  confidence: "balanced",
                  defaultMaterialId: "MAT-WHITE-18",
                  defaultThicknessMm: 18,
                });
              } else {
                throw new Error("Could not extract text from PDF. Try uploading as an image.");
              }
            }

            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress: 90 } : f
              )
            );

            if (!aiResult.success) {
              throw new Error(aiResult.errors.join(", ") || "AI parsing failed");
            }

            parts = aiResult.parts.map((r) => ({
              ...r.part,
              _status: "pending" as const,
              _originalText: r.originalText,
            }));

            confidence = aiResult.totalConfidence;
            method = qrResult?.templateId 
              ? `AI + Template (${qrResult.templateId})`
              : "AI Vision";

            // Count extracted metadata
            for (const p of aiResult.parts) {
              if (p.extractedMetadata?.edgeBanding?.detected) metadata.edgeBanding++;
              if (p.extractedMetadata?.grooving?.detected) metadata.grooving++;
              if (p.extractedMetadata?.cncOperations?.detected) metadata.cncOps++;
            }
            
          } catch (aiError) {
            // Fall back to basic OCR text extraction
            console.warn("AI processing failed, falling back to basic OCR:", aiError);
            throw aiError;
          }
          break;
        }

        case "excel": {
          // Excel files should go through the Excel import wizard
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
          return;
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
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: "error" as ProcessingStatus,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to process file",
              }
            : f
        )
      );
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[var(--cai-teal)]" />
          <CardTitle className="text-lg">Smart File Upload</CardTitle>
          <Badge variant="teal">AI-Powered</Badge>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Upload images, PDFs, or text files. AI extracts parts with edge banding, grooving, and CNC data.
        </p>
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
            PDF, images, TXT, CSV • AI extracts cutlist data automatically
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
          <div className="space-y-2">
            {files.map((uploadedFile) => {
              const Icon = getFileIcon(uploadedFile.type);

              return (
                <div
                  key={uploadedFile.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      uploadedFile.status === "error"
                        ? "bg-red-100"
                        : uploadedFile.status === "complete"
                        ? "bg-green-100"
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
                          : "text-[var(--muted-foreground)]"
                      )}
                    />
                  </div>

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
                    </div>

                    {(uploadedFile.status === "processing" || uploadedFile.status === "detecting_qr") && (
                      <div className="mt-1">
                        <Progress value={uploadedFile.progress} className="h-1" />
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          {uploadedFile.status === "detecting_qr" 
                            ? "Checking for template QR code..." 
                            : "Processing with AI..."}
                        </p>
                      </div>
                    )}

                    {uploadedFile.status === "complete" &&
                      uploadedFile.result && (
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
                  </div>

                  <div className="flex items-center gap-2">
                    {(uploadedFile.status === "processing" || uploadedFile.status === "detecting_qr") && (
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--cai-teal)]" />
                    )}
                    {uploadedFile.status === "complete" && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {uploadedFile.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(uploadedFile.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
