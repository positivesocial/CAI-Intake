"use client";

/**
 * CAI Intake - Streamlined Parts Table
 * 
 * A mobile-first, decluttered parts list for the review step.
 * Features:
 * - Responsive: Cards on mobile, compact table on desktop
 * - 6 essential columns (Label, L×W, Qty, Material, Ops, Actions)
 * - Unified operations panel for editing
 * - Bulk selection and actions
 * - Undo/Redo support
 */

import * as React from "react";
import {
  Trash2,
  ArrowUpDown,
  Layers,
  RotateCcw,
  Lock,
  Copy,
  Settings2,
  LayoutGrid,
  LayoutList,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ChevronDown,
  Check,
  Package,
  FolderOpen,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useIntakeStore } from "@/lib/store";
import type { CutPart } from "@/lib/schema";
import { cn, generateId } from "@/lib/utils";
import { UnifiedOpsPanel } from "./UnifiedOpsPanel";
import { BulkOpsPanel } from "./BulkOpsPanel";
import type { OperationsData } from "@/components/operations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// HELPERS
// ============================================================

function partToOpsData(part: CutPart): OperationsData {
  const ebSides = {
    L1: !!part.ops?.edging?.edges?.L1?.apply,
    L2: !!part.ops?.edging?.edges?.L2?.apply,
    W1: !!part.ops?.edging?.edges?.W1?.apply,
    W2: !!part.ops?.edging?.edges?.W2?.apply,
  };
  const ebId = part.ops?.edging?.edges?.L1?.edgeband_id || "";

  return {
    edgebanding: { edgeband_id: ebId || undefined, sides: ebSides },
    grooves: part.ops?.grooves?.map(g => ({
      type_code: g.groove_id?.substring(0, 4) || "GRV",
      width_mm: g.width_mm || 4,
      depth_mm: g.depth_mm || 8,
      side: g.side || "W1",
    })) || [],
    holes: part.ops?.holes?.map(h => ({
      type_code: h.pattern_id || "S32",
      face: (h.face === "front" ? "F" : "B") as "F" | "B",
    })) || [],
    cnc: part.ops?.custom_cnc_ops?.map(c => ({
      type_code: (c.payload as { program_name?: string } | undefined)?.program_name || c.op_type || "CNC",
    })) || [],
  };
}

