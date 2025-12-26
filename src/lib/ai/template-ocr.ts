/**
 * CAI Intake - Template OCR Parser
 * 
 * Optimized for deterministic parsing of CAI branded templates.
 * 
 * Template ID format: CAI-{org_id}-v{version}
 * - org_id identifies the organization
 * - version tracks shortcode/config changes
 * 
 * Since templates have deterministic column layouts based on org config,
 * OCR should achieve near 100% accuracy.
 */

import jsQR from "jsqr";
import { parseTemplateId, type ParsedTemplateId } from "@/lib/templates/org-template-generator";

// ============================================================
// TYPES
// ============================================================

export interface TemplateColumn {
  key: string;           // Column key (e.g., "label", "L", "edge")
  label: string;         // Column header text
  type: "text" | "number" | "code" | "shortcode";
  required?: boolean;
  shortcodes?: string[]; // Valid shortcode values for this column
}

export interface OrgTemplateConfig {
  org_id: string;
  org_name: string;
  version: string;
  columns: TemplateColumn[];
  shortcodes: {
    edgebanding?: string[];
    grooving?: string[];
    drilling?: string[];
    cnc?: string[];
  };
}

export interface QRDetectionResult {
  found: boolean;
  templateId?: string;
  parsed?: ParsedTemplateId;
  orgConfig?: OrgTemplateConfig;
  rawData?: string;
  error?: string;
}

export interface TemplateParseResult {
  success: boolean;
  templateId: string;
  orgId: string;
  version: string;
  projectInfo?: {
    projectName?: string;
    projectCode?: string;
    customerName?: string;
    phone?: string;
    email?: string;
    sectionArea?: string;
    page?: number;
    totalPages?: number;
  };
  parts: ParsedTemplatePart[];
  errors: string[];
  confidence: number;
}

export interface ParsedTemplatePart {
  rowNumber: number;
  label?: string;
  length?: number;
  width?: number;
  thickness?: number;
  quantity?: number;
  material?: string;
  edge?: string;
  groove?: string;
  drill?: string;
  cnc?: string;
  notes?: string;
  confidence: number;
}

// ============================================================
// TEMPLATE CONFIG CACHE
// ============================================================

/**
 * In-memory cache of org template configs
 * In production, this would be fetched from database by org_id + version
 */
const templateConfigCache = new Map<string, OrgTemplateConfig>();

/**
 * Register/cache an org's template config
 */
export function registerOrgTemplateConfig(config: OrgTemplateConfig): void {
  const key = `${config.org_id}-v${config.version}`;
  templateConfigCache.set(key, config);
}

/**
 * Get org template config by org_id and version
 * In production, this would query the database
 */
export async function getOrgTemplateConfig(
  orgId: string, 
  version: string
): Promise<OrgTemplateConfig | null> {
  const key = `${orgId}-v${version}`;
  
  // Check cache
  if (templateConfigCache.has(key)) {
    return templateConfigCache.get(key)!;
  }
  
  // TODO: In production, fetch from database
  // const config = await prisma.templateConfig.findFirst({
  //   where: { org_id: orgId, version }
  // });
  
  return null;
}

// ============================================================
// QR CODE DETECTION
// ============================================================

/**
 * Detect QR code in an image and parse template ID
 */
export async function detectTemplateQR(imageData: ArrayBuffer): Promise<QRDetectionResult> {
  try {
    // Create image from buffer
    const blob = new Blob([imageData]);
    const imageBitmap = await createImageBitmap(blob);
    
    // Create canvas to get image data
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      return { found: false, error: "Could not create canvas context" };
    }
    
    ctx.drawImage(imageBitmap, 0, 0);
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Scan for QR code
    const code = jsQR(imageDataObj.data, imageDataObj.width, imageDataObj.height);
    
    if (!code) {
      return { found: false };
    }
    
    const qrData = code.data.trim();
    
    // Parse the template ID: CAI-{org_id}-v{version}
    const parsed = parseTemplateId(qrData);
    
    if (!parsed.isCAI || !parsed.orgId || !parsed.version) {
      return {
        found: true,
        rawData: qrData,
        error: "QR code found but not a valid CAI template ID",
      };
    }
    
    // Look up org config
    const orgConfig = await getOrgTemplateConfig(parsed.orgId, parsed.version);
    
    return {
      found: true,
      templateId: qrData,
      parsed,
      orgConfig: orgConfig || undefined,
      rawData: qrData,
    };
    
  } catch (error) {
    console.warn("QR code detection failed:", error);
    return { found: false, error: String(error) };
  }
}

