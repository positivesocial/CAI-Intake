"use client";

import * as React from "react";
import {
  Check,
  X,
  Edit2,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  Layers,
  Pencil,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
  SortAsc,
  Wand2,
  SplitSquareVertical,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn, generateId } from "@/lib/utils";
import { recordCorrection, detectCorrections } from "@/lib/learning";
import type { CutPart } from "@/lib/schema";
import { PartPreviewSvg, type SimplePartPreviewProps } from "@/components/parts/PartPreviewSvg";
import { convertOpsToPreview, type PartPreviewData } from "@/lib/services";
import type { OperationsData } from "@/components/operations";
import { QuickOpsPopover, type QuickOpsType } from "./QuickOpsPopover";
import { UnifiedOpsPanel } from "@/components/parts/UnifiedOpsPanel";
import { CorrectionDiff } from "./CorrectionDiff";
import { calculateFieldConfidence, ConfidenceSummary } from "./FieldConfidence";
import { ValidationPanel } from "./ValidationPanel";
import { DuplicateDetector } from "./DuplicateDetector";
import { SourceFilesPanel, type SourceFile } from "./SourceFilesPanel";

// ============================================================
// SHORTCODE FORMATTERS
// ============================================================

import type { PartOps, GrooveOp, HoleOp, CustomCncOp } from "@/lib/schema/operations";

/**
 * Format operations to shortcode badges
 */
function formatOpsShortcodes(ops: PartOps | undefined): { 
  edging: string | null; 
  grooves: string | null; 
  holes: string | null; 
  cnc: string | null;
} {
  const result = {
    edging: null as string | null,
    grooves: null as string | null,
    holes: null as string | null,
    cnc: null as string | null,
  };
  
  if (!ops) return result;
  
  // Edging
  const edges = ops.edging?.edges;
  if (edges) {
    const applied = Object.entries(edges)
      .filter(([, v]) => v?.apply)
      .map(([k]) => k)
      .sort();
    
    if (applied.length > 0) {
      const key = applied.join(",");
      const mapping: Record<string, string> = {
        "L1": "EB:L1",
        "L2": "EB:L2",
        "W1": "EB:W1",
        "W2": "EB:W2",
        "L1,L2": "EB:2L",
        "W1,W2": "EB:2W",
        "L1,W1,W2": "EB:L+2W",
        "L1,L2,W1": "EB:2L+W",
        "L1,L2,W1,W2": "EB:4",
      };
      result.edging = mapping[key] ?? `EB:${applied.join("+")}`;
    }
  }
  
  // Grooves
  const grooves = ops.grooves;
  if (grooves && grooves.length > 0) {
    const sides = [...new Set(grooves.map((g: GrooveOp) => g.side))];
    result.grooves = `GR:${sides.join("+")}`;
  }
  
  // Holes
  const holes = ops.holes;
  if (holes && holes.length > 0) {
    const patternNames = holes.map((h: HoleOp) => h.pattern_id || "custom").slice(0, 2);
    result.holes = `H:${patternNames.join("+")}`;
  }
  
  // CNC
  const routing = ops.routing || [];
  const custom = ops.custom_cnc_ops || [];
  const cncCount = routing.length + custom.length;
  if (cncCount > 0) {
    const programs = custom.slice(0, 2).map((c: CustomCncOp) => {
      const payload = c.payload as { program_name?: string } | undefined;
      return payload?.program_name || c.op_type;
    });
    result.cnc = programs.length > 0 ? `CNC:${programs.join("+")}` : `CNC:${cncCount}`;
  }
  
  return result;
}

/**
 * Render shortcode badges for a part
 */
function OpsShortcodeBadges({ ops }: { ops: PartOps | undefined }) {
  const codes = formatOpsShortcodes(ops);
  
  if (!codes.edging && !codes.grooves && !codes.holes && !codes.cnc) {
    return <span className="text-[var(--muted-foreground)] text-xs">—</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {codes.edging && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-blue-50 text-blue-700 border-blue-200">
          {codes.edging}
        </Badge>
      )}
      {codes.grooves && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-purple-50 text-purple-700 border-purple-200">
          {codes.grooves}
        </Badge>
      )}
      {codes.holes && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-amber-50 text-amber-700 border-amber-200">
          {codes.holes}
        </Badge>
      )}
      {codes.cnc && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-green-50 text-green-700 border-green-200">
          {codes.cnc}
        </Badge>
      )}
    </div>
  );
}

/**
 * Clickable ops indicator that opens the UnifiedOpsPanel
 */
function OpsIndicatorButton({
  ops,
  onClick,
}: {
  ops: PartOps | undefined;
  onClick: () => void;
}) {
  const codes = formatOpsShortcodes(ops);
  const hasAnyOps = codes.edging || codes.grooves || codes.holes || codes.cnc;

  if (!hasAnyOps) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 h-7 px-2 rounded-md border border-dashed",
          "text-xs text-[var(--muted-foreground)] hover:border-[var(--cai-teal)] hover:text-[var(--cai-teal)]",
          "transition-colors"
        )}
      >
        <Pencil className="h-3 w-3" />
        <span>Add ops</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 h-7 px-1.5 rounded-md",
        "bg-[var(--muted)] hover:bg-[var(--cai-teal)]/10 transition-colors"
      )}
    >
      {codes.edging && (
        <Badge className="h-5 px-1 text-[10px] bg-blue-100 text-blue-700 border-0">
          {codes.edging}
        </Badge>
      )}
      {codes.grooves && (
        <Badge className="h-5 px-1 text-[10px] bg-amber-100 text-amber-700 border-0">
          {codes.grooves}
        </Badge>
      )}
      {codes.holes && (
        <Badge className="h-5 px-1 text-[10px] bg-purple-100 text-purple-700 border-0">
          {codes.holes}
        </Badge>
      )}
      {codes.cnc && (
        <Badge className="h-5 px-1 text-[10px] bg-green-100 text-green-700 border-0">
          {codes.cnc}
        </Badge>
      )}
      <Pencil className="h-3 w-3 ml-1 text-[var(--muted-foreground)]" />
    </button>
  );
}