function opsDataToPartOps(ops: OperationsData, defaultEdgeband: string) {
  const hasEdging = Object.values(ops.edgebanding.sides).some(Boolean);
  
  return {
    ...(hasEdging && {
      edging: {
        edges: {
          ...(ops.edgebanding.sides.L1 && { L1: { apply: true, edgeband_id: ops.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(ops.edgebanding.sides.L2 && { L2: { apply: true, edgeband_id: ops.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(ops.edgebanding.sides.W1 && { W1: { apply: true, edgeband_id: ops.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(ops.edgebanding.sides.W2 && { W2: { apply: true, edgeband_id: ops.edgebanding.edgeband_id || defaultEdgeband } }),
        },
      },
    }),
    ...(ops.grooves.length > 0 && {
      grooves: ops.grooves.map((g, i) => ({
        groove_id: `GRV-${i}`,
        side: g.side as "L1" | "L2" | "W1" | "W2",
        offset_mm: 10 + i * 32,
        depth_mm: g.depth_mm,
        width_mm: g.width_mm,
      })),
    }),
    ...(ops.holes.length > 0 && {
      holes: ops.holes.map(h => ({
        pattern_id: h.type_code,
        face: (h.face === "F" ? "front" : "back") as "front" | "back",
      })),
    }),
    ...(ops.cnc.length > 0 && {
      custom_cnc_ops: ops.cnc.map(c => ({
        op_type: "program" as const,
        payload: { program_name: c.type_code },
      })),
    }),
  };
}

// ============================================================
// OPS INDICATOR
// ============================================================

function OpsIndicator({
  part,
  onClick,
}: {
  part: CutPart;
  onClick: () => void;
}) {
  const ops = partToOpsData(part);
  const edgingSideCount = Object.values(ops.edgebanding.sides).filter(Boolean).length;
  const grooveCount = ops.grooves.length;
  const holeCount = ops.holes.length;
  const cncCount = ops.cnc.length;
  const totalOps = edgingSideCount + grooveCount + holeCount + cncCount;

  if (totalOps === 0) {
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
        <Settings2 className="h-3 w-3" />
        <span className="hidden sm:inline">—</span>
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
      {edgingSideCount > 0 && (
        <Badge className="h-5 px-1 text-[10px] bg-blue-100 text-blue-700 border-0">
          {edgingSideCount === 4 ? "4E" : `${edgingSideCount}E`}
        </Badge>
      )}
      {grooveCount > 0 && (
        <Badge className="h-5 px-1 text-[10px] bg-amber-100 text-amber-700 border-0">
          {grooveCount}G
        </Badge>
      )}
      {holeCount > 0 && (
        <Badge className="h-5 px-1 text-[10px] bg-purple-100 text-purple-700 border-0">
          {holeCount}H
        </Badge>
      )}
      {cncCount > 0 && (
        <Badge className="h-5 px-1 text-[10px] bg-emerald-100 text-emerald-700 border-0">
          {cncCount}C
        </Badge>
      )}
    </button>
  );
}

// ============================================================
// PART ROW (Table mode)
// ============================================================

interface PartRowProps {
  part: CutPart;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onEditOps: () => void;
  onUpdate: (updates: Partial<CutPart>) => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSwapDimensions: () => void;
  materials: Array<{ value: string; label: string }>;
}

function PartRow({
  part,
  isSelected,
  onSelect,
  onToggle,
  onEditOps,
  onUpdate,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onDelete,
  onSwapDimensions,
  materials,
}: PartRowProps) {
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      setEditingField(null);
    } else if (e.key === "Escape") {
      setEditingField(null);
    }
  };

  return (
    <tr
      onClick={onSelect}
      className={cn(
        "group cursor-pointer transition-colors",
        isSelected && "bg-[var(--cai-teal)]/10 hover:bg-[var(--cai-teal)]/15",
        !isSelected && "hover:bg-[var(--muted)]/50"
      )}
    >
      {/* Checkbox - clicking toggles selection */}
      <td className="w-8 sm:w-10 px-1 sm:px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onToggle}
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

      {/* Label - editable */}
      <td className="px-1 sm:px-2 py-2" onClick={(e) => e.stopPropagation()}>
        {editingField === "label" ? (
          <Input
            ref={inputRef}
            type="text"
            value={part.label || ""}
            onChange={(e) => onUpdate({ label: e.target.value || undefined })}
            onBlur={() => setEditingField(null)}
            onKeyDown={handleKeyDown}
            className="h-7 px-2 text-sm w-full max-w-[120px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("label")}
            className="font-medium text-sm text-left hover:text-[var(--cai-teal)] transition-colors truncate max-w-[120px] block"
          >
            {part.label || part.part_id}
          </button>
        )}
      </td>

      {/* Length - editable */}
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        {editingField === "L" ? (
          <Input
            ref={inputRef}
            type="number"
            value={part.size.L}
            onChange={(e) => onUpdate({ size: { ...part.size, L: parseFloat(e.target.value) || 0 } })}
            onBlur={() => setEditingField(null)}
            onKeyDown={handleKeyDown}
            min={1}
            className="h-7 px-1 text-sm font-mono text-center w-16"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("L")}
            className="font-mono text-sm hover:text-[var(--cai-teal)] transition-colors"
          >
            {part.size.L}
          </button>
        )}
      </td>

      {/* Width - editable */}
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        {editingField === "W" ? (
          <Input
            ref={inputRef}
            type="number"
            value={part.size.W}
            onChange={(e) => onUpdate({ size: { ...part.size, W: parseFloat(e.target.value) || 0 } })}
            onBlur={() => setEditingField(null)}
            onKeyDown={handleKeyDown}
            min={1}
            className="h-7 px-1 text-sm font-mono text-center w-16"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("W")}
            className="font-mono text-sm hover:text-[var(--cai-teal)] transition-colors"
          >
            {part.size.W}
          </button>
        )}
      </td>

      {/* Qty - editable */}
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        {editingField === "qty" ? (
          <Input
            ref={inputRef}
            type="number"
            value={part.qty}
            onChange={(e) => onUpdate({ qty: parseInt(e.target.value) || 1 })}
            onBlur={() => setEditingField(null)}
            onKeyDown={handleKeyDown}
            min={1}
            className="h-7 px-1 text-sm font-mono text-center w-12"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("qty")}
            className="font-mono text-sm hover:text-[var(--cai-teal)] transition-colors"
          >
            {part.qty}
          </button>
        )}
      </td>

      {/* Material */}
      <td className="px-1 sm:px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Select
          value={part.material_id}
          onValueChange={(v) => onUpdate({ material_id: v })}
        >
          <SelectTrigger className="h-7 text-xs w-full max-w-[100px] sm:max-w-[120px]">
            <SelectValue placeholder="Material" />
          </SelectTrigger>
          <SelectContent>
            {materials.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Rotation - toggle */}
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onUpdate({ allow_rotation: !part.allow_rotation })}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
            part.allow_rotation 
              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
          )}
          title={part.allow_rotation ? "Can rotate (click to lock)" : "Locked (click to allow)"}
        >
          {part.allow_rotation ? <RotateCcw className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        </button>
      </td>

      {/* Group - hidden on small screens */}
      <td className="hidden md:table-cell px-2 py-2 text-center">
        {part.group_id ? (
          <Badge variant="outline" className="font-normal text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
            <FolderOpen className="h-3 w-3 mr-1" />
            {part.group_id}
          </Badge>
        ) : (
          <span className="text-[var(--muted-foreground)] text-xs">—</span>
        )}
      </td>

      {/* Operations */}
      <td className="px-1 sm:px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <OpsIndicator part={part} onClick={onEditOps} />
      </td>

      {/* Actions */}
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--muted)] transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onInsertAbove}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Insert above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onInsertBelow}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Insert below
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSwapDimensions}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Swap L ↔ W
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ============================================================
// PART CARD (Mobile mode)
// ============================================================

