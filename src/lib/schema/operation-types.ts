/**
 * CAI Intake - Operation Type Codes Schema
 * 
 * Defines shortcode types for grooves, holes, and CNC operations.
 * These are organization-defined quick entry codes.
 */

import { z } from "zod";

// ============================================================
// GROOVE TYPE
// ============================================================

/**
 * Groove type definition - organization-defined shortcode
 */
export const GrooveTypeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  /** Short code for display (e.g., 'D', 'R', 'BP') */
  code: z.string().min(1).max(20),
  /** Display name (e.g., 'Dado', 'Rabbet') */
  name: z.string().min(1).max(100),
  /** Default width in mm */
  default_width_mm: z.number().positive().optional().nullable(),
  /** Default depth in mm */
  default_depth_mm: z.number().positive().optional().nullable(),
  /** Description */
  description: z.string().optional().nullable(),
  /** Whether this type is active */
  is_active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type GrooveType = z.infer<typeof GrooveTypeSchema>;

// ============================================================
// HOLE TYPE
// ============================================================

/**
 * Hole type definition - organization-defined shortcode
 */
export const HoleTypeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  /** Short code for display (e.g., 'S32', 'HG35') */
  code: z.string().min(1).max(20),
  /** Display name (e.g., 'System 32', 'Hinge 35mm') */
  name: z.string().min(1).max(100),
  /** Default diameter in mm */
  diameter_mm: z.number().positive().optional().nullable(),
  /** Default depth in mm */
  depth_mm: z.number().positive().optional().nullable(),
  /** Default spacing in mm (for patterns like System 32) */
  spacing_mm: z.number().positive().optional().nullable(),
  /** Link to hole_patterns table */
  pattern_id: z.string().optional().nullable(),
  /** Description */
  description: z.string().optional().nullable(),
  /** Whether this type is active */
  is_active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type HoleType = z.infer<typeof HoleTypeSchema>;

// ============================================================
// CNC OPERATION TYPE
// ============================================================

/**
 * CNC operation type definition - organization-defined shortcode
 */
export const CncOperationTypeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  /** Short code for display (e.g., 'HINGE', 'PKT') */
  code: z.string().min(1).max(20),
  /** Display name (e.g., 'Hinge Bore', 'Pocket') */
  name: z.string().min(1).max(100),
  /** Operation category */
  op_type: z.enum(["pocket", "profile", "drill", "engrave", "cutout", "custom"]).optional().nullable(),
  /** Default parameters as JSON */
  default_params: z.record(z.string(), z.unknown()).optional().nullable(),
  /** Link to routing_profiles table */
  profile_id: z.string().optional().nullable(),
  /** Description */
  description: z.string().optional().nullable(),
  /** Whether this type is active */
  is_active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CncOperationType = z.infer<typeof CncOperationTypeSchema>;

// ============================================================
// SHORTCODE FORMAT TYPES
// ============================================================

/**
 * Compact shortcode format for operations
 * EB:{material_code}:{sides}   → EB:WH08:2L2W
 * GR:{type}:{depth}x{width}@{side}  → GR:D:8x4@W1
 * H:{pattern}@{face}           → H:S32@F
 * CNC:{code}                   → CNC:HINGE
 */
export interface OperationShortcode {
  type: "EB" | "GR" | "H" | "CNC";
  code: string;
  raw: string;
}

/**
 * Edgebanding shortcode specs
 */
export interface EdgebandShortcodeSpecs {
  material_code: string;
  sides: string; // e.g., "2L2W", "4S", "L1L2"
}

/**
 * Groove shortcode specs
 */
export interface GrooveShortcodeSpecs {
  type_code: string;
  depth_mm: number;
  width_mm: number;
  side: string; // e.g., "W1", "L2"
}

/**
 * Hole shortcode specs
 */
export interface HoleShortcodeSpecs {
  type_code: string;
  face: string; // e.g., "F" (front), "B" (back)
}

/**
 * CNC shortcode specs
 */
