/**
 * CAI Intake - MaxCut Export
 * 
 * Exports cutlists to MaxCut-compatible CSV format.
 * MaxCut can import CSV files with specific column headers.
 * 
 * MaxCut CSV Import Format:
 * - Part Name: Name/label of the part
 * - Length: Length dimension
 * - Width: Width dimension  
 * - Quantity: Number of pieces
 * - Material: Material name or code
 * - Grain: L (along length), W (along width), or empty (no grain)
 * - Thickness: Panel thickness
 * - Edge1-Edge4: Edgeband codes for each edge (L1, L2, W1, W2)
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface MaxcutExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include grain direction */
  includeGrain?: boolean;
  /** Include edgebanding columns */
  includeEdgebanding?: boolean;
  /** Delimiter (comma or semicolon) */
  delimiter?: "," | ";";
}

const DEFAULT_OPTIONS: MaxcutExportOptions = {
  units: "mm",
  includeGrain: true,
  includeEdgebanding: true,
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

export function generateMaxcutExport(
  cutlist: ExportableCutlist,
  options: MaxcutExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // MaxCut CSV header row
  const headers = [
    "Part Name",
    "Length",
    "Width",
    "Quantity",
    "Material",
    "Thickness",
    ...(opts.includeGrain ? ["Grain"] : []),
    ...(opts.includeEdgebanding ? ["Edge L1", "Edge L2", "Edge W1", "Edge W2"] : []),
  ];
  
  lines.push(headers.join(delimiter));
  
  // Data rows
  for (const part of cutlist.parts) {
    // Get material name if available
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id;
    
    // Grain direction: L, W, or empty - derive from allow_rotation
    // If part can't rotate, assume grain along L (most common)
    const grainCode = part.allow_rotation === false ? "L" : "";
    
    // Dimensions
    const length = convertUnit(part.size.L, "mm", targetUnit);
    const width = convertUnit(part.size.W, "mm", targetUnit);
    const thickness = convertUnit(part.thickness_mm, "mm", targetUnit);
    
    // Format based on unit system
    const formatDim = (val: number) => 
      targetUnit === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
    const cells = [
      escapeCell(part.label ?? part.part_id, delimiter),
      formatDim(length),
      formatDim(width),
      part.qty.toString(),
      escapeCell(materialName, delimiter),
      formatDim(thickness),
      ...(opts.includeGrain ? [grainCode] : []),
      ...(opts.includeEdgebanding ? [
        getEdgebandCode(part.ops, "L1"),
        getEdgebandCode(part.ops, "L2"),
        getEdgebandCode(part.ops, "W1"),
        getEdgebandCode(part.ops, "W2"),
      ] : []),
    ];
    
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}
