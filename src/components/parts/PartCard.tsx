"use client";

/**
 * CAI Intake - Part Card Component
 * 
 * A mobile-first, touch-friendly card for displaying and editing a single part.
 * Features:
 * - Compact display with essential fields visible
 * - Inline editing for quick changes
 * - Unified operations button
 * - Swipe actions on mobile (optional)
 * - Responsive: card on mobile, row on desktop
 */

import * as React from "react";
import {
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Settings2,
  RotateCcw,
  Lock,
  GripVertical,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UnifiedOpsPanel } from "./UnifiedOpsPanel";
import type { OperationsData } from "@/components/operations";
import {
  getNameSuggestions,
  operationsMatchSuggestion,
  applySuggestionToOps,
  formatSuggestionAsShortcode,
  type NameSuggestion,
} from "@/lib/utils/part-name-suggestions";

// ============================================================
// TYPES
// ============================================================

export interface PartCardData {
  id: string;
  label: string;
  L: string;
  W: string;
  qty: string;
  thickness_mm: string;
  material_id: string;
  allow_rotation: boolean;
  group_id?: string;
  notes?: string;
  operations: OperationsData;
}

interface PartCardProps {
  data: PartCardData;
  index: number;
  materials: Array<{ value: string; label: string }>;
  onChange: (updates: Partial<PartCardData>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onSubmit?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  showDragHandle?: boolean;
  /** Compact mode for table rows */
  compact?: boolean;
  /** Validation errors */
  errors?: Record<string, boolean>;
}

// ============================================================
// GHOST CHIP - Suggested operation
// ============================================================

function GhostChip({
  suggestion,
  onAccept,
}: {
  suggestion: NameSuggestion;
  onAccept: () => void;
}) {
  const shortcode = formatSuggestionAsShortcode(suggestion.ops);
  
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAccept();
      }}
      className={cn(
        "flex items-center gap-1 h-6 px-2 rounded-md",
        "border border-dashed border-[var(--cai-teal)]/50",
        "bg-[var(--cai-teal)]/5 hover:bg-[var(--cai-teal)]/10",
        "text-[10px] text-[var(--cai-teal)] font-mono",
        "transition-all hover:border-[var(--cai-teal)]",
        "animate-pulse"
      )}
      title={`${suggestion.description} - Click to apply`}
    >
      <span className="opacity-60">+</span>
      <span>{shortcode}</span>
      <span className="text-[8px] opacity-60 ml-0.5">↵</span>
    </button>
  );
}

// ============================================================
// OPS INDICATOR BUTTON
// ============================================================

function OpsIndicator({
  operations,
  onClick,
  suggestion,
  onAcceptSuggestion,
}: {
  operations: OperationsData;
  onClick: () => void;
  suggestion?: NameSuggestion | null;
  onAcceptSuggestion?: () => void;
}) {
  const edgingSideCount = Object.values(operations.edgebanding.sides).filter(Boolean).length;
  const grooveCount = operations.grooves.length;
  const holeCount = operations.holes.length;
  const cncCount = operations.cnc.length;
  const totalOps = edgingSideCount + grooveCount + holeCount + cncCount;

  // Show ghost chip when no ops and there's a suggestion
  if (totalOps === 0 && suggestion && onAcceptSuggestion) {
    return (
      <div className="flex items-center gap-1">
        <GhostChip suggestion={suggestion} onAccept={onAcceptSuggestion} />
        <button
          type="button"
          onClick={onClick}
          className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          title="Open operations panel"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (totalOps === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 h-8 px-2 rounded-md border border-dashed",
          "text-xs text-[var(--muted-foreground)] hover:border-[var(--cai-teal)] hover:text-[var(--cai-teal)]",
          "transition-colors"
        )}
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ops</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 h-8 px-2 rounded-md",
        "bg-[var(--muted)] hover:bg-[var(--cai-teal)]/10 transition-colors"
      )}
    >
      {edgingSideCount > 0 && (
        <Badge className="h-5 px-1.5 text-[10px] bg-blue-100 text-blue-700 border-0">
          {edgingSideCount === 4 ? "4E" : `${edgingSideCount}E`}
        </Badge>
      )}
      {grooveCount > 0 && (
        <Badge className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 border-0">
          {grooveCount}G
        </Badge>
      )}
      {holeCount > 0 && (
        <Badge className="h-5 px-1.5 text-[10px] bg-purple-100 text-purple-700 border-0">
          {holeCount}H
        </Badge>
      )}
      {cncCount > 0 && (
        <Badge className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 border-0">
          {cncCount}C
        </Badge>
      )}
    </button>
  );
}

// ============================================================
// QTY STEPPER
// ============================================================

