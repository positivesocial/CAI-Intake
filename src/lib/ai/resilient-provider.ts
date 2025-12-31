/**
 * CAI Intake - Resilient AI Provider
 * 
 * Provides automatic failover from Claude (primary) to GPT (fallback).
 * Supports resumable processing - if primary fails mid-batch, fallback
 * continues from where it left off.
 * 
 * OPTIMIZATIONS:
 * - Image result caching with content-hash lookup
 * - Adaptive image compression based on content analysis
 * - Performance metrics collection
 */

import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import type {
  AIProvider,
  AIParseResult,
  ParseOptions,
  ParsedPartResult,
  OCROptions,
  OCRProgress,
  OCRResult,
  OCRPageResult,
} from "./provider";
import { detectTruncation, calculateQualityMetrics } from "./ocr-utils";
import { generateReviewFlags, needsReview } from "./ocr-validation";
import { createAuditBuilder } from "./ocr-audit";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
// These are server-only imports - lazy loaded to avoid client-side issues
// import { getCachedResult, cacheResult, getCacheStats } from "./ocr-cache";
// import { recordMetrics, getPerformanceMetrics } from "./ocr-optimizer";

// Type-only imports for metrics
type MetricsParams = {
  processingTimeMs: number;
  partsFound: number;
  provider: "primary" | "fallback" | "cache";
  success: boolean;
};

// Lazy loaders for server-only modules
async function getCachedResult(imageData: ArrayBuffer | string) {
  if (typeof window !== "undefined") return null;
  const { getCachedResult: get } = await import("./ocr-cache");
  return get(imageData);
}

async function cacheResult(
  imageData: ArrayBuffer | string,
  parts: ParsedPartResult[],
  totalConfidence: number,
  provider: "anthropic" | "openai",
  model: string,
  processingTimeMs: number
) {
  if (typeof window !== "undefined") return false;
  const { cacheResult: cache } = await import("./ocr-cache");
  return cache(imageData, parts, totalConfidence, provider, model, processingTimeMs);
}

async function recordMetrics(metrics: MetricsParams) {
  if (typeof window !== "undefined") return;
  const { recordMetrics: record } = await import("./ocr-optimizer");
  return record(metrics);
}

// ============================================================
// CONFIGURATION
// ============================================================

/** Maximum retries before failing over to secondary provider */
const MAX_RETRIES_PRIMARY = 2;

/** Timeout for primary provider in ms (180 seconds - matches Anthropic timeout for vision) */
const PRIMARY_TIMEOUT_MS = 180000;

/** Batch size for parallel page processing */
const PAGE_BATCH_SIZE = 3;

/** Batch size for parallel file processing */
const FILE_BATCH_SIZE = 2;

// ============================================================
// TYPES
// ============================================================

export interface ProcessingState {
  /** Successfully processed results so far */
  completedResults: ParsedPartResult[];
  /** Indices of successfully processed items */
  completedIndices: Set<number>;
  /** Extracted text from completed pages */
  extractedText: string;
  /** Which provider processed which items */
  providerUsed: Map<number, "anthropic" | "openai">;
  /** Total items to process */
  totalItems: number;
  /** Processing started at */
  startTime: number;
}

export interface ResilientProviderOptions {
  /** Timeout for primary provider (ms) */
  primaryTimeout?: number;
  /** Max retries before failover */
  maxRetries?: number;
  /** Progress callback */
  onProgress?: (progress: ResilientProgress) => void;
}

export interface ResilientProgress {
  stage: "primary" | "fallback" | "complete" | "extracting" | "parsing";
  provider: "anthropic" | "openai" | "claude" | "gpt";
  percent: number;
  message?: string;
  itemsCompleted?: number;
  totalItems?: number;
  currentPage?: number;
  totalPages?: number;
  failedOver?: boolean;
}

// ============================================================
// RESILIENT PROVIDER
// ============================================================

export class ResilientAIProvider implements AIProvider {
  readonly name = "resilient" as const;
  
