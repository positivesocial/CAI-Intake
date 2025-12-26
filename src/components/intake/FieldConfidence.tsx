"use client";

/**
 * Field Confidence Indicator
 * 
 * Shows per-field confidence levels in parsed parts.
 * Uses visual indicators (underlines, colors) rather than interrupting flow.
 */

import * as React from "react";
import { AlertCircle, AlertTriangle, Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface FieldConfidence {
  level: ConfidenceLevel;
  score: number;
  reason?: string;
}

// ============================================================
// CONFIDENCE CALCULATION
// ============================================================

/**
 * Calculate confidence for each field based on available data
 */
export function calculateFieldConfidence(part: ParsedPartWithStatus): Record<string, FieldConfidence> {
  const result: Record<string, FieldConfidence> = {};
  const originalText = part._originalText?.toLowerCase() || "";
  const overallConfidence = part.audit?.confidence ?? 0.8;

  // Dimensions - high confidence if reasonable values
  const dimConfidence = 
    part.size.L > 0 && part.size.W > 0 && 
    part.size.L <= 3000 && part.size.W <= 3000 &&
    part.size.L >= part.size.W // L should be >= W
      ? 0.95
      : part.size.L > 0 && part.size.W > 0
      ? 0.7
      : 0.3;
  
  result.dimensions = {
    level: getLevel(dimConfidence),
    score: dimConfidence,
    reason: dimConfidence < 0.7 
      ? part.size.L < part.size.W 
        ? "Dimensions may be swapped (L < W)" 
        : "Unusual dimensions detected"
      : undefined,
  };

  // Quantity - high if explicitly stated, lower if defaulted
  const qtyPattern = /\b(?:qty|q|x|×)\s*(\d+)/i;
  const hasExplicitQty = qtyPattern.test(originalText) || /\b\d+\s*(?:pcs?|pieces?|off|ea)\b/i.test(originalText);
  const qtyConfidence = hasExplicitQty ? 0.95 : 0.6;
  
  result.quantity = {
    level: getLevel(qtyConfidence),
    score: qtyConfidence,
    reason: !hasExplicitQty ? "Quantity inferred as 1 (not explicitly stated)" : undefined,
  };

  // Material - high if matches known material codes
  const materialPatterns = [
    /\b(white|wm|w)\b/i,
    /\bply(?:wood)?\b/i,
    /\b(black|b)\b/i,
    /\bmdf\b/i,
    /\b(oak|walnut|maple|birch)\b/i,
    /\bmelamine\b/i,
  ];
  const hasExplicitMaterial = materialPatterns.some(p => p.test(originalText));
  const matConfidence = hasExplicitMaterial ? 0.9 : part.material_id ? 0.6 : 0.4;
  
  result.material = {
    level: getLevel(matConfidence),
    score: matConfidence,
    reason: !hasExplicitMaterial ? "Material inferred from context or defaults" : undefined,
  };

  // Edgebanding - confidence based on explicit markers
  const hasEdgingMarkers = /\b(eb|edge|band|l1|l2|w1|w2|2l|2w|4e|all\s*edges?)\b/i.test(originalText) ||
    /[✓√x✔]/i.test(originalText);
  const hasEdging = part.ops?.edging && Object.values(part.ops.edging.edges || {}).some(e => e?.apply);
  const edgingConfidence = hasEdging
    ? hasEdgingMarkers ? 0.9 : 0.5
    : 0.8; // No edging is often a safe default
  
  result.edging = {
    level: getLevel(edgingConfidence),
    score: edgingConfidence,
    reason: hasEdging && !hasEdgingMarkers 
      ? "Edgebanding detected but not explicitly marked" 
      : undefined,
  };

  // Grooving
  const hasGrooveMarkers = /\b(gr|grv|groove|dado|rabbet|gl|gw|bpg|back\s*panel)\b/i.test(originalText);
  const hasGroove = part.ops?.grooves && part.ops.grooves.length > 0;
  const grooveConfidence = hasGroove
    ? hasGrooveMarkers ? 0.9 : 0.5
    : 0.85;
  
  result.groove = {
    level: getLevel(grooveConfidence),
    score: grooveConfidence,
    reason: hasGroove && !hasGrooveMarkers 
      ? "Groove detected but not explicitly marked" 
      : undefined,
  };

  // Label/part name
  const labelConfidence = part.label 
    ? part.label.length > 2 ? 0.9 : 0.6
    : 0.5;
  
  result.label = {
    level: getLevel(labelConfidence),
    score: labelConfidence,
    reason: !part.label ? "No part name specified" : undefined,
  };

  return result;
}

function getLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

// ============================================================
// CONFIDENCE INDICATOR COMPONENTS
// ============================================================

interface ConfidenceIndicatorProps {
  confidence: FieldConfidence;
  size?: "sm" | "md";
  showScore?: boolean;
}

export function ConfidenceIndicator({ confidence, size = "sm", showScore = false }: ConfidenceIndicatorProps) {
  const config = {
    high: {
      icon: Check,
      color: "text-green-500",
      bg: "bg-green-50",
      border: "border-green-200",
      label: "High confidence",
    },
    medium: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "Medium confidence",
    },
    low: {
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Low confidence",
    },
    unknown: {
      icon: HelpCircle,
      color: "text-gray-400",
      bg: "bg-gray-50",
      border: "border-gray-200",
      label: "Unknown",
    },
  };

  const c = config[confidence.level];
  const Icon = c.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-0.5 cursor-help", c.color)}>
            <Icon className={iconSize} />
            {showScore && (
              <span className="text-[10px] font-mono">
                {Math.round(confidence.score * 100)}%
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          <p className="font-medium">{c.label} ({Math.round(confidence.score * 100)}%)</p>
          {confidence.reason && (
            <p className="text-[var(--muted-foreground)] mt-0.5">{confidence.reason}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// FIELD WRAPPER WITH CONFIDENCE
// ============================================================

interface ConfidenceFieldProps {
  confidence?: FieldConfidence;
  children: React.ReactNode;
  className?: string;
}

export function ConfidenceField({ confidence, children, className }: ConfidenceFieldProps) {
  if (!confidence || confidence.level === "high") {
    return <div className={className}>{children}</div>;
  }

  const borderColors = {
    medium: "border-b-2 border-amber-300",
    low: "border-b-2 border-red-300",
    unknown: "border-b border-dashed border-gray-300",
  };

  return (
    <div className={cn("relative", borderColors[confidence.level], className)}>
      {children}
      <span className="absolute -top-1 -right-1">
        <ConfidenceIndicator confidence={confidence} size="sm" />
      </span>
    </div>
  );
}

// ============================================================
// CONFIDENCE SUMMARY BAR
// ============================================================

interface ConfidenceSummaryProps {
  fieldConfidence: Record<string, FieldConfidence>;
  compact?: boolean;
}

export function ConfidenceSummary({ fieldConfidence, compact = false }: ConfidenceSummaryProps) {
  const fields = Object.entries(fieldConfidence);
  const lowConfidenceFields = fields.filter(([, c]) => c.level === "low" || c.level === "medium");
  
  if (lowConfidenceFields.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] cursor-help">
              <AlertTriangle className="h-2.5 w-2.5" />
              {lowConfidenceFields.length}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <p className="font-medium text-xs mb-1">Review Needed:</p>
            <div className="space-y-1">
              {lowConfidenceFields.map(([field, conf]) => (
                <div key={field} className="text-xs flex items-center gap-1">
                  <ConfidenceIndicator confidence={conf} size="sm" />
                  <span className="capitalize">{field}</span>
                  {conf.reason && (
                    <span className="text-[10px] opacity-60">- {conf.reason}</span>
                  )}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {lowConfidenceFields.map(([field, conf]) => (
        <span
          key={field}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]",
            conf.level === "low" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
          )}
        >
          <ConfidenceIndicator confidence={conf} size="sm" />
          <span className="capitalize">{field}</span>
        </span>
      ))}
    </div>
  );
}


