"use client";

import * as React from "react";
import {
  Trash2,
  Edit2,
  ArrowUpDown,
  Layers,
  RotateCcw,
  Lock,
  GripVertical,
  Copy,
  Clipboard,
  ClipboardPaste,
  Undo2,
  Redo2,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIntakeStore } from "@/lib/store";
import type { CutPart } from "@/lib/schema";
import type { PartOps, GrooveOp, HoleOp } from "@/lib/schema/operations";
import { cn } from "@/lib/utils";
import { PartEditModal } from "./PartEditModal";
import { useColumnOrder } from "@/hooks/use-column-order";
import { useKeyboardShortcut } from "@/components/ui/keyboard-shortcuts-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// SHORTCODE FORMATTERS FOR PARTOPS
// ============================================================

/**
 * Format edging from PartOps to shortcode (2L2W, L1, etc.)
 */
function formatEdgingShortcode(ops: PartOps | undefined): string {
  const edges = ops?.edging?.edges;
  if (!edges) return "-";
  
  const applied = Object.entries(edges)
    .filter(([, v]) => v?.apply)
    .map(([k]) => k)
    .sort();
    
  if (applied.length === 0) return "-";
  
  // Map to canonical codes
  const key = applied.join(",");
  const mapping: Record<string, string> = {
    "L1": "L1",
    "L2": "L2",
    "W1": "W1",
    "W2": "W2",
    "L1,L2": "2L",
    "W1,W2": "2W",
    "L1,W1,W2": "L2W",
    "L1,L2,W1": "2L1W",
    "L1,L2,W1,W2": "2L2W",
  };
  
  return mapping[key] ?? applied.join("+");
}

/**
 * Format edging for tooltip description
 */
function formatEdgingDescription(ops: PartOps | undefined): string {
  const edges = ops?.edging?.edges;
  if (!edges) return "No edgebanding";
  
  const applied = Object.entries(edges)
    .filter(([, v]) => v?.apply)
    .map(([k, v]) => {
      const edgeName: Record<string, string> = { L1: "Front", L2: "Back", W1: "Left", W2: "Right" };
      let desc = edgeName[k] || k;
      if (v?.thickness_mm) desc += ` (${v.thickness_mm}mm)`;
      return desc;
    });
    
  return applied.length > 0 ? applied.join(", ") : "No edgebanding";
}

/**
 * Format grooves from PartOps to shortcode
 */
function formatGroovesShortcode(grooves: GrooveOp[] | undefined): string {
  if (!grooves || grooves.length === 0) return "-";
  
  if (grooves.length === 1) {
    const g = grooves[0];
    return `G${g.side}-${g.width_mm ?? 4}-${g.offset_mm}`;
  }
  
  // Check if all same width/offset
  const firstWidth = grooves[0].width_mm ?? 4;
  const firstOffset = grooves[0].offset_mm;
  const allSame = grooves.every(g => 
    (g.width_mm ?? 4) === firstWidth && g.offset_mm === firstOffset
  );
  
  if (allSame) {
    const sides = grooves.map(g => g.side).sort();
    if (sides.length === 4) return `G-ALL-${firstWidth}-${firstOffset}`;
    if (sides.includes("L1") && sides.includes("L2") && sides.length === 2) {
      return `GL-${firstWidth}-${firstOffset}`;
    }
    if (sides.includes("W1") && sides.includes("W2") && sides.length === 2) {
      return `GW-${firstWidth}-${firstOffset}`;
    }
  }
  
  return `${grooves.length}G`;
}

/**
 * Format grooves for tooltip description
 */
function formatGroovesDescription(grooves: GrooveOp[] | undefined): string {
  if (!grooves || grooves.length === 0) return "No grooves";
  
  return grooves.map(g => {
    const sideName: Record<string, string> = { L1: "front", L2: "back", W1: "left", W2: "right" };
    return `${g.width_mm ?? 4}mm on ${sideName[g.side] || g.side}, ${g.offset_mm}mm offset`;
  }).join("\n");
}

/**
 * Format holes from PartOps to shortcode
 */
