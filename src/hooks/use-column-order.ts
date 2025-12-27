"use client";

import * as React from "react";

/**
 * Hook to manage column ordering with localStorage persistence
 * Properly handles adding new columns and removing old ones
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
        
        // Filter out columns that no longer exist in defaults
        const validStored = parsed.filter((col) => defaultColumns.includes(col));
        
        // Find new columns that weren't in stored (added since last save)
        const newColumns = defaultColumns.filter((col) => !parsed.includes(col));
        
        // If we have valid stored columns, merge with new columns
        if (validStored.length > 0) {
          // Insert new columns at their default positions
          const result = [...validStored];
          for (const newCol of newColumns) {
            const defaultIndex = defaultColumns.indexOf(newCol);
            // Find the best position - after the column that precedes it in defaults
            let insertIndex = result.length;
            for (let i = defaultIndex - 1; i >= 0; i--) {
              const prevCol = defaultColumns[i];
              const prevIndex = result.indexOf(prevCol);
              if (prevIndex !== -1) {
                insertIndex = prevIndex + 1;
                break;
              }
            }
            result.splice(insertIndex, 0, newCol);
          }
          return result;
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





