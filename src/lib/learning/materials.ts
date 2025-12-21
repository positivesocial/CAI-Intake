/**
 * CAI Intake - Material Mapping Learning
 * 
 * Learn and apply material name mappings from user corrections.
 */

import { getClient } from "@/lib/supabase/client";
import type { MaterialMapping } from "./types";

// ============================================================
// MATERIAL MAPPING RETRIEVAL
// ============================================================

/**
 * Get all material mappings for an organization
 */
export async function getMaterialMappings(
  organizationId?: string
): Promise<MaterialMapping[]> {
  const supabase = getClient();
  if (!supabase) return getDefaultMaterialMappings();

  try {
    const { data, error } = await supabase
      .from("material_mappings")
      .select("*")
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("usage_count", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDbMappingToMapping);
  } catch (error) {
    console.error("Failed to fetch material mappings:", error);
    return getDefaultMaterialMappings();
  }
}

/**
 * Find a material mapping by raw name
 */
export async function findMaterialMapping(
  rawName: string,
  organizationId?: string
): Promise<MaterialMapping | null> {
  const normalized = normalizeMaterialName(rawName);
  
  const supabase = getClient();
  if (!supabase) {
    const defaults = getDefaultMaterialMappings();
    return defaults.find(m => m.normalizedName === normalized) || null;
  }

  try {
    const { data, error } = await supabase
      .from("material_mappings")
      .select("*")
      .eq("normalized_name", normalized)
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("confidence", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    return data ? mapDbMappingToMapping(data) : null;
  } catch (error) {
    console.error("Failed to find material mapping:", error);
    return null;
  }
}

// ============================================================
// MATERIAL MAPPING CREATION & UPDATE
// ============================================================

/**
 * Create or update a material mapping
 */
export async function upsertMaterialMapping(
  mapping: {
    rawName: string;
    materialId: string;
    thicknessMm?: number;
  },
  organizationId?: string
): Promise<MaterialMapping | null> {
  const normalized = normalizeMaterialName(mapping.rawName);
  
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const insertData = {
      organization_id: organizationId,
      raw_name: mapping.rawName,
      normalized_name: normalized,
      material_id: mapping.materialId,
      thickness_mm: mapping.thicknessMm,
      confidence: 0.5, // Start with medium confidence
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("material_mappings")
      .upsert(insertData, {
        onConflict: "organization_id,normalized_name",
      })
      .select()
      .single();

    if (error) throw error;

    return mapDbMappingToMapping(data);
  } catch (error) {
    console.error("Failed to upsert material mapping:", error);
    return null;
  }
}

/**
 * Record material mapping usage
 */
export async function recordMaterialMappingUsage(
  mappingId: string
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("material_mappings")
      .select("usage_count, confidence")
      .eq("id", mappingId)
      .single();

    if (current) {
      const newUsageCount = ((current as Record<string, number>).usage_count || 0) + 1;
      // Increase confidence as usage grows (capped at 0.99)
      const newConfidence = Math.min(0.99, 0.5 + (newUsageCount * 0.05));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("material_mappings")
        .update({
          usage_count: newUsageCount,
          confidence: newConfidence,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", mappingId);
    }
  } catch (error) {
    console.error("Failed to record material mapping usage:", error);
  }
}

// ============================================================
// MATERIAL MATCHING
// ============================================================

/**
 * Build a map of normalized names to material mappings for fast lookup
 */
export function buildMaterialMappingIndex(
  mappings: MaterialMapping[]
): Map<string, MaterialMapping> {
  const map = new Map<string, MaterialMapping>();
  
  // Sort by confidence so higher confidence mappings take precedence
  const sorted = [...mappings].sort((a, b) => b.confidence - a.confidence);
  
  for (const mapping of sorted) {
    if (!map.has(mapping.normalizedName)) {
      map.set(mapping.normalizedName, mapping);
    }
  }
  
  return map;
}

/**
 * Match a raw material name to a material ID
 */
export function matchMaterial(
  rawName: string,
  mappingIndex: Map<string, MaterialMapping>
): { materialId: string; thicknessMm?: number; confidence: number } | null {
  const normalized = normalizeMaterialName(rawName);
  
  // Direct match
  const directMatch = mappingIndex.get(normalized);
  if (directMatch) {
    return {
      materialId: directMatch.materialId,
      thicknessMm: directMatch.thicknessMm,
      confidence: directMatch.confidence,
    };
  }
  
  // Fuzzy match - try to find partial matches
  for (const [key, mapping] of mappingIndex) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        materialId: mapping.materialId,
        thicknessMm: mapping.thicknessMm,
        confidence: mapping.confidence * 0.7, // Lower confidence for partial match
      };
    }
  }
  
  // Try common patterns
  const inferredMaterial = inferMaterialFromName(rawName);
  if (inferredMaterial) {
    return {
      materialId: inferredMaterial.materialId,
      thicknessMm: inferredMaterial.thicknessMm,
      confidence: 0.5, // Medium confidence for inferred
    };
  }
  
  return null;
}

