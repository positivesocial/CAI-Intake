/**
 * CAI Intake - Smart Material Matcher
 * 
 * Intelligently matches parsed material names to organization materials
 * with confidence scoring and smart defaults. Also auto-matches edgebands
 * to sheet materials when not specified.
 */

import { createClient } from "@/lib/supabase/server";

// =============================================================================
// TYPES
// =============================================================================

export interface OrgMaterial {
  id: string;
  name: string;
  sku?: string;
  thickness_mm: number;
  type?: string;
  keywords?: string[];
}

export interface OrgEdgeband {
  id: string;
  name: string;
  sku?: string;
  thickness_mm: number;
  width_mm: number;
  shortcode?: string;
  keywords?: string[];
}

export interface MaterialMatchResult {
  materialId: string;
  materialName: string;
  confidence: number;
  matchType: "exact" | "fuzzy" | "keyword" | "default";
  matchedOn?: string;
}

export interface EdgebandMatchResult {
  edgebandId: string;
  edgebandName: string;
  confidence: number;
  matchType: "exact" | "material_match" | "default";
  matchedOn?: string;
}

export interface MaterialMatcherContext {
  organizationId: string;
  materials: OrgMaterial[];
  edgebands: OrgEdgeband[];
  defaultMaterialId?: string;
  defaultEdgebandId?: string;
  // Pre-computed lookup maps
  materialNameIndex: Map<string, OrgMaterial>;
  materialKeywordIndex: Map<string, OrgMaterial>;
  edgebandNameIndex: Map<string, OrgEdgeband>;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize matcher context by loading org materials and edgebands
 */
export async function initMaterialMatcher(
  organizationId: string
): Promise<MaterialMatcherContext> {
  const supabase = await createClient();
  
  // Fetch materials
  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, sku, thickness_mm, type")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  
  // Fetch edgebands
  const { data: edgebands } = await supabase
    .from("edgebands")
    .select("id, name, sku, thickness_mm, width_mm, shortcode")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  
  const orgMaterials: OrgMaterial[] = (materials || []).map(m => ({
    ...m,
    keywords: generateMaterialKeywords(m.name, m.sku),
  }));
  
  const orgEdgebands: OrgEdgeband[] = (edgebands || []).map(e => ({
    ...e,
    keywords: generateEdgebandKeywords(e.name, e.sku),
  }));
  
  // Build lookup indexes
  const materialNameIndex = new Map<string, OrgMaterial>();
  const materialKeywordIndex = new Map<string, OrgMaterial>();
  const edgebandNameIndex = new Map<string, OrgEdgeband>();
  
  for (const mat of orgMaterials) {
    const normalized = normalizeText(mat.name);
    materialNameIndex.set(normalized, mat);
    
    // Index keywords
    for (const kw of mat.keywords || []) {
      if (!materialKeywordIndex.has(kw)) {
        materialKeywordIndex.set(kw, mat);
      }
    }
  }
  
  for (const eb of orgEdgebands) {
    const normalized = normalizeText(eb.name);
    edgebandNameIndex.set(normalized, eb);
  }
  
  // Get defaults from org settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .single();
  
  const settings = (org?.settings as Record<string, unknown>) || {};
  
  return {
    organizationId,
    materials: orgMaterials,
    edgebands: orgEdgebands,
    defaultMaterialId: settings.defaultMaterialId as string | undefined,
    defaultEdgebandId: settings.defaultEdgebandId as string | undefined,
    materialNameIndex,
    materialKeywordIndex,
    edgebandNameIndex,
  };
}

// =============================================================================
// MATERIAL MATCHING
// =============================================================================

/**
 * Match a raw material name to an org material
 */
export function matchMaterial(
  rawName: string | undefined,
  thickness: number | undefined,
  ctx: MaterialMatcherContext
): MaterialMatchResult {
  // If no raw name, use default
  if (!rawName || rawName.trim() === "") {
    return getDefaultMaterial(ctx);
  }
  
  const normalized = normalizeText(rawName);
  
  // 1. Exact name match
  const exactMatch = ctx.materialNameIndex.get(normalized);
  if (exactMatch) {
    // Boost confidence if thickness also matches
    const thicknessBonus = thickness && exactMatch.thickness_mm === thickness ? 0.05 : 0;
    return {
      materialId: exactMatch.id,
      materialName: exactMatch.name,
      confidence: 0.95 + thicknessBonus,
      matchType: "exact",
      matchedOn: exactMatch.name,
    };
  }
  
  // 2. Fuzzy match on name
  let bestFuzzyMatch: { material: OrgMaterial; score: number } | null = null;
  
  for (const mat of ctx.materials) {
    const score = fuzzyScore(normalized, normalizeText(mat.name));
    if (score > 0.7 && (!bestFuzzyMatch || score > bestFuzzyMatch.score)) {
      bestFuzzyMatch = { material: mat, score };
    }
  }
  
  if (bestFuzzyMatch && bestFuzzyMatch.score > 0.8) {
    const thicknessBonus = thickness && bestFuzzyMatch.material.thickness_mm === thickness ? 0.05 : 0;
    return {
      materialId: bestFuzzyMatch.material.id,
      materialName: bestFuzzyMatch.material.name,
      confidence: Math.min(0.9, bestFuzzyMatch.score * 0.9) + thicknessBonus,
      matchType: "fuzzy",
      matchedOn: `fuzzy: ${bestFuzzyMatch.material.name}`,
    };
  }
  
  // 3. Keyword match
  const keywords = extractKeywords(normalized);
  for (const kw of keywords) {
    const keywordMatch = ctx.materialKeywordIndex.get(kw);
    if (keywordMatch) {
      const thicknessBonus = thickness && keywordMatch.thickness_mm === thickness ? 0.05 : 0;
      return {
        materialId: keywordMatch.id,
        materialName: keywordMatch.name,
        confidence: 0.7 + thicknessBonus,
        matchType: "keyword",
        matchedOn: `keyword: ${kw}`,
      };
    }
  }
  
  // 4. Thickness-based match (if thickness provided)
  if (thickness) {
    const thicknessMatches = ctx.materials.filter(m => m.thickness_mm === thickness);
    if (thicknessMatches.length === 1) {
      // Only one material with this thickness - likely match
      return {
        materialId: thicknessMatches[0].id,
        materialName: thicknessMatches[0].name,
        confidence: 0.6,
        matchType: "fuzzy",
        matchedOn: `thickness: ${thickness}mm`,
      };
    }
  }
  
  // 5. Fall back to default
  return getDefaultMaterial(ctx);
}

/**
 * Get default material
 */
function getDefaultMaterial(ctx: MaterialMatcherContext): MaterialMatchResult {
  // Use configured default
  if (ctx.defaultMaterialId) {
    const mat = ctx.materials.find(m => m.id === ctx.defaultMaterialId);
    if (mat) {
      return {
        materialId: mat.id,
        materialName: mat.name,
        confidence: 0.5,
        matchType: "default",
      };
    }
  }
  
  // Use first material as fallback
  if (ctx.materials.length > 0) {
    return {
      materialId: ctx.materials[0].id,
      materialName: ctx.materials[0].name,
      confidence: 0.3,
      matchType: "default",
    };
  }
  
  // Absolute fallback
  return {
    materialId: "default",
    materialName: "Default Material",
    confidence: 0.1,
    matchType: "default",
  };
}

// =============================================================================
// EDGEBAND MATCHING
// =============================================================================

/**
 * Match edgeband to a sheet material
 * 
 * If no edgeband is specified, finds the best matching edgeband
 * based on the sheet material name (e.g., "White Melamine" sheet
 * should match "White Melamine" or "White ABS" edgeband)
 */
export function matchEdgeband(
  rawEdgebandName: string | undefined,
  sheetMaterialName: string,
  ctx: MaterialMatcherContext
): EdgebandMatchResult | null {
  // If edgebands are empty, return null
  if (ctx.edgebands.length === 0) {
    return null;
  }
  
  // 1. If edgeband name is specified, try to match it
  if (rawEdgebandName && rawEdgebandName.trim() !== "") {
    const normalized = normalizeText(rawEdgebandName);
    
    // Exact match
    const exactMatch = ctx.edgebandNameIndex.get(normalized);
    if (exactMatch) {
      return {
        edgebandId: exactMatch.id,
        edgebandName: exactMatch.name,
        confidence: 0.95,
        matchType: "exact",
        matchedOn: exactMatch.name,
      };
    }
    
    // Fuzzy match on edgeband name
    let bestMatch: { edgeband: OrgEdgeband; score: number } | null = null;
    for (const eb of ctx.edgebands) {
      const score = fuzzyScore(normalized, normalizeText(eb.name));
      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { edgeband: eb, score };
      }
    }
    
    if (bestMatch) {
      return {
        edgebandId: bestMatch.edgeband.id,
        edgebandName: bestMatch.edgeband.name,
        confidence: bestMatch.score * 0.9,
        matchType: "exact",
        matchedOn: `fuzzy: ${bestMatch.edgeband.name}`,
      };
    }
  }
  
