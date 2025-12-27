/**
 * CAI Intake - Part Preview Converter
 * 
 * Converts PartOps (schema) to PartPreviewData (2D visualization).
 * This bridges the data layer with the rendering layer.
 */

import type { PartOps, GrooveOp, HoleOp, RoutingOp, CustomCncOp } from "@/lib/schema/operations";
import type { EdgeSide, HolePatternKind } from "./compat-types";
import type {
  PartPreviewData,
  PreviewEdgeband,
  PreviewGroove,
  PreviewHole,
  PreviewPocket,
  PreviewCornerRound,
} from "./preview-types";
import { EDGE_SIDE_TO_PREVIEW, createEmptyPreviewData } from "./preview-types";

// ============================================================
// MAIN CONVERTER
// ============================================================

/**
 * Convert PartOps to PartPreviewData
 * 
 * @param L - Part length in mm
 * @param W - Part width in mm
 * @param grain - Grain direction
 * @param ops - Part operations from schema
 * @returns Preview data for rendering
 */
export function convertOpsToPreview(
  L: number,
  W: number,
  grain: "along_L" | "none" | string = "none",
  ops: PartOps | undefined
): PartPreviewData {
  const preview = createEmptyPreviewData(L, W);
  preview.grain = grain === "along_L" ? "along_L" : "none";
  
  if (!ops) return preview;
  
  // Convert each operation type
  preview.edgebands = convertEdging(ops);
  preview.grooves = convertGrooves(L, W, ops.grooves);
  preview.holes = convertHoles(L, W, ops.holes);
  
  // Convert routing and custom CNC to pockets/corners
  const { pockets, cornerRounds } = convertCncOps(L, W, ops.routing, ops.custom_cnc_ops);
  preview.pockets = pockets;
  preview.cornerRounds = cornerRounds;
  
  return preview;
}

// ============================================================
// EDGING CONVERTER
// ============================================================

/**
 * Convert edging operations to preview edgebands
 */
function convertEdging(ops: PartOps): PreviewEdgeband[] {
  const edgebands: PreviewEdgeband[] = [];
  
  if (!ops.edging?.edges) return edgebands;
  
  for (const [edge, config] of Object.entries(ops.edging.edges)) {
    if (config?.apply && isValidEdge(edge)) {
      edgebands.push({
        edge: edge as EdgeSide,
        position: EDGE_SIDE_TO_PREVIEW[edge as EdgeSide],
        thicknessMm: config.thickness_mm,
        // Material name would come from edgeband library lookup
      });
    }
  }
  
  return edgebands;
}

/**
 * Check if string is a valid EdgeSide
 */
function isValidEdge(edge: string): edge is EdgeSide {
  return ["L1", "L2", "W1", "W2"].includes(edge);
}

// ============================================================
// GROOVE CONVERTER
// ============================================================

/**
 * Convert groove operations to preview grooves with coordinates
 * 
 * Coordinate mapping:
 * - L1/L2 grooves run along the X axis (0 → L)
 * - W1/W2 grooves run along the Y axis (0 → W)
 * - offset_mm determines the perpendicular position
 */
function convertGrooves(
  L: number,
  W: number,
  grooves: GrooveOp[] | undefined
): PreviewGroove[] {
  if (!grooves) return [];
  
  return grooves.map((groove, index) => {
    const side = groove.side as EdgeSide;
    const offset = groove.offset_mm ?? 10;
    const width = groove.width_mm ?? 4;
    const depth = groove.depth_mm ?? 8;
    
    let x1: number, y1: number, x2: number, y2: number;
    
    // Calculate start/stop offsets for stopped grooves
    const startOffset = groove.stopped ? (groove.start_offset_mm ?? 0) : 0;
    const endOffset = groove.stopped ? (groove.end_offset_mm ?? 0) : 0;
    
    switch (side) {
      case "L1":
        // Groove along front edge (bottom), runs X direction
        // Offset is distance from L1 into the part (Y direction)
        x1 = startOffset;
        x2 = L - endOffset;
        y1 = y2 = offset;
        break;
        
      case "L2":
        // Groove along back edge (top), runs X direction
        // Offset is distance from L2 into the part (Y direction from top)
        x1 = startOffset;
        x2 = L - endOffset;
        y1 = y2 = W - offset;
        break;
        
      case "W1":
        // Groove along left edge, runs Y direction
        // Offset is distance from W1 into the part (X direction)
        y1 = startOffset;
        y2 = W - endOffset;
        x1 = x2 = offset;
        break;
        
      case "W2":
        // Groove along right edge, runs Y direction
        // Offset is distance from W2 into the part (X direction from right)
        y1 = startOffset;
        y2 = W - endOffset;
        x1 = x2 = L - offset;
        break;
        
      default:
        // Default to L1 if unknown
        x1 = 0; x2 = L; y1 = y2 = offset;
    }
    
    return {
      id: groove.groove_id ?? `groove-${index}`,
      x1, y1, x2, y2,
      widthMm: width,
      depthMm: depth,
      alongEdge: side,
      offsetMm: offset,
    };
  });
}

