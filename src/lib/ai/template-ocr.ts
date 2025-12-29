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
import sharp from "sharp";
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
 * Fetches from database and populates with org's actual shortcodes
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
  
  // Dynamically import prisma to avoid client-side bundling issues
  const { prisma } = await import("@/lib/db");
  
  try {
    // Fetch organization
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    
    if (!org) {
      console.warn(`[TemplateOCR] Organization not found: ${orgId}`);
      return null;
    }
    
    // Fetch all active operations for this org to build shortcode lists
    const [edgebandOps, grooveOps, drillingOps, cncOps] = await Promise.all([
      prisma.edgebandOperation.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { code: true, name: true },
      }),
      prisma.grooveOperation.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { code: true, name: true },
      }),
      prisma.drillingOperation.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { code: true, name: true },
      }),
      prisma.cncOperation.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { code: true, name: true },
      }),
    ]);
    
    // Build the config from org's actual operations
    const config: OrgTemplateConfig = {
      org_id: orgId,
      org_name: org.name,
      version,
      columns: [
        { key: "#", label: "#", type: "number", required: true },
        { key: "label", label: "Part Name", type: "text", required: true },
        { key: "L", label: "L(mm)", type: "number", required: true },
        { key: "W", label: "W(mm)", type: "number", required: true },
        { key: "T", label: "Thk", type: "number" },
        { key: "qty", label: "Qty", type: "number", required: true },
        { key: "material", label: "Mat", type: "code" },
        { key: "edge", label: "Edge (code)", type: "shortcode", shortcodes: edgebandOps.map(o => o.code) },
        { key: "groove", label: "Groove (GL/GW)", type: "shortcode", shortcodes: grooveOps.map(o => o.code) },
        { key: "drill", label: "Drill (code)", type: "shortcode", shortcodes: drillingOps.map(o => o.code) },
        { key: "cnc", label: "CNC (code)", type: "shortcode", shortcodes: cncOps.map(o => o.code) },
        { key: "notes", label: "Notes", type: "text" },
      ],
      shortcodes: {
        edgebanding: edgebandOps.map(o => o.code),
        grooving: grooveOps.map(o => o.code),
        drilling: drillingOps.map(o => o.code),
        cnc: cncOps.map(o => o.code),
      },
    };
    
    // Cache for future requests
    templateConfigCache.set(key, config);
    
    console.info(`[TemplateOCR] Loaded org config for ${org.name}: ${edgebandOps.length} edgeband, ${grooveOps.length} groove, ${drillingOps.length} drilling, ${cncOps.length} cnc codes`);
    
    return config;
    
  } catch (error) {
    console.error(`[TemplateOCR] Error fetching org config:`, error);
    return null;
  }
}

// ============================================================
// QR CODE DETECTION
// ============================================================

/**
 * Detect QR code in an image and parse template ID
 * Uses sharp for Node.js compatible image processing
 * 
 * Strategy: Multiple scan approaches for high-res photographed images
 * 1. Scan top-left corner at multiple offsets (paper margins vary)
 * 2. Scan with binarization (threshold) for better contrast
 * 3. Scan resized versions at different scales
 * 4. Scan full image as fallback
 */
