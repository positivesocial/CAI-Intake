/**
 * CAI Intake - MaxCut Export
 * 
 * Exports cutlists to MaxCut-compatible CSV format.
 * This format matches the exact CSV structure that MaxCut software exports/imports.
 * 
 * MaxCut CSV Format:
 * - First line: Sep=, (separator declaration)
 * - All values quoted with double quotes
 * - Dimensions include unit suffix (e.g., "795 mm")
 * - Complex hole/groove patterns in specific format
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface MaxcutExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Delimiter (comma or semicolon) */
  delimiter?: "," | ";";
  /** Include hole patterns */
  includeHoles?: boolean;
  /** Include grooving patterns */
  includeGrooving?: boolean;
}

const DEFAULT_OPTIONS: MaxcutExportOptions = {
  units: "mm",
  delimiter: ",",
  includeHoles: true,
  includeGrooving: true,
};

/**
 * MaxCut CSV column headers - exact match to MaxCut export format
 */
const MAXCUT_HEADERS = [
  "Type",
  "Name",
  "Length",
  "Width",
  "Quantity",
  "Notes",
  "Can Rotate (https://feature-panel-rotation.maxcutsoftware.com)",
  "Material",
  "Edging Length 1",
  "Edging Length 2",
  "Edging Width 1",
  "Edging Width 2",
  "Include Edging Thickness",
  "Note 1",
  "Note 2",
  "Note 3",
  "Note 4",
  "Group",
  "Report Tags",
  "Import ID",
  "Parent ID",
  "Library Item Name",
  "Holes Length 1",
  "Holes Length 2",
  "Holes Width 1",
  "Holes Width 2",
  "Grooving Length 1",
  "Grooving Length 2",
  "Grooving Width 1",
  "Grooving Width 2",
  "Material Tag",
  "Edging Length 1 Tag",
  "Edging Length 2 Tag",
  "Edging Width 1 Tag",
  "Edging Width 2 Tag",
  "Apply Machining Charge",
  "Long Expansion",
  "Short Expansion",
  "Include in Optimization",
];

/**
 * Quote a cell value for MaxCut CSV format
 * All values are always quoted in MaxCut format
 */
