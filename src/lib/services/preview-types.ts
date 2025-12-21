/**
 * CAI Intake - Part Preview Types
 * 
 * 2D preview data types for visualizing part services.
 * These are rendering-oriented types derived from the canonical service types.
 * 
 * Coordinate System:
 * - Origin (0,0) = bottom-left corner of part
 * - X axis: 0 → L (length in mm)
 * - Y axis: 0 → W (width in mm)
 * - "Front" edge = L1 (bottom edge in visual)
 * - "Back" edge = L2 (top edge in visual)
 * - "Left" edge = W1 (left edge in visual)
 * - "Right" edge = W2 (right edge in visual)
 * 
 * ```
 *     L2 (back)
 *     ┌──────────────────┐
 *     │                  │
 * W1  │     (x, y)       │ W2
 *     │       ●          │ 
 *     │                  │
 *     └──────────────────┘
 *     L1 (front)
 *     
 *     Origin (0,0) = bottom-left
 * ```
 */

import type { EdgeSide, HolePatternKind, CncOpType } from "./canonical-types";

// ============================================================
// EDGE MAPPING FOR PREVIEW
// ============================================================

/**
 * Maps EdgeSide to visual edge position
 */
export type PreviewEdge = "front" | "back" | "left" | "right";

/**
 * Map from EdgeSide to preview edge
 */
export const EDGE_SIDE_TO_PREVIEW: Record<EdgeSide, PreviewEdge> = {
  L1: "front",
  L2: "back",
  W1: "left",
  W2: "right",
};

/**
 * Map from preview edge to EdgeSide
 */
export const PREVIEW_TO_EDGE_SIDE: Record<PreviewEdge, EdgeSide> = {
  front: "L1",
  back: "L2",
  left: "W1",
  right: "W2",
};

// ============================================================
// PREVIEW DATA TYPES
// ============================================================

/**
 * Complete preview data for a part
 * Contains all service visualizations in 2D coordinates
 */
export interface PartPreviewData {
  /** Part length in mm (X axis) */
  L: number;
  
  /** Part width in mm (Y axis) */
  W: number;
  
  /** Grain direction */
  grain?: "along_L" | "none";
  
  /** Edgeband visualizations */
  edgebands: PreviewEdgeband[];
  
  /** Groove visualizations */
  grooves: PreviewGroove[];
  
  /** Hole visualizations */
  holes: PreviewHole[];
  
  /** Pocket/cutout visualizations */
  pockets: PreviewPocket[];
  
  /** Corner round visualizations */
  cornerRounds: PreviewCornerRound[];
}

/**
 * Edgeband visualization data
 */
export interface PreviewEdgeband {
  /** Which edge has banding */
  edge: EdgeSide;
  
  /** Preview edge position for rendering */
  position: PreviewEdge;
  
  /** Color for rendering (optional, uses default if not specified) */
  color?: string;
  
  /** Thickness for tooltip display */
  thicknessMm?: number;
  
  /** Material name for tooltip */
  materialName?: string;
}

/**
 * Groove visualization data
 */
export interface PreviewGroove {
  /** Unique identifier */
  id: string;
  
  /** Start point X coordinate (mm) */
  x1: number;
  
  /** Start point Y coordinate (mm) */
  y1: number;
  
  /** End point X coordinate (mm) */
  x2: number;
  
  /** End point Y coordinate (mm) */
  y2: number;
  
  /** Groove width in mm (for stroke width calculation) */
  widthMm: number;
  
  /** Groove depth in mm (for tooltip) */
  depthMm: number;
  
  /** Which edge it runs along (for tooltip) */
  alongEdge: EdgeSide;
  
  /** Distance from reference edge (for tooltip) */
  offsetMm: number;
}

/**
 * Hole visualization data
 */
export interface PreviewHole {
  /** Unique identifier */
  id: string;
  
  /** Center X coordinate (mm) */
  x: number;
  
  /** Center Y coordinate (mm) */
  y: number;
  
  /** Hole diameter in mm */
  diameterMm: number;
  
  /** Type of hole for color coding */
  usage: HolePatternKind | "other";
  
  /** Human-readable description for tooltip */
  description?: string;
}

/**
 * Pocket/cutout visualization data
 */
export interface PreviewPocket {
  /** Unique identifier */
  id: string;
  
  /** Bottom-left X coordinate (mm) */
  x: number;
  
  /** Bottom-left Y coordinate (mm) */
  y: number;
  
  /** Pocket width in mm */
  width: number;
  
  /** Pocket height in mm */
  height: number;
  
  /** Pocket depth in mm (for tooltip) */
  depthMm?: number;
  
  /** Type of pocket for styling */
  kind: "pocket" | "cutout" | "rebate" | "recess";
  
  /** Purpose for tooltip */
  purpose?: string;
}

/**
 * Corner round visualization data
 */
export interface PreviewCornerRound {
  /** Which corner */
  corner: "TL" | "TR" | "BL" | "BR";
  
  /** Radius in mm */
  radiusMm: number;
}

// ============================================================
// PREVIEW SIZE CONFIGURATIONS
// ============================================================

/**
 * Predefined preview sizes
 */
