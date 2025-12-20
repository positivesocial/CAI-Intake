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
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/hooks/use-column-order";

// Column definitions
type ColumnKey = "label" | "L" | "W" | "thickness_mm" | "qty" | "material_id" | "rotate" | "group_id" | "edging";
type SortField = "label" | "qty" | "L" | "W" | "material_id";

const COLUMN_DEFS: Record<ColumnKey, {
  header: string;
  sortable?: SortField;
  align?: "left" | "right" | "center";
  width?: string;
  advancedOnly?: boolean;
  edgingOnly?: boolean;
}> = {
  label: { header: "Label", sortable: "label", align: "left" },
  L: { header: "Length", sortable: "L", align: "right" },
  W: { header: "Width", sortable: "W", align: "right" },
  thickness_mm: { header: "Thk", align: "right" },
  qty: { header: "Qty", sortable: "qty", align: "right" },
  material_id: { header: "Material", sortable: "material_id", align: "left" },
  rotate: { header: "Rotate", align: "center" },
  group_id: { header: "Group", align: "left", advancedOnly: true },
  edging: { header: "Edging", align: "left", edgingOnly: true },
};

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "label", "L", "W", "thickness_mm", "qty", "material_id", "rotate", "group_id", "edging"
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
  column: typeof COLUMN_DEFS[ColumnKey];
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
        isDragging && "opacity-80 bg-[var(--cai-teal)]/10 shadow-lg"
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
          <span>{column.header}</span>
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
    isAdvancedMode,
  } = useIntakeStore();

  const [sortField, setSortField] = React.useState<SortField>("label");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column order state with persistence
  const [columnOrder, setColumnOrder] = useColumnOrder<ColumnKey>(
    "parts-table-columns",
    DEFAULT_COLUMN_ORDER
  );

  const parts = currentCutlist.parts;

  // Filter visible columns based on mode and capabilities
  const visibleColumns = React.useMemo(() => {
    return columnOrder.filter((col) => {
      const def = COLUMN_DEFS[col];
      if (def.advancedOnly && !isAdvancedMode) return false;
      if (def.edgingOnly && !currentCutlist.capabilities.edging) return false;
      return true;
    });
  }, [columnOrder, isAdvancedMode, currentCutlist.capabilities.edging]);

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

  const togglePartSelection = (partId: string) => {
    if (selectedPartIds.includes(partId)) {
      deselectPart(partId);
    } else {
      selectPart(partId);
    }
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
      case "edging":
        return part.ops?.edging?.edges ? (
          <span className="text-xs font-mono">
            {Object.entries(part.ops.edging.edges)
              .filter(([, v]) => v?.apply)
              .map(([k]) => k)
              .join(", ") || "-"}
          </span>
        ) : (
          <span className="text-[var(--muted-foreground)]">-</span>
        );
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Parts List</CardTitle>
            <Badge variant="secondary">
              {parts.length} parts • {totalPieces} pcs
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <GripVertical className="h-3 w-3" />
              <span>Drag columns to reorder</span>
            </div>
            <div className="text-sm text-[var(--muted-foreground)]">
              Total area: {(totalArea / 1_000_000).toFixed(2)} m²
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
                    <input
                      type="checkbox"
                      className="rounded border-[var(--border)]"
                      checked={
                        selectedPartIds.length === parts.length &&
                        parts.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          parts.forEach((p) => selectPart(p.part_id));
                        } else {
                          parts.forEach((p) => deselectPart(p.part_id));
                        }
                      }}
                    />
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
                {sortedParts.map((part) => (
                  <TableRow
                    key={part.part_id}
                    className={cn(
                      selectedPartIds.includes(part.part_id) && "bg-[var(--muted)]"
                    )}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded border-[var(--border)]"
                        checked={selectedPartIds.includes(part.part_id)}
                        onChange={() => togglePartSelection(part.part_id)}
                      />
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
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            /* TODO: Implement edit */
                          }}
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
                ))}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}
