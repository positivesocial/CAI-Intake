/**
 * CAI Intake - CutRite Export
 * 
 * Exports cutlists to CutRite XML format (.xml).
 * CutRite by Weinig is a professional panel optimization software.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface CutRiteExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include grain direction */
  includeGrain?: boolean;
  /** Include edge banding */
  includeEdging?: boolean;
  /** Default sheet size if not specified */
  defaultSheetSize?: { L: number; W: number };
  /** Saw kerf width in mm */
  sawKerf?: number;
}

const DEFAULT_OPTIONS: CutRiteExportOptions = {
  units: "mm",
  includeGrain: true,
  includeEdging: true,
  defaultSheetSize: { L: 2800, W: 2070 },
  sawKerf: 4,
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateCutRiteExport(
  cutlist: ExportableCutlist,
  options: CutRiteExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const targetUnit = opts.units!;
  
  // Group parts by material
  const partsByMaterial = new Map<string, typeof cutlist.parts>();
  for (const part of cutlist.parts) {
    const existing = partsByMaterial.get(part.material_id) ?? [];
    existing.push(part);
    partsByMaterial.set(part.material_id, existing);
  }
  
  // Build XML
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<CutRiteProject xmlns="http://www.cutrite.com/schema/v1">');
  
  // Project metadata
  lines.push('  <Project>');
  lines.push(`    <Name>${escapeXml(cutlist.name)}</Name>`);
  lines.push(`    <Description>${escapeXml(cutlist.description ?? "")}</Description>`);
  lines.push(`    <Reference>${escapeXml(cutlist.job_ref ?? "")}</Reference>`);
  lines.push(`    <Client>${escapeXml(cutlist.client_ref ?? "")}</Client>`);
  lines.push(`    <CreatedDate>${new Date().toISOString()}</CreatedDate>`);
  lines.push(`    <Units>${targetUnit}</Units>`);
  lines.push('  </Project>');
  
  // Settings
  lines.push('  <Settings>');
  lines.push(`    <SawKerf>${opts.sawKerf}</SawKerf>`);
  lines.push(`    <GrainMatching>${opts.includeGrain ? "true" : "false"}</GrainMatching>`);
  lines.push('  </Settings>');
  
  // Materials and stock
  lines.push('  <Materials>');
  let materialIndex = 1;
  for (const [materialId, parts] of partsByMaterial) {
    const material = cutlist.materials?.find(m => m.material_id === materialId);
    const thickness = parts[0]?.thickness_mm ?? 18;
    
    lines.push(`    <Material id="${materialIndex}">`);
    lines.push(`      <Code>${escapeXml(materialId)}</Code>`);
    lines.push(`      <Name>${escapeXml(material?.name ?? materialId)}</Name>`);
    lines.push(`      <Thickness>${convertUnit(thickness, "mm", targetUnit)}</Thickness>`);
    
    // Stock sheets
    lines.push('      <Stock>');
    lines.push('        <Sheet>');
    lines.push(`          <Length>${convertUnit(opts.defaultSheetSize!.L, "mm", targetUnit)}</Length>`);
    lines.push(`          <Width>${convertUnit(opts.defaultSheetSize!.W, "mm", targetUnit)}</Width>`);
    lines.push(`          <Quantity>-1</Quantity>`);
    lines.push('        </Sheet>');
    lines.push('      </Stock>');
    
    // Parts
    lines.push('      <Parts>');
    for (const part of parts) {
      const grainDir = part.grain === "along_L" ? "LENGTH" : 
                       part.grain === "along_W" ? "WIDTH" : "NONE";
      
      lines.push('        <Part>');
      lines.push(`          <ID>${escapeXml(part.part_id)}</ID>`);
      lines.push(`          <Name>${escapeXml(part.label ?? part.part_id)}</Name>`);
      lines.push(`          <Length>${convertUnit(part.size.L, "mm", targetUnit)}</Length>`);
      lines.push(`          <Width>${convertUnit(part.size.W, "mm", targetUnit)}</Width>`);
      lines.push(`          <Quantity>${part.qty}</Quantity>`);
      
      if (opts.includeGrain) {
        lines.push(`          <GrainDirection>${grainDir}</GrainDirection>`);
        lines.push(`          <CanRotate>${part.allow_rotation ? "true" : "false"}</CanRotate>`);
      }
      
      if (part.group_id) {
        lines.push(`          <Group>${escapeXml(part.group_id)}</Group>`);
      }
      
      // Edge banding
      if (opts.includeEdging && part.ops?.edging) {
        const edges = (part.ops.edging as { edges?: Record<string, { apply?: boolean; band_id?: string }> }).edges;
        if (edges) {
          lines.push('          <Edging>');
          for (const [edge, config] of Object.entries(edges)) {
            if (config.apply) {
              lines.push(`            <Edge side="${edge}" band="${config.band_id ?? "default"}" />`);
            }
          }
          lines.push('          </Edging>');
        }
      }
      
      if (part.notes?.operator) {
        lines.push(`          <Notes>${escapeXml(part.notes.operator)}</Notes>`);
      }
      
      lines.push('        </Part>');
    }
    lines.push('      </Parts>');
    lines.push('    </Material>');
    materialIndex++;
  }
  lines.push('  </Materials>');
  
  // Edge band library
  if (opts.includeEdging && cutlist.edgebands && cutlist.edgebands.length > 0) {
    lines.push('  <EdgeBands>');
    for (const band of cutlist.edgebands) {
      lines.push(`    <EdgeBand id="${escapeXml(band.edgeband_id)}">`);
      lines.push(`      <Name>${escapeXml(band.name)}</Name>`);
      lines.push(`      <Thickness>${convertUnit(band.thickness_mm, "mm", targetUnit)}</Thickness>`);
      lines.push(`      <Width>${convertUnit(band.width_mm, "mm", targetUnit)}</Width>`);
      lines.push('    </EdgeBand>');
    }
    lines.push('  </EdgeBands>');
  }
  
  lines.push('</CutRiteProject>');
  
  return lines.join('\n');
}

