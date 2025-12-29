/**
 * CAI Intake - OCR Response Validation
 * 
 * Strict schema validation for AI responses using Zod.
 * Ensures data integrity and catches malformed responses.
 */

import { z } from "zod";
import { logger } from "@/lib/logger";
import { parseAIResponseJSON } from "./provider";

// ============================================================
// ZOD SCHEMAS
// ============================================================

/**
 * Edge banding schema
 */
export const EdgeBandingSchema = z.object({
  detected: z.boolean(),
  L1: z.boolean().optional().default(false),
  L2: z.boolean().optional().default(false),
  W1: z.boolean().optional().default(false),
  W2: z.boolean().optional().default(false),
  edges: z.array(z.string()).optional().default([]),
  edgebandMaterial: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

/**
 * Grooving schema
 */
export const GroovingSchema = z.object({
  detected: z.boolean(),
  GL: z.boolean().optional().default(false),
  GW: z.boolean().optional().default(false),
  description: z.string().optional(),
  profileHint: z.string().optional(),
}).passthrough();

/**
 * CNC operations schema
 */
export const CNCOperationsSchema = z.object({
  detected: z.boolean(),
  holes: z.number().int().min(0).optional().default(0),
  routing: z.boolean().optional().default(false),
  description: z.string().optional(),
}).passthrough();

/**
 * Field confidence schema
 */
export const FieldConfidenceSchema = z.object({
  length: z.number().min(0).max(1).optional(),
  width: z.number().min(0).max(1).optional(),
  quantity: z.number().min(0).max(1).optional(),
  material: z.number().min(0).max(1).optional(),
  edgeBanding: z.number().min(0).max(1).optional(),
  grooving: z.number().min(0).max(1).optional(),
  overall: z.number().min(0).max(1).optional(),
}).passthrough();

/**
 * Single part schema - lenient but validates critical fields
 */
export const AIPartSchema = z.object({
  // Required fields
  length: z.number().positive("Length must be positive"),
  width: z.number().positive("Width must be positive"),
  
  // Optional but common fields
  row: z.number().int().optional(),
  label: z.string().optional(),
  thickness: z.number().positive().optional().default(18),
  quantity: z.number().int().positive().optional().default(1),
  material: z.string().optional(),
  grain: z.string().optional(),
  allowRotation: z.boolean().optional(),
  
  // Nested objects
  edgeBanding: EdgeBandingSchema.optional(),
  grooving: GroovingSchema.optional(),
  cncOperations: CNCOperationsSchema.optional(),
  
  // Metadata
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  fieldConfidence: FieldConfidenceSchema.optional(),
  warnings: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields

/**
 * Full response schema - array of parts
 */
export const AIResponseSchema = z.union([
  // Direct array of parts
  z.array(AIPartSchema),
  // Object with parts property
  z.object({
    parts: z.array(AIPartSchema),
    metadata: z.object({
      client: z.string().optional(),
      jobName: z.string().optional(),
      material: z.string().optional(),
    }).optional(),
    extractedText: z.string().optional(),
    detectedFormat: z.string().optional(),
  }).passthrough(),
]);

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

export interface ValidationResult {
  success: boolean;
  parts: z.infer<typeof AIPartSchema>[];
  errors: string[];
  warnings: string[];
  partialData?: unknown[];
}

/**
 * Validate and normalize an AI response.
 * 
 * @param rawResponse - The raw JSON string from the AI
 * @returns Validated parts or error information
 */
export function validateAIResponse(rawResponse: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Step 1: Parse JSON using the robust parser that handles markdown fences
  const parsed = parseAIResponseJSON<unknown>(rawResponse);
  
  if (parsed === null) {
    errors.push("Failed to parse AI response as JSON");
    
    // Try to recover partial data
    const partialData = tryRecoverPartialJSON(rawResponse);
    if (partialData.length > 0) {
      warnings.push(`Recovered ${partialData.length} parts from malformed JSON`);
      
      // If we recovered parts, return them as a partial success
      return {
        success: true,
        parts: partialData as z.infer<typeof AIPartSchema>[],
        errors: [],
        warnings,
      };
    }
    
    return {
      success: false,
      parts: [],
      errors,
      warnings,
      partialData,
    };
  }
  
  // Step 2: Validate against schema
  const result = AIResponseSchema.safeParse(parsed);
  
  if (!result.success) {
    // Try to extract parts even with validation errors
    const parts = extractPartsLeniently(parsed);
    
    if (parts.length > 0) {
      warnings.push(`Schema validation had issues but extracted ${parts.length} parts`);
      
      // Log specific validation errors for debugging
      for (const issue of result.error.issues.slice(0, 5)) {
        warnings.push(`Field ${issue.path.join(".")}: ${issue.message}`);
      }
      
      return {
        success: true, // Partial success
        parts,
        errors: [],
        warnings,
      };
    }
    
    errors.push("Response doesn't match expected schema");
    for (const issue of result.error.issues.slice(0, 5)) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    
    return {
      success: false,
      parts: [],
      errors,
      warnings,
    };
  }
  
  // Step 3: Extract parts from validated response
  const validatedData = result.data;
  const parts = Array.isArray(validatedData) 
    ? validatedData 
    : validatedData.parts;
  
  // Step 4: Post-validation checks
  for (const [i, part] of parts.entries()) {
    // Warn about suspicious dimensions
    if (part.length > 3500) {
      warnings.push(`Part ${i + 1}: Length ${part.length}mm is unusually large`);
    }
    if (part.width > 1800) {
      warnings.push(`Part ${i + 1}: Width ${part.width}mm is unusually large`);
    }
    if (part.quantity && part.quantity > 100) {
      warnings.push(`Part ${i + 1}: Quantity ${part.quantity} is unusually high`);
    }
    
    // Auto-fix: swap length/width if length < width
    if (part.length < part.width) {
      const temp = part.length;
      part.length = part.width;
      part.width = temp;
      warnings.push(`Part ${i + 1}: Swapped length and width (length should be >= width)`);
    }
  }
  
  logger.debug("✅ [Validation] AI response validated", {
    partsCount: parts.length,
    warnings: warnings.length,
  });
  
  return {
    success: true,
    parts,
    errors: [],
    warnings,
  };
}

/**
 * Try to recover parts from malformed JSON.
 */
function tryRecoverPartialJSON(raw: string): unknown[] {
  const parts: unknown[] = [];
  
  // First, strip markdown fences if present
  let cleanedRaw = raw.trim();
  const openingFenceMatch = cleanedRaw.match(/^```(?:json)?\s*([\s\S]*)/);
  if (openingFenceMatch) {
    cleanedRaw = openingFenceMatch[1].trim();
  }
  // Also remove closing fence if present
  cleanedRaw = cleanedRaw.replace(/```\s*$/, "").trim();
  
  // Strategy 1: Find complete part objects with nested structures
  // This regex finds objects that contain length and width, allowing for nested braces
  const complexPartPattern = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*"(?:length|row)"\s*:\s*\d+(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
  const matches = cleanedRaw.match(complexPartPattern);
  
  if (matches) {
    for (const match of matches) {
      try {
        const part = JSON.parse(match);
        if ((typeof part.length === "number" && typeof part.width === "number") || part.row !== undefined) {
          parts.push(part);
        }
      } catch {
        // Skip malformed objects
      }
    }
  }
  
  // Strategy 2: If no matches, try simpler pattern for flat objects
  if (parts.length === 0) {
    const simplePartPattern = /\{[^{}]*"length"\s*:\s*\d+\.?\d*[^{}]*"width"\s*:\s*\d+\.?\d*[^{}]*\}/g;
    const simpleMatches = cleanedRaw.match(simplePartPattern);
    
    if (simpleMatches) {
      for (const match of simpleMatches) {
        try {
          const part = JSON.parse(match);
          if (typeof part.length === "number" && typeof part.width === "number") {
            parts.push(part);
          }
        } catch {
          // Skip malformed objects
        }
      }
    }
  }
  
  // Strategy 3: Try to extract by finding balanced braces for each object
  if (parts.length === 0) {
    const extractedObjects = extractBalancedObjects(cleanedRaw);
    for (const obj of extractedObjects) {
      if ((typeof obj.length === "number" && typeof obj.width === "number") || obj.row !== undefined) {
        parts.push(obj);
      }
    }
  }
  
  logger.debug("🔧 [OCR Validation] Recovered partial JSON", {
    rawLength: raw.length,
    partsRecovered: parts.length,
  });
  
  return parts;
}

/**
 * Extract balanced JSON objects from a potentially truncated string
 */
function extractBalancedObjects(text: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === "\\") {
      escape = true;
      continue;
    }
    
    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === "{") {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          const objectStr = text.slice(start, i + 1);
          try {
            const obj = JSON.parse(objectStr);
            if (typeof obj === "object" && obj !== null) {
              objects.push(obj);
            }
          } catch {
            // Skip invalid objects
          }
          start = -1;
        }
      }
    }
  }
  
  return objects;
}

