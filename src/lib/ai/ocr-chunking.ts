/**
 * CAI Intake - Smart Document Chunking
 * 
 * Intelligent chunking for large documents (150+ parts).
 * Only chunks when it will improve OCR accuracy.
 */

import { logger } from "@/lib/logger";
import type { CutPart } from "@/lib/schema";
import { detectTruncation, recoverFromTruncation } from "./ocr-utils";
import { PART_COUNT_ESTIMATION_PROMPT, parsePartCountEstimate } from "./ocr-utils";

// ============================================================
// TYPES
// ============================================================

export interface ChunkingDecision {
  shouldChunk: boolean;
  reason: string;
  strategy: "single-pass" | "multi-pass" | "sections";
  estimatedParts: number;
  sections?: string[];
}

export interface ChunkResult {
  chunkIndex: number;
  totalChunks: number;
  section?: string;
  parts: CutPart[];
  startRow?: number;
  endRow?: number;
}

export interface MergedResult {
  parts: CutPart[];
  totalFromChunks: number;
  duplicatesRemoved: number;
  sectionsProcessed: string[];
}

// ============================================================
// CHUNKING THRESHOLDS
// ============================================================

/**
 * Configuration for chunking decisions.
 */
export const CHUNKING_CONFIG = {
  // Minimum parts before considering chunking
  MIN_PARTS_FOR_CHUNKING: 80,
  
  // Strong recommendation to chunk
  STRONG_CHUNK_THRESHOLD: 150,
  
  // Maximum parts per chunk (to fit in token limits)
  MAX_PARTS_PER_CHUNK: 75,
  
  // Minimum confidence to trust single-pass
  MIN_SINGLE_PASS_CONFIDENCE: 0.85,
  
  // Token limits (each part is ~100-150 tokens)
  TOKENS_PER_PART: 125,
  MAX_OUTPUT_TOKENS: 16000,
};

// ============================================================
// CHUNKING DECISION
// ============================================================

/**
 * Decide whether to chunk a document based on estimated size.
 * 
 * @param estimatedParts - Estimated number of parts in the document
 * @param previousAttempt - Result from a previous single-pass attempt
 */
export function shouldChunkDocument(
  estimatedParts: number,
  previousAttempt?: { 
    partsExtracted: number;
    truncated: boolean;
    avgConfidence: number;
  }
): ChunkingDecision {
  
  // Case 1: Previous attempt was truncated - definitely chunk
  if (previousAttempt?.truncated) {
    return {
      shouldChunk: true,
      reason: `Previous extraction was truncated (got ${previousAttempt.partsExtracted} parts)`,
      strategy: "multi-pass",
      estimatedParts,
    };
  }
  
  // Case 2: Small document - no need to chunk
  if (estimatedParts < CHUNKING_CONFIG.MIN_PARTS_FOR_CHUNKING) {
    return {
      shouldChunk: false,
      reason: `Document has ~${estimatedParts} parts (below threshold of ${CHUNKING_CONFIG.MIN_PARTS_FOR_CHUNKING})`,
      strategy: "single-pass",
      estimatedParts,
    };
  }
  
  // Case 3: Medium document - chunk if previous confidence was low
  if (estimatedParts < CHUNKING_CONFIG.STRONG_CHUNK_THRESHOLD) {
    if (previousAttempt && previousAttempt.avgConfidence < CHUNKING_CONFIG.MIN_SINGLE_PASS_CONFIDENCE) {
      return {
        shouldChunk: true,
        reason: `Medium document (${estimatedParts} parts) with low confidence (${Math.round(previousAttempt.avgConfidence * 100)}%)`,
        strategy: "multi-pass",
        estimatedParts,
      };
    }
    
    return {
      shouldChunk: false,
      reason: `Medium document (${estimatedParts} parts) - trying single-pass first`,
      strategy: "single-pass",
      estimatedParts,
    };
  }
  
  // Case 4: Large document - definitely chunk
  return {
    shouldChunk: true,
    reason: `Large document with ~${estimatedParts} parts (above threshold of ${CHUNKING_CONFIG.STRONG_CHUNK_THRESHOLD})`,
    strategy: estimatedParts > 200 ? "sections" : "multi-pass",
    estimatedParts,
  };
}