/**
 * Convert PartOps to OperationsData format
 */
function partOpsToOperationsData(ops: PartOps | undefined): OperationsData {
  const edges = ops?.edging?.edges || {};
  const appliedEdges = Object.entries(edges)
    .filter(([, v]) => v?.apply)
    .reduce((acc, [k]) => ({ ...acc, [k]: true }), {} as Record<string, boolean>);
  
  const firstEdgebandId = Object.values(edges).find(e => e?.apply)?.edgeband_id;

  return {
    edgebanding: {
      edgeband_id: firstEdgebandId,
      sides: {
        L1: appliedEdges.L1 || false,
        L2: appliedEdges.L2 || false,
        W1: appliedEdges.W1 || false,
        W2: appliedEdges.W2 || false,
      },
    },
    grooves: (ops?.grooves || []).map((g: GrooveOp) => ({
      type_code: g.notes?.split(":")[1]?.trim() || "GRV",
      width_mm: g.width_mm || 4,
      depth_mm: g.depth_mm || 8,
      side: g.side || "W1",
    })),
    holes: (ops?.holes || []).map((h: HoleOp) => ({
      type_code: h.pattern_id || "S32",
      face: (h.face === "front" ? "F" : "B") as "F" | "B",
    })),
    cnc: (ops?.custom_cnc_ops || []).map((c: CustomCncOp) => ({
      type_code: (c.payload as { program_name?: string } | undefined)?.program_name || c.op_type || "CNC",
    })),
  };
}

/**
 * Convert OperationsData back to PartOps
 */
function operationsDataToPartOps(newData: OperationsData, defaultEdgebandId?: string): PartOps {
  const hasEdging = Object.values(newData.edgebanding.sides).some(Boolean);
  const ebId = newData.edgebanding.edgeband_id || defaultEdgebandId;
  
  return {
    ...(hasEdging && {
      edging: {
        edges: {
          ...(newData.edgebanding.sides.L1 && { L1: { apply: true, edgeband_id: ebId } }),
          ...(newData.edgebanding.sides.L2 && { L2: { apply: true, edgeband_id: ebId } }),
          ...(newData.edgebanding.sides.W1 && { W1: { apply: true, edgeband_id: ebId } }),
          ...(newData.edgebanding.sides.W2 && { W2: { apply: true, edgeband_id: ebId } }),
        },
      },
    }),
    ...(newData.grooves.length > 0 && {
      grooves: newData.grooves.map((g, i) => ({
        groove_id: `GRV-${i}`,
        side: g.side as "L1" | "L2" | "W1" | "W2",
        offset_mm: 10 + i * 32,
        depth_mm: g.depth_mm,
        width_mm: g.width_mm,
        notes: `Type: ${g.type_code}`,
      })),
    }),
    ...(newData.holes.length > 0 && {
      holes: newData.holes.map(h => ({
        pattern_id: h.type_code,
        face: (h.face === "F" ? "front" : "back") as "front" | "back",
        notes: `Pattern: ${h.type_code}`,
      })),
    }),
    ...(newData.cnc.length > 0 && {
      custom_cnc_ops: newData.cnc.map(c => ({
        op_type: "program" as const,
        payload: { program_name: c.type_code },
        notes: `CNC: ${c.type_code}`,
      })),
    }),
  };
}

// ============================================================
// CONFIDENCE BADGE
// ============================================================

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null;

  const percent = Math.round(confidence * 100);

  let variant: "success" | "warning" | "error" = "success";
  let Icon = CheckCircle2;

  if (percent < 70) {
    variant = "error";
    Icon = XCircle;
  } else if (percent < 90) {
    variant = "warning";
    Icon = AlertTriangle;
  }

  return (
    <Badge variant={variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {percent}%
    </Badge>
  );
}

// ============================================================
// PART PREVIEW - Uses enhanced PartPreviewSvg component
// ============================================================

/**
 * Wrapper that creates preview data from part and renders enhanced SVG
 * Shows edgebanding, grooves, holes, and other services
 */
function InboxPartPreview({
  part,
  className,
}: {
  part: ParsedPartWithStatus;
  className?: string;
}) {
  // Convert part ops to preview data
  const previewData: PartPreviewData = React.useMemo(() => {
    // Show grain lines when part cannot rotate (respects material grain)
    const showGrain = part.allow_rotation === false;
    return convertOpsToPreview(
      part.size.L,
      part.size.W,
      showGrain ? "along_L" : "none",
      part.ops
    );
  }, [part.size.L, part.size.W, part.allow_rotation, part.ops]);

  return (
    <PartPreviewSvg
      data={previewData}
      size="sm"
      showTooltips={true}
      showBadges={true}
      className={className}
    />
  );
}

// ============================================================
// EDITABLE CELL
// ============================================================

interface EditableCellProps {
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  min?: number;
  placeholder?: string;
}

function EditableCell({
  value,
  onChange,
  type = "text",
  className,
  isEditing,
  onStartEdit,
  onEndEdit,
  min,
  placeholder,
}: EditableCellProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      onEndEdit();
    } else if (e.key === "Escape") {
      onEndEdit();
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onEndEdit}
        onKeyDown={handleKeyDown}
        min={min}
        placeholder={placeholder}
        className={cn(
          "h-7 px-2 text-sm font-mono",
          type === "number" && "text-right",
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className={cn(
        "px-2 py-1 text-sm font-mono rounded hover:bg-[var(--muted)] transition-colors text-left w-full",
        type === "number" && "text-right",
        className
      )}
    >
      {value || <span className="text-[var(--muted-foreground)]">{placeholder || "—"}</span>}
    </button>
  );
}

