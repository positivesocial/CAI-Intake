/**
 * CAI Intake - Excel/CSV Parser
 * 
 * Parses Excel and CSV files into canonical CutPart objects.
 * Supports column mapping and data extraction.
 */

import type { CutPart, IngestionMethod, GrainMode } from "../schema";
import { generateId, parseNumber } from "../utils";
import { DEFAULTS } from "../constants";

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  label?: number | string;
  qty?: number | string;
  L?: number | string;
  W?: number | string;
  thickness_mm?: number | string;
  material?: number | string;
  grain?: number | string;
  group_id?: number | string;
  notes?: number | string;
  edging_L1?: number | string;
  edging_L2?: number | string;
  edging_W1?: number | string;
  edging_W2?: number | string;
}

/**
 * Parse options
 */
export interface ExcelParseOptions {
  headerRowIndex?: number;
  dataRowStart?: number;
  dataRowEnd?: number;
  mapping: ColumnMapping;
  defaultThicknessMm?: number;
  defaultMaterialId?: string;
  sourceMethod?: IngestionMethod;
}

/**
 * Parsed row result
 */
export interface ParsedRow {
  rowIndex: number;
  part: CutPart | null;
  confidence: number;
  warnings: string[];
  errors: string[];
  rawData: Record<string, string>;
}

/**
 * Excel parse result
 */
export interface ExcelParseResult {
  rows: ParsedRow[];
  headers: string[];
  totalRows: number;
  successCount: number;
  errorCount: number;
  averageConfidence: number;
}

/**
 * Get value from row by column reference (index or header name)
 */
function getColumnValue(
  row: string[],
  headers: string[],
  ref: number | string | undefined
): string | undefined {
  if (ref === undefined) return undefined;

  if (typeof ref === "number") {
    return row[ref]?.trim();
  }

  // Find by header name (case-insensitive)
  const headerIndex = headers.findIndex(
    (h) => h.toLowerCase() === ref.toLowerCase()
  );
  if (headerIndex >= 0) {
    return row[headerIndex]?.trim();
  }

  return undefined;
}

/**
 * Parse grain value from string
 */
function parseGrain(value: string | undefined): GrainMode {
  if (!value) return "none";
  const lower = value.toLowerCase();
  if (
    lower === "yes" ||
    lower === "true" ||
    lower === "1" ||
    lower === "gl" ||
    lower === "along_l" ||
    lower.includes("grain") ||
    lower.includes("length")
  ) {
    return "along_L";
  }
  return "none";
}

/**
 * Parse edging value from string
 */
function parseEdging(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower === "yes" ||
    lower === "true" ||
    lower === "1" ||
    lower === "y" ||
    lower === "x" ||
    lower === "✓" ||
    lower === "✔"
  );
}

/**
 * Parse a single row
 */
function parseRow(
  row: string[],
  rowIndex: number,
  headers: string[],
  options: ExcelParseOptions
): ParsedRow {
  const { mapping, defaultThicknessMm, defaultMaterialId, sourceMethod } =
    options;
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence = 1.0;

  // Extract raw data for display
  const rawData: Record<string, string> = {};
  headers.forEach((h, i) => {
    rawData[h] = row[i] || "";
  });

  // Get values
  const label = getColumnValue(row, headers, mapping.label);
  const qtyStr = getColumnValue(row, headers, mapping.qty);
  const LStr = getColumnValue(row, headers, mapping.L);
  const WStr = getColumnValue(row, headers, mapping.W);
  const thkStr = getColumnValue(row, headers, mapping.thickness_mm);
  const material = getColumnValue(row, headers, mapping.material);
  const grainStr = getColumnValue(row, headers, mapping.grain);
  const groupId = getColumnValue(row, headers, mapping.group_id);
  const notes = getColumnValue(row, headers, mapping.notes);

  // Parse dimensions (required)
  const L = parseNumber(LStr);
  const W = parseNumber(WStr);

  if (!L || L <= 0) {
    errors.push("Missing or invalid Length");
    return {
      rowIndex,
      part: null,
      confidence: 0,
      warnings,
      errors,
      rawData,
    };
  }

  if (!W || W <= 0) {
    errors.push("Missing or invalid Width");
    return {
      rowIndex,
      part: null,
      confidence: 0,
      warnings,
      errors,
      rawData,
    };
  }

  // Parse quantity
  let qty = parseNumber(qtyStr) ?? 1;
  if (qty <= 0) {
    warnings.push("Invalid quantity, defaulting to 1");
    qty = 1;
    confidence *= 0.9;
  }

  // Parse thickness
  const thickness_mm =
    parseNumber(thkStr) ?? defaultThicknessMm ?? DEFAULTS.THICKNESS_MM;

  // Parse grain
  const grain = parseGrain(grainStr);

  // Parse edging
  const edgingL1 = parseEdging(getColumnValue(row, headers, mapping.edging_L1));
  const edgingL2 = parseEdging(getColumnValue(row, headers, mapping.edging_L2));
  const edgingW1 = parseEdging(getColumnValue(row, headers, mapping.edging_W1));
  const edgingW2 = parseEdging(getColumnValue(row, headers, mapping.edging_W2));
  const hasEdging = edgingL1 || edgingL2 || edgingW1 || edgingW2;

  // Build part
  const part: CutPart = {
    part_id: generateId("P"),
    label: label || undefined,
    qty,
    size: { L, W },
    thickness_mm,
    material_id: material || defaultMaterialId || "default",
    grain,
    allow_rotation: grain === "none",
    group_id: groupId || undefined,
    notes: notes ? { operator: notes } : undefined,
    audit: {
      source_method: sourceMethod ?? "excel_table",
      confidence,
      human_verified: false,
    },
  };

  // Add edging if any
  if (hasEdging) {
    part.ops = {
      edging: {
        edges: {
          ...(edgingL1 && { L1: { apply: true } }),
          ...(edgingL2 && { L2: { apply: true } }),
          ...(edgingW1 && { W1: { apply: true } }),
          ...(edgingW2 && { W2: { apply: true } }),
        },
      },
    };
  }

  return {
    rowIndex,
    part,
    confidence,
    warnings,
    errors,
    rawData,
  };
}