// ============================================================
// CHUNKING PROMPTS
// ============================================================

/**
 * Generate a prompt for extracting a specific chunk.
 */
export function generateChunkPrompt(
  chunkIndex: number,
  totalChunks: number,
  startRow: number,
  endRow: number
): string {
  return `
IMPORTANT: You are extracting chunk ${chunkIndex + 1} of ${totalChunks}.

Focus ONLY on items numbered ${startRow} through ${endRow}.
Do NOT include items from other sections or number ranges.

For this chunk, extract:
- Items with row numbers ${startRow} to ${endRow}
- Or items in the corresponding visual section if not numbered

Start your response with the parts array for this chunk only.
`.trim();
}

/**
 * Generate a prompt for extracting a specific section.
 */
export function generateSectionPrompt(sectionName: string): string {
  return `
IMPORTANT: Extract ONLY parts from the "${sectionName}" section.

Look for a section header containing "${sectionName}" and extract all items under that header.
Stop when you reach the next section header or the end of that section.

Do NOT include parts from other sections.
`.trim();
}

// ============================================================
// CHUNK MERGING
// ============================================================

/**
 * Merge parts from multiple chunks, removing duplicates.
 */
export function mergeChunkResults(chunks: ChunkResult[]): MergedResult {
  const allParts: CutPart[] = [];
  const seenKeys = new Set<string>();
  let duplicatesRemoved = 0;
  const sectionsProcessed: string[] = [];
  
  // Sort chunks by index
  const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  for (const chunk of sortedChunks) {
    if (chunk.section) {
      sectionsProcessed.push(chunk.section);
    }
    
    for (const part of chunk.parts) {
      // Create a unique key for deduplication
      const key = createPartKey(part);
      
      if (seenKeys.has(key)) {
        duplicatesRemoved++;
        logger.debug("🔄 [Merge] Duplicate part skipped", {
          key,
          chunkIndex: chunk.chunkIndex,
        });
        continue;
      }
      
      seenKeys.add(key);
      allParts.push(part);
    }
  }
  
  // Renumber parts sequentially
  for (let i = 0; i < allParts.length; i++) {
    allParts[i].row = i + 1;
  }
  
  logger.info("✅ [Merge] Chunk results merged", {
    chunksProcessed: chunks.length,
    totalParts: allParts.length,
    duplicatesRemoved,
    sectionsProcessed,
  });
  
  return {
    parts: allParts,
    totalFromChunks: chunks.reduce((sum, c) => sum + c.parts.length, 0),
    duplicatesRemoved,
    sectionsProcessed,
  };
}

/**
 * Create a unique key for a part (for deduplication).
 */
function createPartKey(part: CutPart): string {
  // Use dimensions, quantity, and material as the key
  // This catches duplicates even if label/row differs
  return `${part.length}x${part.width}x${part.thickness || 18}_q${part.quantity || 1}_${part.material || ""}`.toLowerCase();
}

// ============================================================
// ADAPTIVE CHUNKING
// ============================================================

/**
 * Calculate optimal chunk boundaries based on estimated parts.
 */
export function calculateChunkBoundaries(
  estimatedParts: number
): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  const partsPerChunk = CHUNKING_CONFIG.MAX_PARTS_PER_CHUNK;
  
  let current = 1;
  while (current <= estimatedParts) {
    const end = Math.min(current + partsPerChunk - 1, estimatedParts);
    chunks.push({ start: current, end });
    current = end + 1;
  }
  
  return chunks;
}

/**
 * Adaptive chunking that retries with smaller chunks if needed.
 */
export interface AdaptiveChunkingResult {
  success: boolean;
  parts: CutPart[];
  strategy: string;
  chunksUsed: number;
  totalAttempts: number;
}

