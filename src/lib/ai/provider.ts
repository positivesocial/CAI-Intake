/**
 * CAI Intake - AI Provider Abstraction Layer
 * 
 * Unified interface for AI-powered cutlist parsing.
 * Supports OpenAI and Anthropic Claude providers.
 */

import type { CutPart } from "@/lib/schema";
import type { LearningContext } from "@/lib/learning";
import type { AIPartResponse } from "@/lib/ai/prompts";

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
  /** Original filename for template detection */
  fileName?: string;
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
    // ResilientAIProvider uses Anthropic as primary and OpenAI as fallback
    const { ResilientAIProvider } = await import("./resilient-provider");
    currentProvider = new ResilientAIProvider();
  } else {
    // Default to resilient
    const { ResilientAIProvider } = await import("./resilient-provider");
    currentProvider = new ResilientAIProvider();
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

// ============================================================
// COMPACT FORMAT EXPANSION
// ============================================================

/**
 * Compact part format from high-density extraction
 * Uses abbreviated field names to reduce token count
 */
interface CompactPart {
  r?: number;      // row
  l: number;       // length
  w: number;       // width
  q?: number;      // quantity
  m?: string;      // material
  e?: string;      // edge banding code ("2L2W", "2L", "1L1W", etc.)
  g?: string;      // groove code ("GL", "GW", "GL+GW", etc.)
  n?: string;      // notes
  t?: number;      // thickness (optional)
}

/**
 * Expand edge banding code to full object
 * "2L2W" → { L1: true, L2: true, W1: true, W2: true, edges: ["L1","L2","W1","W2"] }
 */
function expandEdgeBandingCode(code: string | undefined): {
  detected: boolean;
  L1: boolean;
  L2: boolean;
  W1: boolean;
  W2: boolean;
  edges: string[];
  description: string;
} {
  if (!code || code === "") {
    return { detected: false, L1: false, L2: false, W1: false, W2: false, edges: [], description: "" };
  }
  
  const upperCode = code.toUpperCase();
  const edges: string[] = [];
  let L1 = false, L2 = false, W1 = false, W2 = false;
  
  // Parse edge codes
  if (upperCode.includes("2L2W") || upperCode.includes("4E") || upperCode === "ALL") {
    L1 = L2 = W1 = W2 = true;
    edges.push("L1", "L2", "W1", "W2");
  } else {
    // Check for long edges
    if (upperCode.includes("2L")) {
      L1 = L2 = true;
      edges.push("L1", "L2");
    } else if (upperCode.includes("1L")) {
      L1 = true;
      edges.push("L1");
    }
    
    // Check for short edges
    if (upperCode.includes("2W")) {
      W1 = W2 = true;
      edges.push("W1", "W2");
    } else if (upperCode.includes("1W")) {
      W1 = true;
      edges.push("W1");
    }
  }
  
  const description = edges.length === 0 ? "" : 
    edges.length === 4 ? "all edges" :
    edges.length === 2 && L1 && L2 ? "2 long edges" :
    edges.length === 2 && W1 && W2 ? "2 short edges" :
    `${edges.length} edge${edges.length > 1 ? "s" : ""}`;
  
  return { detected: edges.length > 0, L1, L2, W1, W2, edges, description };
}

/**
 * Expand groove code to full object
 * "GL" → { detected: true, GL: true, GW: false }
 */
function expandGrooveCode(code: string | undefined): {
  detected: boolean;
  GL: boolean;
  GW: boolean;
  description: string;
} {
  if (!code || code === "") {
    return { detected: false, GL: false, GW: false, description: "" };
  }
  
  const upperCode = code.toUpperCase();
  const GL = upperCode.includes("GL") || upperCode.includes("L");
  const GW = upperCode.includes("GW") || upperCode.includes("W");
  
  const description = GL && GW ? "grooves on length and width" :
    GL ? "groove on length" :
    GW ? "groove on width" : "";
  
  return { detected: GL || GW, GL, GW, description };
}

/**
 * Expand material code to full material name hint
 */
function expandMaterialCode(code: string | undefined): string {
  if (!code) return "";
  
  // Return as-is if it's already descriptive
  if (code.length > 3) return code;
  
  // Expand common abbreviations
  const upperCode = code.toUpperCase();
  const expansions: Record<string, string> = {
    "WC": "White Carcase",
    "WD": "White Door",
    "WP": "White Plywood",
    "W": "White",
    "B": "Black",
    "BK": "Black",
    "PLY": "Plywood",
    "P": "Plywood",
    "M": "Melamine",
    "MDF": "MDF",
  };
  
  return expansions[upperCode] || code;
}

/**
 * Check if the response is in compact format
 */
export function isCompactFormat(parts: unknown[]): boolean {
  if (!Array.isArray(parts) || parts.length === 0) return false;
  
  const first = parts[0] as Record<string, unknown>;
  // Compact format uses 'l' and 'w' instead of 'length' and 'width'
  return 'l' in first && 'w' in first && !('length' in first);
}

/**
 * Simple tabular format from SIMPLE_TABULAR_PROMPT
 * Keys: r=row, n=name/label, l=length, w=width, t=thickness, q=quantity, m=material, e=edge code, rot=canRotate
 */
interface SimpleTabularPart {
  r?: number;  // row
  n?: string;  // name/label
  l: number;   // length
  w: number;   // width
  t?: number;  // thickness
  q?: number;  // quantity
  m?: string;  // material
  e?: string;  // edge code (2L2W, 2L, etc.)
  rot?: boolean; // canRotate
}

/**
 * Check if response is in simple tabular format
 */
export function isSimpleTabularFormat(parsed: unknown): parsed is { p: SimpleTabularPart[] } {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    "p" in parsed &&
    Array.isArray((parsed as { p: unknown }).p)
  );
}

