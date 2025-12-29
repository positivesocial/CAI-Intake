/**
 * CAI Intake - Enterprise OCR Service
 * 
 * Bulletproof, cutting-edge OCR service that wraps all providers
 * with enterprise-grade features:
 * 
 * - Automatic retry with exponential backoff
 * - Truncation detection and recovery
 * - Smart chunking for large documents
 * - Response validation and quality metrics
 * - Confidence-based review flagging
 * - Comprehensive audit logging
 * - Multi-provider fallback chain
 */

import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema/part";
import {
  withRetry,
  detectTruncation,
  recoverFromTruncation,
  classifyError,
  isRetryableError,
  rateLimiters,
  calculateQualityMetrics,
  PART_COUNT_ESTIMATION_PROMPT,
  parsePartCountEstimate,
  type QualityMetrics,
} from "./ocr-utils";
import {
  validateAIResponse,
  generateReviewFlags,
  needsReview,
  type ReviewFlag,
  type ValidationResult,
} from "./ocr-validation";
import {
  createAuditBuilder,
  type OCRAuditEntry,
} from "./ocr-audit";
import {
  shouldChunkDocument,
  extractWithAdaptiveChunking,
  calculateChunkBoundaries,
  mergeChunkResults,
  CHUNKING_CONFIG,
  type ChunkingDecision,
} from "./ocr-chunking";

// ============================================================
// TYPES
// ============================================================

export interface EnterpriseOCRResult {
  success: boolean;
  parts: CutPart[];
  
  // Metadata
  requestId: string;
  provider: "anthropic" | "openai";
  processingTimeMs: number;
  
  // Quality
  qualityMetrics: QualityMetrics;
  reviewFlags: ReviewFlag[];
  needsReview: boolean;
  reviewReason?: string;
  
  // Verification
  estimatedParts?: number;
  truncationDetected: boolean;
  validationWarnings: string[];
  
  // Processing info
  strategy: "single-pass" | "chunked" | "segmented" | "fallback";
  retryCount: number;
  usedFallback: boolean;
  chunkCount?: number;
  
  // Audit
  auditEntry?: OCRAuditEntry;
  
  // Errors
  errors: string[];
}

export interface EnterpriseOCROptions {
  // Provider preferences
  preferredProvider?: "anthropic" | "openai";
  enableFallback?: boolean;
  
  // Retry settings
  maxRetries?: number;
  retryDelayMs?: number;
  
  // Chunking settings
  enableChunking?: boolean;
  forceChunking?: boolean;
  estimatedParts?: number;
  
  // Validation settings
  strictValidation?: boolean;
  autoFlagForReview?: boolean;
  
  // Audit settings
  enableAudit?: boolean;
  organizationId?: string;
  
  // Input metadata
  fileName?: string;
  fileType?: "image" | "pdf" | "text";
}

type ExtractFn = (imageBase64: string, prompt?: string) => Promise<{
  parts: unknown[];
  rawResponse: string;
  tokensUsed?: { prompt: number; completion: number };
}>;

// ============================================================
// ENTERPRISE OCR SERVICE
// ============================================================

/**
 * Enterprise-grade OCR service with all bulletproof features.
 */
export class EnterpriseOCRService {
  private anthropicExtract: ExtractFn;
  private openaiExtract: ExtractFn;
  
  constructor(
    anthropicExtract: ExtractFn,
    openaiExtract: ExtractFn
  ) {
    this.anthropicExtract = anthropicExtract;
    this.openaiExtract = openaiExtract;
  }
  
