"use client";

import * as React from "react";
import { RefreshCw, AlertCircle, Table2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpreadsheetPreviewProps {
  url: string;
  mimeType: string;
  fileName: string;
  className?: string;
}

interface SheetData {
  name: string;
  data: string[][];
}

export function SpreadsheetPreview({
  url,
  mimeType,
  fileName,
  className,
}: SpreadsheetPreviewProps) {
  const [sheets, setSheets] = React.useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadSpreadsheet() {
      try {
        setLoading(true);
        setError(null);

        // Fetch the file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch file");
        }

        const isCSV =
          mimeType === "text/csv" ||
          mimeType === "text/plain" ||
          fileName.toLowerCase().endsWith(".csv");

        if (isCSV) {
          // Parse CSV
          const text = await response.text();
          const { default: Papa } = await import("papaparse");
          const result = Papa.parse(text, { header: false });
          
          if (result.errors.length > 0) {
            console.warn("CSV parse warnings:", result.errors);
          }
          
          setSheets([{ name: "Sheet1", data: result.data as string[][] }]);
        } else {
          // Parse Excel
          const arrayBuffer = await response.arrayBuffer();
          const { read, utils } = await import("xlsx");
          const workbook = read(arrayBuffer, { type: "array" });

          const parsedSheets: SheetData[] = workbook.SheetNames.map((name) => {
            const worksheet = workbook.Sheets[name];
            const data: string[][] = utils.sheet_to_json(worksheet, {
              header: 1,
              raw: false,
              defval: "",
            });
            return { name, data };
          });

          setSheets(parsedSheets);
        }
      } catch (err) {
        console.error("Failed to load spreadsheet:", err);
        setError(err instanceof Error ? err.message : "Failed to load spreadsheet");
      } finally {
        setLoading(false);
      }
    }

    if (url) {
      loadSpreadsheet();
    }
  }, [url, mimeType, fileName]);

  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">Loading spreadsheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
        <p className="text-sm font-medium text-red-600">Failed to preview</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{error}</p>
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <FileSpreadsheet className="h-12 w-12 text-[var(--muted-foreground)] mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">No data in spreadsheet</p>
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Sheet Tabs (for Excel with multiple sheets) */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--muted)]/50 border-b border-[var(--border)] overflow-x-auto flex-shrink-0">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap",
                index === activeSheet
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--card)]/50"
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--muted)] z-10">
            <tr>
              {/* Row number header */}
              <th className="p-1.5 text-center text-[var(--muted-foreground)] font-medium border-b border-r border-[var(--border)] w-10 bg-[var(--muted)]">
                #
              </th>
              {/* Column headers (A, B, C, etc.) */}
              {currentSheet.data[0]?.map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="p-1.5 text-center text-[var(--muted-foreground)] font-medium border-b border-r border-[var(--border)] min-w-[80px] bg-[var(--muted)]"
                >
                  {getColumnLabel(colIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentSheet.data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  "hover:bg-[var(--muted)]/30",
                  rowIndex === 0 && "bg-[var(--muted)]/20 font-medium"
                )}
              >
                {/* Row number */}
                <td className="p-1.5 text-center text-[var(--muted-foreground)] border-b border-r border-[var(--border)] bg-[var(--muted)]/50 font-mono">
                  {rowIndex + 1}
                </td>
                {/* Data cells */}
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="p-1.5 border-b border-r border-[var(--border)] max-w-[200px] truncate"
                    title={String(cell)}
                  >
                    {cell}
                  </td>
                ))}
                {/* Fill empty cells if row is shorter than header */}
                {row.length < (currentSheet.data[0]?.length || 0) &&
                  Array.from({ length: (currentSheet.data[0]?.length || 0) - row.length }).map(
                    (_, i) => (
                      <td
                        key={`empty-${i}`}
                        className="p-1.5 border-b border-r border-[var(--border)]"
                      />
                    )
                  )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-3 py-2 text-xs text-[var(--muted-foreground)] border-t border-[var(--border)] bg-[var(--muted)]/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Table2 className="h-3 w-3" />
            {currentSheet.data.length} rows
          </span>
          <span>×</span>
          <span>{currentSheet.data[0]?.length || 0} columns</span>
        </div>
      </div>
    </div>
  );
}

// Convert column index to Excel-style column letter (0 -> A, 1 -> B, ..., 26 -> AA, etc.)
function getColumnLabel(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}


