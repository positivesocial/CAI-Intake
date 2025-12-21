/**
 * CAI Intake - Template Excel Parser
 * 
 * High-accuracy parser for CAI Excel templates.
 * Uses template metadata for deterministic field extraction.
 */

import * as XLSX from "xlsx";
import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import type { TemplateMetadata } from "./template-detector";
import { parseEdgeCode } from "@/lib/services/canonical-shortcodes";

// ============================================================
// TYPES
// ============================================================

export interface TemplateParseOptions {
  /** Template metadata (from detection) */
  metadata?: TemplateMetadata;
  /** Default material ID if not specified */
  defaultMaterialId?: string;
  /** Default thickness in mm */
  defaultThicknessMm?: number;
  /** Sheet to parse (name or index) */
  sheet?: string | number;
}

export interface TemplateParseResult {
  /** Successfully parsed parts */
  parts: CutPart[];
  /** Project info extracted from header */
  projectInfo?: {
    projectName?: string;
    projectCode?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    date?: string;
    pageNumber?: number;
    totalPages?: number;
  };
  /** Template metadata used */
  templateMetadata?: TemplateMetadata;
  /** Statistics */
  stats: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    errorRows: number;
  };
  /** Errors encountered */
  errors: Array<{ row: number; error: string }>;
  /** Confidence score */
  confidence: number;
}

// ============================================================
// COLUMN DEFINITIONS
// ============================================================

/** Standard CAI template column order */
const STANDARD_COLUMNS = [
  "#",           // 0: Part number
  "label",       // 1: Part name
  "L",           // 2: Length
  "W",           // 3: Width
  "qty",         // 4: Quantity
  "material",    // 5: Material
  "thk",         // 6: Thickness
  "grain",       // 7: Grain direction
  "eb_L1",       // 8: Edgeband L1
  "eb_L2",       // 9: Edgeband L2
  "eb_W1",       // 10: Edgeband W1
  "eb_W2",       // 11: Edgeband W2
  "grv_side",    // 12: Groove side
  "grv_d",       // 13: Groove depth
  "grv_w",       // 14: Groove width
  "hole_pattern",// 15: Hole pattern
  "hole_dia",    // 16: Hole diameter
  "hole_depth",  // 17: Hole depth
  "cnc_prog",    // 18: CNC program
  "cnc_notes",   // 19: CNC notes
  "notes",       // 20: General notes
];

