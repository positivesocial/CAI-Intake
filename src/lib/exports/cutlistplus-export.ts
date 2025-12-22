/**
 * CAI Intake - CutList Plus Export
 * 
 * Exports cutlists to CutList Plus format.
 * CutList Plus is a popular woodworking optimization software.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface CutlistPlusExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include grain direction column */
  includeGrain?: boolean;
  /** Include notes column */
  includeNotes?: boolean;
  /** Delimiter */
  delimiter?: "," | "\t";
}

const DEFAULT_OPTIONS: CutlistPlusExportOptions = {
  units: "mm",
  includeGrain: true,
  includeNotes: true,
  delimiter: ",",
};

function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCutlistPlusExport(
  cutlist: ExportableCutlist,
  options: CutlistPlusExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // CutList Plus header row
  const headers = [
    "Part Name",
    "Length",
    "Width",
    "Qty",
    "Material",
    ...(opts.includeGrain ? ["Grain"] : []),
    ...(opts.includeNotes ? ["Notes"] : []),
  ];
  
  lines.push(headers.join(delimiter));
  
  // Data rows
  for (const part of cutlist.parts) {
    const grainCode = part.grain === "along_L" ? "L" : part.grain === "along_W" ? "W" : "";
    
    const cells = [
      escapeCell(part.label ?? part.part_id, delimiter),
      convertUnit(part.size.L, "mm", targetUnit).toFixed(targetUnit === "mm" ? 0 : 2),
      convertUnit(part.size.W, "mm", targetUnit).toFixed(targetUnit === "mm" ? 0 : 2),
      part.qty.toString(),
      escapeCell(part.material_id, delimiter),
      ...(opts.includeGrain ? [grainCode] : []),
      ...(opts.includeNotes ? [escapeCell(part.notes?.operator ?? "", delimiter)] : []),
    ];
    
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}