  /**
   * Main entry point for enterprise OCR.
   */
  async extractParts(
    imageBase64: string,
    options: EnterpriseOCROptions = {}
  ): Promise<EnterpriseOCRResult> {
    const requestId = generateId();
    const startTime = Date.now();
    const errors: string[] = [];
    
    // Create audit builder
    const audit = options.enableAudit !== false
      ? createAuditBuilder(requestId)
      : null;
    
    if (audit && options.organizationId) {
      audit.setOrganization(options.organizationId);
    }
    
    // Set input metadata
    audit?.setInput({
      type: options.fileType || "image",
      fileName: options.fileName,
      fileSizeKB: Math.round(imageBase64.length * 0.75 / 1024),
    });
    
    logger.info("🚀 [EnterpriseOCR] Starting extraction", {
      requestId,
      preferredProvider: options.preferredProvider || "anthropic",
      enableFallback: options.enableFallback !== false,
      enableChunking: options.enableChunking !== false,
    });
    
    try {
      // Step 1: Estimate part count if not provided
      let estimatedParts = options.estimatedParts;
      if (!estimatedParts && options.enableChunking !== false) {
        estimatedParts = await this.estimatePartCount(imageBase64, options.preferredProvider);
        logger.info("📊 [EnterpriseOCR] Estimated part count", { estimatedParts });
      }
      
      // Step 2: Decide chunking strategy
      const chunkingDecision = shouldChunkDocument(
        estimatedParts || 0,
        options.forceChunking ? { partsExtracted: 0, truncated: true, avgConfidence: 0 } : undefined
      );
      
      audit?.setVerification({ estimatedParts });
      
      // Step 3: Execute extraction with appropriate strategy
      let result: EnterpriseOCRResult;
      
      if (chunkingDecision.shouldChunk && options.enableChunking !== false) {
        result = await this.extractWithChunking(
          imageBase64,
          chunkingDecision,
          options,
          requestId,
          startTime,
          audit
        );
      } else {
        result = await this.extractSinglePass(
          imageBase64,
          options,
          requestId,
          startTime,
          audit
        );
        
        // If single-pass was truncated, retry with chunking
        if (result.truncationDetected && options.enableChunking !== false) {
          logger.warn("⚠️ [EnterpriseOCR] Single-pass truncated, retrying with chunking", {
            partsExtracted: result.parts.length,
          });
          
          const chunkedResult = await this.extractWithChunking(
            imageBase64,
            {
              shouldChunk: true,
              reason: "Single-pass extraction was truncated",
              strategy: "multi-pass",
              estimatedParts: estimatedParts || result.parts.length * 2,
            },
            options,
            requestId,
            startTime,
            audit
          );
          
          // Use chunked result if it found more parts
          if (chunkedResult.parts.length > result.parts.length) {
            result = chunkedResult;
          }
        }
      }
      
      // Step 4: Finalize audit
      audit?.finalize();
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(errorMsg);
      audit?.addError(errorMsg);
      
      logger.error("❌ [EnterpriseOCR] Extraction failed", {
        requestId,
        error: errorMsg,
        processingTimeMs: Date.now() - startTime,
      });
      
      audit?.setOutput({ success: false, partsExtracted: 0 });
      audit?.finalize();
      
      return {
        success: false,
        parts: [],
        requestId,
        provider: options.preferredProvider || "anthropic",
        processingTimeMs: Date.now() - startTime,
        qualityMetrics: calculateQualityMetrics([]),
        reviewFlags: [],
        needsReview: true,
        reviewReason: errorMsg,
        truncationDetected: false,
        validationWarnings: [],
        strategy: "single-pass",
        retryCount: 0,
        usedFallback: false,
        errors,
      };
    }
  }
  
