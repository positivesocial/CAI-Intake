/**
 * CAI Intake - Anthropic Claude Provider Implementation
 * 
 * Uses Claude 3.5 Sonnet for text parsing and image analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";
import {
  type AIProvider,
  type AIParseResult,
  type ParseOptions,
  type ParsedPartResult,
  parseAIResponseJSON,
  calculateOverallConfidence,
} from "./provider";
import {
  ANTHROPIC_SYSTEM_PROMPT,
  buildParsePrompt,
  type AIPartResponse,
  validateAIPartResponse,
} from "./prompts";

// ============================================================
// ANTHROPIC PROVIDER
// ============================================================

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.client || !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");
      }
      this.client = new Anthropic({ apiKey });
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

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n---\n\nINPUT DATA:\n${text}\n\nRespond with JSON only.`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
      const parsed = parseAIResponseJSON<{ parts: AIPartResponse[] } | AIPartResponse[]>(rawResponse);
      const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
      
      if (!parts || !Array.isArray(parts)) {
        return {
          success: false,
          parts: [],
          totalConfidence: 0,
          rawResponse,
          errors: ["Failed to parse AI response as valid parts array"],
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

      // Convert to base64 if needed
      let base64Data: string;
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      
      if (typeof imageData === "string") {
        // Check if it's a data URL
        const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          mediaType = match[1] as typeof mediaType;
          base64Data = match[2];
        } else {
          base64Data = imageData;
        }
      } else {
        base64Data = Buffer.from(imageData).toString("base64");
      }

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: ANTHROPIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `${prompt}\n\nRespond with JSON only.`,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find(c => c.type === "text");
      const rawResponse = textContent?.type === "text" ? textContent.text : "";
      
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

    // Claude supports PDF directly in some contexts
    // For now, require text extraction
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: ["PDF parsing requires text extraction. Please extract text first or use image upload."],
      processingTime: 0,
    };
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
    const lines = text.split("\n").filter(l => l.trim());
    
    if (lines.length < 3 && text.length < 100) return true;
    
    const hasDimensions = /\d+\s*[x×X]\s*\d+/.test(text);
    if (!hasDimensions) return true;
    
    if (/\b(please|can you|I need|want|like|same as)\b/i.test(text)) return true;
    
    return false;
  }

  private mapMaterialToId(materialName?: string): string | undefined {
    if (!materialName) return undefined;
    
    const lower = materialName.toLowerCase();
    
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

