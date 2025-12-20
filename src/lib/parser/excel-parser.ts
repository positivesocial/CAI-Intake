/**
 * CAI Intake - Excel/CSV Parser
 * 
 * Parses Excel (xlsx, xls) and CSV files into CutPart objects.
 * Includes intelligent header detection and column mapping.
 */

import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

export interface ColumnMapping {
  label?: string;
  length?: string;
  width?: string;
  thickness?: string;
  qty?: string;
  material?: string;
  grain?: string;
  rotation?: string;
  group?: string;
  notes?: string;
}

export interface ExcelParseOptions {
  /** Column mapping configuration */
  mapping?: ColumnMapping;
  /** Sheet name or index to parse (default: first sheet) */
  sheet?: string | number;
  /** Row number where data starts (1-indexed, default: auto-detect) */
  dataStartRow?: number;
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness in mm */
  defaultThickness?: number;
  /** Skip empty rows */
  skipEmpty?: boolean;
}

export interface ExcelParseResult {
  success: boolean;
  parts: CutPart[];
  headers: string[];
  detectedMapping: ColumnMapping;
  stats: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    errors: number;
  };
  errors: Array<{ row: number; error: string }>;
  warnings: string[];
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
}

// ============================================================
// HEADER DETECTION
// ============================================================

const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  label: [/^name$/i, /^label$/i, /^part$/i, /^description$/i, /^desc$/i, /^part\s*name$/i, /^component$/i],
  length: [/^length$/i, /^len$/i, /^l$/i, /^long$/i, /^länge$/i, /^largo$/i],
  width: [/^width$/i, /^wid$/i, /^w$/i, /^wide$/i, /^breite$/i, /^ancho$/i],
  thickness: [/^thick(?:ness)?$/i, /^thk$/i, /^t$/i, /^depth$/i, /^stärke$/i],
  qty: [/^qty$/i, /^quantity$/i, /^count$/i, /^pcs$/i, /^pieces$/i, /^anzahl$/i, /^cantidad$/i, /^#$/],
  material: [/^material$/i, /^mat$/i, /^board$/i, /^stock$/i, /^substrate$/i],
  grain: [/^grain$/i, /^direction$/i, /^dir$/i, /^gl$/i, /^gw$/i],
  rotation: [/^rotat(?:e|ion)?$/i, /^can\s*rotate$/i, /^allow\s*rotat/i],
  group: [/^group$/i, /^cabinet$/i, /^assembly$/i, /^set$/i, /^unit$/i],
  notes: [/^notes?$/i, /^comment$/i, /^remark$/i, /^info$/i],
};

/**
 * Detect column mapping from headers
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  // Match each field to best header
  for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const normalizedHeader = header.trim().toLowerCase();
      for (const pattern of patterns) {
        if (pattern.test(normalizedHeader)) {
          mapping[field as keyof ColumnMapping] = header;
          usedHeaders.add(header);
          break;
        }
      }
      if (mapping[field as keyof ColumnMapping]) break;
    }
  }

  // Try dimension patterns (e.g., "L (mm)", "Width mm")
  for (const header of headers) {
    if (usedHeaders.has(header)) continue;
    
    const normalized = header.toLowerCase();
    if (/l\s*[\(\[]?\s*mm/i.test(normalized) && !mapping.length) {
      mapping.length = header;
      usedHeaders.add(header);
    } else if (/w\s*[\(\[]?\s*mm/i.test(normalized) && !mapping.width) {
      mapping.width = header;
      usedHeaders.add(header);
    } else if (/t\s*[\(\[]?\s*mm/i.test(normalized) && !mapping.thickness) {
      mapping.thickness = header;
      usedHeaders.add(header);
    }
  }

  return mapping;
}

/**
 * Validate that required columns are mapped
 */
export function validateMapping(mapping: ColumnMapping): { valid: boolean; missing: string[] } {
  const required = ["length", "width"];
  const missing: string[] = [];
  
  for (const field of required) {
    if (!mapping[field as keyof ColumnMapping]) {
      missing.push(field);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

// ============================================================
// EXCEL PARSING
// ============================================================

/**
 * Get information about sheets in an Excel file
 */
export function getSheetInfo(buffer: ArrayBuffer): SheetInfo[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    
    // Get headers from first row
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
      headers.push(cell?.v?.toString() ?? `Column ${col + 1}`);
    }
    
    return {
      name,
      rowCount: range.e.r + 1,
      columnCount: range.e.c + 1,
      headers,
    };
  });
}

/**
 * Parse an Excel file into CutPart objects
 */
export function parseExcel(
  buffer: ArrayBuffer,
  options: ExcelParseOptions = {}
): ExcelParseResult {
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
      success: false,
      parts: [],
      headers: [],
      detectedMapping: {},
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errors: 1 },
      errors: [{ row: 0, error: `Sheet "${sheetName}" not found` }],
      warnings: [],
    };
  }
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  
  if (data.length === 0) {
    return {
      success: false,
      parts: [],
      headers: [],
      detectedMapping: {},
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errors: 1 },
      errors: [{ row: 0, error: "No data found in sheet" }],
      warnings: [],
    };
  }
  
  // Get headers
  const headers = Object.keys(data[0]);
  
  // Detect or use provided mapping
  const mapping = options.mapping ?? detectColumnMapping(headers);
  const { valid, missing } = validateMapping(mapping);
  
  if (!valid) {
    return {
      success: false,
      parts: [],
      headers,
      detectedMapping: mapping,
      stats: { totalRows: data.length, parsedRows: 0, skippedRows: 0, errors: 1 },
      errors: [{ row: 0, error: `Missing required columns: ${missing.join(", ")}` }],
      warnings: [],
    };
  }
  
  // Parse rows
  return parseRows(data, headers, mapping, options);
}

