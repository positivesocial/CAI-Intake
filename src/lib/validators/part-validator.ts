/**
 * CAI Intake - Part Validator
 * 
 * Validates individual parts for correctness and business rules.
 */

import type { CutPart } from "@/lib/schema";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationOptions {
  /** Minimum part dimension in mm */
  minDimension?: number;
  /** Maximum part dimension in mm */
  maxDimension?: number;
  /** Minimum part area in mm² */
  minArea?: number;
  /** Maximum part area in mm² */
  maxArea?: number;
  /** Standard thicknesses allowed */
  allowedThicknesses?: number[];
  /** Require grain for certain materials */
  grainedMaterials?: string[];
  /** Max quantity per part */
  maxQuantity?: number;
  /** Allow parts larger than standard sheet sizes */
  allowOversized?: boolean;
  /** Standard sheet dimensions for oversize check */
  standardSheetSize?: { L: number; W: number };
}

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  minDimension: 10,
  maxDimension: 3000,
  minArea: 100,
  maxArea: 10_000_000, // 10m²
  allowedThicknesses: [3, 6, 9, 12, 15, 16, 18, 19, 22, 25, 30, 35, 40],
  grainedMaterials: ["MAT-OAK-18", "MAT-WALNUT-18", "MAT-PLY-18"],
  maxQuantity: 1000,
  allowOversized: false,
  standardSheetSize: { L: 2800, W: 2070 },
};

// =============================================================================
// VALIDATORS
// =============================================================================

/**
 * Validate a single part
 */