  // 2. Auto-match based on sheet material name
  const materialNormalized = normalizeText(sheetMaterialName);
  const materialKeywords = extractKeywords(materialNormalized);
  
  // Score each edgeband based on how well it matches the material
  let bestMaterialMatch: { edgeband: OrgEdgeband; score: number } | null = null;
  
  for (const eb of ctx.edgebands) {
    const ebNormalized = normalizeText(eb.name);
    
    // Direct fuzzy match on names
    const directScore = fuzzyScore(materialNormalized, ebNormalized);
    
    // Keyword overlap score
    const ebKeywords = extractKeywords(ebNormalized);
    const keywordOverlap = countKeywordOverlap(materialKeywords, ebKeywords);
    const keywordScore = keywordOverlap / Math.max(materialKeywords.length, 1);
    
    // Color matching boost (white, black, oak, etc.)
    const colorScore = matchColors(materialNormalized, ebNormalized) ? 0.3 : 0;
    
    // Combined score
    const totalScore = directScore * 0.4 + keywordScore * 0.3 + colorScore;
    
    if (totalScore > 0.3 && (!bestMaterialMatch || totalScore > bestMaterialMatch.score)) {
      bestMaterialMatch = { edgeband: eb, score: totalScore };
    }
  }
  
  if (bestMaterialMatch && bestMaterialMatch.score > 0.4) {
    return {
      edgebandId: bestMaterialMatch.edgeband.id,
      edgebandName: bestMaterialMatch.edgeband.name,
      confidence: Math.min(0.85, bestMaterialMatch.score),
      matchType: "material_match",
      matchedOn: `matches material: ${sheetMaterialName}`,
    };
  }
  
