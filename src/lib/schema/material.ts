/**
 * CAI Intake - Material Definitions Schema
 * 
 * Defines materials (boards) and edgebands used in cutlists.
 */

import { z } from "zod";
import { DimLWSchema, CoreTypeSchema } from "./primitives";

// ============================================================
// MATERIAL DEFINITIONS
// ============================================================

/**
 * Material definition - describes a board/sheet material
 */
export const MaterialDefSchema = z.object({
  /** Internal unique identifier */
  material_id: z.string().min(1),
  
  /** Human-readable name */
  name: z.string().min(1),
  
  /** Vendor SKU/product code */
  sku: z.string().optional(),
  
  /** Material thickness in mm */
  thickness_mm: z.number().positive(),
  
  /** Core material type */
  core_type: CoreTypeSchema.optional(),
  
  /** Surface finish description */
  finish: z.string().optional(),
  
  /** Color code (HEX or palette reference) */
  color_code: z.string().optional(),
  
  /** Default sheet size and grain info */
  default_sheet: z.object({
    size: DimLWSchema,
    grained: z.boolean(),
  }).optional(),
  
  /** Additional metadata */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type MaterialDef = z.infer<typeof MaterialDefSchema>;

// ============================================================
// EDGEBAND DEFINITIONS
// ============================================================

/**
 * Edgeband material definition
 */
export const EdgebandDefSchema = z.object({
  /** Internal unique identifier */
  edgeband_id: z.string().min(1),
  
  /** Human-readable name */
  name: z.string().min(1),
  
  /** Edgeband thickness in mm (e.g., 0.4, 0.8, 1, 2) */
  thickness_mm: z.number().positive(),
  
  /** Link to matching board material (for color matching) */
  color_match_material_id: z.string().optional(),
  
  /** Surface finish description */
  finish: z.string().optional(),
  
  /** Additional metadata */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type EdgebandDef = z.infer<typeof EdgebandDefSchema>;

// ============================================================
// MATERIAL COLLECTIONS
// ============================================================

/**
 * Material library - collection of materials and edgebands
 */
export const MaterialLibrarySchema = z.object({
  materials: z.array(MaterialDefSchema),
  edgebands: z.array(EdgebandDefSchema).optional(),
});

export type MaterialLibrary = z.infer<typeof MaterialLibrarySchema>;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a basic material definition
 */
export function createMaterial(
  id: string,
  name: string,
  thickness_mm: number,
  options?: Partial<MaterialDef>
): MaterialDef {
  return {
    material_id: id,
    name,
    thickness_mm,
    ...options,
  };
}

/**
 * Create a basic edgeband definition
 */
export function createEdgeband(
  id: string,
  name: string,
  thickness_mm: number,
  options?: Partial<EdgebandDef>
): EdgebandDef {
  return {
    edgeband_id: id,
    name,
    thickness_mm,
    ...options,
  };
}

/**
 * Common material presets
 */
export const MATERIAL_PRESETS = {
  WHITE_MEL_18: createMaterial("MAT-WHITE-MEL-18", "18mm White Melamine PB", 18, {
    core_type: "PB",
    finish: "White Melamine",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: false },
  }),
  WHITE_MEL_16: createMaterial("MAT-WHITE-MEL-16", "16mm White Melamine PB", 16, {
    core_type: "PB",
    finish: "White Melamine",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: false },
  }),
  MDF_18: createMaterial("MAT-MDF-18", "18mm MDF", 18, {
    core_type: "MDF",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: false },
  }),
  PLY_18: createMaterial("MAT-PLY-18", "18mm Plywood", 18, {
    core_type: "PLY",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: true },
  }),
} as const;

/**
 * Common edgeband presets
 */
export const EDGEBAND_PRESETS = {
  WHITE_0_8: createEdgeband("EB-WHITE-0.8", "0.8mm White ABS", 0.8, {
    finish: "White ABS",
  }),
  WHITE_2: createEdgeband("EB-WHITE-2", "2mm White ABS", 2, {
    finish: "White ABS",
  }),
} as const;

