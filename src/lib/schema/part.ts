/**
 * CAI Intake - Cut Part Schema
 * 
 * The canonical CutPart - the star of the show.
 * This is the central data structure that all parsers output.
 */

import { z } from "zod";
import {
  DimLW,
  DimLWSchema,
  GrainModeSchema,
  PartFamilySchema,
  IngestionMethodSchema,
} from "./primitives";
import { PartOpsSchema } from "./operations";

// ============================================================
// PART NOTES
// ============================================================

/**
 * Notes attached to a part for different purposes
 */
export const PartNotesSchema = z.object({
  /** Note for saw/panel saw operator */
  operator: z.string().optional(),
  /** Note for CNC operator */
  cnc: z.string().optional(),
  /** Design/engineering note */
  design: z.string().optional(),
});

export type PartNotes = z.infer<typeof PartNotesSchema>;

// ============================================================
// PART AUDIT
// ============================================================

/**
 * Material match result for smart matching
 */
export const MaterialMatchResultSchema = z.object({
  /** Material name that was matched to */
  matched_to: z.string(),
  /** Match confidence (0-1) */
  confidence: z.number().min(0).max(1),
  /** How the match was made */
  match_type: z.enum(["exact", "fuzzy", "keyword", "default"]),
  /** Original raw material name from parsed input */
  original_raw: z.string().optional(),
});

/**
 * Edgeband match result for smart matching
 */
export const EdgebandMatchResultSchema = z.object({
  /** Edgeband name that was matched to */
  matched_to: z.string(),
  /** Match confidence (0-1) */
  confidence: z.number().min(0).max(1),
  /** How the match was made */
  match_type: z.enum(["exact", "material_match", "default"]),
});

/**
 * Audit/ingestion metadata for a part
 * Tracks how the part was created and its confidence level
 */
export const PartAuditSchema = z.object({
  /** How the part was ingested */
  source_method: IngestionMethodSchema,
  /** Reference to source (file ID, voice session, etc.) */
  source_ref: z.string().optional(),
  /** Original text snippet that was parsed */
  parsed_text_snippet: z.string().optional(),
  /** Parse confidence score (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** Non-fatal warnings during parsing */
  warnings: z.array(z.string()).optional(),
  /** Fatal errors that need resolution */
  errors: z.array(z.string()).optional(),
  /** Whether a human has verified this part */
  human_verified: z.boolean().optional(),
  /** Material matching result (from smart matching) */
  material_match: MaterialMatchResultSchema.optional(),
  /** Edgeband matching results by edge (from smart matching) */
  edgeband_matches: z.record(z.string(), EdgebandMatchResultSchema).optional(),
});

export type PartAudit = z.infer<typeof PartAuditSchema>;

// ============================================================
// CORE PART SCHEMA (Minimal Required Fields)
// ============================================================

/**
 * Core part schema - the minimum viable part
 * Used for simple shops that only need basic dimensions
 */
export const CorePartSchema = z.object({
  /** Unique identifier within the document */
  part_id: z.string().min(1, "Part ID is required"),
  /** Quantity of this part */
  qty: z.number().int().positive("Quantity must be a positive integer"),
  /** Finished size (L x W) in mm */
  size: DimLWSchema,
  /** Finished thickness in mm */
  thickness_mm: z.number().positive("Thickness must be positive"),
  /** Reference to material definition */
  material_id: z.string().min(1, "Material ID is required"),
  /** 
   * Grain orientation - DEPRECATED: Use allow_rotation instead
   * Grain is now a material property. For backwards compatibility, defaults to "none".
   */
  grain: GrainModeSchema.optional().default("none"),
});

export type CorePart = z.infer<typeof CorePartSchema>;

// ============================================================
// FULL CUT PART SCHEMA
// ============================================================

/**
 * The canonical CutPart - complete part definition
 * Extends CorePart with optional advanced fields
 */
export const CutPartSchema = CorePartSchema.extend({
  // Identity & Labeling
  /** Human-readable label (e.g., "Left side panel") */
  label: z.string().optional(),
  /** Part category/family */
  family: PartFamilySchema.optional(),
  
  // Layout Constraints
  /** Whether rotation is allowed (should be false if grained) */
  allow_rotation: z.boolean().optional(),
  
  // Grouping & Organization
  /** Group/cabinet ID for organizing parts */
  group_id: z.string().optional(),
  /** Sub-group (e.g., "front", "back", "drawer") */
  sub_group: z.string().optional(),
  /** Priority (lower = more important) */
  priority: z.number().int().optional(),
  /** Free-form tags */
  tags: z.array(z.string()).optional(),
  
  // Processing Operations
  /** CNC and edge operations */
  ops: PartOpsSchema.optional(),
  
  // Notes
  /** Notes for different purposes */
  notes: PartNotesSchema.optional(),
  
  // Audit Trail
  /** Ingestion metadata */
  audit: PartAuditSchema.optional(),
});

