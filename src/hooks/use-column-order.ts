"use client";

import * as React from "react";

/**
 * Hook to manage column ordering with localStorage persistence
 */
export function useColumnOrder<T extends string>(
  key: string,
  defaultColumns: T[]
): [T[], (columns: T[]) => void, (from: number, to: number) => void] {
  const [columns, setColumns] = React.useState<T[]>(() => {
    if (typeof window === "undefined") return defaultColumns;
    
    try {
      const stored = localStorage.getItem(`column-order-${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as T[];
        // Validate that stored columns match default columns
        if (
          parsed.length === defaultColumns.length &&
          parsed.every((col) => defaultColumns.includes(col))
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return defaultColumns;
  });

  // Persist to localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`column-order-${key}`, JSON.stringify(columns));
    }
  }, [key, columns]);

  const moveColumn = React.useCallback((fromIndex: number, toIndex: number) => {
    setColumns((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  return [columns, setColumns, moveColumn];
}



