/**
 * CAI Intake - Template Detector
 * 
 * Multi-method template detection service that identifies CAI templates
 * in uploaded files using various detection strategies:
 * 
 * 1. Excel metadata detection (hidden cells, header patterns)
 * 2. PDF text-based detection (for digital PDFs)
 * 3. QR code detection (for scanned/printed templates)
 * 4. Vision-based detection (AI fallback for unclear images)
 */

import * as XLSX from "xlsx";
import { detectTemplateQR, type QRDetectionResult } from "@/lib/ai/template-ocr";
import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

/** Document type classification */
export enum DocType {
  TEMPLATE_EXCEL = "template_excel",
  TEMPLATE_PDF = "template_pdf",
  TEMPLATE_IMAGE = "template_image",
  GENERIC = "generic",
}

/** Template metadata extracted from detection */
export interface TemplateMetadata {
  /** Template ID */
  templateId?: string;
  /** Organization ID */
  orgId?: string;
  /** Template version */
  version?: string;
  /** Schema version */
  schema?: string;
  /** Capabilities enabled */
  capabilities?: {
    edgebanding: boolean;
    grooves: boolean;
    holes: boolean;
    cnc: boolean;
    notes: boolean;
  };
  /** Field order for parsing */
  fieldOrder?: string[];
  /** Whether template has shortcodes defined */
  hasShortcodes?: boolean;
  /** Project info if present in template */
  projectInfo?: {
    projectName?: string;
    projectCode?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    date?: string;
  };
  /** Whether this is a blank (unfilled) template */
  isBlank?: boolean;
  /** Template generation timestamp */
  generatedAt?: string;
}

/** Template detection result */
export interface TemplateDetectionResult {
  /** Detected document type */
  type: DocType;
  /** Template metadata if detected */
  metadata?: TemplateMetadata;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Detection method that succeeded */
  method?: "excel_metadata" | "excel_headers" | "pdf_text" | "qr_code" | "vision" | "heuristic";
  /** Whether template is outdated */
  isOutdated?: boolean;
  /** Processing guidance */
  guidance?: {
    title: string;
    message: string;
    suggestions: string[];
  };
}

// ============================================================
// EXCEL DETECTION
// ============================================================

/** Pattern for hidden metadata cell */
const METADATA_CELL_PATTERN = /^CABINETAI_TEMPLATE:\s*({[\s\S]+})$/;

/** Pattern for QR human-readable code */
const HUMAN_CODE_PATTERN = /^CAI-(\d+\.\d+)-([A-Z0-9]+)$/;

/**
 * Detect template from Excel file
 */
export async function detectExcelTemplate(
  buffer: ArrayBuffer
): Promise<TemplateDetectionResult> {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      return { type: DocType.GENERIC, confidence: 0 };
    }
    
    // Method 1: Check for hidden metadata cell (A4 or A1)
    const metadataCells = ["A4", "A1", "B1"];
    for (const cellRef of metadataCells) {
      const cell = sheet[cellRef];
      if (cell?.v) {
        const match = String(cell.v).match(METADATA_CELL_PATTERN);
        if (match) {
          try {
            const metadata = JSON.parse(match[1]) as TemplateMetadata;
            return {
              type: DocType.TEMPLATE_EXCEL,
              metadata,
              confidence: 0.99,
              method: "excel_metadata",
            };
          } catch {
            // JSON parse failed, continue
          }
        }
        
        // Check for human-readable code
        const humanMatch = String(cell.v).match(HUMAN_CODE_PATTERN);
        if (humanMatch) {
          return {
            type: DocType.TEMPLATE_EXCEL,
            metadata: {
              version: humanMatch[1],
              templateId: `CAI-${humanMatch[1]}-${humanMatch[2]}`,
            },
            confidence: 0.95,
            method: "excel_metadata",
          };
        }
      }
    }
    
    // Method 2: Check for CAI template header patterns
    const headerResult = detectExcelHeaders(sheet);
    if (headerResult) {
      return headerResult;
    }
    
    return { type: DocType.GENERIC, confidence: 0.7, method: "heuristic" };
    
  } catch (error) {
    logger.warn("Excel template detection failed", { error });
    return { type: DocType.GENERIC, confidence: 0 };
  }
}