/** Header row patterns for auto-detection */
const HEADER_PATTERNS: Record<string, RegExp[]> = {
  "#": [/^#$/i, /^no\.?$/i, /^num$/i],
  label: [/^part/i, /^name/i, /^label/i, /^desc/i],
  L: [/^l$/i, /^length/i, /^long/i],
  W: [/^w$/i, /^width/i, /^wide/i],
  qty: [/^qty/i, /^quantity/i, /^pcs/i, /^#$/],
  material: [/^mat/i, /^material/i, /^board/i],
  thk: [/^thk/i, /^thick/i, /^t$/i],
  grain: [/^grain/i, /^dir/i, /^gl/i, /^gw/i],
  eb_L1: [/^eb.?l1/i, /^l1.?edge/i, /^edge.?l1/i],
  eb_L2: [/^eb.?l2/i, /^l2.?edge/i, /^edge.?l2/i],
  eb_W1: [/^eb.?w1/i, /^w1.?edge/i, /^edge.?w1/i],
  eb_W2: [/^eb.?w2/i, /^w2.?edge/i, /^edge.?w2/i],
  notes: [/^notes?$/i, /^comment/i, /^remark/i],
};

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Parse a CAI Excel template
 */
export function parseTemplateExcel(
  buffer: ArrayBuffer,
  options: TemplateParseOptions = {}
): TemplateParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  
  // Select sheet
  let sheetName: string;
  if (typeof options.sheet === "number") {
    sheetName = workbook.SheetNames[options.sheet] ?? workbook.SheetNames[0];
  } else if (typeof options.sheet === "string") {
    sheetName = options.sheet;
  } else {
    sheetName = workbook.SheetNames[0];
  }
  
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      parts: [],
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errorRows: 0 },
      errors: [{ row: 0, error: `Sheet "${sheetName}" not found` }],
      confidence: 0,
    };
  }
  
  // Find header row and data start
  const { headerRow, dataStartRow, columnMapping } = findHeadersAndData(sheet, options.metadata);
  
  if (headerRow === -1) {
    return {
      parts: [],
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errorRows: 0 },
      errors: [{ row: 0, error: "Could not find header row" }],
      confidence: 0,
    };
  }
  
  // Extract project info from header section
  const projectInfo = extractProjectInfo(sheet, headerRow);
  
  // Get data range
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const totalRows = range.e.r - dataStartRow + 1;
  
  // Parse data rows
  const parts: CutPart[] = [];
  const errors: TemplateParseResult["errors"] = [];
  let skippedRows = 0;
  
  for (let row = dataStartRow; row <= range.e.r; row++) {
    const rowData = extractRow(sheet, row, columnMapping);
    
    // Skip empty rows
    if (isEmptyRow(rowData)) {
      skippedRows++;
      continue;
    }
    
    try {
      const part = parseDataRow(rowData, row, options);
      if (part) {
        parts.push(part);
      } else {
        skippedRows++;
      }
    } catch (error) {
      errors.push({
        row: row + 1, // 1-indexed
        error: error instanceof Error ? error.message : "Parse error",
      });
    }
  }
  
  // Calculate confidence
  const successRate = totalRows > 0 ? parts.length / totalRows : 0;
  const confidence = Math.min(0.99, 0.9 + successRate * 0.09);
  
  return {
    parts,
    projectInfo,
    templateMetadata: options.metadata,
    stats: {
      totalRows,
      parsedRows: parts.length,
      skippedRows,
      errorRows: errors.length,
    },
    errors,
    confidence,
  };
}

// ============================================================
// HEADER DETECTION
// ============================================================

interface HeaderDetectionResult {
  headerRow: number;
  dataStartRow: number;
  columnMapping: Map<string, number>;
}

/**
 * Find headers and determine column mapping
 */
function findHeadersAndData(
  sheet: XLSX.WorkSheet,
  metadata?: TemplateMetadata
): HeaderDetectionResult {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  
  // If metadata has fieldOrder, use that
  if (metadata?.fieldOrder && metadata.fieldOrder.length > 0) {
    // Find the header row that matches
    for (let row = 0; row <= Math.min(range.e.r, 15); row++) {
      const mapping = matchFieldOrder(sheet, row, metadata.fieldOrder);
      if (mapping.size > 0) {
        return {
          headerRow: row,
          dataStartRow: row + 1,
          columnMapping: mapping,
        };
      }
    }
  }
  
  // Auto-detect header row
  for (let row = 0; row <= Math.min(range.e.r, 15); row++) {
    const mapping = detectHeaderRow(sheet, row);
    
    // Need at least length and width columns
    if (mapping.has("L") && mapping.has("W")) {
      return {
        headerRow: row,
        dataStartRow: row + 1,
        columnMapping: mapping,
      };
    }
  }
  
  return { headerRow: -1, dataStartRow: -1, columnMapping: new Map() };
}

/**
 * Match field order from metadata
 */
function matchFieldOrder(
  sheet: XLSX.WorkSheet,
  row: number,
  fieldOrder: string[]
): Map<string, number> {
  const mapping = new Map<string, number>();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  
  // Get all headers in this row
  const headers: string[] = [];
  for (let col = 0; col <= Math.min(range.e.c, 25); col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    headers.push(cell?.v ? String(cell.v).trim().toLowerCase() : "");
  }
  
  // Match against field order
  for (let i = 0; i < fieldOrder.length && i < headers.length; i++) {
    const field = fieldOrder[i];
    if (field && headers[i]) {
      mapping.set(field, i);
    }
  }
  
  return mapping;
}

/**
 * Auto-detect header row and create column mapping
 */
