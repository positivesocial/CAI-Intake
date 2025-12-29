/**
 * CAI Intake - OpenAI Provider Implementation
 * 
 * Uses GPT-5.2 Instant for fast text parsing and vision/OCR tasks.
 * The Instant variant provides significantly faster responses for OCR.
 */

import OpenAI from "openai";

// ============================================================
// MODEL CONFIGURATION
// ============================================================

/**
 * GPT model to use for all operations.
 * 
 * Available models (as of Dec 2025):
 * - gpt-5.2-instant : FASTEST - optimized for quick responses, ideal for OCR (recommended)
 * - gpt-5.2         : Flagship model with enhanced reasoning (slower)
 * - gpt-5.2-pro     : Most capable, for complex tasks (slowest)
 * - gpt-5-mini          : Previous flagship multimodal model
 * - gpt-5-mini-mini     : Smaller, faster, cheaper version
 * 
 * Using Instant for best OCR speed while maintaining quality.
 * Update this constant to switch models across all operations.
 */
const GPT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

/**
 * Maximum completion tokens for response generation.
 * GPT-4o supports up to 128K context, 16K output.
 * Set to 16384 (max) to ensure large cutlists (100+ parts) aren't truncated.
 * Each JSON part is ~100-150 tokens, so 16K tokens = ~100-160 parts.
 */
const MAX_COMPLETION_TOKENS = 16384;
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";
import {
  type AIProvider,
  type AIParseResult,
  type ParseOptions,
  type ParsedPartResult,
  type OCROptions,
  type OCRResult,
  type OCRPageResult,
  parseAIResponseJSON,
  calculateOverallConfidence,
} from "./provider";
import {
  OPENAI_SYSTEM_PROMPT,
  buildParsePrompt,
  buildEnhancedParsePrompt,
  type AIPartResponse,
  validateAIPartResponse,
} from "./prompts";
import { logger } from "@/lib/logger";
import { 
  selectFewShotExamples, 
  formatExamplesForPrompt, 
  recordBatchUsage,
  type TrainingExample 
} from "@/lib/learning/few-shot";
import {
  withRetry,
  detectTruncation,
  isRetryableError,
  rateLimiters,
  calculateQualityMetrics,
} from "./ocr-utils";
import {
  validateAIResponse,
  generateReviewFlags,
  needsReview,
} from "./ocr-validation";
import { createAuditBuilder } from "./ocr-audit";

