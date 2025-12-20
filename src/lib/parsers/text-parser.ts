/**
 * CAI Intake - Text Parser
 * 
 * Parses free-form text input into canonical CutPart objects.
 * Handles manual entry field input, copy-paste text, and voice transcripts.
 */

import { CutPart, GrainMode, IngestionMethod } from "../schema";
import { generateId, parseNumber } from "../utils";
import { DEFAULTS } from "../constants";
import {
  DIMENSION_PATTERNS as PARSER_DIM_PATTERNS,
  QUANTITY_PATTERNS as PARSER_QTY_PATTERNS,
  THICKNESS_PATTERNS,
  GRAIN_PATTERNS as PARSER_GRAIN_PATTERNS,
  MATERIAL_KEYWORDS,
} from "../parser/parser-patterns";
import {
  normalizeText,
  findMaterialMatch,
  parseEdges,
  type EdgeId,
} from "../parser/parser-utils";

/**
 * Parse options for text parsing
 */
export interface TextParseOptions {
  /** Default thickness if not specified */
  defaultThicknessMm?: number;
  /** Default material ID if not specified */
  defaultMaterialId?: string;
  /** How to interpret dimension order */
  dimOrderHint?: "LxW" | "WxL" | "infer";
  /** Units for dimensions */
  units?: "mm" | "cm" | "inch";
  /** Source method for audit */
  sourceMethod?: IngestionMethod;
  /** Minimum confidence for auto-accept */
  minConfidence?: number;
}

/**
 * Parse result for a single part
 */
export interface TextParseResult {
  part: CutPart;
  confidence: number;
  warnings: string[];
  errors: string[];
  originalText: string;
}

/**
 * Batch parse result
 */
export interface TextBatchParseResult {
  parts: TextParseResult[];
  totalParsed: number;
  totalErrors: number;
  averageConfidence: number;
}

// Regex patterns for dimension extraction
const DIMENSION_PATTERNS = [
  // "720x560" or "720 x 560" or "720×560"
  /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/,
  // "720 by 560"
  /(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/i,
  // "720mm x 560mm"
  /(\d+(?:\.\d+)?)\s*mm?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*mm?/i,
  // "L720 W560" or "L:720 W:560"
  /L[:\s]*(\d+(?:\.\d+)?)\s*W[:\s]*(\d+(?:\.\d+)?)/i,
  // Include patterns from parser module
  ...PARSER_DIM_PATTERNS,
];

// Quantity patterns
const QUANTITY_PATTERNS = [
  // "qty 2" or "qty:2" or "quantity 2"
  /(?:qty|quantity)[:\s]*(\d+)/i,
  // "x2" or "×2" (at end)
  /[x×]\s*(\d+)\s*$/i,
  // "2pcs" or "2 pcs" or "2 pieces"
  /(\d+)\s*(?:pcs?|pieces?)/i,
  // "2x" at start
  /^(\d+)\s*[x×]\s/i,
  // "q2" shorthand
  /\bq(\d+)\b/i,
  // Include patterns from parser module
  ...PARSER_QTY_PATTERNS,
];

// Grain patterns - indicates part should NOT rotate
const GRAIN_PATTERNS = [
  /\bgrain(?:ed)?\s*(?:along\s*)?(?:length|L)\b/i,
  /\balong\s*(?:the\s*)?grain\b/i,
  /\bwith\s*grain\b/i,
  /\bGL\b/, // "GL" = Grain Length
  /\bGW\b/, // "GW" = Grain Width
  /\bno\s*rotat(?:e|ion)\b/i,
  /\bfixed\b/i,
  /\blocked\b/i,
];

// No grain / allow rotation patterns
const NO_GRAIN_PATTERNS = [
  /\bno\s*grain\b/i,
  /\bcan\s*rotate\b/i,
  /\brotate\s*(?:ok|yes|true)\b/i,
  /\bfree\b/i,
];

// Label extraction (before dimensions typically)
const LABEL_PATTERNS = [
  // "Side panel:" or "Side panel -"
  /^([A-Za-z][A-Za-z\s]{1,30})[\s:,-]+(?=\d)/,
  // Quoted labels
  /"([^"]+)"|'([^']+)'/,
];

/**
 * Convert units to mm
 */
function toMm(value: number, units: "mm" | "cm" | "inch"): number {
  switch (units) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "inch":
      return value * 25.4;
  }
}

/**
 * Extract dimensions from text
 */