function detectHeaderRow(sheet: XLSX.WorkSheet, row: number): Map<string, number> {
  const mapping = new Map<string, number>();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  
  for (let col = 0; col <= Math.min(range.e.c, 25); col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (!cell?.v) continue;
    
    const headerText = String(cell.v).trim();
    
    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (mapping.has(field)) continue;
      
      for (const pattern of patterns) {
        if (pattern.test(headerText)) {
          mapping.set(field, col);
          break;
        }
      }
    }
  }
  
  return mapping;
}

// ============================================================
// PROJECT INFO EXTRACTION
// ============================================================

/**
 * Extract project info from header section
 */
function extractProjectInfo(
  sheet: XLSX.WorkSheet,
  headerRow: number
): TemplateParseResult["projectInfo"] | undefined {
  const info: NonNullable<TemplateParseResult["projectInfo"]> = {};
  
  // Look in rows before header for project info
  for (let row = 0; row < headerRow; row++) {
    for (let col = 0; col < 15; col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell?.v) continue;
      
      const text = String(cell.v).trim();
      
      // Project name
      if (/project\s*name/i.test(text)) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
        if (valueCell?.v) info.projectName = String(valueCell.v).trim();
      }
      
      // Project code
      if (/project\s*code/i.test(text) || /code/i.test(text)) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
        if (valueCell?.v) info.projectCode = String(valueCell.v).trim();
      }
      
      // Customer name
      if (/customer/i.test(text) || /client/i.test(text)) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
        if (valueCell?.v) info.customerName = String(valueCell.v).trim();
      }
      
      // Date
      if (/date/i.test(text)) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
        if (valueCell?.v) {
          // Handle Excel date numbers
          if (typeof valueCell.v === "number") {
            const date = XLSX.SSF.parse_date_code(valueCell.v);
            info.date = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
          } else {
            info.date = String(valueCell.v).trim();
          }
        }
      }
      
      // Page number
      if (/page/i.test(text)) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
        if (valueCell?.v) {
          const match = String(valueCell.v).match(/(\d+)(?:\s*(?:of|\/)\s*(\d+))?/i);
          if (match) {
            info.pageNumber = parseInt(match[1], 10);
            if (match[2]) info.totalPages = parseInt(match[2], 10);
          }
        }
      }
    }
  }
  
  return Object.keys(info).length > 0 ? info : undefined;
}

// ============================================================
// DATA ROW PARSING
// ============================================================

interface RowData {
  [key: string]: string;
}

/**
 * Extract a row of data using column mapping
 */
function extractRow(
  sheet: XLSX.WorkSheet,
  row: number,
  mapping: Map<string, number>
): RowData {
  const data: RowData = {};
  
  for (const [field, col] of mapping.entries()) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    data[field] = cell?.v !== undefined ? String(cell.v).trim() : "";
  }
  
  return data;
}

/**
 * Check if row is empty
 */
function isEmptyRow(row: RowData): boolean {
  const keyFields = ["L", "W", "label"];
  return keyFields.every(f => !row[f] || row[f] === "0" || row[f] === "");
}

/**
 * Parse a data row into a CutPart
 */
