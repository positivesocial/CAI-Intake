/**
 * CAI Intake - Cutlist Document Schema
 * 
 * The top-level document structure that contains all parts,
 * materials, and metadata for a complete cutlist.
 */

import { z } from "zod";
import { IngestionMethodSchema, ClientTypeSchema } from "./primitives";
import { MaterialDefSchema, EdgebandDefSchema } from "./material";
import { CncLibrarySchema } from "./operations";
import { CutPartSchema, getPartArea, getPartEdgingLength } from "./part";
import { SCHEMA_VERSION } from "../constants";

// ============================================================
// INGESTION SOURCE
// ============================================================

/**
 * Tracks how the cutlist document was created
 */
export const IngestionSourceSchema = z.object({
  /** How the data was ingested */
  method: IngestionMethodSchema,
  /** Client type */
  client: ClientTypeSchema.optional(),
  /** User who created this */
  user_id: z.string().optional(),
  /** Reference to source file if applicable */
  file_ref: z.string().optional(),
  /** Template ID if recognized */
  template_id: z.string().optional(),
  /** Additional notes */
  notes: z.string().optional(),
});

export type IngestionSource = z.infer<typeof IngestionSourceSchema>;

// ============================================================
// CAPABILITIES
// ============================================================

/**
 * Capabilities define what features are enabled for this cutlist
 * Used to control UI visibility and validation strictness
 */
export const CutlistCapabilitiesSchema = z.object({
  /** Core geometry & materials (always true) */
  core_parts: z.boolean().default(true),
  /** Edge banding per edge */
  edging: z.boolean().optional(),
  /** Grooves/dados */
  grooves: z.boolean().optional(),
  /** Boring patterns */
  cnc_holes: z.boolean().optional(),
  /** Pockets, profiles */
  cnc_routing: z.boolean().optional(),
  /** Arbitrary/custom ops */
  custom_cnc: z.boolean().optional(),
  /** group_id, sub_group */
  advanced_grouping: z.boolean().optional(),
  /** Operator/CNC notes */
  part_notes: z.boolean().optional(),
});

export type CutlistCapabilities = z.infer<typeof CutlistCapabilitiesSchema>;

/**
 * Default capabilities for different shop types
 */
export const CAPABILITY_PRESETS = {
  /** Basic cut shop - dimensions only */
  simple: {
    core_parts: true,
    edging: false,
    grooves: false,
    cnc_holes: false,
    cnc_routing: false,
    custom_cnc: false,
    advanced_grouping: false,
    part_notes: false,
  } satisfies CutlistCapabilities,
  
  /** Cut + edge shop */
  edge_shop: {
    core_parts: true,
    edging: true,
    grooves: false,
    cnc_holes: false,
    cnc_routing: false,
    custom_cnc: false,
    advanced_grouping: false,
    part_notes: true,
  } satisfies CutlistCapabilities,
  
  /** Full CNC shop */
  cnc_shop: {
    core_parts: true,
    edging: true,
    grooves: true,
    cnc_holes: true,
    cnc_routing: true,
    custom_cnc: true,
    advanced_grouping: true,
    part_notes: true,
  } satisfies CutlistCapabilities,
} as const;

// ============================================================
// CUTLIST DOCUMENT
// ============================================================

/**
 * The canonical Cutlist Document
 * This is what all parsers produce and what the optimizer consumes
 */
export const CutlistDocumentSchema = z.object({
  // Versioning & Identity
  /** Schema version - MUST be "cai-cutlist/v1" */
  schema_version: z.literal(SCHEMA_VERSION),
  /** Organization identifier */
  org_id: z.string().min(1, "Organization ID is required"),
  /** Document unique identifier */
  doc_id: z.string().min(1, "Document ID is required"),
  /** Optional link to a job in CAI 2D */
  job_id: z.string().optional(),
  /** Human-readable name */
  name: z.string().optional(),
  
  // Timestamps
  /** Creation timestamp (ISO 8601) */
  created_at: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updated_at: z.string().datetime(),
  
  // Source & Capabilities
  /** How this document was created */
  source: IngestionSourceSchema,
  /** Feature capabilities */
  capabilities: CutlistCapabilitiesSchema.optional(),
  /** Additional metadata */
  meta: z.record(z.string(), z.unknown()).optional(),
  
  // Material Library
  /** Material definitions used in this cutlist */
  materials: z.array(MaterialDefSchema),
  /** Edgeband definitions */
  edgebands: z.array(EdgebandDefSchema).optional(),
  /** CNC library (patterns, profiles) */
  cnc_library: CncLibrarySchema.optional(),
  
  // Parts
  /** The cut parts */
  parts: z.array(CutPartSchema),
});

export type CutlistDocument = z.infer<typeof CutlistDocumentSchema>;

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

/**
 * Create a new empty cutlist document
 */
export function createCutlistDocument(
  org_id: string,
  doc_id: string,
  options?: {
    name?: string;
    job_id?: string;
    source?: Partial<IngestionSource>;
    capabilities?: CutlistCapabilities;
    materials?: z.infer<typeof MaterialDefSchema>[];
    edgebands?: z.infer<typeof EdgebandDefSchema>[];
  }
): CutlistDocument {
  const now = new Date().toISOString();
  
  return {
    schema_version: SCHEMA_VERSION,
    org_id,
    doc_id,
    job_id: options?.job_id,
    name: options?.name,
    created_at: now,
    updated_at: now,
    source: {
      method: options?.source?.method ?? "manual",
      client: options?.source?.client ?? "web",
      ...options?.source,
    },
    capabilities: options?.capabilities ?? CAPABILITY_PRESETS.edge_shop,
    materials: options?.materials ?? [],
    edgebands: options?.edgebands,
    parts: [],
  };
}

