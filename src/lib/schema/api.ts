/**
 * CAI Intake - API Schema Definitions
 * 
 * Schemas for API requests and responses.
 * These define the versioned API contract.
 */

import { z } from "zod";
import {
  IngestionMethodSchema,
  ParseModeSchema,
  UnitsSchema,
  DimOrderHintSchema,
  TextFormatSchema,
  TextOriginSchema,
  TableOriginSchema,
  FileModeSchema,
  VoiceGrammarSchema,
  ExportFormatSchema,
  JobStatusSchema,
} from "./primitives";
import { CutlistDocumentSchema, CutlistCapabilitiesSchema } from "./cutlist";
import { CutPartSchema } from "./part";

// ============================================================
// PARSE JOB REQUEST
// ============================================================

/**
 * Text source - manual text or copy-paste
 */
export const TextSourceSchema = z.object({
  kind: z.literal("text"),
  text: z.string().min(1, "Text is required"),
  text_format: TextFormatSchema.optional(),
  language: z.string().optional(),
  origin: TextOriginSchema.optional(),
});

export type TextSource = z.infer<typeof TextSourceSchema>;

/**
 * Table source - pasted grid from Excel/Sheets
 */
export const TableSourceSchema = z.object({
  kind: z.literal("table"),
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())),
  origin: TableOriginSchema.optional(),
});

export type TableSource = z.infer<typeof TableSourceSchema>;

/**
 * File source - uploaded file
 */
export const FileSourceSchema = z.object({
  kind: z.literal("file"),
  file_id: z.string().min(1, "File ID is required"),
  mime_type: z.string().optional(),
  original_name: z.string().optional(),
  mode: FileModeSchema.optional(),
  template_id_hint: z.string().optional(),
});

export type FileSource = z.infer<typeof FileSourceSchema>;

/**
 * Voice source - audio or transcript
 */
export const VoiceSourceSchema = z.object({
  kind: z.literal("voice"),
  transcript: z.string().optional(),
  audio_file_id: z.string().optional(),
  language: z.string().optional(),
  grammar: VoiceGrammarSchema.optional(),
  session_id: z.string().optional(),
});

export type VoiceSource = z.infer<typeof VoiceSourceSchema>;

/**
 * Union of all parse sources
 */
export const ParseSourceSchema = z.discriminatedUnion("kind", [
  TextSourceSchema,
  TableSourceSchema,
  FileSourceSchema,
  VoiceSourceSchema,
]);

export type ParseSource = z.infer<typeof ParseSourceSchema>;

/**
 * Parse options
 */
export const ParseOptionsSchema = z.object({
  mode: ParseModeSchema.optional(),
  units: UnitsSchema.optional(),
  default_thickness_mm: z.number().positive().optional(),
  default_material_id: z.string().optional(),
  dim_order_hint: DimOrderHintSchema.optional(),
  ignore_ops: z.boolean().optional(),
  max_parts: z.number().int().positive().optional(),
  min_confidence_for_auto: z.number().min(0).max(1).optional(),
});

export type ParseOptions = z.infer<typeof ParseOptionsSchema>;

/**
 * Column reference - index or header name
 */
export const ColumnRefSchema = z.union([z.number(), z.string()]);
export type ColumnRef = z.infer<typeof ColumnRefSchema>;

/**
 * Column mapping configuration
 */
export const ColumnMappingConfigSchema = z.object({
  header_row_index: z.number().int().optional(),
  data_row_start_index: z.number().int().optional(),
  data_row_end_index: z.number().int().optional(),
  columns: z.object({
    qty: ColumnRefSchema.optional(),
    label: ColumnRefSchema.optional(),
    L: ColumnRefSchema.optional(),
    W: ColumnRefSchema.optional(),
    thickness_mm: ColumnRefSchema.optional(),
    material: ColumnRefSchema.optional(),
    grain: ColumnRefSchema.optional(),
    group_id: ColumnRefSchema.optional(),
    notes: ColumnRefSchema.optional(),
    edging_L1: ColumnRefSchema.optional(),
    edging_L2: ColumnRefSchema.optional(),
    edging_W1: ColumnRefSchema.optional(),
    edging_W2: ColumnRefSchema.optional(),
  }),
});

export type ColumnMappingConfig = z.infer<typeof ColumnMappingConfigSchema>;

/**
 * Parse job create request
 */
export const ParseJobCreateRequestSchema = z.object({
  org_id: z.string().min(1, "Organization ID is required"),
  target_schema: z.literal("cai-cutlist/v1"),
  source: ParseSourceSchema,
  capabilities_hint: CutlistCapabilitiesSchema.optional(),
  options: ParseOptionsSchema.optional(),
  mapping: ColumnMappingConfigSchema.optional(),
  webhook_url: z.string().url().optional(),
});