  // 3. Use default edgeband
  if (ctx.defaultEdgebandId) {
    const eb = ctx.edgebands.find(e => e.id === ctx.defaultEdgebandId);
    if (eb) {
      return {
        edgebandId: eb.id,
        edgebandName: eb.name,
        confidence: 0.5,
        matchType: "default",
      };
    }
  }
  
  // 4. Use first edgeband as ultimate fallback
  return {
    edgebandId: ctx.edgebands[0].id,
    edgebandName: ctx.edgebands[0].name,
    confidence: 0.3,
    matchType: "default",
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "mm", "inch", "in", "x", "board", "sheet", "panel",
  ]);
  
  return text
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Generate searchable keywords from material name
 */
function generateMaterialKeywords(name: string, sku?: string): string[] {
  const keywords = extractKeywords(normalizeText(name));
  
  if (sku) {
    keywords.push(normalizeText(sku));
  }
  
  return [...new Set(keywords)];
}

/**
 * Generate searchable keywords from edgeband name
 */
function generateEdgebandKeywords(name: string, sku?: string): string[] {
  const keywords = extractKeywords(normalizeText(name));
  
  if (sku) {
    keywords.push(normalizeText(sku));
  }
  
  // Add common edgeband type keywords
  const ebTypes = ["abs", "pvc", "melamine", "veneer", "laminate", "acrylic"];
  for (const t of ebTypes) {
    if (name.toLowerCase().includes(t)) {
      keywords.push(t);
    }
  }
  
  return [...new Set(keywords)];
}

