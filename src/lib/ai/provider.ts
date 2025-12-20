/**
 * CAI Intake - AI Provider Abstraction Layer
 * 
 * Unified interface for AI-powered cutlist parsing.
 * Supports OpenAI and Anthropic Claude providers.
 */

import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export type AIProviderType = "openai" | "anthropic";

export interface ParseOptions {
  /** Extract additional metadata (grooving, CNC, edgebanding) */
  extractMetadata: boolean;
  /** Template ID for template-trained parsing */
  templateId?: string;
  /** Template configuration for enhanced accuracy */
  templateConfig?: TemplateOCRConfig;
  /** Confidence threshold */
  confidence: "strict" | "balanced" | "permissive";
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness in mm */
  defaultThicknessMm?: number;
}

export interface TemplateOCRConfig {
  templateId: string;
  version: string;
  fieldLayout: {
    [fieldName: string]: {
      region: { x: number; y: number; width: number; height: number };
      expectedFormat: string;
    };
  };
  trainedPrompt?: string;
}

export interface ParsedPartResult {
  part: CutPart;
  confidence: number;
  extractedMetadata?: {
    grooving?: {
      detected: boolean;
      description?: string;
      profileHint?: string;
    };
    edgeBanding?: {
      detected: boolean;
      edges?: string[];
      description?: string;
    };
    cncOperations?: {
      detected: boolean;
      holes?: number;
      routing?: boolean;
      description?: string;
    };
  };
  warnings: string[];
  originalText?: string;
}

export interface AIParseResult {
  success: boolean;
  parts: ParsedPartResult[];
  totalConfidence: number;
  rawResponse?: string;
  errors: string[];
  processingTime: number;
}

// ============================================================
// PROVIDER INTERFACE
// ============================================================

export interface AIProvider {
  /** Provider name */
  readonly name: AIProviderType;
  
  /** Check if provider is configured */
  isConfigured(): boolean;
  
  /** Parse text input into cutlist parts */
  parseText(text: string, options: ParseOptions): Promise<AIParseResult>;
  
  /** Parse image input using vision capabilities */
  parseImage(imageData: ArrayBuffer | string, options: ParseOptions): Promise<AIParseResult>;
  
  /** Parse PDF document */
  parseDocument(pdfData: ArrayBuffer, extractedText?: string, options?: ParseOptions): Promise<AIParseResult>;
}

// ============================================================
// PROVIDER FACTORY
// ============================================================

let currentProvider: AIProvider | null = null;
let providerType: AIProviderType = "openai";

/**
 * Get the current AI provider instance
 */
export function getAIProvider(): AIProvider | null {
  return currentProvider;
}

/**
 * Set the AI provider type and create instance
 */
export async function setAIProvider(type: AIProviderType): Promise<AIProvider> {
  providerType = type;
  
  if (type === "openai") {
    const { OpenAIProvider } = await import("./openai");
    currentProvider = new OpenAIProvider();
  } else {
    const { AnthropicProvider } = await import("./anthropic");
    currentProvider = new AnthropicProvider();
  }
  
  return currentProvider;
}

/**
 * Get or create the AI provider
 */
export async function getOrCreateProvider(): Promise<AIProvider> {
  if (!currentProvider) {
    return setAIProvider(providerType);
  }
  return currentProvider;
}

/**
 * Get the current provider type
 */
export function getCurrentProviderType(): AIProviderType {
  return providerType;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse AI response JSON safely
 */
export function parseAIResponseJSON<T>(response: string): T | null {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Try direct JSON parse
    return JSON.parse(response);
  } catch {
    // Try to find JSON array or object
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return null;
      }
    }
    
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    
    return null;
  }
}

/**
 * Calculate overall confidence from parts
 */
export function calculateOverallConfidence(parts: ParsedPartResult[]): number {
  if (parts.length === 0) return 0;
  return parts.reduce((sum, p) => sum + p.confidence, 0) / parts.length;
}

/**
 * Map confidence level to threshold
 */
export function getConfidenceThreshold(level: ParseOptions["confidence"]): number {
  switch (level) {
    case "strict": return 0.9;
    case "balanced": return 0.75;
    case "permissive": return 0.5;
    default: return 0.75;
  }
}