// ============================================================
// HOLE CONVERTER
// ============================================================

/**
 * Convert hole operations to preview holes
 * 
 * This handles both inline holes (with x, y coordinates) and
 * pattern references (which need to generate hole positions).
 */
function convertHoles(
  L: number,
  W: number,
  holes: HoleOp[] | undefined
): PreviewHole[] {
  if (!holes) return [];
  
  const previewHoles: PreviewHole[] = [];
  
  for (const holeOp of holes) {
    // If inline holes are defined, use those coordinates
    if (holeOp.holes && holeOp.holes.length > 0) {
      for (const hole of holeOp.holes) {
        previewHoles.push({
          id: `hole-${previewHoles.length}`,
          x: hole.x,
          y: hole.y,
          diameterMm: hole.dia_mm,
          usage: guessHoleUsage(hole.dia_mm),
          description: `${hole.dia_mm}mm hole`,
        });
      }
    }
    
    // If pattern_id is defined, generate holes from pattern
    else if (holeOp.pattern_id) {
      const patternHoles = generateHolesFromPattern(L, W, holeOp.pattern_id);
      previewHoles.push(...patternHoles);
    }
  }
  
  return previewHoles;
}

/**
 * Guess hole usage based on diameter
 */
function guessHoleUsage(diameter: number): HolePatternKind | "other" {
  if (diameter >= 30 && diameter <= 40) return "hinge"; // 35mm cup holes
  if (diameter >= 4 && diameter <= 6) return "shelf_pins"; // 5mm shelf pins
  if (diameter >= 7 && diameter <= 10) return "dowel"; // 8mm dowels
  if (diameter >= 14 && diameter <= 16) return "cam_lock"; // 15mm cam locks
  return "custom";
}

/**
 * Generate hole positions from a pattern ID
 * 
 * Common patterns:
 * - H2-110: 2 hinge cup holes at 110mm from top/bottom
 * - H3-90: 3 hinge cup holes at 90mm from top/bottom
 * - SP-32: System 32 shelf pin line
 */