export type ParseJobCreateRequest = z.infer<typeof ParseJobCreateRequestSchema>;

// ============================================================
// PARSE JOB RESPONSE
// ============================================================

/**
 * Parsed part preview (before commit)
 */
export const ParsedPartPreviewSchema = CutPartSchema.extend({
  /** SVG preview of the part */
  preview_svg: z.string().optional(),
  /** Suggested fixes for issues */
  suggested_fixes: z.array(z.object({
    field: z.string(),
    current: z.unknown(),
    suggested: z.unknown(),
    reason: z.string(),
  })).optional(),
});

export type ParsedPartPreview = z.infer<typeof ParsedPartPreviewSchema>;

/**
 * Parse job summary
 */
export const ParseJobSummarySchema = z.object({
  parsed_parts: z.number().int().nonnegative(),
  confidence_avg: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export type ParseJobSummary = z.infer<typeof ParseJobSummarySchema>;

/**
 * Parse job response
 */
export const ParseJobResponseSchema = z.object({
  parse_job_id: z.string(),
  status: JobStatusSchema,
  cutlist_id: z.string().optional(),
  summary: ParseJobSummarySchema.optional(),
  parts_preview: z.array(ParsedPartPreviewSchema).optional(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
});

export type ParseJobResponse = z.infer<typeof ParseJobResponseSchema>;

// ============================================================
// CUTLIST API
// ============================================================

/**
 * Create cutlist request
 */
export const CreateCutlistRequestSchema = CutlistDocumentSchema.omit({
  created_at: true,
  updated_at: true,
});

export type CreateCutlistRequest = z.infer<typeof CreateCutlistRequestSchema>;

/**
 * Cutlist response
 */
export const CutlistResponseSchema = z.object({
  cutlist_id: z.string(),
  schema_version: z.literal("cai-cutlist/v1"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export type CutlistResponse = z.infer<typeof CutlistResponseSchema>;

// ============================================================
// FILE UPLOAD API
// ============================================================

/**
 * File upload response
 */
export const FileUploadResponseSchema = z.object({
  file_id: z.string(),
  org_id: z.string(),
  mime_type: z.string(),
  original_name: z.string(),
  size_bytes: z.number().int().positive(),
  created_at: z.string().datetime(),
});

export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;

// ============================================================
// EXPORT API
// ============================================================

/**
 * Export request
 */
export const ExportRequestSchema = z.object({
  cutlist_id: z.string().min(1, "Cutlist ID is required"),
  format: ExportFormatSchema,
  options: z.object({
    include_ops: z.boolean().optional(),
    delimiter: z.string().optional(),
    include_headers: z.boolean().optional(),
  }).optional(),
});

export type ExportRequest = z.infer<typeof ExportRequestSchema>;

/**
 * Export response
 */
export const ExportResponseSchema = z.object({
  export_id: z.string(),
  status: JobStatusSchema,
  download_url: z.string().url().optional(),
  expires_at: z.string().datetime().optional(),
});

export type ExportResponse = z.infer<typeof ExportResponseSchema>;

// ============================================================
// OPTIMIZE JOB API
// ============================================================

/**
 * Optimize job request
 */
export const OptimizeJobRequestSchema = z.object({
  cutlist_id: z.string().min(1, "Cutlist ID is required"),
  engine: z.string().default("cai2d_guillotine"),
  engine_version: z.string().optional(),
  options: z.object({
    target: z.enum(["min_sheets", "min_waste"]).optional(),
    max_runtime_ms: z.number().int().positive().optional(),
    workflow: z.string().optional(),
  }).optional(),
  webhook_url: z.string().url().optional(),
});

export type OptimizeJobRequest = z.infer<typeof OptimizeJobRequestSchema>;

/**
 * Optimize job metrics
 */
export const OptimizeMetricsSchema = z.object({
  sheets_used: z.number().int().nonnegative(),
  utilization_percent: z.number().min(0).max(100),
  runtime_ms: z.number().int().nonnegative(),
});

export type OptimizeMetrics = z.infer<typeof OptimizeMetricsSchema>;

/**
 * Optimize job response
 */
export const OptimizeJobResponseSchema = z.object({
  optimize_job_id: z.string(),
  status: JobStatusSchema,
  engine: z.string(),
  engine_version: z.string().optional(),
  cutlist_id: z.string(),
  metrics: OptimizeMetricsSchema.optional(),
  result: z.object({
    cutplan: z.unknown().optional(),
    placements: z.array(z.unknown()).optional(),
  }).optional(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
});

export type OptimizeJobResponse = z.infer<typeof OptimizeJobResponseSchema>;




