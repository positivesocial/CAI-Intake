/**
 * CAI Intake - Part Operations Schema
 * 
 * Defines CNC operations, edgebanding, grooves, holes, routing, etc.
 * These are optional processing instructions for advanced shops.
 */

import { z } from "zod";
import { EdgeIdSchema, FaceSchema, HoleFaceSchema } from "./primitives";

// ============================================================
// CNC LIBRARY DEFINITIONS
// ============================================================

/**
 * Hole pattern definition - for reusable drilling patterns
 */
export const HolePatternDefSchema = z.object({
  pattern_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Holes with local coordinates relative to part L/W, origin bottom-left */
  holes: z.array(z.object({
    x: z.number(),
    y: z.number(),
    dia: z.number().positive(),
    depth_mm: z.number().positive().optional(),
  })),
});

export type HolePatternDef = z.infer<typeof HolePatternDefSchema>;

/**
 * Routing profile definition
 */
export const RoutingProfileDefSchema = z.object({
  profile_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tool_dia_mm: z.number().positive().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type RoutingProfileDef = z.infer<typeof RoutingProfileDefSchema>;

/**
 * Groove profile definition
 */
export const GrooveProfileDefSchema = z.object({
  profile_id: z.string(),
  name: z.string(),
  width_mm: z.number().positive(),
  depth_mm: z.number().positive(),
  tool_dia_mm: z.number().positive().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type GrooveProfileDef = z.infer<typeof GrooveProfileDefSchema>;

/**
 * CNC Library - shared patterns and profiles
 */
export const CncLibrarySchema = z.object({
  hole_patterns: z.array(HolePatternDefSchema).optional(),
  routing_profiles: z.array(RoutingProfileDefSchema).optional(),
  groove_profiles: z.array(GrooveProfileDefSchema).optional(),
});

export type CncLibrary = z.infer<typeof CncLibrarySchema>;

// ============================================================
// EDGE BANDING OPERATIONS
// ============================================================

/**
 * Single edge edgeband configuration
 */
export const EdgebandEdgeSchema = z.object({
  /** Whether to apply edgeband to this edge */
  apply: z.boolean(),
  /** Link to EdgebandDef */
  edgeband_id: z.string().optional(),
  /** Override thickness if needed */
  thickness_mm: z.number().positive().optional(),
  /** Additional remarks */
  remarks: z.string().optional(),
});

export type EdgebandEdge = z.infer<typeof EdgebandEdgeSchema>;

/**
 * Edge banding configuration for all edges
 */
export const EdgeEdgingOpsSchema = z.object({
  /** Edge configurations - partial record since not all edges need banding */
  edges: z.record(z.string(), EdgebandEdgeSchema).optional(),
  /** Optional summary */
  summary: z.object({
    total_length_mm: z.number().optional(),
    notes: z.string().optional(),
  }).optional(),
});

export type EdgeEdgingOps = z.infer<typeof EdgeEdgingOpsSchema>;

// ============================================================
// GROOVE OPERATIONS
// ============================================================

/**
 * Groove/dado operation
 */
export const GrooveOpSchema = z.object({
  /** Optional ID for reference */
  groove_id: z.string().optional(),
  /** Link to GrooveProfileDef */
  profile_id: z.string().optional(),
  /** Reference edge for positioning */
  side: EdgeIdSchema,
  /** Distance from side along perpendicular direction */
  offset_mm: z.number().nonnegative(),
  /** If omitted, assume "full span" along reference */
  length_mm: z.number().positive().optional(),
  /** Override profile depth */
  depth_mm: z.number().positive().optional(),
  /** Override profile width */
  width_mm: z.number().positive().optional(),
  /** Whether groove is stopped (vs through) */
  stopped: z.boolean().optional(),
  /** If stopped, distance from start corner */
  start_offset_mm: z.number().nonnegative().optional(),
  /** If stopped, distance from end corner */
  end_offset_mm: z.number().nonnegative().optional(),
  /** Which face the groove is cut from */
  face: FaceSchema.optional(),
  /** Additional notes */
  notes: z.string().optional(),
});

export type GrooveOp = z.infer<typeof GrooveOpSchema>;

// ============================================================
// HOLE OPERATIONS
// ============================================================

/**
 * Hole operation - either pattern reference or inline holes
 */
export const HoleOpSchema = z.object({
  /** Link to HolePatternDef */
  pattern_id: z.string().optional(),
  /** Inline hole definitions (if no pattern_id) */
  holes: z.array(z.object({
    x: z.number(),
    y: z.number(),
    dia_mm: z.number().positive(),
    depth_mm: z.number().positive().optional(),
  })).optional(),
  /** Which face/edge for holes */
  face: HoleFaceSchema.optional(),
  /** Additional notes */
  notes: z.string().optional(),
});

export type HoleOp = z.infer<typeof HoleOpSchema>;

// ============================================================
// ROUTING OPERATIONS
// ============================================================

/**
 * Routing/pocket operation
 */
export const RoutingOpSchema = z.object({
  /** Link to RoutingProfileDef */
  profile_id: z.string().optional(),
  /** Bounding rectangle of pocket or route path */
  region: z.object({
    x: z.number(),
    y: z.number(),
    L: z.number().positive(),
    W: z.number().positive(),
  }),
  /** Cut depth */
  depth_mm: z.number().positive().optional(),
  /** Through cut flag */
  through: z.boolean().optional(),
  /** Additional notes */
  notes: z.string().optional(),
});

export type RoutingOp = z.infer<typeof RoutingOpSchema>;

// ============================================================
// CUSTOM CNC OPERATIONS
// ============================================================

/**
 * Custom CNC operation - for extensibility and imports
 */
export const CustomCncOpSchema = z.object({
  /** Operation type identifier */
  op_type: z.string().min(1),
  /** JSON payload with operation details */
  payload: z.unknown(),
  /** Additional notes */
  notes: z.string().optional(),
});

export type CustomCncOp = z.infer<typeof CustomCncOpSchema>;

// ============================================================
// COMBINED PART OPERATIONS
// ============================================================

/**
 * All operations for a part
 */
export const PartOpsSchema = z.object({
  /** Edge banding configuration */
  edging: EdgeEdgingOpsSchema.optional(),
  /** Groove operations */
  grooves: z.array(GrooveOpSchema).optional(),
  /** Hole operations */
  holes: z.array(HoleOpSchema).optional(),
  /** Routing operations */
  routing: z.array(RoutingOpSchema).optional(),
  /** Custom CNC operations */
  custom_cnc_ops: z.array(CustomCncOpSchema).optional(),
});

export type PartOps = z.infer<typeof PartOpsSchema>;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a simple edgeband configuration
 */
export function createEdging(
  edges: Partial<Record<"L1" | "L2" | "W1" | "W2", boolean | string>>,
  defaultEdgebandId?: string
): EdgeEdgingOps {
  const edgeConfig: Record<string, EdgebandEdge> = {};
  
  for (const [edge, value] of Object.entries(edges)) {
    if (typeof value === "boolean") {
      edgeConfig[edge] = { apply: value, edgeband_id: value ? defaultEdgebandId : undefined };
    } else if (typeof value === "string") {
      edgeConfig[edge] = { apply: true, edgeband_id: value };
    }
  }
  
  return { edges: edgeConfig };
}

/**
 * Create a back panel groove operation
 */
export function createBackGroove(
  offset_mm: number = 10,
  width_mm: number = 4,
  depth_mm: number = 10
): GrooveOp {
  return {
    groove_id: "back-groove",
    side: "W2",
    offset_mm,
    width_mm,
    depth_mm,
    face: "back",
    notes: "Back panel groove",
  };
}

/**
 * Check if a part has any operations defined
 */
export function hasOperations(ops: PartOps | undefined): boolean {
  if (!ops) return false;
  return !!(
    ops.edging?.edges ||
    (ops.grooves && ops.grooves.length > 0) ||
    (ops.holes && ops.holes.length > 0) ||
    (ops.routing && ops.routing.length > 0) ||
    (ops.custom_cnc_ops && ops.custom_cnc_ops.length > 0)
  );
}

/**
 * Get edging summary string (e.g., "L1, L2, W1")
 */
export function getEdgingSummary(edging: EdgeEdgingOps | undefined): string {
  if (!edging?.edges) return "None";
  const applied = Object.entries(edging.edges)
    .filter(([, config]) => config?.apply)
    .map(([edge]) => edge);
  return applied.length > 0 ? applied.join(", ") : "None";
}

