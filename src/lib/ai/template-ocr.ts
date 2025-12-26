/**
 * CAI Intake - Template OCR with QR Code Detection
 * 
 * Detects QR codes in scanned templates and uses template-specific
 * prompts to achieve near-100% accuracy for known templates.
 */

import jsQR from "jsqr";
import type { TemplateOCRConfig } from "./provider";

// ============================================================
// TYPES
// ============================================================

export interface QRDetectionResult {
  found: boolean;
  templateId?: string;
  templateVersion?: string;
  templateConfig?: TemplateOCRConfig;
  rawData?: string;
}

export interface TemplateRegistry {
  [templateId: string]: TemplateOCRConfig;
}

// ============================================================
// TEMPLATE REGISTRY
// ============================================================

/**
 * Registry of known templates with their configurations
 * In production, this would be loaded from a database
 */
const templateRegistry: TemplateRegistry = {
  "cai-standard-v1": {
    templateId: "cai-standard-v1",
    version: "1.0",
    fieldLayout: {
      partName: { region: { x: 20, y: 100, width: 200, height: 30 }, expectedFormat: "text" },
      length: { region: { x: 230, y: 100, width: 80, height: 30 }, expectedFormat: "number" },
      width: { region: { x: 320, y: 100, width: 80, height: 30 }, expectedFormat: "number" },
      quantity: { region: { x: 410, y: 100, width: 60, height: 30 }, expectedFormat: "number" },
      material: { region: { x: 480, y: 100, width: 150, height: 30 }, expectedFormat: "text" },
      thickness: { region: { x: 640, y: 100, width: 60, height: 30 }, expectedFormat: "number" },
      grain: { region: { x: 710, y: 100, width: 80, height: 30 }, expectedFormat: "select" },
      edging: { region: { x: 800, y: 100, width: 100, height: 30 }, expectedFormat: "text" },
      notes: { region: { x: 910, y: 100, width: 200, height: 30 }, expectedFormat: "text" },
    },
    trainedPrompt: `This is a CAI Standard Cutlist Template v1.0.
    
The form has a table structure with the following columns (left to right):
1. # (row number) - IGNORE this column
2. Part Name - text label for the part
3. L (mm) - length dimension in millimeters
4. W (mm) - width dimension in millimeters  
5. Qty - quantity (number)
6. Material - material name/code
7. Thk - thickness in mm (usually 16, 18, 19, or 25)
8. Grain - grain direction (None, GL, GW, or blank)
9. EB - edge banding notation (L1, L2, W1, W2, "4" for all, or blank)
10. Notes - additional notes

IMPORTANT:
- Read each filled row carefully
- Numbers may be handwritten - 1 and 7 can look similar
- Empty rows should be skipped
- The form may have multiple pages
- Confidence should be 0.95+ for clearly filled fields`,
  },
  
  "cai-simple-v1": {
    templateId: "cai-simple-v1",
    version: "1.0",
    fieldLayout: {
      partName: { region: { x: 20, y: 100, width: 200, height: 30 }, expectedFormat: "text" },
      dimensions: { region: { x: 230, y: 100, width: 120, height: 30 }, expectedFormat: "LxW" },
      quantity: { region: { x: 360, y: 100, width: 60, height: 30 }, expectedFormat: "number" },
      notes: { region: { x: 430, y: 100, width: 200, height: 30 }, expectedFormat: "text" },
    },
    trainedPrompt: `This is a CAI Simple Cutlist Template v1.0.

The form has a simplified table with:
1. Part Name
2. Dimensions (LxW format like "720x560")
3. Qty
4. Notes

All parts are assumed to be:
- 18mm thickness
- White melamine material
- No grain restriction (can rotate)
- No edge banding

Parse each row that has dimensions filled in.`,
  },
};

// ============================================================
// QR CODE DETECTION
// ============================================================

/**
 * Detect QR code in an image and return template info if found
 */
export async function detectQRCode(imageData: ArrayBuffer): Promise<QRDetectionResult> {
  try {
    // Create image from buffer
    const blob = new Blob([imageData]);
    const imageBitmap = await createImageBitmap(blob);
    
    // Create canvas to get image data
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      return { found: false };
    }
    
    ctx.drawImage(imageBitmap, 0, 0);
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Scan for QR code
    const code = jsQR(imageDataObj.data, imageDataObj.width, imageDataObj.height);
    
    if (!code) {
      return { found: false };
    }
    
    // Parse QR code data
    const qrData = code.data;
    
    // Expected format: "CAI-TEMPLATE:templateId:version"
    // or JSON: {"type":"cai-template","id":"..","version":".."}
    let templateId: string | undefined;
    let templateVersion: string | undefined;
    
    if (qrData.startsWith("CAI-TEMPLATE:")) {
      const parts = qrData.split(":");
      templateId = parts[1];
      templateVersion = parts[2];
    } else if (qrData.startsWith("{")) {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.type === "cai-template") {
          templateId = parsed.id;
          templateVersion = parsed.version;
        }
      } catch {
        // Not valid JSON, check if it's a known template ID directly
        if (templateRegistry[qrData]) {
          templateId = qrData;
        }
      }
    } else if (templateRegistry[qrData]) {
      // Direct template ID
      templateId = qrData;
    }
    
    if (templateId && templateRegistry[templateId]) {
      return {
        found: true,
        templateId,
        templateVersion: templateVersion || templateRegistry[templateId].version,
        templateConfig: templateRegistry[templateId],
        rawData: qrData,
      };
    }
    
    return {
      found: true,
      rawData: qrData,
    };
    
  } catch (error) {
    console.warn("QR code detection failed:", error);
    return { found: false };
  }
}

/**
 * Detect QR code from a base64 image string
 */
export async function detectQRCodeFromBase64(base64Data: string): Promise<QRDetectionResult> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return detectQRCode(bytes.buffer);
  } catch (error) {
    console.warn("QR code detection from base64 failed:", error);
    return { found: false };
  }
}

// ============================================================
// TEMPLATE MANAGEMENT
// ============================================================

/**
 * Get a template configuration by ID
 */
export function getTemplateConfig(templateId: string): TemplateOCRConfig | undefined {
  return templateRegistry[templateId];
}

/**
 * Register a new template configuration
 */
export function registerTemplate(config: TemplateOCRConfig): void {
  templateRegistry[config.templateId] = config;
}

/**
 * Get all registered template IDs
 */
export function getRegisteredTemplateIds(): string[] {
  return Object.keys(templateRegistry);
}

/**
 * Generate QR code data for a template
 */
export function generateTemplateQRData(templateId: string, version?: string): string {
  const config = templateRegistry[templateId];
  if (!config) {
    return `CAI-TEMPLATE:${templateId}:${version || "1.0"}`;
  }
  
  return JSON.stringify({
    type: "cai-template",
    id: templateId,
    version: version || config.version,
  });
}

// ============================================================
// TEMPLATE PROMPT BUILDER
// ============================================================

/**
 * Build an optimized prompt for a specific template
 */
export function buildTemplatePrompt(templateId: string): string | undefined {
  const config = templateRegistry[templateId];
  if (!config?.trainedPrompt) {
    return undefined;
  }
  
  return config.trainedPrompt;
}

/**
 * Get field layout description for AI prompt
 */
export function getFieldLayoutDescription(templateId: string): string {
  const config = templateRegistry[templateId];
  if (!config?.fieldLayout) {
    return "";
  }
  
  const fields = Object.entries(config.fieldLayout)
    .map(([name, layout]) => `- ${name}: ${layout.expectedFormat}`)
    .join("\n");
  
  return `Expected fields:\n${fields}`;
}





