/**
 * CAI Intake - OCR/AI Parser
 * 
 * Parses images and PDFs into CutPart objects using OCR and AI.
 * Supports Tesseract.js for local OCR and OpenAI Vision for complex documents.
 */

import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import { parseTextBatch, type TextParseResult } from "@/lib/parsers/text-parser";

// ============================================================
// TYPES
// ============================================================

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface AIParseResult {
  parts: CutPart[];
  raw_response: string;
  confidence: number;
  warnings: string[];
  errors: string[];
}

export interface OCRParserOptions {
  /** Use AI for parsing (OpenAI Vision) */
  useAI?: boolean;
  /** Language for OCR */
  language?: string;
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness */
  defaultThickness?: number;
  /** OpenAI API key (if using AI) */
  openaiApiKey?: string;
}

// ============================================================
// OCR PROCESSING
// ============================================================

/**
 * Process an image with Tesseract.js OCR
 * Note: Tesseract.js must be loaded dynamically on the client
 */
export async function processImageOCR(
  imageData: ArrayBuffer | string,
  options: OCRParserOptions = {}
): Promise<OCRResult> {
  // Dynamic import of Tesseract.js
  const Tesseract = await import("tesseract.js");
  
  const worker = await Tesseract.createWorker(options.language ?? "eng");
  
  try {
    // Convert ArrayBuffer to Uint8Array for tesseract.js compatibility
    const imageInput = typeof imageData === "string" 
      ? imageData 
      : new Uint8Array(imageData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await worker.recognize(imageInput as any);
    
    const blocks: OCRBlock[] = result.data.blocks?.map(block => ({
      text: block.text,
      confidence: block.confidence / 100,
      bbox: {
        x: block.bbox.x0,
        y: block.bbox.y0,
        width: block.bbox.x1 - block.bbox.x0,
        height: block.bbox.y1 - block.bbox.y0,
      },
    })) ?? [];
    
    return {
      text: result.data.text,
      confidence: result.data.confidence / 100,
      blocks,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Parse OCR text into parts
 */
export function parseOCRText(
  ocrResult: OCRResult,
  options: OCRParserOptions = {}
): TextParseResult[] {
  const result = parseTextBatch(ocrResult.text, {
    defaultMaterialId: options.defaultMaterialId,
    defaultThicknessMm: options.defaultThickness,
    sourceMethod: "ocr_generic",
  });
  
  // Adjust confidence based on OCR confidence
  return result.parts.map(p => ({
    ...p,
    confidence: p.confidence * ocrResult.confidence,
    part: {
      ...p.part,
      audit: {
        source_method: p.part.audit?.source_method ?? "ocr_generic",
        source_ref: p.part.audit?.source_ref,
        confidence: (p.part.audit?.confidence ?? 1) * ocrResult.confidence,
        human_verified: p.part.audit?.human_verified ?? false,
      },
    },
  }));
}

// ============================================================
// AI PARSING (OpenAI Vision)
// ============================================================

const AI_SYSTEM_PROMPT = `You are a cutlist parser for woodworking and cabinet making. 
Extract part specifications from the provided image or document.

For each part found, extract:
- Label/name (if visible)
- Length (L) in mm
- Width (W) in mm  
- Quantity
- Material (if specified)
- Grain direction (if specified)
- Edge banding (if specified)

Return the data as a JSON array with objects containing:
{
  "label": "Part name",
  "L": 720,
  "W": 560,
  "qty": 2,
  "material": "White Melamine",
  "grain": "none" | "along_L" | "along_W",
  "edges": ["L1", "L2"] // edges to band
}

If you cannot determine a value, omit it or use null.
Only return valid JSON, no explanations.`;

/**
 * Parse an image using OpenAI Vision API
 */
export async function parseImageWithAI(
  imageBase64: string,
  options: OCRParserOptions = {}
): Promise<AIParseResult> {
  const apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      parts: [],
      raw_response: "",
      confidence: 0,
      warnings: [],
      errors: ["OpenAI API key not configured"],
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: AI_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/png;base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all cutlist parts from this image.",
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        parts: [],
        raw_response: error,
        confidence: 0,
        warnings: [],
        errors: [`OpenAI API error: ${response.status}`],
      };
    }

    const data = await response.json();
    const rawResponse = data.choices[0]?.message?.content ?? "";
    
    // Parse the JSON response
    const parts = parseAIResponse(rawResponse, options);
    
    return {
      parts,
      raw_response: rawResponse,
      confidence: 0.85,
      warnings: [],
      errors: [],
    };
  } catch (error) {
    return {
      parts: [],
      raw_response: "",
      confidence: 0,
      warnings: [],
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Parse the AI response JSON into CutPart objects
 */
function parseAIResponse(
  response: string,
  options: OCRParserOptions
): CutPart[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const data = JSON.parse(jsonStr);
    const items = Array.isArray(data) ? data : [data];
    
    return items.map((item: {
      label?: string;
      L?: number;
      W?: number;
      qty?: number;
      quantity?: number;
      material?: string;
      grain?: string;
      edges?: string[];
    }) => {
      const L = item.L ?? item.L ?? 0;
      const W = item.W ?? item.W ?? 0;
      
      if (L <= 0 || W <= 0) return null;
      
      // Map grain value (along_W is treated same as along_L)
      const grainValue = item.grain === "along_W" ? "along_L" : (item.grain as "none" | "along_L") ?? "none";
      
      const part: CutPart = {
        part_id: generateId("P"),
        label: item.label,
        qty: item.qty ?? item.quantity ?? 1,
        size: { L, W },
        thickness_mm: options.defaultThickness ?? 18,
        material_id: options.defaultMaterialId ?? "default",
        grain: grainValue,
        allow_rotation: grainValue === "none",
        audit: {
          source_method: "ocr_generic",
          confidence: 0.85,
          human_verified: false,
        },
      };
      
      // Add edge banding if specified
      if (item.edges && item.edges.length > 0) {
        part.ops = {
          edging: {
            edges: item.edges.reduce((acc: Record<string, { apply: boolean }>, edge: string) => {
              if (["L1", "L2", "W1", "W2"].includes(edge)) {
                acc[edge] = { apply: true };
              }
              return acc;
            }, {}),
          },
        };
      }
      
      return part;
    }).filter((p): p is CutPart => p !== null);
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return [];
  }
}

// ============================================================
// PDF PROCESSING
// ============================================================

/**
 * Extract text from a PDF file
 * Note: pdf-parse must be installed: npm install pdf-parse
 */
export async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import of pdf-parse
    const pdfParseModule = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  } catch (error) {
    console.error("PDF parsing failed:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Parse a PDF file into parts
 */
export async function parsePDF(
  buffer: ArrayBuffer,
  options: OCRParserOptions = {}
): Promise<TextParseResult[]> {
  const text = await extractPDFText(buffer);
  
  const result = parseTextBatch(text, {
    defaultMaterialId: options.defaultMaterialId,
    defaultThicknessMm: options.defaultThickness,
    sourceMethod: "ocr_generic",
  });
  
  return result.parts;
}

// ============================================================
// UNIFIED PARSER
// ============================================================

export type FileType = "image" | "pdf" | "unknown";

/**
 * Detect file type from content type or buffer
 */
export function detectFileType(contentType?: string, buffer?: ArrayBuffer): FileType {
  if (contentType) {
    if (contentType.startsWith("image/")) return "image";
    if (contentType === "application/pdf") return "pdf";
  }
  
  if (buffer) {
    const bytes = new Uint8Array(buffer.slice(0, 8));
    // Check for PDF magic bytes
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return "pdf";
    }
    // Check for common image magic bytes
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return "image"; // JPEG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image"; // PNG
  }
  
  return "unknown";
}

/**
 * Parse any supported file type
 */
export async function parseFile(
  buffer: ArrayBuffer,
  contentType: string,
  options: OCRParserOptions = {}
): Promise<{
  parts: CutPart[];
  confidence: number;
  warnings: string[];
  errors: string[];
}> {
  const fileType = detectFileType(contentType, buffer);
  
  switch (fileType) {
    case "pdf":
      try {
        const results = await parsePDF(buffer, options);
        return {
          parts: results.map(r => r.part),
          confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
          warnings: results.flatMap(r => r.warnings),
          errors: results.flatMap(r => r.errors),
        };
      } catch (error) {
        return {
          parts: [],
          confidence: 0,
          warnings: [],
          errors: [error instanceof Error ? error.message : "PDF parsing failed"],
        };
      }
      
    case "image":
      if (options.useAI) {
        const base64 = Buffer.from(buffer).toString("base64");
        const result = await parseImageWithAI(`data:${contentType};base64,${base64}`, options);
        return {
          parts: result.parts,
          confidence: result.confidence,
          warnings: result.warnings,
          errors: result.errors,
        };
      } else {
        const ocrResult = await processImageOCR(buffer, options);
        const results = parseOCRText(ocrResult, options);
        return {
          parts: results.map(r => r.part),
          confidence: ocrResult.confidence,
          warnings: results.flatMap(r => r.warnings),
          errors: results.flatMap(r => r.errors),
        };
      }
      
    default:
      return {
        parts: [],
        confidence: 0,
        warnings: [],
        errors: ["Unsupported file type"],
      };
  }
}

