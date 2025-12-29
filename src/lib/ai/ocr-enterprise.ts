/**
 * CAI Intake - Enterprise OCR Module Index
 * 
 * Exports all enterprise-grade OCR utilities for easy import.
 * 
 * Usage:
 * ```typescript
 * import {
 *   withRetry,
 *   validateAIResponse,
 *   createEnterpriseOCR,
 *   calculateQualityMetrics,
 * } from "@/lib/ai/ocr-enterprise";
 * ```
 */

// Retry, rate limiting, truncation detection
export {
  withRetry,
  sleep,
  classifyError,
  isRetryableError,
  detectTruncation,
  recoverFromTruncation,
  rateLimiters,
  RateLimiter,
  calculateQualityMetrics,
  PART_COUNT_ESTIMATION_PROMPT,
  parsePartCountEstimate,
  type RetryOptions,
  type TruncationResult,
  type RateLimitConfig,
  type ErrorCategory,
  type QualityMetrics,
  type PartCountEstimate,
} from "./ocr-utils";

// Response validation and review flagging
export {
  EdgeBandingSchema,
  GroovingSchema,
  CNCOperationsSchema,
  FieldConfidenceSchema,
  AIPartSchema,
  AIResponseSchema,
  validateAIResponse,
  generateReviewFlags,
  needsReview,
  type ValidationResult,
  type ReviewSeverity,
  type ReviewFlag,
} from "./ocr-validation";

// Audit logging
export {
  logOCRAudit,
  getRecentAuditEntries,
  getAuditByRequestId,
  calculateAccuracyMetrics,
  createAuditBuilder,
  OCRAuditBuilder,
  type OCRAuditEntry,
  type AccuracyMetrics,
} from "./ocr-audit";

// Smart chunking for large documents
export {
  shouldChunkDocument,
  calculateChunkBoundaries,
  mergeChunkResults,
  extractWithAdaptiveChunking,
  extractBySections,
  generateChunkPrompt,
  generateSectionPrompt,
  CHUNKING_CONFIG,
  type ChunkingDecision,
  type ChunkResult,
  type MergedResult,
  type AdaptiveChunkingResult,
  type SectionExtractionResult,
} from "./ocr-chunking";

// Enterprise OCR service
export {
  EnterpriseOCRService,
  createEnterpriseOCR,
  type EnterpriseOCRResult,
  type EnterpriseOCROptions,
} from "./enterprise-ocr";

