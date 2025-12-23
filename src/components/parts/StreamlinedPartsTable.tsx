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
  Edit2,
  ArrowUpDown,
  Layers,
  RotateCcw,
  Lock,
  Copy,
  Undo2,
  Redo2,
  Square,
  Settings2,
  LayoutGrid,
  LayoutList,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Check,
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
import { useIntakeStore } from "@/lib/store";
import type { CutPart } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { UnifiedOpsPanel } from "./UnifiedOpsPanel";
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

function PartRow({
  part,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSwapDimensions,
  onEditOps,
  materials,
}: {
  part: CutPart;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSwapDimensions: () => void;
  onEditOps: () => void;
  materials: Array<{ value: string; label: string }>;
}) {
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "group cursor-pointer transition-colors",
        isSelected && "bg-[var(--cai-teal)]/10 hover:bg-[var(--cai-teal)]/15",
        !isSelected && "hover:bg-[var(--muted)]/50"
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="rounded border-[var(--border)] cursor-pointer"
        />
      </td>

      {/* Label */}
      <td className="px-2 py-2">
        <span className="font-medium text-sm">
          {part.label || part.part_id}
        </span>
      </td>

      {/* Dimensions */}
      <td className="px-2 py-2 text-center">
        <span className="font-mono text-sm">
          {part.size.L} × {part.size.W}
        </span>
      </td>

      {/* Qty */}
      <td className="px-2 py-2 text-center">
        <span className="font-mono text-sm">{part.qty}</span>
      </td>

      {/* Material */}
      <td className="px-2 py-2">
        <Badge variant="outline" className="font-normal text-xs">
          {materials.find(m => m.value === part.material_id)?.label?.split(" (")[0] || part.material_id}
        </Badge>
      </td>

      {/* Operations */}
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <OpsIndicator part={part} onClick={onEditOps} />
      </td>

      {/* Actions */}
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[var(--cai-teal)]"
                  onClick={onSwapDimensions}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swap L ↔ W</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// PART CARD (Mobile mode)
// ============================================================

function PartCardView({
  part,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSwapDimensions,
  onEditOps,
  materials,
}: {
  part: CutPart;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSwapDimensions: () => void;
  onEditOps: () => void;
  materials: Array<{ value: string; label: string }>;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--card)] transition-all",
        isSelected && "ring-2 ring-[var(--cai-teal)]"
      )}
    >
      {/* Main content */}
      <div className="p-3 space-y-2" onClick={onSelect}>
        {/* Top row: Label + Expand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="rounded border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="font-medium text-sm">
              {part.label || part.part_id}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 rounded hover:bg-[var(--muted)]"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Middle row: Dimensions + Qty */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold">
              {part.size.L} × {part.size.W}
            </span>
            <Badge variant="secondary" className="text-xs">
              ×{part.qty}
            </Badge>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <OpsIndicator part={part} onClick={onEditOps} />
          </div>
        </div>

        {/* Material */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-normal text-xs">
            {materials.find(m => m.value === part.material_id)?.label?.split(" (")[0] || part.material_id}
          </Badge>
          {part.allow_rotation ? (
            <span className="text-xs text-[var(--cai-teal)] flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Rotatable
            </span>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
              <Lock className="h-3 w-3" /> Fixed
            </span>
          )}
        </div>
      </div>

      {/* Expanded actions */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--border)] bg-[var(--muted)]/30">
          <div className="flex items-center gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={onSwapDimensions} className="flex-1">
              <ArrowLeftRight className="h-4 w-4 mr-1" /> Swap L×W
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
    undo,
    redo,
    canUndo,
    canRedo,
  } = useIntakeStore();

  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [sortField, setSortField] = React.useState<"label" | "qty" | "L" | "W" | "material_id">("label");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [editingPartId, setEditingPartId] = React.useState<string | null>(null);
  const [opsEditingPart, setOpsEditingPart] = React.useState<CutPart | null>(null);

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

  const handleOpsChange = (ops: OperationsData) => {
    if (!opsEditingPart) return;
    const newOps = opsDataToPartOps(ops, defaultEdgeband);
    updatePart(opsEditingPart.part_id, {
      ...opsEditingPart,
      ops: Object.keys(newOps).length > 0 ? newOps : undefined,
    });
  };

  // Calculate totals
  const totalPieces = parts.reduce((sum, p) => sum + p.qty, 0);
  const totalArea = parts.reduce((sum, p) => sum + p.qty * p.size.L * p.size.W, 0);
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
            <div className="flex items-center gap-2">
              {/* Undo/Redo */}
              <div className="flex items-center gap-0.5 border-r border-[var(--border)] pr-2 mr-1">
                <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo()} className="h-8 px-2" title="Undo">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo()} className="h-8 px-2" title="Redo">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Selection Actions */}
              {hasSelection ? (
                <>
                  <Button variant="ghost" size="sm" onClick={copySelectedParts} className="h-8 px-2">
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={duplicateSelectedParts} className="h-8 px-2">
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeSelectedParts}
                    className="h-8 px-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 px-2">
                    <Square className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </>
              ) : (
                <>
                  {clipboard.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={pasteParts} className="h-8 px-2">
                      Paste ({clipboard.length})
                    </Button>
                  )}
                </>
              )}

              {/* View toggle */}
              <div className="flex items-center border rounded-md overflow-hidden ml-2">
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

              <span className="hidden md:block text-sm text-[var(--muted-foreground)] border-l border-[var(--border)] pl-2 ml-1">
                {(totalArea / 1_000_000).toFixed(2)} m²
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-4">
          {viewMode === "table" ? (
            /* TABLE VIEW */
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-[var(--muted)]">
                      <th className="w-10 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          onChange={(e) => e.target.checked ? selectAllParts() : clearSelection()}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => handleSort("label")}>
                          Label
                          <ArrowUpDown className={cn("ml-1 h-3 w-3", sortField === "label" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => handleSort("L")}>
                          Dimensions
                          <ArrowUpDown className={cn("ml-1 h-3 w-3", (sortField === "L" || sortField === "W") && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => handleSort("qty")}>
                          Qty
                          <ArrowUpDown className={cn("ml-1 h-3 w-3", sortField === "qty" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => handleSort("material_id")}>
                          Material
                          <ArrowUpDown className={cn("ml-1 h-3 w-3", sortField === "material_id" && "text-[var(--cai-teal)]")} />
                        </Button>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-teal-600">
                        Ops
                      </th>
                      <th className="w-24 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParts.map((part) => (
                      <PartRow
                        key={part.part_id}
                        part={part}
                        isSelected={selectedPartIds.includes(part.part_id)}
                        onSelect={(e) => handlePartClick(part.part_id, e)}
                        onEdit={() => setEditingPartId(part.part_id)}
                        onDelete={() => removePart(part.part_id)}
                        onSwapDimensions={() => handleSwapDimensions(part)}
                        onEditOps={() => setOpsEditingPart(part)}
                        materials={materialOptions}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARD VIEW */
            <div className="p-4 space-y-3">
              {sortedParts.map((part) => (
                <PartCardView
                  key={part.part_id}
                  part={part}
                  isSelected={selectedPartIds.includes(part.part_id)}
                  onSelect={() => togglePartSelection(part.part_id)}
                  onEdit={() => setEditingPartId(part.part_id)}
                  onDelete={() => removePart(part.part_id)}
                  onSwapDimensions={() => handleSwapDimensions(part)}
                  onEditOps={() => setOpsEditingPart(part)}
                  materials={materialOptions}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified Operations Panel */}
      <UnifiedOpsPanel
        open={!!opsEditingPart}
        onOpenChange={(open) => !open && setOpsEditingPart(null)}
        value={opsEditingPart ? partToOpsData(opsEditingPart) : { edgebanding: { sides: {} }, grooves: [], holes: [], cnc: [] }}
        onChange={handleOpsChange}
        partLabel={opsEditingPart?.label || opsEditingPart?.part_id}
      />
    </>
  );
}

