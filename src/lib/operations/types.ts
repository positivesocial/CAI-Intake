/**
 * CAI Intake - Operations System Types
 * 
 * Unified type definitions for all operations:
 * - Edgeband: Edge banding specifications
 * - Groove: Groove operations (back panel, drawer bottom, etc.)
 * - Drilling: Hole patterns for hardware (hinges, handles, etc.)
 * - CNC: CNC operations (pockets, cutouts, chamfers, etc.)
 * 
 * Each operation has:
 * - code: The shortcode for quick input
 * - name: Human-readable name
 * - spec: Type-specific specification
 */

// ============================================================
// CORE TYPES
// ============================================================

/** Operation category */
export type OperationCategory = "edgeband" | "groove" | "drilling" | "cnc";

/** Edge identifiers for rectangular parts */
export type EdgeSide = "L1" | "L2" | "W1" | "W2";

/** All edge sides */
export const ALL_EDGES: readonly EdgeSide[] = ["L1", "L2", "W1", "W2"] as const;
export const LONG_EDGES: readonly EdgeSide[] = ["L1", "L2"] as const;
export const WIDTH_EDGES: readonly EdgeSide[] = ["W1", "W2"] as const;

/** Part face for operations */
export type PartFace = "front" | "back";

/** Reference corner for drilling */
export type RefCorner = "TL" | "TR" | "BL" | "BR";

/** CNC tool types */
export type ToolType = 
  | "straight" 
  | "spiral_up" 
  | "spiral_down" 
  | "compression" 
  | "vbit" 
  | "ballnose" 
  | "ogee";

// ============================================================
// OPERATION TYPE (for type dropdowns)
// ============================================================

/** 
 * Operation type - defines a category of operation
 * Used for dropdown selections in the UI
 */
export interface OperationType {
  id: string;
  organizationId: string | null;
  category: OperationCategory;
  code: string;           // e.g., "hinge", "pocket", "back_panel"
  name: string;           // e.g., "Hinge Boring", "Pocket", "Back Panel"
  description?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationTypeInput {
  category: OperationCategory;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  displayOrder?: number;
}

// ============================================================
// GROOVE TYPE CODES (system defaults)
// ============================================================

export type GrooveTypeCode = 
  | "back_panel"
  | "drawer_bottom"
  | "divider"
  | "light_channel"
  | "glass_panel"
  | "custom";

export const GROOVE_TYPE_LABELS: Record<GrooveTypeCode, string> = {
  back_panel: "Back Panel",
  drawer_bottom: "Drawer Bottom",
  divider: "Divider",
  light_channel: "Light Channel",
  glass_panel: "Glass Panel",
  custom: "Custom",
};

// ============================================================
// DRILLING TYPE CODES (system defaults)
// ============================================================

export type DrillingTypeCode = 
  | "hinge"
  | "shelf_pins"
  | "handle"
  | "knob"
  | "drawer_slide"
  | "cam_lock"
  | "dowel"
  | "system32"
  | "custom";

export const DRILLING_TYPE_LABELS: Record<DrillingTypeCode, string> = {
  hinge: "Hinge Boring",
  shelf_pins: "Shelf Pins",
  handle: "Handle",
  knob: "Knob",
  drawer_slide: "Drawer Slide",
  cam_lock: "Cam Lock",
  dowel: "Dowel",
  system32: "System 32",
  custom: "Custom",
};

// ============================================================
// CNC TYPE CODES (system defaults)
// ============================================================

export type CncTypeCode = 
  | "pocket"
  | "cutout"
  | "chamfer"
  | "radius"
  | "rebate"
  | "contour"
  | "text"
  | "custom";

export const CNC_TYPE_LABELS: Record<CncTypeCode, string> = {
  pocket: "Pocket",
  cutout: "Cutout",
  chamfer: "Chamfer",
  radius: "Corner Radius",
  rebate: "Rebate",
  contour: "Contour",
  text: "Text Engraving",
  custom: "Custom",
};

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  straight: "Straight",
  spiral_up: "Spiral Up-cut",
  spiral_down: "Spiral Down-cut",
  compression: "Compression",
  vbit: "V-Bit",
  ballnose: "Ball Nose",
  ogee: "Ogee",
};

