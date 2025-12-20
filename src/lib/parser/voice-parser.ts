/**
 * CAI Intake - Voice Parser
 * 
 * Parses spoken/dictated text into CutPart objects.
 * Handles spoken numbers, natural language patterns, and real-time parsing.
 */

import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import { NUMBER_WORDS } from "./parser-patterns";
import { normalizeText } from "./parser-utils";

// ============================================================
// TYPES
// ============================================================

export interface VoiceParseResult {
  part: CutPart | null;
  confidence: number;
  warnings: string[];
  errors: string[];
  originalText: string;
  normalizedText: string;
}

export interface VoiceParserOptions {
  defaultMaterialId?: string;
  defaultThickness?: number;
  continuousMode?: boolean;
  language?: string;
}

// ============================================================
// SPOKEN NUMBER PATTERNS
// ============================================================

// Extended number word mappings
const EXTENDED_NUMBER_WORDS: Record<string, number> = {
  ...NUMBER_WORDS,
  // Ordinals sometimes used
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  // Common mishearings
  to: 2,
  too: 2,
  for: 4,
  won: 1,
  ate: 8,
  sex: 6, // Common mishearing of "six"
};

// Dimension connectors
const DIMENSION_CONNECTORS = [
  /\bby\b/i,
  /\bx\b/i,
  /\btimes\b/i,
  /\bcross\b/i,
  /\bmultiplied\s*by\b/i,
];

// Quantity indicators
const QUANTITY_INDICATORS = [
  /\bquantity\s*(?:of\s*)?/i,
  /\bqty\s*(?:of\s*)?/i,
  /\b(\d+)\s*(?:pieces?|pcs?|off|units?)\b/i,
  /\bneed\s*(\d+)\b/i,
  /\bmake\s*(\d+)\b/i,
  /\bcut\s*(\d+)\b/i,
  /\btimes\s*(\d+)$/i,
];

// ============================================================
// NUMBER PARSING
// ============================================================

/**
 * Parse spoken numbers including compound forms
 * "seven hundred twenty" -> 720
 * "five sixty" -> 560
 * "one thousand two hundred" -> 1200
 */
