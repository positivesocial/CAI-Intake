/**
 * CAI Intake - Voice Parser
 * 
 * Parses spoken/dictated text into CutPart objects.
 * Uses a SIMPLE, STRUCTURED format for high accuracy:
 * 
 * FORMAT: [QTY] [LENGTH] by [WIDTH] [OPERATIONS]
 * 
 * Examples:
 * - "2 720 by 560" → 2 pcs, 720×560mm
 * - "4 800 by 400 edges" → 4 pcs, 800×400, all edges banded
 * - "600 by 300 two long groove" → 1 pc, 600×300, L1+L2 banded, has groove
 * 
 * This structured format is much more accurate than natural language.
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
  /** Parsed operations for display */
  parsedOps?: {
    edges?: string[];
    groove?: boolean;
  };
}

export interface VoiceParserOptions {
  defaultMaterialId?: string;
  defaultThickness?: number;
  continuousMode?: boolean;
  language?: string;
}

// ============================================================
// VOICE FORMAT HELP (for UI display)
// ============================================================

export const VOICE_FORMAT_HELP = {
  format: "[QTY] [LENGTH] by [WIDTH] [OPERATIONS]",
  examples: [
    { spoken: "2 720 by 560", result: "2× 720×560mm" },
    { spoken: "800 by 400 edges", result: "1× 800×400mm, all edges" },
    { spoken: "4 600 by 300 two long", result: "4× 600×300mm, 2 long edges" },
    { spoken: "500 by 200 groove", result: "1× 500×200mm, has groove" },
    { spoken: "3 700 by 350 front edge white", result: "3× 700×350mm, front edge, white" },
  ],
  operations: {
    "edges/all": "All 4 edges banded",
    "two long/long edges": "Both long edges (L1, L2)",
    "two short/short edges": "Both short edges (W1, W2)",
    "front/one edge": "Front edge only (L1)",
    "three edges": "Three edges (L1, L2, W1)",
    "groove/grv": "Has groove on length",
    "white/ply/black/mdf": "Material type",
  },
  tips: [
    "Say 'next' between parts",
    "Speak numbers clearly: 'seven twenty' = 720",
    "Say 'done' when finished",
  ],
};

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
// EDGE BANDING PATTERNS (simple keywords)
// ============================================================

const EDGE_PATTERNS = {
  all: [/\ball\s*edges?\b/i, /\bedges\b/i, /\bfour\s*edges?\b/i, /\b4\s*edges?\b/i],
  twoLong: [/\btwo\s*long\b/i, /\blong\s*edges?\b/i, /\b2\s*long\b/i, /\bboth\s*long\b/i],
  twoShort: [/\btwo\s*short\b/i, /\bshort\s*edges?\b/i, /\b2\s*short\b/i, /\bboth\s*short\b/i],
  front: [/\bfront\s*edge?\b/i, /\bone\s*edge\b/i, /\b1\s*edge\b/i, /\bvisible\b/i],
  threeEdges: [/\bthree\s*edges?\b/i, /\b3\s*edges?\b/i],
};

const GROOVE_PATTERNS = [
  /\bgroove\b/i,
  /\bgrv\b/i,
  /\bback\s*panel\b/i,
  /\bback\s*groove\b/i,
  /\bdado\b/i,
];

// ============================================================
// VOICE PARSER
// ============================================================

