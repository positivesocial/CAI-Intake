"use client";

/**
 * Correction Diff Component
 * 
 * Shows visual diffs between original parsed text and normalized values.
 * Helps users understand what the AI changed/interpreted.
 */

import * as React from "react";
import { AlertCircle, ArrowRight, Check, RefreshCcw, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ParsedPartWithStatus } from "@/lib/store";

// ============================================================
// TYPES
// ============================================================

interface Correction {
  field: string;
  original: string;
  normalized: string;
  type: "swap" | "normalize" | "infer" | "fix";
}

// ============================================================
// DIFF DETECTION
// ============================================================

/**
 * Detect corrections made during parsing
 */
export function detectDiffs(part: ParsedPartWithStatus): Correction[] {
  const corrections: Correction[] = [];
  const originalText = part._originalText || "";
  
  if (!originalText) return corrections;

  // Try to extract original values from the text
  const normalizedOriginal = originalText.toLowerCase().trim();

  // Check for dimension swaps (common AI correction)
  const dimPattern = /(\d+)\s*[×x]\s*(\d+)/i;
  const dimMatch = normalizedOriginal.match(dimPattern);
  if (dimMatch) {
    const originalL = parseFloat(dimMatch[1]);
    const originalW = parseFloat(dimMatch[2]);
    
    // AI should have swapped if L < W (L should be longer)
    if (originalL < originalW && part.size.L === originalW && part.size.W === originalL) {
      corrections.push({
        field: "dimensions",
        original: `${originalL}×${originalW}`,
        normalized: `${part.size.L}×${part.size.W}`,
        type: "swap",
      });
    }
  }

  // Check for edge notation normalization
  const edgePatterns = [
    { pattern: /\b1l\b/gi, normalized: "L1" },
    { pattern: /\b2l\b/gi, normalized: "L2" },
    { pattern: /\b1w\b/gi, normalized: "W1" },
    { pattern: /\b2w\b/gi, normalized: "W2" },
    { pattern: /\beb\s*all\b/gi, normalized: "EB:4" },
    { pattern: /\ball\s*edges?\b/gi, normalized: "EB:4" },
    { pattern: /\b2l\s*2w\b/gi, normalized: "EB:4" },
    { pattern: /\b4\s*edges?\b/gi, normalized: "EB:4" },
  ];

  for (const { pattern, normalized } of edgePatterns) {
    const match = normalizedOriginal.match(pattern);
    if (match) {
      corrections.push({
        field: "edging",
        original: match[0],
        normalized: normalized,
        type: "normalize",
      });
      break; // Only show first match
    }
  }

  // Check for material code normalization
  const materialPatterns = [
    { pattern: /\bwhite\s*(?:mel(?:amine)?|board)?\b/gi, normalized: "W" },
    { pattern: /\bwm\b/gi, normalized: "W" },
    { pattern: /\bply(?:wood)?\b/gi, normalized: "Ply" },
    { pattern: /\bblack\b/gi, normalized: "B" },
    { pattern: /\bmdf\b/gi, normalized: "MDF" },
    { pattern: /\boak\b/gi, normalized: "Oak" },
  ];

  for (const { pattern, normalized } of materialPatterns) {
    const match = normalizedOriginal.match(pattern);
    if (match && match[0].toLowerCase() !== normalized.toLowerCase()) {
      corrections.push({
        field: "material",
        original: match[0],
        normalized: normalized,
        type: "normalize",
      });
      break;
    }
  }

  // Check for quantity inference
  if (!normalizedOriginal.match(/\b(?:qty|q|x|×)\s*\d+/i) && part.qty === 1) {
    // No explicit qty found, inferred as 1
    corrections.push({
      field: "quantity",
      original: "(not specified)",
      normalized: "1",
      type: "infer",
    });
  }

  // Check for groove detection
  const groovePatterns = [
    { pattern: /\bgl\b/gi, normalized: "Groove L" },
    { pattern: /\bgw\b/gi, normalized: "Groove W" },
    { pattern: /\bgrv?\b/gi, normalized: "Groove" },
    { pattern: /\bback\s*groove\b/gi, normalized: "BPG" },
    { pattern: /\bbpg\b/gi, normalized: "BPG" },
  ];

  for (const { pattern, normalized } of groovePatterns) {
    if (normalizedOriginal.match(pattern) && part.ops?.grooves && part.ops.grooves.length > 0) {
      corrections.push({
        field: "groove",
        original: normalizedOriginal.match(pattern)?.[0] || "",
        normalized: `GR:${part.ops.grooves.map(g => g.side).join("+")}`,
        type: "normalize",
      });
      break;
    }
  }

  return corrections;
}

// ============================================================
// CORRECTION BADGE
// ============================================================

interface CorrectionBadgeProps {
  correction: Correction;
}

function CorrectionBadge({ correction }: CorrectionBadgeProps) {
  const typeConfig = {
    swap: {
      icon: ArrowLeftRight,
      color: "bg-amber-100 text-amber-700 border-amber-200",
      label: "Swapped",
    },
    normalize: {
      icon: RefreshCcw,
      color: "bg-blue-100 text-blue-700 border-blue-200",
      label: "Normalized",
    },
    infer: {
      icon: AlertCircle,
      color: "bg-purple-100 text-purple-700 border-purple-200",
      label: "Inferred",
    },
    fix: {
      icon: Check,
      color: "bg-green-100 text-green-700 border-green-200",
      label: "Fixed",
    },
  };

  const config = typeConfig[correction.type];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
              "border cursor-help",
              config.color
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            <span className="line-through opacity-60">{correction.original}</span>
            <ArrowRight className="h-2 w-2 opacity-60" />
            <span className="font-semibold">{correction.normalized}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{config.label}: {correction.field}</p>
          <p className="text-[var(--muted-foreground)]">
            "{correction.original}" → "{correction.normalized}"
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface CorrectionDiffProps {
  part: ParsedPartWithStatus;
  compact?: boolean;
}

export function CorrectionDiff({ part, compact = false }: CorrectionDiffProps) {
  const corrections = React.useMemo(() => detectDiffs(part), [part]);

  if (corrections.length === 0) {
    return null;
  }

  if (compact) {
    // Just show a small indicator with tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] cursor-help">
              <RefreshCcw className="h-2.5 w-2.5" />
              {corrections.length}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px]">
            <p className="font-medium text-xs mb-1">AI Corrections:</p>
            <div className="space-y-1">
              {corrections.map((c, i) => (
                <div key={i} className="text-xs flex items-center gap-1">
                  <span className="opacity-60 line-through">{c.original}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{c.normalized}</span>
                  <span className="text-[10px] opacity-60">({c.field})</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {corrections.map((correction, index) => (
        <CorrectionBadge key={index} correction={correction} />
      ))}
    </div>
  );
}

// ============================================================
// INLINE DIFF TEXT
// ============================================================

interface InlineDiffProps {
  original: string;
  current: string;
  className?: string;
}

export function InlineDiff({ original, current, className }: InlineDiffProps) {
  if (!original || original === current) {
    return <span className={className}>{current}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help", className)}>
            {current}
            <span className="ml-1 inline-flex items-center text-[9px] text-blue-500">
              <RefreshCcw className="h-2.5 w-2.5" />
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="line-through opacity-60">{original}</span>
          <ArrowRight className="inline h-3 w-3 mx-1" />
          <span className="font-medium">{current}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


