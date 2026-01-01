/**
 * CAI Intake - CutList Plus Export
 * 
 * Exports cutlists to CutList Plus-compatible CSV format.
 * This format matches the exact CSV structure that CutList Plus FX exports/imports.
 * 
 * CutList Plus CSV Format:
 * Part #,Description,Thick,Length,Width,Copies,Material Name,Banding,<Info>,Notes
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
 * Format edge banding summary from part operations
 * Returns a summary string like "L1,L2,W1,W2" or "All" or edge names
 */
function formatBanding(
  ops: unknown,
  cutlist: ExportableCutlist
): string {
  if (!ops || typeof ops !== "object") return "";
  
  const opsObj = ops as { 
    edging?: { 
      edges?: Record<string, { apply?: boolean; edgeband_id?: string }>;
      summary?: { appliedEdges?: string[] };
    };
    edgebanding?: Record<string, string>;
  };
  
  // Try new format first
  if (opsObj.edging?.edges) {
    const appliedEdges: string[] = [];
    const edgeNames: Set<string> = new Set();
    
    for (const [edge, config] of Object.entries(opsObj.edging.edges)) {
      if (config?.apply) {
        appliedEdges.push(edge);
        if (config.edgeband_id) {
          const edgeband = cutlist.edgebands?.find(e => e.edgeband_id === config.edgeband_id);
          if (edgeband?.name) {
            edgeNames.add(edgeband.name);
          }
        }
      }
    }
    
    if (appliedEdges.length === 0) return "";
    
    // If all 4 edges, return "All" or the edgeband name
    if (appliedEdges.length === 4) {
      if (edgeNames.size === 1) {
        return `All - ${Array.from(edgeNames)[0]}`;
      }
      return "All";
    }
    
    // Return summary like "L1,L2" or with names
    if (edgeNames.size === 1) {
      return `${appliedEdges.join(",")} - ${Array.from(edgeNames)[0]}`;
    }
    return appliedEdges.join(",");
  }
  
  // Try legacy format
  if (opsObj.edgebanding) {
    const edges = Object.entries(opsObj.edgebanding)
      .filter(([, value]) => value)
      .map(([key]) => key);
    
    if (edges.length === 0) return "";
    if (edges.length === 4) return "All";
    return edges.join(",");
  }
  
  // Check summary
  if (opsObj.edging?.summary?.appliedEdges) {
    const edges = opsObj.edging.summary.appliedEdges;
    if (edges.length === 0) return "";
    if (edges.length === 4) return "All";
    return edges.join(",");
  }
  
  return "";
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
    
    // Format based on unit system
    const formatDim = (val: number) => 
      targetUnit === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
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
    
    // Build info field - can include grain, group, etc.
    const infoItems: string[] = [];
    if (part.allow_rotation === false) {
      infoItems.push("Grain: L");
    }
    if (part.group_id) {
      infoItems.push(`Group: ${part.group_id}`);
    }
    const info = infoItems.join("; ");
    
    const cells = [
      partNum.toString(),                                    // Part #
      escapeCell(part.label ?? part.part_id ?? "", delimiter), // Description
      formatDim(thickness),                                  // Thick
      formatDim(length),                                     // Length
      formatDim(width),                                      // Width
      part.qty.toString(),                                   // Copies
      escapeCell(materialName, delimiter),                   // Material Name
      escapeCell(formatBanding(part.ops, cutlist), delimiter), // Banding
      escapeCell(info, delimiter),                           // <Info>
      escapeCell(notes, delimiter),                          // Notes
    ];
    
    lines.push(cells.join(delimiter));
    partNum++;
  }
  
  // Add empty lines at the end like CutList Plus does
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
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