/**
 * Infer material from common naming patterns
 */
export function inferMaterialFromName(
  rawName: string
): { materialId: string; thicknessMm?: number } | null {
  const lower = rawName.toLowerCase();
  
  // Check for thickness first (e.g., "18mm white melamine")
  const thicknessMatch = lower.match(/(\d+)\s*mm/);
  const thicknessMm = thicknessMatch ? parseInt(thicknessMatch[1], 10) : undefined;
  
  // Material type inference
  if (lower.includes("melamine") || lower.includes("mel")) {
    if (lower.includes("white")) {
      return { materialId: "MAT-WHITE-18", thicknessMm: thicknessMm || 18 };
    }
    if (lower.includes("black")) {
      return { materialId: "MAT-BLACK-18", thicknessMm: thicknessMm || 18 };
    }
  }
  
  if (lower.includes("mdf")) {
    return { materialId: "MAT-MDF-18", thicknessMm: thicknessMm || 18 };
  }
  
  if (lower.includes("plywood") || lower.includes("ply")) {
    return { materialId: "MAT-PLY-18", thicknessMm: thicknessMm || 18 };
  }
  
  if (lower.includes("pb") || lower.includes("particleboard") || lower.includes("particle board")) {
    // Check for specific finishes
    if (lower.includes("cherry")) {
      return { materialId: "MAT-PB-CHERRY-18", thicknessMm: thicknessMm || 18 };
    }
    if (lower.includes("oak")) {
      return { materialId: "MAT-PB-OAK-18", thicknessMm: thicknessMm || 18 };
    }
    return { materialId: "MAT-PB-WHITE-18", thicknessMm: thicknessMm || 18 };
  }
  
  if (lower.includes("oak")) {
    return { materialId: "MAT-OAK-18", thicknessMm: thicknessMm || 18 };
  }
  
  if (lower.includes("walnut")) {
    return { materialId: "MAT-WALNUT-18", thicknessMm: thicknessMm || 18 };
  }
  
  return null;
}

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize a material name for consistent matching
 */
export function normalizeMaterialName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")           // Normalize whitespace
    .replace(/[^\w\s]/g, "")        // Remove special characters
    .replace(/\b(mm|inch|in)\b/g, "") // Remove units
    .replace(/\d+/g, "")            // Remove numbers
    .trim();
}

// ============================================================
// DEFAULT MAPPINGS
// ============================================================

/**
 * Get default material mappings
 */
export function getDefaultMaterialMappings(): MaterialMapping[] {
  return [
    {
      id: "default-white-mel",
      organizationId: null,
      rawName: "White Melamine",
      normalizedName: "white melamine",
      materialId: "MAT-WHITE-18",
      thicknessMm: 18,
      confidence: 0.9,
      usageCount: 0,
    },
    {
      id: "default-black-mel",
      organizationId: null,
      rawName: "Black Melamine",
      normalizedName: "black melamine",
      materialId: "MAT-BLACK-18",
      thicknessMm: 18,
      confidence: 0.9,
      usageCount: 0,
    },
    {
      id: "default-mdf",
      organizationId: null,
      rawName: "MDF",
      normalizedName: "mdf",
      materialId: "MAT-MDF-18",
      thicknessMm: 18,
      confidence: 0.9,
      usageCount: 0,
    },
    {
      id: "default-plywood",
      organizationId: null,
      rawName: "Plywood",
      normalizedName: "plywood",
      materialId: "MAT-PLY-18",
      thicknessMm: 18,
      confidence: 0.9,
      usageCount: 0,
    },
    {
      id: "default-pb-cherry",
      organizationId: null,
      rawName: "PB Black Cherry",
      normalizedName: "pb black cherry",
      materialId: "MAT-PB-CHERRY-18",
      thicknessMm: 18,
      confidence: 0.85,
      usageCount: 0,
    },
  ];
}

// ============================================================
// HELPERS
// ============================================================

function mapDbMappingToMapping(data: Record<string, unknown>): MaterialMapping {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | null,
    rawName: data.raw_name as string,
    normalizedName: data.normalized_name as string,
    materialId: data.material_id as string,
    thicknessMm: data.thickness_mm as number | undefined,
    confidence: data.confidence as number,
    usageCount: data.usage_count as number,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : undefined,
  };
}

