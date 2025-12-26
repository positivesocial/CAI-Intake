/**
 * CAI Intake - Anthropic Claude Provider Implementation
 * 
 * Uses Claude Opus 4.5 for text parsing and image analysis.
 * This is Anthropic's most powerful model for vision and OCR tasks.
 */

import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// MODEL CONFIGURATION
// ============================================================

/**
 * Claude model to use for all operations.
 * 
 * Available models (as of Dec 2025):
 * - claude-3-5-sonnet-20241022: Latest Sonnet, best balance of speed/quality (recommended)
 * - claude-3-opus-20240229: Most capable but slower
 * - claude-3-sonnet-20240229: Fast but less capable
 * 
 * Using Sonnet 3.5 for best performance with vision/OCR tasks.
 * Update this constant to switch models across all operations.
 */
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

/**
 * Maximum tokens for response generation.
 * Sonnet 3.5 supports up to 200K context, 8K output.
 * We use max output (8192) to handle large parts lists.
 * Each part is ~150-200 tokens, so 8K tokens = ~40-50 parts per request.
 * For larger documents, we use chunking strategy.
 */
const MAX_TOKENS = 8192;

/**
 * Request timeout in milliseconds.
 * Vision/OCR requests can take longer, so allow up to 60 seconds.
 */
const REQUEST_TIMEOUT_MS = 60000;
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

// ============================================================
// STREAMING TYPES
// ============================================================

export interface StreamingProgress {
  /** Current parsing stage */
  stage: "connecting" | "receiving" | "parsing" | "complete" | "error";
  /** Percentage complete (0-100) */
  percent: number;
  /** Number of parts found so far */
  partsFound: number;
  /** Characters received so far */
  charsReceived: number;
  /** Estimated total parts (if detectable) */
  estimatedTotal?: number;
  /** Human-readable message */
  message: string;
  /** Time elapsed in ms */
  elapsedMs: number;
}