/**
 * Parse voice/dictation input into a CutPart
 * 
 * SIMPLE FORMAT: [QTY] [LENGTH] by [WIDTH] [OPERATIONS]
 * 
 * Examples:
 * - "2 720 by 560" → 2 pcs, 720×560mm
 * - "800 by 400 edges" → 1 pc, 800×400, all edges
 * - "4 600 by 300 two long groove" → 4 pcs, 600×300, L1+L2, has groove
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
    errors.push("Could not understand dimensions. Say: '[LENGTH] by [WIDTH]'");
    return {
      part: null,
      confidence: 0,
      warnings,
      errors,
      originalText: text,
      normalizedText,
    };
  }
  
  // Extract quantity (look at start of phrase)
  let qty = 1;
  const qtyMatch = normalizedText.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i);
  if (qtyMatch) {
    const parsed = parseSpokenNumber(qtyMatch[1]);
    if (parsed && parsed >= 1 && parsed <= 500) {
      qty = parsed;
      confidence = 0.95;
    }
  }
  
  // Extract edge banding (simple keywords)
  const edgeBanding = {
    detected: false,
    L1: false,
    L2: false,
    W1: false,
    W2: false,
    edges: [] as string[],
    description: "",
  };
  
  // Check edge patterns in order of specificity
  if (EDGE_PATTERNS.all.some(p => p.test(normalizedText))) {
    edgeBanding.detected = true;
    edgeBanding.L1 = edgeBanding.L2 = edgeBanding.W1 = edgeBanding.W2 = true;
    edgeBanding.edges = ["L1", "L2", "W1", "W2"];
    edgeBanding.description = "all edges";
  } else if (EDGE_PATTERNS.twoLong.some(p => p.test(normalizedText))) {
    edgeBanding.detected = true;
    edgeBanding.L1 = edgeBanding.L2 = true;
    edgeBanding.edges = ["L1", "L2"];
    edgeBanding.description = "2 long edges";
  } else if (EDGE_PATTERNS.twoShort.some(p => p.test(normalizedText))) {
    edgeBanding.detected = true;
    edgeBanding.W1 = edgeBanding.W2 = true;
    edgeBanding.edges = ["W1", "W2"];
    edgeBanding.description = "2 short edges";
  } else if (EDGE_PATTERNS.threeEdges.some(p => p.test(normalizedText))) {
    edgeBanding.detected = true;
    edgeBanding.L1 = edgeBanding.L2 = edgeBanding.W1 = true;
    edgeBanding.edges = ["L1", "L2", "W1"];
    edgeBanding.description = "3 edges";
  } else if (EDGE_PATTERNS.front.some(p => p.test(normalizedText))) {
    edgeBanding.detected = true;
    edgeBanding.L1 = true;
    edgeBanding.edges = ["L1"];
    edgeBanding.description = "front edge";
  }
  
  // Extract grooving
  const grooving = {
    detected: false,
    GL: false,
    GW: false,
    description: "",
  };
  
  if (GROOVE_PATTERNS.some(p => p.test(normalizedText))) {
    grooving.detected = true;
    // Default to groove on length unless "width" is mentioned
    if (/\bwidth\b/i.test(normalizedText)) {
      grooving.GW = true;
      grooving.description = "groove on width";
    } else {
      grooving.GL = true;
      grooving.description = "groove on length";
    }
  }
  
  // Extract material (simple keywords)
  let materialCode = "";
  if (/\bwhite\b/i.test(normalizedText)) materialCode = "W";
  else if (/\bply(?:wood)?\b/i.test(normalizedText)) materialCode = "Ply";
  else if (/\bblack\b/i.test(normalizedText)) materialCode = "B";
  else if (/\bmdf\b/i.test(normalizedText)) materialCode = "M";
  else if (/\boak\b/i.test(normalizedText)) materialCode = "OAK";
  
  const materialId = materialCode || options.defaultMaterialId || "";
  
  // Extract thickness (if mentioned)
  let thickness = options.defaultThickness ?? 18;
  const thicknessMatch = normalizedText.match(/(\d+)\s*(?:mm|mil)/i);
  if (thicknessMatch) {
    const t = parseInt(thicknessMatch[1], 10);
    if (t >= 3 && t <= 50) thickness = t;
  }
  
  // Build part
  const part: CutPart = {
    part_id: generateId("P"),
    qty,
    size: dimensions,
    thickness_mm: thickness,
    material_id: materialId,
    grain: "none",
    allow_rotation: true,
    ops: edgeBanding.detected || grooving.detected ? {
      edging: edgeBanding.detected ? {
        edges: edgeBanding.edges.reduce((acc, e) => {
          acc[e] = { apply: true };
          return acc;
        }, {} as Record<string, { apply: boolean }>),
      } : undefined,
      grooves: grooving.detected ? [{
        side: grooving.GL ? "L1" as const : "W1" as const,
        offset_mm: 0, // Default to edge
        depth_mm: 8,
        width_mm: 4,
        notes: grooving.description,
      }] : undefined,
    } : undefined,
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
    parsedOps: {
      edges: edgeBanding.edges.length > 0 ? edgeBanding.edges : undefined,
      groove: grooving.detected,
    },
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

