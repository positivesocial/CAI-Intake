"use client";

/**
 * Confidence Flag Component
 * 
 * Displays confidence indicators on parsed parts and prompts users
 * to verify/correct low-confidence items. Corrections can be saved
 * as training examples.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Eye,
  Brain,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from "lucide-react";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export interface ConfidenceBreakdown {
  overall: number; // 0-1
  dimensions: number;
  operations: number;
  material: number;
  label: number;
}

export interface ConfidenceFlagProps {
  /** Overall confidence score 0-1 */
  confidence: number;
  /** Detailed breakdown by field (optional) */
  breakdown?: Partial<ConfidenceBreakdown>;
  /** The part this flag is for */
  part?: CutPart;
  /** Compact mode for table cells */
  compact?: boolean;
  /** Callback when user confirms the part is correct */
  onConfirm?: () => void;
  /** Callback when user marks as needing correction */
  onFlag?: () => void;
  /** Show verification buttons */
  showVerification?: boolean;
}

// ============================================================
// CONFIDENCE UTILITIES
// ============================================================

/**
 * Get confidence level category
 */
function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

/**
 * Get confidence color
 */
function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case "high":
      return "text-green-600 dark:text-green-400";
    case "medium":
      return "text-amber-600 dark:text-amber-400";
    case "low":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get confidence background color
 */
function getConfidenceBg(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case "high":
      return "bg-green-50 dark:bg-green-950";
    case "medium":
      return "bg-amber-50 dark:bg-amber-950";
    case "low":
      return "bg-red-50 dark:bg-red-950";
  }
}

/**
 * Get confidence icon
 */
function ConfidenceIcon({ confidence, className }: { confidence: number; className?: string }) {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case "high":
      return <CheckCircle className={cn("h-4 w-4", className)} />;
    case "medium":
      return <HelpCircle className={cn("h-4 w-4", className)} />;
    case "low":
      return <AlertTriangle className={cn("h-4 w-4", className)} />;
  }
}

/**
 * Calculate confidence from AI parsing result
 */
export function calculatePartConfidence(
  part: CutPart,
  rawConfidence?: number
): ConfidenceBreakdown {
  // Start with raw confidence if provided
  let overall = rawConfidence ?? 0.7;
  let dimensions = 0.8;
  let operations = 0.8;
  let material = 0.8;
  let label = 0.8;

  // Dimension confidence - lower if zeros or suspicious values
  if (part.size.L === 0 || part.size.W === 0) {
    dimensions = 0.2;
    overall -= 0.2;
  } else if (part.size.L < 50 || part.size.W < 50) {
    dimensions = 0.5; // Suspiciously small
    overall -= 0.1;
  } else if (part.size.L > 3000 || part.size.W > 3000) {
    dimensions = 0.6; // Suspiciously large
    overall -= 0.1;
  }

  // Label confidence - lower if generic or missing
  if (!part.label || part.label === "Part" || part.label.match(/^Part\s*\d*$/i)) {
    label = 0.4;
    overall -= 0.1;
  }

  // Material confidence - lower if missing
  if (!part.material_id) {
    material = 0.5;
    overall -= 0.05;
  }

  // Operations confidence - lower if could have ops but doesn't
  if (!part.ops) {
    operations = 0.6; // Neutral - might genuinely have no ops
  }

  // Clamp values
  overall = Math.max(0, Math.min(1, overall));
  dimensions = Math.max(0, Math.min(1, dimensions));
  operations = Math.max(0, Math.min(1, operations));
  material = Math.max(0, Math.min(1, material));
  label = Math.max(0, Math.min(1, label));

  return { overall, dimensions, operations, material, label };
}

// ============================================================
// COMPACT FLAG COMPONENT
// ============================================================

/**
 * Compact confidence indicator for table cells
 */
