/**
 * CAI Intake - CSV Wizard Detection API
 * 
 * POST /api/v1/csv-wizard/detect
 * Analyze CSV/Excel file structure and suggest column mappings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import { detectColumnMapping } from "@/lib/parser/excel-parser";
import { classifyDocument, DocType } from "@/lib/templates/template-detector";

// ============================================================
// TYPES
// ============================================================

interface DetectionResult {
  /** Detection success */
  success: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Whether manual wizard is needed */
  needsWizard: boolean;
  /** Suggested processing mode */
  suggestedMode: "auto" | "manual" | "template";
  /** Detected headers */
  detectedHeaders: string[];
  /** Sample data rows (first 5) */
  sampleRows: string[][];
  /** Suggested column mapping */
  suggestedMapping?: Record<string, string>;
  /** File metadata */
  metadata: {
    fileName: string;
    fileType: "csv" | "excel";
    totalRows: number;
    hasHeaders: boolean;
    delimiter?: string;
    sheetCount?: number;
    sheetNames?: string[];
  };
  /** Template detection result */
  templateDetection?: {
    isTemplate: boolean;
    templateId?: string;
    version?: string;
    confidence: number;
  };
}

// ============================================================
// COLUMN DETECTION
// ============================================================

/** Standard field patterns for detection */
const FIELD_PATTERNS: Record<string, { regex: RegExp[]; required: boolean; weight: number }> = {
  length: {
    regex: [/^length$/i, /^len$/i, /^l$/i, /^long$/i, /^dimension1$/i, /l\s*[\(\[]?mm/i],
    required: true,
    weight: 20,
  },
  width: {
    regex: [/^width$/i, /^wid$/i, /^w$/i, /^wide$/i, /^dimension2$/i, /w\s*[\(\[]?mm/i],
    required: true,
    weight: 20,
  },
  thickness: {
    regex: [/^thick(ness)?$/i, /^thk$/i, /^t$/i, /^depth$/i, /t\s*[\(\[]?mm/i],
    required: false,
    weight: 10,
  },
  quantity: {
    regex: [/^qty$/i, /^quantity$/i, /^count$/i, /^pcs$/i, /^pieces$/i, /^#$/],
    required: false,
    weight: 10,
  },
  partName: {
    regex: [/^name$/i, /^label$/i, /^part$/i, /^description$/i, /^component$/i],
    required: false,
    weight: 10,
  },
  material: {
    regex: [/^material$/i, /^mat$/i, /^board$/i, /^stock$/i, /^substrate$/i],
    required: false,
    weight: 5,
  },
  grain: {
    regex: [/^grain$/i, /^direction$/i, /^dir$/i, /^gl$/i, /^gw$/i],
    required: false,
    weight: 5,
  },
  edgebanding: {
    regex: [/^edge/i, /^band/i, /^eb$/i, /^tape$/i],
    required: false,
    weight: 5,
  },
  notes: {
    regex: [/^notes?$/i, /^comment$/i, /^remark$/i, /^info$/i],
    required: false,
    weight: 5,
  },
};

/**
 * Calculate detection confidence
 */
function calculateConfidence(
  mapping: Record<string, string>,
  headers: string[],
  sampleRows: string[][]
): number {
  let score = 0;
  const maxScore = Object.values(FIELD_PATTERNS).reduce((sum, p) => sum + p.weight, 0);
  
  // Add points for each matched field
  for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {
    if (mapping[field]) {
      score += pattern.weight;
    }
  }
  
  // Bonus for required fields
  if (mapping.length && mapping.width) {
    score += 10;
  }
  
  // Bonus for consistent data
  if (sampleRows.length > 0) {
    const columnCount = headers.length;
    const consistentRows = sampleRows.filter(row => row.length === columnCount);
    if (consistentRows.length === sampleRows.length) {
      score += 10;
    }
  }
  
  // Bonus for having headers
  const numericHeaders = headers.filter(h => /^\d+$/.test(h.trim())).length;
  if (numericHeaders < headers.length * 0.3) {
    score += 5;
  }
  
  return Math.min(100, Math.round((score / maxScore) * 100));
}

/**
 * Detect column mapping from headers
 */
function detectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedColumns = new Set<string>();
  
  for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {
    for (const header of headers) {
      if (usedColumns.has(header)) continue;
      
      const normalized = header.trim();
      for (const regex of pattern.regex) {
        if (regex.test(normalized)) {
          mapping[field] = header;
          usedColumns.add(header);
          break;
        }
      }
      if (mapping[field]) break;
    }
  }
  
  return mapping;
}

// ============================================================
// FILE PARSING
// ============================================================

/**
 * Parse Excel file and extract structure
 */
async function parseExcel(buffer: ArrayBuffer): Promise<{
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  sheetCount: number;
  sheetNames: string[];
}> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    throw new Error("No sheet found in Excel file");
  }
  
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { 
    defval: "",
    header: 1 // Get as 2D array
  }) as unknown[][];
  
  if (data.length === 0) {
    throw new Error("No data found in Excel file");
  }
  
  const headers = (data[0] || []).map(h => String(h || "").trim());
  const sampleRows = data.slice(1, 6).map(row => 
    (row as unknown[]).map(cell => String(cell || "").trim())
  );
  
  return {
    headers,
    sampleRows,
    totalRows: data.length - 1,
    sheetCount: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
  };
}

/**
 * Parse CSV content and extract structure
 */
function parseCSV(content: string): {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  delimiter: string;
} {
  // Detect delimiter
  const firstLine = content.split("\n")[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  
  let delimiter = ",";
  if (tabCount > commaCount && tabCount > semicolonCount) delimiter = "\t";
  else if (semicolonCount > commaCount) delimiter = ";";
  
  const parseResult = Papa.parse<string[]>(content, {
    delimiter,
    skipEmptyLines: true,
  });
  
  if (parseResult.errors.length > 0 || parseResult.data.length === 0) {
    throw new Error("Failed to parse CSV");
  }
  
  const headers = parseResult.data[0].map(h => h.trim());
  const sampleRows = parseResult.data.slice(1, 6).map(row => 
    row.map(cell => cell.trim())
  );
  
  return {
    headers,
    sampleRows,
    totalRows: parseResult.data.length - 1,
    delimiter,
  };
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
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");
    
    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, error: "File must be CSV or Excel (.xlsx, .xls, .csv)" },
        { status: 400 }
      );
    }

    // Check for template
    const templateResult = await classifyDocument(file);
    const isTemplate = templateResult.type !== DocType.GENERIC && templateResult.confidence >= 0.8;

    // Parse file structure
    let headers: string[];
    let sampleRows: string[][];
    let totalRows: number;
    let delimiter: string | undefined;
    let sheetCount: number | undefined;
    let sheetNames: string[] | undefined;

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const parsed = await parseExcel(buffer);
      headers = parsed.headers;
      sampleRows = parsed.sampleRows;
      totalRows = parsed.totalRows;
      sheetCount = parsed.sheetCount;
      sheetNames = parsed.sheetNames;
    } else {
      const content = await file.text();
      const parsed = parseCSV(content);
      headers = parsed.headers;
      sampleRows = parsed.sampleRows;
      totalRows = parsed.totalRows;
      delimiter = parsed.delimiter;
    }

    // Detect column mapping
    const suggestedMapping = detectMapping(headers);
    const confidence = calculateConfidence(suggestedMapping, headers, sampleRows);
    
    // Determine if wizard is needed
    const hasRequiredColumns = !!(suggestedMapping.length && suggestedMapping.width);
    const needsWizard = !hasRequiredColumns || confidence < 70;
    
    // Determine suggested mode
    let suggestedMode: "auto" | "manual" | "template" = "auto";
    if (isTemplate) {
      suggestedMode = "template";
    } else if (needsWizard) {
      suggestedMode = "manual";
    }

    const result: DetectionResult = {
      success: true,
      confidence,
      needsWizard,
      suggestedMode,
      detectedHeaders: headers,
      sampleRows,
      suggestedMapping,
      metadata: {
        fileName: file.name,
        fileType: isExcel ? "excel" : "csv",
        totalRows,
        hasHeaders: true, // Assume first row is headers
        delimiter,
        sheetCount,
        sheetNames,
      },
      templateDetection: isTemplate ? {
        isTemplate: true,
        templateId: templateResult.metadata?.templateId,
        version: templateResult.metadata?.version,
        confidence: templateResult.confidence * 100,
      } : undefined,
    };

    return NextResponse.json(result);

  } catch (error) {
    logger.error("CSV Wizard detection error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to analyze file" },
      { status: 500 }
    );
  }
}

