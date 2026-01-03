/**
 * CAI Intake - Text-Based Template Detection
 * 
 * Fallback detection when QR code detection fails.
 * Uses AI vision to identify CAI Smart Templates by visual/text indicators.
 * 
 * Detection indicators:
 * 1. Header row: # | Part Name | L(mm) | W(mm) | Thk | Qty | Material | Edge | Groove | Drill | CNC | Notes
 * 2. Footer: "CabinetAI™ Smart Template v{X.X}"
 * 3. Corner registration marks (┌ ┐ └ ┘)
 * 4. Project info section header
 * 5. Organization name in header area
 */

import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// IMAGE OPTIMIZATION FOR TEMPLATE DETECTION
// ============================================================

/**
 * Quick compress image for template detection (must be under 5MB for Anthropic)
 * Uses aggressive compression since we just need to detect text patterns
 */
async function compressForDetection(
  imageBase64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  // Check size - Anthropic limit is 5MB, base64 is ~33% larger than binary
  const estimatedBytes = (imageBase64.length * 3) / 4;
  const MAX_SIZE = 4 * 1024 * 1024; // 4MB to be safe (leaves room for encoding overhead)
  
  if (estimatedBytes <= MAX_SIZE) {
    return { base64: imageBase64, mimeType };
  }
  
  console.log(`[TemplateTextDetector] Image too large (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB), compressing...`);
  
  try {
    // Dynamic import sharp (server-only)
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    
    // Decode base64 to buffer
    const buffer = Buffer.from(imageBase64, "base64");
    
    // Compress aggressively for detection - we just need to read text
    const compressed = await sharp(buffer)
      .resize(1600, 1600, { 
        fit: "inside", 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();
    
    const newBase64 = compressed.toString("base64");
    console.log(`[TemplateTextDetector] Compressed to ${(compressed.byteLength / 1024).toFixed(0)}KB`);
    
    return { base64: newBase64, mimeType: "image/jpeg" };
  } catch (error) {
    console.error("[TemplateTextDetector] Compression failed:", error);
    // Return original and let it fail at API level
    return { base64: imageBase64, mimeType };
  }
}

// ============================================================
// TYPES
// ============================================================

export interface TextBasedTemplateDetection {
  isCAITemplate: boolean;
  confidence: number; // 0-1
  
  // Extracted metadata
  organizationName?: string;
  templateVersion?: string;
  
  // Detection evidence
  indicators: {
    hasCAIHeader: boolean;
    hasCAIFooter: boolean;
    hasStandardColumns: boolean;
    hasCornerMarks: boolean;
    hasProjectInfoSection: boolean;
    hasQRCodeArea: boolean;
  };
  
  // If template detected, suggested parsing approach
  suggestedApproach: "template_2pass" | "template_simple" | "generic";
  
  // Raw AI response for debugging
  rawAnalysis?: string;
}

export interface TemplateTextAnalysis {
  // Organization/header info
  orgName?: string;
  projectName?: string;
  customerName?: string;
  sectionArea?: string;
  date?: string;
  pageInfo?: string;
  
  // Template structure
  templateVersion?: string;
  columnHeaders?: string[];
  rowCount?: number;
  
  // Detection signals
  signals: {
    cabinetAIText: boolean;
    smartTemplateText: boolean;
    standardColumnHeaders: boolean;
    rowNumberColumn: boolean;
    operationsColumns: boolean; // Edge, Groove, Drill, CNC
    registrationMarks: boolean;
    qrCodeVisible: boolean;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

const TEMPLATE_DETECTION_PROMPT = `You are analyzing an image to determine if it's a CAI (CabinetAI) Smart Cutlist Template.

Look for these SPECIFIC indicators:

1. **QR Code Area**: Top-left corner should have a QR code with text like "CAI-xxx-v1.0"

2. **Organization Header**: Large text at top showing company name (e.g., "ACME CABINETS & MILLWORK")

3. **Template Label**: Text saying "Smart Cutlist Template v1.0" or similar

4. **Project Info Section**: Box with fields like:
   - Project Name / Code
   - Customer / Phone
   - Section/Area / Date

5. **Standard Column Headers** (THIS IS KEY):
   # | Part Name | L(mm) | W(mm) | Thk | Qty | Material | Edge (code) | Groove (GL/GW) | Drill (code) | CNC (code) | Notes

6. **Footer**: "CabinetAI™ Smart Template v{version}" at bottom

7. **Corner Registration Marks**: ┌ ┐ └ ┘ symbols at page corners

8. **Numbered Rows**: Table with row numbers 1, 2, 3... up to 35

Respond with ONLY valid JSON (no markdown):
{
  "isCAITemplate": true/false,
  "confidence": 0.0-1.0,
  "orgName": "extracted organization name or null",
  "templateVersion": "extracted version like 1.0 or null",
  "indicators": {
    "hasQRCodeArea": true/false,
    "hasCAIHeader": true/false,
    "hasCAIFooter": true/false,
    "hasStandardColumns": true/false,
    "hasCornerMarks": true/false,
    "hasProjectInfoSection": true/false,
    "hasNumberedRows": true/false
  },
  "columnHeadersFound": ["list of column headers you can read"],
  "estimatedDataRows": number or 0 if blank/empty template,
  "notes": "any relevant observations"
}`;

const TEMPLATE_COLUMNS_STANDARD = [
  "#",
  "Part Name",
  "L(mm)",
  "W(mm)", 
  "Thk",
  "Qty",
  "Material",
  "Edge",
  "Groove",
  "Drill",
  "CNC",
  "Notes"
];

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================

/**
 * Detect if an image is a CAI Smart Template using AI text/visual analysis
 * This is the fallback when QR code detection fails
 */
export async function detectTemplateViaText(
  imageBase64: string,
  mimeType: string
): Promise<TextBasedTemplateDetection> {
  const startTime = Date.now();
  
  try {
    // Compress image if needed (must be under 5MB for Anthropic)
    const compressed = await compressForDetection(imageBase64, mimeType);
    
    // Use Anthropic for detection (fastest and most accurate for this task)
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Create API call with 30 second timeout (detection shouldn't take long)
    const DETECTION_TIMEOUT_MS = 30000;
    
    const apiCall = anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: compressed.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: compressed.base64,
              },
            },
            {
              type: "text",
              text: TEMPLATE_DETECTION_PROMPT,
            },
          ],
        },
      ],
    });
    
    // Race with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Template detection timeout")), DETECTION_TIMEOUT_MS);
    });
    
    const response = await Promise.race([apiCall, timeoutPromise]);
    
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    
    console.log(`[TemplateTextDetector] AI analysis completed in ${Date.now() - startTime}ms`);
    
    // Parse the JSON response
    const analysis = parseDetectionResponse(rawText);
    
    return buildDetectionResult(analysis, rawText);
    
  } catch (error) {
    console.error("[TemplateTextDetector] Detection failed:", error);
    
    return {
      isCAITemplate: false,
      confidence: 0,
      indicators: {
        hasCAIHeader: false,
        hasCAIFooter: false,
        hasStandardColumns: false,
        hasCornerMarks: false,
        hasProjectInfoSection: false,
        hasQRCodeArea: false,
      },
      suggestedApproach: "generic",
      rawAnalysis: String(error),
    };
  }
}

