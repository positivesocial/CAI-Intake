/**
 * CAI Intake - Canonical Service Types
 * 
 * This is the SINGLE INTERNAL TRUTH for all service operations.
 * All external formats (OCR, templates, uploads) get normalized into these types.
 * 
 * Design Principles:
 * 1. These types are INTERNAL - never expose to users directly
 * 2. All parsing/import flows MUST normalize to these types
 * 3. Display layers convert back to shortcodes for human readability
 * 4. The existing PartOps schema maps cleanly to/from these types
 */

// ============================================================
// EDGE IDENTIFIERS
// ============================================================

/**
 * Canonical edge identifiers for rectangular parts
 * 
 * L1 = First long edge (typically the "front" or "visible" edge)
 * L2 = Second long edge (typically the "back" edge)
 * W1 = First width edge (typically the "left" edge)
 * W2 = Second width edge (typically the "right" edge)
 * 
 * Origin is bottom-left corner when viewing the part from above.
 */
export type EdgeSide = "L1" | "L2" | "W1" | "W2";

/**
 * All possible edge sides as an array
 */
export const ALL_EDGE_SIDES: readonly EdgeSide[] = ["L1", "L2", "W1", "W2"] as const;

/**
 * Long edges only
 */
export const LONG_EDGES: readonly EdgeSide[] = ["L1", "L2"] as const;

/**
 * Width edges only
 */
export const WIDTH_EDGES: readonly EdgeSide[] = ["W1", "W2"] as const;

// ============================================================
// EDGEBANDING
// ============================================================

/**
 * Canonical edge banding specification
 * 
 * Represents which edges of a part should have edge banding applied.
 * This is the internal truth - external formats like "2L2W" or "All"
 * get normalized into this structure.
 */
export interface EdgeBandSpec {
  /** Which edges to band - always use EdgeSide[] */
  edges: EdgeSide[];
  
  /** Optional reference to edgeband material (from edgeband library) */
  tapeId?: string;
  
  /** Tape thickness in mm (e.g., 0.4, 1, 2) */
  thicknessMm?: number;
  
  /** Additional notes for this edgebanding operation */
  note?: string;
}

// ============================================================
// GROOVES
// ============================================================

/**
 * Face of the part where operation is performed
 */
export type PartFace = "front" | "back";

/**
 * Canonical groove specification
 * 
 * A groove runs parallel to an edge, typically for back panels
 * or drawer bottoms.
 */
export interface GrooveSpec {
  /** Which edge the groove runs along (parallel to) */
  onEdge: EdgeSide;
  
  /** Distance from the reference edge to the groove (perpendicular offset) */
  distanceFromEdgeMm: number;
  
  /** Width of the groove cut */
  widthMm: number;
  
  /** Depth of the groove cut */
  depthMm: number;
  
  /** Which face the groove is cut from */
  face: PartFace;
  
  /** If stopped (not through), the start and end offsets from corners */
  stops?: {
    startOffsetMm: number;
    endOffsetMm: number;
  } | null;
  
  /** Optional reference to groove profile definition */
  profileId?: string;
  
  /** Additional notes */
  note?: string;
}

// ============================================================
// HOLE PATTERNS
// ============================================================

/**
 * Types of hole patterns
 */
export type HolePatternKind = 
  | "hinge"           // Door/cabinet hinges (e.g., 35mm cup, mounting holes)
  | "shelf_pins"      // Adjustable shelf pin holes (5mm typically)
  | "handle"          // Handle/pull mounting holes
  | "knob"            // Single knob mounting hole
  | "drawer_slide"    // Drawer slide mounting holes
  | "cam_lock"        // Cam lock/fastener holes
  | "dowel"           // Dowel alignment holes
  | "system32"        // System 32 hole line
  | "custom";         // Custom/other hole pattern

/**
 * Canonical hole pattern specification
 * 
 * Represents drilling operations for hardware mounting.
 */
export interface HolePatternSpec {
  /** Type of hole pattern */
  kind: HolePatternKind;
  
  /** Reference edge for positioning */
  refEdge: EdgeSide;
  
  /** Distance(s) from reference edge or corner (mm) */
  offsetsMm: number[];
  
  /** Distance from the edge for the drilling line (mm) */
  distanceFromEdgeMm: number;
  
  /** Number of holes (if not implied by pattern) */
  count?: number;
  
  /** Hole diameter in mm */
  diameterMm?: number;
  
  /** Hole depth in mm */
  depthMm?: number;
  
  /** Hardware reference (e.g., "Blum 71B3550" for hinge) */
  hardwareId?: string;
  