  private primary: AnthropicProvider;
  private fallback: OpenAIProvider;
  private options: ResilientProviderOptions;

  constructor(options: ResilientProviderOptions = {}) {
    this.primary = new AnthropicProvider();
    this.fallback = new OpenAIProvider();
    this.options = {
      primaryTimeout: options.primaryTimeout ?? PRIMARY_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? MAX_RETRIES_PRIMARY,
      onProgress: options.onProgress,
    };
  }

  isConfigured(): boolean {
    // At least one provider must be configured
    return this.primary.isConfigured() || this.fallback.isConfigured();
  }

  /**
   * Get the best available provider
   */
  private getBestProvider(): AIProvider {
    if (this.primary.isConfigured()) return this.primary;
    if (this.fallback.isConfigured()) return this.fallback;
    throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
  }

  /**
   * Get fallback provider if primary fails
   */
  private getFallbackProvider(): AIProvider | null {
    if (!this.primary.isConfigured()) return null;
    if (!this.fallback.isConfigured()) return null;
    return this.fallback;
  }

  // ============================================================
  // TEXT PARSING
  // ============================================================

  async parseText(text: string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    
    // Try primary provider
    if (this.primary.isConfigured()) {
      try {
        const result = await this.withTimeout(
          this.primary.parseText(text, options),
          this.options.primaryTimeout!
        );
        
        if (result.success || !this.fallback.isConfigured()) {
          return result;
        }
        
        // Primary returned no results, try fallback
        console.log("Primary provider returned no results, trying fallback...");
      } catch (error) {
        console.warn("Primary provider failed:", error);
      }
    }
    
    // Try fallback provider
    if (this.fallback.isConfigured()) {
      return this.fallback.parseText(text, options);
    }
    
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["No AI provider available"],
      processingTime: Date.now() - startTime,
    };
  }

  // ============================================================
  // IMAGE PARSING
  // ============================================================

  async parseImage(imageData: ArrayBuffer | string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    const requestId = generateId();
    
    // Create audit builder for tracking
    const audit = createAuditBuilder(requestId);
    audit.setStrategy("single-pass");
    
    logger.info("🔄 [Resilient] Starting image parse with fallback chain", { requestId });
    
    // ============================================================
    // CHECK CACHE FIRST (server-side only)
    // ============================================================
    try {
      const cached = await getCachedResult(imageData);
      if (cached) {
        const cacheTimeMs = Date.now() - startTime;
        
        logger.info("✅ [Resilient] Cache HIT - returning cached result", {
          requestId,
          partsFound: cached.parts.length,
          cachedProvider: cached.provider,
          originalTimeMs: cached.originalProcessingTimeMs,
          cacheTimeMs,
          timeSaved: cached.originalProcessingTimeMs - cacheTimeMs,
        });
        
        // Record metrics
        await recordMetrics({
          processingTimeMs: cacheTimeMs,
          partsFound: cached.parts.length,
          provider: "cache",
          success: true,
        });
        
        audit.setOutput({ success: true, partsExtracted: cached.parts.length });
        audit.finalize();
        
        return {
          success: true,
          parts: cached.parts,
          totalConfidence: cached.totalConfidence,
          rawResponse: "[CACHED]",
          errors: [],
          processingTime: cacheTimeMs,
        };
      }
    } catch (cacheError) {
      // Cache check failed - continue without cache
      logger.debug("⚠️ [Resilient] Cache check failed, continuing", { requestId });
    }
    
    if (this.primary.isConfigured()) {
      try {
        audit.setProvider("anthropic", "claude-sonnet-4-5-20250929");
        
        const result = await this.withTimeout(
          this.primary.parseImage(imageData, options),
          this.options.primaryTimeout!
        );
        
        // Check for quality issues that might warrant fallback
        if (result.success && result.parts.length > 0) {
          const processingTimeMs = Date.now() - startTime;
          
          // Check for truncation
          const truncation = result.rawResponse 
            ? detectTruncation(result.rawResponse)
            : { isTruncated: false };
          
          // SMART FALLBACK LOGIC:
          // Only trigger fallback if:
          // 1. We found very few parts (< 5) OR
          // 2. We're truncated AND confidence is low (< 0.7) OR
          // 3. We're truncated AND found very few parts relative to image complexity
          // 
          // DO NOT trigger fallback if we have good results (many parts + high confidence)
          const confidence = result.totalConfidence;
          const partsFound = result.parts.length;
          
          // Good result threshold: >= 10 parts with >= 0.8 confidence
          const isGoodResult = partsFound >= 10 && confidence >= 0.8;
          // Poor result threshold: < 5 parts or < 0.5 confidence
          const isPoorResult = partsFound < 5 || confidence < 0.5;
          
          // Only consider fallback if truncated AND result is not good enough
          const shouldTryFallback = truncation.isTruncated && !isGoodResult && isPoorResult;
          
          if (!shouldTryFallback) {
            // Accept the result - either not truncated OR good enough to use
            if (truncation.isTruncated) {
              logger.info("✅ [Resilient] Primary result truncated but quality is good, accepting", {
                requestId,
                partsFound,
                confidence: confidence.toFixed(2),
                processingTimeMs,
                truncationReason: truncation.reason,
              });
            } else {
              logger.info("✅ [Resilient] Primary provider succeeded", {
                requestId,
                partsFound,
                processingTimeMs,
              });
            }
            
            // Cache the successful result (async, don't wait)
            cacheResult(
              imageData,
              result.parts,
              result.totalConfidence,
              "anthropic",
              "claude-sonnet-4-5-20250929",
              processingTimeMs
            ).catch(() => {}); // Ignore cache errors
            
            // Record metrics (async, don't wait)
            recordMetrics({
              processingTimeMs,
              partsFound: result.parts.length,
              provider: "primary",
              success: true,
            }).catch(() => {});
            
            audit.setOutput({ success: true, partsExtracted: result.parts.length });
            audit.finalize();
            return result;
          }
          
          // If fallback not available, still return primary result
          if (!this.fallback.isConfigured()) {
            logger.warn("⚠️ [Resilient] Primary result may be truncated, no fallback available", {
              requestId,
              partsFound: result.parts.length,
              truncationReason: truncation.reason,
            });
            audit.finalize();
            return result;
          }
          
          // Try fallback only for poor truncated results
          logger.info("🔄 [Resilient] Trying fallback due to poor truncated result", {
            requestId,
            primaryParts: result.parts.length,
            primaryConfidence: confidence.toFixed(2),
            truncationReason: truncation.reason,
          });
          
          audit.setUsedFallback(true);
          audit.setProvider("openai", process.env.OPENAI_MODEL || "gpt-5-mini");
          
          const fallbackResult = await this.fallback.parseImage(imageData, options);
          
          // Use whichever found more parts
          if (fallbackResult.parts.length > result.parts.length) {
            logger.info("✅ [Resilient] Fallback found more parts", {
              requestId,
              primaryParts: result.parts.length,
              fallbackParts: fallbackResult.parts.length,
            });
            audit.setOutput({ success: true, partsExtracted: fallbackResult.parts.length });
            audit.finalize();
            return fallbackResult;
          }
          
          audit.setOutput({ success: true, partsExtracted: result.parts.length });
          audit.finalize();
          return result;
        }
        
        // Primary failed or returned no parts - check for AI refusal
        const isRefusal = result.errors?.some(e => 
          e.includes("sorry") || 
          e.includes("can't assist") || 
          e.includes("cannot assist") ||
          e.includes("content policy")
        ) || (result.rawResponse && (
          result.rawResponse.includes("sorry") ||
          result.rawResponse.includes("can't assist")
        ));
        
        if (isRefusal) {
          logger.warn("⚠️ [Resilient] Primary provider refused (content filter), trying fallback", {
            requestId,
            errors: result.errors,
          });
        } else if (result.parts.length === 0) {
          logger.warn("⚠️ [Resilient] Primary provider returned no parts, trying fallback", {
            requestId,
            errors: result.errors,
          });
        }
        
        // If no fallback available, return the failed result
        if (!this.fallback.isConfigured()) {
          audit.finalize();
          return result;
        }
        
        // Try fallback
        audit.setUsedFallback(true);
        audit.setProvider("openai", process.env.OPENAI_MODEL || "gpt-5-mini");
        
        logger.info("🔄 [Resilient] Falling back to OpenAI", { requestId });
        
        const fallbackResult = await this.fallback.parseImage(imageData, options);
        
        if (fallbackResult.parts.length > 0) {
          logger.info("✅ [Resilient] Fallback succeeded where primary failed", {
            requestId,
            fallbackParts: fallbackResult.parts.length,
          });
          audit.setOutput({ success: true, partsExtracted: fallbackResult.parts.length });
          audit.finalize();
          return fallbackResult;
        }
        
        // Both failed
        logger.error("❌ [Resilient] Both primary and fallback failed", { requestId });
        audit.finalize();
        return result;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.warn("⚠️ [Resilient] Primary provider failed, trying fallback", { 
          requestId, 
          error: errorMsg,
        });
        audit.addError(`Primary: ${errorMsg}`);
      }
    }
    
    // Fallback to secondary provider
    if (this.fallback.isConfigured()) {
      audit.setUsedFallback(true);
      audit.setProvider("openai", process.env.OPENAI_MODEL || "gpt-5-mini");
      
      try {
        const result = await this.fallback.parseImage(imageData, options);
        const processingTimeMs = Date.now() - startTime;
        
        logger.info("✅ [Resilient] Fallback provider completed", {
          requestId,
          partsFound: result.parts.length,
          processingTimeMs,
        });
        
        // Cache successful fallback results too (async, don't wait)
        if (result.success && result.parts.length > 0) {
          cacheResult(
            imageData,
            result.parts,
            result.totalConfidence,
            "openai",
            process.env.OPENAI_MODEL || "gpt-5-mini",
            processingTimeMs
          ).catch(() => {});
        }
        
        // Record metrics (async, don't wait)
        recordMetrics({
          processingTimeMs,
          partsFound: result.parts.length,
          provider: "fallback",
          success: result.success,
        }).catch(() => {});
        
        audit.setOutput({ success: result.success, partsExtracted: result.parts.length });
        audit.finalize();
        return result;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        audit.addError(`Fallback: ${errorMsg}`);
        audit.finalize();
        
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          errors: [`All providers failed: ${errorMsg}`],
          processingTime: Date.now() - startTime,
        };
      }
    }
    
    audit.addError("No AI provider available");
    audit.finalize();
    
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["No AI provider available"],
      processingTime: Date.now() - startTime,
    };
  }

  // ============================================================
  // DOCUMENT PARSING
  // ============================================================

  /**
   * Parse a PDF document using native PDF support.
   * Uses Anthropic's native PDF API as primary, falls back to text parsing.
   */
  async parseDocument(
    pdfData: ArrayBuffer,
    extractedText?: string,
    options?: ParseOptions
  ): Promise<AIParseResult> {
    const startTime = Date.now();
    const safeOptions = options || {
      extractMetadata: true,
      confidence: "balanced",
    };
    
    // If we have good extracted text (> 500 chars), use text parsing (faster)
    if (extractedText && extractedText.length > 500) {
      logger.info("📄 [Resilient] Using extracted text for PDF (faster)", {
        textLength: extractedText.length,
      });
      return this.parseText(extractedText, safeOptions);
    }
    
    // Otherwise, use the primary provider's native PDF support
    // Anthropic (Claude) can process PDFs directly!
    if (this.primary.isConfigured() && typeof this.primary.parseDocument === "function") {
      try {
        logger.info("📄 [Resilient] Trying Claude NATIVE PDF via primary provider", {
          pdfSizeKB: Math.round(pdfData.byteLength / 1024),
        });
        
        const result = await this.withTimeout(
          this.primary.parseDocument(pdfData, undefined, safeOptions),
          this.options.primaryTimeout!
        );
        
        if (result.success && result.parts && result.parts.length > 0) {
          logger.info("📄 [Resilient] Claude NATIVE PDF succeeded", {
            partsFound: result.parts.length,
            processingTimeMs: Date.now() - startTime,
          });
          return result;
        }
        
        logger.warn("📄 [Resilient] Claude NATIVE PDF returned no parts", {
          errors: result.errors,
        });
      } catch (error) {
        logger.warn("📄 [Resilient] Claude NATIVE PDF failed, trying fallback", {
          error: error instanceof Error ? error.message : String(error),
          processingTimeMs: Date.now() - startTime,
        });
      }
    }
    
    // Fall back to OpenAI text parsing if available
    if (extractedText && extractedText.length > 0 && this.fallback.isConfigured()) {
      logger.info("📄 [Resilient] Falling back to OpenAI text parsing", {
        textLength: extractedText.length,
      });
      try {
        return await this.withTimeout(
          this.fallback.parseText(extractedText, safeOptions),
          this.options.fallbackTimeout!
        );
      } catch (error) {
        logger.warn("📄 [Resilient] OpenAI text parsing fallback failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    // If no text at all, return failure with helpful message
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: [
        "Could not parse PDF: No text extracted and native PDF processing failed.",
        "Try uploading as images or using a PDF with selectable text.",
      ],
      processingTime: Date.now() - startTime,
    };
  }

  // ============================================================
  // OCR WITH RESUMABLE FALLBACK
  // ============================================================

  async parseImageForOCR(
    imageData: ArrayBuffer | string,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    this.options.onProgress?.({
      stage: "primary",
      provider: "anthropic",
      percent: 10,
      message: "Processing with Claude...",
      itemsCompleted: 0,
      totalItems: 1,
    });

    // Try primary (Claude)
    if (this.primary.isConfigured()) {
      try {
        const result = await this.withTimeout(
          this.primary.parseImageForOCR(imageData, options),
          this.options.primaryTimeout!
        );
        
        if (result.success) {
          this.options.onProgress?.({
            stage: "complete",
            provider: "anthropic",
            percent: 100,
            message: `Found ${result.parts.length} parts`,
            itemsCompleted: 1,
            totalItems: 1,
          });
          return result;
        }
      } catch (error) {
        console.warn("Claude OCR failed:", error);
      }
    }

    // Fallback to GPT
    this.options.onProgress?.({
      stage: "fallback",
      provider: "openai",
      percent: 50,
      message: "Falling back to GPT-5.2...",
      itemsCompleted: 0,
      totalItems: 1,
      failedOver: true,
    });

    if (this.fallback.isConfigured()) {
      const result = await this.fallback.parseImageForOCR(imageData, options);
      
      this.options.onProgress?.({
        stage: "complete",
        provider: "openai",
        percent: 100,
        message: `Found ${result.parts.length} parts (via fallback)`,
        itemsCompleted: 1,
        totalItems: 1,
        failedOver: true,
      });
      
      return result;
    }

    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["No AI provider available for OCR"],
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Process multi-page document with parallel processing and resumable fallback
   */
  async parseDocumentForOCR(
    pages: Array<ArrayBuffer | string>,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const totalPages = pages.length;
    
    // Initialize processing state
    const state: ProcessingState = {
      completedResults: [],
      completedIndices: new Set(),
      extractedText: "",
      providerUsed: new Map(),
      totalItems: totalPages,
      startTime,
    };

    this.options.onProgress?.({
      stage: "primary",
      provider: "anthropic",
      percent: 0,
      message: `Starting parallel processing of ${totalPages} pages...`,
      itemsCompleted: 0,
      totalItems: totalPages,
    });

    // Process with primary provider (Claude) first
    if (this.primary.isConfigured()) {
      await this.processPagesBatch(
        pages,
        this.primary,
        "anthropic",
        state,
        options
      );
    }

    // Check if we need fallback
    const remainingIndices = Array.from({ length: totalPages }, (_, i) => i)
      .filter(i => !state.completedIndices.has(i));

    if (remainingIndices.length > 0 && this.fallback.isConfigured()) {
      this.options.onProgress?.({
        stage: "fallback",
        provider: "openai",
        percent: Math.round((state.completedIndices.size / totalPages) * 100),
        message: `Falling back to GPT-5.2 for ${remainingIndices.length} remaining pages...`,
        itemsCompleted: state.completedIndices.size,
        totalItems: totalPages,
        failedOver: true,
      });

      // Process remaining pages with fallback
      const remainingPages = remainingIndices.map(i => pages[i]);
      await this.processPagesBatch(
        remainingPages,
        this.fallback,
        "openai",
        state,
        options,
        remainingIndices
      );
    }

    // Compile final results
    const pageResults: OCRPageResult[] = Array.from(state.completedIndices)
      .sort((a, b) => a - b)
      .map(idx => ({
        pageNumber: idx + 1,
        extractedText: "",
        confidence: 0,
        partsCount: 0,
        parts: [],
      }));

    // Build page results from completed results
    let currentPageIdx = 0;
    for (const result of state.completedResults) {
      if (pageResults[currentPageIdx]) {
        pageResults[currentPageIdx].parts.push(result);
        pageResults[currentPageIdx].partsCount++;
      }
      currentPageIdx = (currentPageIdx + 1) % pageResults.length;
    }

    const totalConfidence = state.completedResults.length > 0
      ? state.completedResults.reduce((sum, p) => sum + p.confidence, 0) / state.completedResults.length
      : 0;

    this.options.onProgress?.({
      stage: "complete",
      provider: state.providerUsed.size > 1 ? "openai" : "anthropic",
      percent: 100,
      message: `Processed ${totalPages} pages, found ${state.completedResults.length} parts`,
      itemsCompleted: totalPages,
      totalItems: totalPages,
      failedOver: state.providerUsed.has(0) && state.providerUsed.get(0) !== state.providerUsed.get(1),
    });

    return {
      success: state.completedResults.length > 0,
      parts: state.completedResults,
      totalConfidence,
      errors: remainingIndices.length > 0 && state.completedIndices.size < totalPages
        ? [`Failed to process ${totalPages - state.completedIndices.size} pages`]
        : [],
      processingTime: Date.now() - startTime,
      extractedText: state.extractedText,
      pageResults,
      detectedFormat: "mixed",
    };
  }

  /**
   * Process pages in parallel batches
   */
  private async processPagesBatch(
    pages: Array<ArrayBuffer | string>,
    provider: AnthropicProvider | OpenAIProvider,
    providerName: "anthropic" | "openai",
    state: ProcessingState,
    options: OCROptions,
    originalIndices?: number[]
  ): Promise<void> {
    const indices = originalIndices ?? pages.map((_, i) => i);
    
    // Process in batches for parallelism
    for (let batchStart = 0; batchStart < pages.length; batchStart += PAGE_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PAGE_BATCH_SIZE, pages.length);
      const batchPages = pages.slice(batchStart, batchEnd);
      const batchIndices = indices.slice(batchStart, batchEnd);
      
      // Process batch in parallel
      const batchPromises = batchPages.map(async (page, i) => {
        const pageIndex = batchIndices[i];
        
        try {
          const result = await this.withTimeout(
            provider.parseImageForOCR(page, {
              ...options,
              pageNumber: pageIndex + 1,
              totalPages: state.totalItems,
              previousContext: state.extractedText.slice(-500),
            }),
            this.options.primaryTimeout!
          );
          
          return { pageIndex, result, success: true };
        } catch (error) {
          console.warn(`Page ${pageIndex + 1} failed with ${providerName}:`, error);
          return { pageIndex, result: null, success: false, error };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      for (const settled of batchResults) {
        if (settled.status === "fulfilled" && settled.value.success && settled.value.result) {
          const { pageIndex, result } = settled.value;
          
          state.completedResults.push(...result.parts);
          state.completedIndices.add(pageIndex);
          state.providerUsed.set(pageIndex, providerName);
          
          if (result.extractedText) {
            state.extractedText += `\n--- Page ${pageIndex + 1} ---\n${result.extractedText}`;
          }
        }
      }

      // Update progress
      this.options.onProgress?.({
        stage: providerName === "anthropic" ? "primary" : "fallback",
        provider: providerName,
        percent: Math.round((state.completedIndices.size / state.totalItems) * 100),
        message: `Processed ${state.completedIndices.size} of ${state.totalItems} pages`,
        itemsCompleted: state.completedIndices.size,
        totalItems: state.totalItems,
        failedOver: providerName === "openai",
      });
    }
  }

  // ============================================================
  // CONVENIENCE METHODS WITH PROGRESS CALLBACKS
  // ============================================================

  /**
   * Parse image with resilient fallback and progress callbacks
   * This is a convenience wrapper around parseImage for components
   */
  async parseImageResilient(
    imageData: ArrayBuffer | string,
    options: ParseOptions & { 
      onProgress?: (progress: ResilientProgress) => void;
      learningContext?: unknown;
    }
  ): Promise<AIParseResult & { metadata?: { provider: string; usedFallback: boolean } }> {
    const startTime = Date.now();
    const { onProgress, learningContext, ...parseOptions } = options;
    
    onProgress?.({
      stage: "parsing",
      provider: "claude",
      percent: 10,
      message: "Processing with Claude...",
    });

    // Try primary (Claude)
    if (this.primary.isConfigured()) {
      try {
        onProgress?.({
          stage: "parsing",
          provider: "claude",
          percent: 30,
        });

        const result = await this.withTimeout(
          this.primary.parseImage(imageData, parseOptions),
          this.options.primaryTimeout!
        );
        
        onProgress?.({
          stage: "parsing",
          provider: "claude",
          percent: 90,
        });

        if (result.success || !this.fallback.isConfigured()) {
          return {
            ...result,
            metadata: { provider: "claude", usedFallback: false },
          };
        }
      } catch (error) {
        console.warn("Claude failed for image:", error);
      }
    }

    // Fallback to GPT
    onProgress?.({
      stage: "parsing",
      provider: "gpt",
      percent: 50,
      message: "Falling back to GPT-5.2...",
      failedOver: true,
    });

    if (this.fallback.isConfigured()) {
      const result = await this.fallback.parseImage(imageData, parseOptions);
      
      onProgress?.({
        stage: "parsing",
        provider: "gpt",
        percent: 90,
      });

      return {
        ...result,
        metadata: { provider: "gpt", usedFallback: true },
      };
    }

    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["No AI provider available"],
      processingTime: Date.now() - startTime,
      metadata: { provider: "none", usedFallback: false },
    };
  }

  /**
   * Parse text with resilient fallback and progress callbacks
   */
  async parseTextResilient(
    text: string,
    options: ParseOptions & {
      onProgress?: (progress: ResilientProgress) => void;
      learningContext?: unknown;
    }
  ): Promise<AIParseResult & { metadata?: { provider: string; usedFallback: boolean } }> {
    const startTime = Date.now();
    const { onProgress, learningContext, ...parseOptions } = options;
    
    onProgress?.({
      stage: "parsing",
      provider: "claude",
      percent: 10,
      message: "Processing with Claude...",
    });

    // Try primary (Claude)
    if (this.primary.isConfigured()) {
      try {
        onProgress?.({
          stage: "parsing",
          provider: "claude",
          percent: 30,
        });

        const result = await this.withTimeout(
          this.primary.parseText(text, parseOptions),
          this.options.primaryTimeout!
        );
        
        onProgress?.({
          stage: "parsing",
          provider: "claude",
          percent: 90,
        });

        if (result.success || !this.fallback.isConfigured()) {
          return {
            ...result,
            metadata: { provider: "claude", usedFallback: false },
          };
        }
      } catch (error) {
        console.warn("Claude failed for text:", error);
      }
    }

    // Fallback to GPT
    onProgress?.({
      stage: "parsing",
      provider: "gpt",
      percent: 50,
      message: "Falling back to GPT-5.2...",
      failedOver: true,
    });

    if (this.fallback.isConfigured()) {
      const result = await this.fallback.parseText(text, parseOptions);
      
      onProgress?.({
        stage: "parsing",
        provider: "gpt",
        percent: 90,
      });

      return {
        ...result,
        metadata: { provider: "gpt", usedFallback: true },
      };
    }

    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["No AI provider available"],
      processingTime: Date.now() - startTime,
      metadata: { provider: "none", usedFallback: false },
    };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
}

// ============================================================
// PARALLEL FILE PROCESSING
// ============================================================

export interface FileProcessingOptions extends OCROptions {
  onFileProgress?: (fileIndex: number, fileName: string, progress: OCRProgress) => void;
}

export interface FileProcessingResult {
  fileName: string;
  fileIndex: number;
  result: OCRResult;
  provider: "anthropic" | "openai";
  processingTime: number;
  success: boolean;
  error?: string;
}

/**
 * Process multiple files in parallel with resilient fallback
 */
export async function processFilesInParallel(
  files: Array<{ name: string; data: ArrayBuffer | string; pages?: Array<ArrayBuffer | string> }>,
  options: FileProcessingOptions = { extractMetadata: true, confidence: "balanced" }
): Promise<FileProcessingResult[]> {
  const results: FileProcessingResult[] = [];
  const provider = new ResilientAIProvider();
  
  // Process files in batches
  for (let batchStart = 0; batchStart < files.length; batchStart += FILE_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + FILE_BATCH_SIZE, files.length);
    const batchFiles = files.slice(batchStart, batchEnd);
    
    // Process batch in parallel
    const batchPromises = batchFiles.map(async (file, i) => {
      const fileIndex = batchStart + i;
      const startTime = Date.now();
      
      // Create per-file progress handler
      const fileOptions: OCROptions = {
        ...options,
        onProgress: (progress) => {
          options.onFileProgress?.(fileIndex, file.name, progress);
        },
      };

      try {
        let result: OCRResult;
        
        if (file.pages && file.pages.length > 0) {
          // Multi-page document
          result = await provider.parseDocumentForOCR(file.pages, fileOptions);
        } else {
          // Single image/page
          result = await provider.parseImageForOCR(file.data, fileOptions);
        }

        return {
          fileName: file.name,
          fileIndex,
          result,
          provider: "anthropic" as const, // Will be updated if fallback was used
          processingTime: Date.now() - startTime,
          success: result.success,
        };
      } catch (error) {
        return {
          fileName: file.name,
          fileIndex,
          result: {
            success: false,
            parts: [],
            totalConfidence: 0,
            errors: [error instanceof Error ? error.message : "Unknown error"],
            processingTime: Date.now() - startTime,
          },
          provider: "anthropic" as const,
          processingTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const settled of batchResults) {
      if (settled.status === "fulfilled") {
        results.push(settled.value);
      }
    }
  }

  return results;
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let resilientProviderInstance: ResilientAIProvider | null = null;

/**
 * Get the singleton resilient provider instance
 */
export function getResilientProvider(options?: ResilientProviderOptions): ResilientAIProvider {
  if (!resilientProviderInstance) {
    resilientProviderInstance = new ResilientAIProvider(options);
  }
  return resilientProviderInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetResilientProvider(): void {
  resilientProviderInstance = null;
}