// ============================================================
// EDGEBAND OPERATION
// ============================================================

/**
 * Edgeband operation - specifies which edges to band
 * No type dropdown - the "type" is effectively the edgeband material
 */
export interface EdgebandOperation {
  id: string;
  organizationId: string | null;
  code: string;           // shortcode: "2L2W", "L1", "ALL"
  name: string;           // "All Edges", "Long 1 Only"
  description?: string;
  
  // Spec
  edges: EdgeSide[];      // which edges to band
  materialId?: string;    // reference to edgeband material
  thicknessMm?: number;   // tape thickness
  
  // Metadata
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EdgebandOperationInput {
  code: string;
  name: string;
  description?: string;
  edges: EdgeSide[];
  materialId?: string;
  thicknessMm?: number;
  isActive?: boolean;
}

// ============================================================
// GROOVE OPERATION
// ============================================================

/**
 * Groove operation - grooves for back panels, drawer bottoms, etc.
 */
export interface GrooveOperation {
  id: string;
  organizationId: string | null;
  code: string;           // shortcode: "GL-4-10", "BP", "DB"
  name: string;           // "Back Panel Groove"
  description?: string;
  
  // Type (from dropdown)
  typeId?: string;
  type?: OperationType;   // populated on fetch
  
  // Spec
  widthMm: number;
  depthMm: number;
  offsetFromEdgeMm: number; // distance from edge
  edge?: EdgeSide;        // which edge the groove runs along
  
  // Metadata
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrooveOperationInput {
  code: string;
  name: string;
  description?: string;
  typeId?: string;
  widthMm: number;
  depthMm: number;
  offsetFromEdgeMm?: number;
  edge?: EdgeSide;
  isActive?: boolean;
}

// ============================================================
// DRILLING OPERATION
// ============================================================

/** Single hole definition */
export interface HoleDefinition {
  x: number;          // mm from reference edge
  y: number;          // mm from reference corner
  diaMm: number;      // hole diameter
  depthMm?: number;   // hole depth (omit for through)
  through?: boolean;
}

/** Parametric config for System 32 and similar */
export interface ParametricConfig {
  spacingMm: number;      // e.g., 32 for System 32
  marginMm: number;       // distance from edge
  rows: number | "auto";  // number of rows or auto-calculate
  holeDiaMm: number;
  holeDepthMm: number;
}

/**
 * Drilling operation - hole patterns for hardware
 */
export interface DrillingOperation {
  id: string;
  organizationId: string | null;
  code: string;           // shortcode: "H2-110", "SP32", "HD-96"
  name: string;           // "2 Hinges @ 110mm"
  description?: string;
  
  // Type (from dropdown)
  typeId?: string;
  type?: OperationType;
  
  // Spec
  holes: HoleDefinition[];
  refEdge?: EdgeSide;
  refCorner?: RefCorner;
  
  // Hardware (text only)
  hardwareBrand?: string;
  hardwareModel?: string;
  
  // Metadata
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DrillingOperationInput {
  code: string;
  name: string;
  description?: string;
  typeId?: string;
  holes: HoleDefinition[];
  refEdge?: EdgeSide;
  refCorner?: RefCorner;
  hardwareBrand?: string;
  hardwareModel?: string;
  isActive?: boolean;
}

// ============================================================
// CNC OPERATION
// ============================================================

/**
 * CNC operation - pockets, cutouts, chamfers, etc.
 */
export interface CncOperation {
  id: string;
  organizationId: string | null;
  code: string;           // shortcode: "PKT-50", "RAD-10", "CUT-SINK"
  name: string;           // "50mm Pocket", "10mm Radius"
  description?: string;
  
  // Type (from dropdown)
  typeId?: string;
  type?: OperationType;
  
  // Spec
  opType: string;         // edge_profile, pocket, cutout, etc.
  parametricConfig?: Record<string, unknown>;
  shapeId?: string;
  params?: Record<string, unknown>;
  
