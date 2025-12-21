/**
 * CAI Intake - Learning System Types
 */

import type { CutPart } from "@/lib/schema";

// ============================================================
// PATTERN TYPES
// ============================================================

export type PatternType = 
  | "dimension_format"
  | "edge_notation"
  | "groove_notation"
  | "column_order"
  | "quantity_format"
  | "material_alias";

export interface ParserPattern {
  id: string;
  organizationId: string | null;
  patternType: PatternType;
  inputPattern: string;
  outputMapping: Record<string, unknown>;
  description?: string;
  confidence: number;
  usageCount: number;
  successCount: number;
  lastUsedAt?: Date;
}

export interface EdgeNotationMapping {
  edges?: string[];  // ["L1", "L2"]
  groove?: string;   // "W2"
}

export interface DimensionFormatMapping {
  order: "LxW" | "WxL" | "LxWxT";
  separator: string;
}

export interface QuantityFormatMapping {
  prefix?: string;  // "x" for "x5"
  suffix?: string;  // "pcs" for "5 pcs"
}

// ============================================================
// MATERIAL MAPPING TYPES
// ============================================================

export interface MaterialMapping {
  id: string;
  organizationId: string | null;
  rawName: string;
  normalizedName: string;
  materialId: string;
  thicknessMm?: number;
  confidence: number;
  usageCount: number;
  lastUsedAt?: Date;
}

// ============================================================
// CLIENT TEMPLATE TYPES
// ============================================================

export interface ClientTemplate {
  id: string;
  organizationId: string | null;
  clientName: string;
  clientAliases: string[];
  columnOrder: string[];
  edgeNotation?: Record<string, string[]>;  // { "X": ["L1"], "XX": ["W1", "W2"] }
  grooveNotation?: Record<string, string>;  // { "x": "W2" }
  defaultMaterialId?: string;
  defaultThicknessMm?: number;
  headerPatterns: string[];
  sampleRows?: Record<string, unknown>[];
  notes?: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  lastUsedAt?: Date;
}

// ============================================================
// CORRECTION TYPES
// ============================================================

export type CorrectionType =
  | "dimension"
  | "quantity"
  | "material"
  | "label"
  | "edge_banding"
  | "groove"
  | "cnc"
  | "rotation"
  | "grain"
  | "complete_reject";

export interface ParseCorrection {
  id?: string;
  organizationId?: string;
  userId?: string;
  parseJobId?: string;
  cutlistId?: string;
  correctionType: CorrectionType;
  fieldPath?: string;
  originalValue?: unknown;
  correctedValue?: unknown;
  originalPart?: Partial<CutPart>;
  correctedPart?: Partial<CutPart>;
  sourceText?: string;
  sourceLineNumber?: number;
  sourceFileName?: string;
  patternExtracted?: boolean;
  patternId?: string;
  createdAt?: Date;
}

// ============================================================
// LEARNING CONTEXT
// ============================================================

export interface LearningContext {
  /** Material name to ID mappings */
  materialMappings: Map<string, MaterialMapping>;
  
  /** Parser patterns by type */
  parserPatterns: Map<PatternType, ParserPattern[]>;
  
  /** Detected client template (if any) */
  clientTemplate?: ClientTemplate;
  
  /** Organization ID for this context */
  organizationId?: string;
  
  /** Whether learning is enabled */
  enabled: boolean;
}

// ============================================================
// OCR JOB TYPES
// ============================================================

export type OcrProvider = "openai" | "anthropic";
export type OcrStatus = "queued" | "uploading" | "processing" | "parsing" | "complete" | "error";

export interface OcrJob {
  id: string;
  organizationId?: string;
  userId?: string;
  fileId?: string;
  cutlistId?: string;
  filename: string;
  fileType?: string;
  fileSizeBytes?: number;
  storagePath?: string;
  provider: OcrProvider;
  status: OcrStatus;
  totalPages: number;
  currentPage: number;
  pagesProcessed: number;
  progressPercent: number;
  stage?: string;
  extractedText?: string;
  detectedFormat?: string;
  partsCount: number;
  confidence?: number;
  clientTemplateId?: string;
  learningApplied: boolean;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  errorMessage?: string;
  retryCount: number;
}

export interface OcrPageResult {
  id: string;
  ocrJobId: string;
  pageNumber: number;
  extractedText?: string;
  confidence?: number;
  partsCount: number;
  partsData?: CutPart[];
  processingTimeMs?: number;
}

// ============================================================
// ANALYSIS RESULTS
// ============================================================

export interface CorrectionAnalysis {
  /** What type of correction was made */
  correctionType: CorrectionType;
  
  /** Whether a pattern was detected */
  patternDetected: boolean;
  
  /** Extracted pattern if detected */
  extractedPattern?: {
    type: PatternType;
    inputPattern: string;
    outputMapping: Record<string, unknown>;
  };
  
  /** Extracted material mapping if detected */
  extractedMaterialMapping?: {
    rawName: string;
    materialId: string;
    thicknessMm?: number;
  };
  
  /** Confidence in the analysis */
  confidence: number;
  
  /** Whether this should be auto-learned */
  autoLearn: boolean;
}