export type CutPart = z.infer<typeof CutPartSchema>;

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate part geometry constraints
 */
export function validatePartGeometry(part: CutPart): string[] {
  const errors: string[] = [];
  
  // Check grain vs rotation
  if (part.grain === "along_L" && part.allow_rotation === true) {
    errors.push("Grained parts should not allow rotation");
  }
  
  // Check reasonable dimensions
  if (part.size.L > 10000) {
    errors.push("Length exceeds 10m - verify this is correct");
  }
  if (part.size.W > 5000) {
    errors.push("Width exceeds 5m - verify this is correct");
  }
  if (part.thickness_mm > 100) {
    errors.push("Thickness exceeds 100mm - verify this is correct");
  }
  
  return errors;
}

/**
 * Calculate cut size from finished size and edging
 */
export function calculateCutSize(
  finishedSize: DimLW,
  edging?: {
    L1?: number;
    L2?: number;
    W1?: number;
    W2?: number;
  }
): DimLW {
  const ebL1 = edging?.L1 ?? 0;
  const ebL2 = edging?.L2 ?? 0;
  const ebW1 = edging?.W1 ?? 0;
  const ebW2 = edging?.W2 ?? 0;
  
  return {
    L: finishedSize.L - ebL1 - ebL2,
    W: finishedSize.W - ebW1 - ebW2,
  };
}

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

/**
 * Create a minimal CutPart with required fields only
 */
export function createPart(
  id: string,
  L: number,
  W: number,
  qty: number,
  material_id: string,
  options?: Partial<Omit<CutPart, "part_id" | "size" | "qty" | "material_id">>
): CutPart {
  return {
    part_id: id,
    size: { L, W },
    qty,
    thickness_mm: options?.thickness_mm ?? 18,
    material_id,
    grain: options?.grain ?? "none",
    ...options,
  };
}

/**
 * Clone a part with a new ID and optional modifications
 */
export function clonePart(
  part: CutPart,
  newId: string,
  modifications?: Partial<CutPart>
): CutPart {
  return {
    ...part,
    part_id: newId,
    ...modifications,
    // Always update audit if cloning
    audit: {
      ...part.audit,
      source_method: modifications?.audit?.source_method ?? "manual",
      human_verified: false,
    },
  };
}

/**
 * Merge two parts (for combining duplicates)
 */
export function mergeParts(part1: CutPart, part2: CutPart): CutPart {
  if (
    part1.size.L !== part2.size.L ||
    part1.size.W !== part2.size.W ||
    part1.thickness_mm !== part2.thickness_mm ||
    part1.material_id !== part2.material_id
  ) {
    throw new Error("Cannot merge parts with different dimensions or material");
  }
  
  return {
    ...part1,
    qty: part1.qty + part2.qty,
    // Merge tags
    tags: [...new Set([...(part1.tags ?? []), ...(part2.tags ?? [])])],
    // Keep first part's notes
    notes: part1.notes ?? part2.notes,
    // Mark as manually merged
    audit: {
      source_method: "manual",
      human_verified: true,
    },
  };
}

// ============================================================
// SUMMARY FUNCTIONS
// ============================================================

/**
 * Get a summary string for a part
 */
export function getPartSummary(part: CutPart): string {
  const label = part.label || part.part_id;
  return `${label}: ${part.qty}x ${part.size.L}×${part.size.W}×${part.thickness_mm}`;
}

/**
 * Calculate total area for a part (qty × L × W)
 */
export function getPartArea(part: CutPart): number {
  return part.qty * part.size.L * part.size.W;
}

/**
 * Calculate total linear edging for a part
 */
export function getPartEdgingLength(part: CutPart): number {
  if (!part.ops?.edging?.edges) return 0;
  
  let total = 0;
  const edges = part.ops.edging.edges;
  
  if (edges.L1?.apply) total += part.size.L;
  if (edges.L2?.apply) total += part.size.L;
  if (edges.W1?.apply) total += part.size.W;
  if (edges.W2?.apply) total += part.size.W;
  
  return total * part.qty;
}

