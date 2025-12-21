/**
 * CAI Intake - Primitive Types and Enums
 * 
 * Base building blocks for the canonical cutlist schema.
 * These primitives are used throughout the schema.
 */

import { z } from "zod";

// ============================================================
// DIMENSION PRIMITIVES
// ============================================================

/**
 * Length/Width dimension pair (in millimetres)
 * - L = Length (grain axis if grained material)
 * - W = Width (across grain)
 */
export const DimLWSchema = z.object({
  L: z.number().positive("Length must be positive"),
  W: z.number().positive("Width must be positive"),
});
export type DimLW = z.infer<typeof DimLWSchema>;

// ============================================================
// ENUMS
// ============================================================

/**
 * Edge identifiers using L1/L2 and W1/W2 convention
 * - L1 = "origin length edge" (e.g., bottom length)
 * - L2 = opposite length edge
 * - W1 = origin width edge
 * - W2 = opposite width edge
 */
export const EdgeIdSchema = z.enum(["L1", "L2", "W1", "W2"]);
export type EdgeId = z.infer<typeof EdgeIdSchema>;

/**
 * Grain orientation mode
 * - "none" = no grain (can rotate freely)
 * - "along_L" = grain runs along L dimension
 */
export const GrainModeSchema = z.enum(["none", "along_L"]);
export type GrainMode = z.infer<typeof GrainModeSchema>;

/**
 * Part family/category for grouping similar parts
 */
export const PartFamilySchema = z.enum([
  "panel",
  "door",
  "drawer_box",
  "face_frame",
  "filler",
  "misc",
]);
export type PartFamily = z.infer<typeof PartFamilySchema>;

/**
 * Core material types
 */
export const CoreTypeSchema = z.enum(["PB", "MDF", "PLY", "HDF", "OTHER"]);
export type CoreType = z.infer<typeof CoreTypeSchema>;

/**
 * Ingestion method - how the data was captured
 */
export const IngestionMethodSchema = z.enum([
  "manual",
  "paste_parser",
  "excel_table",
  "file_upload",
  "ocr_template",
  "ocr_generic",
  "voice",
  "api",
]);
export type IngestionMethod = z.infer<typeof IngestionMethodSchema>;

/**
 * Client type for API calls
 */
export const ClientTypeSchema = z.enum(["web", "api", "mobile"]);
export type ClientType = z.infer<typeof ClientTypeSchema>;

/**
 * Face reference for operations (which side of the panel)
 */
export const FaceSchema = z.enum(["front", "back"]);
export type Face = z.infer<typeof FaceSchema>;

/**
 * Edge face for hole operations
 */
export const HoleFaceSchema = z.enum(["front", "back", "edge"]);
export type HoleFace = z.infer<typeof HoleFaceSchema>;

/**
 * Units of measurement
 */
export const UnitsSchema = z.enum(["mm", "cm", "inch"]);
export type Units = z.infer<typeof UnitsSchema>;

/**
 * Parse mode for ingestion
 */
export const ParseModeSchema = z.enum([
  "auto",
  "strict_canonical",
  "loose",
  "template_first",
]);
export type ParseMode = z.infer<typeof ParseModeSchema>;

/**
 * Dimension order hint
 */
export const DimOrderHintSchema = z.enum(["LxW", "WxL", "infer"]);
export type DimOrderHint = z.infer<typeof DimOrderHintSchema>;

/**
 * Text format hint
 */
export const TextFormatSchema = z.enum(["lines", "table", "paragraph"]);
export type TextFormat = z.infer<typeof TextFormatSchema>;

/**
 * Text origin for audit trail
 */
export const TextOriginSchema = z.enum([
  "manual_field",
  "copy_paste",
  "voice_transcript",
  "api",
]);
export type TextOrigin = z.infer<typeof TextOriginSchema>;

/**
 * Table origin for audit trail
 */
export const TableOriginSchema = z.enum(["excel_paste", "manual_table", "api"]);
export type TableOrigin = z.infer<typeof TableOriginSchema>;

/**
 * File mode for parsing
 */
export const FileModeSchema = z.enum([
  "auto",
  "spreadsheet",
  "csv",
  "pdf",
  "image",
  "template",
]);
export type FileMode = z.infer<typeof FileModeSchema>;

/**
 * Voice grammar profiles
 */
export const VoiceGrammarSchema = z.enum(["simple_parts", "canonical_script"]);
export type VoiceGrammar = z.infer<typeof VoiceGrammarSchema>;

/**
 * Export format types
 */
export const ExportFormatSchema = z.enum([
  "json:cai_cutlist_v1",
  "csv:generic",
  "csv:maxcut",
  "csv:cutlist_plus",
  "xlsx",
]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * Job status for async operations
 */
export const JobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;