  // Metadata
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CncOperationInput {
  code: string;
  name: string;
  description?: string;
  typeId?: string;
  opType: string;
  parametricConfig?: Record<string, unknown>;
  shapeId?: string;
  params?: Record<string, unknown>;
  isActive?: boolean;
}

// ============================================================
// COMBINED PART OPERATIONS (for CutPart.ops)
// ============================================================

/**
 * Resolved operations for a part - used in CutPart
 * This is what gets stored after resolving shortcodes
 */
export interface PartOperations {
  edging?: {
    edges: Record<EdgeSide, {
      apply: boolean;
      edgebandId?: string;
      thicknessMm?: number;
      remarks?: string;
    }>;
    summary?: {
      code: string;
      edgeCount: number;
    };
  };
  grooves?: Array<{
    edge: EdgeSide;
    widthMm: number;
    depthMm: number;
    offsetMm: number;
    face: PartFace;
    stopped?: { startMm: number; endMm: number };
    code?: string;
  }>;
  holes?: Array<{
    kind: string;
    holes: HoleDefinition[];
    refEdge?: EdgeSide;
    refCorner?: RefCorner;
    hardware?: { brand?: string; model?: string };
    code?: string;
  }>;
  cnc?: Array<{
    type: string;
    params: Record<string, number | string | boolean | string[]>;
    tooling?: {
      toolId?: string;
      toolType?: ToolType;
      toolDiaMm?: number;
    };
    code?: string;
  }>;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface OperationsLibrarySummary {
  operationTypes: number;
  edgebandOperations: number;
  grooveOperations: number;
  drillingOperations: number;
  cncOperations: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if edges array represents "all edges"
 */
export function isAllEdges(edges: EdgeSide[]): boolean {
  return edges.length === 4 && 
    edges.includes("L1") && 
    edges.includes("L2") && 
    edges.includes("W1") && 
    edges.includes("W2");
}

/**
 * Check if edges array represents "long edges only"
 */
export function isLongEdgesOnly(edges: EdgeSide[]): boolean {
  return edges.length === 2 && 
    edges.includes("L1") && 
    edges.includes("L2") &&
    !edges.includes("W1") && 
    !edges.includes("W2");
}

/**
 * Check if edges array represents "width edges only"
 */
export function isWidthEdgesOnly(edges: EdgeSide[]): boolean {
  return edges.length === 2 && 
    edges.includes("W1") && 
    edges.includes("W2") &&
    !edges.includes("L1") && 
    !edges.includes("L2");
}

/**
 * Generate a standard edge code from edges array
 */
export function edgesToCode(edges: EdgeSide[]): string {
  if (isAllEdges(edges)) return "2L2W";
  if (isLongEdgesOnly(edges)) return "2L";
  if (isWidthEdgesOnly(edges)) return "2W";
  
  const longCount = edges.filter(e => e === "L1" || e === "L2").length;
  const widthCount = edges.filter(e => e === "W1" || e === "W2").length;
  
  if (longCount === 1 && widthCount === 2) return "L2W";
  if (longCount === 2 && widthCount === 1) return "2LW";
  
  return edges.join("+");
}

/**
 * Parse an edge code to edges array
 */
export function codeToEdges(code: string): EdgeSide[] {
  const upper = code.toUpperCase().trim();
  
  // Common codes
  switch (upper) {
    case "2L2W":
    case "ALL":
    case "4":
      return ["L1", "L2", "W1", "W2"];
    case "2L":
      return ["L1", "L2"];
    case "2W":
      return ["W1", "W2"];
    case "L1":
      return ["L1"];
    case "L2":
      return ["L2"];
    case "W1":
      return ["W1"];
    case "W2":
      return ["W2"];
    case "L2W":
    case "LWW":
      return ["L1", "W1", "W2"];
    case "2LW":
    case "LLW":
      return ["L1", "L2", "W1"];
    case "0":
    case "NONE":
      return [];
  }
  
  // Try parsing as edge list (L1+L2+W1)
  const edges: EdgeSide[] = [];
  if (upper.includes("L1")) edges.push("L1");
  if (upper.includes("L2")) edges.push("L2");
  if (upper.includes("W1")) edges.push("W1");
  if (upper.includes("W2")) edges.push("W2");
  
  return edges;
}