export async function detectTemplateQR(imageData: ArrayBuffer): Promise<QRDetectionResult> {
  try {
    // Use sharp to decode image and get raw RGBA pixel data
    const image = sharp(Buffer.from(imageData));
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      return { found: false, error: "Could not read image dimensions" };
    }
    
    console.log(`[TemplateOCR] Scanning image ${metadata.width}x${metadata.height} for QR code`);
    
    // Helper function to scan a region for QR code
    const scanRegion = async (
      left: number, 
      top: number, 
      width: number, 
      height: number,
      label: string
    ): Promise<string | null> => {
      try {
        // Ensure we don't exceed image bounds
        const safeLeft = Math.max(0, Math.min(left, metadata.width! - width));
        const safeTop = Math.max(0, Math.min(top, metadata.height! - height));
        const safeWidth = Math.min(width, metadata.width! - safeLeft);
        const safeHeight = Math.min(height, metadata.height! - safeTop);
        
        if (safeWidth < 100 || safeHeight < 100) return null;
        
        // Try multiple image processing approaches
        const approaches = [
          // Approach 1: Color image (RGBA)
          () => sharp(Buffer.from(imageData))
            .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
            .ensureAlpha()
            .raw(),
          
          // Approach 2: Greyscale with normalize
          () => sharp(Buffer.from(imageData))
            .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
            .greyscale()
            .normalise()
            .toColorspace("srgb")
            .ensureAlpha()
            .raw(),
          
          // Approach 3: High contrast threshold (binarization)
          () => sharp(Buffer.from(imageData))
            .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
            .greyscale()
            .threshold(128) // Binarize for cleaner QR detection
            .toColorspace("srgb")
            .ensureAlpha()
            .raw(),
          
          // Approach 4: Sharpen + contrast
          () => sharp(Buffer.from(imageData))
            .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
            .sharpen()
            .modulate({ brightness: 1.1, saturation: 0 }) // Slightly brighter, greyscale
            .normalise()
            .ensureAlpha()
            .raw(),
        ];
        
        for (let i = 0; i < approaches.length; i++) {
          try {
            const { data, info } = await approaches[i]().toBuffer({ resolveWithObject: true });
            
            if (info.channels === 4) {
              const pixelData = new Uint8ClampedArray(data);
              const code = jsQR(pixelData, info.width, info.height);
              
              if (code) {
                console.log(`[TemplateOCR] QR found in ${label} (approach ${i + 1})`);
                return code.data.trim();
              }
            }
          } catch {
            // Continue to next approach
          }
        }
        
        return null;
      } catch {
        return null;
      }
    };
    
    // Strategy 1: Scan top-left corner at multiple positions
    // Account for paper margins and different photo crops
    const cornerSizes = [
      // Small focused region (for close-up photos)
      { w: Math.ceil(metadata.width * 0.15), h: Math.ceil(metadata.height * 0.12) },
      // Medium region
      { w: Math.ceil(metadata.width * 0.25), h: Math.ceil(metadata.height * 0.20) },
      // Large region
      { w: Math.min(Math.ceil(metadata.width * 0.35), 1800), h: Math.min(Math.ceil(metadata.height * 0.28), 1400) },
    ];
    
    const offsets = [
      { x: 0, y: 0 },                                    // Exact corner
      { x: Math.ceil(metadata.width * 0.02), y: Math.ceil(metadata.height * 0.02) },  // Small margin
      { x: Math.ceil(metadata.width * 0.05), y: Math.ceil(metadata.height * 0.04) },  // Medium margin
    ];
    
    for (const size of cornerSizes) {
      for (const offset of offsets) {
        const result = await scanRegion(
          offset.x, 
          offset.y, 
          size.w, 
          size.h, 
          `corner ${size.w}x${size.h} offset (${offset.x},${offset.y})`
        );
        if (result) {
          return processQRCode(result);
        }
      }
    }
    
    console.log(`[TemplateOCR] QR not found in corner regions, trying scaled full image`);
    
    // Strategy 2: Scan full image at different scales
    const scales = [1500, 2000, 2500, 3500];
    
    for (const maxDim of scales) {
      try {
        const scaledImage = sharp(Buffer.from(imageData))
          .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
        
        // Get metadata of scaled image
        const scaledMeta = await scaledImage.clone().metadata();
        const scaledW = scaledMeta.width || maxDim;
        const scaledH = scaledMeta.height || maxDim;
        
        // Scan the scaled image
        for (const approach of ["color", "threshold", "enhanced"] as const) {
          try {
            let pipeline = scaledImage.clone();
            
            if (approach === "threshold") {
              pipeline = pipeline.greyscale().threshold(128).toColorspace("srgb");
            } else if (approach === "enhanced") {
              pipeline = pipeline.greyscale().normalise().toColorspace("srgb");
            }
            
            const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            
            if (info.channels === 4) {
              const pixelData = new Uint8ClampedArray(data);
              const code = jsQR(pixelData, info.width, info.height);
              
              if (code) {
                console.log(`[TemplateOCR] QR found in full image (scale ${maxDim}, ${approach})`);
                return processQRCode(code.data.trim());
              }
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
    
    console.log(`[TemplateOCR] No QR code found in image after all strategies`);
    return { found: false };
    
  } catch (error) {
    console.warn("QR code detection failed:", error);
    return { found: false, error: String(error) };
  }
}

/**
 * Process a detected QR code and return the detection result
 */
async function processQRCode(qrData: string): Promise<QRDetectionResult> {
  // Parse the template ID - supports multiple formats
  const parsed = parseTemplateId(qrData);
  
  // Check if it's any CAI template format
  if (!parsed.isCAI) {
    return {
      found: true,
      rawData: qrData,
      error: "QR code found but not a CAI template",
    };
  }
  
  // For v1 format (CAI-{org_id}-v{version}), try to load org config
  let orgConfig: OrgTemplateConfig | null = null;
  
  if (parsed.format === "v1" && parsed.orgId && parsed.version) {
    orgConfig = await getOrgTemplateConfig(parsed.orgId, parsed.version);
  }
  
  // For legacy format (CAI-{version}-{serial}), still recognize as CAI template
  // but proceed with standard AI OCR since we don't have org-specific config
  if (parsed.format === "legacy") {
    console.log(`[TemplateOCR] Detected legacy CAI template: ${qrData} (version ${parsed.version}, serial ${parsed.serial})`);
  }
  
  return {
    found: true,
    templateId: qrData,
    parsed,
    orgConfig: orgConfig || undefined,
    rawData: qrData,
  };
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
// TEXT-BASED TEMPLATE DETECTION (FALLBACK)
// ============================================================

/**
 * Result of text-based template detection
 */
export interface TextTemplateDetectionResult {
  found: boolean;
  templateId?: string;
  version?: string;
  confidence: number;
  detectionMethod: "text_pattern" | "header_match" | "branding_match";
  rawMatch?: string;
  parsed?: ParsedTemplateId;
}

/**
 * Patterns to look for in image text to identify CAI templates
 */
const CAI_TEMPLATE_PATTERNS = [
  // Full template ID formats
  /CAI[-\s]?(\d+\.\d+)[-\s]?(\d+)/i,                    // CAI-1.0-12345678
  /CAI[-\s]?(v?\d+(?:\.\d+)?)[-\s]?([\w\d]+)/i,         // CAI-v1.0-abc123
  /CAI[-\s]?([a-z0-9]+)[-\s]?v(\d+(?:\.\d+)?)/i,        // CAI-org_id-v1.0
  
  // Version patterns
  /Template\s+(?:v|version)\s*(\d+(?:\.\d+)?)/i,        // Template v1.0
  /CAI\s+(?:v|version)\s*(\d+(?:\.\d+)?)/i,             // CAI v1.0
  /(?:v|version)\s*(\d+(?:\.\d+)?)\s*(?:template)?/i,   // v1.0 Template
  
  // Branding patterns
  /CAI\s*Intake/i,                                       // CAI Intake
  /Cutlist\s*(?:AI|Assistant)/i,                        // Cutlist AI / Cutlist Assistant
];

/**
 * Detect CAI template from text extracted from image
 * This is a fallback when QR detection fails
 * 
 * @param extractedText - Text extracted from the image (via OCR or AI)
 * @returns Detection result with template info if found
 */
export function detectTemplateFromText(extractedText: string): TextTemplateDetectionResult {
  if (!extractedText || extractedText.length < 3) {
    return { found: false, confidence: 0, detectionMethod: "text_pattern" };
  }
  
  const text = extractedText.trim();
  
  // Try each pattern
  for (const pattern of CAI_TEMPLATE_PATTERNS) {
    const match = text.match(pattern);
    
    if (match) {
      console.log(`[TemplateOCR] Text pattern match: "${match[0]}"`);
      
      // Determine detection method based on pattern type
      const patternStr = pattern.toString();
      let detectionMethod: "text_pattern" | "header_match" | "branding_match" = "text_pattern";
      
      if (patternStr.includes("Template") || patternStr.includes("version")) {
        detectionMethod = "header_match";
      } else if (patternStr.includes("Intake") || patternStr.includes("Cutlist")) {
        detectionMethod = "branding_match";
      }
      
      // Try to extract template ID
      let templateId: string | undefined;
      let version: string | undefined;
      
      if (match[0].toUpperCase().includes("CAI")) {
        // It's a CAI-format ID
        templateId = match[0].replace(/\s+/g, "-").toUpperCase();
        
        // Try to parse as template ID
        const parsed = parseTemplateId(templateId);
        
        if (parsed.isCAI) {
          version = parsed.version || undefined;
          
          return {
            found: true,
            templateId,
            version,
            confidence: 0.8,
            detectionMethod,
            rawMatch: match[0],
            parsed,
          };
        }
      }
      
      // Extract version if present
      if (match[1] && /^\d+(?:\.\d+)?$/.test(match[1])) {
        version = match[1];
      }
      
      return {
        found: true,
        templateId: templateId || match[0],
        version,
        confidence: detectionMethod === "branding_match" ? 0.6 : 0.75,
        detectionMethod,
        rawMatch: match[0],
      };
    }
  }
  
  // Check for generic indicators
  const hasCAI = /\bCAI\b/i.test(text);
  const hasTemplate = /\bTemplate\b/i.test(text);
  const hasCutlist = /\bCutlist\b/i.test(text);
  
  if (hasCAI && (hasTemplate || hasCutlist)) {
    return {
      found: true,
      confidence: 0.5,
      detectionMethod: "branding_match",
      rawMatch: text.substring(0, 100),
    };
  }
  
  return { found: false, confidence: 0, detectionMethod: "text_pattern" };
}

/**
 * AI prompt to detect CAI template identifiers in an image
 */
export const TEMPLATE_DETECTION_PROMPT = `Look at this image and determine if it's a CAI Intake template.

CHECK FOR THESE INDICATORS:
1. A QR code in the top-left corner
2. Text containing "CAI", "CAI Intake", or "Cutlist"
3. A template ID format like "CAI-1.0-12345678" or "CAI-org_id-v1.0"
4. Headers saying "Template", "Version", or "v1.0"
5. Structured table with columns for #, Part Name, L, W, Qty, Edge, etc.

RESPOND WITH JSON ONLY:
{
  "isCAITemplate": true/false,
  "templateId": "CAI-1.0-12345678" or null if not found,
  "version": "1.0" or null if not found,
  "confidence": 0.0-1.0,
  "indicators": ["list", "of", "detected", "indicators"]
}

If this is NOT a CAI template, set isCAITemplate to false and explain in indicators why.`;

/**
 * Result of AI-based template detection
 */
export interface AITemplateDetectionResult {
  isCAITemplate: boolean;
  templateId: string | null;
  version: string | null;
  confidence: number;
  indicators: string[];
}

/**
 * Parse AI response for template detection
 */
export function parseTemplateDetectionResponse(response: string): AITemplateDetectionResult | null {
  try {
    // Strip markdown fences if present
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    
    const parsed = JSON.parse(cleaned);
    
    return {
      isCAITemplate: !!parsed.isCAITemplate,
      templateId: parsed.templateId || null,
      version: parsed.version || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
    };
  } catch {
    console.warn("[TemplateOCR] Failed to parse template detection response");
    return null;
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
// 2-PASS TEMPLATE PARSING
// ============================================================

/**
 * Pass 1: Pre-scan result
 * Quick analysis to count rows, extract metadata, assess quality
 */
export interface TemplatePreScanResult {
  success: boolean;
  rowsWithData: number;
  estimatedParts: number;
  metadata: {
    projectName?: string;
    projectCode?: string;
    customerName?: string;
    page?: number;
    totalPages?: number;
    sectionArea?: string;
  };
  quality: "excellent" | "good" | "fair" | "poor";
  qualityIssues: string[];
  columnVisibility: {
    edge: boolean;
    groove: boolean;
    drill: boolean;
    cnc: boolean;
    notes: boolean;
  };
  processingTimeMs: number;
}

/**
 * Pass 1 Prompt: Quick pre-scan for metadata and row count
 * Minimal token usage, just validation and counting
 */
export const TEMPLATE_PRESCAN_PROMPT = `## CAI TEMPLATE PRE-SCAN (Fast Analysis)

This is a CAI Intake Smart Template form. Perform a QUICK analysis without extracting all data.

### TASK 1: COUNT ROWS WITH DATA
Look at the numbered rows (1-35) in the main table.
Count how many rows have ANY data written in them.
- Row is "filled" if it has Part Name, L, W, or Qty written
- Skip completely empty rows

### TASK 2: EXTRACT PROJECT METADATA
Read the header section for:
- Project Name
- Project Code (important for multi-page matching)
- Customer Name
- Section/Area
- Page __ of __

### TASK 3: ASSESS HANDWRITING QUALITY
Rate the overall legibility:
- excellent: Clear printed text or very neat handwriting
- good: Readable handwriting with minor issues
- fair: Some characters hard to read
- poor: Significant portions unclear

### TASK 4: CHECK COLUMN USAGE
Note which operation columns have ANY data:
- Edge column (has any checkmarks or codes?)
- Groove column (has any GL/GW marks?)
- Drill column (has any drill codes?)
- CNC column (has any CNC codes?)
- Notes column (has any text?)

### OUTPUT FORMAT (JSON ONLY - NO MARKDOWN):
{
  "rowsWithData": 23,
  "metadata": {
    "projectName": "Kitchen Renovation",
    "projectCode": "KR-2024",
    "customerName": "John Smith",
    "page": 1,
    "totalPages": 2,
    "sectionArea": "Base Cabinets"
  },
  "quality": "good",
  "qualityIssues": ["Some numbers in column L slightly smudged"],
  "columnUsage": {
    "edge": true,
    "groove": false,
    "drill": false,
    "cnc": false,
    "notes": true
  }
}

RESPOND WITH JSON ONLY - NO MARKDOWN FENCES, NO EXPLANATIONS.`;

/**
 * Pass 2 Prompt: Full cell-by-cell extraction with shortcode matching
 */
export function buildPass2ExtractionPrompt(
  config: OrgTemplateConfig,
  preScan: TemplatePreScanResult
): string {
  const shortcodeHints = [];
  
  if (config.shortcodes.edgebanding?.length && preScan.columnVisibility.edge) {
    shortcodeHints.push(`Edge codes: ${config.shortcodes.edgebanding.join(", ")}`);
  }
  if (config.shortcodes.grooving?.length && preScan.columnVisibility.groove) {
    shortcodeHints.push(`Groove codes: ${config.shortcodes.grooving.join(", ")}`);
  }
  if (config.shortcodes.drilling?.length && preScan.columnVisibility.drill) {
    shortcodeHints.push(`Drill codes: ${config.shortcodes.drilling.join(", ")}`);
  }
  if (config.shortcodes.cnc?.length && preScan.columnVisibility.cnc) {
    shortcodeHints.push(`CNC codes: ${config.shortcodes.cnc.join(", ")}`);
  }

  return `## CAI TEMPLATE CELL EXTRACTION (Pass 2)

This is a CAI Intake Smart Template for: ${config.org_name}
Template Version: v${config.version}

### PRE-SCAN RESULTS (from Pass 1):
- Rows with data: ${preScan.rowsWithData}
- Quality: ${preScan.quality}
${preScan.qualityIssues.length > 0 ? `- Issues noted: ${preScan.qualityIssues.join(", ")}` : ""}

### DETERMINISTIC COLUMN ORDER (LEFT TO RIGHT):
| Col | Header | Field | Type |
|-----|--------|-------|------|
| 1 | # | rowNumber | number |
| 2 | Part Name | label | text |
| 3 | L(mm) | length | number (grain direction) |
| 4 | W(mm) | width | number |
| 5 | Thk | thickness | number (default 18) |
| 6 | Qty | quantity | number (default 1) |
| 7 | Material | material | code |
| 8 | Edge | edge | shortcode |
| 9 | Groove | groove | shortcode (GL/GW) |
| 10 | Drill | drill | shortcode |
| 11 | CNC | cnc | shortcode |
| 12 | Notes | notes | text |

${shortcodeHints.length > 0 ? `### VALID SHORTCODES (match exactly):\n${shortcodeHints.join("\n")}` : ""}

### EXTRACTION RULES:
1. Extract EXACTLY ${preScan.rowsWithData} rows (from pre-scan)
2. Read each cell in the FIXED column order above
3. For shortcode columns, return the EXACT code written (for server resolution)
4. If shortcode is unclear, return best guess with lower confidence
5. Do NOT swap Length/Width - Length is grain direction, may be smaller
6. Empty cells = null, not empty string

### OUTPUT FORMAT (COMPACT JSON):
[
  {"r":1,"n":"Side Panel","l":720,"w":560,"t":18,"q":2,"m":"WPB","e":"2L","g":"GL","d":null,"c":null,"x":"shelf pins","cf":0.95},
  {"r":2,"n":"Back","l":1200,"w":600,"t":6,"q":1,"m":"PLY","e":null,"g":null,"d":"H2","c":null,"x":null,"cf":0.92}
]

Field key mapping:
- r: rowNumber
- n: label (part name)
- l: length (mm)
- w: width (mm)
- t: thickness (mm)
- q: quantity
- m: material code
- e: edge shortcode
- g: groove shortcode
- d: drill shortcode
- c: cnc shortcode
- x: notes
- cf: confidence (0.0-1.0)

RESPOND WITH JSON ARRAY ONLY - NO MARKDOWN FENCES, NO EXPLANATIONS.`;
}

/**
 * 2-Pass Template Parser Result
 */
export interface TwoPassTemplateResult {
  success: boolean;
  templateId: string;
  orgId: string;
  version: string;
  preScan: TemplatePreScanResult;
  parts: ParsedTemplatePart[];
  projectInfo?: TemplateParseResult["projectInfo"];
  errors: string[];
  warnings: string[];
  totalProcessingTimeMs: number;
}

/**
 * Parse CAI template using 2-pass approach
 * 
 * Pass 1: Quick pre-scan for metadata and row count
 * Pass 2: Full cell extraction with shortcode matching
 * 
 * Benefits:
 * - Pass 1 validates template and counts rows (fast, cheap)
 * - Pass 2 uses row count for accurate extraction (no missed rows)
 * - Shortcodes returned as-is for server-side resolution
 */
export async function parseTemplateWith2Pass(
  imageBase64: string,
  mimeType: string,
  templateId: string,
  aiImageParseFunction: (imageBase64: string, mimeType: string, prompt: string) => Promise<string>
): Promise<TwoPassTemplateResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Parse template ID
  const parsed = parseTemplateId(templateId);
  if (!parsed.isCAI || !parsed.orgId || !parsed.version) {
    return {
      success: false,
      templateId,
      orgId: "",
      version: "",
      preScan: {
        success: false,
        rowsWithData: 0,
        estimatedParts: 0,
        metadata: {},
        quality: "poor",
        qualityIssues: ["Invalid template ID"],
        columnVisibility: { edge: false, groove: false, drill: false, cnc: false, notes: false },
        processingTimeMs: 0,
      },
      parts: [],
      errors: ["Invalid template ID format"],
      warnings: [],
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }
  
  // Get org config
  const orgConfig = await getOrgTemplateConfig(parsed.orgId, parsed.version);
  if (!orgConfig) {
    warnings.push(`Org config not found for ${parsed.orgId} v${parsed.version}, using defaults`);
  }
  
  console.log(`[TemplateOCR] 2-Pass: Starting Pass 1 (pre-scan) for ${templateId}`);
  
  // ============================================
  // PASS 1: PRE-SCAN
  // ============================================
  const pass1Start = Date.now();
  let preScan: TemplatePreScanResult;
  
  try {
    const pass1Response = await aiImageParseFunction(imageBase64, mimeType, TEMPLATE_PRESCAN_PROMPT);
    
    // Parse pre-scan response
    let cleanedResponse = pass1Response.trim();
    cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    
    const pass1Data = JSON.parse(cleanedResponse);
    
    preScan = {
      success: true,
      rowsWithData: pass1Data.rowsWithData || 0,
      estimatedParts: pass1Data.rowsWithData || 0,
      metadata: pass1Data.metadata || {},
      quality: pass1Data.quality || "fair",
      qualityIssues: pass1Data.qualityIssues || [],
      columnVisibility: {
        edge: pass1Data.columnUsage?.edge ?? true,
        groove: pass1Data.columnUsage?.groove ?? true,
        drill: pass1Data.columnUsage?.drill ?? true,
        cnc: pass1Data.columnUsage?.cnc ?? true,
        notes: pass1Data.columnUsage?.notes ?? true,
      },
      processingTimeMs: Date.now() - pass1Start,
    };
    
    console.log(`[TemplateOCR] 2-Pass: Pass 1 complete - ${preScan.rowsWithData} rows found, quality: ${preScan.quality}, ${preScan.processingTimeMs}ms`);
    
    // Early exit if no data
    if (preScan.rowsWithData === 0) {
      return {
        success: true,
        templateId,
        orgId: parsed.orgId,
        version: parsed.version,
        preScan,
        parts: [],
        projectInfo: preScan.metadata,
        errors: [],
        warnings: ["Template appears empty - no rows with data found"],
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }
    
  } catch (error) {
    console.error(`[TemplateOCR] 2-Pass: Pass 1 failed`, error);
    // Fall back to single-pass if pre-scan fails
    preScan = {
      success: false,
      rowsWithData: 35, // Assume max rows
      estimatedParts: 35,
      metadata: {},
      quality: "fair",
      qualityIssues: ["Pre-scan failed, using fallback"],
      columnVisibility: { edge: true, groove: true, drill: true, cnc: true, notes: true },
      processingTimeMs: Date.now() - pass1Start,
    };
    warnings.push("Pre-scan failed, falling back to full extraction");
  }
  
  // ============================================
  // PASS 2: FULL EXTRACTION
  // ============================================
  console.log(`[TemplateOCR] 2-Pass: Starting Pass 2 (extraction) - expecting ${preScan.rowsWithData} rows`);
  const pass2Start = Date.now();
  
  try {
    // Build pass 2 prompt with org config and pre-scan results
    const pass2Prompt = orgConfig 
      ? buildPass2ExtractionPrompt(orgConfig, preScan)
      : buildDefaultPass2Prompt(preScan);
    
    const pass2Response = await aiImageParseFunction(imageBase64, mimeType, pass2Prompt);
    
    // Parse extraction response
    let cleanedResponse = pass2Response.trim();
    cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    
    const pass2Data = JSON.parse(cleanedResponse) as Array<{
      r: number;
      n?: string;
      l: number;
      w: number;
      t?: number;
      q?: number;
      m?: string;
      e?: string;
      g?: string;
      d?: string;
      c?: string;
      x?: string;
      cf?: number;
    }>;
    
    // Convert compact format to ParsedTemplatePart
    const parts: ParsedTemplatePart[] = pass2Data.map(p => ({
      rowNumber: p.r,
      label: p.n || undefined,
      length: p.l,
      width: p.w,
      thickness: p.t || 18,
      quantity: p.q || 1,
      material: p.m || undefined,
      edge: p.e || undefined,
      groove: p.g || undefined,
      drill: p.d || undefined,
      cnc: p.c || undefined,
      notes: p.x || undefined,
      confidence: p.cf || 0.8,
    }));
    
    const pass2TimeMs = Date.now() - pass2Start;
    console.log(`[TemplateOCR] 2-Pass: Pass 2 complete - ${parts.length} parts extracted, ${pass2TimeMs}ms`);
    
    // Validate row count
    if (parts.length !== preScan.rowsWithData) {
      warnings.push(`Expected ${preScan.rowsWithData} rows from pre-scan, got ${parts.length}`);
    }
    
    // Calculate average confidence
    const avgConfidence = parts.length > 0
      ? parts.reduce((sum, p) => sum + p.confidence, 0) / parts.length
      : 0;
    
    return {
      success: true,
      templateId,
      orgId: parsed.orgId,
      version: parsed.version,
      preScan,
      parts,
      projectInfo: preScan.metadata,
      errors,
      warnings,
      totalProcessingTimeMs: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error(`[TemplateOCR] 2-Pass: Pass 2 failed`, error);
    errors.push(`Pass 2 extraction failed: ${String(error)}`);
    
    return {
      success: false,
      templateId,
      orgId: parsed.orgId,
      version: parsed.version,
      preScan,
      parts: [],
      projectInfo: preScan.metadata,
      errors,
      warnings,
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Default Pass 2 prompt when org config is not available
 */
function buildDefaultPass2Prompt(preScan: TemplatePreScanResult): string {
  return `## CAI TEMPLATE CELL EXTRACTION (Pass 2 - Default)

### PRE-SCAN RESULTS:
- Rows with data: ${preScan.rowsWithData}
- Quality: ${preScan.quality}

### DETERMINISTIC COLUMN ORDER (LEFT TO RIGHT):
| Col | Header | Field | Type |
|-----|--------|-------|------|
| 1 | # | rowNumber | number |
| 2 | Part Name | label | text |
| 3 | L(mm) | length | number |
| 4 | W(mm) | width | number |
| 5 | Thk | thickness | number (default 18) |
| 6 | Qty | quantity | number (default 1) |
| 7 | Material | material | code |
| 8 | Edge | edge | shortcode |
| 9 | Groove | groove | shortcode |
| 10 | Drill | drill | shortcode |
| 11 | CNC | cnc | shortcode |
| 12 | Notes | notes | text |

### EXTRACTION RULES:
1. Extract EXACTLY ${preScan.rowsWithData} rows
2. Read each cell in the FIXED column order above
3. Return shortcodes EXACTLY as written
4. Do NOT swap Length/Width - Length is grain direction

### OUTPUT FORMAT (COMPACT JSON ARRAY):
[{"r":1,"n":"Side","l":720,"w":560,"t":18,"q":2,"m":"WPB","e":"2L","g":"GL","d":null,"c":null,"x":"note","cf":0.95}]

Field keys: r=row, n=name, l=length, w=width, t=thickness, q=qty, m=material, e=edge, g=groove, d=drill, c=cnc, x=notes, cf=confidence

RESPOND WITH JSON ARRAY ONLY.`;
}

// ============================================================
// EXPORTS
// ============================================================

export {
  parseTemplateId,
  type ParsedTemplateId,
};