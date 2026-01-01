/**
 * CAI Intake - CutList Plus Export
 * 
 * Exports cutlists to CutList Plus-compatible CSV format.
 * This format matches the exact CSV structure that CutList Plus FX exports/imports.
 * 
 * CutList Plus CSV Format:
 * Part #,Description,Thick,Length,Width,Copies,Material Name,Can Rotate,Banding,<Info>,Notes
 * 
 * Banding format: {W}W-{L}L
 * - 0W-1L = 1 long edge banded
 * - 1W-0L = 1 short edge banded
 * - 1W-1L = 1 each
 * - 2W-2L = all 4 edges
 * - None = no edgebanding
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface CutlistPlusExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Delimiter */
  delimiter?: "," | "\t";
}

const DEFAULT_OPTIONS: CutlistPlusExportOptions = {
  units: "mm",
  delimiter: ",",
};

/**
 * CutList Plus CSV column headers - exact match to CutList Plus FX format
 */
const CUTLISTPLUS_HEADERS = [
  "Part #",
  "Description",
  "Thick",
  "Length",
  "Width",
  "Copies",
  "Material Name",
  "Can Rotate",
  "Banding",
  "<Info>",
  "Notes",
];

/**
 * Escape a cell value for CSV
 */
function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format edge banding in CutList Plus format: {W}W-{L}L
 * 
 * Examples:
 * - 0W-1L = 1 long edge banded
 * - 1W-0L = 1 short edge banded  
 * - 1W-1L = 1 width + 1 length
 * - 2W-2L = all 4 edges
 * - None = no edgebanding
 */
function formatBanding(ops: unknown): string {
  if (!ops || typeof ops !== "object") return "None";
  
  const opsObj = ops as { 
    edging?: { 
      edges?: Record<string, { apply?: boolean; edgeband_id?: string }>;
      summary?: { appliedEdges?: string[] };
    };
    edgebanding?: Record<string, string | boolean>;
  };
  
  let wCount = 0; // Width edges (W1, W2)
  let lCount = 0; // Length edges (L1, L2)
  
  // Try new format first
  if (opsObj.edging?.edges) {
    for (const [edge, config] of Object.entries(opsObj.edging.edges)) {
      if (config?.apply) {
        if (edge === "W1" || edge === "W2") {
          wCount++;
        } else if (edge === "L1" || edge === "L2") {
          lCount++;
        }
      }
    }
  }
  // Try legacy format
  else if (opsObj.edgebanding) {
    for (const [edge, value] of Object.entries(opsObj.edgebanding)) {
      // Value could be string (edgeband name) or boolean
      const hasEdge = Boolean(value) && value !== "";
      if (hasEdge) {
        if (edge === "W1" || edge === "W2") {
          wCount++;
        } else if (edge === "L1" || edge === "L2") {
          lCount++;
        }
      }
    }
  }
  // Try summary format
  else if (opsObj.edging?.summary?.appliedEdges) {
    for (const edge of opsObj.edging.summary.appliedEdges) {
      if (edge === "W1" || edge === "W2") {
        wCount++;
      } else if (edge === "L1" || edge === "L2") {
        lCount++;
      }
    }
  }
  
  // No edgebanding
  if (wCount === 0 && lCount === 0) {
    return "None";
  }
  
  // Format: {W}W-{L}L
  return `${wCount}W-${lCount}L`;
}

/**
 * Generate CutList Plus-compatible CSV export
 * Matches exact format that CutList Plus FX exports/imports
 */
