/**
 * CAI Intake - Deterministic Parser
 * 
 * Fast, pattern-based parsing for known structured formats.
 * This is the first layer in the 3-layer parsing strategy.
 */

import type { CutPart } from "@/lib/schema";
import type { EdgeEdgingOps } from "@/lib/schema/operations";
import { generateId } from "@/lib/utils";
import type { SourceFormatHint } from "./format-detector";

// ============================================================
// TYPES
// ============================================================

export interface DeterministicParseOptions {
  /** Source format hint */
  format?: SourceFormatHint;
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness in mm */
  defaultThicknessMm?: number;
  /** Field delimiter (auto-detected if not provided) */
  delimiter?: string;
  /** Skip header row */
  skipHeader?: boolean;
  /** Column mapping override */
  columnMapping?: Record<string, number>;
}

export interface DeterministicParseResult {
  /** Successfully parsed parts */
  parts: CutPart[];
  /** Rows that couldn't be parsed */
  failedRows: Array<{ row: number; line: string; error: string }>;
  /** Overall confidence score */
  confidence: number;
  /** Parser method used */
  method: "deterministic";
  /** Detected format */
  detectedFormat: SourceFormatHint;
  /** Whether parsing was successful enough to skip other layers */
  skipOtherLayers: boolean;
}

// ============================================================
// COLUMN DETECTION
// ============================================================