interface PartCardViewProps {
  part: CutPart;
  isSelected: boolean;
  onToggle: () => void;
  onEditOps: () => void;
  onUpdate: (updates: Partial<CutPart>) => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSwapDimensions: () => void;
  materials: Array<{ value: string; label: string }>;
}

function PartCardView({
  part,
  isSelected,
  onToggle,
  onEditOps,
  onUpdate,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onDelete,
  onSwapDimensions,
  materials,
}: PartCardViewProps) {
  const [editingField, setEditingField] = React.useState<string | null>(null);

  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--card)] transition-all p-3 space-y-3",
        isSelected && "ring-2 ring-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
      )}
    >
      {/* Top row: Checkbox + Label + Qty */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
            isSelected
              ? "bg-[var(--cai-teal)] border-[var(--cai-teal)]"
              : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </button>
        
        {editingField === "label" ? (
          <Input
            type="text"
            value={part.label || ""}
            onChange={(e) => onUpdate({ label: e.target.value || undefined })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
            autoFocus
            className="h-7 px-2 text-sm flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("label")}
            className="font-medium text-sm flex-1 text-left hover:text-[var(--cai-teal)] transition-colors truncate"
          >
            {part.label || part.part_id}
          </button>
        )}
        
        {editingField === "qty" ? (
          <Input
            type="number"
            value={part.qty}
            onChange={(e) => onUpdate({ qty: parseInt(e.target.value) || 1 })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
            autoFocus
            min={1}
            className="h-7 w-14 px-1 text-sm font-mono text-center"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("qty")}
            className="text-sm font-mono bg-[var(--muted)] px-2 py-0.5 rounded hover:bg-[var(--cai-teal)]/10 transition-colors"
          >
            ×{part.qty}
          </button>
        )}
      </div>

      {/* Dimensions - editable */}
      <div className="flex items-center gap-2">
        {editingField === "L" ? (
          <Input
            type="number"
            value={part.size.L}
            onChange={(e) => onUpdate({ size: { ...part.size, L: parseFloat(e.target.value) || 0 } })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
            autoFocus
            min={1}
            className="h-8 w-20 px-2 text-lg font-mono font-semibold text-center"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("L")}
            className="font-mono text-lg font-semibold hover:text-[var(--cai-teal)] transition-colors"
          >
            {part.size.L}
          </button>
        )}
        <span className="text-[var(--muted-foreground)]">×</span>
        {editingField === "W" ? (
          <Input
            type="number"
            value={part.size.W}
            onChange={(e) => onUpdate({ size: { ...part.size, W: parseFloat(e.target.value) || 0 } })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
            autoFocus
            min={1}
            className="h-8 w-20 px-2 text-lg font-mono font-semibold text-center"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingField("W")}
            className="font-mono text-lg font-semibold hover:text-[var(--cai-teal)] transition-colors"
          >
            {part.size.W}
          </button>
        )}
        <div className="flex-1" />
        <Select
          value={part.material_id}
          onValueChange={(v) => onUpdate({ material_id: v })}
        >
          <SelectTrigger className="h-7 text-xs w-auto max-w-[100px]">
            <SelectValue placeholder="Material" />
          </SelectTrigger>
          <SelectContent>
            {materials.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ops + Rotation + Actions */}
      <div className="flex items-center justify-between">
        <OpsIndicator part={part} onClick={onEditOps} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdate({ allow_rotation: !part.allow_rotation })}
            className={cn(
              "text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors",
              part.allow_rotation 
                ? "text-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/10"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            )}
          >
            {part.allow_rotation ? (
              <><RotateCcw className="h-3 w-3" /> Rotatable</>
            ) : (
              <><Lock className="h-3 w-3" /> Fixed</>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
              >
                <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onInsertAbove}>
                <ArrowUp className="h-4 w-4 mr-2" />
                Insert above
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onInsertBelow}>
                <ArrowDown className="h-4 w-4 mr-2" />
                Insert below
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSwapDimensions}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Swap L ↔ W
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StreamlinedPartsTable() {
  const {
    currentCutlist,
    removePart,
    updatePart,
    addPart,
    insertPartAt,
    selectedPartIds,
    selectPart,
    deselectPart,
    togglePartSelection,
    selectAllParts,
    clearSelection,
    selectRange,
    removeSelectedParts,
    duplicateSelectedParts,
    copySelectedParts,
    pasteParts,
    clipboard,
  } = useIntakeStore();

  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [sortField, setSortField] = React.useState<"label" | "qty" | "L" | "W" | "material_id">("label");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [opsEditingPart, setOpsEditingPart] = React.useState<CutPart | null>(null);
  const [showBulkOpsPanel, setShowBulkOpsPanel] = React.useState(false);

  const parts = currentCutlist.parts;
  const defaultEdgeband = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";

  // Material options
  const materialOptions = currentCutlist.materials.map((m) => ({
    value: m.material_id,
    label: `${m.name} (${m.thickness_mm}mm)`,
  }));

  // Auto-detect mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setViewMode(window.innerWidth < 768 ? "cards" : "table");
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sort parts
  const sortedParts = React.useMemo(() => {
    return [...parts].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "label":
          aVal = a.label || a.part_id;
          bVal = b.label || b.part_id;
          break;
        case "qty":
          aVal = a.qty;
          bVal = b.qty;
          break;
        case "L":
          aVal = a.size.L;
          bVal = b.size.L;
          break;
        case "W":
          aVal = a.size.W;
          bVal = b.size.W;
          break;
        case "material_id":
          aVal = a.material_id;
          bVal = b.material_id;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [parts, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePartClick = (partId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedId) {
      selectRange(lastSelectedId, partId);
    } else if (e.metaKey || e.ctrlKey) {
      togglePartSelection(partId);
    } else {
      clearSelection();
      selectPart(partId);
    }
    setLastSelectedId(partId);
  };

  const handleSwapDimensions = (part: CutPart) => {
    updatePart(part.part_id, {
      ...part,
      size: { L: part.size.W, W: part.size.L },
    });
  };

  // Swap dimensions for all selected parts
  const handleSwapSelectedDimensions = () => {
    selectedPartIds.forEach(partId => {
      const part = parts.find(p => p.part_id === partId);
      if (part) {
        handleSwapDimensions(part);
      }
    });
  };

  // Edit ops for selected part (only works with single selection)
  const handleEditSelectedOps = () => {
    if (selectedPartIds.length === 1) {
      const part = parts.find(p => p.part_id === selectedPartIds[0]);
      if (part) {
        setOpsEditingPart(part);
      }
    }
  };

  const handleOpsChange = (ops: OperationsData) => {
    if (!opsEditingPart) return;
    const newOps = opsDataToPartOps(ops, defaultEdgeband);
    updatePart(opsEditingPart.part_id, {
      ...opsEditingPart,
      ops: Object.keys(newOps).length > 0 ? newOps : undefined,
    });
  };

  // Apply bulk operations to all selected parts
  const handleBulkOpsApply = (ops: OperationsData, mode: "add" | "replace") => {
    const newOps = opsDataToPartOps(ops, defaultEdgeband);
    const hasNewOps = Object.keys(newOps).length > 0;

    selectedPartIds.forEach(partId => {
      const part = parts.find(p => p.part_id === partId);
      if (!part) return;

      if (mode === "replace") {
        // Replace all operations
        updatePart(partId, {
          ...part,
          ops: hasNewOps ? newOps : undefined,
        });
      } else {
        // Add/merge operations
        const mergedOps = mergePartOps(part.ops, newOps);
        const mergedOpsKeys = mergedOps ? Object.keys(mergedOps) : [];
        updatePart(partId, {
          ...part,
          ops: mergedOpsKeys.length > 0 ? mergedOps : undefined,
        });
      }
    });
  };

  // Helper to merge operations (for "add" mode)
  const mergePartOps = (
    existing: CutPart["ops"] | undefined,
    newOps: ReturnType<typeof opsDataToPartOps>
  ): CutPart["ops"] => {
    const merged: CutPart["ops"] = { ...existing };

    // Merge edging
    if (newOps.edging) {
      merged.edging = {
        edges: {
          ...existing?.edging?.edges,
          ...newOps.edging.edges,
        },
      };
    }

    // Merge grooves (add new ones)
    if (newOps.grooves && newOps.grooves.length > 0) {
      merged.grooves = [...(existing?.grooves || []), ...newOps.grooves];
    }

    // Merge holes (add new ones)
    if (newOps.holes && newOps.holes.length > 0) {
      merged.holes = [...(existing?.holes || []), ...newOps.holes];
    }

    // Merge custom CNC ops (add new ones)
    if (newOps.custom_cnc_ops && newOps.custom_cnc_ops.length > 0) {
      merged.custom_cnc_ops = [...(existing?.custom_cnc_ops || []), ...newOps.custom_cnc_ops];
    }

    return merged;
  };

  // Apply bulk material change to all selected parts
  const handleBulkMaterial = (materialId: string) => {
    selectedPartIds.forEach(partId => {
      const part = parts.find(p => p.part_id === partId);
      if (part) {
        updatePart(partId, { ...part, material_id: materialId });
      }
    });
  };

  // Apply bulk rotation change to all selected parts
  const handleBulkRotation = (allowRotation: boolean) => {
    selectedPartIds.forEach(partId => {
      const part = parts.find(p => p.part_id === partId);
      if (part) {
        updatePart(partId, { ...part, allow_rotation: allowRotation });
      }
    });
  };

  // Apply bulk group change to all selected parts
  const handleBulkGroup = (groupId: string | undefined) => {
    selectedPartIds.forEach(partId => {
      const part = parts.find(p => p.part_id === partId);
      if (part) {
        updatePart(partId, { ...part, group_id: groupId });
      }
    });
  };

  // ============================================================
  // ROW-LEVEL ACTIONS
  // ============================================================

  // Insert a new empty part at a specific index
  const handleInsertAt = (index: number) => {
    const defaultMaterial = currentCutlist.materials[0]?.material_id || "default";
    const defaultThickness = currentCutlist.materials[0]?.thickness_mm || 18;
    
    const newPart: CutPart = {
      part_id: generateId("P"),
      label: "",
      qty: 1,
      size: { L: 0, W: 0 },
      thickness_mm: defaultThickness,
      material_id: defaultMaterial,
      allow_rotation: true,
    };
    insertPartAt(newPart, index);
  };

  // Duplicate a single part
  const handleDuplicatePart = (part: CutPart) => {
    const newPart: CutPart = {
      ...part,
      part_id: generateId("P"),
      label: part.label ? `${part.label} (copy)` : undefined,
    };
    addPart(newPart);
  };

  // Get unique groups from current parts for bulk group dropdown
  const uniqueGroups = React.useMemo(() => {
    const groups = new Set<string>();
    parts.forEach(p => {
      if (p.group_id) groups.add(p.group_id);
    });
    return Array.from(groups).sort();
  }, [parts]);

  // Calculate totals
  const totalPieces = parts.reduce((sum, p) => sum + p.qty, 0);
  const hasSelection = selectedPartIds.length > 0;
  const allSelected = parts.length > 0 && selectedPartIds.length === parts.length;
  const someSelected = selectedPartIds.length > 0 && selectedPartIds.length < parts.length;

  if (parts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Layers className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-1">No Parts Yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Add parts using quick parse, manual entry, or import from files.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Parts List</CardTitle>
              <Badge variant="secondary">
                {parts.length} parts • {totalPieces} pcs
              </Badge>
              {hasSelection && (
                <Badge variant="outline" className="bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]">
                  {selectedPartIds.length} selected
                </Badge>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {/* Selection Actions */}
              {hasSelection ? (
                <>
                  {/* Material Bulk Action */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-1.5 sm:px-2">
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Material</span>
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">Set Material</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {materialOptions.map((m) => (
                        <DropdownMenuItem key={m.value} onClick={() => handleBulkMaterial(m.value)}>
                          {m.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Rotation Bulk Action */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-1.5 sm:px-2">
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Rotation</span>
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleBulkRotation(true)}>
                        <RotateCcw className="h-4 w-4 mr-2 text-green-600" />
                        Allow rotation
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkRotation(false)}>
                        <Lock className="h-4 w-4 mr-2 text-amber-600" />
                        Lock rotation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Group Bulk Action - hidden on small screens */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-1.5 sm:px-2 hidden sm:flex">
                        <FolderOpen className="h-4 w-4" />
                        <span className="hidden md:inline ml-1">Group</span>
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">Set Group</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBulkGroup(undefined)}>
                        <span className="text-[var(--muted-foreground)]">No group</span>
                      </DropdownMenuItem>
                      {uniqueGroups.map((g) => (
                        <DropdownMenuItem key={g} onClick={() => handleBulkGroup(g)}>
                          <FolderOpen className="h-4 w-4 mr-2 text-indigo-600" />
                          {g}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => {
                          const name = prompt("Enter new group name:");
                          if (name?.trim()) handleBulkGroup(name.trim());
                        }}
                      >
                        <span className="text-[var(--cai-teal)]">+ Create new group...</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowBulkOpsPanel(true)} 
                          className="h-8 px-1.5 sm:px-2 text-[var(--cai-teal)]"
                        >
                          <Settings2 className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Ops</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Apply operations to all selected parts</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleSwapSelectedDimensions} 
                          className="h-8 px-1.5 sm:px-2"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          <span className="hidden md:inline ml-1">L↔W</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Swap Length and Width for selected parts</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <div className="hidden sm:block w-px h-6 bg-[var(--border)] mx-0.5" />
                  
                  <Button variant="ghost" size="sm" onClick={copySelectedParts} className="h-8 px-1.5 sm:px-2 hidden md:flex">
                    <Copy className="h-4 w-4" />
                    <span className="hidden lg:inline ml-1">Copy</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={duplicateSelectedParts} className="h-8 px-1.5 sm:px-2 hidden md:flex">
                    <Layers className="h-4 w-4" />
                    <span className="hidden lg:inline ml-1">Duplicate</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeSelectedParts}
                    className="h-8 px-1.5 sm:px-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Delete</span>
                  </Button>
                  
                  <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
                  
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 px-1.5 sm:px-2">
                    <span className="sm:hidden">×</span>
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={selectAllParts} className="h-8 px-1.5 sm:px-2">
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Select All</span>
                  </Button>
                  {clipboard.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={pasteParts} className="h-8 px-1.5 sm:px-2">
                      Paste ({clipboard.length})
                    </Button>
                  )}
                </>
              )}

              {/* View toggle */}
              <div className="flex items-center border rounded-md overflow-hidden ml-1 sm:ml-2">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "table" ? "bg-[var(--cai-teal)] text-white" : "hover:bg-[var(--muted)]"
                  )}
                  title="Table view"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "cards" ? "bg-[var(--cai-teal)] text-white" : "hover:bg-[var(--muted)]"
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-4">
          {viewMode === "table" ? (
            /* TABLE VIEW */
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-[var(--muted)]">
                      <th className="w-8 sm:w-10 px-1 sm:px-2 py-2">
                        <button
                          type="button"
                          onClick={allSelected || someSelected ? clearSelection : selectAllParts}
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
                          {someSelected && !allSelected && <div className="w-2 h-0.5 bg-white" />}
                        </button>
                      </th>
                      <th className="px-1 sm:px-2 py-2 text-left text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => handleSort("label")}>
                          Label
                          <ArrowUpDown className={cn("ml-1 h-3 w-3 hidden sm:inline", sortField === "label" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-1 py-2 text-center text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-0.5" onClick={() => handleSort("L")}>
                          L
                          <ArrowUpDown className={cn("ml-0.5 h-3 w-3 hidden sm:inline", sortField === "L" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-1 py-2 text-center text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-0.5" onClick={() => handleSort("W")}>
                          W
                          <ArrowUpDown className={cn("ml-0.5 h-3 w-3 hidden sm:inline", sortField === "W" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-1 py-2 text-center text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-0.5" onClick={() => handleSort("qty")}>
                          Qty
                          <ArrowUpDown className={cn("ml-0.5 h-3 w-3 hidden sm:inline", sortField === "qty" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-1 sm:px-2 py-2 text-left text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-0.5" onClick={() => handleSort("material_id")}>
                          <span className="hidden sm:inline">Material</span>
                          <span className="sm:hidden">Mat</span>
                          <ArrowUpDown className={cn("ml-0.5 h-3 w-3 hidden sm:inline", sortField === "material_id" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="w-10 px-1 py-2 text-center text-xs font-medium" title="Can Rotate">
                        Rot
                      </th>
                      <th className="hidden md:table-cell px-2 py-2 text-center text-xs font-medium" title="Group/Assembly">
                        Group
                      </th>
                      <th className="px-1 sm:px-2 py-2 text-center text-xs font-medium text-teal-600">
                        Ops
                      </th>
                      <th className="w-10 px-1 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParts.map((part, index) => (
                      <PartRow
                        key={part.part_id}
                        part={part}
                        isSelected={selectedPartIds.includes(part.part_id)}
                        onSelect={(e) => handlePartClick(part.part_id, e)}
                        onToggle={() => togglePartSelection(part.part_id)}
                        onEditOps={() => setOpsEditingPart(part)}
                        onUpdate={(updates) => updatePart(part.part_id, { ...part, ...updates })}
                        onInsertAbove={() => handleInsertAt(index)}
                        onInsertBelow={() => handleInsertAt(index + 1)}
                        onDuplicate={() => handleDuplicatePart(part)}
                        onDelete={() => removePart(part.part_id)}
                        onSwapDimensions={() => handleSwapDimensions(part)}
                        materials={materialOptions}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARD VIEW */
            <div className="p-3 sm:p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sortedParts.map((part, index) => (
                <PartCardView
                  key={part.part_id}
                  part={part}
                  isSelected={selectedPartIds.includes(part.part_id)}
                  onToggle={() => togglePartSelection(part.part_id)}
                  onEditOps={() => setOpsEditingPart(part)}
                  onUpdate={(updates) => updatePart(part.part_id, { ...part, ...updates })}
                  onInsertAbove={() => handleInsertAt(index)}
                  onInsertBelow={() => handleInsertAt(index + 1)}
                  onDuplicate={() => handleDuplicatePart(part)}
                  onDelete={() => removePart(part.part_id)}
                  onSwapDimensions={() => handleSwapDimensions(part)}
                  materials={materialOptions}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified Operations Panel (single part) */}
      <UnifiedOpsPanel
        open={!!opsEditingPart}
        onOpenChange={(open) => !open && setOpsEditingPart(null)}
        value={opsEditingPart ? partToOpsData(opsEditingPart) : { edgebanding: { sides: {} }, grooves: [], holes: [], cnc: [] }}
        onChange={handleOpsChange}
        partLabel={opsEditingPart?.label || opsEditingPart?.part_id}
      />

      {/* Bulk Operations Panel (multiple parts) */}
      <BulkOpsPanel
        open={showBulkOpsPanel}
        onOpenChange={setShowBulkOpsPanel}
        selectedCount={selectedPartIds.length}
        onApply={handleBulkOpsApply}
      />
    </>
  );
}