export function generateCutlistPlusExport(
  cutlist: ExportableCutlist,
  options: CutlistPlusExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // Header row
  lines.push(CUTLISTPLUS_HEADERS.join(delimiter));
  
  // Data rows
  let partNum = 1;
  for (const part of cutlist.parts) {
    // Get material name if available
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id ?? "";
    
    // Dimensions
    const length = convertUnit(part.size.L, "mm", targetUnit);
    const width = convertUnit(part.size.W, "mm", targetUnit);
    const thickness = convertUnit(part.thickness_mm, "mm", targetUnit);
    
    // Format based on unit system (no decimals for mm)
    const formatDim = (val: number) => 
      targetUnit === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
    // Can Rotate: Yes or No
    const canRotate = part.allow_rotation === false ? "No" : "Yes";
    
    // Notes - combine all note types
    let notes = "";
    if (part.notes) {
      if (typeof part.notes === "string") {
        notes = part.notes;
      } else {
        const noteParts: string[] = [];
        if (part.notes.operator) noteParts.push(part.notes.operator);
        if (part.notes.design) noteParts.push(part.notes.design);
        if (part.notes.cnc) noteParts.push(`CNC: ${part.notes.cnc}`);
        notes = noteParts.join("; ");
      }
    }
    
    // Info field - can include group, etc.
    const infoItems: string[] = [];
    if (part.group_id) {
      infoItems.push(part.group_id);
    }
    const info = infoItems.join("; ");
    
    const cells = [
      partNum.toString(),                                      // Part #
      escapeCell(part.label ?? "", delimiter),                 // Description (can be empty)
      formatDim(thickness),                                    // Thick
      formatDim(length),                                       // Length
      formatDim(width),                                        // Width
      part.qty.toString(),                                     // Copies
      escapeCell(materialName, delimiter),                     // Material Name
      canRotate,                                               // Can Rotate (Yes/No)
      formatBanding(part.ops),                                 // Banding (0W-1L format)
      escapeCell(info, delimiter),                             // <Info>
      escapeCell(notes, delimiter),                            // Notes
    ];
    
    lines.push(cells.join(delimiter));
    partNum++;
  }
  
  // Add trailing empty rows like CutList Plus does (with leading space)
  const emptyRow = ` ${",".repeat(CUTLISTPLUS_HEADERS.length - 1)}`;
  lines.push(emptyRow);
  lines.push(emptyRow);
  lines.push(emptyRow);
  lines.push("");
  
  return lines.join("\n");
}

/**
 * Legacy export function with more columns
 * For backward compatibility
 */
export function generateCutlistPlusExportLegacy(
  cutlist: ExportableCutlist,
  options: {
    units?: UnitSystem;
    includeGrain?: boolean;
    includeNotes?: boolean;
    includeEdgebanding?: boolean;
    includeThickness?: boolean;
    delimiter?: "," | "\t";
  } = {}
): string {
  const {
    units = "mm",
    includeGrain = true,
    includeNotes = true,
    includeEdgebanding = true,
    includeThickness = true,
    delimiter = ",",
  } = options;
  
  const lines: string[] = [];
  
  // Legacy header row
  const headers = [
    "Name",
    "Length",
    "Width",
    "Qty",
    "Material",
    ...(includeThickness ? ["Thickness"] : []),
    ...(includeGrain ? ["Grain Direction"] : []),
    ...(includeEdgebanding ? ["Edge Band 1", "Edge Band 2", "Edge Band 3", "Edge Band 4"] : []),
    ...(includeNotes ? ["Notes"] : []),
  ];
  
  lines.push(headers.join(delimiter));
  
  for (const part of cutlist.parts) {
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id ?? "";
    const grainCode = part.allow_rotation === false ? "L" : "";
    
    const length = convertUnit(part.size.L, "mm", units);
    const width = convertUnit(part.size.W, "mm", units);
    const thickness = convertUnit(part.thickness_mm, "mm", units);
    
    const formatDim = (val: number) => 
      units === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
    const notes = typeof part.notes === "string" ? part.notes : part.notes?.operator || "";
    
    const getEdge = (edge: "L1" | "L2" | "W1" | "W2"): string => {
      const ops = part.ops as { edgebanding?: Record<string, string> } | undefined;
      return ops?.edgebanding?.[edge] || "";
    };
    
    const cells = [
      escapeCell(part.label ?? part.part_id ?? "", delimiter),
      formatDim(length),
      formatDim(width),
      part.qty.toString(),
      escapeCell(materialName, delimiter),
      ...(includeThickness ? [formatDim(thickness)] : []),
      ...(includeGrain ? [grainCode] : []),
      ...(includeEdgebanding ? [
        getEdge("L1"),
        getEdge("L2"),
        getEdge("W1"),
        getEdge("W2"),
      ] : []),
      ...(includeNotes ? [escapeCell(notes, delimiter)] : []),
    ];
    
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}