/**
 * Leniently extract parts from any response structure.
 */
function extractPartsLeniently(data: unknown): z.infer<typeof AIPartSchema>[] {
  const parts: z.infer<typeof AIPartSchema>[] = [];
  
  // Get array of potential parts
  let candidates: unknown[] = [];
  
  if (Array.isArray(data)) {
    candidates = data;
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.parts)) {
      candidates = obj.parts;
    }
  }
  
  // Try to validate each part individually
  for (const candidate of candidates) {
    const result = AIPartSchema.safeParse(candidate);
    if (result.success) {
      parts.push(result.data);
    } else {
      // Try minimal validation (just length/width)
      if (typeof candidate === "object" && candidate !== null) {
        const obj = candidate as Record<string, unknown>;
        if (typeof obj.length === "number" && typeof obj.width === "number") {
          // Create a minimal valid part
          parts.push({
            length: obj.length as number,
            width: obj.width as number,
            quantity: (typeof obj.quantity === "number" ? obj.quantity : 1) as number,
            thickness: (typeof obj.thickness === "number" ? obj.thickness : 18) as number,
            material: typeof obj.material === "string" ? obj.material : undefined,
            label: typeof obj.label === "string" ? obj.label : undefined,
            row: typeof obj.row === "number" ? obj.row : undefined,
            confidence: typeof obj.confidence === "number" ? obj.confidence : 0.6,
          });
        }
      }
    }
  }
  
  return parts;
}