  /** Which face to drill from */
  face?: PartFace | "edge";
  
  /** Optional reference to pattern definition */
  patternId?: string;
  
  /** Additional notes */
  note?: string;
}

// ============================================================
// CNC OPERATIONS
// ============================================================

/**
 * Types of CNC operations
 */
export type CncOpType = 
  | "pocket"          // Rectangular or shaped pocket
  | "contour"         // Edge profile/routing
  | "drill_array"     // Array of holes (not hardware-specific)
  | "cutout"          // Through-cut shape (sink, vent, etc.)
  | "text"            // Engraved text
  | "radius"          // Corner radius
  | "chamfer"         // Edge chamfer
  | "rebate"          // Edge rebate/rabbet
  | "custom";         // Custom CNC program

/**
 * Canonical CNC operation specification
 * 
 * For operations beyond edge banding, grooves, and standard hole patterns.
 */
export interface CncOperation {
  /** Type of CNC operation */
  type: CncOpType;
  
  /** Shape or program identifier */
  shapeId: string;
  
  /** Operation parameters (flexible key-value) */
  params: Record<string, number | string | boolean>;
  
  /** Which face the operation is on */
  face?: PartFace;
  
  /** Position from origin (if applicable) */
  position?: {
    x: number;
    y: number;
  };
  
  /** Dimensions (if applicable) */
  dimensions?: {
    width: number;
    height: number;
    depth?: number;
  };
  
  /** Additional notes */
  note?: string;
}

// ============================================================
// COMBINED PART SERVICES
// ============================================================

/**
 * All services/operations for a single part
 * 
 * This is the canonical internal representation that all
 * parsing flows should produce and all display flows should consume.
 */
export interface PartServices {
  /** Edge banding configuration */
  edgeband?: EdgeBandSpec;
  
  /** Groove operations (can have multiple) */
  grooves?: GrooveSpec[];
  
  /** Hole patterns (can have multiple) */
  holes?: HolePatternSpec[];
  
  /** CNC operations (can have multiple) */
  cnc?: CncOperation[];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if any services are defined
 */
export function hasAnyServices(services: PartServices | undefined): boolean {
  if (!services) return false;
  return !!(
    (services.edgeband?.edges && services.edgeband.edges.length > 0) ||
    (services.grooves && services.grooves.length > 0) ||
    (services.holes && services.holes.length > 0) ||
    (services.cnc && services.cnc.length > 0)
  );
}

/**
 * Get count of active services
 */
export function countServices(services: PartServices | undefined): number {
  if (!services) return 0;
  let count = 0;
  if (services.edgeband?.edges && services.edgeband.edges.length > 0) count++;
  if (services.grooves && services.grooves.length > 0) count += services.grooves.length;
  if (services.holes && services.holes.length > 0) count += services.holes.length;
  if (services.cnc && services.cnc.length > 0) count += services.cnc.length;
  return count;
}

/**
 * Create an empty PartServices object
 */
export function createEmptyServices(): PartServices {
  return {};
}

/**
 * Create an EdgeBandSpec from edge array
 */
export function createEdgeBandSpec(
  edges: EdgeSide[],
  options?: { tapeId?: string; thicknessMm?: number; note?: string }
): EdgeBandSpec {
  return {
    edges: [...new Set(edges)], // Deduplicate
    ...options,
  };
}

/**
 * Create a standard back panel groove spec
 */
export function createBackPanelGroove(
  options?: Partial<GrooveSpec>
): GrooveSpec {
  return {
    onEdge: "W2",
    distanceFromEdgeMm: 10,
    widthMm: 4,
    depthMm: 10,
    face: "back",
    note: "Back panel groove",
    ...options,
  };
}

/**
 * Create a standard drawer bottom groove spec
 */
export function createDrawerBottomGroove(
  options?: Partial<GrooveSpec>
): GrooveSpec {
  return {
    onEdge: "W1",
    distanceFromEdgeMm: 12,
    widthMm: 4,
    depthMm: 8,
    face: "back",
    note: "Drawer bottom groove",
    ...options,
  };
}

/**
 * Merge two PartServices objects
 */
export function mergeServices(
  base: PartServices | undefined,
  override: PartServices | undefined
): PartServices {
  if (!base) return override ?? {};
  if (!override) return base;
  
  return {
    edgeband: override.edgeband ?? base.edgeband,
    grooves: [...(base.grooves ?? []), ...(override.grooves ?? [])],
    holes: [...(base.holes ?? []), ...(override.holes ?? [])],
    cnc: [...(base.cnc ?? []), ...(override.cnc ?? [])],
  };
}