/** Standard column patterns for auto-detection */
const COLUMN_PATTERNS = {
  label: /^(name|label|part|description|desc|component|item)$/i,
  length: /^(length|len|l|long|dimension1|dim1)$/i,
  width: /^(width|wid|w|wide|dimension2|dim2)$/i,
  thickness: /^(thick(ness)?|thk|t|depth|z)$/i,
  qty: /^(qty|quantity|count|pcs|pieces|num|#|amount)$/i,
  material: /^(material|mat|board|stock|substrate|panel)$/i,
  grain: /^(grain|direction|dir|gl|gw|orientation)$/i,
  edgeband: /^(edge|edgeband(ing)?|eb|banding|band|tape)$/i,
  notes: /^(notes?|comment|remark|info|description)$/i,
};

/**
 * Detect column mapping from headers
 */
function detectColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim().toLowerCase();
    
    for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (pattern.test(header) && mapping[field] === undefined) {
        mapping[field] = i;
        break;
      }
    }
    
    // Check for dimension patterns with units: "L (mm)", "Width mm"
    if (/l\s*[\(\[]?\s*mm/i.test(header) && mapping.length === undefined) {
      mapping.length = i;
    } else if (/w\s*[\(\[]?\s*mm/i.test(header) && mapping.width === undefined) {
      mapping.width = i;
    } else if (/t(hk)?\s*[\(\[]?\s*mm/i.test(header) && mapping.thickness === undefined) {
      mapping.thickness = i;
    }
  }
  
  return mapping;
}

/**
 * Try to detect delimiter from text
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 5).join("\n");
  
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const pipeCount = (firstLines.match(/\|/g) || []).length;
  
  const counts = [
    { delimiter: "\t", count: tabCount },
    { delimiter: ",", count: commaCount },
    { delimiter: ";", count: semicolonCount },
    { delimiter: "|", count: pipeCount },
  ];
  
  counts.sort((a, b) => b.count - a.count);
  
  // Return the most common delimiter if it appears enough
  if (counts[0].count >= 3) {
    return counts[0].delimiter;
  }
  
  return "\t"; // Default to tab
}

// ============================================================
// PARSING
// ============================================================

/**
 * Parse structured tabular text deterministically
 */
export function parseDeterministic(
  text: string,
  options: DeterministicParseOptions = {}
): DeterministicParseResult {
  const lines = text.split("\n").filter(l => l.trim());
  
  if (lines.length === 0) {
    return {
      parts: [],
      failedRows: [],
      confidence: 0,
      method: "deterministic",
      detectedFormat: "auto",
      skipOtherLayers: false,
    };
  }
  
  // Detect delimiter
  const delimiter = options.delimiter || detectDelimiter(text);
  
  // Split all lines
  const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
  
  // Detect columns from first row (headers)
  const headers = rows[0];
  const columnMapping = options.columnMapping || detectColumns(headers);
  
  // Check if we have minimum required columns
  const hasLength = columnMapping.length !== undefined;
  const hasWidth = columnMapping.width !== undefined;
  
  if (!hasLength || !hasWidth) {
    return {
      parts: [],
      failedRows: [{ row: 0, line: lines[0], error: "Missing length or width columns" }],
      confidence: 0,
      method: "deterministic",
      detectedFormat: options.format || "auto",
      skipOtherLayers: false,
    };
  }
  
  // Parse data rows
  const parts: CutPart[] = [];
  const failedRows: DeterministicParseResult["failedRows"] = [];
  const startRow = options.skipHeader !== false ? 1 : 0;
  
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 1;
    
    try {
      const part = parseRow(row, columnMapping, options);
      if (part) {
        parts.push(part);
      } else {
        // Empty row - skip silently
      }
    } catch (error) {
      failedRows.push({
        row: lineNum,
        line: lines[i],
        error: error instanceof Error ? error.message : "Parse error",
      });
    }
  }
  
  // Calculate confidence based on success rate
  const totalDataRows = rows.length - startRow;
  const successRate = totalDataRows > 0 ? parts.length / totalDataRows : 0;
  const confidence = successRate * 0.95; // Max 95% for deterministic
  
  return {
    parts,
    failedRows,
    confidence,
    method: "deterministic",
    detectedFormat: options.format || "excel",
    skipOtherLayers: successRate >= 0.9, // Skip other layers if 90%+ success
  };
}

/**
 * Parse a single row into a CutPart
 */
function parseRow(
  row: string[],
  mapping: Record<string, number>,
  options: DeterministicParseOptions
): CutPart | null {
  const getValue = (field: string): string => {
    const idx = mapping[field];
    return idx !== undefined && row[idx] ? row[idx].trim() : "";
  };
  
  const getNumber = (field: string): number | null => {
    const val = getValue(field);
    if (!val) return null;
    const num = parseFloat(val.replace(/[^\d.-]/g, ""));
    return isNaN(num) ? null : num;
  };
  
  // Get dimensions
  const length = getNumber("length");
  const width = getNumber("width");
  
  // Skip empty rows
  if ((length === null || length === 0) && (width === null || width === 0)) {
    return null;
  }
  
  // Validate required dimensions
  if (length === null || length <= 0) {
    throw new Error("Invalid length");
  }
  if (width === null || width <= 0) {
    throw new Error("Invalid width");
  }
  
  // Get optional fields
  const label = getValue("label") || undefined;
  const thickness = getNumber("thickness") ?? options.defaultThicknessMm ?? 18;
  const qty = Math.max(1, Math.round(getNumber("qty") ?? 1));
  const material = getValue("material") || options.defaultMaterialId || "default";
  const notes = getValue("notes") || undefined;
  
  // Parse rotation (grain direction is now a material property)
  const rotValue = getValue("rotation") || getValue("rotate") || getValue("grain");
  let allowRotation = true;
  
  if (rotValue) {
    const lower = rotValue.toLowerCase();
    // N, No, false, 0 = cannot rotate (has grain constraint)
    if (/^(n|no|false|0|l|length|along.?l|gl|w|width|along.?w|gw)$/i.test(lower)) {
      allowRotation = false;
    }
    // Y, Yes, true, 1, none = can rotate
    else if (/^(y|yes|true|1|none)$/i.test(lower)) {
      allowRotation = true;
    }
  }
  
  // Parse edgebanding shortcode
  const edgebandValue = getValue("edgeband").toUpperCase();
  let ops: CutPart["ops"] | undefined;
  
  if (edgebandValue) {
    const edgeSpec = parseEdgebandShortcode(edgebandValue);
    if (edgeSpec) {
      ops = { edging: edgeSpec };
    }
  }
  
  return {
    part_id: generateId("P"),
    label,
    qty,
    size: { L: length, W: width },
    thickness_mm: thickness,
    material_id: material,
    allow_rotation: allowRotation,
    ops,
    notes: notes ? { operator: notes } : undefined,
    audit: {
      source_method: "excel_table",
      source_ref: `row:${label || "unknown"}`,
      confidence: 0.95,
      human_verified: false,
    },
  };
}

/**
 * Parse edgebanding shortcode to edge specification
 */
function parseEdgebandShortcode(code: string): EdgeEdgingOps | undefined {
  const normalized = code.trim().toUpperCase();
  
  // Common shortcode mappings - list of edges to apply
  const edgeMappings: Record<string, string[]> = {
    "0": [],
    "-": [],
    "NONE": [],
    "L": ["L1"],
    "L1": ["L1"],
    "L2": ["L2"],
    "W": ["W1"],
    "W1": ["W1"],
    "W2": ["W2"],
    "2L": ["L1", "L2"],
    "2W": ["W1", "W2"],
    "LW": ["L1", "W1"],
    "L2W": ["L1", "W1", "W2"],
    "2L1W": ["L1", "L2", "W1"],
    "2LW": ["L1", "L2", "W1"],
    "2L2W": ["L1", "L2", "W1", "W2"],
    "ALL": ["L1", "L2", "W1", "W2"],
    "4": ["L1", "L2", "W1", "W2"],
    "4S": ["L1", "L2", "W1", "W2"],
  };
  
  const edgeList = edgeMappings[normalized];
  if (!edgeList || edgeList.length === 0) {
    return undefined;
  }
  
  const edges: Record<string, { apply: boolean; edgeband_id?: string }> = {};
  for (const edge of edgeList) {
    edges[edge] = { apply: true };
  }
  
  return { edges };
}

/**
 * Check if text is suitable for deterministic parsing
 */
export function canParseDeterministically(text: string): boolean {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return false;
  
  const delimiter = detectDelimiter(text);
  const rows = lines.map(line => line.split(delimiter));
  
  // Check if rows have consistent column count
  const columnCounts = rows.map(r => r.length);
  const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
  const consistentColumns = columnCounts.every(c => Math.abs(c - avgColumns) <= 1);
  
  if (!consistentColumns || avgColumns < 2) return false;
  
  // Check if first row looks like headers
  const headers = rows[0];
  const mapping = detectColumns(headers);
  
  return mapping.length !== undefined && mapping.width !== undefined;
}