// ============================================================
// REVIEW FLAGS
// ============================================================

export type ReviewSeverity = "low" | "medium" | "high";

export interface ReviewFlag {
  partIndex: number;
  field?: string;
  reason: string;
  severity: ReviewSeverity;
  suggestedAction: string;
  currentValue?: unknown;
}

/**
 * Generate review flags for parts that need human attention.
 */
export function generateReviewFlags(
  parts: z.infer<typeof AIPartSchema>[]
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  
  for (const [i, part] of parts.entries()) {
    // Low confidence
    if (part.confidence !== undefined && part.confidence < 0.7) {
      flags.push({
        partIndex: i,
        reason: `Low confidence (${Math.round(part.confidence * 100)}%)`,
        severity: part.confidence < 0.5 ? "high" : "medium",
        suggestedAction: "Verify all dimensions and quantities",
        currentValue: part.confidence,
      });
    }
    
    // Very large dimensions
    if (part.length > 3000) {
      flags.push({
        partIndex: i,
        field: "length",
        reason: `Unusually large length: ${part.length}mm`,
        severity: part.length > 4000 ? "high" : "low",
        suggestedAction: "Verify this is correct (typical max is 2800mm)",
        currentValue: part.length,
      });
    }
    
    if (part.width > 1500) {
      flags.push({
        partIndex: i,
        field: "width",
        reason: `Unusually large width: ${part.width}mm`,
        severity: part.width > 2000 ? "high" : "low",
        suggestedAction: "Verify this is correct (typical max is 1220mm)",
        currentValue: part.width,
      });
    }
    
    // Very small dimensions
    if (part.length < 50 || part.width < 50) {
      flags.push({
        partIndex: i,
        field: part.length < 50 ? "length" : "width",
        reason: `Very small dimension: ${Math.min(part.length, part.width)}mm`,
        severity: "medium",
        suggestedAction: "Verify this isn't a typo (might be missing a digit)",
        currentValue: Math.min(part.length, part.width),
      });
    }
    
    // High quantity
    if (part.quantity && part.quantity > 50) {
      flags.push({
        partIndex: i,
        field: "quantity",
        reason: `High quantity: ${part.quantity}`,
        severity: part.quantity > 200 ? "high" : "low",
        suggestedAction: "Verify quantity is correct",
        currentValue: part.quantity,
      });
    }
    
    // Check for dimension mismatch (length should be >= width)
    // Already auto-fixed, but flag if original was wrong
    
    // Check field confidence if available
    if (part.fieldConfidence) {
      const entries = Object.entries(part.fieldConfidence) as [string, number | undefined][];
      const lowConfidenceFields = entries
        .filter((entry): entry is [string, number] => 
          entry[1] !== undefined && entry[1] !== null && entry[1] < 0.6
        )
        .map(([field, conf]) => ({ field, conf }));
      
      for (const { field, conf } of lowConfidenceFields) {
        flags.push({
          partIndex: i,
          field,
          reason: `Low field confidence for ${field}: ${Math.round(conf * 100)}%`,
          severity: "medium",
          suggestedAction: `Verify ${field} value`,
          currentValue: conf,
        });
      }
    }
  }
  
  // Sort by severity (high first)
  const severityOrder: Record<ReviewSeverity, number> = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return flags;
}

/**
 * Determine if extraction needs human review.
 */
export function needsReview(
  parts: z.infer<typeof AIPartSchema>[],
  flags: ReviewFlag[]
): { needsReview: boolean; reason?: string } {
  // No parts = definitely needs review
  if (parts.length === 0) {
    return { needsReview: true, reason: "No parts extracted" };
  }
  
  // High severity flags
  const highSeverityCount = flags.filter(f => f.severity === "high").length;
  if (highSeverityCount > 0) {
    return { 
      needsReview: true, 
      reason: `${highSeverityCount} high-severity issue${highSeverityCount > 1 ? "s" : ""} detected` 
    };
  }
  
  // Too many medium severity flags
  const mediumSeverityCount = flags.filter(f => f.severity === "medium").length;
  if (mediumSeverityCount > parts.length * 0.3) { // More than 30% of parts flagged
    return { 
      needsReview: true, 
      reason: `${mediumSeverityCount} parts flagged for review (>${Math.round(parts.length * 0.3)} threshold)` 
    };
  }
  
  // Average confidence too low
  const avgConfidence = parts.reduce((sum, p) => sum + (p.confidence ?? 0.8), 0) / parts.length;
  if (avgConfidence < 0.7) {
    return { 
      needsReview: true, 
      reason: `Low average confidence: ${Math.round(avgConfidence * 100)}%` 
    };
  }
  
  return { needsReview: false };
}