/**
 * Quick template check - lighter weight than full detection
 * Returns true if likely a CAI template based on quick visual scan
 */
export async function quickTemplateCheck(
  imageBase64: string,
  mimeType: string
): Promise<{ isLikelyTemplate: boolean; confidence: number }> {
  try {
    // Compress image if needed
    const compressed = await compressForDetection(imageBase64, mimeType);
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: compressed.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: compressed.base64,
              },
            },
            {
              type: "text",
              text: `Quick check: Is this a CAI/CabinetAI Smart Cutlist Template form?
Look for: QR code top-left, "CabinetAI" or "Smart Template" text, table with Part Name/L/W/Qty columns.
Reply ONLY with JSON: {"isTemplate": true/false, "confidence": 0.0-1.0}`,
            },
          ],
        },
      ],
    });
    
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    
    try {
      const parsed = JSON.parse(rawText.trim());
      return {
        isLikelyTemplate: parsed.isTemplate === true,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    } catch {
      return { isLikelyTemplate: false, confidence: 0 };
    }
    
  } catch (error) {
    console.error("[TemplateTextDetector] Quick check failed:", error);
    return { isLikelyTemplate: false, confidence: 0 };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

interface ParsedDetectionResponse {
  isCAITemplate: boolean;
  confidence: number;
  orgName?: string;
  templateVersion?: string;
  indicators: {
    hasQRCodeArea?: boolean;
    hasCAIHeader?: boolean;
    hasCAIFooter?: boolean;
    hasStandardColumns?: boolean;
    hasCornerMarks?: boolean;
    hasProjectInfoSection?: boolean;
    hasNumberedRows?: boolean;
  };
  columnHeadersFound?: string[];
  estimatedDataRows?: number;
  notes?: string;
}

function parseDetectionResponse(rawText: string): ParsedDetectionResponse {
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleaned = rawText.trim();
    
    // Remove ```json ... ``` wrapper
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }
    
    const parsed = JSON.parse(cleaned);
    
    return {
      isCAITemplate: parsed.isCAITemplate === true,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      orgName: parsed.orgName || undefined,
      templateVersion: parsed.templateVersion || undefined,
      indicators: parsed.indicators || {},
      columnHeadersFound: Array.isArray(parsed.columnHeadersFound) ? parsed.columnHeadersFound : [],
      estimatedDataRows: typeof parsed.estimatedDataRows === "number" ? parsed.estimatedDataRows : 0,
      notes: parsed.notes || undefined,
    };
    
  } catch (error) {
    console.warn("[TemplateTextDetector] Failed to parse AI response:", error);
    
    // Try to extract key info from raw text
    const isTemplate = /isCAITemplate["']?\s*:\s*true/i.test(rawText) ||
                       /CAI.*Template/i.test(rawText);
    
    return {
      isCAITemplate: isTemplate,
      confidence: isTemplate ? 0.5 : 0,
      indicators: {},
    };
  }
}

