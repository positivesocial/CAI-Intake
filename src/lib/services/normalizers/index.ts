/**
 * CAI Intake - Service Normalizers
 * 
 * Main entry point for normalizing raw service data to canonical types.
 * 
 * This is the core of the "many dialects → one internal truth" architecture:
 * 
 * 1. External inputs (OCR, CSV, templates) fill RawServiceFields
 * 2. Normalizers convert to canonical PartServices using org dialect
 * 3. Everything downstream uses the canonical types
 */

import type { PartServices } from "../canonical-types";
import type { OrgServiceDialect } from "../dialect-types";
import type { RawServiceFields } from "../raw-fields";
import { getDefaultDialect, mergeWithDefaults } from "../default-dialect";
import { normalizeEdgeband } from "./edgeband";
import { normalizeGrooves } from "./groove";
import { normalizeHoles } from "./drilling";
import { normalizeCnc } from "./cnc";

// Re-export individual normalizers for direct use
export { normalizeEdgeband } from "./edgeband";
export { normalizeGrooves } from "./groove";
export { normalizeHoles } from "./drilling";
export { normalizeCnc } from "./cnc";

/**
 * Normalize all raw service fields to canonical PartServices
 * 
 * @param raw - Raw fields from external source (OCR, CSV, etc.)
 * @param dialect - Organization dialect (defaults to global default)
 * @returns Canonical PartServices object
 * 
 * @example
 * ```ts
 * // Parse raw text
 * const raw = extractRawFieldsFromText("Side panel 720x560 2L2W G-ALL-4-10 H2-110");
 * 
 * // Normalize with org dialect
 * const services = normalizeServices(raw, orgDialect);
 * 
 * // Result:
 * // {
 * //   edgeband: { edges: ["L1", "L2", "W1", "W2"] },
 * //   grooves: [{ onEdge: "L1", ... }, ...],
 * //   holes: [{ kind: "hinge", count: 2, offsetsMm: [110], ... }]
 * // }
 * ```
 */
export function normalizeServices(
  raw: RawServiceFields,
  dialect?: Partial<OrgServiceDialect>
): PartServices {
  // Merge with defaults to ensure all fields are present
  const fullDialect = dialect 
    ? mergeWithDefaults(dialect)
    : getDefaultDialect();
  
  // Normalize each service type
  const edgeband = normalizeEdgeband(raw.edgeband, fullDialect);
  const grooves = normalizeGrooves(raw.groove, fullDialect);
  const holes = normalizeHoles(raw.drilling, fullDialect);
  const cnc = normalizeCnc(raw.cnc, fullDialect);
  
  // Build result, excluding undefined fields
  const result: PartServices = {};
  
  if (edgeband) result.edgeband = edgeband;
  if (grooves && grooves.length > 0) result.grooves = grooves;
  if (holes && holes.length > 0) result.holes = holes;
  if (cnc && cnc.length > 0) result.cnc = cnc;
  
  return result;
}

/**
 * Options for quick normalization from text
 */
export interface QuickNormalizeOptions {
  /** Organization dialect (uses default if not provided) */
  dialect?: Partial<OrgServiceDialect>;
  
  /** Column headers for context */
  columnHeaders?: string[];
  
  /** Only extract specific service types */
  only?: ("edgeband" | "groove" | "drilling" | "cnc")[];
}

/**
 * Quick normalize from a single text string
 * 
 * Convenience function for simple text parsing.
 * For more control, use extractRawFieldsFromText + normalizeServices.
 */
export function normalizeFromText(
  text: string,
  options: QuickNormalizeOptions = {}
): PartServices {
  const { dialect, columnHeaders, only } = options;
  
  // Import here to avoid circular dependency
  const { extractRawFieldsFromText } = require("../raw-fields");
  
  const raw = extractRawFieldsFromText(text, columnHeaders);
  
  // If filtering to specific types, remove others from raw
  if (only && only.length > 0) {
    if (!only.includes("edgeband")) delete raw.edgeband;
    if (!only.includes("groove")) delete raw.groove;
    if (!only.includes("drilling")) delete raw.drilling;
    if (!only.includes("cnc")) delete raw.cnc;
  }
  
  return normalizeServices(raw, dialect);
}

/**
 * Validate normalized services
 * 
 * Checks for common issues and returns warnings.
 */
export function validateServices(services: PartServices): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check edgebanding
  if (services.edgeband) {
    if (services.edgeband.edges.length === 0) {
      warnings.push("Edgeband spec has no edges");
    }
    const uniqueEdges = new Set(services.edgeband.edges);
    if (uniqueEdges.size !== services.edgeband.edges.length) {
      warnings.push("Edgeband has duplicate edges");
    }
  }
  
  // Check grooves
  if (services.grooves) {
    for (const groove of services.grooves) {
      if (groove.widthMm <= 0) {
        warnings.push(`Groove width must be positive: ${groove.widthMm}`);
      }
      if (groove.depthMm <= 0) {
        warnings.push(`Groove depth must be positive: ${groove.depthMm}`);
      }
      if (groove.distanceFromEdgeMm < 0) {
        warnings.push(`Groove offset cannot be negative: ${groove.distanceFromEdgeMm}`);
      }
    }
  }
  
  // Check holes
  if (services.holes) {
    for (const hole of services.holes) {
      if (hole.count !== undefined && hole.count <= 0) {
        warnings.push(`Hole count must be positive: ${hole.count}`);
      }
      if (hole.distanceFromEdgeMm < 0) {
        warnings.push(`Hole distance from edge cannot be negative: ${hole.distanceFromEdgeMm}`);
      }
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Merge services from multiple sources
 * 
 * Useful when a part has services from different columns/fields.
 */
export function mergePartServices(
  ...sources: (PartServices | undefined)[]
): PartServices {
  const result: PartServices = {};
  
  for (const source of sources) {
    if (!source) continue;
    
    // Edgeband: merge edges
    if (source.edgeband) {
      if (!result.edgeband) {
        result.edgeband = { ...source.edgeband, edges: [...source.edgeband.edges] };
      } else {
        const combinedEdges = [...new Set([
          ...result.edgeband.edges,
          ...source.edgeband.edges,
        ])];
        result.edgeband = {
          ...result.edgeband,
          ...source.edgeband,
          edges: combinedEdges as typeof result.edgeband.edges,
        };
      }
    }
    
    // Grooves: append
    if (source.grooves && source.grooves.length > 0) {
      result.grooves = [...(result.grooves ?? []), ...source.grooves];
    }
    
    // Holes: append
    if (source.holes && source.holes.length > 0) {
      result.holes = [...(result.holes ?? []), ...source.holes];
    }
    
    // CNC: append
    if (source.cnc && source.cnc.length > 0) {
      result.cnc = [...(result.cnc ?? []), ...source.cnc];
    }
  }
  
  return result;
}