/**
 * Detect QR code from a base64 image string
 */
export async function detectTemplateQRFromBase64(base64Data: string): Promise<QRDetectionResult> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return detectTemplateQR(bytes.buffer);
  } catch (error) {
    console.warn("QR code detection from base64 failed:", error);
    return { found: false, error: String(error) };
  }
}

// ============================================================
// DETERMINISTIC TEMPLATE PARSER
// ============================================================

/**
 * Build optimized prompt for deterministic template parsing
 * This prompt tells the AI exactly what columns to expect
 */
export function buildDeterministicParsePrompt(config: OrgTemplateConfig): string {
  const columnList = config.columns
    .map((col, i) => `${i + 1}. ${col.label} (${col.key}) - ${col.type}${col.required ? " [REQUIRED]" : ""}`)
    .join("\n");
  
  let shortcodeGuide = "";
  
  if (config.shortcodes.edgebanding?.length) {
    shortcodeGuide += `\nEdgebanding codes: ${config.shortcodes.edgebanding.join(", ")}`;
  }
  if (config.shortcodes.grooving?.length) {
    shortcodeGuide += `\nGrooving codes: ${config.shortcodes.grooving.join(", ")}`;
  }
  if (config.shortcodes.drilling?.length) {
    shortcodeGuide += `\nDrilling codes: ${config.shortcodes.drilling.join(", ")}`;
  }
  if (config.shortcodes.cnc?.length) {
    shortcodeGuide += `\nCNC codes: ${config.shortcodes.cnc.join(", ")}`;
  }
  
  return `
You are parsing a CAI Intake branded cutlist template.

TEMPLATE INFO:
- Organization: ${config.org_name}
- Template Version: ${config.version}
- This is a DETERMINISTIC template with known column layout

COLUMNS (in exact order, left to right):
${columnList}

${shortcodeGuide ? `VALID SHORTCODES:${shortcodeGuide}` : ""}

PROJECT INFORMATION FIELDS (at top of form):
- Project Name
- Project Code (IMPORTANT for multi-page matching)
- Customer Name
- Phone
- Customer Email
- Section/Area
- Page ___ of ___ (IMPORTANT for multi-page ordering)

EXTRACTION RULES:
1. The first column (#) is the row number - use it to track row position
2. Read each filled row in order from row 1 onwards
3. Empty rows should be SKIPPED
4. Numbers may be handwritten - be careful with 1/7, 6/0, 5/S confusion
5. Shortcodes MUST match the valid codes listed above exactly
6. If a field is unclear, set confidence lower for that part
7. Extract project info from the header section

OUTPUT FORMAT:
Return JSON with:
{
  "projectInfo": {
    "projectName": string | null,
    "projectCode": string | null,
    "customerName": string | null,
    "phone": string | null,
    "email": string | null,
    "sectionArea": string | null,
    "page": number | null,
    "totalPages": number | null
  },
  "parts": [
    {
      "rowNumber": 1,
      "label": "Part A",
      "length": 720,
      "width": 560,
      "thickness": 18,
      "quantity": 2,
      "material": "MDF",
      "edge": "2L",
      "groove": null,
      "drill": null,
      "cnc": null,
      "notes": "Kitchen base",
      "confidence": 0.95
    }
  ]
}

CONFIDENCE SCORING:
- 0.95-1.0: Clearly printed/written, no ambiguity
- 0.80-0.94: Minor ambiguity but confident interpretation
- 0.60-0.79: Some uncertainty, may need verification
- Below 0.60: Low confidence, likely needs manual review

Parse ALL filled rows. Do not truncate or summarize.
`.trim();
}

/**
 * Parse a template image with deterministic column extraction
 */
