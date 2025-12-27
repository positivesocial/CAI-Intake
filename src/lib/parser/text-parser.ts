/**
 * CAI Intake - Text Parser Engine
 * 
 * Parses natural language cutlist input into structured CutPart objects.
 * Handles various formats commonly used in woodworking shops.
 */

import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import {
  DIMENSION_PATTERNS,
  QUANTITY_PATTERNS,
  THICKNESS_PATTERNS,
  GRAIN_PATTERNS,
  MATERIAL_KEYWORDS,
  LABEL_CLEANUP_PATTERNS,
} from "./parser-patterns";
import {
  normalizeText,
  splitLines,
  parseDimensionValue,
  extractLabel,
  cleanLabel,
  parseEdges,
  findMaterialMatch,
  calculateConfidence,
  areDimensionsReasonable,
  type EdgeId,
} from "./parser-utils";

// ============================================================
// TYPES
// ============================================================

// Valid ingestion method types
type IngestionMethod = "manual" | "paste_parser" | "excel_table" | "file_upload" | "ocr_template" | "ocr_generic" | "voice" | "api";

export interface ParsedPart {
  part_id: string;
  label?: string;
  qty: number;
  size: { L: number; W: number };
  thickness_mm: number;
  material_id: string;
  allow_rotation: boolean;
  group_id?: string;
  edges?: EdgeId[];
  notes?: { operator?: string };
  audit: {
    source_method: IngestionMethod;
    source_ref?: string;
    confidence: number;
    human_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  _originalText: string;
  _parseWarnings: string[];
}

export interface ParseResult {
  success: boolean;
  parts: ParsedPart[];
  errors: ParseError[];
  warnings: string[];
  stats: {
    totalLines: number;
    parsedLines: number;
    failedLines: number;
    totalParts: number;
    totalPieces: number;
  };
}

export interface ParseError {
  line: number;
  text: string;
  error: string;
}

export interface ParserOptions {
  defaultMaterialId?: string;
  defaultThickness?: number;
  defaultAllowRotation?: boolean;
  minConfidence?: number;
  strictMode?: boolean;
}

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  defaultMaterialId: "MAT-WHITE-18",
  defaultThickness: 18,
  defaultAllowRotation: true,
  minConfidence: 0.3,
  strictMode: false,
};

// ============================================================
// MAIN PARSER CLASS
// ============================================================

