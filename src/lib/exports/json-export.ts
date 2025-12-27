/**
 * CAI Intake - JSON Export
 * 
 * Exports cutlists to the canonical CAI JSON format.
 */

import type { ExportableCutlist } from "./types";

export interface JsonExportOptions {
  /** Include material/edgeband library definitions */
  includeLibraries?: boolean;
  /** Include processing operations */
  includeOps?: boolean;
  /** Include audit/metadata */
  includeAudit?: boolean;
  /** Pretty print JSON */
  prettyPrint?: boolean;
  /** Schema version */
  schemaVersion?: string;
}

const DEFAULT_OPTIONS: JsonExportOptions = {
  includeLibraries: true,
  includeOps: true,
  includeAudit: false,
  prettyPrint: true,
  schemaVersion: "cai-cutlist/v1",
};

export function generateJsonExport(
  cutlist: ExportableCutlist,
  options: JsonExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const doc = {
    "$schema": opts.schemaVersion,
    doc_id: cutlist.doc_id,
    name: cutlist.name,
    description: cutlist.description,
    job_ref: cutlist.job_ref,
    client_ref: cutlist.client_ref,
    capabilities: cutlist.capabilities,
    
    // Material libraries
    ...(opts.includeLibraries && cutlist.materials && {
      material_lib: cutlist.materials.reduce((acc, m) => {
        acc[m.material_id] = {
          name: m.name,
          thickness_mm: m.thickness_mm,
        };
        return acc;
      }, {} as Record<string, { name: string; thickness_mm: number }>),
    }),
    
    ...(opts.includeLibraries && cutlist.edgebands && {
      edgeband_lib: cutlist.edgebands.reduce((acc, e) => {
        acc[e.edgeband_id] = {
          name: e.name,
          thickness_mm: e.thickness_mm,
          width_mm: e.width_mm,
        };
        return acc;
      }, {} as Record<string, { name: string; thickness_mm: number; width_mm: number }>),
    }),
    
    // Parts
    parts: cutlist.parts.map(p => ({
      part_id: p.part_id,
      label: p.label,
      qty: p.qty,
      size: p.size,
      thickness_mm: p.thickness_mm,
      material_id: p.material_id,
      allow_rotation: p.allow_rotation,
      group_id: p.group_id,
      ...(opts.includeOps && p.ops && { ops: p.ops }),
      ...(p.notes && { notes: p.notes }),
      ...(opts.includeAudit && p.audit && { audit: p.audit }),
    })),
    
    // Metadata
    exported_at: new Date().toISOString(),
    export_version: "1.0.0",
  };
  
  return opts.prettyPrint
    ? JSON.stringify(doc, null, 2)
    : JSON.stringify(doc);
}





