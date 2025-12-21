/**
 * CAI Intake - Three-Layer Parser
 * 
 * Orchestrates the 3-layer parsing strategy:
 * 1. Deterministic (fastest) - for known structured formats
 * 2. Regex (fast) - for semi-structured text
 * 3. LLM (intelligent) - for free-form or messy data
 * 
 * Each layer tries to parse as much as possible, falling back to the next
 * layer only for rows/content that couldn't be parsed.
 */

import type { CutPart } from "@/lib/schema";
import { detectFormat, getParsingStrategy, type SourceFormatHint } from "./format-detector";
import { parseDeterministic, canParseDeterministically, type DeterministicParseResult } from "./deterministic-parser";
import { parseTextBatch as parseWithRegex, type TextBatchParseResult } from "@/lib/parsers/text-parser";
import { getOrCreateProvider, type AIParseResult } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

export interface ThreeLayerParseOptions {
  /** Format hint (auto-detected if not provided) */
  formatHint?: SourceFormatHint;
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness in mm */
  defaultThicknessMm?: number;
  /** Whether to use LLM for fallback */
  useLLMFallback?: boolean;
  /** Dimension order hint */
  dimOrderHint?: "LxW" | "WxL" | "infer";
  /** Units */
  units?: "mm" | "cm" | "inch";
}

export interface ThreeLayerParseResult {
  /** All parsed parts */
  parts: CutPart[];
  /** Statistics about parsing */
  stats: {
    totalLines: number;
    parsedDeterministic: number;
    parsedRegex: number;
    parsedLLM: number;
    failed: number;
    validCount: number;
    parseTimeMs: number;
  };
  /** Detected format */
  detectedFormat: SourceFormatHint;
  /** Layers used */
  layersUsed: ("deterministic" | "regex" | "llm")[];
  /** Average confidence */
  averageConfidence: number;
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
}

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Parse text using the 3-layer strategy
 */
