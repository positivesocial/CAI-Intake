/**
 * CAI Intake - Export Types
 * 
 * Common types for export functions.
 */

export interface ExportablePart {
  part_id: string;
  label?: string;
  qty: number;
  size: { L: number; W: number };
  thickness_mm: number;
  material_id: string;
  grain: string;
  allow_rotation: boolean;
  group_id?: string;
  ops?: Record<string, unknown>;
  notes?: Record<string, string>;
  audit?: Record<string, unknown>;
}

export interface ExportableCutlist {
  doc_id: string;
  name: string;
  description?: string;
  job_ref?: string;
  client_ref?: string;
  capabilities: Record<string, boolean>;
  parts: ExportablePart[];
  materials?: Array<{
    material_id: string;
    name: string;
    thickness_mm: number;
  }>;
  edgebands?: Array<{
    edgeband_id: string;
    name: string;
    thickness_mm: number;
    width_mm: number;
  }>;
  created_at?: string;
  updated_at?: string;
}

export type UnitSystem = "mm" | "cm" | "inch";

export function convertUnit(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  
  // Convert to mm first
  let mm = value;
  if (from === "cm") mm = value * 10;
  else if (from === "inch") mm = value * 25.4;
  
  // Convert from mm to target
  if (to === "mm") return mm;
  if (to === "cm") return mm / 10;
  if (to === "inch") return mm / 25.4;
  
  return value;
}