function QtyStepper({
  value,
  onChange,
  min = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
}) {
  const numValue = parseInt(value) || min;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, numValue - 1).toString())}
        disabled={numValue <= min}
        className={cn(
          "w-6 h-8 flex items-center justify-center rounded-l-md border",
          "text-sm font-bold transition-colors",
          "hover:bg-[var(--muted)] active:bg-[var(--muted)]",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-10 h-8 text-center text-sm font-mono border-y",
          "bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--cai-teal)]"
        )}
      />
      <button
        type="button"
        onClick={() => onChange((numValue + 1).toString())}
        className={cn(
          "w-6 h-8 flex items-center justify-center rounded-r-md border",
          "text-sm font-bold transition-colors",
          "hover:bg-[var(--muted)] active:bg-[var(--muted)]"
        )}
      >
        +
      </button>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function PartCard({
  data,
  index,
  materials,
  onChange,
  onDelete,
  onDuplicate,
  onSubmit,
  isSelected,
  onSelect,
  showDragHandle,
  compact = false,
  errors = {},
}: PartCardProps) {
  const [showOpsPanel, setShowOpsPanel] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = React.useState(false);

  // Refs for keyboard navigation
  const labelRef = React.useRef<HTMLInputElement>(null);
  const lRef = React.useRef<HTMLInputElement>(null);
  const wRef = React.useRef<HTMLInputElement>(null);

  // Get suggestion based on part name
  const suggestion = React.useMemo(() => {
    if (dismissedSuggestion) return null;
    const s = getNameSuggestions(data.label);
    // Don't show if already applied
    if (s && operationsMatchSuggestion(data.operations, s.ops)) {
      return null;
    }
    return s;
  }, [data.label, data.operations, dismissedSuggestion]);

  // Reset dismissed state when label changes significantly
  React.useEffect(() => {
    setDismissedSuggestion(false);
  }, [data.label]);

  // Handle accepting suggestion
  const handleAcceptSuggestion = React.useCallback(() => {
    if (!suggestion) return;
    const newOps = applySuggestionToOps(
      data.operations,
      suggestion.ops,
      data.operations.edgebanding?.edgeband_id
    );
    onChange({ operations: newOps });
  }, [suggestion, data.operations, onChange]);

  // Handle Enter key to submit and move to next row
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // If there's a suggestion and we're in the label field, accept it first
      if (suggestion && e.currentTarget === labelRef.current) {
        handleAcceptSuggestion();
      }
      onSubmit?.();
    }
  };

  // Compact table row mode
  if (compact) {
    return (
      <>
        <tr
          onClick={() => onSelect?.()}
          className={cn(
            "group transition-colors cursor-pointer",
            isSelected && "bg-[var(--cai-teal)]/10",
            !isSelected && "hover:bg-[var(--muted)]/50"
          )}
        >
          {/* Checkbox */}
          <td className="w-10 px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
            {showDragHandle ? (
              <GripVertical className="h-4 w-4 mx-auto text-[var(--muted-foreground)] cursor-grab" />
            ) : (
              <label className="inline-flex p-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelect?.()}
                  className="rounded border-[var(--border)]"
                />
              </label>
            )}
          </td>

          {/* Label */}
          <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={labelRef}
              type="text"
              value={data.label}
              onChange={(e) => onChange({ label: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Part name"
              className={cn(
                "h-8 text-sm border-0 bg-transparent focus:ring-1 focus:ring-inset focus:ring-[var(--cai-teal)]",
                errors.label && "text-red-600"
              )}
            />
          </td>

          {/* L × W */}
          <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <Input
                ref={lRef}
                type="number"
                inputMode="decimal"
                value={data.L}
                onChange={(e) => onChange({ L: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="L"
                className={cn(
                  "h-8 w-16 text-sm text-right font-mono border-0 bg-transparent",
                  "focus:ring-1 focus:ring-inset focus:ring-[var(--cai-teal)]",
                  errors.L && "text-red-600 placeholder:text-red-400"
                )}
              />
              <span className="text-[var(--muted-foreground)]">×</span>
              <Input
                ref={wRef}
                type="number"
                inputMode="decimal"
                value={data.W}
                onChange={(e) => onChange({ W: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="W"
                className={cn(
                  "h-8 w-16 text-sm text-right font-mono border-0 bg-transparent",
                  "focus:ring-1 focus:ring-inset focus:ring-[var(--cai-teal)]",
                  errors.W && "text-red-600 placeholder:text-red-400"
                )}
              />
            </div>
          </td>

          {/* Qty */}
          <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <QtyStepper value={data.qty} onChange={(v) => onChange({ qty: v })} />
          </td>

          {/* Material */}
          <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <Select value={data.material_id} onValueChange={(v) => onChange({ material_id: v })}>
              <SelectTrigger className="h-8 text-sm border-0 bg-transparent">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[200]">
                {materials.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </td>

          {/* Rotation */}
          <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onChange({ allow_rotation: !data.allow_rotation })}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors",
                data.allow_rotation !== false
                  ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              )}
              title={data.allow_rotation !== false ? "Can rotate (click to lock)" : "Locked (click to allow rotation)"}
            >
              {data.allow_rotation !== false ? "✓" : "⊘"}
            </button>
          </td>

          {/* Operations */}
          <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <OpsIndicator 
              operations={data.operations} 
              onClick={() => setShowOpsPanel(true)}
              suggestion={suggestion}
              onAcceptSuggestion={handleAcceptSuggestion}
            />
          </td>
        </tr>

        <UnifiedOpsPanel
          open={showOpsPanel}
          onOpenChange={setShowOpsPanel}
          value={data.operations}
          onChange={(ops) => onChange({ operations: ops })}
          partLabel={data.label || `Row ${index + 1}`}
        />
      </>
    );
  }

  // Full card mode (mobile-friendly)
  return (
    <>
      <div
        className={cn(
          "rounded-lg border bg-[var(--card)] transition-all",
          isSelected && "ring-2 ring-[var(--cai-teal)]",
          "hover:shadow-md"
        )}
        onClick={onSelect}
      >
        {/* Main content - always visible */}
        <div className="p-3 space-y-3">
          {/* Top row: Label + Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)] font-mono w-6">
              #{index + 1}
            </span>
            <Input
              type="text"
              value={data.label}
              onChange={(e) => onChange({ label: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Part name"
              className="flex-1 h-9 text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="h-9 w-9"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Middle row: Dimensions + Qty */}
          <div className="flex items-center gap-3">
            {/* L × W */}
            <div className="flex items-center gap-1 flex-1">
              <Input
                type="number"
                inputMode="decimal"
                value={data.L}
                onChange={(e) => onChange({ L: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Length"
                className={cn(
                  "h-10 text-center font-mono",
                  errors.L && "border-red-300 text-red-600"
                )}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-lg text-[var(--muted-foreground)]">×</span>
              <Input
                type="number"
                inputMode="decimal"
                value={data.W}
                onChange={(e) => onChange({ W: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Width"
                className={cn(
                  "h-10 text-center font-mono",
                  errors.W && "border-red-300 text-red-600"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Qty */}
            <div onClick={(e) => e.stopPropagation()}>
              <QtyStepper value={data.qty} onChange={(v) => onChange({ qty: v })} />
            </div>
          </div>

          {/* Bottom row: Material + Ops */}
          <div className="flex items-center gap-2">
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Select value={data.material_id} onValueChange={(v) => onChange({ material_id: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  {materials.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <OpsIndicator 
                operations={data.operations} 
                onClick={() => setShowOpsPanel(true)}
                suggestion={suggestion}
                onAcceptSuggestion={handleAcceptSuggestion}
              />
            </div>
          </div>
        </div>

        {/* Expanded section */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-[var(--border)] bg-[var(--muted)]/30">
            <div className="pt-3 grid grid-cols-2 gap-3">
              {/* Thickness */}
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Thickness (mm)</label>
                <Input
                  type="number"
                  value={data.thickness_mm}
                  onChange={(e) => onChange({ thickness_mm: e.target.value })}
                  className="h-9 mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Rotation */}
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Can Rotate</label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ allow_rotation: !data.allow_rotation });
                  }}
                  className={cn(
                    "w-full h-9 mt-1 rounded-md border flex items-center justify-center gap-2 text-sm",
                    "transition-colors",
                    data.allow_rotation
                      ? "bg-[var(--cai-teal)]/10 border-[var(--cai-teal)] text-[var(--cai-teal)]"
                      : "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]"
                  )}
                >
                  {data.allow_rotation ? (
                    <>
                      <RotateCcw className="h-4 w-4" /> Can Rotate
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Fixed
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Notes</label>
              <Input
                type="text"
                value={data.notes || ""}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Optional notes..."
                className="h-9 mt-1"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              {onSubmit && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSubmit();
                  }}
                  disabled={!data.L || !data.W}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Add Part
                </Button>
              )}
              {onDuplicate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <UnifiedOpsPanel
        open={showOpsPanel}
        onOpenChange={setShowOpsPanel}
        value={data.operations}
        onChange={(ops) => onChange({ operations: ops })}
        partLabel={data.label || `Part ${index + 1}`}
      />
    </>
  );
}