export async function parseThreeLayers(
  text: string,
  options: ThreeLayerParseOptions = {}
): Promise<ThreeLayerParseResult> {
  const startTime = Date.now();
  const trimmed = text.trim();
  
  if (!trimmed) {
    return {
      parts: [],
      stats: {
        totalLines: 0,
        parsedDeterministic: 0,
        parsedRegex: 0,
        parsedLLM: 0,
        failed: 0,
        validCount: 0,
        parseTimeMs: 0,
      },
      detectedFormat: "auto",
      layersUsed: [],
      averageConfidence: 0,
      warnings: [],
      errors: ["Empty input"],
    };
  }
  
  // Detect format
  const formatResult = detectFormat(trimmed);
  const format = options.formatHint || formatResult.format;
  const recommendedStrategy = getParsingStrategy(format);
  
  const lines = trimmed.split("\n").filter(l => l.trim());
  const totalLines = lines.length;
  
  const allParts: CutPart[] = [];
  const layersUsed: ("deterministic" | "regex" | "llm")[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  let parsedDeterministic = 0;
  let parsedRegex = 0;
  let parsedLLM = 0;
  let remainingText = trimmed;
  let failedLines: string[] = [];
  
  // ============================================================
  // LAYER 1: Deterministic Parsing
  // ============================================================
  
  if (recommendedStrategy === "deterministic" || canParseDeterministically(trimmed)) {
    try {
      const deterministicResult = parseDeterministic(trimmed, {
        format,
        defaultMaterialId: options.defaultMaterialId,
        defaultThicknessMm: options.defaultThicknessMm,
      });
      
      if (deterministicResult.parts.length > 0) {
        allParts.push(...deterministicResult.parts);
        parsedDeterministic = deterministicResult.parts.length;
        layersUsed.push("deterministic");
        
        // Track failed rows for next layer
        failedLines = deterministicResult.failedRows.map(r => r.line);
        
        // If deterministic got most of it, we're done
        if (deterministicResult.skipOtherLayers) {
          return buildResult();
        }
        
        // Update remaining text for next layers
        remainingText = failedLines.join("\n");
      }
    } catch (error) {
      warnings.push(`Deterministic parsing error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
  
  // ============================================================
  // LAYER 2: Regex Parsing
  // ============================================================
  
  if (remainingText && (recommendedStrategy !== "llm" || !options.useLLMFallback)) {
    try {
      const regexResult: TextBatchParseResult = parseWithRegex(remainingText, {
        defaultMaterialId: options.defaultMaterialId,
        defaultThicknessMm: options.defaultThicknessMm,
        dimOrderHint: options.dimOrderHint,
        units: options.units,
        sourceMethod: "paste_parser",
      });
      
      // Add successfully parsed parts
      const successfulParts = regexResult.parts
        .filter(r => r.errors.length === 0)
        .map(r => r.part);
      
      if (successfulParts.length > 0) {
        allParts.push(...successfulParts);
        parsedRegex = successfulParts.length;
        layersUsed.push("regex");
      }
      
      // Track failed lines for LLM layer
      const failedFromRegex = regexResult.parts
        .filter(r => r.errors.length > 0)
        .map(r => r.originalText);
      
      failedLines = [...failedLines.filter(l => !successfulParts.some(p => p.audit?.source_ref?.includes(l.slice(0, 20)))), ...failedFromRegex];
      remainingText = failedLines.join("\n");
      
    } catch (error) {
      warnings.push(`Regex parsing error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
  
  // ============================================================
  // LAYER 3: LLM Parsing (if enabled and needed)
  // ============================================================
  
  if (remainingText && options.useLLMFallback && failedLines.length > 0) {
    try {
      const provider = await getOrCreateProvider();
      
      if (provider.isConfigured()) {
        const llmResult: AIParseResult = await provider.parseText(remainingText, {
          extractMetadata: true,
          confidence: "balanced",
          defaultMaterialId: options.defaultMaterialId,
          defaultThicknessMm: options.defaultThicknessMm,
        });
        
        if (llmResult.success && llmResult.parts.length > 0) {
          allParts.push(...llmResult.parts.map(r => r.part));
          parsedLLM = llmResult.parts.length;
          layersUsed.push("llm");
          
          // Clear failed lines for those parsed by LLM
          failedLines = [];
        }
      } else {
        warnings.push("LLM provider not configured - skipping AI parsing layer");
      }
    } catch (error) {
      logger.warn("LLM parsing layer failed", { error });
      warnings.push(`LLM parsing error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
  
  // ============================================================
  // Build Result
  // ============================================================
  
  function buildResult(): ThreeLayerParseResult {
    const parseTimeMs = Date.now() - startTime;
    const validCount = allParts.length;
    const failed = totalLines - validCount;
    
    // Calculate average confidence
    let confidenceSum = 0;
    for (const part of allParts) {
      confidenceSum += part.audit?.confidence ?? 0.8;
    }
    const averageConfidence = validCount > 0 ? confidenceSum / validCount : 0;
    
    return {
      parts: allParts,
      stats: {
        totalLines,
        parsedDeterministic,
        parsedRegex,
        parsedLLM,
        failed,
        validCount,
        parseTimeMs,
      },
      detectedFormat: format,
      layersUsed,
      averageConfidence,
      warnings,
      errors,
    };
  }
  
  return buildResult();
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Quick parse with auto-detection and all layers enabled
 */
export async function smartParse(
  text: string,
  options?: Omit<ThreeLayerParseOptions, "useLLMFallback">
): Promise<ThreeLayerParseResult> {
  return parseThreeLayers(text, {
    ...options,
    useLLMFallback: true,
  });
}

/**
 * Fast parse with deterministic and regex only (no LLM)
 */
export function fastParse(
  text: string,
  options?: Omit<ThreeLayerParseOptions, "useLLMFallback">
): Promise<ThreeLayerParseResult> {
  return parseThreeLayers(text, {
    ...options,
    useLLMFallback: false,
  });
}