export class TextParser {
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse multiple lines of text into parts
   */
  parse(text: string): ParseResult {
    const lines = splitLines(normalizeText(text));
    const parts: ParsedPart[] = [];
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      try {
        const parsed = this.parseLine(line);
        
        if (parsed) {
          // Check confidence threshold
          if (parsed.audit.confidence < this.options.minConfidence) {
            if (this.options.strictMode) {
              errors.push({
                line: lineNum,
                text: line,
                error: `Low confidence (${(parsed.audit.confidence * 100).toFixed(0)}%)`,
              });
              continue;
            } else {
              warnings.push(`Line ${lineNum}: Low confidence parse`);
            }
          }
          
          parsed.audit.source_ref = `line:${lineNum}`;
          parts.push(parsed);
        } else {
          errors.push({
            line: lineNum,
            text: line,
            error: "Could not parse dimensions",
          });
        }
      } catch (err) {
        errors.push({
          line: lineNum,
          text: line,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const totalPieces = parts.reduce((sum, p) => sum + p.qty, 0);

    return {
      success: parts.length > 0,
      parts,
      errors,
      warnings,
      stats: {
        totalLines: lines.length,
        parsedLines: parts.length,
        failedLines: errors.length,
        totalParts: parts.length,
        totalPieces,
      },
    };
  }

  /**
   * Parse a single line of text into a part
   */
  parseLine(line: string): ParsedPart | null {
    const normalized = normalizeText(line);
    const warnings: string[] = [];

    // Extract dimensions (required)
    const dimensions = this.extractDimensions(normalized);
    if (!dimensions) return null;

    // Extract quantity (default to 1)
    const qty = this.extractQuantity(normalized) || 1;

    // Extract thickness (use default if not found)
    const thickness = this.extractThickness(normalized) || this.options.defaultThickness;

    // Extract grain/rotation settings
    const { allowRotation } = this.extractGrainSettings(normalized);

    // Extract edges for banding
    const edges = parseEdges(normalized);

    // Find material match
    const materialMatch = findMaterialMatch(normalized, MATERIAL_KEYWORDS);
    const materialId = materialMatch || this.options.defaultMaterialId;

    // Extract label (text before dimensions, cleaned up)
    const label = this.extractLabel(normalized);

    // Calculate confidence
    const confidence = calculateConfidence({
      hasDimensions: true,
      hasQuantity: qty !== 1,
      hasLabel: !!label,
      hasMaterial: !!materialMatch,
      hasThickness: this.extractThickness(normalized) !== null,
      dimensionsReasonable: areDimensionsReasonable(dimensions.L, dimensions.W),
    });

    // Warn about suspicious dimensions
    if (!areDimensionsReasonable(dimensions.L, dimensions.W)) {
      warnings.push("Dimensions may be unusual");
    }

    const now = new Date().toISOString();

    const effectiveAllowRotation = allowRotation ?? this.options.defaultAllowRotation;
    
    return {
      part_id: generateId("P"),
      label: label || undefined,
      qty,
      size: dimensions,
      thickness_mm: thickness,
      material_id: materialId,
      allow_rotation: effectiveAllowRotation,
      edges: edges.length > 0 ? edges : undefined,
      audit: {
        source_method: "paste_parser",
        confidence,
        human_verified: false,
        created_at: now,
        updated_at: now,
      },
      _originalText: line,
      _parseWarnings: warnings,
    };
  }

  /**
   * Extract dimensions from text
   */
  private extractDimensions(text: string): { L: number; W: number } | null {
    for (const pattern of DIMENSION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const L = parseDimensionValue(match[1]);
        const W = parseDimensionValue(match[2]);
        
        if (L > 0 && W > 0) {
          // Use dimensions as-is - L represents grain direction in cabinet context
          // (may be smaller than W for grain-sensitive parts)
          return { L, W };
        }
      }
    }
    return null;
  }

  /**
   * Extract quantity from text
   */
  private extractQuantity(text: string): number | null {
    for (const pattern of QUANTITY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const qty = parseInt(match[1], 10);
        if (qty > 0 && qty < 10000) {
          return qty;
        }
      }
    }
    return null;
  }

  /**
   * Extract thickness from text
   */
  private extractThickness(text: string): number | null {
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
    return null;
  }

  /**
   * Extract grain direction and rotation settings
   */
  private extractGrainSettings(text: string): {
    allowRotation: boolean | null;
    grainDirection: "length" | "width" | null;
  } {
    // Check for explicit no rotation
    for (const pattern of GRAIN_PATTERNS.noRotation) {
      if (pattern.test(text)) {
        return { allowRotation: false, grainDirection: null };
      }
    }

    // Check for grain along length (implies no rotation)
    for (const pattern of GRAIN_PATTERNS.grainLength) {
      if (pattern.test(text)) {
        return { allowRotation: false, grainDirection: "length" };
      }
    }

    // Check for grain along width (implies no rotation)
    for (const pattern of GRAIN_PATTERNS.grainWidth) {
      if (pattern.test(text)) {
        return { allowRotation: false, grainDirection: "width" };
      }
    }

    // Check for explicit allow rotation
    for (const pattern of GRAIN_PATTERNS.allowRotation) {
      if (pattern.test(text)) {
        return { allowRotation: true, grainDirection: null };
      }
    }

    // No grain/rotation info found
    return { allowRotation: null, grainDirection: null };
  }

  /**
   * Extract label from text
   */
  private extractLabel(text: string): string {
    // First try to get text before dimensions
    let label = extractLabel(text);
    
    // If no label found before dimensions, try cleaning the whole line
    if (!label) {
      label = cleanLabel(text, LABEL_CLEANUP_PATTERNS);
    } else {
      // Clean up the extracted label
      label = cleanLabel(label, LABEL_CLEANUP_PATTERNS);
    }

    // Truncate very long labels
    if (label.length > 100) {
      label = label.substring(0, 97) + "...";
    }

    return label;
  }
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Quick parse function with default options
 */
export function parseText(text: string, options?: ParserOptions): ParseResult {
  const parser = new TextParser(options);
  return parser.parse(text);
}

/**
 * Parse a single line with default options
 */
export function parseLine(line: string, options?: ParserOptions): ParsedPart | null {
  const parser = new TextParser(options);
  return parser.parseLine(line);
}

/**
 * Convert ParsedPart to CutPart (removes internal fields)
 */
export function toCutPart(parsed: ParsedPart): CutPart {
  const { _originalText, _parseWarnings, edges, ...rest } = parsed;
  
  const part: CutPart = {
    ...rest,
    ops: edges && edges.length > 0 ? {
      edging: {
        edges: edges.reduce((acc, edge) => {
          acc[edge] = { apply: true, edgeband_id: "EB-WHITE-0.8" };
          return acc;
        }, {} as Record<string, { apply: boolean; edgeband_id?: string }>),
      },
    } : undefined,
  };

  return part;
}

