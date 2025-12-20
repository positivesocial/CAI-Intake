/**
 * CAI Intake - Cutlist Validator
 * 
 * Validates complete cutlists for consistency and business rules.
 */

import type { CutlistDocument, CutPart } from "@/lib/schema";
import { validateParts, type ValidationResult, type ValidationOptions } from "./part-validator";

// =============================================================================
// TYPES
// =============================================================================

export interface CutlistValidationResult {
  valid: boolean;
  cutlistErrors: ValidationError[];
  cutlistWarnings: ValidationError[];
  partResults: Map<string, ValidationResult>;
  summary: {
    totalParts: number;
    validParts: number;
    invalidParts: number;
    totalPieces: number;
    materialsUsed: string[];
    hasEdgeBanding: boolean;
    hasCNCOperations: boolean;
  };
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: "error" | "warning";
}

export interface CutlistValidationOptions extends ValidationOptions {
  /** Maximum number of unique parts */
  maxUniqueParts?: number;
  /** Maximum total pieces */
  maxTotalPieces?: number;
  /** Require all materials to be defined */
  requireDefinedMaterials?: boolean;
  /** Require all edgebands to be defined */
  requireDefinedEdgebands?: boolean;
}

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_CUTLIST_OPTIONS: CutlistValidationOptions = {
  maxUniqueParts: 10000,
  maxTotalPieces: 100000,
  requireDefinedMaterials: false,
  requireDefinedEdgebands: false,
};

// =============================================================================
// VALIDATORS
// =============================================================================

/**
 * Validate a complete cutlist document
 */