/**
 * Add parts to a cutlist document (immutable)
 */
export function addPartsToCutlist(
  doc: CutlistDocument,
  parts: z.infer<typeof CutPartSchema>[]
): CutlistDocument {
  return {
    ...doc,
    updated_at: new Date().toISOString(),
    parts: [...doc.parts, ...parts],
  };
}

/**
 * Update a part in the cutlist (immutable)
 */
export function updatePartInCutlist(
  doc: CutlistDocument,
  partId: string,
  updates: Partial<z.infer<typeof CutPartSchema>>
): CutlistDocument {
  return {
    ...doc,
    updated_at: new Date().toISOString(),
    parts: doc.parts.map((p) =>
      p.part_id === partId ? { ...p, ...updates } : p
    ),
  };
}

/**
 * Remove a part from the cutlist (immutable)
 */
export function removePartFromCutlist(
  doc: CutlistDocument,
  partId: string
): CutlistDocument {
  return {
    ...doc,
    updated_at: new Date().toISOString(),
    parts: doc.parts.filter((p) => p.part_id !== partId),
  };
}

// ============================================================
// SUMMARY & STATISTICS
// ============================================================

/**
 * Cutlist summary statistics
 */
export interface CutlistSummary {
  total_parts: number;
  total_pieces: number;
  total_area_mm2: number;
  total_area_m2: number;
  total_edging_mm: number;
  total_edging_m: number;
  materials_used: string[];
  has_operations: boolean;
}

/**
 * Calculate summary statistics for a cutlist
 */
export function getCutlistSummary(doc: CutlistDocument): CutlistSummary {
  const totalPieces = doc.parts.reduce((sum, p) => sum + p.qty, 0);
  const totalAreaMm2 = doc.parts.reduce((sum, p) => sum + getPartArea(p), 0);
  const totalEdgingMm = doc.parts.reduce((sum, p) => sum + getPartEdgingLength(p), 0);
  const materialsUsed = [...new Set(doc.parts.map((p) => p.material_id))];
  const hasOperations = doc.parts.some((p) => p.ops);
  
  return {
    total_parts: doc.parts.length,
    total_pieces: totalPieces,
    total_area_mm2: totalAreaMm2,
    total_area_m2: totalAreaMm2 / 1_000_000,
    total_edging_mm: totalEdgingMm,
    total_edging_m: totalEdgingMm / 1000,
    materials_used: materialsUsed,
    has_operations: hasOperations,
  };
}

/**
 * Group parts by material
 */
export function groupPartsByMaterial(
  doc: CutlistDocument
): Record<string, z.infer<typeof CutPartSchema>[]> {
  const groups: Record<string, z.infer<typeof CutPartSchema>[]> = {};
  
  for (const part of doc.parts) {
    if (!groups[part.material_id]) {
      groups[part.material_id] = [];
    }
    groups[part.material_id].push(part);
  }
  
  return groups;
}

/**
 * Group parts by group_id
 */
export function groupPartsByGroup(
  doc: CutlistDocument
): Record<string, z.infer<typeof CutPartSchema>[]> {
  const groups: Record<string, z.infer<typeof CutPartSchema>[]> = {};
  
  for (const part of doc.parts) {
    const groupId = part.group_id ?? "ungrouped";
    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(part);
  }
  
  return groups;
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate a cutlist document
 */
export function validateCutlist(doc: CutlistDocument): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check schema version
  if (doc.schema_version !== SCHEMA_VERSION) {
    errors.push(`Invalid schema version: ${doc.schema_version}`);
  }
  
  // Check parts have valid material references
  const materialIds = new Set(doc.materials.map((m) => m.material_id));
  for (const part of doc.parts) {
    if (!materialIds.has(part.material_id)) {
      errors.push(`Part ${part.part_id} references unknown material: ${part.material_id}`);
    }
  }
  
  // Check for duplicate part IDs
  const partIds = new Set<string>();
  for (const part of doc.parts) {
    if (partIds.has(part.part_id)) {
      errors.push(`Duplicate part ID: ${part.part_id}`);
    }
    partIds.add(part.part_id);
  }
  
  // Check edgeband references if edging is used
  if (doc.edgebands) {
    const edgebandIds = new Set(doc.edgebands.map((e) => e.edgeband_id));
    for (const part of doc.parts) {
      if (part.ops?.edging?.edges) {
        for (const [edge, config] of Object.entries(part.ops.edging.edges)) {
          if (config?.edgeband_id && !edgebandIds.has(config.edgeband_id)) {
            warnings.push(`Part ${part.part_id} edge ${edge} references unknown edgeband: ${config.edgeband_id}`);
          }
        }
      }
    }
  }
  
  // Capability warnings
  const caps = doc.capabilities ?? CAPABILITY_PRESETS.simple;
  for (const part of doc.parts) {
    if (!caps.edging && part.ops?.edging) {
      warnings.push(`Part ${part.part_id} has edging but capability is disabled`);
    }
    if (!caps.grooves && part.ops?.grooves?.length) {
      warnings.push(`Part ${part.part_id} has grooves but capability is disabled`);
    }
    if (!caps.cnc_holes && part.ops?.holes?.length) {
      warnings.push(`Part ${part.part_id} has holes but capability is disabled`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