export function validatePart(
  part: CutPart,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Required fields
  if (!part.part_id || part.part_id.trim() === "") {
    errors.push({
      field: "part_id",
      message: "Part ID is required",
      code: "REQUIRED_FIELD",
      severity: "error",
    });
  }

  // Dimensions
  if (!part.size || typeof part.size.L !== "number" || typeof part.size.W !== "number") {
    errors.push({
      field: "size",
      message: "Part dimensions (L and W) are required",
      code: "REQUIRED_FIELD",
      severity: "error",
    });
  } else {
    const { L, W } = part.size;

    // Check minimum dimensions
    if (L < opts.minDimension) {
      errors.push({
        field: "size.L",
        message: `Length ${L}mm is below minimum ${opts.minDimension}mm`,
        code: "DIMENSION_TOO_SMALL",
        severity: "error",
      });
    }
    if (W < opts.minDimension) {
      errors.push({
        field: "size.W",
        message: `Width ${W}mm is below minimum ${opts.minDimension}mm`,
        code: "DIMENSION_TOO_SMALL",
        severity: "error",
      });
    }

    // Check maximum dimensions
    if (L > opts.maxDimension) {
      errors.push({
        field: "size.L",
        message: `Length ${L}mm exceeds maximum ${opts.maxDimension}mm`,
        code: "DIMENSION_TOO_LARGE",
        severity: "error",
      });
    }
    if (W > opts.maxDimension) {
      errors.push({
        field: "size.W",
        message: `Width ${W}mm exceeds maximum ${opts.maxDimension}mm`,
        code: "DIMENSION_TOO_LARGE",
        severity: "error",
      });
    }

    // Check area
    const area = L * W;
    if (area < opts.minArea) {
      warnings.push({
        field: "size",
        message: `Part area ${area}mm² is very small (min: ${opts.minArea}mm²)`,
        code: "AREA_TOO_SMALL",
        severity: "warning",
      });
    }
    if (area > opts.maxArea) {
      errors.push({
        field: "size",
        message: `Part area exceeds maximum ${opts.maxArea / 1_000_000}m²`,
        code: "AREA_TOO_LARGE",
        severity: "error",
      });
    }

    // Check L >= W convention
    if (L < W) {
      warnings.push({
        field: "size",
        message: "By convention, L should be >= W. Consider swapping.",
        code: "DIMENSION_ORDER",
        severity: "warning",
      });
    }

    // Check oversize
    if (!opts.allowOversized) {
      const { L: sheetL, W: sheetW } = opts.standardSheetSize;
      if (L > sheetL || W > sheetW) {
        // Check if it fits when rotated
        if (L > sheetW || W > sheetL) {
          errors.push({
            field: "size",
            message: `Part ${L}x${W}mm is larger than standard sheet ${sheetL}x${sheetW}mm`,
            code: "OVERSIZED_PART",
            severity: "error",
          });
        } else if (part.allow_rotation === false) {
          errors.push({
            field: "size",
            message: `Part ${L}x${W}mm requires rotation to fit, but rotation is disabled`,
            code: "ROTATION_REQUIRED",
            severity: "error",
          });
        }
      }
    }
  }

  // Thickness
  if (!part.thickness_mm || part.thickness_mm <= 0) {
    errors.push({
      field: "thickness_mm",
      message: "Part thickness is required and must be positive",
      code: "INVALID_THICKNESS",
      severity: "error",
    });
  } else if (
    opts.allowedThicknesses.length > 0 &&
    !opts.allowedThicknesses.includes(part.thickness_mm)
  ) {
    warnings.push({
      field: "thickness_mm",
      message: `Thickness ${part.thickness_mm}mm is non-standard. Standard: ${opts.allowedThicknesses.join(", ")}mm`,
      code: "NONSTANDARD_THICKNESS",
      severity: "warning",
    });
  }

  // Quantity
  if (!part.qty || part.qty <= 0) {
    errors.push({
      field: "qty",
      message: "Quantity must be at least 1",
      code: "INVALID_QUANTITY",
      severity: "error",
    });
  } else if (part.qty > opts.maxQuantity) {
    errors.push({
      field: "qty",
      message: `Quantity ${part.qty} exceeds maximum ${opts.maxQuantity}`,
      code: "QUANTITY_TOO_HIGH",
      severity: "error",
    });
  }

  // Material
  if (!part.material_id || part.material_id.trim() === "") {
    errors.push({
      field: "material_id",
      message: "Material is required",
      code: "REQUIRED_FIELD",
      severity: "error",
    });
  }

  // Grain direction
  if (part.material_id && opts.grainedMaterials.includes(part.material_id)) {
    if (part.grain === "none" && part.allow_rotation !== false) {
      warnings.push({
        field: "grain",
        message: "Material is grained but grain direction not specified. Parts may be placed with incorrect grain.",
        code: "GRAIN_NOT_SPECIFIED",
        severity: "warning",
      });
    }
  }

  // Label length
  if (part.label && part.label.length > 100) {
    warnings.push({
      field: "label",
      message: "Part label is very long. Consider shortening for better display.",
      code: "LABEL_TOO_LONG",
      severity: "warning",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate multiple parts
 */
export function validateParts(
  parts: CutPart[],
  options: ValidationOptions = {}
): {
  valid: boolean;
  totalErrors: number;
  totalWarnings: number;
  results: Map<string, ValidationResult>;
} {
  const results = new Map<string, ValidationResult>();
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const part of parts) {
    const result = validatePart(part, options);
    results.set(part.part_id, result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  // Check for duplicate part IDs
  const partIds = parts.map((p) => p.part_id);
  const duplicates = partIds.filter((id, i) => partIds.indexOf(id) !== i);

  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    for (const dupId of uniqueDuplicates) {
      const existing = results.get(dupId);
      if (existing) {
        existing.errors.push({
          field: "part_id",
          message: `Duplicate part ID: ${dupId}`,
          code: "DUPLICATE_PART_ID",
          severity: "error",
        });
        totalErrors++;
      }
    }
  }

  return {
    valid: totalErrors === 0,
    totalErrors,
    totalWarnings,
    results,
  };
}

/**
 * Quick validation for parsed parts (less strict)
 */
export function quickValidatePart(part: CutPart): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!part.size?.L || part.size.L <= 0) {
    errors.push("Invalid length");
  }
  if (!part.size?.W || part.size.W <= 0) {
    errors.push("Invalid width");
  }
  if (!part.qty || part.qty <= 0) {
    errors.push("Invalid quantity");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}




