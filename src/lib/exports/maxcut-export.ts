/**
 * CAI Intake - MaxCut Export
 * 
 * Exports cutlists to MaxCut format (.mcp).
 * MaxCut is a popular panel cutting optimization software.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface MaxcutExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include grain direction */
  includeGrain?: boolean;
  /** Default sheet size if not specified */
  defaultSheetSize?: { L: number; W: number };
}

const DEFAULT_OPTIONS: MaxcutExportOptions = {
  units: "mm",
  includeGrain: true,
  defaultSheetSize: { L: 2800, W: 2070 },
};

export function generateMaxcutExport(
  cutlist: ExportableCutlist,
  options: MaxcutExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const targetUnit = opts.units!;
  
  const lines: string[] = [];
  
  // MaxCut file header
  lines.push("[MaxCut]");
  lines.push(`Version=5`);
  lines.push(`Project=${cutlist.name}`);
  lines.push(`Date=${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  
  // Group parts by material
  const partsByMaterial = new Map<string, typeof cutlist.parts>();
  for (const part of cutlist.parts) {
    const existing = partsByMaterial.get(part.material_id) ?? [];
    existing.push(part);
    partsByMaterial.set(part.material_id, existing);
  }
  
  // Export each material group
  let stockIndex = 1;
  for (const [materialId, parts] of partsByMaterial) {
    const material = cutlist.materials?.find(m => m.material_id === materialId);
    
    // Stock definition
    lines.push(`[Stock${stockIndex}]`);
    lines.push(`Name=${material?.name ?? materialId}`);
    lines.push(`Length=${convertUnit(opts.defaultSheetSize!.L, "mm", targetUnit)}`);
    lines.push(`Width=${convertUnit(opts.defaultSheetSize!.W, "mm", targetUnit)}`);
    lines.push(`Thickness=${convertUnit(parts[0].thickness_mm, "mm", targetUnit)}`);
    lines.push(`Quantity=999`);
    lines.push("");
    
    // Parts for this material
    lines.push(`[Parts${stockIndex}]`);
    lines.push(`Count=${parts.length}`);
    
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const grain = opts.includeGrain
        ? (p.grain === "along_L" ? ",GL" : p.grain === "along_W" ? ",GW" : "")
        : "";
      
      lines.push(
        `Part${i + 1}=${p.label ?? p.part_id},` +
        `${convertUnit(p.size.L, "mm", targetUnit)},` +
        `${convertUnit(p.size.W, "mm", targetUnit)},` +
        `${p.qty}` +
        grain
      );
    }
    
    lines.push("");
    stockIndex++;
  }
  
  return lines.join("\n");
}