// ============================================================
// INBOX PART ROW
// ============================================================

interface InboxPartRowProps {
  part: ParsedPartWithStatus;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (selected: boolean) => void;
  onFocus: () => void;
  onAccept: () => void;
  onReject: () => void;
  onUpdate: (updates: Partial<ParsedPartWithStatus>) => void;
  onDuplicate: () => void;
  onSwapDimensions: () => void;
  onSplitQuantity: () => void;
  onEditOps: () => void;
  materials: { material_id: string; name: string; thickness_mm: number }[];
  rowIndex: number;
}

function InboxPartRow({
  part,
  isSelected,
  isFocused,
  onSelect,
  onFocus,
  onAccept,
  onReject,
  onUpdate,
  onDuplicate,
  onSwapDimensions,
  onSplitQuantity,
  onEditOps,
  materials,
  rowIndex,
}: InboxPartRowProps) {
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const isRejected = part._status === "rejected";

  // Calculate field-level confidence
  const fieldConfidence = React.useMemo(() => calculateFieldConfidence(part), [part]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingField) return; // Don't handle shortcuts while editing
    
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (!isRejected) onAccept();
        break;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        if (!isRejected) onReject();
        break;
      case " ":
        e.preventDefault();
        onSelect(!isSelected);
        break;
      case "e":
        e.preventDefault();
        setEditingField("label");
        break;
      case "s":
        e.preventDefault();
        onSwapDimensions();
        break;
      case "d":
        e.preventDefault();
        onDuplicate();
        break;
    }
  };

  return (
    <tr
      data-row-index={rowIndex}
      className={cn(
        "group transition-colors",
        isRejected && "opacity-50 bg-red-50/50",
        isSelected && !isRejected && "bg-[var(--cai-teal)]/5",
        isFocused && "ring-2 ring-inset ring-[var(--cai-teal)]"
      )}
      onClick={onFocus}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Checkbox */}
      <td className="w-8 sm:w-10 px-1 sm:px-2 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(!isSelected);
          }}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            isSelected
              ? "bg-[var(--cai-teal)] border-[var(--cai-teal)]"
              : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </button>
      </td>

      {/* Row number - hidden on mobile */}
      <td className="hidden sm:table-cell w-8 px-1 py-2 text-center text-xs text-[var(--muted-foreground)]">
        {rowIndex + 1}
      </td>

      {/* Preview - hidden on small/medium screens */}
      <td className="hidden md:table-cell w-[60px] px-1 py-2">
        <InboxPartPreview part={part} />
      </td>

      {/* Label */}
      <td className="px-1 sm:px-2 py-2 min-w-[80px] sm:min-w-[100px]">
        <EditableCell
          value={part.label || ""}
          onChange={(v) => onUpdate({ label: v || undefined })}
          isEditing={editingField === "label"}
          onStartEdit={() => setEditingField("label")}
          onEndEdit={() => setEditingField(null)}
          placeholder="Part name"
          className="w-full max-w-[100px] sm:max-w-[120px]"
        />
        {part._originalText && (
          <div className="hidden sm:block mt-0.5 px-2">
            <p className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[120px]">
              {part._originalText}
            </p>
            <CorrectionDiff part={part} compact />
          </div>
        )}
      </td>

      {/* Dimensions L */}
      <td className="px-1 py-2 w-[55px] sm:w-[65px]">
        <EditableCell
          value={part.size.L}
          onChange={(v) => onUpdate({ size: { ...part.size, L: parseFloat(v) || 0 } })}
          type="number"
          isEditing={editingField === "L"}
          onStartEdit={() => setEditingField("L")}
          onEndEdit={() => setEditingField(null)}
          min={1}
          className="w-[50px] sm:w-[55px]"
        />
      </td>

      {/* Swap button */}
      <td className="w-5 sm:w-6 px-0 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwapDimensions();
          }}
          className="p-0.5 sm:p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Swap L ↔ W"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
      </td>

      {/* Dimensions W */}
      <td className="px-1 py-2 w-[55px] sm:w-[65px]">
        <EditableCell
          value={part.size.W}
          onChange={(v) => onUpdate({ size: { ...part.size, W: parseFloat(v) || 0 } })}
          type="number"
          isEditing={editingField === "W"}
          onStartEdit={() => setEditingField("W")}
          onEndEdit={() => setEditingField(null)}
          min={1}
          className="w-[50px] sm:w-[55px]"
        />
      </td>

      {/* Quantity */}
      <td className="px-1 py-2 w-[45px] sm:w-[55px]">
        <div className="flex items-center gap-0.5">
          <EditableCell
            value={part.qty}
            onChange={(v) => onUpdate({ qty: parseInt(v) || 1 })}
            type="number"
            isEditing={editingField === "qty"}
            onStartEdit={() => setEditingField("qty")}
            onEndEdit={() => setEditingField(null)}
            min={1}
            className="w-[35px] sm:w-[40px]"
          />
          {part.qty > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSplitQuantity();
              }}
              className="hidden sm:block p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="Split into separate parts"
            >
              <Layers className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>

      {/* Material */}
      <td className="px-1 sm:px-2 py-2 min-w-[80px] sm:min-w-[100px]">
        <Select
          value={part.material_id}
          onValueChange={(v) => onUpdate({ material_id: v })}
        >
          <SelectTrigger className="h-7 text-xs w-full max-w-[80px] sm:max-w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {materials.map((m) => (
              <SelectItem key={m.material_id} value={m.material_id}>
                {m.name} ({m.thickness_mm}mm)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Rotation Toggle */}
      <td className="px-1 py-2 text-center w-[40px] sm:w-[50px]">
        <button
          type="button"
          onClick={() => onUpdate({ allow_rotation: !part.allow_rotation })}
          className={cn(
            "w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors",
            part.allow_rotation !== false
              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
          )}
          title={part.allow_rotation !== false ? "Can rotate (click to lock)" : "Locked to grain (click to unlock)"}
        >
          {part.allow_rotation !== false ? "✓" : "⊘"}
        </button>
      </td>

      {/* Operations - Click to edit */}
      <td className="px-1 sm:px-2 py-2 min-w-[80px] sm:min-w-[100px]" onClick={(e) => e.stopPropagation()}>
        <OpsIndicatorButton
          ops={part.ops}
          onClick={onEditOps}
        />
      </td>

      {/* Confidence - hidden on small screens */}
      <td className="hidden lg:table-cell px-2 py-2 text-center w-[80px]">
        <div className="flex flex-col items-center gap-1">
          <ConfidenceBadge confidence={part.audit?.confidence} />
          <ConfidenceSummary fieldConfidence={fieldConfidence} compact />
        </div>
      </td>

      {/* Actions */}
      <td className="px-1 sm:px-2 py-2 w-[80px] sm:w-[100px]">
        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
          {!isRejected ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept();
                }}
                title="Accept"
              >
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                title="Reject"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7">
                    <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSwapDimensions}>
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Swap L ↔ W
                  </DropdownMenuItem>
                  {part.qty > 1 && (
                    <DropdownMenuItem onClick={onSplitQuantity}>
                      <Layers className="h-4 w-4 mr-2" />
                      Split quantity
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onReject} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 sm:h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ _status: "pending" });
              }}
              title="Restore to pending"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Restore</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// MASS EDIT TOOLBAR