function formatHolesShortcode(holes: HoleOp[] | undefined): string {
  if (!holes || holes.length === 0) return "-";
  
  // Try to identify common patterns
  const patterns: string[] = [];
  
  for (const h of holes) {
    if (h.pattern_id) {
      // Use pattern ID as shortcode
      patterns.push(h.pattern_id.toUpperCase());
    } else if (h.holes && h.holes.length > 0) {
      // Count inline holes
      const count = h.holes.length;
      const avgDia = h.holes.reduce((sum, hole) => sum + hole.dia_mm, 0) / count;
      
      // Guess pattern type based on diameter
      if (avgDia >= 30 && avgDia <= 40) {
        patterns.push(`H${count}`); // Hinge holes
      } else if (avgDia >= 4 && avgDia <= 6) {
        patterns.push("SP"); // Shelf pins
      } else {
        patterns.push(`${count}H`);
      }
    }
  }
  
  return patterns.length > 0 ? patterns.join(",") : `${holes.length}H`;
}

/**
 * Format holes for tooltip description
 */
function formatHolesDescription(holes: HoleOp[] | undefined): string {
  if (!holes || holes.length === 0) return "No holes";
  
  return holes.map(h => {
    if (h.pattern_id) {
      return `Pattern: ${h.pattern_id}`;
    }
    if (h.holes && h.holes.length > 0) {
      const count = h.holes.length;
      const dia = h.holes[0].dia_mm;
      return `${count}× ${dia}mm holes`;
    }
    return "Hole operation";
  }).join("\n");
}

/**
 * Format CNC operations from PartOps to shortcode
 */
function formatCncShortcode(ops: PartOps | undefined): string {
  const routing = ops?.routing || [];
  const custom = ops?.custom_cnc_ops || [];
  
  if (routing.length === 0 && custom.length === 0) return "-";
  
  const codes: string[] = [];
  
  // Format routing operations
  for (const r of routing) {
    if (r.through) {
      codes.push(`CUT-${r.region.L}x${r.region.W}`);
    } else if (r.profile_id) {
      codes.push(r.profile_id.toUpperCase());
    } else {
      codes.push(`PKT-${r.region.L}x${r.region.W}`);
    }
  }
  
  // Format custom CNC ops
  for (const c of custom) {
    codes.push(c.op_type.toUpperCase());
  }
  
  // Limit display length
  if (codes.length === 1) return codes[0];
  if (codes.length <= 2) return codes.join(",");
  return `${codes.length}CNC`;
}

/**
 * Format CNC operations for tooltip description
 */
function formatCncDescription(ops: PartOps | undefined): string {
  const routing = ops?.routing || [];
  const custom = ops?.custom_cnc_ops || [];
  
  if (routing.length === 0 && custom.length === 0) return "No CNC operations";
  
  const lines: string[] = [];
  
  for (const r of routing) {
    if (r.through) {
      lines.push(`Cutout: ${r.region.L}×${r.region.W}mm`);
    } else {
      lines.push(`Pocket: ${r.region.L}×${r.region.W}mm, ${r.depth_mm ?? "?"}mm deep`);
    }
  }
  
  for (const c of custom) {
    lines.push(`Custom: ${c.op_type}${c.notes ? ` - ${c.notes}` : ""}`);
  }
  
  return lines.join("\n");
}

// Column definitions with capability requirements
type ColumnKey = 
  | "label" | "L" | "W" | "thickness_mm" | "qty" | "material_id" | "rotate" 
  | "group_id" | "edging" | "grooves" | "holes" | "cnc" | "notes";
type SortField = "label" | "qty" | "L" | "W" | "material_id";

// Capability keys that match CutlistCapabilities
type CapabilityKey = "edging" | "grooves" | "cnc_holes" | "cnc_routing" | "custom_cnc" | "advanced_grouping" | "part_notes";

interface ColumnDef {
  header: string;
  sortable?: SortField;
  align?: "left" | "right" | "center";
  width?: string;
  advancedOnly?: boolean;
  /** Show only when specific capability is enabled */
  requiresCapability?: CapabilityKey | CapabilityKey[];
  /** Color hint for operation columns */
  colorClass?: string;
}