export async function parseTemplateImage(
  imageBase64: string,
  mimeType: string,
  templateId: string,
  aiParseFunction: (text: string, prompt: string) => Promise<unknown>
): Promise<TemplateParseResult> {
  const parsed = parseTemplateId(templateId);
  
  if (!parsed.isCAI || !parsed.orgId || !parsed.version) {
    return {
      success: false,
      templateId,
      orgId: "",
      version: "",
      parts: [],
      errors: ["Invalid template ID format"],
      confidence: 0,
    };
  }
  
  // Get org config
  const orgConfig = await getOrgTemplateConfig(parsed.orgId, parsed.version);
  
  if (!orgConfig) {
    // Fall back to default config if org config not found
    console.warn(`Org config not found for ${parsed.orgId} v${parsed.version}, using defaults`);
  }
  
  // Build deterministic prompt
  const prompt = orgConfig 
    ? buildDeterministicParsePrompt(orgConfig)
    : buildDefaultParsePrompt(parsed.orgId, parsed.version);
  
  try {
    // Call AI with image and deterministic prompt
    const result = await aiParseFunction(imageBase64, prompt);
    
    // Parse AI response
    const parseResponse = result as {
      projectInfo?: TemplateParseResult["projectInfo"];
      parts?: ParsedTemplatePart[];
    };
    
    const parts = parseResponse.parts || [];
    const avgConfidence = parts.length > 0
      ? parts.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / parts.length
      : 0;
    
    return {
      success: true,
      templateId,
      orgId: parsed.orgId,
      version: parsed.version,
      projectInfo: parseResponse.projectInfo,
      parts,
      errors: [],
      confidence: avgConfidence,
    };
    
  } catch (error) {
    return {
      success: false,
      templateId,
      orgId: parsed.orgId,
      version: parsed.version,
      parts: [],
      errors: [String(error)],
      confidence: 0,
    };
  }
}

/**
 * Default parse prompt when org config is not found
 */
function buildDefaultParsePrompt(orgId: string, version: string): string {
  return `
You are parsing a CAI Intake branded cutlist template.

Template ID indicates:
- Organization: ${orgId}
- Version: ${version}

Since I don't have the specific template configuration, extract based on the visible columns.

EXPECTED COLUMNS (typical layout):
1. # - Row number
2. Part Name - text label
3. L(mm) - length in millimeters
4. W(mm) - width in millimeters
5. Thk - thickness
6. Qty - quantity
7. Material - material name/code
8. Edge (code) - edgebanding shortcode
9. Groove (GL/GW) - grooving shortcode  
10. Drill (code) - drilling shortcode
11. CNC (code) - CNC operation shortcode
12. Notes - additional notes

COMMON SHORTCODES:
- Edgebanding: L, W, 2L, 2W, LW, 2L2W, None
- Grooving: L, W, 2L, 2W, blank
- Drilling: H2, SP4, HD
- CNC: RADIUS, PROFILE, CUTOUT

PROJECT INFORMATION (header section):
- Project Name, Project Code
- Customer Name, Phone, Email
- Section/Area
- Page ___ of ___

OUTPUT FORMAT:
{
  "projectInfo": { ... },
  "parts": [
    {
      "rowNumber": number,
      "label": string,
      "length": number,
      "width": number,
      "thickness": number,
      "quantity": number,
      "material": string,
      "edge": string | null,
      "groove": string | null,
      "drill": string | null,
      "cnc": string | null,
      "notes": string | null,
      "confidence": number (0-1)
    }
  ]
}

Parse ALL filled rows. Skip empty rows.
`.trim();
}

// ============================================================
// MULTI-PAGE MERGING
// ============================================================

/**
 * Merge parts from multiple pages of the same template
 * Uses project code to match pages and page numbers to order them
 */
export function mergeTemplatePages(
  results: TemplateParseResult[]
): TemplateParseResult {
  if (results.length === 0) {
    return {
      success: false,
      templateId: "",
      orgId: "",
      version: "",
      parts: [],
      errors: ["No pages to merge"],
      confidence: 0,
    };
  }
  
  if (results.length === 1) {
    return results[0];
  }
  
  // Group by project code
  const projectCode = results[0].projectInfo?.projectCode;
  
  // Sort by page number
  const sorted = [...results].sort((a, b) => {
    const pageA = a.projectInfo?.page || 0;
    const pageB = b.projectInfo?.page || 0;
    return pageA - pageB;
  });
  
  // Merge parts with adjusted row numbers
  let allParts: ParsedTemplatePart[] = [];
  let rowOffset = 0;
  
  for (const result of sorted) {
    const adjustedParts = result.parts.map(part => ({
      ...part,
      rowNumber: part.rowNumber + rowOffset,
    }));
    allParts = allParts.concat(adjustedParts);
    rowOffset = allParts.length;
  }
  
  // Calculate average confidence
  const avgConfidence = allParts.length > 0
    ? allParts.reduce((sum, p) => sum + p.confidence, 0) / allParts.length
    : 0;
  
  // Collect all errors
  const allErrors = sorted.flatMap(r => r.errors);
  
  return {
    success: sorted.every(r => r.success),
    templateId: sorted[0].templateId,
    orgId: sorted[0].orgId,
    version: sorted[0].version,
    projectInfo: {
      ...sorted[0].projectInfo,
      page: 1,
      totalPages: sorted.length,
    },
    parts: allParts,
    errors: allErrors,
    confidence: avgConfidence,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  parseTemplateId,
  type ParsedTemplateId,
};