function quoteCell(value: string): string {
  // Escape any existing double quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Format dimension with unit suffix (e.g., "795 mm")
 */
function formatDimension(value: number, unit: UnitSystem): string {
  if (unit === "mm") {
    return `${Math.round(value)} mm`;
  } else {
    // Inches with 2 decimal places
    return `${value.toFixed(2)} in`;
  }
}

/**
 * Get edgeband name from part operations
 */
function getEdgebandName(
  ops: unknown, 
  edge: "L1" | "L2" | "W1" | "W2",
  cutlist: ExportableCutlist
): string {
  if (!ops || typeof ops !== "object") return "";
  
  const opsObj = ops as { 
    edging?: { 
      edges?: Record<string, { apply?: boolean; edgeband_id?: string }> 
    };
    edgebanding?: Record<string, string>;
  };
  
  // Try new format first
  if (opsObj.edging?.edges?.[edge]?.apply) {
    const edgebandId = opsObj.edging.edges[edge].edgeband_id;
    if (edgebandId) {
      const edgeband = cutlist.edgebands?.find(e => e.edgeband_id === edgebandId);
      return edgeband?.name || edgebandId;
    }
    return "Edge"; // Default name if apply is true but no ID
  }
  
  // Try legacy format
  if (opsObj.edgebanding?.[edge]) {
    return opsObj.edgebanding[edge];
  }
  
  return "";
}

/**
 * Convert rotation setting to MaxCut format
 * MaxCut uses: "NoRotation", "AllowRotation", "AllowIfNoGrain"
 */
function getRotationMode(allowRotation: boolean | undefined): string {
  if (allowRotation === false) {
    return "NoRotation";
  }
  // Default to AllowIfNoGrain which allows rotation when no grain is set
  return "AllowIfNoGrain";
}

/**
 * Format hole patterns for MaxCut
 * MaxCut format: '25 mm,100 mm,15 mm,35 mm;25 mm,900 mm,15 mm,35 mm'
 * Each hole: x,y,diameter,depth separated by semicolons
 */
function formatHolePatterns(ops: unknown, edge: "L1" | "L2" | "W1" | "W2"): string {
  if (!ops || typeof ops !== "object") return "";
  
  const opsObj = ops as { 
    holes?: Array<{
      x: number;
      y: number;
      dia_mm: number;
      depth_mm?: number;
      face?: string;
    }>;
  };
  
  if (!opsObj.holes || opsObj.holes.length === 0) return "";
  
  // Filter holes by edge/face
  const edgeToFace: Record<string, string[]> = {
    "L1": ["L1", "front", "edge"],
    "L2": ["L2", "back"],
    "W1": ["W1", "left"],
    "W2": ["W2", "right"],
  };
  
  const relevantHoles = opsObj.holes.filter(h => 
    edgeToFace[edge].includes(h.face || "front")
  );
  
  if (relevantHoles.length === 0) return "";
  
  // Format: 'x,y,dia,depth;x,y,dia,depth'
  const patterns = relevantHoles.map(h => 
    `${Math.round(h.x)} mm,${Math.round(h.y)} mm,${Math.round(h.dia_mm)} mm,${Math.round(h.depth_mm || 35)} mm`
  );
  
  return `'${patterns.join(";")}'`;
}

/**
 * Format groove patterns for MaxCut
 * MaxCut format: '18 mm,5 mm,10 mm,*,0 mm,0 mm'
 * Pattern: width,depth,offset,length(*=full),start,end
 */
function formatGroovePatterns(ops: unknown, edge: "L1" | "L2" | "W1" | "W2"): string {
  if (!ops || typeof ops !== "object") return "";
  
  const opsObj = ops as { 
    grooves?: Array<{
      width_mm?: number;
      depth_mm?: number;
      offset_mm?: number;
      length_mm?: number | null;
      edge?: string;
    }>;
  };
  
  if (!opsObj.grooves || opsObj.grooves.length === 0) return "";
  
  // Filter grooves by edge
  const relevantGrooves = opsObj.grooves.filter(g => {
    const grooveEdge = g.edge?.toUpperCase() || "";
    // Match edge patterns: L1, L2, W1, W2, L, W
    if (edge === "L1" && (grooveEdge === "L1" || grooveEdge === "L")) return true;
    if (edge === "L2" && grooveEdge === "L2") return true;
    if (edge === "W1" && (grooveEdge === "W1" || grooveEdge === "W")) return true;
    if (edge === "W2" && grooveEdge === "W2") return true;
    return false;
  });
  
  if (relevantGrooves.length === 0) return "";
  
  // Format: 'width,depth,offset,length,start,end'
  const patterns = relevantGrooves.map(g => {
    const width = Math.round(g.width_mm || 18);
    const depth = Math.round(g.depth_mm || 5);
    const offset = Math.round(g.offset_mm || 10);
    const length = g.length_mm ? `${Math.round(g.length_mm)} mm` : "*";
    return `${width} mm,${depth} mm,${offset} mm,${length},0 mm,0 mm`;
  });
  
  return `'${patterns.join(";")}'`;
}

/**
 * Generate MaxCut-compatible CSV export
 * Matches exact format that MaxCut software exports/imports
 */
export function generateMaxcutExport(
  cutlist: ExportableCutlist,
  options: MaxcutExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // First line: separator declaration (MaxCut convention)
  lines.push(`Sep=${delimiter}`);
  
  // Header row - all values quoted
  lines.push(MAXCUT_HEADERS.map(h => quoteCell(h)).join(delimiter));
  
  // Data rows
  let importId = 1;
  for (const part of cutlist.parts) {
    // Get material name if available
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id ?? "";
    
    // Dimensions with unit suffix
    const length = convertUnit(part.size.L, "mm", targetUnit);
    const width = convertUnit(part.size.W, "mm", targetUnit);
    
    // Build row with all columns
    const row: string[] = [
      quoteCell("Input Panel"),                                    // Type
      quoteCell(part.label ?? part.part_id ?? "Part"),             // Name
      quoteCell(formatDimension(length, targetUnit)),              // Length
      quoteCell(formatDimension(width, targetUnit)),               // Width
      quoteCell(part.qty.toString()),                              // Quantity
      quoteCell(typeof part.notes === "string" ? part.notes : ""), // Notes
      quoteCell(getRotationMode(part.allow_rotation)),             // Can Rotate
      quoteCell(materialName),                                     // Material
      quoteCell(getEdgebandName(part.ops, "L1", cutlist)),         // Edging Length 1
      quoteCell(getEdgebandName(part.ops, "L2", cutlist)),         // Edging Length 2
      quoteCell(getEdgebandName(part.ops, "W1", cutlist)),         // Edging Width 1
      quoteCell(getEdgebandName(part.ops, "W2", cutlist)),         // Edging Width 2
      quoteCell("True"),                                           // Include Edging Thickness
      quoteCell(""),                                               // Note 1
      quoteCell(""),                                               // Note 2
      quoteCell(""),                                               // Note 3
      quoteCell(""),                                               // Note 4
      quoteCell(part.group_id ?? ""),                              // Group
      quoteCell(""),                                               // Report Tags
      quoteCell(importId.toString()),                              // Import ID
      quoteCell(importId.toString()),                              // Parent ID
      quoteCell(""),                                               // Library Item Name
      quoteCell(opts.includeHoles ? formatHolePatterns(part.ops, "L1") : ""), // Holes Length 1
      quoteCell(opts.includeHoles ? formatHolePatterns(part.ops, "L2") : ""), // Holes Length 2
      quoteCell(opts.includeHoles ? formatHolePatterns(part.ops, "W1") : ""), // Holes Width 1
      quoteCell(opts.includeHoles ? formatHolePatterns(part.ops, "W2") : ""), // Holes Width 2
      quoteCell(opts.includeGrooving ? formatGroovePatterns(part.ops, "L1") : ""), // Grooving Length 1
      quoteCell(opts.includeGrooving ? formatGroovePatterns(part.ops, "L2") : ""), // Grooving Length 2
      quoteCell(opts.includeGrooving ? formatGroovePatterns(part.ops, "W1") : ""), // Grooving Width 1
      quoteCell(opts.includeGrooving ? formatGroovePatterns(part.ops, "W2") : ""), // Grooving Width 2
      quoteCell(""),                                               // Material Tag
      quoteCell(""),                                               // Edging Length 1 Tag
      quoteCell(""),                                               // Edging Length 2 Tag
      quoteCell(""),                                               // Edging Width 1 Tag
      quoteCell(""),                                               // Edging Width 2 Tag
      quoteCell(""),                                               // Apply Machining Charge
      quoteCell("0"),                                              // Long Expansion
      quoteCell("0"),                                              // Short Expansion
      quoteCell("True"),                                           // Include in Optimization
    ];
    
    lines.push(row.join(delimiter));
    importId++;
  }
  
  // Add trailing newline like MaxCut does
  lines.push("");
  
  return lines.join("\n");
}

/**
 * Legacy export function for backward compatibility
 * Uses simpler format with fewer columns
 */
export function generateMaxcutExportSimple(
  cutlist: ExportableCutlist,
  options: { units?: UnitSystem; delimiter?: "," | ";" } = {}
): string {
  const { units = "mm", delimiter = "," } = options;
  
  const lines: string[] = [];
  
  // Simple header
  const headers = [
    "Part Name",
    "Length",
    "Width",
    "Quantity",
    "Material",
    "Thickness",
    "Grain",
    "Edge L1",
    "Edge L2",
    "Edge W1",
    "Edge W2",
  ];
  
  lines.push(headers.join(delimiter));
  
  for (const part of cutlist.parts) {
    const material = cutlist.materials?.find(m => m.material_id === part.material_id);
    const materialName = material?.name ?? part.material_id ?? "";
    
    const length = convertUnit(part.size.L, "mm", units);
    const width = convertUnit(part.size.W, "mm", units);
    const thickness = convertUnit(part.thickness_mm, "mm", units);
    
    const formatDim = (val: number) => 
      units === "mm" ? Math.round(val).toString() : val.toFixed(2);
    
    const grainCode = part.allow_rotation === false ? "L" : "";
    
    const cells = [
      part.label ?? part.part_id ?? "Part",
      formatDim(length),
      formatDim(width),
      part.qty.toString(),
      materialName,
      formatDim(thickness),
      grainCode,
      getEdgebandName(part.ops, "L1", cutlist),
      getEdgebandName(part.ops, "L2", cutlist),
      getEdgebandName(part.ops, "W1", cutlist),
      getEdgebandName(part.ops, "W2", cutlist),
    ];
    
    lines.push(cells.map(c => {
      if (c.includes(delimiter) || c.includes("\n") || c.includes('"')) {
        return `"${c.replace(/"/g, '""')}"`;
      }
      return c;
    }).join(delimiter));
  }
  
  return lines.join("\n");
}
