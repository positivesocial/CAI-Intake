"use client";

/**
 * Validation Fix Panel
 * 
 * Aggregates all validation issues across inbox parts and offers
 * one-click fixes. Non-interrupting - shows as a collapsible panel.
 */

import * as React from "react";
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Wrench,
  ArrowRight,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParsedPartWithStatus } from "@/lib/store";

// ============================================================
// TYPES
// ============================================================

export interface ValidationIssue {
  partId: string;
  partLabel: string;
  rowIndex: number;
  field: string;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
  fix?: () => void;
}

// ============================================================
// VALIDATION RULES
// ============================================================

interface ValidationRule {
  check: (part: ParsedPartWithStatus, index: number) => ValidationIssue | null;
}

const VALIDATION_RULES: ValidationRule[] = [
  // Missing length
  {
    check: (part, index) => {
      if (!part.size?.L || part.size.L <= 0) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "length",
          severity: "error",
          message: "Missing length dimension",
          suggestion: "Enter the length in mm",
        };
      }
      return null;
    },
  },
  // Missing width
  {
    check: (part, index) => {
      if (!part.size?.W || part.size.W <= 0) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "width",
          severity: "error",
          message: "Missing width dimension",
          suggestion: "Enter the width in mm",
        };
      }
      return null;
    },
  },
  // Dimensions may be swapped (L < W)
  {
    check: (part, index) => {
      if (part.size?.L > 0 && part.size?.W > 0 && part.size.L < part.size.W) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "dimensions",
          severity: "warning",
          message: `Dimensions may be swapped (${part.size.L}×${part.size.W})`,
          suggestion: `Swap to ${part.size.W}×${part.size.L}`,
        };
      }
      return null;
    },
  },
  // Unusually large dimensions
  {
    check: (part, index) => {
      if (part.size?.L > 3000 || part.size?.W > 3000) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "dimensions",
          severity: "warning",
          message: `Large dimension detected (${Math.max(part.size.L, part.size.W)}mm)`,
          suggestion: "Verify this is correct",
        };
      }
      return null;
    },
  },
  // Very small dimensions (< 50mm)
  {
    check: (part, index) => {
      if ((part.size?.L > 0 && part.size.L < 50) || (part.size?.W > 0 && part.size.W < 50)) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "dimensions",
          severity: "warning",
          message: `Small dimension detected (${Math.min(part.size.L, part.size.W)}mm)`,
          suggestion: "Verify this is correct",
        };
      }
      return null;
    },
  },
  // Missing material
  {
    check: (part, index) => {
      if (!part.material_id) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "material",
          severity: "warning",
          message: "No material assigned",
          suggestion: "Will use default material",
        };
      }
      return null;
    },
  },
  // High quantity
  {
    check: (part, index) => {
      if (part.qty > 50) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "quantity",
          severity: "warning",
          message: `High quantity: ${part.qty}`,
          suggestion: "Verify this is correct",
        };
      }
      return null;
    },
  },
  // Low confidence
  {
    check: (part, index) => {
      const confidence = part.audit?.confidence ?? 1;
      if (confidence < 0.7) {
        return {
          partId: part.part_id,
          partLabel: part.label || `Row ${index + 1}`,
          rowIndex: index,
          field: "overall",
          severity: "warning",
          message: `Low parsing confidence (${Math.round(confidence * 100)}%)`,
          suggestion: "Review all fields",
        };
      }
      return null;
    },
  },
];

// ============================================================
// VALIDATION FUNCTION
// ============================================================