function parseDataRow(
  row: RowData,
  rowIndex: number,
  options: TemplateParseOptions
): CutPart | null {
  // Get dimensions
  const length = parseNumber(row.L);
  const width = parseNumber(row.W);
  
  if (!length || length <= 0 || !width || width <= 0) {
    return null;
  }
  
  // Get other fields
  const label = row.label || undefined;
  const qty = Math.max(1, Math.round(parseNumber(row.qty) || 1));
  const thickness = parseNumber(row.thk) || options.defaultThicknessMm || 18;
  const material = row.material || options.defaultMaterialId || "default";
  const notes = row.notes || undefined;
  
  // Parse grain
  const grainValue = (row.grain || "").toLowerCase();
  let grain: "none" | "along_L" = "none";
  let allowRotation = true;
  
  if (grainValue && !/^(no|none|n\/a|-|0)$/i.test(grainValue)) {
    grain = "along_L"; // Any grain direction = along_L in our model
    allowRotation = false;
  }
  
  // Parse edgebanding
  const edging = parseEdgebanding(row);
  
  // Parse grooves
  const grooves = parseGrooves(row);
  
  // Parse holes
  const holes = parseHoles(row);
  
  // Build ops object
  const ops: CutPart["ops"] = {};
  if (edging && Object.keys(edging).length > 0) ops.edging = edging;
  if (grooves && grooves.length > 0) ops.grooves = grooves;
  if (holes && holes.length > 0) ops.holes = holes;
  
  return {
    part_id: generateId("P"),
    label,
    qty,
    size: { L: length, W: width },
    thickness_mm: thickness,
    material_id: material,
    grain,
    allow_rotation: allowRotation,
    ops: Object.keys(ops).length > 0 ? ops : undefined,
    notes: notes ? { operator: notes } : undefined,
    audit: {
      source_method: "template_excel",
      source_ref: `row:${rowIndex + 1}`,
      confidence: 0.98,
      human_verified: false,
    },
  };
}

/**
 * Parse number from string
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value.replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
}

/**
 * Parse edgebanding from row
 */
function parseEdgebanding(row: RowData): CutPart["ops"]["edging"] | undefined {
  const edging: NonNullable<CutPart["ops"]["edging"]> = {};
  
  // Per-side columns
  if (row.eb_L1) edging.L1 = row.eb_L1;
  if (row.eb_L2) edging.L2 = row.eb_L2;
  if (row.eb_W1) edging.W1 = row.eb_W1;
  if (row.eb_W2) edging.W2 = row.eb_W2;
  
  // Or a single shortcode column
  if (row.edgeband || row.eb || row.edge) {
    const code = row.edgeband || row.eb || row.edge;
    const edges = parseEdgeCode(code);
    for (const edge of edges) {
      edging[edge] = "default";
    }
  }
  
  return Object.keys(edging).length > 0 ? edging : undefined;
}

/**
 * Parse grooves from row
 */
function parseGrooves(row: RowData): CutPart["ops"]["grooves"] | undefined {
  if (!row.grv_side) return undefined;
  
  const side = row.grv_side.toUpperCase();
  const depth = parseNumber(row.grv_d) || 10;
  const width = parseNumber(row.grv_w) || 4;
  
  // Determine which sides
  const grooves: NonNullable<CutPart["ops"]["grooves"]> = [];
  
  if (side.includes("L") || side.includes("ALL")) {
    grooves.push({
      side: "L1",
      distance_from_ref_mm: 10,
      width_mm: width,
      depth_mm: depth,
    });
  }
  if (side.includes("W") || side.includes("ALL")) {
    grooves.push({
      side: "W1",
      distance_from_ref_mm: 10,
      width_mm: width,
      depth_mm: depth,
    });
  }
  
  return grooves.length > 0 ? grooves : undefined;
}

/**
 * Parse holes from row
 */
function parseHoles(row: RowData): CutPart["ops"]["holes"] | undefined {
  if (!row.hole_pattern) return undefined;
  
  const pattern = row.hole_pattern.toUpperCase();
  const dia = parseNumber(row.hole_dia) || 5;
  const depth = parseNumber(row.hole_depth) || 12;
  
  const holes: NonNullable<CutPart["ops"]["holes"]> = [];
  
  // Parse common patterns
  if (pattern.includes("H2") || pattern.includes("HINGE")) {
    holes.push({
      pattern_id: "hinge-2",
      count: 2,
      diameter_mm: 35,
      depth_mm: 12,
    });
  } else if (pattern.includes("SP") || pattern.includes("SHELF")) {
    holes.push({
      pattern_id: "shelf-pins",
      count: 8,
      diameter_mm: dia,
      depth_mm: depth,
    });
  } else if (pattern) {
    holes.push({
      pattern_id: pattern.toLowerCase(),
      diameter_mm: dia,
      depth_mm: depth,
    });
  }
  
  return holes.length > 0 ? holes : undefined;
}

