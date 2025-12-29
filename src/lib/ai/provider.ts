/**
 * CAI Intake - AI Provider Abstraction Layer
 * 
 * Unified interface for AI-powered cutlist parsing.
 * Supports OpenAI and Anthropic Claude providers.
 */

import type { CutPart } from "@/lib/schema";
import type { LearningContext } from "@/lib/learning";

// ============================================================
// TYPES
// ============================================================

export type AIProviderType = "openai" | "anthropic" | "resilient";

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
  /** Learning context for adaptive parsing */
  learningContext?: LearningContext;
  /** Text is pasted from clipboard/spreadsheet (may have header row) */
  isPastedText?: boolean;
  /** Text is messy/unstructured */
  isMessyData?: boolean;
  /** Organization ID for context-specific learning */
  organizationId?: string;
  /** Pre-built deterministic prompt for CAI template parsing (bypasses prompt builder) */
  deterministicPrompt?: string;
}

// ============================================================
// OCR-SPECIFIC TYPES
// ============================================================

export interface OCROptions extends ParseOptions {
  /** Current page number (for multi-page documents) */
  pageNumber?: number;
  /** Total number of pages */
  totalPages?: number;
  /** Context from previous pages */
  previousContext?: string;
  /** Progress callback */
  onProgress?: (progress: OCRProgress) => void;
}

export interface OCRProgress {
  stage: "uploading" | "processing" | "extracting" | "parsing" | "complete";
  percent: number;
  currentPage?: number;
  totalPages?: number;
  message?: string;
}

export interface OCRResult extends AIParseResult {
  /** Raw extracted text from OCR */
  extractedText?: string;
  /** Per-page confidence score */
  pageConfidence?: number;
  /** Detected document format */
  detectedFormat?: "tabular" | "handwritten" | "mixed" | "structured";
  /** Page-specific results for multi-page documents */
  pageResults?: OCRPageResult[];
  /** Whether learning context was applied */
  learningApplied?: boolean;
  /** Detected client template name */
  detectedClient?: string;
}

export interface OCRPageResult {
  pageNumber: number;
  extractedText: string;
  confidence: number;
  partsCount: number;
  parts: ParsedPartResult[];
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
  
  /** OCR-optimized image parsing with progress tracking */
  parseImageForOCR?(imageData: ArrayBuffer | string, options: OCROptions): Promise<OCRResult>;
  
  /** OCR-optimized multi-page document parsing */
  parseDocumentForOCR?(pages: Array<ArrayBuffer | string>, options: OCROptions): Promise<OCRResult>;
}

// ============================================================
// PROVIDER FACTORY
// ============================================================

let currentProvider: AIProvider | null = null;
let providerType: AIProviderType = "resilient"; // Default to resilient for automatic fallback

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
  } else if (type === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic");
    currentProvider = new AnthropicProvider();
  } else if (type === "resilient") {
    // ResilientProvider uses Anthropic as primary and OpenAI as fallback
    const { ResilientProvider } = await import("./resilient-provider");
    currentProvider = new ResilientProvider();
  } else {
    // Default to resilient
    const { ResilientProvider } = await import("./resilient-provider");
    currentProvider = new ResilientProvider();
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
 * Handles markdown code blocks, truncated responses, and partial JSON
 */
export function parseAIResponseJSON<T>(response: string): T | null {
  let cleanResponse = response.trim();
  
  // Step 1: Strip markdown code fences (complete or truncated)
  // Handle: ```json ... ``` (complete)
  const completeMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (completeMatch) {
    cleanResponse = completeMatch[1].trim();
  } else {
    // Handle truncated: ```json ... (no closing ```)
    const openingFenceMatch = cleanResponse.match(/^```(?:json)?\s*([\s\S]*)/);
    if (openingFenceMatch) {
      cleanResponse = openingFenceMatch[1].trim();
    }
  }
  
  // Step 2: Try direct JSON parse
  try {
    return JSON.parse(cleanResponse);
  } catch {
    // Continue to fallback strategies
  }
  
  // Step 3: Try to find and parse JSON array
  const arrayMatch = cleanResponse.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Try to repair truncated array
      const repaired = repairTruncatedJSON(arrayMatch[0]);
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
          // Continue
        }
      }
    }
  }
  
  // Step 4: Try to find and parse JSON object
  const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // Try to repair truncated object
      const repaired = repairTruncatedJSON(objectMatch[0]);
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
          // Continue
        }
      }
    }
  }
  
  // Step 5: Extract individual complete objects from truncated array
  const parts = extractCompleteObjects(cleanResponse);
  if (parts.length > 0) {
    return parts as T;
  }
  
  return null;
}

/**
 * Attempt to repair truncated JSON by closing open brackets
 */
function repairTruncatedJSON(json: string): string | null {
  let repaired = json.trim();
  
  // Count open brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;
  
  for (const char of repaired) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }
  
  // If we're in a string, close it
  if (inString) {
    repaired += '"';
  }
  
  // Close any incomplete key-value pair
  // Check if we end with a colon or comma
  const lastColon = repaired.lastIndexOf(':');
  const lastComma = repaired.lastIndexOf(',');
  const lastClose = Math.max(repaired.lastIndexOf('}'), repaired.lastIndexOf(']'));
  
  if (lastColon > lastClose && lastColon > lastComma) {
    // Ended mid-value, add null and close
    repaired += 'null';
  }
  
  // Close open braces and brackets
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  
  return repaired;
}

/**
 * Extract complete JSON objects from a potentially truncated array
 */
function extractCompleteObjects(text: string): unknown[] {
  const objects: unknown[] = [];
  
  // Find all complete objects
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      // Validate it looks like a part (has length and width)
      if (obj && typeof obj === 'object' && 
          (('length' in obj && 'width' in obj) || ('row' in obj))) {
        objects.push(obj);
      }
    } catch {
      // Skip invalid objects
    }
  }
  
  return objects;
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

