/**
 * CAI Intake - OpenAI Provider Implementation
 * 
 * Uses GPT-4o for text parsing and vision/OCR tasks.
 * This is OpenAI's flagship multimodal model.
 */

import OpenAI from "openai";

// ============================================================
// MODEL CONFIGURATION
// ============================================================

/**
 * GPT model to use for all operations.
 * 
 * Available models:
 * - gpt-4o          : Flagship multimodal model with vision support
 * - gpt-4o-mini     : Smaller, faster, cheaper version
 * - gpt-4-turbo     : Previous generation model
 * 
 * Update this constant to switch models across all operations.
 */
const GPT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

/**
 * Maximum completion tokens for response generation.
 * GPT-4o supports up to 128K context, 16K output.
 */
const MAX_COMPLETION_TOKENS = 8000;
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";
import {
  type AIProvider,
  type AIParseResult,
  type ParseOptions,
  type ParsedPartResult,
  type OCROptions,
  type OCRResult,
  type OCRPageResult,
  parseAIResponseJSON,
  calculateOverallConfidence,
} from "./provider";
import {
  OPENAI_SYSTEM_PROMPT,
  buildParsePrompt,
  type AIPartResponse,
  validateAIPartResponse,
} from "./prompts";

// ============================================================
// OPENAI PROVIDER
// ============================================================

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.client || !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async parseText(text: string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isMessyData: this.looksMessy(text),
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          { role: "user", content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}` },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] }>(rawResponse);
      
      if (!parsed || !Array.isArray(parsed.parts)) {
        // Try parsing as direct array
        const directArray = parseAIResponseJSON<AIPartResponse[]>(rawResponse);
        if (directArray && Array.isArray(directArray)) {
          return this.processResults(directArray, rawResponse, startTime, options);
        }
        
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse AI response as valid parts array"],
          processingTime: Date.now() - startTime,
        };
      }

      return this.processResults(parsed.parts, rawResponse, startTime, options);
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseImage(imageData: ArrayBuffer | string, options: ParseOptions): Promise<AIParseResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      const prompt = buildParsePrompt({
        extractMetadata: options.extractMetadata,
        isImage: true,
        templateId: options.templateId,
        templateConfig: options.templateConfig ? {
          fieldLayout: options.templateConfig.fieldLayout,
        } : undefined,
      });

      // Convert ArrayBuffer to base64 if needed
      let imageUrl: string;
      if (typeof imageData === "string") {
        imageUrl = imageData.startsWith("data:") 
          ? imageData 
          : `data:image/jpeg;base64,${imageData}`;
      } else {
        const base64 = Buffer.from(imageData).toString("base64");
        imageUrl = `data:image/jpeg;base64,${base64}`;
      }

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(rawResponse);
      
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse AI response from image analysis"],
          processingTime: Date.now() - startTime,
        };
      }

      return this.processResults(parts, rawResponse, startTime, options);
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseDocument(
    pdfData: ArrayBuffer,
    extractedText?: string,
    options?: ParseOptions
  ): Promise<AIParseResult> {
    // If we have extracted text, use text parsing
    if (extractedText) {
      return this.parseText(extractedText, options || {
        extractMetadata: true,
        confidence: "balanced",
      });
    }

    // Otherwise, convert first page to image and use vision
    // For now, return error - PDF image conversion requires additional setup
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["PDF parsing requires text extraction. Please extract text first or use image upload."],
      processingTime: 0,
    };
  }

  // ============================================================
  // OCR METHODS
  // ============================================================

  async parseImageForOCR(
    imageData: ArrayBuffer | string,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient();
      
      // Report progress
      options.onProgress?.({
        stage: "processing",
        percent: 10,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Sending to GPT-4 Vision...",
      });

      // Build OCR-optimized prompt
      const ocrPrompt = this.buildOCRPrompt(options);

      // Convert to base64 if needed
      let imageUrl: string;
      if (typeof imageData === "string") {
        imageUrl = imageData.startsWith("data:") 
          ? imageData 
          : `data:image/jpeg;base64,${imageData}`;
      } else {
        const base64 = Buffer.from(imageData).toString("base64");
        imageUrl = `data:image/jpeg;base64,${base64}`;
      }

      options.onProgress?.({
        stage: "extracting",
        percent: 30,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Extracting text and parts...",
      });

      const response = await client.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: ocrPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });

      options.onProgress?.({
        stage: "parsing",
        percent: 70,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: "Processing extracted data...",
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      
      // Parse the enhanced OCR response
      const parsed = parseAIResponseJSON<{
        parts: AIPartResponse[];
        extractedText?: string;
        detectedFormat?: string;
        documentMetadata?: {
          client?: string;
          jobName?: string;
          material?: string;
        };
      }>(rawResponse);
      
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse OCR response"],
          processingTime: Date.now() - startTime,
        };
      }

      // Apply learning context if available
      let detectedClient: string | undefined;
      if (options.learningContext?.clientTemplate) {
        detectedClient = options.learningContext.clientTemplate.clientName;
      } else if (parsed && !Array.isArray(parsed) && parsed.documentMetadata?.client) {
        detectedClient = parsed.documentMetadata.client;
      }

      const baseResult = this.processResults(parts, rawResponse, startTime, options);

      options.onProgress?.({
        stage: "complete",
        percent: 100,
        currentPage: options.pageNumber,
        totalPages: options.totalPages,
        message: `Found ${baseResult.parts.length} parts`,
      });

      return {
        ...baseResult,
        extractedText: parsed && !Array.isArray(parsed) ? parsed.extractedText : undefined,
        detectedFormat: (parsed && !Array.isArray(parsed) ? parsed.detectedFormat : "mixed") as OCRResult["detectedFormat"],
        pageConfidence: baseResult.totalConfidence,
        learningApplied: !!options.learningContext?.enabled,
        detectedClient,
      };
      
    } catch (error) {
      return {
        success: false,
        parts: [],
        totalConfidence: 0,
        errors: [error instanceof Error ? error.message : "OCR processing failed"],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async parseDocumentForOCR(
    pages: Array<ArrayBuffer | string>,
    options: OCROptions
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const pageResults: OCRPageResult[] = [];
    const allParts: ParsedPartResult[] = [];
    const errors: string[] = [];
    let extractedText = "";
    let detectedFormat: OCRResult["detectedFormat"] = "mixed";
    let detectedClient: string | undefined;

    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      
      options.onProgress?.({
        stage: "processing",
        percent: Math.round((i / pages.length) * 100),
        currentPage: pageNum,
        totalPages: pages.length,
        message: `Processing page ${pageNum} of ${pages.length}...`,
      });

      const pageResult = await this.parseImageForOCR(pages[i], {
        ...options,
        pageNumber: pageNum,
        totalPages: pages.length,
        previousContext: extractedText.slice(-500), // Last 500 chars for context
        onProgress: undefined, // Don't propagate nested progress
      });

      pageResults.push({
        pageNumber: pageNum,
        extractedText: pageResult.extractedText || "",
        confidence: pageResult.pageConfidence || pageResult.totalConfidence,
        partsCount: pageResult.parts.length,
        parts: pageResult.parts,
      });

      allParts.push(...pageResult.parts);
      
      if (pageResult.extractedText) {
        extractedText += `\n--- Page ${pageNum} ---\n${pageResult.extractedText}`;
      }
      
      if (pageResult.errors.length > 0) {
        errors.push(`Page ${pageNum}: ${pageResult.errors.join(", ")}`);
      }

      // Use first detected format/client
      if (!detectedFormat && pageResult.detectedFormat) {
        detectedFormat = pageResult.detectedFormat;
      }
      if (!detectedClient && pageResult.detectedClient) {
        detectedClient = pageResult.detectedClient;
      }
    }

    options.onProgress?.({
      stage: "complete",
      percent: 100,
      currentPage: pages.length,
      totalPages: pages.length,
      message: `Processed ${pages.length} pages, found ${allParts.length} parts`,
    });

    const totalConfidence = allParts.length > 0
      ? allParts.reduce((sum, p) => sum + p.confidence, 0) / allParts.length
      : 0;

    return {
      success: allParts.length > 0,
      parts: allParts,
      totalConfidence,
      errors,
      processingTime: Date.now() - startTime,
      extractedText: extractedText.trim(),
      detectedFormat,
      pageResults,
      learningApplied: !!options.learningContext?.enabled,
      detectedClient,
    };
  }

  private buildOCRPrompt(options: OCROptions): string {
    let prompt = buildParsePrompt({
      extractMetadata: options.extractMetadata,
      isImage: true,
      templateId: options.templateId,
      templateConfig: options.templateConfig ? {
        fieldLayout: options.templateConfig.fieldLayout,
      } : undefined,
    });

    // Add OCR-specific instructions
    prompt += `\n\nADDITIONAL OCR INSTRUCTIONS:
1. Extract ALL visible text from the document, especially:
   - Client/company name
   - Job name/reference
   - Material specifications
   - Board dimensions
2. Identify the document format (tabular, handwritten, mixed, structured)
3. Pay special attention to edge banding notations like X, XX, or checkmarks
4. Lowercase x often indicates groove/back panel cut
5. Include "extractedText" field with raw text content
6. Include "detectedFormat" field`;

    // Add learning context hints
    if (options.learningContext?.clientTemplate) {
      const template = options.learningContext.clientTemplate;
      prompt += `\n\nCLIENT TEMPLATE DETECTED: "${template.clientName}"
Expected column order: ${template.columnOrder.join(", ")}
Edge notation: ${JSON.stringify(template.edgeNotation || {})}
Default material: ${template.defaultMaterialId || "unknown"}`;
    }

    // Add previous page context
    if (options.previousContext) {
      prompt += `\n\nCONTEXT FROM PREVIOUS PAGES:\n${options.previousContext}`;
    }

    return prompt;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private processResults(
    aiParts: AIPartResponse[],
    rawResponse: string,
    startTime: number,
    options: ParseOptions
  ): AIParseResult {
    const parts: ParsedPartResult[] = [];
    const errors: string[] = [];

    for (const aiPart of aiParts) {
      const validationErrors = validateAIPartResponse(aiPart);
      
      if (validationErrors.length > 0 && !aiPart.length && !aiPart.width) {
        errors.push(`Skipped part "${aiPart.label || "unknown"}": ${validationErrors.join(", ")}`);
        continue;
      }

      // Ensure L >= W
      const L = Math.max(aiPart.length || 0, aiPart.width || 0);
      const W = Math.min(aiPart.length || 0, aiPart.width || 0);

      const cutPart: CutPart = {
        part_id: generateId("P"),
        label: aiPart.label || undefined,
        qty: aiPart.quantity || 1,
        size: { L, W },
        thickness_mm: aiPart.thickness || options.defaultThicknessMm || 18,
        material_id: this.mapMaterialToId(aiPart.material) || options.defaultMaterialId || "MAT-WHITE-18",
        grain: aiPart.grain === "along_L" ? "along_L" : "none",
        allow_rotation: aiPart.allowRotation !== false && aiPart.grain !== "along_L",
        notes: aiPart.notes ? { operator: aiPart.notes } : undefined,
        audit: {
          source_method: "api",
          confidence: aiPart.confidence || 0.8,
          human_verified: false,
        },
      };

      // Add edge banding operations if detected
      if (aiPart.edgeBanding?.detected && aiPart.edgeBanding.edges) {
        cutPart.ops = {
          edging: {
            edges: aiPart.edgeBanding.edges.reduce((acc, edge) => {
              if (["L1", "L2", "W1", "W2"].includes(edge)) {
                acc[edge] = { apply: true };
              }
              return acc;
            }, {} as Record<string, { apply: boolean }>),
          },
        };
      }

      parts.push({
        part: cutPart,
        confidence: aiPart.confidence || 0.8,
        extractedMetadata: {
          grooving: aiPart.grooving,
          edgeBanding: aiPart.edgeBanding,
          cncOperations: aiPart.cncOperations,
        },
        warnings: [
          ...validationErrors,
          ...(aiPart.warnings || []),
        ],
        originalText: aiPart.label,
      });
    }

    return {
      success: parts.length > 0,
      parts,
      totalConfidence: calculateOverallConfidence(parts),
      rawResponse,
      errors,
      processingTime: Date.now() - startTime,
    };
  }

  private looksMessy(text: string): boolean {
    // Check for signs of messy/unstructured data
    const lines = text.split("\n").filter(l => l.trim());
    
    // Very short input might be conversational
    if (lines.length < 3 && text.length < 100) return true;
    
    // No clear dimension patterns
    const hasDimensions = /\d+\s*[x×X]\s*\d+/.test(text);
    if (!hasDimensions) return true;
    
    // Contains conversational markers
    if (/\b(please|can you|I need|want|like|same as)\b/i.test(text)) return true;
    
    return false;
  }

  private mapMaterialToId(materialName?: string): string | undefined {
    if (!materialName) return undefined;
    
    const lower = materialName.toLowerCase();
    
    // Common material mappings
    if (lower.includes("white") && (lower.includes("melamine") || lower.includes("mel"))) {
      return "MAT-WHITE-18";
    }
    if (lower.includes("black") && lower.includes("melamine")) {
      return "MAT-BLACK-18";
    }
    if (lower.includes("oak")) {
      return "MAT-OAK-18";
    }
    if (lower.includes("mdf")) {
      return "MAT-MDF-18";
    }
    if (lower.includes("plywood") || lower.includes("ply")) {
      return "MAT-PLY-18";
    }
    
    return undefined;
  }
}

