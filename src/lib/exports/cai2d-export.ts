/**
 * CAI Intake - CAI 2D Export
 * 
 * Exports cutlists to CAI 2D optimizer format.
 * This is the native format for the CAI 2D panel optimization system.
 */

import type { ExportableCutlist, UnitSystem } from "./types";
import { convertUnit } from "./types";

export interface Cai2dExportOptions {
  /** Unit system for dimensions */
  units?: UnitSystem;
  /** Include processing operations */
  includeOps?: boolean;
  /** Include edge banding */
  includeEdging?: boolean;
  /** Optimization settings */
  optimization?: {
    /** Blade kerf width */
    kerf?: number;
    /** Edge trim */
    edgeTrim?: number;
    /** Allow grain rotation */
    allowGrainRotation?: boolean;
  };
}

const DEFAULT_OPTIONS: Cai2dExportOptions = {
  units: "mm",
  includeOps: true,
  includeEdging: true,
  optimization: {
    kerf: 4,
    edgeTrim: 10,
    allowGrainRotation: false,
  },
};

export function generateCai2dExport(
  cutlist: ExportableCutlist,
  options: Cai2dExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const targetUnit = opts.units!;
  
  // Group parts by material and thickness
  const partGroups = new Map<string, typeof cutlist.parts>();
  for (const part of cutlist.parts) {
    const key = `${part.material_id}:${part.thickness_mm}`;
    const existing = partGroups.get(key) ?? [];
    existing.push(part);
    partGroups.set(key, existing);
  }
  
  // Build CAI 2D document
  const doc = {
    version: "2.0",
    type: "cai2d-optimize",
    
    job: {
      id: cutlist.doc_id,
      name: cutlist.name,
      description: cutlist.description,
      reference: cutlist.job_ref,
      client: cutlist.client_ref,
      created: cutlist.created_at ?? new Date().toISOString(),
    },
    
    settings: {
      units: targetUnit,
      kerf: opts.optimization?.kerf ?? 4,
      edgeTrim: opts.optimization?.edgeTrim ?? 10,
      allowGrainRotation: opts.optimization?.allowGrainRotation ?? false,
    },
    
    materials: Array.from(partGroups.entries()).map(([key, parts]) => {
      const [materialId, thicknessStr] = key.split(":");
      const thickness = parseFloat(thicknessStr);
      const material = cutlist.materials?.find(m => m.material_id === materialId);
      
      return {
        id: materialId,
        name: material?.name ?? materialId,
        thickness: convertUnit(thickness, "mm", targetUnit),
        
        // Default stock sheets
        stock: [{
          length: convertUnit(2800, "mm", targetUnit),
          width: convertUnit(2070, "mm", targetUnit),
          quantity: -1, // Unlimited
          cost: 0,
        }],
        
        // Parts for this material
        parts: parts.map(p => ({
          id: p.part_id,
          name: p.label ?? p.part_id,
          length: convertUnit(p.size.L, "mm", targetUnit),
          width: convertUnit(p.size.W, "mm", targetUnit),
          quantity: p.qty,
          // Derive grain from allow_rotation: if can't rotate, grain is along_L
          grain: p.allow_rotation === false ? "along_L" : undefined,
          canRotate: p.allow_rotation !== false,
          group: p.group_id,
          priority: 0,
          
          // Edge banding
          ...(opts.includeEdging && p.ops?.edging ? {
            edging: {
              L1: (p.ops.edging as Record<string, Record<string, { apply?: boolean }>>).edges?.L1?.apply ?? false,
              L2: (p.ops.edging as Record<string, Record<string, { apply?: boolean }>>).edges?.L2?.apply ?? false,
              W1: (p.ops.edging as Record<string, Record<string, { apply?: boolean }>>).edges?.W1?.apply ?? false,
              W2: (p.ops.edging as Record<string, Record<string, { apply?: boolean }>>).edges?.W2?.apply ?? false,
            },
          } : {}),
          
          // CNC operations
          ...(opts.includeOps && p.ops ? {
            operations: {
              grooves: (p.ops as Record<string, unknown[]>).grooves,
              holes: (p.ops as Record<string, unknown[]>).holes,
              routing: (p.ops as Record<string, unknown[]>).routing,
            },
          } : {}),
        })),
      };
    }),
    
    // Edgeband library
    ...(opts.includeEdging && cutlist.edgebands ? {
      edgebands: cutlist.edgebands.map(e => ({
        id: e.edgeband_id,
        name: e.name,
        thickness: convertUnit(e.thickness_mm, "mm", targetUnit),
        width: convertUnit(e.width_mm, "mm", targetUnit),
      })),
    } : {}),
    
    exported: {
      timestamp: new Date().toISOString(),
      source: "CAI Intake",
      version: "1.0.0",
    },
  };
  
  return JSON.stringify(doc, null, 2);
}

