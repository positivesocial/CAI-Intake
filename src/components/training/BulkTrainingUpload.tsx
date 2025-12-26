"use client";

/**
 * CAI Intake - Bulk Training Upload Component
 * 
 * Upload multiple PDFs/files, parse them, and verify the results
 * to create training examples.
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
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
  Plus,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

interface ProcessResult {
  fileName: string;
  success: boolean;
  extractedText?: string;
  parsedParts?: CutPart[];
  partsCount?: number;
  confidence?: number;
  error?: string;
  textFeatures?: {
    hasHeaders: boolean;
    estimatedColumns: number;
    estimatedRows: number;
    hasEdgeNotation: boolean;
    hasGrooveNotation: boolean;
  };
}

interface UploadState {
  status: "idle" | "uploading" | "processing" | "complete" | "error";
  progress: number;
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
    results: [],
  });
  const [selectedResult, setSelectedResult] = useState<ProcessResult | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);

  // File dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploadState({ status: "uploading", progress: 0, results: [] });

    try {
      const formData = new FormData();
      acceptedFiles.forEach(file => {
        formData.append("files", file);
      });
      formData.append("provider", "anthropic");
      formData.append("extractMetadata", "true");

      setUploadState(prev => ({ ...prev, status: "processing", progress: 30 }));

      const response = await fetch("/api/v1/training/bulk-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();

      setUploadState({
        status: "complete",
        progress: 100,
        results: data.results,
      });
    } catch (error) {
      setUploadState({
        status: "error",
        progress: 0,
        results: [],
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxFiles: 10,
    disabled: uploadState.status === "uploading" || uploadState.status === "processing",
  });

  // Save result as training example
  const saveAsTrainingExample = async (result: ProcessResult) => {
    if (!result.extractedText || !result.parsedParts) return;

    try {
      const response = await fetch("/api/v1/training/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "pdf",
          sourceText: result.extractedText,
          sourceFileName: result.fileName,
          correctParts: result.parsedParts,
          difficulty: "medium",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      // Update result to mark as saved
      setUploadState(prev => ({
        ...prev,
        results: prev.results.map(r =>
          r.fileName === result.fileName ? { ...r, saved: true } as ProcessResult : r
        ),
      }));

      alert("Training example saved!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const successCount = uploadState.results.filter(r => r.success).length;
  const failedCount = uploadState.results.filter(r => !r.success).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Training Upload
        </CardTitle>
        <CardDescription>
          Upload PDFs or images to parse and verify, then save as training examples
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                {uploadState.status === "uploading" ? "Uploading files..." : "Processing files..."}
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
                or click to browse (PDF, PNG, JPG, TXT, CSV)
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Maximum 10 files per upload
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
              {uploadState.results.map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 border rounded-lg flex items-center gap-3",
                    result.success
                      ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                      : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                  )}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.fileName}</div>
                    {result.success ? (
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {result.partsCount} parts extracted • {Math.round((result.confidence || 0) * 100)}% confidence
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">{result.error}</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {result.success && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedResult(result);
                            setShowVerifyDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => saveAsTrainingExample(result)}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Reset button */}
            <Button
              variant="outline"
              onClick={() => setUploadState({ status: "idle", progress: 0, results: [] })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload More Files
            </Button>
          </div>
        )}

        {/* Verification Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Parsed Results</DialogTitle>
            </DialogHeader>
            
            {selectedResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Source text */}
                  <div>
                    <h4 className="font-medium mb-2">Source Text</h4>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs font-mono max-h-80 overflow-auto">
                      <pre className="whitespace-pre-wrap">{selectedResult.extractedText}</pre>
                    </div>
                  </div>
                  
                  {/* Parsed parts */}
                  <div>
                    <h4 className="font-medium mb-2">Parsed Parts ({selectedResult.partsCount})</h4>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs font-mono max-h-80 overflow-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedResult.parsedParts?.slice(0, 10), null, 2)}
                        {(selectedResult.parsedParts?.length || 0) > 10 && 
                          `\n\n... and ${(selectedResult.parsedParts?.length || 0) - 10} more parts`
                        }
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Features detected */}
                {selectedResult.textFeatures && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedResult.textFeatures.hasHeaders && (
                      <Badge variant="outline">Has Headers</Badge>
                    )}
                    {selectedResult.textFeatures.hasEdgeNotation && (
                      <Badge variant="outline">Edge Notation</Badge>
                    )}
                    {selectedResult.textFeatures.hasGrooveNotation && (
                      <Badge variant="outline">Groove Notation</Badge>
                    )}
                    <Badge variant="secondary">
                      ~{selectedResult.textFeatures.estimatedColumns} columns
                    </Badge>
                    <Badge variant="secondary">
                      ~{selectedResult.textFeatures.estimatedRows} rows
                    </Badge>
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
                onClick={() => {
                  if (selectedResult) {
                    saveAsTrainingExample(selectedResult);
                    setShowVerifyDialog(false);
                  }
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Training Example
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

