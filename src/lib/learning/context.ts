/**
 * CAI Intake - Learning Context
 * 
 * Build and manage learning context for parsing operations.
 */

import type { LearningContext, PatternType, ParserPattern, MaterialMapping, ClientTemplate } from "./types";
import { getParserPatterns, getDefaultPatterns } from "./patterns";
import { getMaterialMappings, buildMaterialMappingIndex, getDefaultMaterialMappings } from "./materials";
import { getClientTemplates, detectClientTemplate, findClientTemplate } from "./templates";

// ============================================================
// CONTEXT BUILDING
// ============================================================

/**
 * Get a complete learning context for parsing
 */
export async function getLearningContext(
  organizationId?: string,
  options?: {
    clientHint?: string;
    sourceText?: string;
    enableLearning?: boolean;
  }
): Promise<LearningContext> {
  const { clientHint, sourceText, enableLearning = true } = options || {};

  // If learning is disabled, return minimal context
  if (!enableLearning) {
    return {
      materialMappings: new Map(),
      parserPatterns: new Map(),
      enabled: false,
    };
  }

  // Fetch all learning data in parallel
  const [patterns, materialMappingsArray, clientTemplate] = await Promise.all([
    getParserPatterns(organizationId).catch(() => getDefaultPatterns()),
    getMaterialMappings(organizationId).catch(() => getDefaultMaterialMappings()),
    getClientTemplateFromHints(organizationId, clientHint, sourceText),
  ]);

  // Build pattern map by type
  const parserPatterns = new Map<PatternType, ParserPattern[]>();
  for (const pattern of patterns) {
    const existing = parserPatterns.get(pattern.patternType) || [];
    existing.push(pattern);
    parserPatterns.set(pattern.patternType, existing);
  }

  // Sort patterns by confidence within each type
  for (const [type, typePatterns] of parserPatterns) {
    typePatterns.sort((a, b) => b.confidence - a.confidence);
    parserPatterns.set(type, typePatterns);
  }

  // Build material mapping index
  const materialMappings = buildMaterialMappingIndex(materialMappingsArray);

  return {
    materialMappings,
    parserPatterns,
    clientTemplate: clientTemplate || undefined,
    organizationId,
    enabled: true,
  };
}

/**
 * Get a lightweight context with just default patterns (no DB calls)
 */
export function getDefaultLearningContext(): LearningContext {
  const patterns = getDefaultPatterns();
  const parserPatterns = new Map<PatternType, ParserPattern[]>();
  
  for (const pattern of patterns) {
    const existing = parserPatterns.get(pattern.patternType) || [];
    existing.push(pattern);
    parserPatterns.set(pattern.patternType, existing);
  }

  const materialMappings = buildMaterialMappingIndex(getDefaultMaterialMappings());

  return {
    materialMappings,
    parserPatterns,
    enabled: true,
  };
}

/**
 * Try to find a client template from hints
 */
async function getClientTemplateFromHints(
  organizationId?: string,
  clientHint?: string,
  sourceText?: string
): Promise<ClientTemplate | null> {
  // Try explicit client hint first
  if (clientHint) {
    const template = await findClientTemplate(clientHint, organizationId);
    if (template) return template;
  }

  // Try to detect from source text
  if (sourceText) {
    const template = await detectClientTemplate(sourceText, organizationId);
    if (template) return template;
  }

  return null;
}

// ============================================================
// CONTEXT UTILITIES
// ============================================================

/**
 * Check if a learning context has useful data
 */
export function hasLearningData(context: LearningContext): boolean {
  return (
    context.enabled &&
    (context.materialMappings.size > 0 ||
      context.parserPatterns.size > 0 ||
      context.clientTemplate !== undefined)
  );
}

/**
 * Get all patterns of a specific type from context
 */
export function getPatternsOfType(
  context: LearningContext,
  type: PatternType
): ParserPattern[] {
  return context.parserPatterns.get(type) || [];
}

/**
 * Get the best pattern of a specific type
 */
export function getBestPattern(
  context: LearningContext,
  type: PatternType
): ParserPattern | undefined {
  const patterns = context.parserPatterns.get(type);
  if (!patterns || patterns.length === 0) return undefined;
  return patterns[0]; // Already sorted by confidence
}

/**
 * Try to match a material name using context
 */