export interface StreamingParseOptions extends ParseOptions {
  /** Callback for progress updates */
  onProgress?: (progress: StreamingProgress) => void;
  /** Callback when a complete part is detected in stream */
  onPartFound?: (partIndex: number, rawPart: string) => void;
}
import {
  ANTHROPIC_SYSTEM_PROMPT,
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

// ============================================================
// ANTHROPIC PROVIDER
// ============================================================

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ 
        apiKey,
        timeout: REQUEST_TIMEOUT_MS,
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client || !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");
      }
      this.client = new Anthropic({ 
        apiKey,
        timeout: REQUEST_TIMEOUT_MS,
      });
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
    // Each part typically has Length + Width dimensions
    const dimensionPatterns = text.match(/\b\d{2,4}\s+\d{2,4}\b/g) || [];
    
    // Method 3: Count individual 3-4 digit numbers (dimensions)
    // For parts lists, dimensions are usually 50-3000mm range
    const allDimensions = text.match(/\b[1-9]\d{1,3}\b/g) || [];
    // Estimate: each part has ~3-4 dimension values (L, W, T, qty)
    const estimatedFromDimensions = Math.floor(allDimensions.length / 3);
    
    // Method 4: Count sequences that look like quantities (1-99)
    // Parts typically have quantity 1-20
    const quantities = text.match(/\b[1-9]\d?\s/g) || [];
    
    // Method 5: Check total text length - rough estimate
    // A typical part row in text is ~50-100 characters
    const estimatedFromLength = Math.floor(text.length / 70);
    
    // Use the highest reasonable estimate
    const estimated = Math.max(
      lines.length, 
      dimensionPatterns.length, 
      estimatedFromDimensions,
      Math.floor(quantities.length / 2),
      estimatedFromLength
    );
    
    // Log for debugging (using proper logger for visibility in server logs)
    logger.info("🔢 [Anthropic] Row estimation", {
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
      
      logger.debug("📄 [Anthropic] Using line-based chunking", {
        totalLines: lines.length,
        chunksCreated: chunks.length,
      });
      
      return chunks.length > 0 ? chunks : [text];
    }
    
    // For single-line text (OCR output), split by finding natural row boundaries
    
    // Extract header
    const headerMatch = text.match(/^(.*?(?:Part|Description|Length|Width|Material|Thick)[^0-9]*)/i);
    const header = headerMatch ? headerMatch[1].trim() : "";
    const dataStart = header.length;
    const dataText = text.substring(dataStart);
    
    // Find row start positions
    // Pattern: number + word + dimensions (like "44 back 518 469")
    const rowStartPattern = /(?:^|\s)(\d{1,3})\s+[a-zA-Z]{2,}\s+\d{2,4}\s+\d{2,4}/g;
    const rowStarts: number[] = [0];
    let match;
    while ((match = rowStartPattern.exec(dataText)) !== null) {
      rowStarts.push(match.index);
    }
    rowStarts.push(dataText.length);
    
    const chunks: string[] = [];
    
    if (rowStarts.length > maxRowsPerChunk) {
      for (let i = 0; i < rowStarts.length - 1; i += maxRowsPerChunk) {
        const startIdx = rowStarts[i];
        const endIdx = rowStarts[Math.min(i + maxRowsPerChunk, rowStarts.length - 1)];
        const chunkData = dataText.substring(startIdx, endIdx).trim();
        if (chunkData.length > 0) {
          chunks.push(`${header}\n\n${chunkData}`);
        }
      }
      
      logger.info("📄 [Anthropic] Using row-boundary chunking", {
        textLength: text.length,
        rowsFound: rowStarts.length - 1,
        chunksCreated: chunks.length,
      });
    } else {
      // Simple character-based chunking with safe split points
      const CHARS_PER_CHUNK = 2400;
      const MIN_LAST_CHUNK = 800;
      
      let pos = 0;
      while (pos < dataText.length) {
        let endPos = Math.min(pos + CHARS_PER_CHUNK, dataText.length);
        
        if (endPos < dataText.length) {
          const searchStart = Math.max(pos, endPos - 100);
          const searchRegion = dataText.substring(searchStart, endPos + 50);
          const matches = [...searchRegion.matchAll(/[a-zA-Z]\s+(?=\d)/g)];
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            endPos = searchStart + (lastMatch.index ?? 0) + lastMatch[0].length;
          }
        }
        
        const chunkData = dataText.substring(pos, endPos).trim();
        const remainingData = dataText.length - endPos;
        
        // If this would leave a tiny last chunk, extend to include all remaining
        if (remainingData > 0 && remainingData < MIN_LAST_CHUNK) {
          const extendedChunkData = dataText.substring(pos).trim();
          if (extendedChunkData.length > 0) {
            chunks.push(`${header}\n\n${extendedChunkData}`);
          }
          break;
        }
        
        if (chunkData.length > 0) {
          chunks.push(`${header}\n\n${chunkData}`);
        }
        
        pos = endPos;
      }
      
      logger.info("📄 [Anthropic] Using character-based chunking", {
        textLength: text.length,
        charsPerChunk: CHARS_PER_CHUNK,
        chunksCreated: chunks.length,
        expectedParts: Math.ceil(dataText.length / 67),
      });
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Parse text directly without chunking (for page-based processing)
   */
  async parseTextDirect(text: string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      
      logger.info("📄 [Anthropic] Direct parsing (page-based, no chunking)", {
        textLength: text.length,
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

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}\n\nIMPORTANT: Return a JSON object with a "parts" array containing ALL extracted parts. Example: {"parts": [{...}, {...}]}`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
      // Try to parse the response - handle multiple formats
      let parts: AIPartResponse[] = [];
      
      try {
        const parsed = JSON.parse(rawResponse);
        
        // Check for error response
        if (parsed.error && typeof parsed.error === 'string') {
          logger.warn("⚠️ [Anthropic] AI returned error for page", { error: parsed.error });
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
        // Format 3: Single part object
        else if (parsed.row !== undefined || (parsed.length !== undefined && parsed.width !== undefined)) {
          parts = [parsed];
        }
        // Format 4: Object with numeric keys
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
        logger.info("✅ [Anthropic] Direct parsed successfully", {
          partsCount: parts.length,
          processingTimeMs: Date.now() - startTime,
        });
        return this.processResults(parts, rawResponse, startTime, options);
      }
      
      logger.error("❌ [Anthropic] Direct parse failed - no parts extracted", {
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
      logger.error("❌ [Anthropic] Direct parse error", {
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
      
      // Skip chunking if explicitly requested
      if ((options as any).skipChunking) {
        return this.parseTextDirect(text, options);
      }
      
      // Estimate row count to decide if chunking is needed
      const estimatedRows = this.estimateRowCount(text);
      const CHUNK_THRESHOLD = 50; // More than 50 rows = chunk it
      
      // If document is large, use chunking strategy
      if (estimatedRows > CHUNK_THRESHOLD) {
        logger.info("📦 [Anthropic] Large document detected, using chunking strategy", {
          estimatedRows,
          threshold: CHUNK_THRESHOLD,
          textLength: text.length,
        });
        return this.parseTextChunked(text, options, startTime);
      }
      
      logger.info("📄 [Anthropic] Small document, using single-request parsing", {
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
          logger.info("🎯 [Anthropic] Selected few-shot examples", {
            count: fewShotExamples.length,
            exampleIds: fewShotExamples.map(e => e.id),
          });
        }
      } catch (fewShotError) {
        logger.warn("⚠️ [Anthropic] Failed to load few-shot examples, continuing without", {
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

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}\n\nRespond with JSON only.`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
      logger.debug("📥 [Anthropic] AI response received", {
        responseLength: rawResponse.length,
        preview: rawResponse.substring(0, 200),
        fewShotExamplesUsed: fewShotExamples.length,
      });
      
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(rawResponse);
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        logger.error("❌ [Anthropic] Failed to parse AI response", {
          parsedType: typeof parsed,
          isArray: Array.isArray(parsed),
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
      
      logger.info("✅ [Anthropic] Successfully parsed parts", {
        partsCount: parts.length,
        processingTimeMs: Date.now() - startTime,
        fewShotExamplesUsed: fewShotExamples.length,
      });
      
      // Record usage as successful
      if (fewShotExamples.length > 0) {
        recordBatchUsage(fewShotExamples.map(e => e.id), true).catch(() => {});
      }

      const result = this.processResults(parts, rawResponse, startTime, options);
      
      // Add metadata about few-shot examples used
      (result as any).fewShotExamplesUsed = fewShotExamples.length;
      
      return result;
      
    } catch (error) {
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
   * Splits document into chunks, parses each, and merges results
   */
  private async parseTextChunked(
    text: string, 
    options: ParseOptions,
    startTime: number
  ): Promise<AIParseResult> {
    const client = this.getClient();
    const chunks = this.chunkText(text, 40); // ~40 rows per chunk
    
    logger.info("🔄 [Anthropic] Processing chunks in parallel", {
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

    // Process chunks in parallel (max 3 concurrent to avoid rate limits)
    const BATCH_SIZE = 3;
    const allParts: AIPartResponse[] = [];
    const allErrors: string[] = [];
    let totalRawResponse = "";
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      
      logger.info(`📦 [Anthropic] Processing batch ${batchNum}/${totalBatches}`, {
        chunksInBatch: batch.length,
        startChunk: i + 1,
        endChunk: i + batch.length,
        totalChunks: chunks.length,
      });
      
      const batchResults = await Promise.allSettled(
        batch.map(async (chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          logger.debug(`🔨 [Anthropic] Processing chunk ${chunkIndex + 1}/${chunks.length}`, {
            chunkLength: chunk.length,
          });
          
          const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: MAX_TOKENS,
            system: ANTHROPIC_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `${prompt}\n\nIMPORTANT: This is chunk ${chunkIndex + 1} of ${chunks.length} from a larger document. Parse ALL rows in this chunk.\n\n---\n\nINPUT DATA:\n${chunk}\n\nRespond with JSON only.`,
              },
            ],
          });

          const textContent = response.content.find(c => c.type === "text");
          return textContent?.type === "text" ? textContent.text : "";
        })
      );

      // Process batch results
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const rawResponse = result.value;
          totalRawResponse += rawResponse + "\n---\n";
          
          const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(rawResponse);
          const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
          
          if (parts && Array.isArray(parts)) {
            allParts.push(...parts);
          } else {
            allErrors.push("Failed to parse chunk response");
          }
        } else {
          allErrors.push(result.reason?.message || "Chunk processing failed");
        }
      }
    }
    
    logger.info("✅ [Anthropic] Chunked parsing complete", {
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
    
    try {
      const client = this.getClient();
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isImage: true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });

      // Convert to base64 if needed
      let base64Data: string;
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      
      if (typeof imageData === "string") {
        // Check if it's a data URL
        const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          mediaType = match[1] as typeof mediaType;
          base64Data = match[2];
        } else {
          base64Data = imageData;
        }
      } else {
        base64Data = Buffer.from(imageData).toString("base64");
      }

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `${prompt}\n\nRespond with JSON only.`,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(rawResponse);
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse AI response from image analysis"],
          processingTime: Date.now() - startTime,
        };
      }

      return this.processResults(parts, rawResponse, startTime, options);
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
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

    // Claude supports PDF directly in some contexts
    // For now, require text extraction
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["PDF parsing requires text extraction. Please extract text first or use image upload."],
      processingTime: 0,
    };
  }

  // ============================================================
  // STREAMING METHODS (Real-time progress updates)
  // ============================================================

  /**
   * Parse image with streaming - shows real-time progress as AI generates response
   * 
   * Benefits:
   * - User sees "Found 1 part... Found 2 parts..." in real-time
   * - Faster perceived speed (activity shown immediately)
   * - Early error detection
   */
  async parseImageWithStreaming(
    imageData: ArrayBuffer | string,
    options: StreamingParseOptions
  ): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isImage: true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });

      // Convert to base64 if needed
      let base64Data: string;
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      
      if (typeof imageData === "string") {
        const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          mediaType = match[1] as typeof mediaType;
          base64Data = match[2];
        } else {
          base64Data = imageData;
        }
      } else {
        base64Data = Buffer.from(imageData).toString("base64");
      }

      // Report initial progress
      options.onProgress?.({
        stage: "connecting",
        percent: 5,
        partsFound: 0,
        charsReceived: 0,
        message: "Connecting to AI...",
        elapsedMs: Date.now() - startTime,
      });

      // Use streaming API
      const stream = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `${prompt}\n\nRespond with JSON only.`,
              },
            ],
          },
        ],
      });

      let fullResponse = "";
      let partsDetected = 0;
      let lastReportedParts = 0;

      // Process stream events
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          
          // Count parts detected so far by counting "row": or opening braces after "["
          const partMatches = fullResponse.match(/"row"\s*:/g) || 
                              fullResponse.match(/\{\s*"(?:row|label|length)"/g);
          partsDetected = partMatches?.length || 0;
          
          // Only report progress when parts count changes
          if (partsDetected > lastReportedParts) {
            lastReportedParts = partsDetected;
            
            options.onProgress?.({
              stage: "receiving",
              percent: Math.min(20 + partsDetected * 10, 80),
              partsFound: partsDetected,
              charsReceived: fullResponse.length,
              message: `Found ${partsDetected} part${partsDetected !== 1 ? "s" : ""}...`,
              elapsedMs: Date.now() - startTime,
            });

            options.onPartFound?.(partsDetected - 1, `Part ${partsDetected}`);
          }
        }
      }

      options.onProgress?.({
        stage: "parsing",
        percent: 90,
        partsFound: partsDetected,
        charsReceived: fullResponse.length,
        message: "Processing extracted data...",
        elapsedMs: Date.now() - startTime,
      });

      // Parse the complete response
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(fullResponse);
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        options.onProgress?.({
          stage: "error",
          percent: 100,
          partsFound: 0,
          charsReceived: fullResponse.length,
          message: "Failed to parse AI response",
          elapsedMs: Date.now() - startTime,
        });

        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse: fullResponse,
          errors: ["Failed to parse AI response from image analysis"],
          processingTime: Date.now() - startTime,
        };
      }

      const result = this.processResults(parts, fullResponse, startTime, options);

      options.onProgress?.({
        stage: "complete",
        percent: 100,
        partsFound: result.parts.length,
        charsReceived: fullResponse.length,
        message: `Complete! Found ${result.parts.length} parts`,
        elapsedMs: Date.now() - startTime,
      });

      return result;
      
    } catch (error) {
      options.onProgress?.({
        stage: "error",
        percent: 100,
        partsFound: 0,
        charsReceived: 0,
        message: error instanceof Error ? error.message : "Unknown error",
        elapsedMs: Date.now() - startTime,
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

  /**
   * Parse text with streaming
   */
  async parseTextWithStreaming(
    text: string,
    options: StreamingParseOptions
  ): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isMessyData: options.isMessyData ?? this.looksMessy(text),
        isPastedText: options.isPastedText ?? true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });

      options.onProgress?.({
        stage: "connecting",
        percent: 5,
        partsFound: 0,
        charsReceived: 0,
        message: "Connecting to AI...",
        elapsedMs: Date.now() - startTime,
      });

      const stream = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}\n\nRespond with JSON only.`,
          },
        ],
      });

      let fullResponse = "";
      let partsDetected = 0;
      let lastReportedParts = 0;

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          
          const partMatches = fullResponse.match(/"row"\s*:/g) || 
                              fullResponse.match(/\{\s*"(?:row|label|length)"/g);
          partsDetected = partMatches?.length || 0;
          
          if (partsDetected > lastReportedParts) {
            lastReportedParts = partsDetected;
            
            options.onProgress?.({
              stage: "receiving",
              percent: Math.min(20 + partsDetected * 5, 80),
              partsFound: partsDetected,
              charsReceived: fullResponse.length,
              message: `Found ${partsDetected} part${partsDetected !== 1 ? "s" : ""}...`,
              elapsedMs: Date.now() - startTime,
            });

            options.onPartFound?.(partsDetected - 1, `Part ${partsDetected}`);
          }
        }
      }

      options.onProgress?.({
        stage: "parsing",
        percent: 90,
        partsFound: partsDetected,
        charsReceived: fullResponse.length,
        message: "Processing extracted data...",
        elapsedMs: Date.now() - startTime,
      });

      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(fullResponse);
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse: fullResponse,
          errors: ["Failed to parse AI response as valid parts array"],
          processingTime: Date.now() - startTime,
        };
      }

      const result = this.processResults(parts, fullResponse, startTime, options);

      options.onProgress?.({
        stage: "complete",
        percent: 100,
        partsFound: result.parts.length,
        charsReceived: fullResponse.length,
        message: `Complete! Found ${result.parts.length} parts`,
        elapsedMs: Date.now() - startTime,
      });

      return result;
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
        processingTime: Date.now() - startTime,
      };
    }
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
        message: "Sending to Claude Vision...",
      });

      // Build OCR-optimized prompt
      const ocrPrompt = this.buildOCRPrompt(options);

      // Convert to base64 if needed
      let base64Data: string;
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      
      if (typeof imageData === "string") {
        const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          mediaType = match[1] as typeof mediaType;
          base64Data = match[2];
        } else {
          base64Data = imageData;
        }
      } else {
        base64Data = Buffer.from(imageData).toString("base64");
      }

      options.onProgress?.({
        stage: "extracting",
        percent: 30,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Extracting text and parts...",
      });

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `${ocrPrompt}\n\nRespond with JSON only.`,
              },
            ],
          },
        ],
      });

      options.onProgress?.({
        stage: "parsing",
        percent: 70,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Processing extracted data...",
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
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
      } | AIPartResponse[]>(rawResponse);
      
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
        previousContext: extractedText.slice(-500),
        onProgress: undefined,
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

    if (options.learningContext?.clientTemplate) {
      const template = options.learningContext.clientTemplate;
      prompt += `\n\nCLIENT TEMPLATE DETECTED: "${template.clientName}"
