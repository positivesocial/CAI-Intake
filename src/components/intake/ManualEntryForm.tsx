"use client";

import * as React from "react";
import { Plus, Trash2, Copy, ArrowDown, Keyboard, GripVertical, Check, ChevronDown } from "lucide-react";
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
import { useIntakeStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import type { CutPart, CutlistCapabilities } from "@/lib/schema";
import { generateAutoNotesFromPartOps, mergeAutoNotes } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/hooks/use-column-order";
import { OperationsInput, type OperationsData } from "@/components/operations";

export interface ManualEntryFormRef {
  addRowFromPart: (part: CutPart) => void;
}

interface ManualEntryFormProps {
  onPartAdded?: (part: CutPart) => void;
}

interface RowData {
  id: string;
  label: string;
  qty: string;
  L: string;
  W: string;
  thickness_mm: string;
  material_id: string;
  allow_rotation: boolean;
  group_id: string;
  notes: string;
  // Edging per edge (legacy)
  edge_L1: boolean;
  edge_L2: boolean;
  edge_W1: boolean;
  edge_W2: boolean;
  edgeband_id: string;
  // Grooves (legacy - count)
  groove_count: string;
  groove_side: string;
  // Holes (legacy)
  hole_pattern: string;
  // CNC (legacy)
  cnc_program: string;
  // NEW: Structured operations data
  operations: OperationsData;
}

const createEmptyRow = (defaultMaterial: string, defaultThickness: string, defaultEdgeband: string): RowData => ({
  id: generateId("ROW"),
  label: "",
  qty: "1",
  L: "",
  W: "",
  thickness_mm: defaultThickness,
  material_id: defaultMaterial,
  allow_rotation: true,
  group_id: "",
  notes: "",
  // Edging (legacy)
  edge_L1: false,
  edge_L2: false,
  edge_W1: false,
  edge_W2: false,
  edgeband_id: defaultEdgeband,
  // Grooves (legacy)
  groove_count: "",
  groove_side: "",
  // Holes (legacy)
  hole_pattern: "",
  // CNC (legacy)
  cnc_program: "",
  // NEW: Structured operations
  operations: {
    edgebanding: { edgeband_id: defaultEdgeband, sides: { L1: false, L2: false, W1: false, W2: false } },
    grooves: [],
    holes: [],
    cnc: [],
  },
});

// Base column definitions
interface ColumnDef {
  header: string;
  width: string;
  minWidth?: string;
  placeholder?: string;
  type: "text" | "number" | "select" | "checkbox" | "multi-checkbox";
  required?: boolean;
  /** Capability required to show this column */
  capability?: keyof CutlistCapabilities | (keyof CutlistCapabilities)[];
  /** Show in advanced mode only */
  advancedOnly?: boolean;
  /** Color class for header */
  colorClass?: string;
}

const COLUMN_DEFS: Record<string, ColumnDef> = {
  label: { header: "Label", width: "140px", minWidth: "120px", placeholder: "Part name", type: "text" },
  L: { header: "L (mm)", width: "80px", minWidth: "70px", placeholder: "720", type: "number", required: true },
  W: { header: "W (mm)", width: "80px", minWidth: "70px", placeholder: "560", type: "number", required: true },
  thickness_mm: { header: "T (mm)", width: "70px", minWidth: "60px", placeholder: "18", type: "number" },
  qty: { header: "Qty", width: "60px", minWidth: "50px", placeholder: "1", type: "number" },
  material_id: { header: "Material", width: "160px", minWidth: "140px", type: "select" },
  allow_rotation: { header: "Rot", width: "50px", minWidth: "50px", type: "checkbox" },
  // NEW: Combined operations column with popup selectors
  operations: { header: "Operations", width: "180px", minWidth: "160px", type: "text", capability: ["edging", "grooves", "cnc_holes", "cnc_routing", "custom_cnc"], colorClass: "text-teal-600" },
  // Legacy Edging columns (hidden by default, shown in advanced mode)
  edge_L1: { header: "L1", width: "40px", minWidth: "40px", type: "checkbox", capability: "edging", colorClass: "text-blue-600", advancedOnly: true },
  edge_L2: { header: "L2", width: "40px", minWidth: "40px", type: "checkbox", capability: "edging", colorClass: "text-blue-600", advancedOnly: true },
  edge_W1: { header: "W1", width: "40px", minWidth: "40px", type: "checkbox", capability: "edging", colorClass: "text-blue-600", advancedOnly: true },
  edge_W2: { header: "W2", width: "40px", minWidth: "40px", type: "checkbox", capability: "edging", colorClass: "text-blue-600", advancedOnly: true },
  edgeband_id: { header: "Edgeband", width: "120px", minWidth: "100px", type: "select", capability: "edging", colorClass: "text-blue-600", advancedOnly: true },
  // Legacy Groove columns
  groove_count: { header: "Grooves", width: "70px", minWidth: "60px", placeholder: "0", type: "number", capability: "grooves", colorClass: "text-amber-600", advancedOnly: true },
  groove_side: { header: "G.Side", width: "70px", minWidth: "60px", placeholder: "L1", type: "text", capability: "grooves", colorClass: "text-amber-600", advancedOnly: true },
  // Legacy Holes
  hole_pattern: { header: "Holes", width: "80px", minWidth: "70px", placeholder: "32mm", type: "text", capability: "cnc_holes", colorClass: "text-purple-600", advancedOnly: true },
  // Legacy CNC
  cnc_program: { header: "CNC Prog", width: "100px", minWidth: "80px", placeholder: "Program", type: "text", capability: ["cnc_routing", "custom_cnc"], colorClass: "text-emerald-600", advancedOnly: true },
  // Other
  group_id: { header: "Group", width: "90px", minWidth: "80px", placeholder: "Group", type: "text", capability: "advanced_grouping" },
  notes: { header: "Notes", width: "120px", minWidth: "100px", placeholder: "Notes", type: "text", capability: "part_notes" },
};

type ColumnKey = keyof typeof COLUMN_DEFS;

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "label", "L", "W", "thickness_mm", "qty", "material_id", "allow_rotation",
  "operations", // NEW: Combined operations column
  "edge_L1", "edge_L2", "edge_W1", "edge_W2", "edgeband_id", // Legacy - advanced mode only
  "groove_count", "groove_side", // Legacy
  "hole_pattern", // Legacy
  "cnc_program", // Legacy
  "group_id", "notes"
];

