/**
 * CAI Intake - Text Parser
 * 
 * Parses free-form text input into canonical CutPart objects.
 * Handles manual entry field input, copy-paste text, voice transcripts,
 * and TABULAR/SPREADSHEET data with column detection.
 * 
 * Now integrated with the canonical services module for:
 * - Edgebanding normalization
 * - Groove detection
 * - Drilling/hole patterns
 * - CNC operations
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
import type { LearningContext } from "../learning";
import {
  type OrgServiceDialect,
  type RawServiceFields,
  normalizeServices,
  extractRawFieldsFromText,
  getDefaultDialect,
  mergeWithDefaults,
} from "../services";

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
  /** Learning context for adaptive parsing */
  learningContext?: LearningContext;
  /** Organization service dialect for service normalization */
  orgDialect?: Partial<OrgServiceDialect>;
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

// Header row detection patterns
const HEADER_PATTERNS = [
  /\b(length|width|height|qty|quantity|pcs|pieces|description|component|part|label|name|l\s*\/?\s*h|w\s*\/?\s*b|edge|edging|groove|cnc)\b/i,
  /\bno\.?\s*$/i,
  /^#$/,
];

// Skip line patterns (headers, totals, etc.)
const SKIP_LINE_PATTERNS = [
  /^(no|#|item|component|description|part|label|length|width|qty|edge|total|sum|count)\s*$/i,
  /^\d+\s*$/,  // Just a number alone
  /^[-=_]+$/,  // Separator lines
  /^(client|job|date|board|material|edging|updated|revision)/i,
  /^\s*$/,     // Empty lines
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
 * Detect if a line looks like a header row
 */
function isHeaderLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  // Check if multiple header keywords appear
  let headerMatches = 0;
  for (const pattern of HEADER_PATTERNS) {
    if (pattern.test(lowerLine)) {
      headerMatches++;
    }
  }
  return headerMatches >= 2;
}

/**
 * Detect if a line should be skipped
 */
function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  
  for (const pattern of SKIP_LINE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Skip lines that are mostly non-alphanumeric
  const alphanumeric = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (alphanumeric.length < 2) return true;
  
  return false;
}

/**
 * Parse tabular/spreadsheet-style line
 * Handles tab or multi-space separated columns
 */
/**
 * Escape special regex characters for learning pattern matching
 */
function escapeRegexForLearning(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTabularLine(
  line: string,
  options: TextParseOptions
): { L: number; W: number; qty: number; label: string; edges: string[]; hasGroove: boolean; confidence: number; materialHint?: string } | null {
  // Split by tabs or 2+ spaces
  const parts = line.split(/\t|(?:\s{2,})/).map(p => p.trim()).filter(p => p);
  
  if (parts.length < 3) {
    // Try splitting by single spaces but be smarter about it
    const spaceParts = line.trim().split(/\s+/);
    if (spaceParts.length >= 3) {
      return parseSpaceSeparatedLine(spaceParts, options);
    }
    return null;
  }
  
  // Try to identify columns
  // Common patterns:
  // [No] [Label] [L] [W] [Qty] [Edge columns...]
  // [Label] [L] [W] [Qty] [Edge columns...]
  
  let label = "";
  let L = 0;
  let W = 0;
  let qty = 1;
  let edges: string[] = [];
  let hasGroove = false;
  let confidence = 0.8;
  let materialHint: string | undefined;
  
  // Find numeric columns (potential dimensions and qty)
  const numericIndices: number[] = [];
  const numericValues: number[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const num = parseFloat(parts[i].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      numericIndices.push(i);
      numericValues.push(num);
    }
  }
  
  if (numericValues.length < 2) {
    return null; // Need at least L and W
  }
  
  // Determine which numbers are L, W, Qty
  // Typically: larger numbers are dimensions, smaller numbers are qty
  // Look for patterns in the data
  
  // If first column is a small number (1-999), it's likely a row number
  const firstNum = numericValues[0];
  const isFirstRowNumber = firstNum < 1000 && Number.isInteger(firstNum) && numericIndices[0] === 0;
  
  let dimensionStartIndex = isFirstRowNumber ? 1 : 0;
  
  // Get the dimension candidates
  const dimCandidates = numericValues.slice(dimensionStartIndex);
  const dimIndices = numericIndices.slice(dimensionStartIndex);
  
  if (dimCandidates.length >= 2) {
    // First two large numbers are likely L and W
    // A dimension is typically > 50mm and < 3000mm
    const isDimension = (n: number) => n >= 50 && n <= 3000;
    
    let foundL = false;
    let foundW = false;
    
    for (let i = 0; i < dimCandidates.length && (!foundL || !foundW); i++) {
      const val = dimCandidates[i];
      if (isDimension(val)) {
        if (!foundL) {
          L = val;
          foundL = true;
        } else if (!foundW) {
          W = val;
          foundW = true;
        }
      } else if (foundL && foundW && val >= 1 && val <= 500) {
        // Likely quantity
        qty = Math.round(val);
      }
    }
    
    // If we didn't find valid dimensions using the range check,
    // just use the first two numbers as L and W
    if (!foundL || !foundW) {
      if (dimCandidates.length >= 2) {
        L = dimCandidates[0];
        W = dimCandidates[1];
        foundL = true;
        foundW = true;
        
        // Third number might be qty if it's small
        if (dimCandidates.length >= 3 && dimCandidates[2] <= 500) {
          qty = Math.round(dimCandidates[2]);
        }
      }
    }
    
    if (!foundL || !foundW) {
      return null;
    }
  } else {
    return null;
  }
  
  // Extract label from non-numeric parts before dimensions
  const firstDimIndex = numericIndices[dimensionStartIndex];
  if (firstDimIndex > 0) {
    const labelParts: string[] = [];
    for (let i = isFirstRowNumber ? 1 : 0; i < firstDimIndex; i++) {
      if (!/^\d+$/.test(parts[i])) {
        labelParts.push(parts[i]);
      }
    }
    label = labelParts.join(" ").trim();
  }
  
  // Look for edge banding indicators (X, XX, x)
  // These typically appear after dimensions
  const qtyIndex = numericIndices[dimensionStartIndex + 2] ?? firstDimIndex + 3;
  for (let i = qtyIndex + 1; i < parts.length; i++) {
    const part = parts[i].toUpperCase().trim();
    if (part === "X" || part === "XX") {
      // Map position to edge
      const edgeIndex = i - qtyIndex - 1;
      if (edgeIndex === 0) edges.push("L1");
      else if (edgeIndex === 1) edges.push("W1");
      else if (edgeIndex === 2) edges.push("L2");
      else if (edgeIndex === 3) edges.push("W2");
      
      if (part === "XX") {
        // XX means both edges on that dimension
        if (edgeIndex === 0 || edgeIndex === 2) edges.push("L2");
        if (edgeIndex === 1 || edgeIndex === 3) edges.push("W2");
      }
    }
    // Check for groove indicator (lowercase x often means groove)
    if (parts[i] === "x" || parts[i].toLowerCase().includes("groove")) {
      hasGroove = true;
    }
  }
  
  // Look for material hints in the text
  const materialKeywords = ["melamine", "mel", "mdf", "plywood", "ply", "pb", "particleboard", "oak", "cherry", "walnut", "white", "black"];
  for (const part of parts) {
    const lower = part.toLowerCase();
    for (const keyword of materialKeywords) {
      if (lower.includes(keyword)) {
        materialHint = part;
        break;
      }
    }
    if (materialHint) break;
  }
  
  // Also check full line for material patterns like "PB BLACK CHERRY"
  if (!materialHint) {
    const matMatch = line.match(/\b(PB|MDF|PLY|melamine|plywood)\s+\w+(?:\s+\w+)?/i);
    if (matMatch) {
      materialHint = matMatch[0];
    }
  }
  
  // Remove duplicates from edges
  edges = [...new Set(edges)];
  
  return { L, W, qty, label, edges, hasGroove, confidence, materialHint };
}

/**
 * Parse space-separated line (fallback for simple space separation)
 */
function parseSpaceSeparatedLine(
  parts: string[],
  options: TextParseOptions
): { L: number; W: number; qty: number; label: string; edges: string[]; hasGroove: boolean; confidence: number; materialHint?: string } | null {
  // Similar logic to tabular but for single-space separated
  let label = "";
  let L = 0;
  let W = 0;
  let qty = 1;
  let edges: string[] = [];
  let hasGroove = false;
  let materialHint: string | undefined;
  
  // Collect all numbers and their positions
  const numbers: { value: number; index: number }[] = [];
  const textParts: { text: string; index: number }[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const num = parseFloat(parts[i].replace(/,/g, ''));
    if (!isNaN(num) && parts[i].match(/^\d+(?:\.\d+)?$/)) {
      numbers.push({ value: num, index: i });
    } else {
      textParts.push({ text: parts[i], index: i });
    }
  }
  
  if (numbers.length < 2) return null;
  
  // Check if first number is a row number (small integer at position 0)
  let startIdx = 0;
  if (numbers[0].index === 0 && numbers[0].value < 1000 && Number.isInteger(numbers[0].value)) {
    startIdx = 1;
  }
  
  if (numbers.length - startIdx < 2) return null;
  
  // Assign L, W, and optionally qty
  L = numbers[startIdx].value;
  W = numbers[startIdx + 1].value;
  
  if (numbers.length - startIdx >= 3 && numbers[startIdx + 2].value <= 500) {
    qty = Math.round(numbers[startIdx + 2].value);
  }
  
  // Build label from text before first dimension
  const firstDimIdx = numbers[startIdx].index;
  label = textParts
    .filter(t => t.index < firstDimIdx)
    .map(t => t.text)
    .join(" ")
    .trim();
  
  // Check for edge indicators after qty
  const afterQtyIdx = numbers[startIdx + (qty > 1 ? 2 : 1)]?.index ?? firstDimIdx + 2;
  for (let i = afterQtyIdx + 1; i < parts.length; i++) {
    const part = parts[i].toUpperCase();
    if (part === "X" || part === "XX") {
      const pos = i - afterQtyIdx - 1;
      if (pos === 0) edges.push("L1");
      if (pos === 1) edges.push("W1");
      if (pos === 2) edges.push("L2");
      if (pos === 3) edges.push("W2");
    }
    if (parts[i] === "x") hasGroove = true;
  }
  
  // Look for material hints
  const materialKeywords = ["melamine", "mel", "mdf", "plywood", "ply", "pb", "particleboard", "oak", "cherry", "walnut", "white", "black"];
  for (const part of parts) {
    const lower = part.toLowerCase();
    for (const keyword of materialKeywords) {
      if (lower.includes(keyword)) {
        materialHint = part;
        break;
      }
    }
    if (materialHint) break;
  }
  
  edges = [...new Set(edges)];
  
  return { L, W, qty, label, edges, hasGroove, confidence: 0.75, materialHint };
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
        
        // Apply dimension order hint - only swap if explicit WxL format
        // (Do NOT auto-swap based on size - L represents grain direction
        // in cabinet context and may be smaller than W)
        if (options.dimOrderHint === "WxL") {
          [L, W] = [W, L];
        }
        // Removed "infer" auto-swap logic - keep dimensions as entered
        
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
 * Extract and normalize all services from text using the canonical services module
 * 
 * This provides a more comprehensive extraction of:
 * - Edgebanding (with canonical shortcode support)
 * - Grooves (with G-code support)
 * - Drilling/holes (with H-code support)
 * - CNC operations
 */
function extractServicesFromText(
  text: string,
  options: TextParseOptions
): RawServiceFields {
  // Use the canonical services module to extract raw fields
  const rawFields = extractRawFieldsFromText(text);
  
  // Enhance with tabular edge detection if present
  const upperText = text.toUpperCase();
  
  // Look for X/XX patterns common in spreadsheets
  const xxMatch = upperText.match(/\b(X+)\s+(X*)\b/);
  if (xxMatch && !rawFields.edgeband?.text) {
    const lEdge = xxMatch[1];
    const wEdge = xxMatch[2];
    let edgeCode = "";
    if (lEdge === "XX" && wEdge === "XX") edgeCode = "2L2W";
    else if (lEdge === "X" && wEdge === "XX") edgeCode = "L2W";
    else if (lEdge === "XX") edgeCode = "2L";
    else if (lEdge === "X") edgeCode = "L1";
    
    if (edgeCode) {
      rawFields.edgeband = { ...rawFields.edgeband, text: edgeCode };
    }
  }
  
  // Look for groove indicators in lowercase (common convention)
  if (!rawFields.groove?.text) {
    const grooveMatch = text.match(/\b(x)\b(?!\s*\d)/);
    if (grooveMatch) {
      rawFields.groove = { text: "GW2-4-10" }; // Default back panel groove
    }
  }
  
  return rawFields;
}

/**
 * Convert extracted services to PartOps schema format
 */
function servicesToPartOps(
  services: ReturnType<typeof normalizeServices>
): CutPart["ops"] | undefined {
  if (!services || (!services.edgeband && !services.grooves && !services.holes && !services.cnc)) {
    return undefined;
  }
  
  const ops: NonNullable<CutPart["ops"]> = {};
  
  // Convert edgeband
  if (services.edgeband?.edges && services.edgeband.edges.length > 0) {
    ops.edging = {
      edges: services.edgeband.edges.reduce((acc, edge) => {
        acc[edge] = { 
          apply: true, 
          edgeband_id: services.edgeband?.tapeId,
          thickness_mm: services.edgeband?.thicknessMm,
        };
        return acc;
      }, {} as Record<string, { apply: boolean; edgeband_id?: string; thickness_mm?: number }>),
    };
  }
  
  // Convert grooves
  if (services.grooves && services.grooves.length > 0) {
    ops.grooves = services.grooves.map((groove, idx) => ({
      groove_id: generateId("GRV"),
      side: groove.onEdge,
      offset_mm: groove.distanceFromEdgeMm,
      depth_mm: groove.depthMm,
      width_mm: groove.widthMm,
      face: groove.face,
      notes: groove.note,
    }));
  }
  
  // Convert holes
  if (services.holes && services.holes.length > 0) {
    ops.holes = services.holes.map((hole) => ({
      pattern_id: hole.patternId ?? `${hole.kind}-pattern`,
      face: hole.face === "edge" ? undefined : hole.face,
      notes: hole.note ?? `${hole.kind} holes`,
    }));
  }
  
  // Convert CNC operations
  if (services.cnc && services.cnc.length > 0) {
    ops.custom_cnc_ops = services.cnc.map((cnc) => ({
      op_type: cnc.type,
      payload: {
        shapeId: cnc.shapeId,
        ...cnc.params,
      },
      notes: cnc.note,
    }));
  }
  
  return Object.keys(ops).length > 0 ? ops : undefined;
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
  const learningContext = options.learningContext;
  
  // Clean up the text
  const cleanText = text.trim();
  
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
  
  // Skip header lines and other non-data lines
  if (isHeaderLine(cleanText) || shouldSkipLine(cleanText)) {
    errors.push("Header or non-data line");
    return {
      part: createEmptyPart(options),
      confidence: 0,
      warnings,
      errors,
      originalText: text,
    };
  }
  
  // Try tabular parsing first (for spreadsheet-style data)
  const tabularResult = parseTabularLine(cleanText, options);
  if (tabularResult && tabularResult.L > 0 && tabularResult.W > 0) {
    const { L, W, qty, label, edges, hasGroove, confidence, materialHint } = tabularResult;
    
    // Apply learning context material mapping
    let materialId = options.defaultMaterialId ?? "default";
    let thickness = options.defaultThicknessMm ?? DEFAULTS.THICKNESS_MM;
    
    if (materialHint && learningContext?.enabled) {
      const normalizedMaterial = materialHint.toLowerCase().replace(/\s+/g, " ").trim();
      const mapping = learningContext.materialMappings.get(normalizedMaterial);
      if (mapping) {
        materialId = mapping.materialId;
        if (mapping.thicknessMm) {
          thickness = mapping.thicknessMm;
        }
        overallConfidence = Math.min(overallConfidence, mapping.confidence + 0.2);
        warnings.push(`Applied material mapping: "${materialHint}" → ${mapping.materialId}`);
      }
    }
    
    // Apply learning context edge notation patterns
    let enhancedEdges = [...edges];
    let enhancedGrooves: string[] = hasGroove ? ["W2"] : [];
    
    if (learningContext?.enabled && learningContext.parserPatterns.size > 0) {
      // Check each part of the cleaned text for edge notation patterns
      const edgePatterns = learningContext.parserPatterns.get("edge_notation") || [];
      const groovePatterns = learningContext.parserPatterns.get("groove_notation") || [];
      
      for (const pattern of edgePatterns) {
        const regex = new RegExp(`\\b${escapeRegexForLearning(pattern.inputPattern)}\\b`, "i");
        if (regex.test(cleanText)) {
          const mapping = pattern.outputMapping as { edges?: string[]; groove?: string };
          if (mapping.edges) {
            enhancedEdges.push(...mapping.edges.filter(e => !enhancedEdges.includes(e)));
          }
          if (mapping.groove && !enhancedGrooves.includes(mapping.groove)) {
            enhancedGrooves.push(mapping.groove);
          }
        }
      }
      
      for (const pattern of groovePatterns) {
        const regex = new RegExp(`\\b${escapeRegexForLearning(pattern.inputPattern)}\\b`, "i");
        if (regex.test(cleanText)) {
          const mapping = pattern.outputMapping as { groove?: string };
          if (mapping.groove && !enhancedGrooves.includes(mapping.groove)) {
            enhancedGrooves.push(mapping.groove);
          }
        }
      }
    }
    
    const part: CutPart = {
      part_id: generateId("P"),
      label: label || undefined,
      qty,
      size: { L, W },
      thickness_mm: thickness,
      material_id: materialId,
      grain: "none",
      allow_rotation: true,
      audit: {
        source_method: options.sourceMethod ?? "paste_parser",
        parsed_text_snippet: cleanText.substring(0, 100),
        confidence,
        human_verified: false,
      },
    };
    
    // Extract and normalize services using the canonical services module
    const rawServices = extractServicesFromText(cleanText, options);
    
    // Merge with legacy edge/groove detection
    if (enhancedEdges.length > 0 && !rawServices.edgeband?.text) {
      let edgeCode = "";
      if (enhancedEdges.length === 4) edgeCode = "2L2W";
      else if (enhancedEdges.includes("L1") && enhancedEdges.includes("L2")) edgeCode = "2L";
      else if (enhancedEdges.includes("W1") && enhancedEdges.includes("W2")) edgeCode = "2W";
      else edgeCode = enhancedEdges.join("+");
      rawServices.edgeband = { ...rawServices.edgeband, text: edgeCode };
    }
    
    if (enhancedGrooves.length > 0 && !rawServices.groove?.text) {
      rawServices.groove = { ...rawServices.groove, text: `G${enhancedGrooves[0]}-4-10` };
    }
    
    // Get the dialect (use default if not provided)
    const dialect = options.orgDialect 
      ? mergeWithDefaults(options.orgDialect)
      : getDefaultDialect();
    
    // Normalize to canonical services
    const canonicalServices = normalizeServices(rawServices, dialect);
    
    // Convert to PartOps format
    part.ops = servicesToPartOps(canonicalServices);
    
    return {
      part,
      confidence,
      warnings,
      errors,
      originalText: text,
    };
  }
  
  // Fall back to original pattern-based parsing
  const normalizedText = cleanText.replace(/\s+/g, " ");
  
  // Extract dimensions
  const dims = extractDimensions(normalizedText, options);
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
  const { qty, confidence: qtyConf } = extractQuantity(normalizedText);
  overallConfidence *= qtyConf;
  if (qtyConf < 0.7) {
    warnings.push("Quantity not specified, defaulting to 1");
  }
  
  // Extract grain and rotation
  const { grain, allowRotation, confidence: grainConf } = extractGrain(normalizedText);
  if (grainConf < 0.7) {
    // Don't reduce confidence much for grain - it's optional
    overallConfidence *= 0.95;
  }
  
  // Extract label
  const label = extractLabel(normalizedText);
  
  // Extract material hint
  const materialHint = extractMaterialHint(normalizedText);
  
  // Extract thickness (if specified in text)
  const parsedThickness = extractThickness(normalizedText);
  
  // Extract edge banding
  const edges = extractEdgeBanding(normalizedText);
  
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
      parsed_text_snippet: normalizedText.substring(0, 100),
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
  
  // Extract and normalize services using the canonical services module
  const rawServices = extractServicesFromText(normalizedText, options);
  
  // Merge with legacy edge detection
  if (edges.length > 0 && !rawServices.edgeband?.text) {
    let edgeCode = "";
    if (edges.length === 4) edgeCode = "2L2W";
    else if (edges.includes("L1") && edges.includes("L2")) edgeCode = "2L";
    else if (edges.includes("W1") && edges.includes("W2")) edgeCode = "2W";
    else edgeCode = edges.join("+");
    rawServices.edgeband = { ...rawServices.edgeband, text: edgeCode };
  }
  
  // Get the dialect
  const dialect = options.orgDialect 
    ? mergeWithDefaults(options.orgDialect)
    : getDefaultDialect();
  
  // Normalize to canonical services
  const canonicalServices = normalizeServices(rawServices, dialect);
  
  // Convert to PartOps format
  part.ops = servicesToPartOps(canonicalServices);
  
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
    
    // Only include results that parsed successfully
    if (result.errors.length === 0 && result.part.size.L > 0 && result.part.size.W > 0) {
      results.push(result);
      totalConfidence += result.confidence;
    } else if (result.errors.length > 0 && !result.errors.includes("Header or non-data line")) {
      // Count actual errors, not skipped lines
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
