/**
 * CAI Intake - Optimik Export
 * 
 * Exports cutlists to Optimik CSV format.
 * Optimik is a panel cutting optimization software that uses a specific CSV structure.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface OptimikExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include grain direction */
  includeGrain?: boolean;
  /** Include edge banding columns */
  includeEdging?: boolean;
  /** CSV delimiter */
  delimiter?: "," | ";";
  /** Decimal separator */
  decimalSeparator?: "." | ",";
}

const DEFAULT_OPTIONS: OptimikExportOptions = {
  units: "mm",
  includeGrain: true,
  includeEdging: true,
  delimiter: ";", // Optimik typically uses semicolon
  decimalSeparator: ".",
};

function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(value: number, decimalSeparator: string, decimals: number = 1): string {
  const formatted = value.toFixed(decimals);
  return decimalSeparator === "," ? formatted.replace(".", ",") : formatted;
}

export function generateOptimikExport(
  cutlist: ExportableCutlist,
  options: OptimikExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  const decSep = opts.decimalSeparator!;
  
  const lines: string[] = [];
  
  // Optimik header format
  // Optimik expects: Name;Length;Width;Qty;Material;Thickness;Grain;E1;E2;E3;E4;Notes
  const headers = [
    "PART_NAME",
    "LENGTH",
    "WIDTH", 
    "QTY",
    "MATERIAL",
    "THICKNESS",
  ];
  
  if (opts.includeGrain) {
    headers.push("GRAIN");
    headers.push("ROTATE");
  }
  
  if (opts.includeEdging) {
    headers.push("EDGE_L1");
    headers.push("EDGE_L2");
    headers.push("EDGE_W1");
    headers.push("EDGE_W2");
  }
  
  headers.push("GROUP");
  headers.push("NOTES");
  
  lines.push(headers.join(delimiter));
  
  // Data rows
  for (const part of cutlist.parts) {
    const cells: string[] = [];
    
    // Part name
    cells.push(escapeCell(part.label ?? part.part_id, delimiter));
    
    // Dimensions
    cells.push(formatNumber(convertUnit(part.size.L, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2));
    cells.push(formatNumber(convertUnit(part.size.W, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2));
    
    // Quantity
    cells.push(part.qty.toString());
    
    // Material
    cells.push(escapeCell(part.material_id, delimiter));
    
    // Thickness
    cells.push(formatNumber(convertUnit(part.thickness_mm, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2));
    
    // Grain direction
    if (opts.includeGrain) {
      // Optimik grain codes: 0 = no grain, 1 = along length, 2 = along width
      // Derive from allow_rotation: if can't rotate, grain is along length (1)
      const grainCode = part.allow_rotation === false ? "1" : "0";
      cells.push(grainCode);
      cells.push(part.allow_rotation !== false ? "1" : "0");
    }
    
    // Edge banding (1 = apply, 0 = no edge)
    if (opts.includeEdging) {
      const getEdge = (edge: string): string => {
        const edges = (part.ops?.edging as { edges?: Record<string, { apply?: boolean }> })?.edges;
        return edges?.[edge]?.apply ? "1" : "0";
      };
      cells.push(getEdge("L1"));
      cells.push(getEdge("L2"));
      cells.push(getEdge("W1"));
      cells.push(getEdge("W2"));
    }
    
    // Group
    cells.push(escapeCell(part.group_id ?? "", delimiter));
    
    // Notes
    cells.push(escapeCell(part.notes?.operator ?? "", delimiter));
    
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}

/**
 * Generate Optimik stock/material definition file
 * Optimik requires separate files for stock and parts
 */
export function generateOptimikStockExport(
  cutlist: ExportableCutlist,
  options: OptimikExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  const targetUnit = opts.units!;
  const decSep = opts.decimalSeparator!;
  
  const lines: string[] = [];
  
  // Stock header
  lines.push(["MATERIAL", "LENGTH", "WIDTH", "THICKNESS", "QTY", "COST"].join(delimiter));
  
  // Get unique materials
  const materials = new Map<string, { thickness: number; material: { material_id: string; name: string; thickness_mm: number } }>();
  for (const part of cutlist.parts) {
    if (!materials.has(part.material_id)) {
      const mat = cutlist.materials?.find(m => m.material_id === part.material_id);
      if (mat) {
        materials.set(part.material_id, { thickness: part.thickness_mm, material: mat });
      }
    }
  }
  
  // Default sheet size
  const defaultLength = 2800;
  const defaultWidth = 2070;
  
  for (const [materialId, { thickness, material }] of materials) {
    const cells = [
      escapeCell(material?.name ?? materialId, delimiter),
      formatNumber(convertUnit(defaultLength, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2),
      formatNumber(convertUnit(defaultWidth, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2),
      formatNumber(convertUnit(thickness, "mm", targetUnit), decSep, targetUnit === "mm" ? 0 : 2),
      "999", // Unlimited quantity
      "0", // Cost
    ];
    lines.push(cells.join(delimiter));
  }
  
  return lines.join("\n");
}

