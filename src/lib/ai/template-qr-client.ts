/**
 * CAI Intake - Client-side QR Detection
 * 
 * Uses browser APIs (createImageBitmap, OffscreenCanvas) for QR code detection.
 * This file is safe to import in client components.
 */

import jsQR from "jsqr";
import { parseTemplateId, type ParsedTemplateId } from "@/lib/templates/org-template-generator";

// ============================================================
// TYPES
// ============================================================

export interface QRDetectionResult {
  found: boolean;
  templateId?: string;
  parsed?: ParsedTemplateId;
  rawData?: string;
  error?: string;
}

// ============================================================
// CLIENT-SIDE QR CODE DETECTION
// ============================================================

/**
 * Detect QR code in an image and parse template ID
 * Uses browser APIs - safe for client components
 */
export async function detectTemplateQR(imageData: ArrayBuffer): Promise<QRDetectionResult> {
  try {
    // Check if we're in a browser environment
    if (typeof window === "undefined" || typeof createImageBitmap === "undefined") {
      return { found: false, error: "QR detection requires browser environment" };
    }

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
    
    return {
      found: true,
      templateId: qrData,
      parsed,
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
export async function detectQRFromBase64(base64Data: string): Promise<QRDetectionResult> {
  try {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return detectTemplateQR(bytes.buffer);
  } catch (error) {
    return { found: false, error: `Failed to decode base64: ${error}` };
  }
}