const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  label: { header: "Label", sortable: "label", align: "left" },
  L: { header: "Length", sortable: "L", align: "right" },
  W: { header: "Width", sortable: "W", align: "right" },
  thickness_mm: { header: "Thk", align: "right" },
  qty: { header: "Qty", sortable: "qty", align: "right" },
  material_id: { header: "Material", sortable: "material_id", align: "left" },
  rotate: { header: "Rotate", align: "center" },
  group_id: { header: "Group", align: "left", advancedOnly: true, requiresCapability: "advanced_grouping" },
  edging: { header: "Edging", align: "center", requiresCapability: "edging", colorClass: "text-blue-600" },
  grooves: { header: "Grooves", align: "center", requiresCapability: "grooves", colorClass: "text-amber-600" },
  holes: { header: "Holes", align: "center", requiresCapability: "cnc_holes", colorClass: "text-purple-600" },
  cnc: { header: "CNC", align: "center", requiresCapability: ["cnc_routing", "custom_cnc"], colorClass: "text-emerald-600" },
  notes: { header: "Notes", align: "left", requiresCapability: "part_notes" },
};

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "label", "L", "W", "thickness_mm", "qty", "material_id", "rotate", 
  "edging", "grooves", "holes", "cnc", "group_id", "notes"
];

// Sortable header cell component
function SortableTableHead({
  id,
  column,
  sortField,
  sortDirection,
  onSort,
}: {
  id: string;
  column: ColumnDef;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  const isCurrentSort = column.sortable === sortField;

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        column.align === "right" && "text-right",
        column.align === "center" && "text-center",
        isDragging && "opacity-80 bg-[var(--cai-teal)]/10 shadow-lg",
        column.colorClass
      )}
    >
      <div className={cn(
        "flex items-center gap-1",
        column.align === "right" && "justify-end",
        column.align === "center" && "justify-center"
      )}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-0.5 rounded",
            "text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]",
            "hover:bg-[var(--muted)] transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="Drag to reorder column"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {column.sortable ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-1"
            onClick={() => onSort(column.sortable!)}
          >
            {column.header}
            <ArrowUpDown className={cn(
              "ml-1 h-3 w-3",
              isCurrentSort && "text-[var(--cai-teal)]"
            )} />
          </Button>
        ) : (
          <span className="text-xs font-medium">{column.header}</span>
        )}
      </div>
    </TableHead>
  );
}