function extractDimensions(
  text: string,
  options: TextParseOptions
): { L: number; W: number; confidence: number } | null {
  for (const pattern of DIMENSION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const d1 = parseNumber(match[1]);
      const d2 = parseNumber(match[2]);
      
      if (d1 && d2) {
        const units = options.units ?? "mm";
        let L = toMm(d1, units);
        let W = toMm(d2, units);
        
        // Apply dimension order hint
        if (options.dimOrderHint === "WxL") {
          [L, W] = [W, L];
        } else if (options.dimOrderHint === "infer") {
          // Assume larger dimension is L (common convention)
          if (W > L) {
            [L, W] = [W, L];
          }
        }
        
        return { L, W, confidence: 0.95 };
      }
    }
  }
  return null;
}

/**
 * Extract quantity from text
 */
function extractQuantity(text: string): { qty: number; confidence: number } {
  for (const pattern of QUANTITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const qty = parseNumber(match[1]);
      if (qty && qty > 0 && qty <= 1000) {
        return { qty, confidence: 0.9 };
      }
    }
  }
  // Default to 1 with lower confidence
  return { qty: 1, confidence: 0.6 };
}

/**
 * Extract grain mode and rotation setting from text
 */
function extractGrain(text: string): { grain: GrainMode; allowRotation: boolean; confidence: number } {
  // Check for explicit grain direction
  for (const pattern of GRAIN_PATTERNS) {
    if (pattern.test(text)) {
      // GL or grain length specified - no rotation
      if (/\bGL\b/i.test(text) || /length/i.test(text)) {
        return { grain: "along_L", allowRotation: false, confidence: 0.85 };
      }
      // GW or grain width specified - treat same as along_L (no rotation)
      if (/\bGW\b/i.test(text) || /width/i.test(text)) {
        return { grain: "along_L", allowRotation: false, confidence: 0.85 };
      }
      // Generic grain mention - assume along length
      return { grain: "along_L", allowRotation: false, confidence: 0.75 };
    }
  }
  
  // Check for explicit "no grain" or "can rotate"
  for (const pattern of NO_GRAIN_PATTERNS) {
    if (pattern.test(text)) {
      return { grain: "none", allowRotation: true, confidence: 0.85 };
    }
  }
  
  // Default to no grain, allow rotation
  return { grain: "none", allowRotation: true, confidence: 0.5 };
}

/**
 * Extract label from text
 */
function extractLabel(text: string): string | undefined {
  for (const pattern of LABEL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] || match[2])?.trim();
    }
  }
  return undefined;
}

/**
 * Extract material hint from text
 */
function extractMaterialHint(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  // Try to find a matching material from keywords
  const materialMatch = findMaterialMatch(lowerText, MATERIAL_KEYWORDS);
  if (materialMatch) {
    return materialMatch;
  }
  
  // Fallback to common material keywords
  const materialPatterns: Array<{ pattern: RegExp; hint: string }> = [
    { pattern: /\bwhite\s*(?:board|mel|melamine)?\b/i, hint: "white" },
    { pattern: /\b18\s*mm?\b/i, hint: "18mm" },
    { pattern: /\b16\s*mm?\b/i, hint: "16mm" },
    { pattern: /\bmdf\b/i, hint: "MDF" },
    { pattern: /\bply(?:wood)?\b/i, hint: "PLY" },
    { pattern: /\bpb\b|\bparticle\s*board\b/i, hint: "PB" },
  ];
  
  const hints: string[] = [];
  for (const { pattern, hint } of materialPatterns) {
    if (pattern.test(lowerText)) {
      hints.push(hint);
    }
  }
  
  return hints.length > 0 ? hints.join(" ") : undefined;
}

/**
 * Extract thickness from text
 */
function extractThickness(text: string): number | undefined {
  for (const pattern of THICKNESS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const thickness = parseFloat(match[1]);
      // Reasonable thickness range: 3mm to 100mm
      if (thickness >= 3 && thickness <= 100) {
        return thickness;
      }
    }
  }
  return undefined;
}

/**
 * Extract edge banding from text
 */
function extractEdgeBanding(text: string): EdgeId[] {
  return parseEdges(text);
}

/**
 * Parse a single line of text into a CutPart
 */