/**
 * Calculate fuzzy match score between two strings
 * Returns value between 0 and 1
 */
function fuzzyScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Contains check
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.7 + (shorter / longer) * 0.3;
  }
  
  // Word overlap
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  const maxWords = Math.max(wordsA.size, wordsB.size);
  if (maxWords === 0) return 0;
  
  return overlap / maxWords;
}

/**
 * Count keyword overlap
 */
function countKeywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(w => setB.has(w)).length;
}

/**
 * Check if two texts share a color keyword
 */
function matchColors(a: string, b: string): boolean {
  const colors = [
    "white", "black", "grey", "gray", "brown", "beige", "cream", "ivory",
    "oak", "walnut", "maple", "cherry", "mahogany", "wenge", "ash", "birch",
    "natural", "clear", "dark", "light", "anthracite", "graphite",
  ];
  
  for (const color of colors) {
    if (a.includes(color) && b.includes(color)) {
      return true;
    }
  }
  
  return false;
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Apply smart matching to a batch of parsed parts
 */
export async function applySmartMatching(
  parts: Array<{
    material_raw?: string;
    thickness_mm?: number;
    edgeband_raw?: string;
    ops?: {
      edging?: {
        edges?: Record<string, { apply?: boolean; edgeband_id?: string }>;
      };
    };
  }>,
  organizationId: string
): Promise<{
  parts: Array<{
    material_id: string;
    material_name: string;
    material_confidence: number;
    ops?: {
      edging?: {
        edges?: Record<string, { apply?: boolean; edgeband_id?: string }>;
      };
    };
  }>;
  summary: {
    materialsMatched: number;
    edgebandsMatched: number;
    avgMaterialConfidence: number;
    avgEdgebandConfidence: number;
  };
}> {
  // Initialize context
  const ctx = await initMaterialMatcher(organizationId);
  
  let totalMaterialConfidence = 0;
  let totalEdgebandConfidence = 0;
  let materialsMatched = 0;
  let edgebandsMatched = 0;
  
  const processedParts = parts.map(part => {
    // Match material
    const materialMatch = matchMaterial(part.material_raw, part.thickness_mm, ctx);
    totalMaterialConfidence += materialMatch.confidence;
    if (materialMatch.matchType !== "default") materialsMatched++;
    
    // Process edgebanding
    let processedOps = part.ops;
    
    if (processedOps?.edging?.edges) {
      const edges = { ...processedOps.edging.edges };
      let edgesModified = false;
      
      for (const [edge, config] of Object.entries(edges)) {
        if (config.apply && !config.edgeband_id) {
          // No edgeband specified - auto-match based on material
          const ebMatch = matchEdgeband(
            part.edgeband_raw,
            materialMatch.materialName,
            ctx
          );
          
          if (ebMatch) {
            edges[edge] = {
              ...config,
              edgeband_id: ebMatch.edgebandId,
            };
            totalEdgebandConfidence += ebMatch.confidence;
            edgebandsMatched++;
            edgesModified = true;
          }
        }
      }
      
      if (edgesModified) {
        processedOps = {
          ...processedOps,
          edging: { ...processedOps.edging, edges },
        };
      }
    }
    
    return {
      material_id: materialMatch.materialId,
      material_name: materialMatch.materialName,
      material_confidence: materialMatch.confidence,
      ops: processedOps,
    };
  });
  
  return {
    parts: processedParts,
    summary: {
      materialsMatched,
      edgebandsMatched,
      avgMaterialConfidence: parts.length > 0 ? totalMaterialConfidence / parts.length : 0,
      avgEdgebandConfidence: edgebandsMatched > 0 ? totalEdgebandConfidence / edgebandsMatched : 0,
    },
  };
}

