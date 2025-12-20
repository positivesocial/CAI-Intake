"use client";

import * as React from "react";
import { Plus, Trash2, Copy, ArrowDown, Keyboard, RotateCcw, GripVertical } from "lucide-react";
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
import type { CutPart } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/hooks/use-column-order";

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
}

const createEmptyRow = (defaultMaterial: string, defaultThickness: string): RowData => ({
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
});

// Column definitions
const COLUMN_DEFS = {
  label: { header: "Label", width: "15%", placeholder: "Part name", type: "text" as const },
  L: { header: "L (mm)", width: "10%", placeholder: "720", type: "number" as const, required: true },
  W: { header: "W (mm)", width: "10%", placeholder: "560", type: "number" as const, required: true },
  thickness_mm: { header: "T (mm)", width: "8%", placeholder: "18", type: "number" as const },
  qty: { header: "Qty", width: "7%", placeholder: "1", type: "number" as const },
  material_id: { header: "Material", width: "20%", type: "select" as const },
  allow_rotation: { header: "Rotate", width: "8%", type: "checkbox" as const },
  group_id: { header: "Group", width: "10%", placeholder: "Group", type: "text" as const },
  notes: { header: "Notes", width: "12%", placeholder: "Notes", type: "text" as const },
};

type ColumnKey = keyof typeof COLUMN_DEFS;

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "label", "L", "W", "thickness_mm", "qty", "material_id", "allow_rotation", "group_id", "notes"
];

// Sortable header cell component
function SortableHeaderCell({
  id,
  column,
}: {
  id: string;
  column: { header: string; width: string; required?: boolean };
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
    minWidth: column.width,
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
        "px-2 py-2 text-left text-xs font-medium border-b border-r border-[var(--border)] select-none",
        column.required ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        isDragging && "opacity-80 bg-[var(--cai-teal)]/10 shadow-lg rounded"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded",
            "text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]",
            "hover:bg-[var(--muted)] transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="Drag to reorder column"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className="flex-1">
          {column.header}
          {column.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </div>
    </th>
  );
}

export function ManualEntryForm({ onPartAdded }: ManualEntryFormProps) {
  const { currentCutlist, addPart, isAdvancedMode } = useIntakeStore();
  const defaultMaterial = currentCutlist.materials[0]?.material_id || "";
  const defaultThickness = "18";

  // Column order state with persistence
  const [columnOrder, setColumnOrder] = useColumnOrder<ColumnKey>(
    "manual-entry-columns",
    DEFAULT_COLUMN_ORDER
  );

  const [rows, setRows] = React.useState<RowData[]>([
    createEmptyRow(defaultMaterial, defaultThickness),
    createEmptyRow(defaultMaterial, defaultThickness),
    createEmptyRow(defaultMaterial, defaultThickness),
  ]);
  const [focusedCell, setFocusedCell] = React.useState<{ row: number; col: number } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, Record<string, boolean>>>({});

  const tableRef = React.useRef<HTMLDivElement>(null);
  const inputRefs = React.useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  const materialOptions = currentCutlist.materials.map((m) => ({
    value: m.material_id,
    label: `${m.name} (${m.thickness_mm}mm)`,
  }));

  // Filter columns based on advanced mode, maintaining order
  const visibleColumns = React.useMemo(() => {
    const hiddenInSimple = ["group_id", "notes"];
    return columnOrder.filter(
      (col) => isAdvancedMode || !hiddenInSimple.includes(col)
    );
  }, [columnOrder, isAdvancedMode]);

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
    setRows((prev) => [...prev, createEmptyRow(defaultMaterial, defaultThickness)]);
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
      // Grain is determined by material; allow_rotation controls nesting behavior
      grain: row.allow_rotation ? "none" : "along_L",
      allow_rotation: row.allow_rotation,
      group_id: row.group_id || undefined,
      notes: row.notes ? { operator: row.notes } : undefined,
      audit: {
        source_method: "manual",
        confidence: 1,
        human_verified: true,
      },
    };

    addPart(part);
    onPartAdded?.(part);

    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              id: generateId("ROW"),
              label: "",
              qty: "1",
              L: "",
              W: "",
              group_id: "",
              notes: "",
            }
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
    const hasError = errors[row.id]?.[colKey];
    const value = row[colKey];

    if (col.type === "checkbox") {
      return (
        <div className="flex items-center justify-center h-8">
          <label className="flex items-center gap-1.5 cursor-pointer group/check">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => updateRow(rowIndex, colKey, e.target.checked)}
              onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
              onBlur={() => setFocusedCell(null)}
              onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--cai-teal)] focus:ring-[var(--cai-teal)] focus:ring-offset-0 cursor-pointer"
            />
            <RotateCcw className={cn(
              "h-3.5 w-3.5 transition-colors",
              value ? "text-[var(--cai-teal)]" : "text-[var(--muted-foreground)]/40"
            )} />
          </label>
        </div>
      );
    }

    if (col.type === "select") {
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
          {materialOptions.length > 0 ? (
            materialOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          ) : (
            <option value="">No materials</option>
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Add Parts Manually</CardTitle>
            <Badge variant="teal">Spreadsheet Entry</Badge>
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
                      return (
                        <td
                          key={colKey}
                          className={cn(
                            "p-0 border-r border-[var(--border)]",
                            hasError && "bg-red-50"
                          )}
                          style={{
                            width: COLUMN_DEFS[colKey].width,
                            minWidth: COLUMN_DEFS[colKey].width,
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
            Add All Parts to Inbox
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
