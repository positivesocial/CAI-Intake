/**
 * CAI Intake - CSV Export
 * 
 * Exports cutlists to CSV format for spreadsheet compatibility.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface CsvExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include header row */
  includeHeader?: boolean;
  /** Delimiter character */
  delimiter?: "," | ";" | "\t";
  /** Include edging columns */
  includeEdging?: boolean;
  /** Include notes column */
  includeNotes?: boolean;
  /** Include group column */
  includeGroup?: boolean;
  /** Column order */
  columns?: string[];
}

const DEFAULT_OPTIONS: CsvExportOptions = {
  units: "mm",
  includeHeader: true,
  delimiter: ",",
  includeEdging: true,
  includeNotes: true,
  includeGroup: true,
};

const DEFAULT_COLUMNS = [
  "part_id",
  "label",
  "qty",
  "length",
  "width",
  "thickness",
  "material",
  "grain",
  "rotate",
  "group",
  "edging_l1",
  "edging_l2",
  "edging_w1",
  "edging_w2",
  "notes",
];

function escapeCell(value: string, delimiter: string): string {
  // If value contains delimiter, newline, or quote, wrap in quotes
  if (value.includes(delimiter) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCsvExport(
  cutlist: ExportableCutlist,
  options: CsvExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  // Build column list
  let columns = opts.columns ?? DEFAULT_COLUMNS;
  
  if (!opts.includeEdging) {
    columns = columns.filter(c => !c.startsWith("edging_"));
  }
  if (!opts.includeNotes) {
    columns = columns.filter(c => c !== "notes");
  }
  if (!opts.includeGroup) {
    columns = columns.filter(c => c !== "group");
  }
  
  const rows: string[] = [];
  
  // Header row
  if (opts.includeHeader) {
    const headerMap: Record<string, string> = {
      part_id: "Part ID",
      label: "Label",
      qty: "Qty",
      length: `Length (${targetUnit})`,
      width: `Width (${targetUnit})`,
      thickness: `Thickness (${targetUnit})`,
      material: "Material",
      grain: "Grain",
      rotate: "Can Rotate",
      group: "Group",
      edging_l1: "Edge L1",
      edging_l2: "Edge L2",
      edging_w1: "Edge W1",
      edging_w2: "Edge W2",
      notes: "Notes",
    };
    
    rows.push(columns.map(c => escapeCell(headerMap[c] ?? c, delimiter)).join(delimiter));
  }
  
  // Data rows
  for (const part of cutlist.parts) {
    const getEdging = (edge: string): string => {
      const edges = part.ops?.edging as { edges?: Record<string, { apply?: boolean }> } | undefined;
      return edges?.edges?.[edge]?.apply ? "Yes" : "";
    };
    
    const cellMap: Record<string, string> = {
      part_id: part.part_id,
      label: part.label ?? "",
      qty: part.qty.toString(),
      length: convertUnit(part.size.L, "mm", targetUnit).toFixed(targetUnit === "mm" ? 0 : 2),
      width: convertUnit(part.size.W, "mm", targetUnit).toFixed(targetUnit === "mm" ? 0 : 2),
      thickness: convertUnit(part.thickness_mm, "mm", targetUnit).toFixed(targetUnit === "mm" ? 0 : 2),
      material: part.material_id,
      grain: part.grain === "none" ? "" : part.grain,
      rotate: part.allow_rotation ? "Yes" : "No",
      group: part.group_id ?? "",
      edging_l1: getEdging("L1"),
      edging_l2: getEdging("L2"),
      edging_w1: getEdging("W1"),
      edging_w2: getEdging("W2"),
      notes: part.notes?.operator ?? "",
    };
    
    rows.push(columns.map(c => escapeCell(cellMap[c] ?? "", delimiter)).join(delimiter));
  }
  
  return rows.join("\n");
}