// ============================================================
// OPENAI PROVIDER
// ============================================================

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.client || !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Estimate the number of data rows in text (for chunking decisions)
   * Handles both line-separated and table-formatted text
   */
  private estimateRowCount(text: string): number {
    // Method 1: Count newline-separated rows with dimensions
    const lines = text.split("\n").filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) return false;
      return /\d{2,}/.test(trimmed);
    });
    
    // Method 2: Count dimension-like patterns (e.g., "600 400" or "600x400")
    const dimensionPatterns = text.match(/\b\d{2,4}\s+\d{2,4}\b/g) || [];
    
    // Method 3: Count individual 3-4 digit numbers (dimensions)
    const allDimensions = text.match(/\b[1-9]\d{1,3}\b/g) || [];
    const estimatedFromDimensions = Math.floor(allDimensions.length / 3);
    
    // Method 4: Count sequences that look like quantities
    const quantities = text.match(/\b[1-9]\d?\s/g) || [];
    
    // Method 5: Check total text length
    const estimatedFromLength = Math.floor(text.length / 70);
    
    // Use the highest reasonable estimate
    const estimated = Math.max(
      lines.length, 
      dimensionPatterns.length, 
      estimatedFromDimensions,
      Math.floor(quantities.length / 2),
      estimatedFromLength
    );
    
    logger.info("🔢 [OpenAI] Row estimation", {
      lines: lines.length,
      dimPairs: dimensionPatterns.length,
      allDims: allDimensions.length,
      estimatedFromDims: estimatedFromDimensions,
      quantities: quantities.length,
      estimatedFromLength,
      textLength: text.length,
      USING: estimated,
    });
    
    return estimated;
  }

  /**
   * Split text into chunks for processing large documents
   * Handles both line-separated text and single-line text (from OCR)
   */
  private chunkText(text: string, maxRowsPerChunk: number = 40): string[] {
    const lines = text.split("\n");
    
    // Check if text has meaningful line breaks
    const hasLineBreaks = lines.length > 5 && lines.filter(l => l.trim().length > 10).length > 5;
    
    if (hasLineBreaks) {
      // Standard line-based chunking
      const chunks: string[] = [];
      let headerEndIndex = 0;
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (/\d{3,}/.test(lines[i])) break;
        headerEndIndex = i + 1;
      }
      const headerLines = lines.slice(0, headerEndIndex).join("\n");
      const dataLines = lines.slice(headerEndIndex);
      
      for (let i = 0; i < dataLines.length; i += maxRowsPerChunk) {
        const chunkLines = dataLines.slice(i, i + maxRowsPerChunk);
        chunks.push(`${headerLines}\n${chunkLines.join("\n")}`);
      }
      
      logger.debug("📄 [OpenAI] Using line-based chunking", {
        totalLines: lines.length,
        chunksCreated: chunks.length,
      });
      
      return chunks.length > 0 ? chunks : [text];
    }
    
    // For single-line text (OCR output), split by finding natural row boundaries
    // Look for patterns like "Part #" or dimension sequences to split
    
    // Extract header (first ~200 chars before first dimension pattern)
    const headerMatch = text.match(/^(.*?(?:Part|Description|Length|Width|Material|Thick)[^0-9]*)/i);
    const header = headerMatch ? headerMatch[1].trim() : "";
    const dataStart = header.length;
    const dataText = text.substring(dataStart);
    
    // Find all row start positions by looking for row number patterns
    // Typical pattern: "44 back 518 469" or part descriptions followed by dimensions
    // Look for: number + word + 3-digit number (like "44 back 518")
    const rowStartPattern = /(?:^|\s)(\d{1,3})\s+[a-zA-Z]{2,}\s+\d{2,4}\s+\d{2,4}/g;
    const rowStarts: number[] = [0];
    let match;
    while ((match = rowStartPattern.exec(dataText)) !== null) {
      rowStarts.push(match.index);
    }
    rowStarts.push(dataText.length);
    
    // If we found row boundaries, use them; otherwise fall back to character-based
    const chunks: string[] = [];
    
    if (rowStarts.length > maxRowsPerChunk) {
      // Group rows into chunks
      for (let i = 0; i < rowStarts.length - 1; i += maxRowsPerChunk) {
        const startIdx = rowStarts[i];
        const endIdx = rowStarts[Math.min(i + maxRowsPerChunk, rowStarts.length - 1)];
        const chunkData = dataText.substring(startIdx, endIdx).trim();
        if (chunkData.length > 0) {
          chunks.push(`${header}\n\n${chunkData}`);
        }
      }
      
      logger.info("📄 [OpenAI] Using row-boundary chunking", {
        textLength: text.length,
        rowsFound: rowStarts.length - 1,
        chunksCreated: chunks.length,
      });
    } else {
      // Fall back to simple character-based chunking
      // For 147 parts in 9934 chars, each part is ~67 chars
      // We want ~35 parts per chunk (safe for AI to process)
      const CHARS_PER_CHUNK = 2400; // ~35 parts worth
      const MIN_LAST_CHUNK = 800; // Minimum size for last chunk (otherwise merge with previous)
      
      let pos = 0;
      while (pos < dataText.length) {
        let endPos = Math.min(pos + CHARS_PER_CHUNK, dataText.length);
        
        // Don't cut in the middle of a number - find next space
        if (endPos < dataText.length) {
          // Look backwards for a safe split point (after a letter followed by space)
          const searchStart = Math.max(pos, endPos - 100);
          const searchRegion = dataText.substring(searchStart, endPos + 50);
          // Find last occurrence of "letter space digit" (end of one row, start of next)
          const matches = [...searchRegion.matchAll(/[a-zA-Z]\s+(?=\d)/g)];
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            endPos = searchStart + (lastMatch.index ?? 0) + lastMatch[0].length;
          }
        }
        
        const chunkData = dataText.substring(pos, endPos).trim();
        const remainingData = dataText.length - endPos;
        
        // If this would leave a tiny last chunk, extend this chunk to include all remaining
        if (remainingData > 0 && remainingData < MIN_LAST_CHUNK) {
          const extendedChunkData = dataText.substring(pos).trim();
          if (extendedChunkData.length > 0) {
            chunks.push(`${header}\n\n${extendedChunkData}`);
          }
          break; // We're done - absorbed the last bit
        }
        
        if (chunkData.length > 0) {
          chunks.push(`${header}\n\n${chunkData}`);
        }
        
        pos = endPos; // Move to next position
      }
      
      logger.info("📄 [OpenAI] Using character-based chunking (single-line text)", {
        textLength: text.length,
        headerLength: header.length,
        charsPerChunk: CHARS_PER_CHUNK,
        chunksCreated: chunks.length,
        expectedParts: Math.ceil(dataText.length / 67),
      });
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Parse text directly without chunking (for page-based processing)
   * Each page is already a natural chunk, no need to further split
   */
  async parseTextDirect(text: string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      
      logger.info("📄 [OpenAI] Direct parsing (page-based, no chunking)", {
        textLength: text.length,
      });
      
      // For continuation pages (no header), add context about expected format
      const isLikelyContinuationPage = !text.toLowerCase().includes('part') && 
                                        !text.toLowerCase().includes('description') &&
                                        !text.toLowerCase().includes('length');
      
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isMessyData: options.isMessyData ?? this.looksMessy(text),
        isPastedText: options.isPastedText ?? true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });
      
      // Add extra instruction for continuation pages
      const continuationHint = isLikelyContinuationPage 
        ? "\n\nNOTE: This appears to be a continuation page from a multi-page document. The header row may not be present. Parse the data rows based on the pattern: numbers represent dimensions (length, width, thickness) and quantities. Extract all rows you can identify."
        : "";

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          { role: "user", content: `${prompt}${continuationHint}\n\n---\n\nINPUT DATA:\n${text}\n\nIMPORTANT: Return a JSON object with a "parts" array containing ALL extracted parts. Example: {"parts": [{...}, {...}]}` },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      
      // Try to parse the response - handle multiple formats
      let parts: AIPartResponse[] = [];
      
      try {
        const parsed = JSON.parse(rawResponse);
        
        // Check for error response
        if (parsed.error && typeof parsed.error === 'string') {
          logger.warn("⚠️ [OpenAI] AI returned error for page", { error: parsed.error });
          return {
            success: false,
            parts: [],
            totalConfidence: 0,
            rawResponse,
            errors: [parsed.error],
            processingTime: Date.now() - startTime,
          };
        }
        
        // Format 1: { parts: [...] }
        if (parsed.parts && Array.isArray(parsed.parts)) {
          parts = parsed.parts;
        }
        // Format 2: Direct array [...]
        else if (Array.isArray(parsed)) {
          parts = parsed;
        }
        // Format 3: Single part object with required fields (row, length, width)
        else if (parsed.row !== undefined || (parsed.length !== undefined && parsed.width !== undefined)) {
          parts = [parsed];
        }
        // Format 4: Object with numeric keys (like { "0": {...}, "1": {...} })
        else if (typeof parsed === 'object') {
          const numericKeys = Object.keys(parsed).filter(k => !isNaN(Number(k)));
          if (numericKeys.length > 0) {
            parts = numericKeys.map(k => parsed[k]).filter(p => p && typeof p === 'object');
          }
        }
      } catch (e) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[1].trim());
            if (extracted.parts && Array.isArray(extracted.parts)) {
              parts = extracted.parts;
            } else if (Array.isArray(extracted)) {
              parts = extracted;
            }
          } catch {}
        }
      }
      
      if (parts.length > 0) {
        logger.info("✅ [OpenAI] Direct parsed successfully", {
          partsCount: parts.length,
          processingTimeMs: Date.now() - startTime,
        });
        return this.processResults(parts, rawResponse, startTime, options);
      }
      
      logger.error("❌ [OpenAI] Direct parse failed - no parts extracted", {
        rawResponsePreview: rawResponse.substring(0, 500),
      });
      
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        rawResponse,
        errors: ["Failed to parse AI response - no parts found"],
        processingTime: Date.now() - startTime,
      };
      
    } catch (error) {
      logger.error("❌ [OpenAI] Direct parse error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseText(text: string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    let fewShotExamples: TrainingExample[] = [];
    
    try {
      const client = this.getClient();
      
      // Skip chunking if explicitly requested (e.g., for page-based processing)
      if ((options as any).skipChunking) {
        return this.parseTextDirect(text, options);
      }
      
      // Estimate row count to decide if chunking is needed
      const estimatedRows = this.estimateRowCount(text);
      const CHUNK_THRESHOLD = 50;
      
      // If document is large, use chunking strategy
      if (estimatedRows > CHUNK_THRESHOLD) {
        logger.info("📦 [OpenAI] Large document detected, using chunking strategy", {
          estimatedRows,
          threshold: CHUNK_THRESHOLD,
          textLength: text.length,
        });
        return this.parseTextChunked(text, options, startTime);
      }
      
      logger.info("📄 [OpenAI] Small document, using single-request parsing", {
        estimatedRows,
        threshold: CHUNK_THRESHOLD,
        textLength: text.length,
      });
      
      // Select few-shot examples for better accuracy
      try {
        fewShotExamples = await selectFewShotExamples(
          text,
          options.organizationId,
          {
            maxExamples: 3,
            needsEdgeExamples: options.extractMetadata,
            needsGrooveExamples: options.extractMetadata,
          }
        );
        
        if (fewShotExamples.length > 0) {
          logger.info("🎯 [OpenAI] Selected few-shot examples", {
            count: fewShotExamples.length,
            exampleIds: fewShotExamples.map(e => e.id),
          });
        }
      } catch (fewShotError) {
        logger.warn("⚠️ [OpenAI] Failed to load few-shot examples, continuing without", {
          error: fewShotError instanceof Error ? fewShotError.message : "Unknown error",
        });
      }
      
      // Build enhanced prompt with few-shot examples
      const fewShotPromptText = fewShotExamples.length > 0 
        ? formatExamplesForPrompt(fewShotExamples) 
        : undefined;
      
      const prompt = buildEnhancedParsePrompt({
        extractMetadata: options.extractMetadata,
        isMessyData: options.isMessyData ?? this.looksMessy(text),
        isPastedText: options.isPastedText ?? true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
        fewShotExamples: fewShotPromptText,
        includeDetailedEdgeGuide: options.extractMetadata,
      });

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          { role: "user", content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}\n\nRespond with JSON only.` },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      
      logger.debug("📥 [OpenAI] AI response received", {
        responseLength: rawResponse.length,
        preview: rawResponse.substring(0, 200),
        fewShotExamplesUsed: fewShotExamples.length,
      });
      
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] }>(rawResponse);
      
      if (!parsed || !Array.isArray(parsed.parts)) {
        // Try parsing as direct array
        const directArray = parseAIResponseJSON<AIPartResponse[]>(rawResponse);
        if (directArray && Array.isArray(directArray)) {
          logger.info("✅ [OpenAI] Parsed as direct array", { 
            partsCount: directArray.length,
            fewShotExamplesUsed: fewShotExamples.length,
          });
          
          // Record usage as successful
          if (fewShotExamples.length > 0) {
            recordBatchUsage(fewShotExamples.map(e => e.id), true).catch(() => {});
          }
          
          const result = this.processResults(directArray, rawResponse, startTime, options);
          (result as any).fewShotExamplesUsed = fewShotExamples.length;
          return result;
        }
        
        logger.error("❌ [OpenAI] Failed to parse AI response", {
          parsedType: typeof parsed,
          hasParts: !!(parsed as any)?.parts,
          rawResponsePreview: rawResponse.substring(0, 500),
        });
        
        // Record usage as unsuccessful
        if (fewShotExamples.length > 0) {
          recordBatchUsage(fewShotExamples.map(e => e.id), false).catch(() => {});
        }
        
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse AI response as valid parts array"],
          processingTime: Date.now() - startTime,
        };
      }

      logger.info("✅ [OpenAI] Successfully parsed parts", {
        partsCount: parsed.parts.length,
        processingTimeMs: Date.now() - startTime,
        fewShotExamplesUsed: fewShotExamples.length,
      });
      
      // Record usage as successful
      if (fewShotExamples.length > 0) {
        recordBatchUsage(fewShotExamples.map(e => e.id), true).catch(() => {});
      }

      const result = this.processResults(parsed.parts, rawResponse, startTime, options);
      (result as any).fewShotExamplesUsed = fewShotExamples.length;
      return result;
      
    } catch (error) {
      logger.error("❌ [OpenAI] parseText error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      
      // Record usage as unsuccessful on error
      if (fewShotExamples.length > 0) {
        recordBatchUsage(fewShotExamples.map(e => e.id), false).catch(() => {});
      }
      
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse large text documents using chunking strategy
   */
  private async parseTextChunked(
    text: string,
    options: ParseOptions,
    startTime: number
  ): Promise<AIParseResult> {
    const client = this.getClient();
    const chunks = this.chunkText(text, 40);
    
    logger.info("🔄 [OpenAI] Processing chunks in parallel", {
      chunkCount: chunks.length,
      rowsPerChunk: 40,
      totalTextLength: text.length,
    });
    
    const prompt = buildParsePrompt({
      extractMetadata: options.extractMetadata,
      isMessyData: options.isMessyData ?? this.looksMessy(text),
      isPastedText: options.isPastedText ?? true,
      templateId: options.templateId,
      templateConfig: options.templateConfig ? {
        fieldLayout: options.templateConfig.fieldLayout,
      } : undefined,
    });

    // Process chunks in parallel batches
    const BATCH_SIZE = 3;
    const allParts: AIPartResponse[] = [];
    const allErrors: string[] = [];
    let totalRawResponse = "";
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      
      logger.info(`📦 [OpenAI] Processing batch ${batchNum}/${totalBatches}`, {
        chunksInBatch: batch.length,
        startChunk: i + 1,
        endChunk: i + batch.length,
        totalChunks: chunks.length,
      });
      
      const batchResults = await Promise.allSettled(
        batch.map(async (chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          logger.debug(`🔨 [OpenAI] Processing chunk ${chunkIndex + 1}/${chunks.length}`);
          
          const response = await client.chat.completions.create({
            model: GPT_MODEL,
            messages: [
              { role: "system", content: OPENAI_SYSTEM_PROMPT },
              { 
                role: "user", 
                content: `${prompt}\n\nIMPORTANT: This is chunk ${chunkIndex + 1} of ${chunks.length} from a larger document. Parse ALL rows in this chunk.\n\n---\n\nINPUT DATA:\n${chunk}\n\nRespond with JSON only.`
              },
            ],
            temperature: 0.1,
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            response_format: { type: "json_object" },
          });

          return response.choices[0]?.message?.content || "";
        })
      );

      // Process batch results
      for (let idx = 0; idx < batchResults.length; idx++) {
        const result = batchResults[idx];
        const chunkNum = i + idx + 1;
        
        if (result.status === "fulfilled") {
          const rawResponse = result.value;
          totalRawResponse += rawResponse + "\n---\n";
          
          logger.debug(`📥 [OpenAI] Chunk ${chunkNum} raw response`, {
            length: rawResponse.length,
            preview: rawResponse.substring(0, 300),
          });
          
          const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[] | AIPartResponse>(rawResponse);
          
          // Handle multiple response formats:
          // 1. { "parts": [...] } - standard format
          // 2. [...] - direct array
          // 3. { "row": ..., "label": ... } - single object (wrap in array)
          // 4. { "error": "..." } - AI returned error message
          let parts: AIPartResponse[] | null = null;
          
          if (Array.isArray(parsed)) {
            parts = parsed;
          } else if (parsed && typeof parsed === "object") {
            if ("parts" in parsed && Array.isArray((parsed as any).parts)) {
              parts = (parsed as any).parts;
            } else if ("row" in parsed || "label" in parsed || "length" in parsed) {
              // Single part object - wrap in array
              parts = [parsed as AIPartResponse];
              logger.debug(`📦 [OpenAI] Chunk ${chunkNum} returned single object, wrapped in array`);
            } else if ("error" in parsed) {
              // AI returned an error message
              logger.warn(`⚠️ [OpenAI] Chunk ${chunkNum} AI returned error`, {
                error: (parsed as any).error,
              });
              allErrors.push(`Chunk ${chunkNum}: AI error - ${(parsed as any).error}`);
              continue;
            }
          }
          
          if (parts && Array.isArray(parts) && parts.length > 0) {
            logger.info(`✅ [OpenAI] Chunk ${chunkNum} parsed successfully`, {
              partsFound: parts.length,
            });
            allParts.push(...parts);
          } else {
            logger.error(`❌ [OpenAI] Chunk ${chunkNum} failed to parse`, {
              parsedType: typeof parsed,
              hasParts: !!(parsed as any)?.parts,
              rawResponsePreview: rawResponse.substring(0, 500),
            });
            allErrors.push(`Chunk ${chunkNum}: Failed to parse response`);
          }
        } else {
          const errorMsg = result.reason?.message || "Chunk processing failed";
          logger.error(`❌ [OpenAI] Chunk ${chunkNum} request failed`, {
            error: errorMsg,
          });
          allErrors.push(`Chunk ${chunkNum}: ${errorMsg}`);
        }
      }
    }
    
    logger.info("✅ [OpenAI] Chunked parsing complete", {
      totalPartsFound: allParts.length,
      chunksProcessed: chunks.length,
      errors: allErrors.length,
      processingTimeMs: Date.now() - startTime,
    });

    if (allParts.length === 0) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        rawResponse: totalRawResponse,
        errors: allErrors.length > 0 ? allErrors : ["No parts extracted from any chunks"],
        processingTime: Date.now() - startTime,
      };
    }

    return this.processResults(allParts, totalRawResponse, startTime, options);
  }

  async parseImage(imageData: ArrayBuffer | string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    const requestId = generateId();
    
    // Create audit builder for enterprise tracking
    const audit = createAuditBuilder(requestId);
    audit.setProvider("openai", GPT_MODEL);
    audit.setStrategy("single-pass");
    
    try {
      const client = this.getClient();
      
      // Acquire rate limit token before making request
      await rateLimiters.openai.acquire();
      
      // Use deterministic prompt if provided (for CAI template parsing)
      // This bypasses the generic prompt builder and uses org-specific shortcodes
      const prompt = options.deterministicPrompt 
        ? options.deterministicPrompt
        : buildParsePrompt({
            extractMetadata: options.extractMetadata,
            isImage: true,
            templateId: options.templateId,
            templateConfig: options.templateConfig ? {
              fieldLayout: options.templateConfig.fieldLayout,
            } : undefined,
          });
      
      if (options.deterministicPrompt) {
        logger.info("[OpenAI] 🎯 Using DETERMINISTIC template prompt for CAI template", {
          templateId: options.templateId,
          promptLength: options.deterministicPrompt.length,
        });
      }

      // Convert ArrayBuffer to base64 if needed
      let imageUrl: string;
      if (typeof imageData === "string") {
        // Validate data URL format
        if (imageData.startsWith("data:")) {
          // Verify it's a valid data URL pattern
          const dataUrlMatch = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (!dataUrlMatch) {
            audit.addError("Invalid image data URL format");
            audit.finalize();
            return {
              success: false,
              parts: [],
              totalConfidence: 0,
              errors: ["Invalid image data URL format"],
              processingTime: Date.now() - startTime,
            };
          }
          imageUrl = imageData;
        } else {
          // Assume raw base64
          imageUrl = `data:image/jpeg;base64,${imageData}`;
        }
      } else {
        const base64 = Buffer.from(imageData).toString("base64");
        imageUrl = `data:image/jpeg;base64,${base64}`;
      }

      // Set input metadata for audit
      audit.setInput({
        type: "image",
        fileSizeKB: Math.round(imageUrl.length * 0.75 / 1024),
      });

      // Validate the URL isn't empty or malformed
      if (imageUrl.length < 100) {
        audit.addError("Image data is too small or empty");
        audit.finalize();
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          errors: ["Image data is too small or empty"],
          processingTime: Date.now() - startTime,
        };
      }

      // Use retry wrapper for resilience
      const response = await withRetry(
        async () => {
          return await client.chat.completions.create({
            model: GPT_MODEL,
            messages: [
              { role: "system", content: OPENAI_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: `I am a cabinet manufacturer and this is a photograph of my production order / cutting list from my workshop.

This document contains ONLY standard manufacturing data:
- Part dimensions in millimeters (Length × Width × Thickness)
- Quantities (how many pieces to cut)
- Material names (like "WHITE PB", "WALNUT", "MDF", "HUORD WALNUT")
- Edge banding codes (like "2L2W" = all 4 edges, "2L" = 2 long edges, "1L" = 1 long edge)
- Operations like drilling, grooving, or CNC routing

THIS IS A STRUCTURED TABLE FORMAT. The document has COLUMNS like:
# | Part Name | L(mm) | W(mm) | Thk | Qty | Material | Edge (code) | Groove | Drill | CNC | Notes

CRITICAL EXTRACTION RULES - READ ROW BY ROW:
1. Start at ROW 1 (the first filled row after headers)
2. Read EACH CELL in that row from left to right
3. Move to the NEXT ROW and repeat
4. Do NOT skip any rows - even if they look similar
5. Each row is a UNIQUE part with its own dimensions

ROW-BY-ROW EXTRACTION:
- Row 1: Read Label, L, W, Qty, Material, Edge code for ROW 1
- Row 2: Read Label, L, W, Qty, Material, Edge code for ROW 2
- Row 3: Read Label, L, W, Qty, Material, Edge code for ROW 3
- Continue for ALL rows...

IMPORTANT: Labels might include section names like "Downstairs", "Down face", "Bedroom I Doors", "Bedroom 2 Doors", etc.
IMPORTANT: Do NOT combine or summarize rows - each numbered row is a separate part!

EDGE BANDING INTERPRETATION:
- "2L2W" = ALL 4 edges banded (L1=true, L2=true, W1=true, W2=true)
- "2L" = both length edges (L1=true, L2=true, W1=false, W2=false)  
- "1L" = one length edge only (L1=true, L2=false, W1=false, W2=false)
- "2W" = both width edges (L1=false, L2=false, W1=true, W2=true)
- "1W" = one width edge (L1=false, L2=false, W1=true, W2=false)

${prompt}

Respond with valid JSON array containing ALL extracted parts. Every row number in the document should have a corresponding object in your output.` },
                  { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
                ],
              },
            ],
            temperature: 0.1,
            max_completion_tokens: MAX_COMPLETION_TOKENS,
          });
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          retryOn: isRetryableError,
        }
      );

      const rawResponse = response.choices[0]?.message?.content || "";
      const finishReason = response.choices[0]?.finish_reason;
      
      // Log detailed response info for debugging
      if (!rawResponse || rawResponse.length < 10) {
        logger.warn("🖼️ [OpenAI] Received empty or very short response", {
          rawResponse,
          finishReason,
          model: response.model,
          tokensUsed: response.usage,
          choicesCount: response.choices?.length,
        });
      }
      
      // Record token usage for audit
      if (response.usage) {
        audit.setTokenUsage(response.usage.prompt_tokens, response.usage.completion_tokens);
      }
      
      // Check for truncation
      const truncation = detectTruncation(rawResponse);
      if (truncation.isTruncated) {
        logger.warn("⚠️ [OpenAI] Response may be truncated", {
          reason: truncation.reason,
          partialParts: truncation.partialParts,
        });
        audit.addWarning(`Truncation detected: ${truncation.reason}`);
      }
      
      audit.setVerification({ truncationDetected: truncation.isTruncated });
      
      // DETAILED OCR LOGGING - Log full raw response for debugging
      // Using console.log for better visibility in terminal
      console.log("\n\n🖼️ ========== [OpenAI] RAW AI RESPONSE START ==========");
      console.log("🖼️ [OpenAI] Response length:", rawResponse.length, "characters");
      console.log("🖼️ [OpenAI] Finish reason:", finishReason);
      console.log("🖼️ [OpenAI] Tokens used:", JSON.stringify(response.usage));
      
      // Log in chunks to avoid truncation in logs
      const chunkSize = 3000;
      for (let i = 0; i < rawResponse.length; i += chunkSize) {
        const chunkNum = Math.floor(i/chunkSize) + 1;
        const totalChunks = Math.ceil(rawResponse.length / chunkSize);
        console.log(`🖼️ [OpenAI] RAW RESPONSE CHUNK ${chunkNum}/${totalChunks}:`);
        console.log(rawResponse.substring(i, i + chunkSize));
      }
      console.log("🖼️ ========== [OpenAI] RAW AI RESPONSE END ==========\n\n");
      
      // Also log via logger for persistence
      logger.info("🖼️ [OpenAI] Raw AI response captured", {
        length: rawResponse.length,
        finishReason,
        tokensUsed: response.usage,
        responsePreview: rawResponse.substring(0, 1000),
      });
      
      // Use enterprise validation
      const validation = validateAIResponse(rawResponse);
      
      if (!validation.success && validation.parts.length === 0) {
        logger.warn("🖼️ [OpenAI] Image analysis returned no parseable parts", {
          rawResponsePreview: rawResponse.substring(0, 500),
          errors: validation.errors,
        });
        
        audit.setOutput({ success: false, partsExtracted: 0 });
        audit.addError(validation.errors[0] || "No parts extracted");
        audit.finalize();
        
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: validation.errors.length > 0 
            ? validation.errors 
            : ["Failed to parse AI response from image analysis. The image may not contain a recognizable cutlist."],
          processingTime: Date.now() - startTime,
        };
      }
      
      // Log validation warnings
      for (const warning of validation.warnings) {
        audit.addWarning(warning);
      }
      
      // Convert validated parts to AIPartResponse format
      const parts = validation.parts as AIPartResponse[];
      
      // DETAILED OCR LOGGING - Log each extracted part using console.log for visibility
      console.log("\n\n🖼️ ========== [OpenAI] PARSED PARTS FROM AI RESPONSE ==========");
      console.log("🖼️ [OpenAI] Total parts parsed from AI:", parts.length);
      console.log("🖼️ [OpenAI] Validation success:", validation.success);
      console.log("🖼️ [OpenAI] Validation warnings:", validation.warnings);
      console.log("🖼️ [OpenAI] Validation errors:", validation.errors);
      
      // Log each part in a readable format
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(`\n🖼️ [OpenAI] Part ${i + 1}/${parts.length}:`);
        console.log(`   Row: ${part.row}`);
        console.log(`   Label: "${part.label}"`);
        console.log(`   Dimensions: ${part.length} x ${part.width} x ${part.thickness || 18}mm`);
        console.log(`   Quantity: ${part.quantity}`);
        console.log(`   Material: "${part.material}"`);
        console.log(`   Edge Banding: ${JSON.stringify(part.edgeBanding)}`);
        console.log(`   Grooving: ${JSON.stringify(part.grooving)}`);
        console.log(`   Drilling: ${JSON.stringify(part.drilling)}`);
        console.log(`   CNC Ops: ${JSON.stringify(part.cncOperations)}`);
        console.log(`   Notes: "${part.notes || ''}"`);
        console.log(`   Confidence: ${part.confidence}`);
      }
      console.log("\n🖼️ ========== [OpenAI] END PARSED PARTS ==========\n\n");
      
      // Also log summary via logger
      logger.info("🖼️ [OpenAI] Parts parsed from AI", {
        count: parts.length,
        firstPartLabel: parts[0]?.label,
        lastPartLabel: parts[parts.length - 1]?.label,
        uniqueLabels: [...new Set(parts.map(p => p.label))].length,
        uniqueDimensions: [...new Set(parts.map(p => `${p.length}x${p.width}`))].length,
      });
      
      // Generate review flags
      const reviewFlags = generateReviewFlags(validation.parts);
      const reviewResult = needsReview(validation.parts, reviewFlags);
      
      // Calculate quality metrics
      const qualityMetrics = calculateQualityMetrics(parts);
      
      // Finalize audit
      audit.setQualityMetrics(qualityMetrics);
      audit.setReviewFlags(reviewFlags);
      audit.setOutput({
        success: true,
        partsExtracted: parts.length,
        avgConfidence: qualityMetrics.avgConfidence,
        qualityScore: qualityMetrics.qualityScore,
      });
      audit.setVerification({
        validationPassed: validation.success,
        needsReview: reviewResult.needsReview,
        reviewReason: reviewResult.reason,
      });
      audit.finalize();
      
      logger.info("✅ [OpenAI] Image parsed with enterprise validation", {
        requestId,
        partsFound: parts.length,
        qualityScore: qualityMetrics.qualityScore,
        needsReview: reviewResult.needsReview,
        reviewFlags: reviewFlags.length,
        processingTimeMs: Date.now() - startTime,
      });

      return this.processResults(parts, rawResponse, startTime, options);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      audit.addError(errorMessage);
      audit.setOutput({ success: false, partsExtracted: 0 });
      audit.finalize();
      
      // Log specific error for debugging
      logger.error("[OpenAI parseImage] Error:", { error: errorMessage });
      
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [errorMessage],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseDocument(
    pdfData: ArrayBuffer,
    extractedText?: string,
    options?: ParseOptions
  ): Promise<AIParseResult> {
    // If we have extracted text, use text parsing
    if (extractedText) {
      return this.parseText(extractedText, options || {
        extractMetadata: true,
        confidence: "balanced",
      });
    }

    // Otherwise, convert first page to image and use vision
    // For now, return error - PDF image conversion requires additional setup
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["PDF parsing requires text extraction. Please extract text first or use image upload."],
      processingTime: 0,
    };
  }

  // ============================================================
  // OCR METHODS
  // ============================================================

  async parseImageForOCR(
    imageData: ArrayBuffer | string,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      
      // Report progress
      options.onProgress?.({
        stage: "processing",
        percent: 10,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Sending to GPT-4 Vision...",
      });

      // Build OCR-optimized prompt
      const ocrPrompt = this.buildOCRPrompt(options);

      // Convert to base64 if needed
      let imageUrl: string;
      if (typeof imageData === "string") {
        imageUrl = imageData.startsWith("data:") 
          ? imageData 
          : `data:image/jpeg;base64,${imageData}`;
      } else {
        const base64 = Buffer.from(imageData).toString("base64");
        imageUrl = `data:image/jpeg;base64,${base64}`;
      }

      options.onProgress?.({
        stage: "extracting",
        percent: 30,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Extracting text and parts...",
      });

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `I am a cabinet manufacturer and this is a photograph of my production order / cutting list from my workshop.

This document contains ONLY standard manufacturing data:
- Part dimensions in millimeters (Length × Width × Thickness)
- Quantities (how many pieces to cut)
- Material names (like "WHITE PB", "WALNUT", "MDF")
- Edge banding codes (like "2L2W" = 2 long + 2 short edges, "1L" = 1 long edge)
- Operations like drilling, grooving, or CNC routing

CRITICAL EXTRACTION RULES:
1. This page may have MULTIPLE COLUMNS - scan LEFT, CENTER, and RIGHT
2. Extract from ALL SECTIONS (e.g., "Downstairs", "Bedroom 1", "Bedroom 2")
3. Count and extract EVERY numbered row - if you see 25+ items, extract ALL 25+
4. For each part: label, length, width, quantity, material, edge banding

${ocrPrompt}

Respond with valid JSON array containing ALL extracted parts. Do not omit any rows.` },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });

      options.onProgress?.({
        stage: "parsing",
        percent: 70,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Processing extracted data...",
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      
      // Parse the enhanced OCR response
      const parsed = parseAIResponseJSON<{
        parts: AIPartResponse[];
        extractedText?: string;
        detectedFormat?: string;
        documentMetadata?: {
          client?: string;
          jobName?: string;
          material?: string;
        };
      }>(rawResponse);
      
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse OCR response"],
          processingTime: Date.now() - startTime,
        };
      }

      // Apply learning context if available
      let detectedClient: string | undefined;
      if (options.learningContext?.clientTemplate) {
        detectedClient = options.learningContext.clientTemplate.clientName;
      } else if (parsed && !Array.isArray(parsed) && parsed.documentMetadata?.client) {
        detectedClient = parsed.documentMetadata.client;
      }

      const baseResult = this.processResults(parts, rawResponse, startTime, options);

      options.onProgress?.({
        stage: "complete",
        percent: 100,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: `Found ${baseResult.parts.length} parts`,
      });

      return {
        ...baseResult,
        extractedText: parsed && !Array.isArray(parsed) ? parsed.extractedText : undefined,
        detectedFormat: (parsed && !Array.isArray(parsed) ? parsed.detectedFormat : "mixed") as OCRResult["detectedFormat"],
        pageConfidence: baseResult.totalConfidence,
        learningApplied: !!options.learningContext?.enabled,
        detectedClient,
      };
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "OCR processing failed"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseDocumentForOCR(
    pages: Array<ArrayBuffer | string>,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const pageResults: OCRPageResult[] = [];
    const allParts: ParsedPartResult[] = [];
    const errors: string[] = [];
    let extractedText = "";
    let detectedFormat: OCRResult["detectedFormat"] = "mixed";
    let detectedClient: string | undefined;

    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      
      options.onProgress?.({
        stage: "processing",
        percent: Math.round((i / pages.length) * 100),
        currentPage: pageNum,
        totalPages: pages.length,
        message: `Processing page ${pageNum} of ${pages.length}...`,
      });

      const pageResult = await this.parseImageForOCR(pages[i], {
        ...options,
        pageNumber: pageNum,
        totalPages: pages.length,
        previousContext: extractedText.slice(-500), // Last 500 chars for context
        onProgress: undefined, // Don't propagate nested progress
      });

      pageResults.push({
        pageNumber: pageNum,
        extractedText: pageResult.extractedText || "",
        confidence: pageResult.pageConfidence || pageResult.totalConfidence,
        partsCount: pageResult.parts.length,
        parts: pageResult.parts,
      });

      allParts.push(...pageResult.parts);
      
      if (pageResult.extractedText) {
        extractedText += `\n--- Page ${pageNum} ---\n${pageResult.extractedText}`;
      }
      
      if (pageResult.errors.length > 0) {
        errors.push(`Page ${pageNum}: ${pageResult.errors.join(", ")}`);
      }

      // Use first detected format/client
      if (!detectedFormat && pageResult.detectedFormat) {
        detectedFormat = pageResult.detectedFormat;
      }
      if (!detectedClient && pageResult.detectedClient) {
        detectedClient = pageResult.detectedClient;
      }
    }

    options.onProgress?.({
      stage: "complete",
      percent: 100,
      currentPage: pages.length,
      totalPages: pages.length,
      message: `Processed ${pages.length} pages, found ${allParts.length} parts`,
    });

    const totalConfidence = allParts.length > 0
      ? allParts.reduce((sum, p) => sum + p.confidence, 0) / allParts.length
      : 0;

    return {
      success: allParts.length > 0,
      parts: allParts,
      totalConfidence,
      errors,
      processingTime: Date.now() - startTime,
      extractedText: extractedText.trim(),
      detectedFormat,
      pageResults,
      learningApplied: !!options.learningContext?.enabled,
      detectedClient,
    };
  }

  private buildOCRPrompt(options: OCROptions): string {
    let prompt = buildParsePrompt({
      extractMetadata: options.extractMetadata,
      isImage: true,
      templateId: options.templateId,
      templateConfig: options.templateConfig ? {
        fieldLayout: options.templateConfig.fieldLayout,
      } : undefined,
    });

    // Add OCR-specific instructions
    prompt += `\n\nADDITIONAL OCR INSTRUCTIONS:
1. Extract ALL visible text from the document, especially:
   - Client/company name
   - Job name/reference
   - Material specifications
   - Board dimensions
2. Identify the document format (tabular, handwritten, mixed, structured)
3. Pay special attention to edge banding notations like X, XX, or checkmarks
4. Lowercase x often indicates groove/back panel cut
5. Include "extractedText" field with raw text content
6. Include "detectedFormat" field`;

    // Add learning context hints
    if (options.learningContext?.clientTemplate) {
      const template = options.learningContext.clientTemplate;
      prompt += `\n\nCLIENT TEMPLATE DETECTED: "${template.clientName}"
Expected column order: ${template.columnOrder.join(", ")}
Edge notation: ${JSON.stringify(template.edgeNotation || {})}
Default material: ${template.defaultMaterialId || "unknown"}`;
    }

    // Add previous page context
    if (options.previousContext) {
      prompt += `\n\nCONTEXT FROM PREVIOUS PAGES:\n${options.previousContext}`;
    }

    return prompt;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private processResults(
    aiParts: AIPartResponse[],
    rawResponse: string,
    startTime: number,
    options: ParseOptions
  ): AIParseResult {
    const parts: ParsedPartResult[] = [];
    const errors: string[] = [];
    
    logger.info("🔄 [OpenAI] ========== PROCESSING AI PARTS TO CUTPARTS ==========");
    logger.info("🔄 [OpenAI] Total AI parts to process:", { count: aiParts.length });

    for (let idx = 0; idx < aiParts.length; idx++) {
      const aiPart = aiParts[idx];
      
      // Log incoming AI part data BEFORE processing
      logger.info(`🔄 [OpenAI] Processing part ${idx + 1}/${aiParts.length} - INPUT:`, {
        row: aiPart.row,
        label: aiPart.label,
        length: aiPart.length,
        width: aiPart.width,
        thickness: aiPart.thickness,
        quantity: aiPart.quantity,
        material: aiPart.material,
        edgeBanding_raw: JSON.stringify(aiPart.edgeBanding),
        grooving_raw: JSON.stringify(aiPart.grooving),
        drilling_raw: JSON.stringify(aiPart.drilling),
        cncOperations_raw: JSON.stringify(aiPart.cncOperations),
      });
      
      const validationErrors = validateAIPartResponse(aiPart);
      
      if (validationErrors.length > 0 && !aiPart.length && !aiPart.width) {
        errors.push(`Skipped part "${aiPart.label || "unknown"}": ${validationErrors.join(", ")}`);
        continue;
      }

      // Use dimensions as-is - L represents grain direction in cabinet context
      // (may be smaller than W for grain-sensitive parts)
      const L = aiPart.length || 0;
      const W = aiPart.width || 0;

      // Post-process label to extract edge notation if present
      let cleanLabel = aiPart.label || "";
      let extractedEdges: string[] | undefined;
      
      // Check for edge notation in label (1E, 2E, 3E, 4E, 2L, etc.)
      const edgeNotationMatch = cleanLabel.match(/^(\d+E|[1-4]L|LL|2W)\s*[\n\r]*/i);
      if (edgeNotationMatch) {
        const notation = edgeNotationMatch[1].toUpperCase();
        cleanLabel = cleanLabel.slice(edgeNotationMatch[0].length).trim();
        extractedEdges = this.parseEdgeNotation(notation);
      }

      const cutPart: CutPart = {
        part_id: generateId("P"),
        label: cleanLabel || undefined,
        qty: aiPart.quantity || 1,
        size: { L, W },
        thickness_mm: aiPart.thickness || options.defaultThicknessMm || 18,
        material_id: this.mapMaterialToId(aiPart.material) || options.defaultMaterialId || "MAT-WHITE-18",
        allow_rotation: aiPart.allowRotation === true, // Default to false - users must explicitly enable rotation
        notes: aiPart.notes ? { operator: aiPart.notes } : undefined,
        audit: {
          source_method: "api",
          confidence: aiPart.confidence || 0.8,
          human_verified: false,
        },
      };

      // Add edge banding operations - from AI detection OR post-processing extraction
      // Prefer the individual flags (L1, L2, W1, W2) as they're more reliable than the edges array
      let edgesToApply: string[] = [];
      
      if (extractedEdges && extractedEdges.length > 0) {
        // Use edges extracted from label
        edgesToApply = extractedEdges;
      } else if (aiPart.edgeBanding?.detected) {
        // Build edges list from individual flags (more reliable than edges array)
        if (aiPart.edgeBanding.L1) edgesToApply.push("L1");
        if (aiPart.edgeBanding.L2) edgesToApply.push("L2");
        if (aiPart.edgeBanding.W1) edgesToApply.push("W1");
        if (aiPart.edgeBanding.W2) edgesToApply.push("W2");
        
        // Fall back to edges array if no individual flags set
        if (edgesToApply.length === 0 && aiPart.edgeBanding.edges && aiPart.edgeBanding.edges.length > 0) {
          edgesToApply = aiPart.edgeBanding.edges;
        }
      }
      
      logger.info(`🔄 [OpenAI] Part ${idx + 1} - Edge banding analysis:`, {
        aiEdgeBanding: JSON.stringify(aiPart.edgeBanding),
        detected: aiPart.edgeBanding?.detected,
        edgesFromAI: aiPart.edgeBanding?.edges,
        extractedEdgesFromLabel: extractedEdges,
        edgesToApply: edgesToApply,
        L1: aiPart.edgeBanding?.L1,
        L2: aiPart.edgeBanding?.L2,
        W1: aiPart.edgeBanding?.W1,
        W2: aiPart.edgeBanding?.W2,
        description: aiPart.edgeBanding?.description,
      });
      
      if (edgesToApply.length > 0) {
        cutPart.ops = {
          edging: {
            edges: edgesToApply.reduce((acc, edge) => {
              if (["L1", "L2", "W1", "W2"].includes(edge)) {
                acc[edge] = { apply: true };
              }
              return acc;
            }, {} as Record<string, { apply: boolean }>),
          },
        };
        logger.info(`🔄 [OpenAI] Part ${idx + 1} - Applied edging:`, { edging: JSON.stringify(cutPart.ops.edging) });
      } else {
        logger.warn(`🔄 [OpenAI] Part ${idx + 1} - NO edging applied (edgesToApply was empty)`);
      }

      // ===== MAP AI-DETECTED OPERATIONS TO OPS FIELD =====
      
      // 1. First, map grooving from AI response (aiPart.grooving)
      if (aiPart.grooving?.detected) {
        cutPart.ops = cutPart.ops || {};
        cutPart.ops.grooves = cutPart.ops.grooves || [];
        
        if (aiPart.grooving.GL) {
          cutPart.ops.grooves.push({
            side: "L1" as const,
            offset_mm: 10,
            notes: aiPart.grooving.description || "groove on length",
          });
        }
        if (aiPart.grooving.GW) {
          cutPart.ops.grooves.push({
            side: "W1" as const,
            offset_mm: 10,
            notes: aiPart.grooving.description || "groove on width",
          });
        }
      }
      
      // 2. Map drilling operations (SEPARATE from CNC)
      if (aiPart.drilling?.detected) {
        cutPart.ops = cutPart.ops || {};
        
        const drill = aiPart.drilling;
        const drillHoles = drill.holes || [];
        const drillPatterns = drill.patterns || [];
        
        // Map holes
        if (drillHoles.length > 0) {
          cutPart.ops.holes = cutPart.ops.holes || [];
          for (const hole of drillHoles) {
            cutPart.ops.holes.push({
              pattern_id: hole,
              notes: hole,
            });
          }
        }
        
        // Map drilling patterns as holes
        if (drillPatterns.length > 0) {
          cutPart.ops.holes = cutPart.ops.holes || [];
          for (const pattern of drillPatterns) {
            cutPart.ops.holes.push({
              pattern_id: pattern,
              notes: pattern,
            });
          }
        }
        
        // Store drilling description in notes
        if (drill.description) {
          cutPart.notes = {
            ...cutPart.notes,
            operator: (cutPart.notes?.operator || "") + (cutPart.notes?.operator ? "; " : "") + drill.description,
          };
        }
      }
      
      // 3. Map CNC operations (routing, pockets - NOT drilling)
      if (aiPart.cncOperations?.detected) {
        cutPart.ops = cutPart.ops || {};
        
        const cnc = aiPart.cncOperations;
        const cncRouting = cnc.routing || [];
        const cncPockets = cnc.pockets || [];
        const cncCustom = cnc.custom || [];
        
        // Map routing
        if (cncRouting.length > 0) {
          cutPart.ops.routing = cutPart.ops.routing || [];
          for (const route of cncRouting) {
            cutPart.ops.routing.push({
              region: { x: 0, y: 0, L: 100, W: 100 }, // Placeholder region
              profile_id: route,
              notes: route,
            });
          }
        }
        
        // Map pockets as custom CNC ops
        if (cncPockets.length > 0) {
          cutPart.ops.custom_cnc_ops = cutPart.ops.custom_cnc_ops || [];
          for (const pocket of cncPockets) {
            cutPart.ops.custom_cnc_ops.push({
              op_type: "pocket",
              payload: { description: pocket },
              notes: pocket,
            });
          }
        }
        
        // Map custom CNC ops
        if (cncCustom.length > 0) {
          cutPart.ops.custom_cnc_ops = cutPart.ops.custom_cnc_ops || [];
          for (const custom of cncCustom) {
            cutPart.ops.custom_cnc_ops.push({
              op_type: "custom",
              payload: { description: custom },
              notes: custom,
            });
          }
        }
        
        // Store CNC description in notes
        if (cnc.description) {
          cutPart.notes = {
            ...cutPart.notes,
            cnc: cnc.description,
          };
        }
      }
      
      // 4. ALSO post-process notes for additional operations (in case AI missed them)
      const allText = `${cleanLabel} ${aiPart.notes || ""}`.toLowerCase();
      const extractedOps = this.extractOperationsFromText(allText, aiPart);
      
      // Merge extracted grooving operations (if not already detected by AI)
      if (extractedOps.grooving?.detected && (!cutPart.ops?.grooves || cutPart.ops.grooves.length === 0)) {
        cutPart.ops = cutPart.ops || {};
        cutPart.ops.grooves = cutPart.ops.grooves || [];
        
        const side = extractedOps.grooving.profileHint === "width" ? "W1" : "L1";
        cutPart.ops.grooves.push({
          side: side as "L1" | "L2" | "W1" | "W2",
          offset_mm: 10,
          notes: extractedOps.grooving.description || "Groove detected from notes",
        });
      }
      
      // Merge extracted CNC operations (if not already detected by AI)
      if (extractedOps.cnc?.detected) {
        cutPart.ops = cutPart.ops || {};
        
        // Add hole operations if not already present
        if (extractedOps.cnc.holes && extractedOps.cnc.holes > 0 && (!cutPart.ops.holes || cutPart.ops.holes.length === 0)) {
          cutPart.ops.holes = cutPart.ops.holes || [];
          cutPart.ops.holes.push({
            notes: `${extractedOps.cnc.holes} holes - ${extractedOps.cnc.description || ""}`.trim(),
          });
        }
        
        // Add routing operations if not already present
        if (extractedOps.cnc.routing && (!cutPart.ops.routing || cutPart.ops.routing.length === 0)) {
          cutPart.ops.routing = cutPart.ops.routing || [];
          cutPart.ops.routing.push({
            region: { x: 0, y: 0, L: 100, W: 100 },
            notes: extractedOps.cnc.description || "Routing detected from notes",
          });
        }
        
        // Add generic CNC operations as custom (if nothing else detected)
        if (extractedOps.cnc.description && 
            !extractedOps.cnc.holes && 
            !extractedOps.cnc.routing && 
            (!cutPart.ops.custom_cnc_ops || cutPart.ops.custom_cnc_ops.length === 0)) {
          cutPart.ops.custom_cnc_ops = cutPart.ops.custom_cnc_ops || [];
          cutPart.ops.custom_cnc_ops.push({
            op_type: "detected",
            payload: { description: extractedOps.cnc.description },
            notes: extractedOps.cnc.description,
          });
        }
      }

      // Log the final CutPart BEFORE adding to results
      logger.info(`🔄 [OpenAI] Part ${idx + 1} - FINAL OUTPUT:`, {
        part_id: cutPart.part_id,
        label: cutPart.label,
        size: cutPart.size,
        qty: cutPart.qty,
        thickness_mm: cutPart.thickness_mm,
        material_id: cutPart.material_id,
        allow_rotation: cutPart.allow_rotation,
        ops_edging: cutPart.ops?.edging ? JSON.stringify(cutPart.ops.edging) : "NONE",
        ops_grooves: cutPart.ops?.grooves ? JSON.stringify(cutPart.ops.grooves) : "NONE",
        ops_holes: cutPart.ops?.holes ? JSON.stringify(cutPart.ops.holes) : "NONE",
        ops_routing: cutPart.ops?.routing ? JSON.stringify(cutPart.ops.routing) : "NONE",
        ops_custom_cnc: cutPart.ops?.custom_cnc_ops ? JSON.stringify(cutPart.ops.custom_cnc_ops) : "NONE",
        notes: cutPart.notes,
      });

      parts.push({
        part: cutPart,
        confidence: aiPart.confidence || 0.8,
        extractedMetadata: {
          grooving: aiPart.grooving,
          edgeBanding: aiPart.edgeBanding,
          // Cast to match expected type - the actual structure is handled in ops mapping above
          cncOperations: aiPart.cncOperations as unknown as { detected: boolean; holes?: number; routing?: boolean; description?: string; },
        },
        warnings: [
          ...validationErrors,
          ...(aiPart.warnings || []),
        ],
        originalText: aiPart.label,
      });
    }
    
    logger.info("🔄 [OpenAI] ========== END PROCESSING ==========", {
      totalPartsProcessed: parts.length,
      errorsEncountered: errors.length,
    });
    
    // Log final summary using console for visibility
    console.log("\n\n🔄 ========== [OpenAI] FINAL OUTPUT SUMMARY ==========");
    console.log(`🔄 Total parts output: ${parts.length}`);
    console.log(`🔄 Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`🔄 Error details: ${errors.join(", ")}`);
    }
    
    // Log summary of unique values
    const uniqueLabels = [...new Set(parts.map(p => p.part.label))];
    const uniqueDimensions = [...new Set(parts.map(p => `${p.part.size.L}x${p.part.size.W}`))];
    const uniqueMaterials = [...new Set(parts.map(p => p.part.material_id))];
    
    console.log(`🔄 Unique labels (${uniqueLabels.length}): ${uniqueLabels.slice(0, 10).join(", ")}${uniqueLabels.length > 10 ? "..." : ""}`);
    console.log(`🔄 Unique dimensions (${uniqueDimensions.length}): ${uniqueDimensions.slice(0, 10).join(", ")}${uniqueDimensions.length > 10 ? "..." : ""}`);
    console.log(`🔄 Unique materials (${uniqueMaterials.length}): ${uniqueMaterials.join(", ")}`);
    
    // ====== QUALITY CHECK (not necessarily errors - could be legitimate) ======
    const duplicateRatio = parts.length > 0 ? (parts.length - uniqueDimensions.length) / parts.length : 0;
    
    // Check for consecutive duplicates (may indicate hallucination OR legitimate repeated parts)
    let maxConsecutiveDuplicates = 1;
    let currentConsecutive = 1;
    for (let i = 1; i < parts.length; i++) {
      const prevDim = `${parts[i-1].part.size.L}x${parts[i-1].part.size.W}`;
      const currDim = `${parts[i].part.size.L}x${parts[i].part.size.W}`;
      if (prevDim === currDim) {
        currentConsecutive++;
        maxConsecutiveDuplicates = Math.max(maxConsecutiveDuplicates, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    
    // Log quality indicators (NOT errors - just observations for review)
    // NOTE: Repetition is NOT automatically wrong - cutlists often have identical parts
    if (uniqueLabels.length === 1 && parts.length > 10) {
      console.log("ℹ️ NOTE: All parts have the same label (may be legitimate or may need verification)");
    }
    if (uniqueDimensions.length <= 3 && parts.length > 15) {
      console.log(`ℹ️ NOTE: Only ${uniqueDimensions.length} unique dimensions for ${parts.length} parts (may be legitimate repeated parts)`);
    }
    if (maxConsecutiveDuplicates >= 10) {
      // Only flag if VERY high consecutive (10+) - this is unusual even for repeated parts
      console.log(`ℹ️ NOTE: ${maxConsecutiveDuplicates} consecutive parts with same dimensions - verify if intended`);
    }
    
    console.log(`🔄 Quality stats: ${uniqueDimensions.length} unique dims, ${uniqueLabels.length} unique labels, max ${maxConsecutiveDuplicates} consecutive same`);
    console.log("🔄 ========== [OpenAI] END FINAL OUTPUT ==========\n\n");

    return {
      success: parts.length > 0,
      parts,
      totalConfidence: calculateOverallConfidence(parts),
      rawResponse,
      errors,
      processingTime: Date.now() - startTime,
    };
  }

  private looksMessy(text: string): boolean {
    // Check for signs of messy/unstructured data
    const lines = text.split("\n").filter(l => l.trim());
    
    // Very short input might be conversational
    if (lines.length < 3 && text.length < 100) return true;
    
    // Contains conversational markers
    if (/\b(please|can you|I need|want|like|same as)\b/i.test(text)) return true;
    
    // Check for non-standard dimension formats that need AI interpretation
    // Standard: "720x560" or "720 x 560"
    // Messy: "2430Lx1210w", "720L x 560W", etc.
    const hasNonStandardDims = /\d+\s*[LlWw]\s*[x×X*]\s*\d+/i.test(text);
    if (hasNonStandardDims) return true;
    
    // Numbered lists without headers (1.. or 1) or 1. format)
    const hasNumberedList = /^[1-9]\s*[\.\)\:]/.test(text.trim());
    const hasNoHeaders = !/(length|width|qty|quantity|material|part\s*name)/i.test(lines[0] || "");
    if (hasNumberedList && hasNoHeaders) return true;
    
    // Mixed quantity/edge/groove notation in same line
    const hasMixedNotation = /\d+\s*pcs?.*\d+[LW]/i.test(text) || /\d+[LW].*\d+\s*pcs?/i.test(text);
    if (hasMixedNotation) return true;
    
    // No clear dimension patterns at all
    const hasDimensions = /\d+\s*[x×X*]\s*\d+/.test(text);
    if (!hasDimensions) return true;
    
    return false;
  }

  private mapMaterialToId(materialName?: string): string | undefined {
    if (!materialName) return undefined;
    
    const lower = materialName.toLowerCase();
    
    // Common material mappings
    if (lower.includes("white") && (lower.includes("melamine") || lower.includes("mel"))) {
      return "MAT-WHITE-18";
    }
    if (lower.includes("black") && lower.includes("melamine")) {
      return "MAT-BLACK-18";
    }
    if (lower.includes("oak")) {
      return "MAT-OAK-18";
    }
    if (lower.includes("mdf")) {
      return "MAT-MDF-18";
    }
    if (lower.includes("plywood") || lower.includes("ply")) {
      return "MAT-PLY-18";
    }
    
    return undefined;
  }

  /**
   * Parse edge notation shorthand into edge array
   * "1E" → ["L1"] (1 long edge)
   * "2E" → ["L1", "L2"] (both long edges)
   * "3E" → ["L1", "L2", "W1"] (both long + 1 short)
   * "4E" → ["L1", "L2", "W1", "W2"] (all edges)
   * "2L" or "LL" → ["L1", "L2"] (both long edges)
   * "2W" → ["W1", "W2"] (both short edges)
   */
  private parseEdgeNotation(notation: string): string[] {
    const upper = notation.toUpperCase();
    
    if (upper === "1E" || upper === "1L") {
      return ["L1"];
    }
    if (upper === "2E" || upper === "2L" || upper === "LL") {
      return ["L1", "L2"];
    }
    if (upper === "3E") {
      return ["L1", "L2", "W1"];
    }
    if (upper === "4E") {
      return ["L1", "L2", "W1", "W2"];
    }
    if (upper === "2W") {
      return ["W1", "W2"];
    }
    if (upper === "1W") {
      return ["W1"];
    }
    
    return [];
  }

  /**
   * Extract grooving, CNC, and other operations from notes/description text
   * Recognizes common shorthand notations used in cutlists
   */
  private extractOperationsFromText(
    text: string,
    aiPart: AIPartResponse
  ): {
    grooving?: { detected: boolean; description?: string; profileHint?: string };
    cnc?: { detected: boolean; description?: string; holes?: number; routing?: boolean };
  } {
    const result: {
      grooving?: { detected: boolean; description?: string; profileHint?: string };
      cnc?: { detected: boolean; description?: string; holes?: number; routing?: boolean };
    } = {};

    const lower = text.toLowerCase();

    // =========================================================================
    // GROOVING DETECTION
    // =========================================================================
    
    // GL = Groove on Length
    if (/\bgl\b/.test(lower) || /groove.*length/i.test(lower) || /length.*groove/i.test(lower)) {
      result.grooving = {
        detected: true,
        description: "Groove on length edge",
        profileHint: "length",
      };
    }
    // GW = Groove on Width  
    else if (/\bgw\b/.test(lower) || /groove.*width/i.test(lower) || /width.*groove/i.test(lower)) {
      result.grooving = {
        detected: true,
        description: "Groove on width edge",
        profileHint: "width",
      };
    }
    // Generic groove detection
    else if (/\b(grv|groove|dado|rebate|rabbet|bpg)\b/.test(lower)) {
      result.grooving = {
        detected: true,
        description: text.match(/\b(grv|groove|dado|rebate|rabbet|back.*groove|bpg)[^,.]*/i)?.[0]?.trim() || "Groove",
      };
    }
    // "Light groove" specific
    else if (/light\s*(grv|groove)/i.test(lower)) {
      result.grooving = {
        detected: true,
        description: "Light groove (shallow)",
      };
    }
    // Back panel groove
    else if (/back\s*(panel)?\s*(grv|groove)/i.test(lower)) {
      result.grooving = {
        detected: true,
        description: "Back panel groove",
      };
    }

    // Merge with AI-detected grooving
    if (aiPart.grooving?.detected && !result.grooving) {
      result.grooving = {
        detected: true,
        description: aiPart.grooving.description || "Grooving detected",
        profileHint: aiPart.grooving.profileHint,
      };
    }

    // =========================================================================
    // CNC OPERATIONS DETECTION
    // =========================================================================
    
    let cncDescription = "";
    let cncHoles = 0;
    let cncRouting = false;

    // Ventilation holes
    if (/\b(vents?|ventilation)\b/.test(lower)) {
      cncDescription += "Ventilation holes. ";
    }

    // Generic CNC
    if (/\bcnc\b/.test(lower)) {
      cncDescription += "CNC operations required. ";
    }

    // Hole patterns
    if (/\b(system\s*32|shelf\s*pin|hinge\s*(cup|bore)|drilling|holes?)\b/.test(lower)) {
      const holeMatch = lower.match(/(\d+)\s*(holes?|bores?)/);
      if (holeMatch) {
        cncHoles = parseInt(holeMatch[1], 10);
      }
      cncDescription += text.match(/\b(system\s*32|shelf\s*pins?|hinge\s*(cups?|bores?)|drilling|\d+\s*holes?)[^,.]*/i)?.[0]?.trim() || "Holes";
      cncDescription += ". ";
    }

    // Hardware prep
    if (/\b(cam\s*lock|minifix|confirmat|rafix|dowel)\b/.test(lower)) {
      cncDescription += text.match(/\b(cam\s*locks?|minifix|confirmat|rafix|dowels?)[^,.]*/i)?.[0]?.trim() || "Hardware prep";
      cncDescription += ". ";
    }

    // Routing/profiling
    if (/\b(rout(ing|ed)?|profile|shaped?)\b/.test(lower)) {
      cncRouting = true;
      cncDescription += "Routing/profiling. ";
    }

    // Merge with AI-detected CNC (new structure: routing/pockets/custom are string[])
    if (aiPart.cncOperations?.detected) {
      // routing is now string[] (array of routing operations)
      if (Array.isArray(aiPart.cncOperations.routing) && aiPart.cncOperations.routing.length > 0) {
        cncRouting = true;
        cncHoles = Math.max(cncHoles, aiPart.cncOperations.routing.length);
      }
      // pockets/custom also indicate CNC operations
      if (Array.isArray(aiPart.cncOperations.pockets) && aiPart.cncOperations.pockets.length > 0) {
        cncRouting = true;
      }
      if (Array.isArray(aiPart.cncOperations.custom) && aiPart.cncOperations.custom.length > 0) {
        cncRouting = true;
      }
      if (aiPart.cncOperations.description && !cncDescription.includes(aiPart.cncOperations.description)) {
        cncDescription += aiPart.cncOperations.description + ". ";
      }
    }

    if (cncDescription || cncHoles > 0 || cncRouting) {
      result.cnc = {
        detected: true,
        description: cncDescription.trim() || undefined,
        holes: cncHoles > 0 ? cncHoles : undefined,
        routing: cncRouting || undefined,
      };
    }

    return result;
  }
}