function generateHolesFromPattern(
  L: number,
  W: number,
  patternId: string
): PreviewHole[] {
  const holes: PreviewHole[] = [];
  const normalized = patternId.toUpperCase();
  
  // Hinge patterns: H[count]-[offset]
  const hingeMatch = normalized.match(/^H(\d+)-(\d+)$/);
  if (hingeMatch) {
    const count = parseInt(hingeMatch[1], 10);
    const offset = parseInt(hingeMatch[2], 10);
    const hingeX = 9.5; // Standard hinge cup X offset from edge
    
    // Generate hinge cup holes
    for (let i = 0; i < count; i++) {
      // Distribute hinges evenly from top and bottom
      let y: number;
      if (count === 2) {
        y = i === 0 ? offset : W - offset;
      } else if (count === 3) {
        y = i === 0 ? offset : i === 1 ? W / 2 : W - offset;
      } else {
        // For 4+ hinges, distribute evenly
        const spacing = (W - 2 * offset) / (count - 1);
        y = offset + i * spacing;
      }
      
      holes.push({
        id: `hinge-${i}`,
        x: hingeX,
        y,
        diameterMm: 35, // Standard cup hole
        usage: "hinge",
        description: `Hinge cup ${i + 1}`,
      });
    }
    return holes;
  }
  
  // Shelf pin patterns: SP-32 or SP-ALL
  if (normalized.startsWith("SP-")) {
    const spacing = 32; // System 32
    const inset = 37; // Standard shelf pin inset from front
    const topMargin = 50; // Start from top
    const bottomMargin = 50; // Stop before bottom
    
    const availableHeight = W - topMargin - bottomMargin;
    const holeCount = Math.floor(availableHeight / spacing) + 1;
    
    // Generate left column
    for (let i = 0; i < holeCount; i++) {
      const y = bottomMargin + i * spacing;
      
      holes.push({
        id: `sp-left-${i}`,
        x: inset,
        y,
        diameterMm: 5,
        usage: "shelf_pins",
        description: "Shelf pin hole",
      });
      
      holes.push({
        id: `sp-right-${i}`,
        x: L - inset,
        y,
        diameterMm: 5,
        usage: "shelf_pins",
        description: "Shelf pin hole",
      });
    }
    return holes;
  }
  
  // Handle patterns: HD-CC[centers]
  const handleMatch = normalized.match(/^HD-CC(\d+)$/);
  if (handleMatch) {
    const centers = parseInt(handleMatch[1], 10);
    const centerX = L / 2;
    const y = 37; // Standard handle position from edge
    
    holes.push({
      id: "handle-left",
      x: centerX - centers / 2,
      y,
      diameterMm: 5,
      usage: "handle",
      description: `Handle hole (${centers}mm CC)`,
    });
    
    holes.push({
      id: "handle-right",
      x: centerX + centers / 2,
      y,
      diameterMm: 5,
      usage: "handle",
      description: `Handle hole (${centers}mm CC)`,
    });
    return holes;
  }
  
  // Knob patterns: KN-CTR or KN-[offset]
  if (normalized.startsWith("KN-")) {
    const centerX = L / 2;
    let y: number;
    
    if (normalized === "KN-CTR" || normalized === "KN-CENTRE") {
      y = W / 2;
    } else {
      const knobMatch = normalized.match(/^KN-(\d+)$/);
      y = knobMatch ? parseInt(knobMatch[1], 10) : 37;
    }
    
    holes.push({
      id: "knob",
      x: centerX,
      y,
      diameterMm: 5,
      usage: "knob",
      description: "Knob mounting hole",
    });
    return holes;
  }
  
  // Drawer slide patterns: DS-STD
  if (normalized.startsWith("DS-")) {
    const insetY = 25; // From bottom
    const holes1X = 37; // Front mounting
    const holes2X = L - 50; // Rear mounting
    
    // Front mounting holes
    holes.push({
      id: "ds-front",
      x: holes1X,
      y: insetY,
      diameterMm: 5,
      usage: "drawer_slide",
      description: "Drawer slide front mount",
    });
    
    // Rear mounting holes
    holes.push({
      id: "ds-rear",
      x: holes2X,
      y: insetY,
      diameterMm: 5,
      usage: "drawer_slide",
      description: "Drawer slide rear mount",
    });
    return holes;
  }
  
  return holes;
}

// ============================================================
// CNC OPERATIONS CONVERTER
// ============================================================

/**
 * Convert routing and custom CNC operations to pockets and corner rounds
 */
function convertCncOps(
  L: number,
  W: number,
  routing: RoutingOp[] | undefined,
  customCnc: CustomCncOp[] | undefined
): { pockets: PreviewPocket[]; cornerRounds: PreviewCornerRound[] } {
  const pockets: PreviewPocket[] = [];
  const cornerRounds: PreviewCornerRound[] = [];
  
  // Convert routing operations to pockets
  if (routing) {
    for (const route of routing) {
      if (route.region) {
        pockets.push({
          id: route.profile_id ?? `route-${pockets.length}`,
          x: route.region.x,
          y: route.region.y,
          width: route.region.L,
          height: route.region.W,
          depthMm: route.depth_mm,
          kind: route.through ? "cutout" : "pocket",
          purpose: route.notes ?? undefined,
        });
      }
    }
  }
  
  // Convert custom CNC operations
  if (customCnc) {
    for (const cnc of customCnc) {
      const { pockets: p, corners: c } = convertCustomCncOp(L, W, cnc);
      pockets.push(...p);
      cornerRounds.push(...c);
    }
  }
  
  return { pockets, cornerRounds };
}

/**
 * Convert a custom CNC operation
 */
