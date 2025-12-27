/**
 * CAI Intake - CutList Plus Export
 * 
 * Exports cutlists to CutList Plus-compatible CSV format.
 * CutList Plus can import CSV files with specific column headers.
 * 
 * CutList Plus CSV Import Format:
 * - Name: Part name/label
 * - Length: Length dimension (always first dimension)
 * - Width: Width dimension (always second dimension)  
 * - Qty: Quantity/count
 * - Material: Material name
 * - Grain Direction: "L" (length), "W" (width), or empty
 * - Thickness: Panel thickness
 * - Notes: Optional notes
 * - Edge Band 1-4: Optional edgeband codes
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
  /** Include edgebanding columns */
  includeEdgebanding?: boolean;
  /** Include thickness column */
  includeThickness?: boolean;
  /** Delimiter */
  delimiter?: "," | "\t";
}

const DEFAULT_OPTIONS: CutlistPlusExportOptions = {
  units: "mm",
  includeGrain: true,
  includeNotes: true,
  includeEdgebanding: true,
  includeThickness: true,
  delimiter: ",",
};

function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getEdgebandCode(ops: unknown, edge: "L1" | "L2" | "W1" | "W2"): string {
  if (!ops || typeof ops !== "object") return "";
  const opsObj = ops as { edgebanding?: Record<string, string> };
  return opsObj.edgebanding?.[edge] || "";
}

export function generateCutlistPlusExport(
  cutlist: ExportableCutlist,
  options: CutlistPlusExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // CutList Plus header row - using exact column names that CutList Plus expects
  const headers = [
    "Name",
    "Length",
    "Width",
    "Qty",
    "Material",
    ...(opts.includeThickness ? ["Thickness"] : []),
    ...(opts.includeGrain ? ["Grain Direction"] : []),
    ...(opts.includeEdgebanding ? ["Edge Band 1", "Edge Band 2", "Edge Band 3", "Edge Band 4"] : []),
    ...(opts.includeNotes ? ["Notes"] : []),
  ];
  
  lines.push(headers.join(delimiter));
  
  // Data rows
  for (const part of cutlist.parts) {
    // Get material name if available
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id;
    
    // Grain direction code - derive from allow_rotation
    // If part can't rotate, assume grain along L (most common)
    const grainCode = part.allow_rotation === false ? "L" : "";
    
    // Dimensions
    const length = convertUnit(part.size.L, "mm", targetUnit);
    const width = convertUnit(part.size.W, "mm", targetUnit);
    const thickness = convertUnit(part.thickness_mm, "mm", targetUnit);
    
    // Format based on unit system
    const formatDim = (val: number) => 
      targetUnit === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
    // Notes
    const notes = part.notes?.operator || "";
    
    const cells = [
      escapeCell(part.label ?? part.part_id, delimiter),
      formatDim(length),
      formatDim(width),
      part.qty.toString(),
      escapeCell(materialName, delimiter),
      ...(opts.includeThickness ? [formatDim(thickness)] : []),
      ...(opts.includeGrain ? [grainCode] : []),
      ...(opts.includeEdgebanding ? [
        getEdgebandCode(part.ops, "L1"),
        getEdgebandCode(part.ops, "L2"),
        getEdgebandCode(part.ops, "W1"),
        getEdgebandCode(part.ops, "W2"),
      ] : []),
      ...(opts.includeNotes ? [escapeCell(notes, delimiter)] : []),
    ];
    
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}