export type PreviewSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Size configuration for preview rendering
 */
export interface PreviewSizeConfig {
  /** Maximum pixel dimension (width or height) */
  maxPx: number;
  
  /** Whether to show service details or just badges */
  showDetails: boolean;
  
  /** Whether to show tooltips on hover */
  showTooltips: boolean;
  
  /** Minimum feature size to render (mm) - smaller features become badges */
  minFeatureMm: number;
  
  /** Edge stroke width in pixels */
  edgeStrokePx: number;
}

/**
 * Size configurations
 */
export const PREVIEW_SIZE_CONFIGS: Record<PreviewSize, PreviewSizeConfig> = {
  xs: {
    maxPx: 40,
    showDetails: false,
    showTooltips: false,
    minFeatureMm: 100,
    edgeStrokePx: 2,
  },
  sm: {
    maxPx: 60,
    showDetails: false,
    showTooltips: true,
    minFeatureMm: 50,
    edgeStrokePx: 2.5,
  },
  md: {
    maxPx: 120,
    showDetails: true,
    showTooltips: true,
    minFeatureMm: 20,
    edgeStrokePx: 3,
  },
  lg: {
    maxPx: 200,
    showDetails: true,
    showTooltips: true,
    minFeatureMm: 10,
    edgeStrokePx: 4,
  },
  xl: {
    maxPx: 300,
    showDetails: true,
    showTooltips: true,
    minFeatureMm: 5,
    edgeStrokePx: 5,
  },
};

// ============================================================
// COLOR CONSTANTS
// ============================================================

/**
 * Colors for different service types (CSS color values)
 */
export const SERVICE_COLORS = {
  edgeband: {
    default: "var(--cai-teal)",
    highlight: "var(--cai-teal-dark)",
  },
  groove: {
    default: "#0ea5e9",  // Sky blue
    highlight: "#0284c7",
  },
  hole: {
    hinge: "#f97316",        // Orange
    shelf_pins: "#6366f1",   // Indigo
    handle: "#ec4899",       // Pink
    knob: "#8b5cf6",         // Purple
    drawer_slide: "#14b8a6", // Teal
    cam_lock: "#f59e0b",     // Amber
    dowel: "#84cc16",        // Lime
    system32: "#6366f1",     // Indigo
    custom: "#6b7280",       // Gray
    other: "#6b7280",        // Gray
  },
  pocket: {
    pocket: "#fbbf24",       // Amber
    cutout: "#ef4444",       // Red
    rebate: "#3b82f6",       // Blue
    recess: "#a855f7",       // Purple
  },
  cornerRound: {
    default: "#10b981",      // Emerald
  },
} as const;

// ============================================================
// HELPER TYPES
// ============================================================

/**
 * Service badge for when details can't be shown
 */
export interface ServiceBadge {
  type: "edgeband" | "groove" | "hole" | "pocket" | "corner";
  count: number;
  color: string;
  label: string;
}

/**
 * Empty preview data factory
 */
export function createEmptyPreviewData(L: number, W: number): PartPreviewData {
  return {
    L,
    W,
    edgebands: [],
    grooves: [],
    holes: [],
    pockets: [],
    cornerRounds: [],
  };
}

/**
 * Check if preview data has any services
 */
export function hasPreviewServices(data: PartPreviewData): boolean {
  return (
    data.edgebands.length > 0 ||
    data.grooves.length > 0 ||
    data.holes.length > 0 ||
    data.pockets.length > 0 ||
    data.cornerRounds.length > 0
  );
}

/**
 * Count total services in preview data
 */
export function countPreviewServices(data: PartPreviewData): number {
  return (
    data.edgebands.length +
    data.grooves.length +
    data.holes.length +
    data.pockets.length +
    data.cornerRounds.length
  );
}

/**
 * Generate service badges from preview data
 */
export function generateServiceBadges(data: PartPreviewData): ServiceBadge[] {
  const badges: ServiceBadge[] = [];
  
  if (data.edgebands.length > 0) {
    badges.push({
      type: "edgeband",
      count: data.edgebands.length,
      color: SERVICE_COLORS.edgeband.default,
      label: `${data.edgebands.length}E`,
    });
  }
  
  if (data.grooves.length > 0) {
    badges.push({
      type: "groove",
      count: data.grooves.length,
      color: SERVICE_COLORS.groove.default,
      label: `${data.grooves.length}G`,
    });
  }
  
  if (data.holes.length > 0) {
    badges.push({
      type: "hole",
      count: data.holes.length,
      color: SERVICE_COLORS.hole.other,
      label: `${data.holes.length}H`,
    });
  }
  
  if (data.pockets.length > 0) {
    badges.push({
      type: "pocket",
      count: data.pockets.length,
      color: SERVICE_COLORS.pocket.pocket,
      label: `${data.pockets.length}P`,
    });
  }
  
  if (data.cornerRounds.length > 0) {
    badges.push({
      type: "corner",
      count: data.cornerRounds.length,
      color: SERVICE_COLORS.cornerRound.default,
      label: `${data.cornerRounds.length}R`,
    });
  }
  
  return badges;
}



