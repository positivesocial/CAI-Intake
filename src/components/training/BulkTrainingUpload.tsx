"use client";

/**
 * CAI Intake - Bulk Training Upload Component
 * 
 * Uses the SAME /api/v1/parse-file endpoint as regular users
 * to identify real parsing issues and create training examples.
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Plus,
  Save,
  ImageIcon,
  Edit3,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

interface ProcessResult {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl?: string; // Object URL for preview
  success: boolean;
  parsedParts: CutPart[];
  partsCount: number;
  confidence: number;
  errors: string[];
  processingTimeMs?: number;
  saved?: boolean;
}

interface UploadState {
  status: "idle" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  currentFileIndex: number;
  totalFiles: number;
  results: ProcessResult[];
  error?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function BulkTrainingUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    currentFileIndex: 0,
    totalFiles: 0,
    results: [],
  });
  const [selectedResult, setSelectedResult] = useState<ProcessResult | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [editedParts, setEditedParts] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [isSaving, setIsSaving] = useState(false);

  // File dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploadState({
      status: "uploading",
      progress: 0,
      currentFileIndex: 0,
      totalFiles: acceptedFiles.length,
      results: [],
    });

    const results: ProcessResult[] = [];

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      
      setUploadState(prev => ({
        ...prev,
        status: "processing",
        currentFileIndex: i + 1,
        progress: Math.round(((i + 0.5) / acceptedFiles.length) * 100),
      }));

      try {
        // Create object URL for preview
        const fileUrl = URL.createObjectURL(file);

        // Use the SAME endpoint as regular users
        const formData = new FormData();
        formData.append("file", file);
        formData.append("returnParsedParts", "true");
        formData.append("extractMetadata", "true");

        const startTime = Date.now();
        const response = await fetch("/api/v1/parse-file", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        const processingTimeMs = Date.now() - startTime;

        if (response.ok && data.success) {
          results.push({
            id: `result-${Date.now()}-${i}`,
            fileName: file.name,
            fileType: file.type,
            fileUrl,
            success: true,
            parsedParts: data.parts || [],
            partsCount: data.parts?.length || 0,
            confidence: data.totalConfidence || 0,
            errors: data.errors || [],
            processingTimeMs,
          });
        } else {
          results.push({
            id: `result-${Date.now()}-${i}`,
            fileName: file.name,
            fileType: file.type,
            fileUrl,
            success: false,
            parsedParts: data.parts || [],
            partsCount: data.parts?.length || 0,
            confidence: 0,
            errors: data.errors || [data.error || "Parsing failed"],
            processingTimeMs,
          });
        }
      } catch (error) {
        results.push({
          id: `result-${Date.now()}-${i}`,
          fileName: file.name,
          fileType: file.type,
          success: false,
          parsedParts: [],
          partsCount: 0,
          confidence: 0,
          errors: [error instanceof Error ? error.message : "Processing failed"],
        });
      }

      setUploadState(prev => ({
        ...prev,
        progress: Math.round(((i + 1) / acceptedFiles.length) * 100),
        results: [...results],
      }));
    }

    setUploadState({
      status: "complete",
      progress: 100,
      currentFileIndex: acceptedFiles.length,
      totalFiles: acceptedFiles.length,
      results,
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 10,
    disabled: uploadState.status === "uploading" || uploadState.status === "processing",
  });

  // Open verify dialog
  const handleReview = (result: ProcessResult) => {
    setSelectedResult(result);
    // Safely map parts - handle multiple formats from different AI responses
    const mappedParts = result.parsedParts.map(p => {
      // Handle different part formats from the API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const part = p as any;
      
      // Extract edge banding - can be in ops.edgeBanding, ops.edging, or top-level edgeBanding
      const edgeBanding = part.ops?.edgeBanding || part.edgeBanding || part.ops?.edging;
      let edgeCode = "";
      if (edgeBanding) {
        if (typeof edgeBanding === "string") {
          edgeCode = edgeBanding;
        } else if (edgeBanding.detected || edgeBanding.L1 || edgeBanding.L2 || edgeBanding.W1 || edgeBanding.W2) {
          edgeCode = formatEdgeCode(edgeBanding);
        } else if (edgeBanding.summary?.code) {
          edgeCode = edgeBanding.summary.code;
        }
      }
      
      // Extract grooving - can be in ops.grooves, grooving, or top-level
      const grooving = part.ops?.grooves || part.grooving;
      let grooveCode = "";
      if (grooving) {
        if (typeof grooving === "string") {
          grooveCode = grooving;
        } else if (Array.isArray(grooving) && grooving.length > 0) {
          grooveCode = "GL"; // Has groove operations
        } else if (grooving.detected) {
          grooveCode = (grooving.GL ? "GL" : "") + (grooving.GW ? "GW" : "");
        }
      }
      
      return {
        label: part.label || part.part_id || "Part",
        length: part.size?.L ?? part.length ?? part.length_mm ?? 0,
        width: part.size?.W ?? part.width ?? part.width_mm ?? 0,
        quantity: part.qty ?? part.quantity ?? 1,
        thickness: part.thickness_mm ?? part.thickness ?? 18,
        material: part.material_id ?? part.material,
        edge: edgeCode || undefined,
        groove: grooveCode || undefined,
        notes: part.notes,
      };
    });
    setEditedParts(JSON.stringify(mappedParts, null, 2));
    setShowVerifyDialog(true);
  };

  // Save result as training example
  const saveAsTrainingExample = async () => {
    if (!selectedResult) return;

    // Validate JSON first
    let parsedCorrectParts;
    try {
      parsedCorrectParts = JSON.parse(editedParts);
      if (!Array.isArray(parsedCorrectParts) || parsedCorrectParts.length === 0) {
        toast.error("Parts must be a non-empty array");
        return;
      }
    } catch {
      toast.error("Invalid JSON format");
      return;
    }

    setIsSaving(true);
    try {
      // We need to send both the source (file content) and the verified correct parts
      // The API will store the text representation for few-shot learning
      const response = await fetch("/api/v1/training/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: getSourceType(selectedResult.fileType),
          sourceText: `[Parsed from file: ${selectedResult.fileName}]\nParts count: ${parsedCorrectParts.length}`,
          sourceFileName: selectedResult.fileName,
          correctParts: parsedCorrectParts,
          difficulty,
          features: {
            hasHeaders: true,
            columnCount: null,
            rowCount: parsedCorrectParts.length,
            hasEdgeNotation: parsedCorrectParts.some((p: {edge?: string}) => p.edge),
            hasGrooveNotation: parsedCorrectParts.some((p: {groove?: string}) => p.groove),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      // Mark as saved
      setUploadState(prev => ({
        ...prev,
        results: prev.results.map(r =>
          r.id === selectedResult.id ? { ...r, saved: true } : r
        ),
      }));

      toast.success("Training example saved successfully!");
      setShowVerifyDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const successCount = uploadState.results.filter(r => r.success).length;
  const failedCount = uploadState.results.filter(r => !r.success).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Training Upload (Uses Real OCR Pipeline)
        </CardTitle>
        <CardDescription>
          Upload files using the <strong>exact same OCR system</strong> that regular users use.
          Review the results, verify/correct them, and save as training examples.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-2">
          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>How it works:</strong> Files are processed through the same OCR pipeline users use.
            You&apos;ll see exactly what they see - any issues here affect real users too.
            Verify the output and save correct examples to improve future parsing.
          </div>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
              : "border-[var(--border)] hover:border-[var(--cai-teal)]/50",
            (uploadState.status === "uploading" || uploadState.status === "processing") &&
              "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          
          {uploadState.status === "uploading" || uploadState.status === "processing" ? (
            <div className="space-y-3">
              <Loader2 className="h-10 w-10 mx-auto text-[var(--cai-teal)] animate-spin" />
              <p className="font-medium">
                Processing file {uploadState.currentFileIndex} of {uploadState.totalFiles}...
              </p>
              <Progress value={uploadState.progress} className="w-64 mx-auto" />
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3" />
              <p className="font-medium">
                {isDragActive ? "Drop files here..." : "Drag & drop files here"}
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                or click to browse (PDF, Images, Excel, CSV)
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Up to 10 files • Same OCR as regular intake
              </p>
            </>
          )}
        </div>

        {/* Error message */}
        {uploadState.status === "error" && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Upload failed</span>
            </div>
            <p className="text-sm text-red-600/80 mt-1">{uploadState.error}</p>
          </div>
        )}

        {/* Results summary */}
        {uploadState.status === "complete" && uploadState.results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {successCount} successful
              </Badge>
              {failedCount > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {failedCount} failed
                </Badge>
              )}
            </div>

            {/* Results list */}
            <div className="space-y-2">
              {uploadState.results.map((result) => (
                <div
                  key={result.id}
                  className={cn(
                    "p-3 border rounded-lg flex items-center gap-3",
                    result.saved
                      ? "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10"
                      : result.success
                        ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                        : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                  )}
                >
                  {/* File preview thumbnail */}
                  <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {result.fileUrl && result.fileType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.fileUrl}
                        alt={result.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : result.fileType === "application/pdf" ? (
                      <FileText className="h-6 w-6 text-red-500" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.fileName}</span>
                      {result.saved && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                          Saved
                        </Badge>
                      )}
                    </div>
                    {result.success ? (
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {result.partsCount} parts • {Math.round(result.confidence * 100)}% confidence
                        {result.processingTimeMs && ` • ${(result.processingTimeMs / 1000).toFixed(1)}s`}
                      </div>
                    ) : (
                      <div className="text-sm text-red-600 truncate">
                        {result.errors[0] || "Parsing failed"}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReview(result)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                    {result.success && !result.saved && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleReview(result)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Verify & Save
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Reset button */}
            <Button
              variant="outline"
              onClick={() => {
                // Revoke object URLs to free memory
                uploadState.results.forEach(r => {
                  if (r.fileUrl) URL.revokeObjectURL(r.fileUrl);
                });
                setUploadState({ status: "idle", progress: 0, currentFileIndex: 0, totalFiles: 0, results: [] });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload More Files
            </Button>
          </div>
        )}

        {/* Verification Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Review & Verify: {selectedResult?.fileName}
              </DialogTitle>
            </DialogHeader>
            
            {selectedResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Source file preview */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Source File
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border overflow-hidden max-h-[400px]">
                      {selectedResult.fileUrl && selectedResult.fileType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedResult.fileUrl}
                          alt={selectedResult.fileName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="p-8 text-center text-[var(--muted-foreground)]">
                          <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                          <p>PDF/Excel preview not available</p>
                          <p className="text-xs mt-1">Open the original file to compare</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {selectedResult.partsCount} parts extracted • 
                      {Math.round(selectedResult.confidence * 100)}% confidence •
                      {selectedResult.processingTimeMs && ` ${(selectedResult.processingTimeMs / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  
                  {/* Editable parts JSON */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Parsed Parts (Edit to correct)
                    </h4>
                    <Textarea
                      value={editedParts}
                      onChange={(e) => setEditedParts(e.target.value)}
                      className="font-mono text-xs h-[380px] resize-none"
                      placeholder="Edit the JSON to correct any parsing errors..."
                    />
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Correct any errors - this becomes the ground truth for training.
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy - Clean, structured</SelectItem>
                        <SelectItem value="medium">Medium - Some ambiguity</SelectItem>
                        <SelectItem value="hard">Hard - Messy, handwritten</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex gap-2 pt-2">
                      {selectedResult.success ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Parsed Successfully
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          Parsing Issues
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Errors if any */}
                {selectedResult.errors.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="font-medium text-amber-800 dark:text-amber-200 text-sm mb-1">
                      Parsing Issues:
                    </div>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      {selectedResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowVerifyDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveAsTrainingExample}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save as Training Example
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getSourceType(mimeType: string): "pdf" | "image" | "excel" | "csv" | "text" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "excel";
  if (mimeType === "text/csv") return "csv";
  return "text";
}

function formatEdgeCode(edgeBanding: { L1?: boolean; L2?: boolean; W1?: boolean; W2?: boolean }): string {
  const parts: string[] = [];
  const l1 = edgeBanding.L1 ?? false;
  const l2 = edgeBanding.L2 ?? false;
  const w1 = edgeBanding.W1 ?? false;
  const w2 = edgeBanding.W2 ?? false;
  
  if (l1 && l2) parts.push("2L");
  else if (l1 || l2) parts.push("1L");
  
  if (w1 && w2) parts.push("2W");
  else if (w1 || w2) parts.push("1W");
  
  return parts.join("") || "";
}