export function validateParts(parts: ParsedPartWithStatus[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  parts.forEach((part, index) => {
    if (part._status === "rejected") return;

    for (const rule of VALIDATION_RULES) {
      const issue = rule.check(part, index);
      if (issue) {
        issues.push(issue);
      }
    }
  });

  return issues;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface ValidationPanelProps {
  parts: ParsedPartWithStatus[];
  onSwapDimensions: (partId: string) => void;
  onScrollToRow: (index: number) => void;
  onSetMaterial: (partId: string, materialId: string) => void;
  defaultMaterialId: string;
}

export function ValidationPanel({
  parts,
  onSwapDimensions,
  onScrollToRow,
  onSetMaterial,
  defaultMaterialId,
}: ValidationPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Calculate issues with fixes
  const issues = React.useMemo(() => {
    const baseIssues = validateParts(parts);
    
    // Add fix functions
    return baseIssues.map(issue => {
      // Add fix for dimension swap
      if (issue.field === "dimensions" && issue.message.includes("swapped")) {
        return {
          ...issue,
          fix: () => onSwapDimensions(issue.partId),
        };
      }
      // Add fix for missing material
      if (issue.field === "material" && !issue.message.includes("assigned")) {
        return {
          ...issue,
          fix: () => onSetMaterial(issue.partId, defaultMaterialId),
        };
      }
      return issue;
    });
  }, [parts, onSwapDimensions, onSetMaterial, defaultMaterialId]);

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  // Nothing to show
  if (issues.length === 0) {
    return null;
  }

  // Collapsed state - just show count
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-sm",
          "border-b border-[var(--border)]",
          "transition-colors hover:bg-[var(--muted)]/50",
          errorCount > 0 
            ? "bg-red-50 text-red-700" 
            : "bg-amber-50 text-amber-700"
        )}
      >
        {errorCount > 0 ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>
          {issues.length} issue{issues.length !== 1 ? "s" : ""} found
          {errorCount > 0 && (
            <span className="ml-1">({errorCount} error{errorCount !== 1 ? "s" : ""})</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 ml-auto" />
      </button>
    );
  }

  // Expanded state - show issue list
  return (
    <div className="border-b border-[var(--border)]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(false)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-sm",
          "transition-colors hover:bg-[var(--muted)]/50",
          errorCount > 0 
            ? "bg-red-50 text-red-700" 
            : "bg-amber-50 text-amber-700"
        )}
      >
        {errorCount > 0 ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span className="font-medium">
          {issues.length} Issue{issues.length !== 1 ? "s" : ""}
        </span>
        {errorCount > 0 && (
          <Badge variant="error" className="text-[10px]">{errorCount} Errors</Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="warning" className="text-[10px]">{warningCount} Warnings</Badge>
        )}
        <ChevronUp className="h-4 w-4 ml-auto" />
      </button>

      {/* Issue List */}
      <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--border)]">
        {issues.map((issue, index) => (
          <div
            key={`${issue.partId}-${issue.field}-${index}`}
            className={cn(
              "flex items-center gap-3 px-4 py-2 text-sm",
              "hover:bg-[var(--muted)]/30"
            )}
          >
            {issue.severity === "error" ? (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onScrollToRow(issue.rowIndex)}
                  className="font-medium text-[var(--cai-teal)] hover:underline"
                >
                  {issue.partLabel}
                </button>
                <span className="text-[var(--muted-foreground)]">•</span>
                <span className="text-[var(--muted-foreground)] capitalize">{issue.field}</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {issue.message}
              </p>
            </div>

            {issue.fix && (
              <Button
                variant="ghost"
                size="sm"
                onClick={issue.fix}
                className="h-7 px-2 text-xs text-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/10"
              >
                <Zap className="h-3 w-3 mr-1" />
                Fix
              </Button>
            )}

            <button
              onClick={() => onScrollToRow(issue.rowIndex)}
              className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
              title="Go to row"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {issues.filter(i => i.fix).length > 0 && (
        <div className="px-4 py-2 bg-[var(--muted)]/30 border-t border-[var(--border)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              issues.forEach(issue => issue.fix?.());
            }}
            className="text-xs"
          >
            <Wrench className="h-3 w-3 mr-1" />
            Fix All ({issues.filter(i => i.fix).length})
          </Button>
        </div>
      )}
    </div>
  );
}