/**
 * Expand simple tabular format to AIPartResponse[]
 */
export function expandSimpleTabularParts(parts: SimpleTabularPart[]): AIPartResponse[] {
  return parts.map((sp, index) => {
    const edgeBanding = expandEdgeBandingCode(sp.e);
    
    return {
      row: sp.r || index + 1,
      label: sp.n || `Part ${sp.r || index + 1}`,
      length: sp.l,
      width: sp.w,
      thickness: sp.t || 18,
      quantity: sp.q || 1,
      material: sp.m || "",
      confidence: 0.95, // High confidence for clean tabular data
      allowRotation: sp.rot ?? true,
      
      edgeBanding: edgeBanding.detected ? {
        detected: true,
        L1: edgeBanding.L1,
        L2: edgeBanding.L2,
        W1: edgeBanding.W1,
        W2: edgeBanding.W2,
        edges: edgeBanding.edges,
        description: edgeBanding.description,
      } : undefined,
      
      fieldConfidence: {
        length: 1.0,
        width: 1.0,
        quantity: 1.0,
        material: sp.m ? 0.95 : 0.5,
        edgeBanding: edgeBanding.detected ? 0.95 : 1.0,
        grooving: 1.0,
      },
    } as AIPartResponse;
  });
}

/**
 * Expand compact format parts to AIPartSchema format (with length/width at top level)
 * This format is compatible with the validation schema and Anthropic/OpenAI providers
 */
export function expandCompactParts(compactParts: CompactPart[]): AIPartResponse[] {
  return compactParts
    .filter((cp) => {
      // Filter out parts with invalid dimensions (0, undefined, null, or negative)
      const length = typeof cp.l === "number" ? cp.l : 0;
      const width = typeof cp.w === "number" ? cp.w : 0;
      if (length <= 0 || width <= 0) {
        console.warn(`⚠️ [expandCompactParts] Skipping part with invalid dimensions: L=${cp.l}, W=${cp.w}, row=${cp.r}`);
        return false;
      }
      return true;
    })
    .map((cp, index) => {
    const edgeBanding = expandEdgeBandingCode(cp.e);
    const grooving = expandGrooveCode(cp.g);
    const materialLabel = expandMaterialCode(cp.m);
    
    // Parse notes for CNC/drilling hints
    const notes = cp.n || "";
    const notesLower = notes.toLowerCase();
    const hasCNC = notesLower.includes("cnc") || notesLower.includes("r3") || notesLower.includes("radius");
    const hasDrilling = notesLower.includes("drill") || notesLower.includes("hole") || notesLower.includes("h1") || notesLower.includes("h2");
    
    // Ensure dimensions are valid positive numbers
    const length = Math.max(1, Number(cp.l) || 1);
    const width = Math.max(1, Number(cp.w) || 1);
    
    // Return AIPartResponse format with length/width at top level
    // This is what the validation and AI providers expect
    return {
      row: cp.r || index + 1,
      length,
      width,
      thickness: cp.t || 18,
      quantity: cp.q || 1,
      material: cp.m || "",
      label: materialLabel || `Part ${cp.r || index + 1}`,
      confidence: 0.9,
      allowRotation: false,
      notes: notes || undefined,
      
      // Edge banding in AIPartResponse format
      edgeBanding: edgeBanding.detected ? {
        detected: true,
        L1: edgeBanding.L1,
        L2: edgeBanding.L2,
        W1: edgeBanding.W1,
        W2: edgeBanding.W2,
        edges: edgeBanding.edges,
        description: edgeBanding.description,
      } : undefined,
      
      // Grooving in AIPartResponse format
      grooving: grooving.detected ? {
        detected: true,
        GL: grooving.GL,
        GW: grooving.GW,
        description: grooving.description,
      } : undefined,
      
      // Drilling in AIPartResponse format
      drilling: hasDrilling ? {
        detected: true,
        holes: 1,
        description: notes,
      } : undefined,
      
      // CNC operations in AIPartResponse format
      cncOperations: hasCNC ? {
        detected: true,
        routing: true,
        description: notes,
      } : undefined,
      
      // Field confidence for quality scoring
      fieldConfidence: {
        length: 1.0,
        width: 1.0,
        quantity: 1.0,
        material: cp.m ? 0.95 : 0.5,
        edgeBanding: edgeBanding.detected ? 0.9 : 1.0,
        grooving: grooving.detected ? 0.9 : 1.0,
      },
    } as AIPartResponse;
  });
}