/**
 * Detect template from Excel headers
 */
function detectExcelHeaders(sheet: XLSX.WorkSheet): TemplateDetectionResult | null {
  // Look for CAI template header patterns in first 10 rows
  const headerPatterns = [
    /CAI\s*Intake/i,
    /CabinetAI/i,
    /Cutlist\s*Template/i,
    /#.*Part.*L.*W.*Qty/i,
    /Part\s*Name.*Length.*Width.*Thickness/i,
  ];
  
  for (let row = 0; row < 10; row++) {
    const rowValues: string[] = [];
    for (let col = 0; col < 15; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellRef];
      if (cell?.v) {
        rowValues.push(String(cell.v));
      }
    }
    
    const rowText = rowValues.join(" ");
    
    for (const pattern of headerPatterns) {
      if (pattern.test(rowText)) {
        // Determine capabilities from headers
        const hasEdgebanding = /edge|band|eb/i.test(rowText);
        const hasGrooves = /groove|grv/i.test(rowText);
        const hasHoles = /hole|drill/i.test(rowText);
        const hasCNC = /cnc|routing/i.test(rowText);
        
        return {
          type: DocType.TEMPLATE_EXCEL,
          metadata: {
            capabilities: {
              edgebanding: hasEdgebanding,
              grooves: hasGrooves,
              holes: hasHoles,
              cnc: hasCNC,
              notes: true,
            },
          },
          confidence: 0.85,
          method: "excel_headers",
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if Excel is a blank (unfilled) template
 */
export function isBlankTemplate(buffer: ArrayBuffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Count non-empty data cells (excluding headers - first 10 rows)
    let dataCount = 0;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    
    for (let row = 10; row <= Math.min(range.e.r, 60); row++) {
      for (let col = 0; col <= Math.min(range.e.c, 10); col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (cell?.v && String(cell.v).trim()) {
          dataCount++;
        }
      }
    }
    
    return dataCount < 5; // Less than 5 data cells = blank
  } catch {
    return false;
  }
}

// ============================================================
// PDF TEXT DETECTION
// ============================================================

/**
 * Detect template from PDF text content
 */
export async function detectPDFTemplate(
  text: string
): Promise<TemplateDetectionResult> {
  // Check for CAI template markers
  const patterns = [
    { regex: /CABINETAI_TEMPLATE:\s*({[\s\S]+?})/, method: "pdf_text" as const, confidence: 0.97 },
    { regex: /CAI-(\d+\.\d+)-([A-Z0-9]+)/i, method: "pdf_text" as const, confidence: 0.9 },
    { regex: /CabinetAI\s+Cutlist\s+Template/i, method: "pdf_text" as const, confidence: 0.85 },
    { regex: /CAI\s+Intake\s+Template/i, method: "pdf_text" as const, confidence: 0.85 },
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      // Try to extract metadata from JSON if present
      if (match[1]?.startsWith("{")) {
        try {
          const metadata = JSON.parse(match[1]) as TemplateMetadata;
          return {
            type: DocType.TEMPLATE_PDF,
            metadata,
            confidence: pattern.confidence,
            method: pattern.method,
          };
        } catch {
          // Continue with basic detection
        }
      }
      
      // Human-readable code
      if (match[1] && match[2]) {
        return {
          type: DocType.TEMPLATE_PDF,
          metadata: {
            version: match[1],
            templateId: `CAI-${match[1]}-${match[2]}`,
          },
          confidence: pattern.confidence,
          method: pattern.method,
        };
      }
      
      return {
        type: DocType.TEMPLATE_PDF,
        confidence: pattern.confidence,
        method: pattern.method,
      };
    }
  }
  
  return { type: DocType.GENERIC, confidence: 0.5 };
}

// ============================================================
// QR CODE DETECTION
// ============================================================

/**
 * Detect template from QR code in image
 */
export async function detectTemplateQR(
  imageBuffer: ArrayBuffer
): Promise<TemplateDetectionResult> {
  try {
    const qrResult = await detectTemplateQR(imageBuffer);
    
    if (qrResult && qrResult.templateId) {
      return {
        type: DocType.TEMPLATE_IMAGE,
        metadata: {
          templateId: qrResult.templateId,
          version: qrResult.templateVersion ?? qrResult.templateConfig?.version,
        },
        confidence: 0.95,
        method: "qr_code",
      };
    }
    
    return { type: DocType.GENERIC, confidence: 0.3 };
  } catch (error) {
    logger.warn("QR detection failed", { error });
    return { type: DocType.GENERIC, confidence: 0 };
  }
}

// ============================================================
// VISION-BASED DETECTION
// ============================================================

/**
 * Detect template using AI vision (fallback)
 * This requires an AI provider to be configured
 */
export async function detectTemplateByVision(
  imageBase64: string
): Promise<TemplateDetectionResult> {
  // This is a placeholder - actual implementation would use
  // the AI provider to analyze the image
  // For now, return generic result
  return {
    type: DocType.GENERIC,
    confidence: 0.5,
    method: "vision",
    guidance: {
      title: "Template Detection",
      message: "Could not automatically detect template format",
      suggestions: [
        "Ensure the QR code is visible and not damaged",
        "Use the original Excel template for best results",
        "Manual column mapping may be required",
      ],
    },
  };
}

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================

/**
 * Classify a document and detect if it's a CAI template
 * 
 * @param file - The file to classify
 * @returns Detection result with type, metadata, and confidence
 */
export async function classifyDocument(
  file: File
): Promise<TemplateDetectionResult> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  // Excel files
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls")
  ) {
    const buffer = await file.arrayBuffer();
    const result = await detectExcelTemplate(buffer);
    
    if (result.type === DocType.TEMPLATE_EXCEL) {
      // Check if blank
      result.metadata = result.metadata || {};
      result.metadata.isBlank = isBlankTemplate(buffer);
      
      if (result.metadata.isBlank) {
        result.guidance = {
          title: "Blank Template Detected",
          message: "This appears to be an empty template. Please fill in the cutlist data first.",
          suggestions: [
            "Fill in the part dimensions and quantities",
            "Add material and edgebanding information",
            "Save and re-upload when complete",
          ],
        };
      }
    }
    
    return result;
  }
  
  // PDF files
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    try {
      // Try to extract text from PDF
      const buffer = await file.arrayBuffer();
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as { default?: unknown }).default ?? pdfParseModule;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfData = await (pdfParse as any)(Buffer.from(buffer));
      
      if (pdfData.text) {
        const textResult = await detectPDFTemplate(pdfData.text);
        if (textResult.type !== DocType.GENERIC) {
          return textResult;
        }
      }
    } catch {
      // PDF text extraction failed, try QR detection
    }
    
    // Fall back to QR detection for scanned PDFs
    // This would require converting PDF to image first
    return { type: DocType.GENERIC, confidence: 0.5 };
  }
  
  // Image files
  if (
    mimeType.includes("image") ||
    fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)
  ) {
    const buffer = await file.arrayBuffer();
    
    // Try QR detection first
    const qrResult = await detectTemplateQR(buffer);
    if (qrResult.type !== DocType.GENERIC) {
      return qrResult;
    }
    
    // Fall back to vision-based detection
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return detectTemplateByVision(dataUrl);
  }
  
  // Unknown file type
  return {
    type: DocType.GENERIC,
    confidence: 0.3,
    guidance: {
      title: "Unknown File Type",
      message: `File type "${mimeType || fileName}" is not recognized`,
      suggestions: [
        "Upload Excel (.xlsx), PDF, or image files",
        "Use the official CAI Intake template for best results",
      ],
    },
  };
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Check if detection result indicates a valid template
 */
export function isValidTemplate(result: TemplateDetectionResult): boolean {
  return (
    result.type !== DocType.GENERIC &&
    result.confidence >= 0.8 &&
    !result.metadata?.isBlank
  );
}

/**
 * Get template processing recommendation
 */
export function getProcessingRecommendation(
  result: TemplateDetectionResult
): "template_parser" | "ocr" | "manual" {
  if (result.type === DocType.TEMPLATE_EXCEL && result.confidence >= 0.9) {
    return "template_parser";
  }
  
  if (result.type === DocType.TEMPLATE_PDF || result.type === DocType.TEMPLATE_IMAGE) {
    return "ocr";
  }
  
  return "manual";
}

