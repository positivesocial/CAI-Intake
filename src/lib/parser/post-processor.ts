/**
 * CAI Intake - Post-Processing Validation
 * 
 * Validates and normalizes parsed parts after AI/text parsing.
 * Applies consistent rules and calculates field-level confidence.
 * 
 * This layer catches errors that the AI might miss and ensures
 * data consistency across all input methods.
 */

import type { CutPart } from "@/lib/schema";
import { CONFIDENCE_THRESHOLDS } from "@/lib/ai/prompts";

// ============================================================
// TYPES
// ============================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /** Field-level confidence scores */
  fieldConfidence: {
    length: number;
    width: number;
    quantity: number;
    material: number;
    edgeBanding: number;
    grooving: number;
    overall: number;
  };
  /** Normalized/fixed part (if fixable) */
  normalizedPart: CutPart;
}

export interface PostProcessorOptions {
  /** Maximum allowed dimension in mm (default: 3000) */
  maxDimension?: number;
  /** Minimum allowed dimension in mm (default: 10) */
  minDimension?: number;
  /** Maximum allowed quantity (default: 500) */
  maxQuantity?: number;
  /** Auto-swap length/width if L < W */
  autoSwapDimensions?: boolean;
  /** Known valid material codes */
  validMaterialCodes?: string[];
  /** Default material if none specified */
  defaultMaterialId?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_OPTIONS: Required<PostProcessorOptions> = {
  maxDimension: 3000,
  minDimension: 10,
  maxQuantity: 500,
  autoSwapDimensions: false, // Don't auto-swap: in cabinet making, "Length" is grain direction, not necessarily longer
  validMaterialCodes: ["W", "Ply", "B", "M", "MDF", "OAK", "BK", "WH", "NAT"],
  defaultMaterialId: "",
};

// Common sheet sizes for validation hints
const COMMON_SHEET_SIZES = [
  { L: 2440, W: 1220, name: "Standard 8x4" },
  { L: 2800, W: 2070, name: "Large panel" },
  { L: 2500, W: 1250, name: "Metric 8x4" },
  { L: 3050, W: 1525, name: "10x5" },
];

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate and post-process a parsed part
 */
export function validatePart(
  part: CutPart,
  options: PostProcessorOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Create a mutable copy for normalization
  const normalized: CutPart = JSON.parse(JSON.stringify(part));
  
  // Field confidence scores (start at 1.0, reduce for issues)
  const fieldConfidence = {
    length: 1.0,
    width: 1.0,
    quantity: 1.0,
    material: 1.0,
    edgeBanding: 1.0,
    grooving: 1.0,
    overall: 1.0,
  };
  
  // === DIMENSION VALIDATION ===
  
  // Check if dimensions exist and are positive
  if (!normalized.size || normalized.size.L <= 0 || normalized.size.W <= 0) {
    errors.push("Missing or invalid dimensions");
    fieldConfidence.length = 0;
    fieldConfidence.width = 0;
  } else {
    // Auto-swap if L < W
    if (opts.autoSwapDimensions && normalized.size.L < normalized.size.W) {
      const temp = normalized.size.L;
      normalized.size.L = normalized.size.W;
      normalized.size.W = temp;
      warnings.push("Swapped L/W (length must be >= width)");
      fieldConfidence.length *= 0.95;
      fieldConfidence.width *= 0.95;
    }
    
    // Check dimension ranges
    if (normalized.size.L > opts.maxDimension) {
      warnings.push(`Length ${normalized.size.L}mm exceeds typical max ${opts.maxDimension}mm`);
      fieldConfidence.length *= 0.7;
    }
    if (normalized.size.W > opts.maxDimension) {
      warnings.push(`Width ${normalized.size.W}mm exceeds typical max ${opts.maxDimension}mm`);
      fieldConfidence.width *= 0.7;
    }
    if (normalized.size.L < opts.minDimension) {
      warnings.push(`Length ${normalized.size.L}mm is very small`);
      fieldConfidence.length *= 0.8;
    }
    if (normalized.size.W < opts.minDimension) {
      warnings.push(`Width ${normalized.size.W}mm is very small`);
      fieldConfidence.width *= 0.8;
    }
    
    // Check if dimensions exceed any standard sheet
    const exceedsAllSheets = COMMON_SHEET_SIZES.every(
      sheet => normalized.size.L > sheet.L || normalized.size.W > sheet.W
    );
    if (exceedsAllSheets && normalized.size.L > 2500) {
      warnings.push("Dimensions may exceed standard sheet sizes");
      fieldConfidence.length *= 0.85;
      fieldConfidence.width *= 0.85;
    }
    
    // Check for suspiciously round numbers that might be typos
    if (normalized.size.L % 1000 === 0 && normalized.size.L >= 1000) {
      warnings.push(`Length ${normalized.size.L}mm is a round number - verify`);
      fieldConfidence.length *= 0.9;
    }
  }
  
  // === QUANTITY VALIDATION ===
  
  if (!normalized.qty || normalized.qty < 1) {
    normalized.qty = 1;
    warnings.push("Quantity defaulted to 1");
    fieldConfidence.quantity *= 0.7;
  } else if (normalized.qty > opts.maxQuantity) {
    warnings.push(`Quantity ${normalized.qty} is unusually high`);
    fieldConfidence.quantity *= 0.6;
  } else if (normalized.qty > 50) {
    warnings.push(`High quantity (${normalized.qty}) - verify`);
    fieldConfidence.quantity *= 0.85;
  }
  
  // === MATERIAL VALIDATION ===
  
  if (!normalized.material_id) {
    if (opts.defaultMaterialId) {
      normalized.material_id = opts.defaultMaterialId;
      warnings.push("Material defaulted");
    }
    fieldConfidence.material = 0.5;
  } else if (opts.validMaterialCodes.length > 0) {
    // Check if material code is recognized
    const upperMaterial = normalized.material_id.toUpperCase();
    const isKnown = opts.validMaterialCodes.some(
      code => code.toUpperCase() === upperMaterial
    );
    if (!isKnown) {
      warnings.push(`Material code "${normalized.material_id}" not in standard list`);
      fieldConfidence.material *= 0.75;
    }
  }
  
  // === THICKNESS VALIDATION ===
  
  if (!normalized.thickness_mm || normalized.thickness_mm < 1 || normalized.thickness_mm > 100) {
    normalized.thickness_mm = 18; // Standard default
    if (normalized.thickness_mm !== 18) {
      warnings.push("Thickness defaulted to 18mm");
    }
  }
  
  // === EDGE BANDING VALIDATION ===
  
  if (normalized.ops?.edging?.edges) {
    const validEdges = ["L1", "L2", "W1", "W2"];
    const edges = Object.keys(normalized.ops.edging.edges);
    const invalidEdges = edges.filter(e => !validEdges.includes(e));
    if (invalidEdges.length > 0) {
      warnings.push(`Invalid edge codes: ${invalidEdges.join(", ")}`);
      fieldConfidence.edgeBanding *= 0.7;
    }
  }
  
  // === GROOVING VALIDATION ===
  
  if (normalized.ops?.grooves && Array.isArray(normalized.ops.grooves)) {
    for (const groove of normalized.ops.grooves) {
      if (groove.width_mm && (groove.width_mm < 1 || groove.width_mm > 20)) {
        warnings.push(`Groove width ${groove.width_mm}mm is unusual`);
        fieldConfidence.grooving *= 0.8;
      }
      if (groove.depth_mm && (groove.depth_mm < 1 || groove.depth_mm > normalized.thickness_mm)) {
        warnings.push(`Groove depth ${groove.depth_mm}mm may be invalid`);
        fieldConfidence.grooving *= 0.8;
      }
    }
  }
  
  // === CALCULATE OVERALL CONFIDENCE ===
  
  fieldConfidence.overall = Math.min(
    fieldConfidence.length,
    fieldConfidence.width,
    fieldConfidence.quantity,
    fieldConfidence.material,
    fieldConfidence.edgeBanding,
    fieldConfidence.grooving
  );
  
  // Update part audit with field confidence
  if (normalized.audit) {
    normalized.audit.confidence = fieldConfidence.overall;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fieldConfidence,
    normalizedPart: normalized,
  };
}

/**
 * Validate a batch of parts
 */
export function validateParts(
  parts: CutPart[],
  options: PostProcessorOptions = {}
): {
  validParts: CutPart[];
  results: ValidationResult[];
  summary: {
    total: number;
    valid: number;
    withWarnings: number;
    needsReview: number;
    averageConfidence: number;
  };
} {
  const results = parts.map(part => validatePart(part, options));
  const validParts = results
    .filter(r => r.isValid)
    .map(r => r.normalizedPart);
  
  const withWarnings = results.filter(r => r.warnings.length > 0).length;
  const needsReview = results.filter(
    r => r.fieldConfidence.overall < CONFIDENCE_THRESHOLDS.MEDIUM
  ).length;
  
  const totalConfidence = results.reduce(
    (sum, r) => sum + r.fieldConfidence.overall,
    0
  );
  
  return {
    validParts,
    results,
    summary: {
      total: parts.length,
      valid: validParts.length,
      withWarnings,
      needsReview,
      averageConfidence: parts.length > 0 ? totalConfidence / parts.length : 0,
    },
  };
}

/**
 * Calculate accuracy score for a parsing result
 * Returns a percentage (0-100) indicating how confident we are
 */
export function calculateAccuracyScore(results: ValidationResult[]): number {
  if (results.length === 0) return 0;
  
  let score = 0;
  
  for (const result of results) {
    // Base score from field confidence
    let partScore = result.fieldConfidence.overall * 100;
    
    // Penalty for errors (major issues)
    partScore -= result.errors.length * 25;
    
    // Penalty for warnings (minor issues)
    partScore -= result.warnings.length * 5;
    
    // Ensure score is within bounds
    partScore = Math.max(0, Math.min(100, partScore));
    
    score += partScore;
  }
  
  return Math.round(score / results.length);
}

/**
 * Get parts that need human review
 */
export function getPartsNeedingReview(results: ValidationResult[]): {
  index: number;
  part: CutPart;
  issues: string[];
  confidence: number;
}[] {
  return results
    .map((r, index) => ({
      index,
      part: r.normalizedPart,
      issues: [...r.errors, ...r.warnings],
      confidence: r.fieldConfidence.overall,
    }))
    .filter(item => 
      item.confidence < CONFIDENCE_THRESHOLDS.MEDIUM || 
      item.issues.length > 0
    )
    .sort((a, b) => a.confidence - b.confidence); // Lowest confidence first
}