// ============================================================

interface MassEditToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onAcceptSelected: () => void;
  onRejectSelected: () => void;
  onSetMaterial: (materialId: string) => void;
  onSetThickness: (thickness: number) => void;
  onMultiplyQty: (multiplier: number) => void;
  onSetEdging: (edges: ("L1" | "L2" | "W1" | "W2")[]) => void;
  onClearEdging: () => void;
  onAddGroove: (side: "L1" | "L2" | "W1" | "W2") => void;
  onClearGrooves: () => void;
  onSetHolePattern: (pattern: string) => void;
  onClearHoles: () => void;
  onSetCncProgram: (program: string) => void;
  onClearCnc: () => void;
  onToggleRotation: (allow: boolean) => void;
  materials: { material_id: string; name: string; thickness_mm: number }[];
  capabilities: {
    edging?: boolean;
    grooves?: boolean;
    cnc_holes?: boolean;
    cnc_routing?: boolean;
    custom_cnc?: boolean;
  };
}

function MassEditToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
  onAcceptSelected,
  onRejectSelected,
  onSetMaterial,
  onSetThickness,
  onMultiplyQty,
  onSetEdging,
  onClearEdging,
  onAddGroove,
  onClearGrooves,
  onSetHolePattern,
  onClearHoles,
  onSetCncProgram,
  onClearCnc,
  onToggleRotation,
  materials,
  capabilities,
}: MassEditToolbarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;
  
  const hasOpsEnabled = capabilities.edging || capabilities.grooves || capabilities.cnc_holes || capabilities.cnc_routing || capabilities.custom_cnc;

  return (
    <div className="flex flex-col border-b border-[var(--border)]">
      {/* Main toolbar row */}
      <div className="flex items-center gap-3 p-3 bg-[var(--muted)]">
        {/* Selection controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected || someSelected ? onSelectNone : onSelectAll}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
              allSelected
                ? "bg-[var(--cai-teal)] border-[var(--cai-teal)]"
                : someSelected
                ? "bg-[var(--cai-teal)]/50 border-[var(--cai-teal)]"
                : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
            )}
          >
            {allSelected && <Check className="w-3 h-3 text-white" />}
            {someSelected && <div className="w-2 h-0.5 bg-white" />}
          </button>
          <span className="text-sm text-[var(--muted-foreground)]">
            {selectedCount > 0 ? (
              <>{selectedCount} of {totalCount} selected</>
            ) : (
              <>{totalCount} parts</>
            )}
          </span>
        </div>

        {selectedCount > 0 && (
          <>
            <div className="w-px h-6 bg-[var(--border)]" />

            {/* Quick actions */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={onAcceptSelected}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept {selectedCount} parts</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={onRejectSelected}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject {selectedCount} parts</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="w-px h-6 bg-[var(--border)]" />

            {/* Basic mass edit controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--muted-foreground)]">Set:</span>

              {/* Material */}
              <Select onValueChange={onSetMaterial}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Material..." />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.material_id} value={m.material_id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Thickness */}
              <Select onValueChange={(v) => onSetThickness(parseFloat(v))}>
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue placeholder="T..." />
                </SelectTrigger>
                <SelectContent>
                  {[12, 15, 16, 18, 19, 22, 25].map((t) => (
                    <SelectItem key={t} value={t.toString()}>
                      {t}mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Qty multiplier */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Qty ×
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onMultiplyQty(2)}>× 2</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMultiplyQty(3)}>× 3</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMultiplyQty(4)}>× 4</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onMultiplyQty(0.5)}>÷ 2 (halve)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Rotation toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Rotation
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onToggleRotation(true)}>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Allow rotation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleRotation(false)}>
                    <X className="h-4 w-4 mr-2 text-red-600" />
                    Lock rotation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      
      {/* Operations toolbar row - only shown when parts selected and ops enabled */}
      {selectedCount > 0 && hasOpsEnabled && (
        <div className="flex items-center gap-3 px-3 py-2 bg-[var(--muted)]/50 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--muted-foreground)]">Operations:</span>
          
          {/* Edgebanding */}
          {capabilities.edging && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Layers className="h-3 w-3 mr-1" />
                  Edging
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onSetEdging(["L1", "L2", "W1", "W2"])}>
                  All edges (L1, L2, W1, W2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetEdging(["L1", "L2"])}>
                  Long edges only (L1, L2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetEdging(["W1", "W2"])}>
                  Short edges only (W1, W2)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetEdging(["L1"])}>L1 only</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetEdging(["L2"])}>L2 only</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetEdging(["W1"])}>W1 only</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetEdging(["W2"])}>W2 only</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearEdging} className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Clear all edging
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Grooves */}
          {capabilities.grooves && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50">
                  <Layers className="h-3 w-3 mr-1" />
                  Groove
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onAddGroove("L1")}>Add groove on L1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddGroove("L2")}>Add groove on L2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddGroove("W1")}>Add groove on W1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddGroove("W2")}>Add groove on W2 (back panel)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearGrooves} className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Clear all grooves
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Holes */}
          {capabilities.cnc_holes && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-50">
                  <Layers className="h-3 w-3 mr-1" />
                  Holes
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onSetHolePattern("32mm system")}>32mm system holes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetHolePattern("shelf pins")}>Shelf pin holes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetHolePattern("hinge cups")}>Hinge cup holes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetHolePattern("drawer slides")}>Drawer slide holes</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearHoles} className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Clear all holes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* CNC Programs */}
          {(capabilities.cnc_routing || capabilities.custom_cnc) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <Wand2 className="h-3 w-3 mr-1" />
                  CNC
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onSetCncProgram("DOOR-STD")}>Door standard profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetCncProgram("DRAWER-FRONT")}>Drawer front profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetCncProgram("SHELF-PROFILE")}>Shelf edge profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetCncProgram("POCKET-HINGE")}>Hinge pocket</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearCnc} className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Clear CNC operations
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// KEYBOARD SHORTCUTS HELP
// ============================================================