// Sortable header cell component
function SortableHeaderCell({
  id,
  column,
}: {
  id: string;
  column: ColumnDef;
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
    width: column.width,
    minWidth: column.minWidth || column.width,
    maxWidth: column.width,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-2 py-2 text-left text-xs font-medium border-b border-r border-[var(--border)] select-none whitespace-nowrap",
        column.required ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        column.colorClass,
        isDragging && "opacity-80 bg-[var(--cai-teal)]/10 shadow-lg rounded"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded flex-shrink-0",
            "text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]",
            "hover:bg-[var(--muted)] transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="Drag to reorder column"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className="truncate">
          {column.header}
          {column.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </div>
    </th>
  );
}

export const ManualEntryForm = React.forwardRef<ManualEntryFormRef, ManualEntryFormProps>(
  function ManualEntryForm({ onPartAdded }, ref) {
  const { currentCutlist, addPart, isAdvancedMode } = useIntakeStore();
  const capabilities = currentCutlist.capabilities;
  const defaultMaterial = currentCutlist.materials[0]?.material_id || "";
  const defaultThickness = "18";
  const defaultEdgeband = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";

  // Column order state with persistence
  const [columnOrder, setColumnOrder] = useColumnOrder<ColumnKey>(
    "manual-entry-columns-v2",
    DEFAULT_COLUMN_ORDER
  );

  const [rows, setRows] = React.useState<RowData[]>([
    createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband),
    createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband),
    createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband),
  ]);
  const [focusedCell, setFocusedCell] = React.useState<{ row: number; col: number } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, Record<string, boolean>>>({});

  // Expose addRowFromPart method to parent via ref
  React.useImperativeHandle(ref, () => ({
    addRowFromPart: (part: CutPart) => {
      // Extract edgebanding sides from ops
      const ebSides = {
        L1: !!part.ops?.edging?.edges?.L1?.apply,
        L2: !!part.ops?.edging?.edges?.L2?.apply,
        W1: !!part.ops?.edging?.edges?.W1?.apply,
        W2: !!part.ops?.edging?.edges?.W2?.apply,
      };
      const ebId = part.ops?.edging?.edges?.L1?.edgeband_id || defaultEdgeband;

      // Convert CutPart to RowData format
      const newRow: RowData = {
        id: generateId("ROW"),
        label: part.label || "",
        qty: part.qty.toString(),
        L: part.size.L.toString(),
        W: part.size.W.toString(),
        thickness_mm: part.thickness_mm.toString(),
        material_id: part.material_id || defaultMaterial,
        allow_rotation: part.allow_rotation ?? true,
        group_id: part.group_id || "",
        notes: part.notes?.operator || "",
        // Legacy Edging
        edge_L1: ebSides.L1,
        edge_L2: ebSides.L2,
        edge_W1: ebSides.W1,
        edge_W2: ebSides.W2,
        edgeband_id: ebId,
        // Legacy Grooves
        groove_count: part.ops?.grooves?.length?.toString() || "",
        groove_side: part.ops?.grooves?.[0]?.side || "",
        // Legacy Holes
        hole_pattern: part.ops?.holes?.[0]?.pattern_id || "",
        // Legacy CNC
        cnc_program: (part.ops?.custom_cnc_ops?.[0]?.payload as { program_name?: string } | undefined)?.program_name || "",
        // NEW: Structured operations
        operations: {
          edgebanding: { edgeband_id: ebId, sides: ebSides },
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
        },
      };

      // Add the row to the table (insert at first empty row or at end)
      setRows((prev) => {
        // Find first empty row (no L and W)
        const emptyIndex = prev.findIndex(r => !r.L && !r.W);
        if (emptyIndex >= 0) {
          // Replace empty row
          return prev.map((r, i) => i === emptyIndex ? newRow : r);
        }
        // Add to end
        return [...prev, newRow];
      });
    },
  }), [defaultMaterial, defaultEdgeband]);

  const tableRef = React.useRef<HTMLDivElement>(null);
  const inputRefs = React.useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  const materialOptions = currentCutlist.materials.map((m) => ({
    value: m.material_id,
    label: `${m.name} (${m.thickness_mm}mm)`,
  }));

  const edgebandOptions = (currentCutlist.edgebands || []).map((e) => ({
    value: e.edgeband_id,
    label: `${e.name} (${e.thickness_mm}mm)`,
  }));

  // Helper to check if capability is enabled
  const isCapabilityEnabled = React.useCallback((cap: keyof CutlistCapabilities | (keyof CutlistCapabilities)[]): boolean => {
    if (Array.isArray(cap)) {
      return cap.some(c => !!capabilities[c]);
    }
    return !!capabilities[cap];
  }, [capabilities]);

  // Filter columns based on capabilities and advanced mode
  const visibleColumns = React.useMemo(() => {
    return columnOrder.filter((col) => {
      const def = COLUMN_DEFS[col];
      if (!def) return false;
      
      // Check capability requirement
      if (def.capability && !isCapabilityEnabled(def.capability)) {
        return false;
      }
      
      // Check advanced mode requirement
      if (def.advancedOnly && !isAdvancedMode) {
        return false;
      }
      
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

  const getInputRef = (rowIndex: number, colKey: string) => {
    return inputRefs.current.get(`${rowIndex}-${colKey}`);
  };

  const setInputRef = (rowIndex: number, colKey: string, el: HTMLInputElement | HTMLSelectElement | null) => {
    const key = `${rowIndex}-${colKey}`;
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  };

  const focusCell = (rowIndex: number, colIndex: number) => {
    const colKey = visibleColumns[colIndex];
    if (!colKey) return;
    const input = getInputRef(rowIndex, colKey);
    if (input) {
      input.focus();
      if (input instanceof HTMLInputElement) {
        input.select();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const totalCols = visibleColumns.length;
    const totalRows = rows.length;

    switch (e.key) {
      case "Tab":
        break;

      case "Enter":
        e.preventDefault();
        const row = rows[rowIndex];
        if (row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0) {
          handleAddPart(rowIndex);
          const nextRow = rowIndex + 1;
          if (nextRow >= totalRows) {
            addNewRow();
          }
          setTimeout(() => focusCell(nextRow < totalRows ? nextRow : totalRows, 0), 50);
        } else {
          if (rowIndex < totalRows - 1) {
            focusCell(rowIndex + 1, 0);
          } else {
            addNewRow();
            setTimeout(() => focusCell(totalRows, 0), 50);
          }
        }
        break;

      case "ArrowDown":
        if (!e.shiftKey) {
          e.preventDefault();
          if (rowIndex < totalRows - 1) {
            focusCell(rowIndex + 1, colIndex);
          }
        }
        break;

      case "ArrowUp":
        if (!e.shiftKey) {
          e.preventDefault();
          if (rowIndex > 0) {
            focusCell(rowIndex - 1, colIndex);
          }
        }
        break;

      case "ArrowRight":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (colIndex < totalCols - 1) {
            focusCell(rowIndex, colIndex + 1);
          }
        }
        break;

      case "ArrowLeft":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (colIndex > 0) {
            focusCell(rowIndex, colIndex - 1);
          }
        }
        break;

      case "Escape":
        e.preventDefault();
        (e.target as HTMLElement).blur();
        break;
    }
  };

  const updateRow = (rowIndex: number, key: string, value: string | boolean) => {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row))
    );
    if (errors[rows[rowIndex].id]?.[key]) {
      setErrors((prev) => ({
        ...prev,
        [rows[rowIndex].id]: {
          ...prev[rows[rowIndex].id],
          [key]: false,
        },
      }));
    }
  };

  const addNewRow = () => {
    setRows((prev) => [...prev, createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband)]);
  };

  const removeRow = (rowIndex: number) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    }
  };

  const duplicateRow = (rowIndex: number) => {
    const rowToCopy = rows[rowIndex];
    const newRow = { ...rowToCopy, id: generateId("ROW"), label: rowToCopy.label ? `${rowToCopy.label} (copy)` : "" };
    setRows((prev) => [...prev.slice(0, rowIndex + 1), newRow, ...prev.slice(rowIndex + 1)]);
  };

  const validateRow = (row: RowData): boolean => {
    const rowErrors: Record<string, boolean> = {};
    let valid = true;

    if (!row.L || parseFloat(row.L) <= 0) {
      rowErrors.L = true;
      valid = false;
    }
    if (!row.W || parseFloat(row.W) <= 0) {
      rowErrors.W = true;
      valid = false;
    }
    if (!row.qty || parseInt(row.qty) <= 0) {
      rowErrors.qty = true;
      valid = false;
    }

    setErrors((prev) => ({ ...prev, [row.id]: rowErrors }));
    return valid;
  };

  const handleAddPart = (rowIndex: number) => {
    const row = rows[rowIndex];
    
    if (!validateRow(row)) return;

    // Use NEW structured operations data
    const { operations } = row;

    // Build edging ops from structured data
    const hasEdging = Object.values(operations.edgebanding.sides).some(Boolean);
    const edgingOps = hasEdging && capabilities.edging ? {
      edging: {
        edges: {
          ...(operations.edgebanding.sides.L1 && { L1: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(operations.edgebanding.sides.L2 && { L2: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(operations.edgebanding.sides.W1 && { W1: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
          ...(operations.edgebanding.sides.W2 && { W2: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
        },
      },
    } : {};

    // Build groove ops from structured data
    const grooveOps = operations.grooves.length > 0 && capabilities.grooves ? {
      grooves: operations.grooves.map((g, i) => ({
        groove_id: generateId("GRV"),
        side: g.side as "L1" | "L2" | "W1" | "W2",
        offset_mm: 10 + i * 32, // Default spacing from edge
        depth_mm: g.depth_mm,
        width_mm: g.width_mm,
        // Store type code in notes for reference
        notes: `Type: ${g.type_code}`,
      })),
    } : {};

    // Build hole ops from structured data
    const holeOps = operations.holes.length > 0 && capabilities.cnc_holes ? {
      holes: operations.holes.map(h => ({
        pattern_id: h.type_code,
        face: (h.face === "F" ? "front" : "back") as "front" | "back",
        notes: `Pattern: ${h.type_code}`,
      })),
    } : {};

    // Build CNC ops from structured data
    const cncOps = operations.cnc.length > 0 && (capabilities.cnc_routing || capabilities.custom_cnc) ? {
      custom_cnc_ops: operations.cnc.map(c => ({
        op_type: "program" as const,
        payload: { program_name: c.type_code },
        notes: `CNC: ${c.type_code}`,
      })),
    } : {};

    // Combine all ops
    const ops = {
      ...edgingOps,
      ...grooveOps,
      ...holeOps,
      ...cncOps,
    };

    // Generate auto-notes from operations
    const hasOps = Object.keys(ops).length > 0;
    const autoNotes = hasOps ? generateAutoNotesFromPartOps(ops) : "";
    const existingNotes = row.notes ? { operator: row.notes } : undefined;
    const finalNotes = autoNotes 
      ? mergeAutoNotes(existingNotes, autoNotes)
      : existingNotes;

    const part: CutPart = {
      part_id: generateId("P"),
      label: row.label || undefined,
      qty: parseInt(row.qty) || 1,
      size: {
        L: parseFloat(row.L),
        W: parseFloat(row.W),
      },
      thickness_mm: parseFloat(row.thickness_mm) || 18,
      material_id: row.material_id || defaultMaterial,
      allow_rotation: row.allow_rotation !== false, // Default to true (can rotate)
      group_id: row.group_id || undefined,
      notes: Object.keys(finalNotes || {}).length > 0 ? finalNotes : undefined,
      ops: hasOps ? ops : undefined,
      audit: {
        source_method: "manual",
        confidence: 1,
        human_verified: true,
      },
    };

    addPart(part);
    onPartAdded?.(part);

    // Clear the row for new entry
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband)
          : r
      )
    );
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[row.id];
      return newErrors;
    });
  };

  const handleAddAllParts = () => {
    let addedCount = 0;
    rows.forEach((row, index) => {
      if (row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0) {
        if (validateRow(row)) {
          handleAddPart(index);
          addedCount++;
        }
      }
    });
    return addedCount;
  };

  const hasValidRows = rows.some((row) => row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0);

  // Render cell content based on column type
  const renderCell = (
    row: RowData,
    rowIndex: number,
    colKey: ColumnKey,
    colIndex: number
  ) => {
    const col = COLUMN_DEFS[colKey];
    if (!col) return null;
    
    const hasError = errors[row.id]?.[colKey];
    const value = row[colKey as keyof RowData];

    if (col.type === "checkbox") {
      return (
        <div className="flex items-center justify-center h-8">
          <button
            type="button"
            onClick={() => updateRow(rowIndex, colKey, !value)}
            onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
            onBlur={() => setFocusedCell(null)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                updateRow(rowIndex, colKey, !value);
              } else {
                handleKeyDown(e, rowIndex, colIndex);
              }
            }}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
              "focus:outline-none focus:ring-2 focus:ring-[var(--cai-teal)] focus:ring-offset-1",
              value
                ? col.colorClass 
                  ? `bg-current border-current ${col.colorClass}`
                  : "bg-[var(--cai-teal)] border-[var(--cai-teal)]"
                : "bg-transparent border-[var(--border)] hover:border-[var(--cai-teal)]/50"
            )}
            title={col.header}
          >
            {value && (
              <Check className="w-3 h-3 text-white" />
            )}
          </button>
        </div>
      );
    }

    // NEW: Operations column with combined selectors
    if (colKey === "operations") {
      return (
        <div className="h-8 flex items-center px-1">
          <OperationsInput
            value={row.operations}
            onChange={(newOps) => {
              // Update operations and sync to legacy fields
              setRows((prev) =>
                prev.map((r, i) =>
                  i === rowIndex
                    ? {
                        ...r,
                        operations: newOps,
                        // Sync to legacy fields
                        edge_L1: newOps.edgebanding.sides.L1 || false,
                        edge_L2: newOps.edgebanding.sides.L2 || false,
                        edge_W1: newOps.edgebanding.sides.W1 || false,
                        edge_W2: newOps.edgebanding.sides.W2 || false,
                        edgeband_id: newOps.edgebanding.edgeband_id || defaultEdgeband,
                        groove_count: newOps.grooves.length.toString(),
                        groove_side: newOps.grooves[0]?.side || "",
                        hole_pattern: newOps.holes[0]?.type_code || "",
                        cnc_program: newOps.cnc[0]?.type_code || "",
                      }
                    : r
                )
              );
            }}
            compact={true}
          />
        </div>
      );
    }

    if (col.type === "select") {
      // Determine options based on column
      const options = colKey === "material_id" ? materialOptions : 
                     colKey === "edgeband_id" ? edgebandOptions : [];
      
      return (
        <select
          ref={(el) => setInputRef(rowIndex, colKey, el)}
          value={value as string}
          onChange={(e) => updateRow(rowIndex, colKey, e.target.value)}
          onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
          onBlur={() => setFocusedCell(null)}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
          className={cn(
            "w-full h-8 px-2 text-sm bg-transparent border-0 outline-none",
            "focus:ring-2 focus:ring-inset focus:ring-[var(--cai-teal)]",
            hasError && "text-red-600"
          )}
        >
          {options.length > 0 ? (
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          ) : (
            <option value="">No options</option>
          )}
        </select>
      );
    }

    return (
      <input
        ref={(el) => setInputRef(rowIndex, colKey, el)}
        type={col.type}
        value={value as string}
        placeholder={col.placeholder}
        onChange={(e) => updateRow(rowIndex, colKey, e.target.value)}
        onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
        onBlur={() => setFocusedCell(null)}
        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
        className={cn(
          "w-full h-8 px-2 text-sm bg-transparent border-0 outline-none",
          "focus:ring-2 focus:ring-inset focus:ring-[var(--cai-teal)]",
          "placeholder:text-[var(--muted-foreground)]/50",
          col.type === "number" && "text-right tabular-nums",
          hasError && "text-red-600 placeholder:text-red-400"
        )}
        min={col.type === "number" ? "0" : undefined}
        step={col.type === "number" ? "any" : undefined}
      />
    );
  };

  // Count enabled operation types for badge
  const enabledOpsCount = [
    capabilities.edging,
    capabilities.grooves,
    capabilities.cnc_holes,
    capabilities.cnc_routing || capabilities.custom_cnc,
  ].filter(Boolean).length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Add Parts Manually</CardTitle>
            <Badge variant="teal">Spreadsheet Entry</Badge>
            {enabledOpsCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {enabledOpsCount} operation{enabledOpsCount > 1 ? "s" : ""} enabled
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <GripVertical className="h-3 w-3" />
            <span>Drag columns to reorder</span>
            <span className="mx-1">•</span>
            <Keyboard className="h-3 w-3" />
            <span>Tab/↑↓ to navigate</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={tableRef} className="overflow-x-auto w-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full min-w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-[var(--muted)]">
                  <th className="w-8 px-2 py-2 text-center text-xs font-medium text-[var(--muted-foreground)] border-b border-r border-[var(--border)]">
                    #
                  </th>
                  <SortableContext
                    items={visibleColumns}
                    strategy={horizontalListSortingStrategy}
                  >
                    {visibleColumns.map((colKey) => (
                      <SortableHeaderCell
                        key={colKey}
                        id={colKey}
                        column={COLUMN_DEFS[colKey]}
                      />
                    ))}
                  </SortableContext>
                  <th className="w-20 px-2 py-2 text-center text-xs font-medium text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "group",
                      rowIndex % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--muted)]/30",
                      focusedCell?.row === rowIndex && "bg-[var(--cai-teal)]/5"
                    )}
                  >
                    <td className="px-2 py-1 text-center text-xs text-[var(--muted-foreground)] border-r border-[var(--border)]">
                      {rowIndex + 1}
                    </td>

                    {visibleColumns.map((colKey, colIndex) => {
                      const hasError = errors[row.id]?.[colKey];
                      const colDef = COLUMN_DEFS[colKey];
                      return (
                        <td
                          key={colKey}
                          className={cn(
                            "p-0 border-r border-[var(--border)]",
                            hasError && "bg-red-50"
                          )}
                          style={{
                            width: colDef.width,
                            minWidth: colDef.minWidth || colDef.width,
                            maxWidth: colDef.width,
                          }}
                        >
                          {renderCell(row, rowIndex, colKey, colIndex)}
                        </td>
                      );
                    })}

                    <td className="px-1 py-1 text-center border-[var(--border)]">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleAddPart(rowIndex)}
                          disabled={!row.L || !row.W}
                          className={cn(
                            "p-1 rounded hover:bg-[var(--cai-teal)]/20 text-[var(--cai-teal)]",
                            "disabled:opacity-30 disabled:cursor-not-allowed"
                          )}
                          title="Add this part (Enter)"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateRow(rowIndex)}
                          className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          title="Duplicate row"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          disabled={rows.length <= 1}
                          className={cn(
                            "p-1 rounded hover:bg-red-100 text-red-500",
                            "disabled:opacity-30 disabled:cursor-not-allowed"
                          )}
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--muted)]/50">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={addNewRow}>
              <ArrowDown className="h-4 w-4" />
              Add Row
            </Button>
            <span className="text-xs text-[var(--muted-foreground)]">
              {rows.filter((r) => r.L && r.W).length} rows with data
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddAllParts}
            disabled={!hasValidRows}
          >
            <Plus className="h-4 w-4" />
            Add All Parts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