function convertCustomCncOp(
  L: number,
  W: number,
  cnc: CustomCncOp
): { pockets: PreviewPocket[]; corners: PreviewCornerRound[] } {
  const pockets: PreviewPocket[] = [];
  const corners: PreviewCornerRound[] = [];
  
  const opType = cnc.op_type.toLowerCase();
  const payload = cnc.payload as Record<string, unknown> | undefined;
  
  // Handle cutout operations
  if (opType.includes("cutout") && payload) {
    const width = typeof payload.width === "number" ? payload.width : 100;
    const height = typeof payload.height === "number" ? payload.height : 100;
    const x = typeof payload.x === "number" ? payload.x : (L - width) / 2;
    const y = typeof payload.y === "number" ? payload.y : (W - height) / 2;
    
    pockets.push({
      id: `cutout-${pockets.length}`,
      x,
      y,
      width,
      height,
      kind: "cutout",
      purpose: cnc.notes ?? "Cutout",
    });
  }
  
  // Handle pocket operations
  else if (opType.includes("pocket") && payload) {
    const width = typeof payload.width === "number" ? payload.width : 50;
    const height = typeof payload.height === "number" ? payload.height : 50;
    const depth = typeof payload.depth === "number" ? payload.depth : undefined;
    const x = typeof payload.x === "number" ? payload.x : (L - width) / 2;
    const y = typeof payload.y === "number" ? payload.y : (W - height) / 2;
    
    pockets.push({
      id: `pocket-${pockets.length}`,
      x,
      y,
      width,
      height,
      depthMm: depth,
      kind: "pocket",
      purpose: cnc.notes ?? "Pocket",
    });
  }
  
  // Handle radius operations
  else if (opType.includes("radius") && payload) {
    const radius = typeof payload.radius === "number" ? payload.radius : 25;
    const cornersStr = typeof payload.corners === "string" ? payload.corners : "all";
    
    const cornerMap: Record<string, ("TL" | "TR" | "BL" | "BR")[]> = {
      all: ["TL", "TR", "BL", "BR"],
      front: ["BL", "BR"], // Front = L1 = bottom
      back: ["TL", "TR"],  // Back = L2 = top
      left: ["TL", "BL"],  // Left = W1
      right: ["TR", "BR"], // Right = W2
      tl: ["TL"],
      tr: ["TR"],
      bl: ["BL"],
      br: ["BR"],
    };
    
    const affectedCorners = cornerMap[cornersStr.toLowerCase()] ?? ["TL", "TR", "BL", "BR"];
    
    for (const corner of affectedCorners) {
      corners.push({
        corner,
        radiusMm: radius,
      });
    }
  }
  
  // Handle rebate operations
  else if (opType.includes("rebate") && payload) {
    const width = typeof payload.width === "number" ? payload.width : 18;
    const depth = typeof payload.depth === "number" ? payload.depth : 10;
    const edge = typeof payload.edge === "string" ? payload.edge : "L1";
    
    // Rebates are represented as thin pockets along edges
    let x = 0, y = 0, pWidth = width, pHeight = W;
    
    switch (edge) {
      case "L1":
        x = 0; y = 0; pWidth = L; pHeight = width;
        break;
      case "L2":
        x = 0; y = W - width; pWidth = L; pHeight = width;
        break;
      case "W1":
        x = 0; y = 0; pWidth = width; pHeight = W;
        break;
      case "W2":
        x = L - width; y = 0; pWidth = width; pHeight = W;
        break;
    }
    
    pockets.push({
      id: `rebate-${edge}`,
      x,
      y,
      width: pWidth,
      height: pHeight,
      depthMm: depth,
      kind: "rebate",
      purpose: `Rebate on ${edge}`,
    });
  }
  
  return { pockets, corners };
}

// ============================================================
// SIMPLIFIED CONVERTER FOR INLINE EDGING
// ============================================================

/**
 * Quick converter for just edging (used in inbox preview)
 */
export function convertEdgingToPreview(
  edging: Record<string, { apply?: boolean }> | undefined
): PreviewEdgeband[] {
  if (!edging) return [];
  
  const edgebands: PreviewEdgeband[] = [];
  
  for (const [edge, config] of Object.entries(edging)) {
    if (config?.apply && isValidEdge(edge)) {
      edgebands.push({
        edge: edge as EdgeSide,
        position: EDGE_SIDE_TO_PREVIEW[edge as EdgeSide],
      });
    }
  }
  
  return edgebands;
}

/**
 * Create preview data from minimal part info
 * Shows grain lines when part cannot rotate (respects material grain)
 */
export function createPreviewFromPart(part: {
  size: { L: number; W: number };
  grain?: string;
  allow_rotation?: boolean;
  ops?: PartOps;
}): PartPreviewData {
  // If allow_rotation is false, show grain lines
  // For backwards compatibility, also check grain field
  const showGrain = part.allow_rotation === false || part.grain === "along_L";
  return convertOpsToPreview(
    part.size.L,
    part.size.W,
    showGrain ? "along_L" : "none",
    part.ops
  );
}