function KeyboardHelp() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--muted-foreground)]">
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">↑↓</kbd> Navigate</span>
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">Space</kbd> Select</span>
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">Enter</kbd> Accept</span>
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">Del</kbd> Reject</span>
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">S</kbd> Swap L↔W</span>
      <span><kbd className="px-1 py-0.5 bg-[var(--muted)] rounded text-[9px]">D</kbd> Duplicate</span>
      <span className="border-l border-[var(--border)] pl-4"><kbd className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">E</kbd> Edging</span>
      <span><kbd className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">G</kbd> Groove</span>
      <span><kbd className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">M</kbd> Material</span>
      <span><kbd className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">H</kbd> Holes</span>
    </div>
  );
}

// ============================================================
// FILTER BAR
// ============================================================

type FilterStatus = "all" | "pending" | "rejected" | "low-confidence";

interface FilterBarProps {
  filter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  counts: { all: number; pending: number; rejected: number; lowConfidence: number };
}

function FilterBar({ filter, onFilterChange, counts }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1">
      <Filter className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
      <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg p-0.5">
        {[
          { id: "all" as const, label: "All", count: counts.all },
          { id: "pending" as const, label: "Pending", count: counts.pending },
          { id: "rejected" as const, label: "Rejected", count: counts.rejected },
          { id: "low-confidence" as const, label: "Low conf.", count: counts.lowConfidence },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "px-2 py-1 text-xs rounded-md transition-colors",
              filter === f.id
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                "ml-1 tabular-nums",
                filter === f.id ? "text-[var(--cai-teal)]" : "opacity-60"
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN INTAKE INBOX COMPONENT
// ============================================================

export function IntakeInbox() {
  const {
    inboxParts,
    currentCutlist,
    acceptInboxPart,
    acceptAllInboxParts,
    rejectInboxPart,
    clearInbox,
    updateInboxPart,
    addToInbox,
    sourceFilePreviews,
  } = useIntakeStore();

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = React.useState<number>(0);
  const [filter, setFilter] = React.useState<FilterStatus>("all");
  const [quickOpsType, setQuickOpsType] = React.useState<QuickOpsType>(null);
  const [dismissedDuplicateGroups, setDismissedDuplicateGroups] = React.useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = React.useState(false);
  const [opsEditingPart, setOpsEditingPart] = React.useState<ParsedPartWithStatus | null>(null);
  
  const materials = currentCutlist.materials;
  const defaultEdgebandId = currentCutlist.edgebands?.[0]?.edgeband_id;
  
  // Check if we have source files to compare against
  const hasSourceFiles = sourceFilePreviews.length > 0;
  
  // Handle ops change from UnifiedOpsPanel
  const handleOpsChange = React.useCallback((newOpsData: OperationsData) => {
    if (!opsEditingPart) return;
    const newOps = operationsDataToPartOps(newOpsData, defaultEdgebandId);
    updatePartWithCorrection(opsEditingPart.part_id, { 
      ops: Object.keys(newOps).length > 0 ? newOps : undefined 
    });
    // Update the editing part state to reflect changes
    setOpsEditingPart(prev => prev ? { ...prev, ops: Object.keys(newOps).length > 0 ? newOps : undefined } : null);
  }, [opsEditingPart, defaultEdgebandId, updatePartWithCorrection]);

  // Filter counts
  const counts = React.useMemo(() => ({
    all: inboxParts.length,
    pending: inboxParts.filter((p) => p._status !== "rejected").length,
    rejected: inboxParts.filter((p) => p._status === "rejected").length,
    lowConfidence: inboxParts.filter((p) => (p.audit?.confidence ?? 1) < 0.7).length,
  }), [inboxParts]);

  // Filtered parts
  const filteredParts = React.useMemo(() => {
    switch (filter) {
      case "pending":
        return inboxParts.filter((p) => p._status !== "rejected");
      case "rejected":
        return inboxParts.filter((p) => p._status === "rejected");
      case "low-confidence":
        return inboxParts.filter((p) => (p.audit?.confidence ?? 1) < 0.7);
      default:
        return inboxParts;
    }
  }, [inboxParts, filter]);

  // ============================================================
  // LEARNING CORRECTION TRACKING
  // ============================================================
  
  /**
   * Wrapper around updateInboxPart that records corrections for learning
   */
  const updatePartWithCorrection = React.useCallback(
    (partId: string, updates: Partial<CutPart>) => {
      const originalPart = inboxParts.find((p) => p.part_id === partId);
      if (!originalPart) return;

      // Update the part first
      updateInboxPart(partId, updates);

      // Create the corrected part for comparison
      const correctedPart: CutPart = {
        ...originalPart,
        ...updates,
      };

      // Detect what corrections were made
      const corrections = detectCorrections(
        originalPart,
        correctedPart,
        originalPart._originalText
      );

      // Record each correction (async, non-blocking learning feature)
      if (corrections.length > 0) {
        for (const correction of corrections) {
          // Fire-and-forget: corrections are for learning and don't affect user workflow
          recordCorrection({
            ...correction,
            cutlistId: currentCutlist.doc_id,
          });
        }
      }
    },
    [inboxParts, updateInboxPart, currentCutlist]
  );

  // Keyboard navigation for the table
  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    const maxIndex = filteredParts.length - 1;
    const hasSelection = selectedIds.size > 0;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, maxIndex));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "a":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setSelectedIds(new Set(filteredParts.map((p) => p.part_id)));
        }
        break;
      // Quick ops shortcuts (only when parts are selected and not in input)
      case "e":
      case "E":
        if (hasSelection && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setQuickOpsType("edging");
        }
        break;
      case "g":
      case "G":
        if (hasSelection && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setQuickOpsType("groove");
        }
        break;
      case "m":
      case "M":
        if (hasSelection && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setQuickOpsType("material");
        }
        break;
      case "h":
      case "H":
        if (hasSelection && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setQuickOpsType("holes");
        }
        break;
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredParts.filter((p) => p._status !== "rejected").map((p) => p.part_id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (partId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(partId);
      } else {
        next.delete(partId);
      }
      return next;
    });
  };

  // Bulk actions
  const handleAcceptSelected = () => {
    selectedIds.forEach((id) => acceptInboxPart(id));
    setSelectedIds(new Set());
  };

  const handleRejectSelected = () => {
    selectedIds.forEach((id) => rejectInboxPart(id));
    setSelectedIds(new Set());
  };

  const handleSetMaterialSelected = (materialId: string) => {
    selectedIds.forEach((id) => updatePartWithCorrection(id, { material_id: materialId }));
  };

  const handleSetThicknessSelected = (thickness: number) => {
    selectedIds.forEach((id) => updatePartWithCorrection(id, { thickness_mm: thickness }));
  };

  const handleMultiplyQtySelected = (multiplier: number) => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        updatePartWithCorrection(id, { qty: Math.max(1, Math.round(part.qty * multiplier)) });
      }
    });
  };

  const handleToggleRotationSelected = (allow: boolean) => {
    selectedIds.forEach((id) => {
      updatePartWithCorrection(id, { 
        allow_rotation: allow,
        // grain is deprecated - parts inherit grain from material
      });
    });
  };

  // Edgebanding mass operations
  const handleSetEdgingSelected = (edges: ("L1" | "L2" | "W1" | "W2")[]) => {
    const defaultEdgebandId = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const edgingConfig = edges.reduce((acc, edge) => {
          acc[edge] = { apply: true, edgeband_id: defaultEdgebandId };
          return acc;
        }, {} as Record<string, { apply: boolean; edgeband_id?: string }>);
        
        updatePartWithCorrection(id, {
          ops: {
            ...part.ops,
            edging: { edges: edgingConfig },
          },
        });
      }
    });
  };

  const handleClearEdgingSelected = () => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const { edging, ...restOps } = part.ops || {};
        updatePartWithCorrection(id, {
          ops: Object.keys(restOps).length > 0 ? restOps : undefined,
        });
      }
    });
  };

  // Groove mass operations
  const handleAddGrooveSelected = (side: "L1" | "L2" | "W1" | "W2") => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const existingGrooves = part.ops?.grooves || [];
        const newGroove = {
          groove_id: generateId("GRV"),
          side,
          offset_mm: 10,
          depth_mm: 8,
          width_mm: 4,
        };
        
        updatePartWithCorrection(id, {
          ops: {
            ...part.ops,
            grooves: [...existingGrooves, newGroove],
          },
        });
      }
    });
  };

  const handleClearGroovesSelected = () => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const { grooves, ...restOps } = part.ops || {};
        updatePartWithCorrection(id, {
          ops: Object.keys(restOps).length > 0 ? restOps : undefined,
        });
      }
    });
  };

  // Holes mass operations
  const handleSetHolePatternSelected = (pattern: string) => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const holeOp = {
          pattern_id: pattern.includes("32") ? "SYS32" : undefined,
          face: "front" as const,
          notes: pattern,
        };
        
        updatePartWithCorrection(id, {
          ops: {
            ...part.ops,
            holes: [holeOp],
          },
        });
      }
    });
  };

  const handleClearHolesSelected = () => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const { holes, ...restOps } = part.ops || {};
        updatePartWithCorrection(id, {
          ops: Object.keys(restOps).length > 0 ? restOps : undefined,
        });
      }
    });
  };

  // CNC mass operations
  const handleSetCncProgramSelected = (program: string) => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const cncOp = {
          op_type: "program",
          payload: { program_name: program },
          notes: `CNC: ${program}`,
        };
        
        updatePartWithCorrection(id, {
          ops: {
            ...part.ops,
            custom_cnc_ops: [cncOp],
          },
        });
      }
    });
  };

  const handleClearCncSelected = () => {
    selectedIds.forEach((id) => {
      const part = inboxParts.find((p) => p.part_id === id);
      if (part) {
        const { custom_cnc_ops, routing, ...restOps } = part.ops || {};
        updatePartWithCorrection(id, {
          ops: Object.keys(restOps).length > 0 ? restOps : undefined,
        });
      }
    });
  };

  // Part actions
  const handleDuplicate = (part: ParsedPartWithStatus) => {
    const newPart: ParsedPartWithStatus = {
      ...part,
      part_id: generateId("P"),
      label: part.label ? `${part.label} (copy)` : undefined,
      _status: "pending",
    };
    addToInbox([newPart]);
  };

  const handleSwapDimensions = (partId: string) => {
    const part = inboxParts.find((p) => p.part_id === partId);
    if (part) {
      updatePartWithCorrection(partId, {
        size: { L: part.size.W, W: part.size.L },
      });
    }
  };

  const handleSplitQuantity = (part: ParsedPartWithStatus) => {
    if (part.qty <= 1) return;
    
    // Create qty-1 copies with qty=1
    const newParts: ParsedPartWithStatus[] = [];
    for (let i = 1; i < part.qty; i++) {
      newParts.push({
        ...part,
        part_id: generateId("P"),
        qty: 1,
        _status: "pending",
      });
    }
    
    // Update original to qty=1 (this is more of a split, not a correction, so use regular update)
    updateInboxPart(part.part_id, { qty: 1 });
    
    // Add the new parts
    addToInbox(newParts);
  };

  // Merge duplicate parts
  const handleMergeDuplicates = (partIds: string[], intoPartId: string, newQty: number) => {
    // Update the target part with combined quantity
    updateInboxPart(intoPartId, { qty: newQty });
    
    // Reject the other parts (remove from inbox)
    partIds.forEach(id => {
      if (id !== intoPartId) {
        rejectInboxPart(id);
      }
    });
  };

  // Dismiss a duplicate group
  const handleDismissDuplicateGroup = (key: string) => {
    setDismissedDuplicateGroups(prev => new Set([...prev, key]));
  };

  // Empty state
  if (inboxParts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-1">Intake Inbox Empty</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Parse text, import files, or dictate parts to add them here for
              review before adding to your cutlist.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = counts.pending;
  const selectedCount = selectedIds.size;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3 border-b border-[var(--border)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Inbox className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Intake Inbox</span>
              <span className="sm:hidden">Inbox</span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{pendingCount} pending</Badge>
            {counts.rejected > 0 && (
              <Badge variant="error" className="text-xs">{counts.rejected} rej.</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Compare Mode Toggle - only show if we have source files */}
            {hasSourceFiles && (
              <>
                <Button
                  variant={compareMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCompareMode(!compareMode)}
                  title="Toggle Compare Mode to view source files alongside parts"
                  className={cn(
                    "h-8 px-2 gap-1",
                    compareMode && "bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
                  )}
                >
                  <SplitSquareVertical className="h-4 w-4" />
                  <span className="hidden md:inline">Compare</span>
                </Button>
                <div className="hidden sm:block w-px h-6 bg-[var(--border)]" />
              </>
            )}
            <div className="hidden sm:block">
              <FilterBar filter={filter} onFilterChange={setFilter} counts={counts} />
            </div>
            <div className="hidden sm:block w-px h-6 bg-[var(--border)]" />
            <Button variant="ghost" size="sm" onClick={clearInbox} className="h-8 px-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={acceptAllInboxParts}
              disabled={pendingCount === 0}
              className="h-8 px-2 sm:px-3"
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Accept All ({pendingCount})</span>
              <span className="sm:hidden ml-1">All</span>
            </Button>
          </div>
        </div>
        {/* Mobile filter bar */}
        <div className="sm:hidden mt-2">
          <FilterBar filter={filter} onFilterChange={setFilter} counts={counts} />
        </div>
      </CardHeader>

      {/* Main Content - Split View when in Compare Mode */}
      <div className={cn(
        "flex",
        compareMode ? "flex-col lg:flex-row h-[700px] lg:h-[650px]" : "flex-col"
      )}>
        {/* Source Files Panel (Compare Mode) - Fixed height, independent scroll */}
        {compareMode && hasSourceFiles && (
          <div className="lg:w-1/2 h-[350px] lg:h-full border-b lg:border-b-0 lg:border-r border-[var(--border)] flex-shrink-0 overflow-hidden">
            <SourceFilesPanel
              files={sourceFilePreviews.map((f): SourceFile => ({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType,
                size: f.size,
                url: f.objectUrl || f.serverUrl,
              }))}
              compact={false}
              showThumbnails={true}
            />
          </div>
        )}

        {/* Parts Content - Fixed height in compare mode, independent scroll */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0", 
          compareMode && "lg:w-1/2 h-[350px] lg:h-full overflow-hidden"
        )}>
          {/* Mass edit toolbar */}
          <MassEditToolbar
            selectedCount={selectedCount}
            totalCount={filteredParts.filter((p) => p._status !== "rejected").length}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
            onAcceptSelected={handleAcceptSelected}
            onRejectSelected={handleRejectSelected}
            onSetMaterial={handleSetMaterialSelected}
            onSetThickness={handleSetThicknessSelected}
            onMultiplyQty={handleMultiplyQtySelected}
            onSetEdging={handleSetEdgingSelected}
            onClearEdging={handleClearEdgingSelected}
            onAddGroove={handleAddGrooveSelected}
            onClearGrooves={handleClearGroovesSelected}
            onSetHolePattern={handleSetHolePatternSelected}
            onClearHoles={handleClearHolesSelected}
            onSetCncProgram={handleSetCncProgramSelected}
            onClearCnc={handleClearCncSelected}
            onToggleRotation={handleToggleRotationSelected}
            materials={materials}
            capabilities={currentCutlist.capabilities}
          />

          {/* Validation Panel - collapsed in compare mode */}
          {!compareMode && (
            <ValidationPanel
              parts={filteredParts}
              onSwapDimensions={handleSwapDimensions}
              onScrollToRow={(index) => {
                setFocusedIndex(index);
                const row = document.querySelector(`[data-row-index="${index}"]`);
                row?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onSetMaterial={(partId, materialId) => updatePartWithCorrection(partId, { material_id: materialId })}
              defaultMaterialId={materials[0]?.material_id || "MAT-WHITE-18"}
            />
          )}

          {/* Duplicate Detection - collapsed in compare mode */}
          {!compareMode && (
            <DuplicateDetector
              parts={filteredParts}
              onMerge={handleMergeDuplicates}
              onScrollToRow={(index) => {
                setFocusedIndex(index);
                const row = document.querySelector(`[data-row-index="${index}"]`);
                row?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onDismissGroup={handleDismissDuplicateGroup}
              dismissedGroups={dismissedDuplicateGroups}
            />
          )}

          {/* Table - scrolls independently in compare mode */}
          <div className={cn(
            "overflow-x-auto flex-1 min-h-0",
            compareMode && "overflow-y-auto"
          )} onKeyDown={handleTableKeyDown}>
            <table className="w-full min-w-[600px]">
              <thead className="bg-[var(--muted)]/50 border-b border-[var(--border)] sticky top-0 z-10">
                <tr>
                  <th className="w-8 sm:w-10 px-1 sm:px-2 py-2"></th>
                  <th className="hidden sm:table-cell w-8 px-1 py-2 text-center text-xs font-medium text-[var(--muted-foreground)]">#</th>
                  <th className="hidden md:table-cell w-[60px] px-1 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">Preview</th>
                  <th className="px-1 sm:px-2 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">Label</th>
                  <th className="w-[55px] sm:w-[65px] px-1 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">L</th>
                  <th className="w-5 sm:w-6"></th>
                  <th className="w-[55px] sm:w-[65px] px-1 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">W</th>
                  <th className="w-[45px] sm:w-[55px] px-1 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">Qty</th>
                  <th className="px-1 sm:px-2 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]"><span className="hidden sm:inline">Material</span><span className="sm:hidden">Mat</span></th>
                  <th className="w-[40px] sm:w-[50px] px-1 py-2 text-center text-xs font-medium text-[var(--muted-foreground)]" title="Can Rotate">Rot</th>
                  <th className="min-w-[80px] sm:min-w-[100px] px-1 sm:px-2 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">Ops</th>
                  <th className="hidden lg:table-cell w-[80px] px-2 py-2 text-center text-xs font-medium text-[var(--muted-foreground)]">Conf.</th>
                  <th className="w-[80px] sm:w-[100px] px-1 sm:px-2 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredParts.map((part, index) => (
                  <InboxPartRow
                    key={part.part_id}
                    part={part}
                    isSelected={selectedIds.has(part.part_id)}
                    isFocused={focusedIndex === index}
                    onSelect={(selected) => handleToggleSelect(part.part_id, selected)}
                    onFocus={() => setFocusedIndex(index)}
                    onAccept={() => acceptInboxPart(part.part_id)}
                    onReject={() => rejectInboxPart(part.part_id)}
                    onUpdate={(updates) => updatePartWithCorrection(part.part_id, updates)}
                    onDuplicate={() => handleDuplicate(part)}
                    onSwapDimensions={() => handleSwapDimensions(part.part_id)}
                    onSplitQuantity={() => handleSplitQuantity(part)}
                    onEditOps={() => setOpsEditingPart(part)}
                    materials={materials}
                    rowIndex={index}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with keyboard shortcuts - hidden on mobile */}
          <div className="hidden sm:block px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/30 flex-shrink-0">
            <KeyboardHelp />
          </div>
        </div>
      </div>

      {/* Quick Ops Popover (E/G/M/H keys) */}
      {quickOpsType && (
        <QuickOpsPopover
          type={quickOpsType}
          onClose={() => setQuickOpsType(null)}
          onSelectEdging={handleSetEdgingSelected}
          onSelectGroove={handleAddGrooveSelected}
          onSelectMaterial={handleSetMaterialSelected}
          onSelectHolePattern={handleSetHolePatternSelected}
          materials={materials}
          selectedCount={selectedIds.size}
        />
      )}

      {/* Unified Operations Panel (single part editing) */}
      <UnifiedOpsPanel
        open={!!opsEditingPart}
        onOpenChange={(open) => !open && setOpsEditingPart(null)}
        value={opsEditingPart ? partOpsToOperationsData(opsEditingPart.ops) : { edgebanding: { sides: {} }, grooves: [], holes: [], cnc: [] }}
        onChange={handleOpsChange}
        partLabel={opsEditingPart?.label || opsEditingPart?.part_id}
      />
    </Card>
  );
}