export function parseSpokenNumber(text: string): number | null {
  const words = text.toLowerCase().trim().split(/[\s-]+/);
  
  // First try direct numeric
  const direct = parseFloat(text.replace(/,/g, "").replace(/\s/g, ""));
  if (!isNaN(direct) && direct > 0) return direct;
  
  // Handle compound numbers like "five sixty" (560)
  if (words.length === 2) {
    const first = EXTENDED_NUMBER_WORDS[words[0]];
    const second = EXTENDED_NUMBER_WORDS[words[1]];
    
    if (first !== undefined && second !== undefined) {
      // "five sixty" -> 560
      if (first < 10 && second >= 10 && second < 100) {
        return first * 100 + second;
      }
      // "twenty five" -> 25
      if (first >= 20 && first < 100 && second < 10) {
        return first + second;
      }
    }
  }
  
  // Standard spoken number parsing
  let result = 0;
  let current = 0;
  
  for (const word of words) {
    const value = EXTENDED_NUMBER_WORDS[word];
    
    if (value === undefined) {
      // Try extracting number from word (e.g., "720mm" -> 720)
      const numMatch = word.match(/^(\d+)/);
      if (numMatch) {
        current = parseInt(numMatch[1], 10);
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
 * "seven twenty by five sixty" -> { L: 720, W: 560 }
 * "720 by 560" -> { L: 720, W: 560 }
 */
export function parseSpokenDimensions(text: string): { L: number; W: number } | null {
  const normalizedText = normalizeText(text);
  
  // Try each connector pattern
  for (const connector of DIMENSION_CONNECTORS) {
    const match = normalizedText.split(connector);
    if (match.length === 2) {
      const L = parseSpokenNumber(match[0].trim());
      const W = parseSpokenNumber(match[1].trim());
      
      if (L !== null && W !== null && L > 0 && W > 0) {
        // Ensure L >= W (convention)
        return L >= W ? { L, W } : { L: W, W: L };
      }
    }
  }
  
  // Try pattern: "dimensions 720 560"
  const numMatches = normalizedText.match(/(\d+)\D+(\d+)/);
  if (numMatches) {
    const L = parseInt(numMatches[1], 10);
    const W = parseInt(numMatches[2], 10);
    if (L > 0 && W > 0) {
      return L >= W ? { L, W } : { L: W, W: L };
    }
  }
  
  return null;
}

/**
 * Parse quantity from spoken text
 */
export function parseSpokenQuantity(text: string): number | null {
  const normalizedText = normalizeText(text);
  
  for (const pattern of QUANTITY_INDICATORS) {
    const match = normalizedText.match(pattern);
    if (match) {
      const qty = match[1] ? parseInt(match[1], 10) : null;
      if (qty !== null && qty > 0 && qty < 10000) return qty;
    }
  }
  
  // Try spoken number at end
  const endMatch = normalizedText.match(/(\w+)\s*(?:pieces?|pcs?|off)?$/);
  if (endMatch) {
    const qty = parseSpokenNumber(endMatch[1]);
    if (qty !== null && qty > 0 && qty < 100) return qty;
  }
  
  return null;
}

// ============================================================
// VOICE PARSER
// ============================================================

/**
 * Parse voice/dictation input into a CutPart
 * 
 * Handles patterns like:
 * - "Side panel seven twenty by five sixty quantity two"
 * - "Top shelf 800 by 400 three pieces"
 * - "Drawer front 450 x 200 grain length"
 */
export function parseVoiceInput(
  text: string,
  options: VoiceParserOptions = {}
): VoiceParseResult {
  const normalizedText = normalizeText(text);
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence = 1.0;
  
  // Extract dimensions (required)
  const dimensions = parseSpokenDimensions(normalizedText);
  if (!dimensions) {
    errors.push("Could not understand dimensions");
    return {
      part: null,
      confidence: 0,
      warnings,
      errors,
      originalText: text,
      normalizedText,
    };
  }
  
  // Extract quantity
  const qty = parseSpokenQuantity(normalizedText) ?? 1;
  if (qty === 1 && !normalizedText.match(/\bone\b|\bsingle\b|\b1\b/)) {
    warnings.push("No quantity detected, defaulting to 1");
    confidence *= 0.9;
  }
  
  // Extract grain/rotation
  let grain = "none";
  let allowRotation = true;
  
  if (/\bgrain\s*(?:along\s*)?length\b/i.test(normalizedText) || /\bGL\b/.test(normalizedText)) {
    grain = "along_L";
    allowRotation = false;
  } else if (/\bgrain\s*(?:along\s*)?width\b/i.test(normalizedText) || /\bGW\b/.test(normalizedText)) {
    grain = "along_W";
    allowRotation = false;
  } else if (/\bno\s*rotat(?:e|ion)\b/i.test(normalizedText) || /\bfixed\b/i.test(normalizedText)) {
    allowRotation = false;
  }
  
  // Extract label (text before dimensions, cleaned)
  let label: string | undefined;
  const labelMatch = normalizedText.match(/^([a-zA-Z][a-zA-Z\s]{1,30})(?=\s*\d)/);
  if (labelMatch) {
    label = labelMatch[1].trim();
  }
  
  // Extract material hints
  let materialId = options.defaultMaterialId ?? "default";
  if (/\bwhite\b/i.test(normalizedText)) materialId = "white-melamine";
  else if (/\boak\b/i.test(normalizedText)) materialId = "oak";
  else if (/\bwalnut\b/i.test(normalizedText)) materialId = "walnut";
  else if (/\bmdf\b/i.test(normalizedText)) materialId = "mdf";
  else if (/\bply(?:wood)?\b/i.test(normalizedText)) materialId = "plywood";
  
  // Extract thickness
  let thickness = options.defaultThickness ?? 18;
  const thicknessMatch = normalizedText.match(/(\d+)\s*(?:mm|millimeter)/i);
  if (thicknessMatch) {
    const t = parseInt(thicknessMatch[1], 10);
    if (t >= 3 && t <= 100) thickness = t;
  }
  
  // Build part
  const part: CutPart = {
    part_id: generateId("P"),
    label,
    qty,
    size: dimensions,
    thickness_mm: thickness,
    material_id: materialId,
    grain: grain === "along_W" ? "along_L" : grain as "none" | "along_L",
    allow_rotation: allowRotation,
    audit: {
      source_method: "voice",
      parsed_text_snippet: normalizedText.substring(0, 100),
      confidence,
      human_verified: false,
    },
  };
  
  return {
    part,
    confidence,
    warnings,
    errors,
    originalText: text,
    normalizedText,
  };
}

/**
 * Process a stream of voice transcripts
 * Accumulates partial results and emits completed parts
 */
export class VoiceParserStream {
  private buffer: string = "";
  private options: VoiceParserOptions;
  private onPart: (result: VoiceParseResult) => void;
  
  constructor(
    options: VoiceParserOptions,
    onPart: (result: VoiceParseResult) => void
  ) {
    this.options = options;
    this.onPart = onPart;
  }
  
  /**
   * Add transcript text to the buffer
   */
  addTranscript(text: string, isFinal: boolean = false): void {
    this.buffer += " " + text;
    
    if (isFinal || this.buffer.length > 200) {
      this.processBuffer();
    }
  }
  
  /**
   * Process buffered text
   */
  private processBuffer(): void {
    const text = this.buffer.trim();
    if (!text) return;
    
    const result = parseVoiceInput(text, this.options);
    
    if (result.part) {
      this.onPart(result);
      this.buffer = "";
    }
  }
  
  /**
   * Force processing of remaining buffer
   */
  flush(): VoiceParseResult | null {
    const text = this.buffer.trim();
    this.buffer = "";
    
    if (!text) return null;
    
    return parseVoiceInput(text, this.options);
  }
  
  /**
   * Clear the buffer without processing
   */
  clear(): void {
    this.buffer = "";
  }
}