export function validateCutlist(
  cutlist: CutlistDocument,
  options: CutlistValidationOptions = {}
): CutlistValidationResult {
  const opts = { ...DEFAULT_CUTLIST_OPTIONS, ...options };
  const cutlistErrors: ValidationError[] = [];
  const cutlistWarnings: ValidationError[] = [];

  // Validate parts
  const partResults = validateParts(cutlist.parts, opts);

  // Build summary
  const materialsUsed = [...new Set(cutlist.parts.map((p) => p.material_id))];
  const totalPieces = cutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const hasEdgeBanding = cutlist.parts.some(
    (p) => p.ops?.edging?.edges && Object.keys(p.ops.edging.edges).length > 0
  );
  const hasCNCOperations = cutlist.parts.some(
    (p) =>
      (p.ops?.holes && p.ops.holes.length > 0) ||
      (p.ops?.grooves && p.ops.grooves.length > 0) ||
      (p.ops?.routing && p.ops.routing.length > 0)
  );

  // Cutlist-level validation
  if (!cutlist.job_id || cutlist.job_id.trim() === "") {
    cutlistWarnings.push({
      field: "job_id",
      message: "Cutlist has no job ID",
      code: "MISSING_JOB_ID",
      severity: "warning",
    });
  }

  if (!cutlist.name || cutlist.name.trim() === "") {
    cutlistWarnings.push({
      field: "name",
      message: "Cutlist has no name",
      code: "MISSING_NAME",
      severity: "warning",
    });
  }

  // Parts count validation
  if (cutlist.parts.length === 0) {
    cutlistErrors.push({
      field: "parts",
      message: "Cutlist has no parts",
      code: "NO_PARTS",
      severity: "error",
    });
  }

  if (cutlist.parts.length > (opts.maxUniqueParts || 10000)) {
    cutlistErrors.push({
      field: "parts",
      message: `Too many unique parts (${cutlist.parts.length}). Maximum is ${opts.maxUniqueParts}`,
      code: "TOO_MANY_PARTS",
      severity: "error",
    });
  }

  if (totalPieces > (opts.maxTotalPieces || 100000)) {
    cutlistErrors.push({
      field: "parts",
      message: `Too many total pieces (${totalPieces}). Maximum is ${opts.maxTotalPieces}`,
      code: "TOO_MANY_PIECES",
      severity: "error",
    });
  }

  // Material validation
  if (opts.requireDefinedMaterials) {
    const definedMaterialIds = cutlist.materials.map((m) => m.material_id);
    const undefinedMaterials = materialsUsed.filter(
      (m) => !definedMaterialIds.includes(m)
    );

    if (undefinedMaterials.length > 0) {
      cutlistErrors.push({
        field: "materials",
        message: `Parts reference undefined materials: ${undefinedMaterials.join(", ")}`,
        code: "UNDEFINED_MATERIALS",
        severity: "error",
      });
    }
  }

  // Edgeband validation
  if (opts.requireDefinedEdgebands && hasEdgeBanding) {
    const usedEdgebandIds = new Set<string>();
    for (const part of cutlist.parts) {
      if (part.ops?.edging?.edges) {
        for (const edge of Object.values(part.ops.edging.edges)) {
          if (typeof edge === "object" && edge !== null && "edgeband_id" in edge) {
            usedEdgebandIds.add((edge as { edgeband_id: string }).edgeband_id);
          }
        }
      }
    }

    const definedEdgebandIds = cutlist.edgebands?.map((e) => e.edgeband_id) ?? [];
    const undefinedEdgebands = [...usedEdgebandIds].filter(
      (e) => !definedEdgebandIds.includes(e)
    );

    if (undefinedEdgebands.length > 0) {
      cutlistErrors.push({
        field: "edgebands",
        message: `Parts reference undefined edgebands: ${undefinedEdgebands.join(", ")}`,
        code: "UNDEFINED_EDGEBANDS",
        severity: "error",
      });
    }
  }

  // Capabilities validation
  if (hasEdgeBanding && !cutlist.capabilities?.edging) {
    cutlistWarnings.push({
      field: "capabilities",
      message: "Parts have edge banding but edging capability is disabled",
      code: "CAPABILITY_MISMATCH",
      severity: "warning",
    });
  }

  if (hasCNCOperations && !cutlist.capabilities?.cnc_holes && !cutlist.capabilities?.cnc_routing) {
    cutlistWarnings.push({
      field: "capabilities",
      message: "Parts have CNC operations but CNC capabilities are disabled",
      code: "CAPABILITY_MISMATCH",
      severity: "warning",
    });
  }

  // Check for mixed thicknesses per material
  const thicknessesByMaterial = new Map<string, Set<number>>();
  for (const part of cutlist.parts) {
    const existing = thicknessesByMaterial.get(part.material_id) || new Set();
    existing.add(part.thickness_mm);
    thicknessesByMaterial.set(part.material_id, existing);
  }

  for (const [materialId, thicknesses] of thicknessesByMaterial) {
    if (thicknesses.size > 1) {
      cutlistWarnings.push({
        field: "parts",
        message: `Material "${materialId}" has multiple thicknesses: ${[...thicknesses].join(", ")}mm`,
        code: "MIXED_THICKNESSES",
        severity: "warning",
      });
    }
  }

  // Calculate valid/invalid parts
  let validParts = 0;
  let invalidParts = 0;
  for (const result of partResults.results.values()) {
    if (result.valid) {
      validParts++;
    } else {
      invalidParts++;
    }
  }

  return {
    valid: cutlistErrors.length === 0 && partResults.valid,
    cutlistErrors,
    cutlistWarnings,
    partResults: partResults.results,
    summary: {
      totalParts: cutlist.parts.length,
      validParts,
      invalidParts,
      totalPieces,
      materialsUsed,
      hasEdgeBanding,
      hasCNCOperations,
    },
  };
}

/**
 * Quick validation for import/parsing
 */
export function quickValidateCutlist(
  parts: CutPart[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (parts.length === 0) {
    errors.push("No parts found");
    return { valid: false, errors };
  }

  // Check for basic validity
  let validCount = 0;
  for (const part of parts) {
    if (
      part.size?.L > 0 &&
      part.size?.W > 0 &&
      part.qty > 0
    ) {
      validCount++;
    }
  }

  if (validCount === 0) {
    errors.push("No valid parts with dimensions");
  }

  const duplicateIds = parts
    .map((p) => p.part_id)
    .filter((id, i, arr) => arr.indexOf(id) !== i);

  if (duplicateIds.length > 0) {
    errors.push(`Duplicate part IDs: ${[...new Set(duplicateIds)].slice(0, 5).join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