/**
 * Parse a CSV file into CutPart objects
 */
export function parseCsv(
  content: string,
  options: ExcelParseOptions = {}
): ExcelParseResult {
  const parseResult = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  
  if (parseResult.errors.length > 0) {
    return {
      success: false,
      parts: [],
      headers: [],
      detectedMapping: {},
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errors: parseResult.errors.length },
      errors: parseResult.errors.map((e, i) => ({ row: e.row ?? i, error: e.message })),
      warnings: [],
    };
  }
  
  const data = parseResult.data;
  
  if (data.length === 0) {
    return {
      success: false,
      parts: [],
      headers: [],
      detectedMapping: {},
      stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, errors: 1 },
      errors: [{ row: 0, error: "No data found in CSV" }],
      warnings: [],
    };
  }
  
  // Get headers
  const headers = parseResult.meta.fields ?? [];
  
  // Detect or use provided mapping
  const mapping = options.mapping ?? detectColumnMapping(headers);
  const { valid, missing } = validateMapping(mapping);
  
  if (!valid) {
    return {
      success: false,
      parts: [],
      headers,
      detectedMapping: mapping,
      stats: { totalRows: data.length, parsedRows: 0, skippedRows: 0, errors: 1 },
      errors: [{ row: 0, error: `Missing required columns: ${missing.join(", ")}` }],
      warnings: [],
    };
  }
  
  return parseRows(data, headers, mapping, options);
}

// ============================================================
// ROW PARSING
// ============================================================

function parseRows(
  data: Record<string, unknown>[],
  headers: string[],
  mapping: ColumnMapping,
  options: ExcelParseOptions
): ExcelParseResult {
  const parts: CutPart[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  const warnings: string[] = [];
  let skippedRows = 0;
  
  const startRow = options.dataStartRow ? options.dataStartRow - 1 : 0;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // Excel is 1-indexed, plus header row
    
    try {
      // Get values from mapped columns
      const getValue = (field: keyof ColumnMapping): string => {
        const col = mapping[field];
        if (!col) return "";
        const val = row[col];
        return val?.toString().trim() ?? "";
      };
      
      const getNumber = (field: keyof ColumnMapping): number | null => {
        const val = getValue(field);
        if (!val) return null;
        const num = parseFloat(val.replace(/[^\d.-]/g, ""));
        return isNaN(num) ? null : num;
      };
      
      // Extract values
      const length = getNumber("length");
      const width = getNumber("width");
      
      // Skip empty rows
      if ((length === null || length === 0) && (width === null || width === 0)) {
        if (options.skipEmpty !== false) {
          skippedRows++;
          continue;
        }
      }
      
      // Validate required fields
      if (length === null || length <= 0) {
        errors.push({ row: rowNum, error: "Invalid or missing length" });
        continue;
      }
      if (width === null || width <= 0) {
        errors.push({ row: rowNum, error: "Invalid or missing width" });
        continue;
      }
      
      // Get optional fields
      const label = getValue("label") || undefined;
      const thickness = getNumber("thickness") ?? options.defaultThickness ?? 18;
      const qty = Math.max(1, Math.round(getNumber("qty") ?? 1));
      const material = getValue("material") || options.defaultMaterialId || "default";
      const group = getValue("group") || undefined;
      const notes = getValue("notes") || undefined;
      
      // Handle grain/rotation
      const grainValue = getValue("grain").toLowerCase();
      const rotationValue = getValue("rotation").toLowerCase();
      
      let grain = "none";
      let allowRotation = true;
      
      if (grainValue) {
        if (/^(?:l|length|along_l|gl)$/i.test(grainValue)) {
          grain = "along_L";
          allowRotation = false;
        } else if (/^(?:w|width|along_w|gw)$/i.test(grainValue)) {
          grain = "along_W";
          allowRotation = false;
        }
      }
      
      if (rotationValue) {
        if (/^(?:no|false|0|n)$/i.test(rotationValue)) {
          allowRotation = false;
        } else if (/^(?:yes|true|1|y)$/i.test(rotationValue)) {
          allowRotation = true;
        }
      }
      
      // Create part
      const part: CutPart = {
        part_id: generateId("P"),
        label,
        qty,
        size: { L: length, W: width },
        thickness_mm: thickness,
        material_id: material,
        grain: grain === "along_W" ? "along_L" : grain as "none" | "along_L",
        allow_rotation: allowRotation,
        group_id: group,
        notes: notes ? { operator: notes } : undefined,
        audit: {
          source_method: "excel_table",
          source_ref: `row:${rowNum}`,
          confidence: 0.9,
          human_verified: false,
        },
      };
      
      parts.push(part);
      
    } catch (err) {
      errors.push({ row: rowNum, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  
  return {
    success: parts.length > 0,
    parts,
    headers,
    detectedMapping: mapping,
    stats: {
      totalRows: data.length,
      parsedRows: parts.length,
      skippedRows,
      errors: errors.length,
    },
    errors,
    warnings,
  };
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Generate a sample mapping preview
 */
export function previewMapping(
  data: Record<string, unknown>[],
  mapping: ColumnMapping,
  maxRows: number = 5
): Array<{ row: number; preview: Record<string, string | number | null> }> {
  const preview: Array<{ row: number; preview: Record<string, string | number | null> }> = [];
  
  for (let i = 0; i < Math.min(data.length, maxRows); i++) {
    const row = data[i];
    const mappedRow: Record<string, string | number | null> = {};
    
    for (const [field, column] of Object.entries(mapping)) {
      if (column) {
        const val = row[column];
        mappedRow[field] = val?.toString() ?? null;
      }
    }
    
    preview.push({ row: i + 2, preview: mappedRow });
  }
  
  return preview;
}