function buildDetectionResult(
  analysis: ParsedDetectionResponse,
  rawText: string
): TextBasedTemplateDetection {
  const indicators = {
    hasCAIHeader: analysis.indicators.hasCAIHeader || false,
    hasCAIFooter: analysis.indicators.hasCAIFooter || false,
    hasStandardColumns: analysis.indicators.hasStandardColumns || false,
    hasCornerMarks: analysis.indicators.hasCornerMarks || false,
    hasProjectInfoSection: analysis.indicators.hasProjectInfoSection || false,
    hasQRCodeArea: analysis.indicators.hasQRCodeArea || false,
  };
  
  // Calculate confidence based on indicators
  let calculatedConfidence = 0;
  if (indicators.hasStandardColumns) calculatedConfidence += 0.35;
  if (indicators.hasCAIHeader || indicators.hasCAIFooter) calculatedConfidence += 0.25;
  if (indicators.hasProjectInfoSection) calculatedConfidence += 0.15;
  if (indicators.hasQRCodeArea) calculatedConfidence += 0.15;
  if (indicators.hasCornerMarks) calculatedConfidence += 0.10;
  
  // Use AI's confidence if higher
  const finalConfidence = Math.max(
    analysis.isCAITemplate ? analysis.confidence : 0,
    calculatedConfidence
  );
  
  // Determine if it's a CAI template (threshold: 0.6)
  const isCAITemplate = analysis.isCAITemplate && finalConfidence >= 0.6;
  
  // Determine suggested parsing approach
  let suggestedApproach: "template_2pass" | "template_simple" | "generic" = "generic";
  
  if (isCAITemplate) {
    if (indicators.hasStandardColumns && analysis.estimatedDataRows && analysis.estimatedDataRows > 0) {
      // Has data and standard columns - use 2-pass for accuracy
      suggestedApproach = "template_2pass";
    } else if (indicators.hasStandardColumns) {
      // Standard columns but maybe blank - simple parse
      suggestedApproach = "template_simple";
    }
  }
  
  return {
    isCAITemplate,
    confidence: finalConfidence,
    organizationName: analysis.orgName,
    templateVersion: analysis.templateVersion,
    indicators,
    suggestedApproach,
    rawAnalysis: rawText,
  };
}