export interface CncShortcodeSpecs {
  type_code: string;
  notes?: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format an edgebanding shortcode
 * @example formatEdgebandShortcode("WH08", { L1: true, L2: true, W1: true, W2: true }) => "EB:WH08:4S"
 */
export function formatEdgebandShortcode(
  materialCode: string,
  sides: Record<string, boolean>
): string {
  const appliedSides = Object.entries(sides)
    .filter(([_, applied]) => applied)
    .map(([side]) => side);

  if (appliedSides.length === 0) return "";

  // Count L and W sides
  const lCount = appliedSides.filter(s => s.startsWith("L")).length;
  const wCount = appliedSides.filter(s => s.startsWith("W")).length;

  let sidesCode = "";
  if (lCount === 2 && wCount === 2) {
    sidesCode = "4S";
  } else if (lCount === 2 && wCount === 0) {
    sidesCode = "2L";
  } else if (lCount === 0 && wCount === 2) {
    sidesCode = "2W";
  } else {
    sidesCode = appliedSides.sort().join("");
  }

  return `EB:${materialCode}:${sidesCode}`;
}

/**
 * Format a groove shortcode
 * @example formatGrooveShortcode("D", 8, 4, "W1") => "GR:D:8x4@W1"
 */
export function formatGrooveShortcode(
  typeCode: string,
  depth_mm: number,
  width_mm: number,
  side: string
): string {
  return `GR:${typeCode}:${depth_mm}x${width_mm}@${side}`;
}

/**
 * Format a hole shortcode
 * @example formatHoleShortcode("S32", "F") => "H:S32@F"
 */
export function formatHoleShortcode(typeCode: string, face: string): string {
  return `H:${typeCode}@${face}`;
}

/**
 * Format a CNC shortcode
 * @example formatCncShortcode("HINGE") => "CNC:HINGE"
 */
export function formatCncShortcode(typeCode: string): string {
  return `CNC:${typeCode}`;
}

/**
 * Parse a shortcode string into its components
 */
export function parseShortcode(shortcode: string): OperationShortcode | null {
  const parts = shortcode.split(":");
  if (parts.length < 2) return null;

  const type = parts[0] as "EB" | "GR" | "H" | "CNC";
  const code = parts.slice(1).join(":");

  if (!["EB", "GR", "H", "CNC"].includes(type)) return null;

  return { type, code, raw: shortcode };
}

/**
 * Generate auto-notes from operation specs
 * @example generateAutoNotes(ops) => "Edging: White 0.8mm on L1,L2,W1,W2 | Groove: Dado 8x4mm on W1 | Holes: System32 on Front"
 */
export function generateAutoNotes(specs: {
  edgebanding?: { material_name: string; sides: string[] };
  grooves?: Array<{ type_name: string; width_mm: number; depth_mm: number; side: string }>;
  holes?: Array<{ type_name: string; face: string }>;
  cnc?: Array<{ type_name: string }>;
}): string {
  const parts: string[] = [];

  if (specs.edgebanding && specs.edgebanding.sides.length > 0) {
    parts.push(`Edging: ${specs.edgebanding.material_name} on ${specs.edgebanding.sides.join(",")}`);
  }

  if (specs.grooves && specs.grooves.length > 0) {
    const grooveNotes = specs.grooves.map(g =>
      `${g.type_name} ${g.width_mm}x${g.depth_mm}mm on ${g.side}`
    ).join(", ");
    parts.push(`Groove: ${grooveNotes}`);
  }

  if (specs.holes && specs.holes.length > 0) {
    const holeNotes = specs.holes.map(h =>
      `${h.type_name} on ${h.face === "F" ? "Front" : "Back"}`
    ).join(", ");
    parts.push(`Holes: ${holeNotes}`);
  }

  if (specs.cnc && specs.cnc.length > 0) {
    const cncNotes = specs.cnc.map(c => c.type_name).join(", ");
    parts.push(`CNC: ${cncNotes}`);
  }

  return parts.join(" | ");
}

/**
 * Generate auto-notes from PartOps directly
 * Extracts operation info and formats as a readable string for the notes column
 */
export function generateAutoNotesFromPartOps(ops: {
  edging?: { edges?: Record<string, { apply?: boolean; edgeband_id?: string }> };
  grooves?: Array<{ side?: string; depth_mm?: number; width_mm?: number; notes?: string }>;
  holes?: Array<{ pattern_id?: string; face?: string; notes?: string }>;
  custom_cnc_ops?: Array<{ op_type?: string; notes?: string; payload?: unknown }>;
  routing?: Array<{ profile_id?: string; notes?: string }>;
} | undefined | null): string {
  if (!ops) return "";

  const notesParts: string[] = [];

  // Edgebanding
  const edges = ops.edging?.edges;
  if (edges) {
    const appliedSides = Object.entries(edges)
      .filter(([, v]) => v?.apply)
      .map(([side]) => side);
    
    if (appliedSides.length > 0) {
      const firstEdgebandId = Object.values(edges).find(e => e?.apply)?.edgeband_id;
      const ebName = firstEdgebandId ? firstEdgebandId.substring(0, 8) : "EB";
      
      // Format sides compactly
      let sidesDesc = appliedSides.join(",");
      if (appliedSides.length === 4) sidesDesc = "all sides";
      else if (appliedSides.includes("L1") && appliedSides.includes("L2") && appliedSides.length === 2) sidesDesc = "both L";
      else if (appliedSides.includes("W1") && appliedSides.includes("W2") && appliedSides.length === 2) sidesDesc = "both W";
      
      notesParts.push(`EB: ${ebName} on ${sidesDesc}`);
    }
  }

  // Grooves
  if (ops.grooves && ops.grooves.length > 0) {
    const grooveDescs = ops.grooves.map(g => {
      const typeHint = g.notes?.replace("Type: ", "") || "groove";
      return `${typeHint} ${g.width_mm || 4}x${g.depth_mm || 8}mm@${g.side || "?"}`;
    });
    notesParts.push(`Grooves: ${grooveDescs.join(", ")}`);
  }

  // Holes
  if (ops.holes && ops.holes.length > 0) {
    const holeDescs = ops.holes.map(h => {
      const pattern = h.pattern_id || h.notes?.replace("Pattern: ", "") || "holes";
      const face = h.face === "front" ? "F" : h.face === "back" ? "B" : "?";
      return `${pattern}@${face}`;
    });
    notesParts.push(`Holes: ${holeDescs.join(", ")}`);
  }

  // CNC operations
  const cncOps = [...(ops.custom_cnc_ops || []), ...(ops.routing || [])];
  if (cncOps.length > 0) {
    const cncDescs = cncOps.map(c => {
      if ("profile_id" in c) return c.profile_id;
      if ("op_type" in c) {
        const payload = c.payload as { program_name?: string } | undefined;
        return payload?.program_name || c.op_type || "CNC";
      }
      return "CNC";
    });
    notesParts.push(`CNC: ${cncDescs.join(", ")}`);
  }

  return notesParts.join(" | ");
}

/**
 * Merge auto-generated notes with existing notes
 * Preserves any manually entered notes and appends auto-generated ones
 */
export function mergeAutoNotes(
  existingNotes: { operator?: string; cnc?: string; design?: string } | undefined,
  autoNotes: string
): { operator?: string; cnc?: string; design?: string } {
  if (!autoNotes) return existingNotes || {};
  
  const result = { ...existingNotes };
  
  // Check if auto-notes are already present to avoid duplication
  const operatorNotes = result.operator || "";
  if (!operatorNotes.includes(autoNotes)) {
    // Append auto-notes in a structured way
    if (operatorNotes) {
      // If there's existing operator notes, check if they already have auto-notes section
      if (operatorNotes.includes("[Auto:")) {
        // Replace existing auto-notes
        result.operator = operatorNotes.replace(/\[Auto:.*?\]/, `[Auto: ${autoNotes}]`);
      } else {
        // Append new auto-notes
        result.operator = `${operatorNotes} [Auto: ${autoNotes}]`;
      }
    } else {
      result.operator = `[Auto: ${autoNotes}]`;
    }
  }
  
  return result;
}