export async function extractWithAdaptiveChunking<T>(
  estimatedParts: number,
  extractFn: (prompt: string) => Promise<{ parts: CutPart[]; truncated: boolean }>,
  basePrompt: string
): Promise<AdaptiveChunkingResult> {
  let attempts = 0;
  const maxAttempts = 10;
  
  // Try single-pass first for smaller documents
  if (estimatedParts < CHUNKING_CONFIG.MIN_PARTS_FOR_CHUNKING) {
    attempts++;
    const result = await extractFn(basePrompt);
    
    if (!result.truncated) {
      return {
        success: true,
        parts: result.parts,
        strategy: "single-pass",
        chunksUsed: 1,
        totalAttempts: attempts,
      };
    }
  }
  
  // Calculate chunk boundaries
  const boundaries = calculateChunkBoundaries(estimatedParts);
  const chunkResults: ChunkResult[] = [];
  
  logger.info("📦 [Chunking] Starting chunked extraction", {
    estimatedParts,
    chunkCount: boundaries.length,
    boundaries,
  });
  
  for (const [index, { start, end }] of boundaries.entries()) {
    if (attempts >= maxAttempts) {
      logger.warn("⚠️ [Chunking] Max attempts reached", { attempts });
      break;
    }
    
    attempts++;
    const chunkPrompt = `${basePrompt}\n\n${generateChunkPrompt(index, boundaries.length, start, end)}`;
    
    try {
      const result = await extractFn(chunkPrompt);
      
      chunkResults.push({
        chunkIndex: index,
        totalChunks: boundaries.length,
        parts: result.parts,
        startRow: start,
        endRow: end,
      });
      
      logger.debug("✅ [Chunking] Chunk extracted", {
        chunkIndex: index,
        range: `${start}-${end}`,
        partsFound: result.parts.length,
        truncated: result.truncated,
      });
      
      // If this chunk was truncated, we might need smaller chunks
      // But for now, continue to next chunk
      
    } catch (error) {
      logger.error("❌ [Chunking] Chunk extraction failed", {
        chunkIndex: index,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  
  // Merge all chunks
  const merged = mergeChunkResults(chunkResults);
  
  return {
    success: chunkResults.length > 0,
    parts: merged.parts,
    strategy: `chunked-${boundaries.length}`,
    chunksUsed: chunkResults.length,
    totalAttempts: attempts,
  };
}

// ============================================================
// SECTION-BASED EXTRACTION
// ============================================================

/**
 * Extract parts by detecting and processing sections separately.
 */
export interface SectionExtractionResult {
  success: boolean;
  parts: CutPart[];
  sections: string[];
  partsPerSection: Record<string, number>;
}

export async function extractBySections(
  sections: string[],
  extractFn: (sectionPrompt: string) => Promise<CutPart[]>,
  basePrompt: string
): Promise<SectionExtractionResult> {
  const chunkResults: ChunkResult[] = [];
  const partsPerSection: Record<string, number> = {};
  
  logger.info("📑 [Sections] Starting section-based extraction", {
    sectionCount: sections.length,
    sections,
  });
  
  for (const [index, section] of sections.entries()) {
    try {
      const sectionPrompt = `${basePrompt}\n\n${generateSectionPrompt(section)}`;
      const parts = await extractFn(sectionPrompt);
      
      partsPerSection[section] = parts.length;
      
      chunkResults.push({
        chunkIndex: index,
        totalChunks: sections.length,
        section,
        parts,
      });
      
      logger.debug("✅ [Sections] Section extracted", {
        section,
        partsFound: parts.length,
      });
      
    } catch (error) {
      logger.error("❌ [Sections] Section extraction failed", {
        section,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      partsPerSection[section] = 0;
    }
  }
  
  const merged = mergeChunkResults(chunkResults);
  
  return {
    success: merged.parts.length > 0,
    parts: merged.parts,
    sections: merged.sectionsProcessed,
    partsPerSection,
  };
}