export function matchMaterialInContext(
  rawName: string,
  context: LearningContext
): { materialId: string; thicknessMm?: number; confidence: number } | null {
  if (!context.enabled) return null;
  
  const normalized = rawName.toLowerCase().replace(/\s+/g, " ").trim();
  
  // Try exact match first
  const exactMatch = context.materialMappings.get(normalized);
  if (exactMatch) {
    return {
      materialId: exactMatch.materialId,
      thicknessMm: exactMatch.thicknessMm,
      confidence: exactMatch.confidence,
    };
  }
  
  // Try partial matches
  for (const [key, mapping] of context.materialMappings) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        materialId: mapping.materialId,
        thicknessMm: mapping.thicknessMm,
        confidence: mapping.confidence * 0.7, // Lower confidence for partial
      };
    }
  }
  
  // Use client template default if available
  if (context.clientTemplate?.defaultMaterialId) {
    return {
      materialId: context.clientTemplate.defaultMaterialId,
      thicknessMm: context.clientTemplate.defaultThicknessMm,
      confidence: 0.5,
    };
  }
  
  return null;
}

/**
 * Get edge interpretation using context patterns
 */
export function interpretEdgeNotation(
  notation: string,
  context: LearningContext
): { edges: string[]; grooves: string[] } | null {
  if (!context.enabled) return null;
  
  // Try client template first
  if (context.clientTemplate?.edgeNotation) {
    const templateEdges = context.clientTemplate.edgeNotation[notation];
    if (templateEdges) {
      return { edges: templateEdges, grooves: [] };
    }
  }
  
  if (context.clientTemplate?.grooveNotation) {
    const templateGroove = context.clientTemplate.grooveNotation[notation];
    if (templateGroove) {
      return { edges: [], grooves: [templateGroove] };
    }
  }
  
  // Try learned patterns
  const edgePatterns = context.parserPatterns.get("edge_notation") || [];
  const groovePatterns = context.parserPatterns.get("groove_notation") || [];
  
  const edges: string[] = [];
  const grooves: string[] = [];
  
  for (const pattern of edgePatterns) {
    const regex = new RegExp(`^${escapeRegex(pattern.inputPattern)}$`, "i");
    if (regex.test(notation.trim())) {
      const mapping = pattern.outputMapping as { edges?: string[]; groove?: string };
      if (mapping.edges) edges.push(...mapping.edges);
      if (mapping.groove) grooves.push(mapping.groove);
    }
  }
  
  for (const pattern of groovePatterns) {
    const regex = new RegExp(`^${escapeRegex(pattern.inputPattern)}$`, "i");
    if (regex.test(notation.trim())) {
      const mapping = pattern.outputMapping as { groove?: string };
      if (mapping.groove) grooves.push(mapping.groove);
    }
  }
  
  if (edges.length === 0 && grooves.length === 0) {
    return null;
  }
  
  return { edges: [...new Set(edges)], grooves: [...new Set(grooves)] };
}

/**
 * Merge learning context with another (for combining org + global)
 */
export function mergeLearningContexts(
  base: LearningContext,
  overlay: LearningContext
): LearningContext {
  // Merge material mappings (overlay takes precedence)
  const materialMappings = new Map(base.materialMappings);
  for (const [key, value] of overlay.materialMappings) {
    if (!materialMappings.has(key) || value.confidence > (materialMappings.get(key)?.confidence || 0)) {
      materialMappings.set(key, value);
    }
  }
  
  // Merge parser patterns (higher confidence takes precedence)
  const parserPatterns = new Map<PatternType, ParserPattern[]>();
  
  for (const [type, patterns] of base.parserPatterns) {
    parserPatterns.set(type, [...patterns]);
  }
  
  for (const [type, patterns] of overlay.parserPatterns) {
    const existing = parserPatterns.get(type) || [];
    const merged = [...existing];
    
    for (const pattern of patterns) {
      const existingIdx = merged.findIndex(p => p.inputPattern === pattern.inputPattern);
      if (existingIdx >= 0) {
        if (pattern.confidence > merged[existingIdx].confidence) {
          merged[existingIdx] = pattern;
        }
      } else {
        merged.push(pattern);
      }
    }
    
    // Re-sort by confidence
    merged.sort((a, b) => b.confidence - a.confidence);
    parserPatterns.set(type, merged);
  }
  
  return {
    materialMappings,
    parserPatterns,
    clientTemplate: overlay.clientTemplate || base.clientTemplate,
    organizationId: overlay.organizationId || base.organizationId,
    enabled: base.enabled || overlay.enabled,
  };
}

// ============================================================
// HELPERS
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