/**
 * Parse CSV text into rows
 */
export function parseCSV(text: string, delimiter: string = ","): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    // Simple CSV parsing (doesn't handle quoted fields with delimiters)
    // For production, use a proper CSV library like papaparse
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());

    return cells;
  });
}

/**
 * Parse Excel/CSV data with mapping
 */
export function parseExcelData(
  rows: string[][],
  options: ExcelParseOptions
): ExcelParseResult {
  const {
    headerRowIndex = 0,
    dataRowStart = 1,
    dataRowEnd = rows.length - 1,
  } = options;

  const headers = rows[headerRowIndex] || [];
  const dataRows = rows.slice(dataRowStart, dataRowEnd + 1);

  const parsedRows: ParsedRow[] = [];
  let totalConfidence = 0;
  let successCount = 0;
  let errorCount = 0;

  dataRows.forEach((row, i) => {
    // Skip empty rows
    if (row.every((cell) => !cell.trim())) return;

    const result = parseRow(row, dataRowStart + i, headers, options);
    parsedRows.push(result);

    if (result.part) {
      successCount++;
      totalConfidence += result.confidence;
    } else {
      errorCount++;
    }
  });

  return {
    rows: parsedRows,
    headers,
    totalRows: dataRows.length,
    successCount,
    errorCount,
    averageConfidence:
      successCount > 0 ? totalConfidence / successCount : 0,
  };
}

/**
 * Auto-detect column mapping from headers
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  const patterns: Record<keyof ColumnMapping, RegExp[]> = {
    label: [/^(label|name|part|description|desc)$/i, /part.*name/i],
    qty: [/^(qty|quantity|count|pcs|pieces?)$/i, /^q$/i],
    L: [/^(l|length|len|long)$/i],
    W: [/^(w|width|wid|short)$/i],
    thickness_mm: [/^(t|thk|thickness|thck)$/i, /^(mm)$/i],
    material: [/^(mat|material|board|stock)$/i],
    grain: [/^(grain|gr|direction|dir)$/i, /^(gl)$/i],
    group_id: [/^(group|grp|cabinet|cab|assembly)$/i],
    notes: [/^(note|notes|comment|comments|remark)$/i],
    edging_L1: [/^(eb.*l1|edge.*l1|l1.*edge|band.*l1)$/i, /^l1$/i],
    edging_L2: [/^(eb.*l2|edge.*l2|l2.*edge|band.*l2)$/i, /^l2$/i],
    edging_W1: [/^(eb.*w1|edge.*w1|w1.*edge|band.*w1)$/i, /^w1$/i],
    edging_W2: [/^(eb.*w2|edge.*w2|w2.*edge|band.*w2)$/i, /^w2$/i],
  };

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [field, regexes] of Object.entries(patterns)) {
      if (mapping[field as keyof ColumnMapping] !== undefined) continue;

      for (const regex of regexes) {
        if (regex.test(normalizedHeader)) {
          mapping[field as keyof ColumnMapping] = index;
          break;
        }
      }
    }
  });

  return mapping;
}

/**
 * Get suggested column for a field based on header similarity
 */
export function suggestColumn(
  headers: string[],
  field: keyof ColumnMapping
): number | undefined {
  const mapping = autoDetectMapping(headers);
  const suggested = mapping[field];
  return typeof suggested === "number" ? suggested : undefined;
}