function CompactConfidenceFlag({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  const colorClass = getConfidenceColor(confidence);
  const percent = Math.round(confidence * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium cursor-help",
              getConfidenceBg(confidence),
              colorClass
            )}
          >
            <ConfidenceIcon confidence={confidence} className="h-2.5 w-2.5" />
            {percent}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">
            {level === "high" && "High confidence - likely correct"}
            {level === "medium" && "Medium confidence - please verify"}
            {level === "low" && "Low confidence - needs review"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// DETAILED FLAG COMPONENT
// ============================================================

/**
 * Detailed confidence popover with breakdown
 */
function DetailedConfidenceFlag({
  confidence,
  breakdown,
  onConfirm,
  onFlag,
  showVerification,
}: ConfidenceFlagProps) {
  const level = getConfidenceLevel(confidence);
  const colorClass = getConfidenceColor(confidence);
  const percent = Math.round(confidence * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
            getConfidenceBg(confidence),
            colorClass,
            "hover:opacity-80"
          )}
        >
          <ConfidenceIcon confidence={confidence} className="h-3.5 w-3.5" />
          {percent}% Confidence
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ConfidenceIcon confidence={confidence} className={cn("h-4 w-4", colorClass)} />
              <span className="font-medium text-sm">AI Confidence</span>
            </div>
            <Badge
              variant={level === "high" ? "success" : level === "medium" ? "warning" : "error"}
            >
              {level.toUpperCase()}
            </Badge>
          </div>

          {/* Overall progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall</span>
              <span>{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>

          {/* Breakdown if available */}
          {breakdown && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Field Breakdown</p>
              {breakdown.dimensions !== undefined && (
                <BreakdownRow label="Dimensions" value={breakdown.dimensions} />
              )}
              {breakdown.label !== undefined && (
                <BreakdownRow label="Label/Name" value={breakdown.label} />
              )}
              {breakdown.material !== undefined && (
                <BreakdownRow label="Material" value={breakdown.material} />
              )}
              {breakdown.operations !== undefined && (
                <BreakdownRow label="Operations" value={breakdown.operations} />
              )}
            </div>
          )}

          {/* AI Learning info */}
          {level !== "high" && (
            <div className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded text-xs">
              <Brain className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
              <p className="text-purple-700 dark:text-purple-300">
                {level === "low" 
                  ? "This part needs manual verification. Your corrections help improve AI accuracy!"
                  : "Please verify this part. Corrections are used to train the AI."
                }
              </p>
            </div>
          )}

          {/* Verification buttons */}
          {showVerification && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={onConfirm}
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                Correct
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={onFlag}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                Fix Needed
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Breakdown row with mini progress
 */
function BreakdownRow({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  const colorClass = getConfidenceColor(value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            value >= 0.85 ? "bg-green-500" : value >= 0.6 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium w-8 text-right", colorClass)}>{percent}%</span>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ConfidenceFlag({
  confidence,
  breakdown,
  compact = false,
  onConfirm,
  onFlag,
  showVerification = false,
}: ConfidenceFlagProps) {
  if (compact) {
    return <CompactConfidenceFlag confidence={confidence} />;
  }

  return (
    <DetailedConfidenceFlag
      confidence={confidence}
      breakdown={breakdown}
      onConfirm={onConfirm}
      onFlag={onFlag}
      showVerification={showVerification}
    />
  );
}

// ============================================================
// LOW CONFIDENCE SUMMARY COMPONENT
// ============================================================

interface LowConfidenceSummaryProps {
  /** Parts with their confidence scores */
  parts: Array<{ part: CutPart; confidence: number }>;
  /** Threshold for "low" confidence */
  lowThreshold?: number;
  /** Callback when user clicks to review */
  onReviewClick?: () => void;
  /** Callback when user wants to save as training */
  onSaveTraining?: () => void;
}

/**
 * Summary banner for documents with low-confidence parts
 */
export function LowConfidenceSummary({
  parts,
  lowThreshold = 0.6,
  onReviewClick,
  onSaveTraining,
}: LowConfidenceSummaryProps) {
  const lowConfidenceParts = parts.filter(p => p.confidence < lowThreshold);
  const mediumConfidenceParts = parts.filter(
    p => p.confidence >= lowThreshold && p.confidence < 0.85
  );

  if (lowConfidenceParts.length === 0 && mediumConfidenceParts.length === 0) {
    return null;
  }

  const avgConfidence =
    parts.reduce((sum, p) => sum + p.confidence, 0) / parts.length;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        lowConfidenceParts.length > 0
          ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900"
          : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2 rounded-full",
            lowConfidenceParts.length > 0
              ? "bg-red-100 dark:bg-red-900"
              : "bg-amber-100 dark:bg-amber-900"
          )}
        >
          {lowConfidenceParts.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : (
            <Eye className="h-5 w-5 text-amber-600" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <h4 className="font-semibold text-sm">
              {lowConfidenceParts.length > 0
                ? `${lowConfidenceParts.length} parts need review`
                : `${mediumConfidenceParts.length} parts to verify`}
            </h4>
            <p className="text-xs text-muted-foreground">
              Average confidence: {Math.round(avgConfidence * 100)}% •{" "}
              {lowConfidenceParts.length} low, {mediumConfidenceParts.length} medium
            </p>
          </div>

          <div className="flex gap-2">
            {onReviewClick && (
              <Button size="sm" variant="secondary" onClick={onReviewClick}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Review Flagged Parts
              </Button>
            )}
            {onSaveTraining && lowConfidenceParts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-purple-600 hover:bg-purple-50"
                onClick={onSaveTraining}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Improve AI
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXPORTS
// ============================================================

export {
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceBg,
  CompactConfidenceFlag,
};