export function PartsTable() {
  const {
    currentCutlist,
    removePart,
    selectedPartIds,
    selectPart,
    deselectPart,
    togglePartSelection,
    selectAllParts,
    clearSelection,
    selectRange,
    isAdvancedMode,
    // Bulk operations
    removeSelectedParts,
    duplicateSelectedParts,
    copySelectedParts,
    pasteParts,
    clipboard,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
  } = useIntakeStore();

  const [sortField, setSortField] = React.useState<SortField>("label");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [editingPartId, setEditingPartId] = React.useState<string | null>(null);

  // Column order state with persistence
  const [columnOrder, setColumnOrder] = useColumnOrder<ColumnKey>(
    "parts-table-columns",
    DEFAULT_COLUMN_ORDER
  );

  const parts = currentCutlist.parts;
  
  // Keyboard shortcuts
  useKeyboardShortcut(["⌘", "A"], () => {
    selectAllParts();
  });
  
  useKeyboardShortcut(["⌘", "C"], () => {
    if (selectedPartIds.length > 0) {
      copySelectedParts();
    }
  });
  
  useKeyboardShortcut(["⌘", "V"], () => {
    pasteParts();
  });
  
  useKeyboardShortcut(["⌘", "D"], () => {
    if (selectedPartIds.length > 0) {
      duplicateSelectedParts();
    }
  });
  
  useKeyboardShortcut(["⌘", "Z"], () => {
    undo();
  });
  
  useKeyboardShortcut(["⌘", "⇧", "Z"], () => {
    redo();
  });
  
  useKeyboardShortcut(["Delete"], () => {
    if (selectedPartIds.length > 0) {
      removeSelectedParts();
    }
  }, { preventDefault: false });
  
  useKeyboardShortcut(["Backspace"], () => {
    if (selectedPartIds.length > 0) {
      removeSelectedParts();
    }
  }, { preventDefault: false });
  
  useKeyboardShortcut(["Escape"], () => {
    clearSelection();
  });

  // Helper to check if a capability is enabled
  const isCapabilityEnabled = React.useCallback((cap: CapabilityKey | CapabilityKey[]): boolean => {
    const caps = currentCutlist.capabilities;
    if (Array.isArray(cap)) {
      // If any of the capabilities is enabled, show the column
      return cap.some(c => caps[c as keyof typeof caps]);
    }
    return !!caps[cap as keyof typeof caps];
  }, [currentCutlist.capabilities]);

  // Filter visible columns based on mode and capabilities
  const visibleColumns = React.useMemo(() => {
    return columnOrder.filter((col) => {
      const def = COLUMN_DEFS[col];
      // Hide advanced-only columns in simple mode (unless they have a capability requirement)
      if (def.advancedOnly && !isAdvancedMode && !def.requiresCapability) return false;
      // Hide columns that require a specific capability unless that capability is enabled
      if (def.requiresCapability && !isCapabilityEnabled(def.requiresCapability)) return false;
      return true;
    });
  }, [columnOrder, isAdvancedMode, isCapabilityEnabled]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as ColumnKey);
      const newIndex = columnOrder.indexOf(over.id as ColumnKey);
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

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
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [parts, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePartClick = (partId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedId) {
      // Shift-click: select range
      selectRange(lastSelectedId, partId);
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl-click: toggle individual selection
      togglePartSelection(partId);
    } else {
      // Regular click: select only this part
      clearSelection();
      selectPart(partId);
    }
    setLastSelectedId(partId);
  };
  
  const handleCheckboxChange = (partId: string, checked: boolean) => {
    if (checked) {
      selectPart(partId);
    } else {
      deselectPart(partId);
    }
    setLastSelectedId(partId);
  };

  // Calculate totals
  const totalPieces = parts.reduce((sum, p) => sum + p.qty, 0);
  const totalArea = parts.reduce((sum, p) => sum + p.qty * p.size.L * p.size.W, 0);

  // Render cell content based on column key
  const renderCell = (part: CutPart, colKey: ColumnKey) => {
    const col = COLUMN_DEFS[colKey];
    
    switch (colKey) {
      case "label":
        return (
          <span className="font-medium">
            {part.label || part.part_id}
          </span>
        );
      case "L":
        return <span className="font-mono">{part.size.L}</span>;
      case "W":
        return <span className="font-mono">{part.size.W}</span>;
      case "thickness_mm":
        return <span className="font-mono">{part.thickness_mm}</span>;
      case "qty":
        return <span className="font-mono">{part.qty}</span>;
      case "material_id":
        return (
          <Badge variant="outline" className="font-normal">
            {currentCutlist.materials.find(
              (m) => m.material_id === part.material_id
            )?.name || part.material_id}
          </Badge>
        );
      case "rotate":
        return part.allow_rotation ? (
          <span title="Can rotate" className="flex justify-center">
            <RotateCcw className="h-4 w-4 text-[var(--cai-teal)]" />
          </span>
        ) : (
          <span title="Fixed orientation" className="flex justify-center">
            <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />
          </span>
        );
      case "group_id":
        return part.group_id ? (
          <Badge variant="secondary">{part.group_id}</Badge>
        ) : (
          <span className="text-[var(--muted-foreground)]">-</span>
        );
      case "edging": {
        const code = formatEdgingShortcode(part.ops);
        if (code === "-") return <span className="text-[var(--muted-foreground)]">-</span>;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  className={cn(
                    "font-mono text-xs cursor-help",
                    code === "2L2W" 
                      ? "bg-blue-500 text-white" 
                      : "bg-blue-100 text-blue-700"
                  )}
                >
                  {code}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs whitespace-pre-line">{formatEdgingDescription(part.ops)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      case "grooves": {
        const code = formatGroovesShortcode(part.ops?.grooves);
        if (code === "-") return <span className="text-[var(--muted-foreground)]">-</span>;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-amber-100 text-amber-700 font-mono text-xs cursor-help">
                  {code}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs whitespace-pre-line">{formatGroovesDescription(part.ops?.grooves)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      case "holes": {
        const code = formatHolesShortcode(part.ops?.holes);
        if (code === "-") return <span className="text-[var(--muted-foreground)]">-</span>;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-purple-100 text-purple-700 font-mono text-xs cursor-help">
                  {code}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs whitespace-pre-line">{formatHolesDescription(part.ops?.holes)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      case "cnc": {
        const code = formatCncShortcode(part.ops);
        if (code === "-") return <span className="text-[var(--muted-foreground)]">-</span>;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-emerald-100 text-emerald-700 font-mono text-xs cursor-help">
                  {code}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs whitespace-pre-line">{formatCncDescription(part.ops)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      case "notes": {
        const notes = part.notes;
        if (!notes) return <span className="text-[var(--muted-foreground)]">-</span>;
        // Combine all note types
        const noteText = notes.operator || notes.cnc || notes.design || "";
        if (!noteText) return <span className="text-[var(--muted-foreground)]">-</span>;
        return (
          <span className="text-xs truncate max-w-[100px] inline-block" title={noteText}>
            {noteText.length > 20 ? noteText.slice(0, 20) + "…" : noteText}
          </span>
        );
      }
      default:
        return null;
    }
  };

  if (parts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Layers className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-1">No Parts Yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Add parts using quick parse, manual entry, or import from files to
              see them here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasSelection = selectedPartIds.length > 0;
  const allSelected = parts.length > 0 && selectedPartIds.length === parts.length;
  const someSelected = selectedPartIds.length > 0 && selectedPartIds.length < parts.length;

  return (
    <Card>
      <CardHeader className="pb-4">
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
          
          {/* Bulk Actions Toolbar */}
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 mr-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!canUndo()}
                className="h-8 px-2"
                title="Undo (⌘Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!canRedo()}
                className="h-8 px-2"
                title="Redo (⌘⇧Z)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Selection Actions */}
            {hasSelection ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copySelectedParts}
                  className="h-8 px-2"
                  title="Copy (⌘C)"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={duplicateSelectedParts}
                  className="h-8 px-2"
                  title="Duplicate (⌘D)"
                >
                  <Clipboard className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeSelectedParts}
                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete (Delete/Backspace)"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8 px-2"
                  title="Clear Selection (Esc)"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </>
            ) : (
              <>
                {clipboard.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={pasteParts}
                    className="h-8 px-2"
                    title="Paste (⌘V)"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-1" />
                    Paste ({clipboard.length})
                  </Button>
                )}
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <GripVertical className="h-3 w-3" />
                  <span className="hidden sm:inline">Drag columns to reorder</span>
                </div>
              </>
            )}
            
            <div className="hidden md:block text-sm text-[var(--muted-foreground)] border-l border-[var(--border)] pl-2 ml-1">
              Total: {(totalArea / 1_000_000).toFixed(2)} m²
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="rounded border-[var(--border)] cursor-pointer"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllParts();
                          } else {
                            clearSelection();
                          }
                        }}
                        title="Select all (⌘A)"
                      />
                    </div>
                  </TableHead>
                  <SortableContext
                    items={visibleColumns}
                    strategy={horizontalListSortingStrategy}
                  >
                    {visibleColumns.map((colKey) => (
                      <SortableTableHead
                        key={colKey}
                        id={colKey}
                        column={COLUMN_DEFS[colKey]}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    ))}
                  </SortableContext>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedParts.map((part) => {
                  const isSelected = selectedPartIds.includes(part.part_id);
                  return (
                  <TableRow
                    key={part.part_id}
                    onClick={(e) => handlePartClick(part.part_id, e)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected && "bg-[var(--cai-teal)]/10 hover:bg-[var(--cai-teal)]/15",
                      !isSelected && "hover:bg-[var(--muted)]"
                    )}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="rounded border-[var(--border)] cursor-pointer"
                          checked={isSelected}
                          onChange={(e) => handleCheckboxChange(part.part_id, e.target.checked)}
                        />
                      </div>
                    </TableCell>
                    {visibleColumns.map((colKey) => {
                      const col = COLUMN_DEFS[colKey];
                      return (
                        <TableCell
                          key={colKey}
                          className={cn(
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center"
                          )}
                        >
                          {renderCell(part, colKey)}
                        </TableCell>
                      );
                    })}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingPartId(part.part_id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removePart(part.part_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>
      
      {/* Edit Modal */}
      {editingPartId && (
        <PartEditModal
          partId={editingPartId}
          onClose={() => setEditingPartId(null)}
        />
      )}
    </Card>
  );
}
