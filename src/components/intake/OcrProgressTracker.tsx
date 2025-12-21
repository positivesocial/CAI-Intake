"use client";

/**
 * CAI Intake - OCR Progress Tracker
 * 
 * Enhanced visual progress tracker for file processing with:
 * - Real-time item count updates with animation
 * - Elapsed time display
 * - Detailed stage descriptions
 * - Cancel functionality
 */

import * as React from "react";
import {
  FileText,
  Check,
  X,
  AlertCircle,
  Clock,
  Loader2,
  Ban,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  Package,
  Table,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OCRProgressClient, OCRFileProgress, OCRStage } from "@/lib/progress/types";

// ============================================================
// TYPES
// ============================================================

export interface OcrProgressTrackerProps {
  /** Session ID to track */
  sessionId: string;
  /** Called when processing is complete */
  onComplete?: (result: OCRProgressClient) => void;
  /** Called when processing is cancelled */
  onCancel?: () => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Polling interval in ms (default: 1000) */
  pollIntervalMs?: number;
  /** Whether to show file details */
  showFileDetails?: boolean;
  /** Compact mode */
  compact?: boolean;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getStatusIcon(status: OCRFileProgress["status"]) {
  switch (status) {
    case "complete":
      return <Check className="h-4 w-4 text-green-500" />;
    case "error":
      return <X className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <Ban className="h-4 w-4 text-gray-500" />;
    case "processing":
      return <Loader2 className="h-4 w-4 text-[var(--cai-teal)] animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusColor(status: OCRFileProgress["status"]) {
  switch (status) {
    case "complete":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "cancelled":
      return "bg-gray-500";
    case "processing":
      return "bg-[var(--cai-teal)]";
    default:
      return "bg-gray-300";
  }
}

function getStageIcon(stage: OCRStage) {
  switch (stage) {
    case "uploading":
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case "detecting":
      return <Eye className="h-3 w-3" />;
    case "ocr":
      return <Sparkles className="h-3 w-3" />;
    case "parsing":
      return <Table className="h-3 w-3" />;
    case "validating":
      return <Check className="h-3 w-3" />;
    default:
      return null;
  }
}

function getStageName(stage: OCRStage): string {
  switch (stage) {
    case "queued":
      return "Waiting in queue...";
    case "uploading":
      return "Reading file...";
    case "detecting":
      return "Detecting document type...";
    case "ocr":
      return "Extracting text with AI...";
    case "parsing":
      return "Parsing cutlist data...";
    case "validating":
      return "Validating parts...";
    case "done":
      return "Complete";
    default:
      return "Processing...";
  }
}

function formatETA(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatElapsedTime(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================
// ANIMATED COUNTER COMPONENT
// ============================================================

function AnimatedCounter({ value, label, icon: Icon, color = "text-[var(--cai-teal)]" }: {
  value: number;
  label: string;
  icon: React.ElementType;
  color?: string;
}) {
  const [displayValue, setDisplayValue] = React.useState(value);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const prevValue = React.useRef(value);

  React.useEffect(() => {
    if (value !== prevValue.current) {
      setIsAnimating(true);
      const timeout = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      prevValue.current = value;
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <div className="text-center">
      <div className={cn(
        "text-2xl font-bold tabular-nums transition-all duration-300",
        color,
        isAnimating && "scale-125"
      )}>
        <Icon className="inline h-5 w-5 mr-1" />
        {displayValue}
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

// ============================================================
// COMPONENT
// ============================================================

export function OcrProgressTracker({
  sessionId,
  onComplete,
  onCancel,
  onError,
  pollIntervalMs = 1000,
  showFileDetails = true,
  compact = false,
}: OcrProgressTrackerProps) {
  const [progress, setProgress] = React.useState<OCRProgressClient | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(!compact);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [elapsedTime, setElapsedTime] = React.useState("0s");
  
  // Elapsed time update
  React.useEffect(() => {
    if (progress?.overall?.startedAt && progress.isProcessing) {
      const interval = setInterval(() => {
        setElapsedTime(formatElapsedTime(progress.overall.startedAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [progress?.overall?.startedAt, progress?.isProcessing]);
  
  // Polling
  React.useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    async function poll() {
      if (!mounted) return;
      
      try {
        const response = await fetch(`/api/v1/parse/progress?sessionId=${sessionId}`);
        const data = await response.json();
        
        if (!mounted) return;
        
        if (!data.success) {
          setError(data.error || "Failed to get progress");
          onError?.(data.error);
          return;
        }
        
        setProgress(data.data);
        
        // Check if complete
        if (!data.data.isProcessing) {
          if (data.data.status === "complete") {
            onComplete?.(data.data);
          } else if (data.data.status === "cancelled") {
            onCancel?.();
          } else if (data.data.status === "error") {
            onError?.(data.data.message || "Processing failed");
          }
          return; // Stop polling
        }
        
        // Continue polling
        timeoutId = setTimeout(poll, pollIntervalMs);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        onError?.(message);
      }
    }
    
    poll();
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [sessionId, pollIntervalMs, onComplete, onCancel, onError]);
  
  // Cancel handler
  const handleCancel = async () => {
    setIsCancelling(true);
    
    try {
      const response = await fetch(`/api/v1/parse/progress?sessionId=${sessionId}`, {
        method: "POST",
      });
      const data = await response.json();
      
      if (!data.success) {
        console.warn("Cancel request failed:", data.error);
      }
    } catch (err) {
      console.warn("Failed to cancel:", err);
    }
  };
  
  // Error state
  if (error) {
    return (
      <Card className={cn("border-red-200", compact && "p-4")}>
        <CardContent className={cn("flex items-center gap-3", compact ? "p-0" : "pt-6")}>
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-sm text-red-600">{error}</span>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (!progress) {
    return (
      <Card className={compact ? "p-4" : undefined}>
        <CardContent className={cn("flex items-center justify-center gap-2", compact ? "p-0" : "pt-6")}>
          <Loader2 className="h-5 w-5 animate-spin text-[var(--cai-teal)]" />
          <span className="text-sm text-[var(--muted-foreground)]">Connecting...</span>
        </CardContent>
      </Card>
    );
  }
  
  const { overall, files, status, message } = progress;
  
  // Compact view
  if (compact) {
    return (
      <div className="flex items-center gap-4 p-4 bg-[var(--card)] rounded-lg border">
        {/* Progress bar */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {message || (status === "complete" ? "Complete" : "Processing...")}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--cai-teal)]">
                <Package className="inline h-4 w-4 mr-1" />
                {overall.totalItemsFound} parts
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {overall.overallProgress}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 ease-out",
                getStatusColor(status as OCRFileProgress["status"])
              )}
              style={{ width: `${overall.overallProgress}%` }}
            />
          </div>
        </div>
        
        {/* ETA / Elapsed */}
        <div className="text-right min-w-[60px]">
          {progress.isProcessing ? (
            <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {elapsedTime}
            </span>
          ) : (
            <span className="text-sm text-[var(--muted-foreground)]">
              {overall.processedFiles}/{overall.totalFiles}
            </span>
          )}
        </div>
        
        {/* Cancel button */}
        {status === "processing" && !isCancelling && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Cancel
          </Button>
        )}
      </div>
    );
  }
  
  // Full view
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {status === "processing" ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--cai-teal)]" />
            ) : status === "complete" ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : status === "error" ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Ban className="h-5 w-5 text-gray-500" />
            )}
            <span>
              {status === "processing" ? "Processing Files" : 
               status === "complete" ? "Processing Complete" :
               status === "error" ? "Processing Failed" : "Cancelled"}
            </span>
          </CardTitle>
          
          {status === "processing" && !isCancelling && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{message || "Processing..."}</span>
            <div className="flex items-center gap-3">
              {progress.isProcessing && (
                <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {elapsedTime}
                </span>
              )}
              {overall.etaSeconds && progress.isProcessing && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  ~{formatETA(overall.etaSeconds)} remaining
                </span>
              )}
              <span className="text-sm font-medium">{overall.overallProgress}%</span>
            </div>
          </div>
          <div className="h-3 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 ease-out",
                getStatusColor(status as OCRFileProgress["status"])
              )}
              style={{ width: `${overall.overallProgress}%` }}
            />
          </div>
        </div>
        
        {/* Live Stats */}
        <div className="grid grid-cols-4 gap-4 py-4 border-y">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums">{overall.totalFiles}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Total Files</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 tabular-nums">{overall.processedFiles}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Processed</div>
          </div>
          <AnimatedCounter 
            value={overall.totalItemsFound} 
            label="Parts Found" 
            icon={Package}
            color="text-[var(--cai-teal)]"
          />
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 tabular-nums">{overall.failedFiles}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Failed</div>
          </div>
        </div>
        
        {/* File details */}
        {showFileDetails && files.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              File Details ({files.length})
            </button>
            
            {showDetails && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.fileIndex}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      file.status === "complete" && "bg-green-50/50 border-green-200",
                      file.status === "error" && "bg-red-50/50 border-red-200",
                      file.status === "processing" && "bg-[var(--cai-teal)]/5 border-[var(--cai-teal)]/20 animate-pulse",
                      file.status === "pending" && "bg-[var(--muted)]/50"
                    )}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(file.status)}
                    </div>
                    
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
                        <span className="font-medium truncate">{file.fileName}</span>
                      </div>
                      
                      {file.status === "processing" && (
                        <div className="flex items-center gap-2 mt-1">
                          {getStageIcon(file.stage)}
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {getStageName(file.stage)}
                          </span>
                          <div className="flex-1 h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--cai-teal)] transition-all"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {file.status === "error" && file.errorMessage && (
                        <span className="text-xs text-red-600">{file.errorMessage}</span>
                      )}
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-2 text-sm">
                      {file.status === "complete" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Package className="h-3 w-3 mr-1" />
                          {file.itemsFound} parts
                        </Badge>
                      )}
                      
                      {file.templateDetected && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          <Zap className="h-3 w-3 mr-1" />
                          Template
                        </Badge>
                      )}
                      
                      {file.confidence !== undefined && file.status === "complete" && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {Math.round(file.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
