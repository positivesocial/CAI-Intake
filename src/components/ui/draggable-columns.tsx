"use client";

import * as React from "react";
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
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderCellProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SortableHeaderCell({
  id,
  children,
  className,
  style,
}: SortableHeaderCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const cellStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <th
      ref={setNodeRef}
      style={cellStyle}
      className={cn(
        "select-none",
        isDragging && "opacity-80 bg-[var(--cai-teal)]/10 shadow-lg",
        className
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
        <span className="flex-1">{children}</span>
      </div>
    </th>
  );
}

interface DraggableColumnsContextProps<T extends string> {
  columns: T[];
  onReorder: (columns: T[]) => void;
  children: React.ReactNode;
}

export function DraggableColumnsContext<T extends string>({
  columns,
  onReorder,
  children,
}: DraggableColumnsContextProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.indexOf(active.id as T);
      const newIndex = columns.indexOf(over.id as T);
      onReorder(arrayMove(columns, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// Export a simple wrapper for table headers
interface DraggableTableHeaderProps<T extends string> {
  columns: T[];
  onReorder: (columns: T[]) => void;
  renderHeader: (columnKey: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  getColumnStyle?: (columnKey: T) => React.CSSProperties | undefined;
  // Fixed columns that shouldn't be draggable (e.g., checkbox column, actions column)
  fixedStartColumns?: React.ReactNode;
  fixedEndColumns?: React.ReactNode;
}

export function DraggableTableHeader<T extends string>({
  columns,
  onReorder,
  renderHeader,
  headerClassName,
  cellClassName,
  getColumnStyle,
  fixedStartColumns,
  fixedEndColumns,
}: DraggableTableHeaderProps<T>) {
  return (
    <DraggableColumnsContext columns={columns} onReorder={onReorder}>
      <tr className={headerClassName}>
        {fixedStartColumns}
        {columns.map((col) => (
          <SortableHeaderCell
            key={col}
            id={col}
            className={cellClassName}
            style={getColumnStyle?.(col)}
          >
            {renderHeader(col)}
          </SortableHeaderCell>
        ))}
        {fixedEndColumns}
      </tr>
    </DraggableColumnsContext>
  );
}