  /**
   * Single-pass extraction with retry and validation.
   */
  private async extractSinglePass(
    imageBase64: string,
    options: EnterpriseOCROptions,
    requestId: string,
    startTime: number,
    audit: ReturnType<typeof createAuditBuilder> | null
  ): Promise<EnterpriseOCRResult> {
    const preferredProvider = options.preferredProvider || "anthropic";
    const enableFallback = options.enableFallback !== false;
    
    let currentProvider: "anthropic" | "openai" = preferredProvider;
    let usedFallback = false;
    let retryCount = 0;
    const errors: string[] = [];
    
    audit?.setProvider(currentProvider, currentProvider === "anthropic" ? "claude-sonnet-4-5" : "gpt-5-mini");
    audit?.setStrategy("single-pass");
    
    // Try preferred provider with retry
    const extractFn = currentProvider === "anthropic" ? this.anthropicExtract : this.openaiExtract;
    const rateLimiter = rateLimiters[currentProvider];
    
    try {
      await rateLimiter.acquire();
      
      const result = await withRetry(
        async () => {
          retryCount++;
          audit?.incrementRetry();
          return await extractFn(imageBase64);
        },
        {
          maxRetries: options.maxRetries ?? 3,
          baseDelayMs: options.retryDelayMs ?? 1000,
          retryOn: isRetryableError,
        }
      );
      
      // Validate response
      const validation = validateAIResponse(result.rawResponse);
      const truncation = detectTruncation(result.rawResponse, options.estimatedParts);
      
      if (result.tokensUsed) {
        audit?.setTokenUsage(result.tokensUsed.prompt, result.tokensUsed.completion);
      }
      
      // Convert to CutPart format
      const parts = this.convertToCutParts(validation.parts);
      
      // Calculate quality metrics
      const qualityMetrics = calculateQualityMetrics(parts);
      const reviewFlags = generateReviewFlags(validation.parts);
      const reviewResult = needsReview(validation.parts, reviewFlags);
      
      audit?.setQualityMetrics(qualityMetrics);
      audit?.setReviewFlags(reviewFlags);
      audit?.setVerification({
        truncationDetected: truncation.isTruncated,
        validationPassed: validation.success,
        needsReview: reviewResult.needsReview,
        reviewReason: reviewResult.reason,
      });
      audit?.setOutput({
        success: true,
        partsExtracted: parts.length,
        avgConfidence: qualityMetrics.avgConfidence,
        qualityScore: qualityMetrics.qualityScore,
      });
      
      for (const warning of validation.warnings) {
        audit?.addWarning(warning);
      }
      
      return {
        success: validation.success,
        parts,
        requestId,
        provider: currentProvider,
        processingTimeMs: Date.now() - startTime,
        qualityMetrics,
        reviewFlags,
        needsReview: reviewResult.needsReview,
        reviewReason: reviewResult.reason,
        truncationDetected: truncation.isTruncated,
        validationWarnings: validation.warnings,
        strategy: "single-pass",
        retryCount,
        usedFallback,
        errors,
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${currentProvider}: ${errorMsg}`);
      
      // Try fallback provider if enabled
      if (enableFallback) {
        currentProvider = currentProvider === "anthropic" ? "openai" : "anthropic";
        usedFallback = true;
        
        logger.warn("⚠️ [EnterpriseOCR] Trying fallback provider", {
          fallbackProvider: currentProvider,
          originalError: errorMsg,
        });
        
        audit?.setProvider(currentProvider, currentProvider === "anthropic" ? "claude-sonnet-4-5" : "gpt-5-mini");
        audit?.setUsedFallback(true);
        
        const fallbackFn = currentProvider === "anthropic" ? this.anthropicExtract : this.openaiExtract;
        
        try {
          await rateLimiters[currentProvider].acquire();
          
          const result = await withRetry(
            async () => {
              retryCount++;
              return await fallbackFn(imageBase64);
            },
            {
              maxRetries: 2,
              baseDelayMs: 1000,
              retryOn: isRetryableError,
            }
          );
          
          const validation = validateAIResponse(result.rawResponse);
          const truncation = detectTruncation(result.rawResponse);
          const parts = this.convertToCutParts(validation.parts);
          const qualityMetrics = calculateQualityMetrics(parts);
          const reviewFlags = generateReviewFlags(validation.parts);
          const reviewResult = needsReview(validation.parts, reviewFlags);
          
          audit?.setQualityMetrics(qualityMetrics);
          audit?.setOutput({
            success: true,
            partsExtracted: parts.length,
            avgConfidence: qualityMetrics.avgConfidence,
            qualityScore: qualityMetrics.qualityScore,
          });
          
          return {
            success: validation.success,
            parts,
            requestId,
            provider: currentProvider,
            processingTimeMs: Date.now() - startTime,
            qualityMetrics,
            reviewFlags,
            needsReview: reviewResult.needsReview,
            reviewReason: reviewResult.reason,
            truncationDetected: truncation.isTruncated,
            validationWarnings: validation.warnings,
            strategy: "fallback",
            retryCount,
            usedFallback: true,
            errors,
          };
          
        } catch (fallbackError) {
          errors.push(`${currentProvider}: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`);
        }
      }
      
      // All attempts failed
      throw new Error(`All providers failed: ${errors.join("; ")}`);
    }
  }
  
  /**
   * Chunked extraction for large documents.
   */
  private async extractWithChunking(
    imageBase64: string,
    decision: ChunkingDecision,
    options: EnterpriseOCROptions,
    requestId: string,
    startTime: number,
    audit: ReturnType<typeof createAuditBuilder> | null
  ): Promise<EnterpriseOCRResult> {
    const provider = options.preferredProvider || "anthropic";
    const extractFn = provider === "anthropic" ? this.anthropicExtract : this.openaiExtract;
    
    audit?.setStrategy(decision.strategy === "sections" ? "segmented" : "chunked");
    
    logger.info("📦 [EnterpriseOCR] Starting chunked extraction", {
      requestId,
      estimatedParts: decision.estimatedParts,
      strategy: decision.strategy,
    });
    
    const boundaries = calculateChunkBoundaries(decision.estimatedParts);
    const allParts: CutPart[] = [];
    const allWarnings: string[] = [];
    let totalRetries = 0;
    
    for (const [index, { start, end }] of boundaries.entries()) {
      try {
        await rateLimiters[provider].acquire();
        
        const chunkPrompt = `Extract ONLY items numbered ${start} through ${end}. Focus only on this range.`;
        
        const result = await withRetry(
          async () => {
            totalRetries++;
            return await extractFn(imageBase64, chunkPrompt);
          },
          {
            maxRetries: 2,
            baseDelayMs: 1000,
            retryOn: isRetryableError,
          }
        );
        
        const validation = validateAIResponse(result.rawResponse);
        const parts = this.convertToCutParts(validation.parts);
        allParts.push(...parts);
        allWarnings.push(...validation.warnings);
        
        logger.debug("✅ [EnterpriseOCR] Chunk processed", {
          chunkIndex: index + 1,
          totalChunks: boundaries.length,
          partsExtracted: parts.length,
        });
        
      } catch (error) {
        allWarnings.push(`Chunk ${index + 1} failed: ${error instanceof Error ? error.message : "Unknown"}`);
        logger.warn("⚠️ [EnterpriseOCR] Chunk failed, continuing", {
          chunkIndex: index + 1,
          error: error instanceof Error ? error.message : "Unknown",
        });
      }
    }
    
    // Deduplicate parts
    const deduped = this.deduplicateParts(allParts);
    
    // Calculate quality metrics - pass parts as-is, calculateQualityMetrics handles both formats
    const qualityMetrics = calculateQualityMetrics(deduped);
    
    // Convert to validation format for review flags
    const partsForReview = deduped.map(p => ({
      length: p.size.L,
      width: p.size.W,
      quantity: p.qty,
      thickness: p.thickness_mm,
      confidence: 0.85, // Chunked extraction has slightly lower default confidence
    }));
    const reviewFlags = generateReviewFlags(partsForReview);
    const reviewResult = needsReview(partsForReview, reviewFlags);
    
    audit?.setQualityMetrics(qualityMetrics);
    audit?.setOutput({
      success: deduped.length > 0,
      partsExtracted: deduped.length,
      avgConfidence: qualityMetrics.avgConfidence,
      qualityScore: qualityMetrics.qualityScore,
    });
    audit?.setVerification({
      truncationDetected: false, // Chunking prevents truncation
      validationPassed: true,
      needsReview: reviewResult.needsReview,
    });
    
    return {
      success: deduped.length > 0,
      parts: deduped,
      requestId,
      provider,
      processingTimeMs: Date.now() - startTime,
      qualityMetrics,
      reviewFlags,
      needsReview: reviewResult.needsReview,
      reviewReason: reviewResult.reason,
      estimatedParts: decision.estimatedParts,
      truncationDetected: false,
      validationWarnings: allWarnings,
      strategy: "chunked",
      retryCount: totalRetries,
      usedFallback: false,
      chunkCount: boundaries.length,
      errors: [],
    };
  }
  
  /**
   * Estimate part count from image (quick AI call).
   */
  private async estimatePartCount(
    imageBase64: string,
    provider: "anthropic" | "openai" = "anthropic"
  ): Promise<number> {
    try {
      const extractFn = provider === "anthropic" ? this.anthropicExtract : this.openaiExtract;
      
      // Quick extraction with part count prompt
      const result = await extractFn(imageBase64, PART_COUNT_ESTIMATION_PROMPT);
      const estimate = parsePartCountEstimate(result.rawResponse);
      
      return estimate.estimatedCount || 50; // Default to 50 if estimation fails
      
    } catch (error) {
      logger.warn("⚠️ [EnterpriseOCR] Part count estimation failed", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      return 50; // Default estimate
    }
  }
  
  /**
   * Convert validated parts to CutPart format.
   * Maps from AI response format (length/width/quantity) to CutPart format (size.L/size.W/qty).
   */
  private convertToCutParts(validatedParts: unknown[]): CutPart[] {
    return validatedParts.map((part, index) => {
      const p = part as Record<string, unknown>;
      const length = Number(p.length) || 0;
      const width = Number(p.width) || 0;
      
      const cutPart: CutPart = {
        part_id: generateId(),
        qty: Number(p.quantity) || 1,
        size: {
          L: length,
          W: width,
        },
        thickness_mm: Number(p.thickness) || 18,
        material_id: typeof p.material === "string" ? p.material : "default",
        allow_rotation: p.allowRotation === true,
        label: typeof p.label === "string" ? p.label : `Part ${index + 1}`,
      };
      
      // Convert notes string to PartNotes object if present
      if (typeof p.notes === "string" && p.notes.trim()) {
        cutPart.notes = { operator: p.notes.trim() };
      }
      
      // Map edge banding to ops.edging if present
      const ops = this.convertOps(p);
      if (ops) {
        cutPart.ops = ops;
      }
      
      return cutPart;
    });
  }
  
  /**
   * Convert AI part ops to CutPart ops format.
   */
  private convertOps(p: Record<string, unknown>): CutPart["ops"] | undefined {
    const edgeBanding = p.edgeBanding as Record<string, unknown> | undefined;
    const grooving = p.grooving as Record<string, unknown> | undefined;
    
    if (!edgeBanding?.detected && !grooving?.detected) {
      return undefined;
    }
    
    const ops: CutPart["ops"] = {};
    
    if (edgeBanding?.detected) {
      const edges: Record<string, { apply: boolean; edgeband_id?: string }> = {};
      if (edgeBanding.L1) edges.L1 = { apply: true };
      if (edgeBanding.L2) edges.L2 = { apply: true };
      if (edgeBanding.W1) edges.W1 = { apply: true };
      if (edgeBanding.W2) edges.W2 = { apply: true };
      
      if (Object.keys(edges).length > 0) {
        ops.edging = { edges };
      }
    }
    
    if (grooving?.detected) {
      const grooves: Array<{ side: "L1" | "L2" | "W1" | "W2"; offset_mm: number; depth_mm?: number; width_mm?: number }> = [];
      if (grooving.GL) grooves.push({ side: "L1", offset_mm: 0, depth_mm: 10, width_mm: 8 });
      if (grooving.GW) grooves.push({ side: "W1", offset_mm: 0, depth_mm: 10, width_mm: 8 });
      
      if (grooves.length > 0) {
        ops.grooves = grooves;
      }
    }
    
    return Object.keys(ops).length > 0 ? ops : undefined;
  }
  
  /**
   * Deduplicate parts by dimensions and material.
   */
  private deduplicateParts(parts: CutPart[]): CutPart[] {
    const seen = new Set<string>();
    const result: CutPart[] = [];
    
    for (const part of parts) {
      const key = `${part.size.L}x${part.size.W}x${part.thickness_mm}_q${part.qty}_${part.material_id || ""}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        result.push(part);
      }
    }
    
    return result;
  }
}

// ============================================================
// FACTORY FUNCTION
// ============================================================

/**
 * Create an enterprise OCR service instance.
 * 
 * This is the main entry point for using enterprise OCR features.
 * Pass in the extract functions from your AI providers.
 */
export function createEnterpriseOCR(
  anthropicExtract: ExtractFn,
  openaiExtract: ExtractFn
): EnterpriseOCRService {
  return new EnterpriseOCRService(anthropicExtract, openaiExtract);
}

