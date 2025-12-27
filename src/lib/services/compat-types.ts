/**
 * CAI Intake - Compatibility Types
 * 
 * Provides backward-compatible types for the transition from the old
 * canonical-types module to the new unified operations system.
 * 
 * @deprecated These types are for backward compatibility only.
 * Use types from @/lib/operations instead.
 */

// Re-export from operations for backward compat
export type { EdgeSide, PartFace, ToolType } from "@/lib/operations/types";

// Legacy type aliases
export type HolePatternKind = 
  | "hinge" 
  | "shelf_pins" 
  | "handle" 
  | "knob" 
  | "drawer_slide" 
  | "cam_lock" 
  | "dowel" 
  | "system32" 
  | "custom";

export type CncOpType = 
  | "pocket" 
  | "cutout" 
  | "chamfer" 
  | "radius" 
  | "rebate" 
  | "contour" 
  | "text" 
  | "drill_array"
  | "custom";

// Constants
export const ALL_EDGE_SIDES = ["L1", "L2", "W1", "W2"] as const;
export const LONG_EDGES = ["L1", "L2"] as const;
export const WIDTH_EDGES = ["W1", "W2"] as const;

// Legacy service types
export interface EdgeBandSpec {
  edges: ("L1" | "L2" | "W1" | "W2")[];
  tapeMaterial?: string;
  tapeId?: string;
  thickness_mm?: number;
  thicknessMm?: number;  // Alias for thickness_mm
  remarks?: string;
}

export interface GrooveSpec {
  onEdges?: ("L1" | "L2" | "W1" | "W2")[];  // Multiple edges
  onEdge?: "L1" | "L2" | "W1" | "W2";        // Single edge (alias)
  widthMm: number;
  depthMm: number;
  distanceFromEdgeMm: number;
  face: "front" | "back";
  purpose?: string;
  stopped?: { startMm: number; endMm: number };
  note?: string;
}

export interface HolePatternSpec {
  kind: HolePatternKind;
  count?: number;
  edgeRef?: "L1" | "L2" | "W1" | "W2";
  refEdge?: "L1" | "L2" | "W1" | "W2";  // Alias for edgeRef
  distanceFromEdgeMm: number;
  offsetsMm?: number[];
  holeDiaMm?: number;
  holeDepthMm?: number;
  through?: boolean;
  hardwareRef?: string;
  hardwareId?: string;  // Hardware reference ID
  spacingMm?: number;
  note?: string;  // Additional notes
}

export interface CncOperation {
  type: CncOpType;
  label?: string;
  params?: Record<string, number | string | boolean>;
  toolDiaMm?: number;
  feedRate?: number;
  plungeRate?: number;
  shapeId?: string;  // Reference to a saved shape
  note?: string;
}

export interface PartServices {
  edgeband?: EdgeBandSpec;
  grooves?: GrooveSpec[];
  holes?: HolePatternSpec[];
  cnc?: CncOperation[];
}

// Helper functions
export function hasAnyServices(services: PartServices | undefined | null): boolean {
  if (!services) return false;
  return !!(
    services.edgeband?.edges?.length ||
    services.grooves?.length ||
    services.holes?.length ||
    services.cnc?.length
  );
}

export function countServices(services: PartServices | undefined | null): number {
  if (!services) return 0;
  let count = 0;
  if (services.edgeband?.edges?.length) count++;
  if (services.grooves?.length) count += services.grooves.length;
  if (services.holes?.length) count += services.holes.length;
  if (services.cnc?.length) count += services.cnc.length;
  return count;
}

export function createEmptyServices(): PartServices {
  return {};
}

export function createEdgeBandSpec(edges: ("L1" | "L2" | "W1" | "W2")[]): EdgeBandSpec {
  return { edges };
}

export function createBackPanelGroove(): GrooveSpec {
  return {
    onEdges: ["L1", "L2"],
    widthMm: 4,
    depthMm: 10,
    distanceFromEdgeMm: 10,
    face: "back",
    purpose: "back_panel",
  };
}

export function createDrawerBottomGroove(): GrooveSpec {
  return {
    onEdges: ["L1", "L2", "W1"],
    widthMm: 4,
    depthMm: 10,
    distanceFromEdgeMm: 12.5,
    face: "back",
    purpose: "drawer_bottom",
  };
}

export function mergeServices(...services: (PartServices | undefined)[]): PartServices {
  const result: PartServices = {};
  
  for (const svc of services) {
    if (!svc) continue;
    
    if (svc.edgeband) {
      if (!result.edgeband) {
        result.edgeband = { ...svc.edgeband, edges: [...svc.edgeband.edges] };
      } else {
        result.edgeband.edges = [...new Set([...result.edgeband.edges, ...svc.edgeband.edges])] as EdgeBandSpec["edges"];
      }
    }
    
    if (svc.grooves?.length) {
      result.grooves = [...(result.grooves || []), ...svc.grooves];
    }
    
    if (svc.holes?.length) {
      result.holes = [...(result.holes || []), ...svc.holes];
    }
    
    if (svc.cnc?.length) {
      result.cnc = [...(result.cnc || []), ...svc.cnc];
    }
  }
  
  return result;
}

