/**
 * CAI Intake - CSV Wizard Preview API
 * 
 * POST /api/v1/csv-wizard/preview
 * Preview parsed data with custom column mapping.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

const PreviewRequestSchema = z.object({
  /** Column mapping configuration */
  columnMapping: z.record(z.string(), z.string()),
  /** Whether first row has headers */
  hasHeaders: z.boolean().default(true),
  /** Rows to skip (for title rows) */
  skipRows: z.number().min(0).max(100).default(0),
  /** Default material ID */
  defaultMaterialId: z.string().optional(),
  /** Default thickness in mm */
  defaultThicknessMm: z.number().optional(),
  /** Max rows to preview */
  maxPreviewRows: z.number().min(1).max(100).default(20),
});

type PreviewRequest = z.infer<typeof PreviewRequestSchema>;

interface PreviewResult {
  success: boolean;
  /** Parsed parts */
  parts: CutPart[];
  /** Total rows in file */
  totalRows: number;
  /** Rows successfully parsed */
  parsedRows: number;
  /** Rows with errors */
  errorRows: Array<{ row: number; error: string; data: Record<string, string> }>;
  /** Warnings */
  warnings: string[];
}

// ============================================================
// PARSING
// ============================================================

/**
 * Parse data using custom column mapping
 */
function parseWithMapping(
  rows: string[][],
  headers: string[],
  config: PreviewRequest
): PreviewResult {
  const { columnMapping, skipRows, defaultMaterialId, defaultThicknessMm, maxPreviewRows } = config;
  
  const parts: CutPart[] = [];
  const errorRows: PreviewResult["errorRows"] = [];
  const warnings: string[] = [];
  
  // Create reverse mapping: target field -> column index
  const fieldToIndex: Record<string, number> = {};
  for (const [field, headerName] of Object.entries(columnMapping)) {
    const idx = headers.indexOf(headerName);
    if (idx >= 0) {
      fieldToIndex[field] = idx;
    }
  }
  
  // Check required columns
  if (fieldToIndex.length === undefined) {
    warnings.push("Length column not mapped");
  }
  if (fieldToIndex.width === undefined) {
    warnings.push("Width column not mapped");
  }
  
  // Parse rows
  const startRow = skipRows;
  const endRow = Math.min(rows.length, startRow + maxPreviewRows);
  
  for (let i = startRow; i < endRow; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 1-indexed for user display
    
    // Build row data object
    const rowData: Record<string, string> = {};
    for (const [field, idx] of Object.entries(fieldToIndex)) {
      rowData[field] = row[idx]?.trim() || "";
    }
    
    try {
      const part = parseRow(rowData, rowNum, defaultMaterialId, defaultThicknessMm);
      if (part) {
        parts.push(part);
      }
    } catch (error) {
      errorRows.push({
        row: rowNum,
        error: error instanceof Error ? error.message : "Parse error",
        data: rowData,
      });
    }
  }
  
  return {
    success: parts.length > 0,
    parts,
    totalRows: rows.length - skipRows,
    parsedRows: parts.length,
    errorRows,
    warnings,
  };
}

/**
 * Parse a single row into a CutPart
 */
function parseRow(
  data: Record<string, string>,
  rowNum: number,
  defaultMaterialId?: string,
  defaultThicknessMm?: number
): CutPart | null {
  const getNumber = (field: string): number | null => {
    const val = data[field];
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
  
  // Validate dimensions
  if (length === null || length <= 0) {
    throw new Error("Invalid or missing length");
  }
  if (width === null || width <= 0) {
    throw new Error("Invalid or missing width");
  }
  
  // Get optional fields
  const label = data.partName || data.label || undefined;
  const thickness = getNumber("thickness") ?? defaultThicknessMm ?? 18;
  const qty = Math.max(1, Math.round(getNumber("quantity") ?? 1));
  const material = data.material || data.materialName || defaultMaterialId || "default";
  const notes = data.notes || undefined;
  
  // Parse grain
  const grainValue = (data.grain || "").toLowerCase();
  let grain: "none" | "along_L" = "none";
  let allowRotation = true;
  
  if (grainValue && !/^(no|none|n\/a|-|0)$/i.test(grainValue)) {
    grain = "along_L";
    allowRotation = false;
  }
  
  // Parse edgebanding
  let ops: CutPart["ops"] | undefined;
  const edgebandValue = (data.edgebanding || data.banding || "").toUpperCase();
  if (edgebandValue) {
    ops = { edging: parseEdgeShortcode(edgebandValue) };
  }
  
  return {
    part_id: generateId("P"),
    label,
    qty,
    size: { L: length, W: width },
    thickness_mm: thickness,
    material_id: material,
    grain,
    allow_rotation: allowRotation,
    ops,
    notes: notes ? { operator: notes } : undefined,
    audit: {
      source_method: "excel_table",
      source_ref: `csv_wizard:row:${rowNum}`,
      confidence: 0.9,
      human_verified: false,
    },
  };
}

/**
 * Parse edge banding shortcode
 */
function parseEdgeShortcode(code: string): CutPart["ops"]["edging"] {
  const normalized = code.trim().toUpperCase();
  
  const mappings: Record<string, string[]> = {
    "2L2W": ["L1", "L2", "W1", "W2"],
    "ALL": ["L1", "L2", "W1", "W2"],
    "4": ["L1", "L2", "W1", "W2"],
    "2L": ["L1", "L2"],
    "2W": ["W1", "W2"],
    "L": ["L1"],
    "W": ["W1"],
    "L1": ["L1"],
    "L2": ["L2"],
    "W1": ["W1"],
    "W2": ["W2"],
    "L2W": ["L1", "W1", "W2"],
    "2L1W": ["L1", "L2", "W1"],
  };
  
  const edgeList = mappings[normalized];
  if (!edgeList || edgeList.length === 0) {
    return undefined;
  }
  
  const edges: Record<string, { apply: boolean; edgeband_id?: string }> = {};
  for (const edge of edgeList) {
    edges[edge] = { apply: true };
  }
  
  return { edges };
}

// ============================================================
// API HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "parseJobs");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const configStr = formData.get("config") as string | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }
    
    if (!configStr) {
      return NextResponse.json(
        { success: false, error: "No configuration provided" },
        { status: 400 }
      );
    }

    // Parse configuration
    let config: PreviewRequest;
    try {
      const parsed = JSON.parse(configStr);
      const validated = PreviewRequestSchema.parse(parsed);
      config = validated;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid configuration" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    
    // Parse file
    let headers: string[];
    let dataRows: string[][];
    
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { 
        defval: "",
        header: 1
      }) as string[][];
      
      if (!config.hasHeaders) {
        // Generate column headers
        headers = data[0]?.map((_, i) => `Column ${i + 1}`) || [];
        dataRows = data;
      } else {
        headers = data[0]?.map(h => String(h).trim()) || [];
        dataRows = data.slice(1);
      }
    } else {
      const content = await file.text();
      const parseResult = Papa.parse<string[]>(content, {
        skipEmptyLines: true,
      });
      
      if (!config.hasHeaders) {
        headers = parseResult.data[0]?.map((_, i) => `Column ${i + 1}`) || [];
        dataRows = parseResult.data;
      } else {
        headers = parseResult.data[0]?.map(h => h.trim()) || [];
        dataRows = parseResult.data.slice(1);
      }
    }

    // Parse with mapping
    const result = parseWithMapping(dataRows, headers, config);

    return NextResponse.json(result);

  } catch (error) {
    logger.error("CSV Wizard preview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview data" },
      { status: 500 }
    );
  }
}