// ============================================================
// TEMPLATE-AWARE PARSING PROMPT
// ============================================================

/**
 * Generate a template-specific parsing prompt when we detect a CAI template
 * but don't have org-specific config (QR failed, using text detection)
 */
export function getTemplateAwareParsingPrompt(
  detection: TextBasedTemplateDetection
): string {
  return `You are parsing a CAI (CabinetAI) Smart Cutlist Template.

${detection.organizationName ? `Organization: ${detection.organizationName}` : ""}
${detection.templateVersion ? `Template Version: ${detection.templateVersion}` : ""}

This template has a FIXED column structure:
| # | Part Name | L(mm) | W(mm) | Thk | Qty | Material | Edge (code) | Groove (GL/GW) | Drill (code) | CNC (code) | Notes |

CRITICAL COLUMN MAPPINGS:
- Column 1 (#): Row number (ignore)
- Column 2 (Part Name): Part label/name
- Column 3 (L(mm)): Length in millimeters - this is the GRAIN direction
- Column 4 (W(mm)): Width in millimeters
- Column 5 (Thk): Thickness in mm
- Column 6 (Qty): Quantity
- Column 7 (Material): Material code/name
- Column 8 (Edge): Edge banding code (e.g., "2L2W", "2L", "1L1W", "")
- Column 9 (Groove): Groove code - GL=Groove on Length, GW=Groove on Width
- Column 10 (Drill): Drilling pattern code
- Column 11 (CNC): CNC operation code
- Column 12 (Notes): Additional notes

EDGE BANDING CODES:
- "2L2W" or "4" = All 4 edges
- "2L" = Both long edges
- "2W" = Both short edges  
- "1L1W" = One long + one short
- "1L" = One long edge
- "1W" = One short edge
- Empty = No edge banding

Return ONLY valid JSON array of parts (skip empty rows):
[
  {
    "n": "Part Name",
    "l": 600,
    "w": 400,
    "t": 18,
    "q": 2,
    "m": "Material",
    "e": "2L2W",
    "g": "GL",
    "d": "drilling code",
    "c": "cnc code",
    "notes": "any notes"
  }
]

Rules:
- Skip rows with no part name or no dimensions
- L and W are ALREADY in correct orientation (L=grain direction)
- Do NOT swap L and W
- Return empty array [] if template is blank`;
}

/**
 * Generate a project info extraction prompt
 */
export function getProjectInfoPrompt(): string {
  return `Extract the PROJECT INFORMATION from the top section of this CAI template.

Look for fields like:
- Project Name
- Code/Project Code
- Customer
- Phone
- Section/Area
- Date
- Page X of Y

Return ONLY valid JSON:
{
  "projectName": "extracted or null",
  "projectCode": "extracted or null", 
  "customerName": "extracted or null",
  "phone": "extracted or null",
  "sectionArea": "extracted or null",
  "date": "extracted or null",
  "page": number or null,
  "totalPages": number or null
}

If a field is empty/blank, return null for it.`;
}

// ============================================================
// COMBINED DETECTION + PARSE FUNCTION
// ============================================================

export interface TemplateDetectionAndParseResult {
  detection: TextBasedTemplateDetection;
  shouldUseTemplateMode: boolean;
  templatePrompt?: string;
  projectInfoPrompt?: string;
}

/**
 * Detect template and prepare for parsing
 * Returns detection result plus prompts for template-aware parsing
 */
export async function detectAndPrepareTemplateParsing(
  imageBase64: string,
  mimeType: string
): Promise<TemplateDetectionAndParseResult> {
  const detection = await detectTemplateViaText(imageBase64, mimeType);
  
  const shouldUseTemplateMode = detection.isCAITemplate && 
    detection.confidence >= 0.65 &&
    detection.indicators.hasStandardColumns;
  
  return {
    detection,
    shouldUseTemplateMode,
    templatePrompt: shouldUseTemplateMode ? getTemplateAwareParsingPrompt(detection) : undefined,
    projectInfoPrompt: shouldUseTemplateMode ? getProjectInfoPrompt() : undefined,
  };
}