Expected column order: ${template.columnOrder.join(", ")}
Edge notation: ${JSON.stringify(template.edgeNotation || {})}
Default material: ${template.defaultMaterialId || "unknown"}`;
    }

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

    for (const aiPart of aiParts) {
      const validationErrors = validateAIPartResponse(aiPart);
      
      if (validationErrors.length > 0 && !aiPart.length && !aiPart.width) {
        errors.push(`Skipped part "${aiPart.label || "unknown"}": ${validationErrors.join(", ")}`);
        continue;
      }

      // Use dimensions as-is - L represents grain direction in cabinet context
      // (may be smaller than W for grain-sensitive parts)
      const L = aiPart.length || 0;
      const W = aiPart.width || 0;

      const cutPart: CutPart = {
        part_id: generateId("P"),
        label: aiPart.label || undefined,
        qty: aiPart.quantity || 1,
        size: { L, W },
        thickness_mm: aiPart.thickness || options.defaultThicknessMm || 18,
        material_id: this.mapMaterialToId(aiPart.material) || options.defaultMaterialId || "MAT-WHITE-18",
        grain: aiPart.grain === "along_L" ? "along_L" : "none",
        allow_rotation: aiPart.allowRotation !== false && aiPart.grain !== "along_L",
        notes: aiPart.notes ? { operator: aiPart.notes } : undefined,
        audit: {
          source_method: "api",
          confidence: aiPart.confidence || 0.8,
          human_verified: false,
        },
      };

      // Add edge banding operations if detected
      if (aiPart.edgeBanding?.detected && aiPart.edgeBanding.edges) {
        cutPart.ops = {
          edging: {
            edges: aiPart.edgeBanding.edges.reduce((acc, edge) => {
              if (["L1", "L2", "W1", "W2"].includes(edge)) {
                acc[edge] = { apply: true };
              }
              return acc;
            }, {} as Record<string, { apply: boolean }>),
          },
        };
      }

      parts.push({
        part: cutPart,
        confidence: aiPart.confidence || 0.8,
        extractedMetadata: {
          grooving: aiPart.grooving,
          edgeBanding: aiPart.edgeBanding,
          cncOperations: aiPart.cncOperations,
        },
        warnings: [
          ...validationErrors,
          ...(aiPart.warnings || []),
        ],
        originalText: aiPart.label,
      });
    }

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
    const lines = text.split("\n").filter(l => l.trim());
    
    if (lines.length < 3 && text.length < 100) return true;
    
    const hasDimensions = /\d+\s*[x×X]\s*\d+/.test(text);
    if (!hasDimensions) return true;
    
    if (/\b(please|can you|I need|want|like|same as)\b/i.test(text)) return true;
    
    return false;
  }

  private mapMaterialToId(materialName?: string): string | undefined {
    if (!materialName) return undefined;
    
    const lower = materialName.toLowerCase();
    
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
}

