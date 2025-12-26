"use client";

/**
 * Duplicate Part Detector
 * 
 * Detects parts with identical dimensions and material,
 * suggesting they could be merged (combined quantities).
 */

import * as React from "react";
import {
  Copy,
  Layers,
  ChevronDown,
  ChevronUp,
  Merge,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParsedPartWithStatus } from "@/lib/store";

// ============================================================
// TYPES
// ============================================================

export interface DuplicateGroup {
  key: string; // Unique key based on dims + material
  parts: {
    part: ParsedPartWithStatus;
    index: number;
  }[];
  dimensions: { L: number; W: number };
  material_id: string;
  totalQty: number;
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================

/**
 * Detect duplicate parts based on dimensions and material
 */
export function detectDuplicates(parts: ParsedPartWithStatus[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  parts.forEach((part, index) => {
    if (part._status === "rejected") return;
    if (!part.size?.L || !part.size?.W) return;

    // Create a normalized key (dimensions sorted to handle L/W swaps)
    const dims = [part.size.L, part.size.W].sort((a, b) => b - a);
    const key = `${dims[0]}x${dims[1]}|${part.material_id || "default"}|${part.thickness_mm || 18}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        parts: [],
        dimensions: { L: dims[0], W: dims[1] },
        material_id: part.material_id || "",
        totalQty: 0,
      });
    }

    const group = groups.get(key)!;
    group.parts.push({ part, index });
    group.totalQty += part.qty || 1;
  });

  // Only return groups with more than one part
  return Array.from(groups.values()).filter(g => g.parts.length > 1);
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface DuplicateDetectorProps {
  parts: ParsedPartWithStatus[];
  onMerge: (partIds: string[], intoPartId: string, newQty: number) => void;
  onScrollToRow: (index: number) => void;
  onDismissGroup: (key: string) => void;
  dismissedGroups: Set<string>;
}

export function DuplicateDetector({
  parts,
  onMerge,
  onScrollToRow,
  onDismissGroup,
  dismissedGroups,
}: DuplicateDetectorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Detect duplicates
  const duplicateGroups = React.useMemo(() => {
    return detectDuplicates(parts).filter(g => !dismissedGroups.has(g.key));
  }, [parts, dismissedGroups]);

  // Nothing to show
  if (duplicateGroups.length === 0) {
    return null;
  }

  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.parts.length - 1, 0);

  // Collapsed state
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-sm",
          "border-b border-[var(--border)]",
          "transition-colors hover:bg-[var(--muted)]/50",
          "bg-blue-50 text-blue-700"
        )}
      >
        <Layers className="h-4 w-4" />
        <span>
          {duplicateGroups.length} potential duplicate group{duplicateGroups.length !== 1 ? "s" : ""} detected
          <span className="ml-1 opacity-70">
            ({totalDuplicates} parts could be merged)
          </span>
        </span>
        <ChevronDown className="h-4 w-4 ml-auto" />
      </button>
    );
  }

  // Expanded state
  return (
    <div className="border-b border-[var(--border)]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(false)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-sm",
          "transition-colors hover:bg-[var(--muted)]/50",
          "bg-blue-50 text-blue-700"
        )}
      >
        <Layers className="h-4 w-4" />
        <span className="font-medium">
          {duplicateGroups.length} Duplicate Group{duplicateGroups.length !== 1 ? "s" : ""}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {totalDuplicates} mergeable
        </Badge>
        <ChevronUp className="h-4 w-4 ml-auto" />
      </button>

      {/* Duplicate Groups */}
      <div className="max-h-[250px] overflow-y-auto divide-y divide-[var(--border)]">
        {duplicateGroups.map((group) => (
          <DuplicateGroupCard
            key={group.key}
            group={group}
            onMerge={onMerge}
            onScrollToRow={onScrollToRow}
            onDismiss={() => onDismissGroup(group.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DUPLICATE GROUP CARD
// ============================================================

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onMerge: (partIds: string[], intoPartId: string, newQty: number) => void;
  onScrollToRow: (index: number) => void;
  onDismiss: () => void;
}

function DuplicateGroupCard({
  group,
  onMerge,
  onScrollToRow,
  onDismiss,
}: DuplicateGroupCardProps) {
  const handleMerge = () => {
    // Merge all parts into the first one
    const [first, ...rest] = group.parts;
    const allPartIds = group.parts.map(p => p.part.part_id);
    onMerge(allPartIds, first.part.part_id, group.totalQty);
  };

  return (
    <div className="px-4 py-3 hover:bg-[var(--muted)]/30">
      {/* Group Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium">
            {group.dimensions.L} × {group.dimensions.W}
          </span>
          {group.material_id && (
            <Badge variant="outline" className="text-[10px]">
              {group.material_id}
            </Badge>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-[var(--muted-foreground)]">
          {group.parts.length} parts • Total qty: {group.totalQty}
        </span>
      </div>

      {/* Parts List */}
      <div className="flex flex-wrap gap-1 mb-2">
        {group.parts.map(({ part, index }) => (
          <button
            key={part.part_id}
            onClick={() => onScrollToRow(index)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
              "bg-[var(--muted)] hover:bg-[var(--muted)]/80",
              "transition-colors"
            )}
          >
            <span className="font-medium">
              {part.label || `Row ${index + 1}`}
            </span>
            <span className="text-[var(--muted-foreground)]">
              ×{part.qty}
            </span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMerge}
          className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Merge className="h-3 w-3 mr-1" />
          Merge All (qty: {group.totalQty})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-7 px-2 text-xs text-[var(--muted-foreground)]"
        >
          <X className="h-3 w-3 mr-1" />
          Not Duplicates
        </Button>
      </div>
    </div>
  );
}


