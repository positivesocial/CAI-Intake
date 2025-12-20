/**
 * CAI Intake - Parser Utilities
 * 
 * Helper functions for text normalization, unit conversion, and parsing.
 */

import { NUMBER_WORDS } from "./parser-patterns";

// ============================================================
// TEXT NORMALIZATION
// ============================================================

/**
 * Normalize text for parsing:
 * - Trim whitespace
 * - Normalize unicode characters (× → x)
 * - Normalize quotes and dashes
 * - Convert to consistent case where appropriate
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    // Normalize multiplication signs
    .replace(/[×✕✖]/g, "x")
    // Normalize dashes
    .replace(/[–—]/g, "-")
    // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Normalize whitespace
    .replace(/\s+/g, " ");
}

/**
 * Split text into individual lines, handling various line endings
 */
export function splitLines(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// ============================================================
// UNIT CONVERSION
// ============================================================

/**
 * Convert a dimension value to millimeters
 */
export function toMillimeters(value: number, unit: string = "mm"): number {
  const unitLower = unit.toLowerCase();
  
  switch (unitLower) {
    case "mm":
    case "":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
    case "in":
    case "inch":
    case "inches":
    case '"':
      return value * 25.4;
    case "ft":
    case "feet":
    case "foot":
    case "'":
      return value * 304.8;
    default:
      return value; // Assume mm if unknown
  }
}

/**
 * Parse a dimension string that may include units
 * Returns value in millimeters
 */
export function parseDimensionValue(str: string): number {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|ft|feet|"|')?$/i);
  if (!match) return parseFloat(str) || 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || "mm";
  
  return toMillimeters(value, unit);
}

// ============================================================
// NUMBER PARSING
// ============================================================

/**
 * Parse a number that may be written as words
 * Handles: "seven twenty" → 720, "two" → 2, "1200" → 1200
 */
export function parseSpokenNumber(text: string): number | null {
  // First try direct numeric parsing
  const direct = parseFloat(text.replace(/,/g, ""));
  if (!isNaN(direct)) return direct;
  
  // Try parsing as words
  const words = text.toLowerCase().split(/[\s-]+/);
  let result = 0;
  let current = 0;
  
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    
    if (value === undefined) {
      // Try partial matches for compound numbers like "seventy"
      for (const [numWord, numValue] of Object.entries(NUMBER_WORDS)) {
        if (word.startsWith(numWord)) {
          current += numValue;
          break;
        }
      }
      continue;
    }
    
    if (value === 100) {
      current = current === 0 ? 100 : current * 100;
    } else if (value === 1000) {
      current = current === 0 ? 1000 : current * 1000;
      result += current;
      current = 0;
    } else {
      current += value;
    }
  }
  
  result += current;
  return result > 0 ? result : null;
}

/**
 * Parse dimensions from spoken text
 * Handles: "seven twenty by five sixty" → { L: 720, W: 560 }
 */
export function parseSpokenDimensions(text: string): { L: number; W: number } | null {
  // Split by "by" or "x"
  const parts = text.toLowerCase().split(/\s*(?:by|x|×)\s*/);
  
  if (parts.length !== 2) return null;
  
  const length = parseSpokenNumber(parts[0]);
  const width = parseSpokenNumber(parts[1]);
  
  if (length === null || width === null) return null;
  
  return { L: length, W: width };
}

// ============================================================
// LABEL CLEANING
// ============================================================

/**
 * Clean a label by removing parsed elements
 */
export function cleanLabel(text: string, patternsToRemove: RegExp[]): string {
  let cleaned = text;
  
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, " ");
  }
  
  // Clean up whitespace and punctuation
  cleaned = cleaned
    .replace(/^\s*[-–—:,;]+\s*/, "")
    .replace(/\s*[-–—:,;]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  
  return cleaned;
}

/**
 * Extract a likely label from the beginning of text
 * Labels typically come before dimensions
 */
export function extractLabel(text: string): string {
  // Find where dimensions start
  const dimMatch = text.match(/\d+(?:\.\d+)?\s*(?:mm|cm|in)?\s*[x×X]\s*\d+/);
  
  if (dimMatch && dimMatch.index !== undefined && dimMatch.index > 0) {
    return text.substring(0, dimMatch.index).trim();
  }
  
  return "";
}

// ============================================================
// EDGE PARSING
// ============================================================

export type EdgeId = "L1" | "L2" | "W1" | "W2";

/**
 * Parse edge specifications from text
 * Returns array of edges to band
 */
export function parseEdges(text: string): EdgeId[] {
  const edges: EdgeId[] = [];
  const upperText = text.toUpperCase();
  
  // Check for specific edge mentions
  if (/\bL1\b/.test(upperText)) edges.push("L1");
  if (/\bL2\b/.test(upperText)) edges.push("L2");
  if (/\bW1\b/.test(upperText)) edges.push("W1");
  if (/\bW2\b/.test(upperText)) edges.push("W2");
  
  // Check for "all edges" or "4 sides"
  if (/(?:all\s*(?:edges?|sides?)|4\s*(?:edges?|sides?))/i.test(text)) {
    return ["L1", "L2", "W1", "W2"];
  }
  
  // Check for "long edges"
  if (/long\s*(?:edges?|sides?)/i.test(text)) {
    if (!edges.includes("L1")) edges.push("L1");
    if (!edges.includes("L2")) edges.push("L2");
  }
  
  // Check for "short edges"
  if (/short\s*(?:edges?|sides?)/i.test(text)) {
    if (!edges.includes("W1")) edges.push("W1");
    if (!edges.includes("W2")) edges.push("W2");
  }
  
  return edges;
}

// ============================================================
// MATERIAL MATCHING
// ============================================================

/**
 * Find the best matching material ID from keywords in text
 */
export function findMaterialMatch(
  text: string,
  materialKeywords: Record<string, string[]>
): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [materialId, keywords] of Object.entries(materialKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return materialId;
      }
    }
  }
  
  return null;
}

// ============================================================
// CONFIDENCE SCORING
// ============================================================

/**
 * Calculate a confidence score for parsed data
 * Returns a value between 0 and 1
 */
export function calculateConfidence(parsed: {
  hasDimensions: boolean;
  hasQuantity: boolean;
  hasLabel: boolean;
  hasMaterial: boolean;
  hasThickness: boolean;
  dimensionsReasonable: boolean;
}): number {
  let score = 0;
  let maxScore = 0;
  
  // Dimensions are required and heavily weighted
  maxScore += 40;
  if (parsed.hasDimensions) {
    score += 30;
    if (parsed.dimensionsReasonable) score += 10;
  }
  
  // Quantity is common
  maxScore += 15;
  if (parsed.hasQuantity) score += 15;
  
  // Label is helpful
  maxScore += 20;
  if (parsed.hasLabel) score += 20;
  
  // Material is helpful
  maxScore += 15;
  if (parsed.hasMaterial) score += 15;
  
  // Thickness is helpful
  maxScore += 10;
  if (parsed.hasThickness) score += 10;
  
  return score / maxScore;
}

/**
 * Check if dimensions are reasonable for woodworking
 * Typical range: 10mm to 3000mm
 */
export function areDimensionsReasonable(L: number, W: number): boolean {
  const MIN = 10;
  const MAX = 5000;
  
  return (
    L >= MIN && L <= MAX &&
    W >= MIN && W <= MAX &&
    L > 0 && W > 0
  );
}