export function parseTextLine(
  text: string,
  options: TextParseOptions = {}
): TextParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let overallConfidence = 1.0;
  
  // Clean up the text
  const cleanText = text.trim().replace(/\s+/g, " ");
  
  if (!cleanText) {
    errors.push("Empty input");
    return {
      part: createEmptyPart(options),
      confidence: 0,
      warnings,
      errors,
      originalText: text,
    };
  }
  
  // Extract dimensions
  const dims = extractDimensions(cleanText, options);
  if (!dims) {
    errors.push("Could not extract dimensions (expected format: LxW, e.g., 720x560)");
    return {
      part: createEmptyPart(options),
      confidence: 0,
      warnings,
      errors,
      originalText: text,
    };
  }
  overallConfidence *= dims.confidence;
  
  // Extract quantity
  const { qty, confidence: qtyConf } = extractQuantity(cleanText);
  overallConfidence *= qtyConf;
  if (qtyConf < 0.7) {
    warnings.push("Quantity not specified, defaulting to 1");
  }
  
  // Extract grain and rotation
  const { grain, allowRotation, confidence: grainConf } = extractGrain(cleanText);
  if (grainConf < 0.7) {
    // Don't reduce confidence much for grain - it's optional
    overallConfidence *= 0.95;
  }
  
  // Extract label
  const label = extractLabel(cleanText);
  
  // Extract material hint
  const materialHint = extractMaterialHint(cleanText);
  
  // Extract thickness (if specified in text)
  const parsedThickness = extractThickness(cleanText);
  
  // Extract edge banding
  const edges = extractEdgeBanding(cleanText);
  
  // Build the part
  const part: CutPart = {
    part_id: generateId("P"),
    label,
    qty,
    size: { L: dims.L, W: dims.W },
    thickness_mm: parsedThickness ?? options.defaultThicknessMm ?? DEFAULTS.THICKNESS_MM,
    material_id: options.defaultMaterialId ?? "default",
    grain,
    allow_rotation: allowRotation,
    audit: {
      source_method: options.sourceMethod ?? "paste_parser",
      parsed_text_snippet: cleanText.substring(0, 100),
      confidence: overallConfidence,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
      human_verified: false,
    },
  };
  
  // Add material hint as a tag if found
  if (materialHint) {
    part.tags = [materialHint];
  }
  
  // Add edge banding if found
  if (edges.length > 0) {
    part.ops = {
      edging: {
        edges: edges.reduce((acc, edge) => {
          acc[edge] = { apply: true, edgeband_id: "EB-WHITE-0.8" };
          return acc;
        }, {} as Record<string, { apply: boolean; edgeband_id?: string }>),
      },
    };
  }
  
  return {
    part,
    confidence: overallConfidence,
    warnings,
    errors,
    originalText: text,
  };
}

/**
 * Create an empty part (for error cases)
 */
function createEmptyPart(options: TextParseOptions): CutPart {
  return {
    part_id: generateId("P"),
    qty: 1,
    size: { L: 0, W: 0 },
    thickness_mm: options.defaultThicknessMm ?? DEFAULTS.THICKNESS_MM,
    material_id: options.defaultMaterialId ?? "default",
    grain: "none",
    allow_rotation: true,
    audit: {
      source_method: options.sourceMethod ?? "paste_parser",
      confidence: 0,
      human_verified: false,
    },
  };
}

/**
 * Parse multiple lines of text
 */
export function parseTextBatch(
  text: string,
  options: TextParseOptions = {}
): TextBatchParseResult {
  // Split by newlines, semicolons, or pipes
  const lines = text
    .split(/[\n;|]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  
  const results: TextParseResult[] = [];
  let totalConfidence = 0;
  let errorCount = 0;
  
  for (const line of lines) {
    const result = parseTextLine(line, options);
    results.push(result);
    totalConfidence += result.confidence;
    if (result.errors.length > 0) {
      errorCount++;
    }
  }
  
  return {
    parts: results,
    totalParsed: results.length,
    totalErrors: errorCount,
    averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
  };
}

/**
 * Quick parse for manual entry field
 * Returns a single part or null if parsing fails
 */
export function quickParse(
  text: string,
  options: TextParseOptions = {}
): CutPart | null {
  const result = parseTextLine(text, {
    ...options,
    sourceMethod: "manual",
  });
  
  if (result.errors.length > 0 || result.confidence < 0.5) {
    return null;
  }
  
  return result.part;
}

/**
 * Validate and suggest fixes for a parsed part
 */
export function validateParsedPart(
  part: CutPart
): { valid: boolean; suggestions: string[] } {
  const suggestions: string[] = [];
  let valid = true;
  
  // Check dimensions
  if (part.size.L <= 0 || part.size.W <= 0) {
    valid = false;
    suggestions.push("Dimensions must be positive numbers");
  }
  
  if (part.size.L > 3000 || part.size.W > 2000) {
    suggestions.push("Dimensions seem large - verify they are in mm");
  }
  
  // Check quantity
  if (part.qty <= 0) {
    valid = false;
    suggestions.push("Quantity must be at least 1");
  }
  
  // Check grain vs rotation
  if (part.grain === "along_L" && part.allow_rotation) {
    suggestions.push("Grained parts typically should not allow rotation");
  }
  
  return { valid, suggestions };
}

