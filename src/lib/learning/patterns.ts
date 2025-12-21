/**
 * CAI Intake - Pattern Learning
 * 
 * Learn and apply parser patterns from user corrections.
 */

import { getClient } from "@/lib/supabase/client";
import type { 
  ParserPattern, 
  PatternType, 
  EdgeNotationMapping,
  DimensionFormatMapping,
  QuantityFormatMapping,
} from "./types";

// ============================================================
// PATTERN RETRIEVAL
// ============================================================

/**
 * Get all parser patterns for an organization (including global patterns)
 */
export async function getParserPatterns(
  organizationId?: string
): Promise<ParserPattern[]> {
  const supabase = getClient();
  if (!supabase) return getDefaultPatterns();

  try {
    // Get both org-specific and global patterns
    const { data, error } = await supabase
      .from("parser_patterns")
      .select("*")
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("confidence", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDbPatternToPattern);
  } catch (error) {
    console.error("Failed to fetch parser patterns:", error);
    return getDefaultPatterns();
  }
}

/**
 * Get patterns by type
 */
export async function getPatternsByType(
  patternType: PatternType,
  organizationId?: string
): Promise<ParserPattern[]> {
  const supabase = getClient();
  if (!supabase) return getDefaultPatterns().filter(p => p.patternType === patternType);

  try {
    const { data, error } = await supabase
      .from("parser_patterns")
      .select("*")
      .eq("pattern_type", patternType)
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("confidence", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDbPatternToPattern);
  } catch (error) {
    console.error("Failed to fetch patterns by type:", error);
    return getDefaultPatterns().filter(p => p.patternType === patternType);
  }
}

// ============================================================
// PATTERN CREATION & UPDATE
// ============================================================

/**
 * Create or update a parser pattern
 */
export async function upsertPattern(
  pattern: Omit<ParserPattern, "id" | "usageCount" | "successCount" | "lastUsedAt">,
  organizationId?: string
): Promise<ParserPattern | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const insertData = {
      organization_id: organizationId,
      pattern_type: pattern.patternType,
      input_pattern: pattern.inputPattern,
      output_mapping: pattern.outputMapping,
      description: pattern.description,
      confidence: pattern.confidence,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("parser_patterns")
      .upsert(insertData, {
        onConflict: "organization_id,pattern_type,input_pattern",
      })
      .select()
      .single();

    if (error) throw error;

    return mapDbPatternToPattern(data);
  } catch (error) {
    console.error("Failed to upsert pattern:", error);
    return null;
  }
}

/**
 * Record pattern usage (success or failure)
 */
export async function recordPatternUsage(
  patternId: string,
  success: boolean
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    // Try RPC first, but fall back to manual update if RPC doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("increment_pattern_usage", {
      p_id: patternId,
      p_success: success,
    });
  } catch {
    // Fallback to manual update
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase as any)
        .from("parser_patterns")
        .select("usage_count, success_count")
        .eq("id", patternId)
        .single();

      if (current) {
        const typedCurrent = current as Record<string, number>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("parser_patterns")
          .update({
            usage_count: (typedCurrent.usage_count || 0) + 1,
            success_count: success ? (typedCurrent.success_count || 0) + 1 : typedCurrent.success_count,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", patternId);
      }
    } catch (updateError) {
      console.error("Failed to record pattern usage:", updateError);
    }
  }
}

// ============================================================
// PATTERN APPLICATION
// ============================================================

/**
 * Apply edge notation patterns to parse edge marks
 */
export function applyEdgeNotation(
  text: string,
  patterns: ParserPattern[]
): { edges: string[]; grooves: string[] } | null {
  const edgePatterns = patterns.filter(p => p.patternType === "edge_notation");
  const edges: string[] = [];
  const grooves: string[] = [];

  for (const pattern of edgePatterns) {
    const regex = new RegExp(`^${escapeRegex(pattern.inputPattern)}$`, "i");
    if (regex.test(text.trim())) {
      const mapping = pattern.outputMapping as EdgeNotationMapping;
      if (mapping.edges) {
        edges.push(...mapping.edges);
      }
      if (mapping.groove) {
        grooves.push(mapping.groove);
      }
    }
  }

  if (edges.length === 0 && grooves.length === 0) {
    return null;
  }

  return { edges: [...new Set(edges)], grooves: [...new Set(grooves)] };
}

/**
 * Apply dimension format patterns
 */
export function applyDimensionFormat(
  text: string,
  patterns: ParserPattern[]
): { L: number; W: number; T?: number } | null {
  const dimPatterns = patterns.filter(p => p.patternType === "dimension_format");

  for (const pattern of dimPatterns) {
    const regex = new RegExp(pattern.inputPattern, "i");
    const match = text.match(regex);
    
    if (match && match.length >= 3) {
      const mapping = pattern.outputMapping as unknown as DimensionFormatMapping;
      const values = match.slice(1).map(Number).filter(n => !isNaN(n) && n > 0);
      
      if (values.length >= 2 && mapping.order) {
        if (mapping.order === "LxW" || mapping.order === "LxWxT") {
          return {
            L: Math.max(values[0], values[1]),
            W: Math.min(values[0], values[1]),
            T: values[2],
          };
        } else if (mapping.order === "WxL") {
          return {
            L: Math.max(values[0], values[1]),
            W: Math.min(values[0], values[1]),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Apply quantity format patterns
 */
export function applyQuantityFormat(
  text: string,
  patterns: ParserPattern[]
): number | null {
  const qtyPatterns = patterns.filter(p => p.patternType === "quantity_format");

  for (const pattern of qtyPatterns) {
    const regex = new RegExp(pattern.inputPattern, "i");
    const match = text.match(regex);
    
    if (match && match[1]) {
      const qty = parseInt(match[1], 10);
      if (!isNaN(qty) && qty > 0) {
        return qty;
      }
    }
  }

  return null;
}

// ============================================================
// DEFAULT PATTERNS
// ============================================================

/**
 * Get default patterns (used as fallback when DB is unavailable)
 */
export function getDefaultPatterns(): ParserPattern[] {
  return [
    // Edge notation patterns
    {
      id: "default-edge-x",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "X",
      outputMapping: { edges: ["L1"] },
      description: "Single X = edge on L1 (long side)",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-edge-xx",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "XX",
      outputMapping: { edges: ["W1", "W2"] },
      description: "Double X = edges on both W sides",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-groove-x",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "x",
      outputMapping: { groove: "W2" },
      description: "Lowercase x = groove (back panel)",
      confidence: 0.85,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-edge-4l",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "4L",
      outputMapping: { edges: ["L1", "L2", "W1", "W2"] },
      description: "4L = all four edges",
      confidence: 0.95,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-edge-2l",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "2L",
      outputMapping: { edges: ["L1", "L2"] },
      description: "2L = both long edges",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-edge-2w",
      organizationId: null,
      patternType: "edge_notation",
      inputPattern: "2W",
      outputMapping: { edges: ["W1", "W2"] },
      description: "2W = both short edges",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    // Dimension format patterns
    {
      id: "default-dim-lxw",
      organizationId: null,
      patternType: "dimension_format",
      inputPattern: "(\\d+)\\s*[xX×]\\s*(\\d+)",
      outputMapping: { order: "LxW", separator: "x" },
      description: "Standard LxW format",
      confidence: 0.95,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-dim-lxwxt",
      organizationId: null,
      patternType: "dimension_format",
      inputPattern: "(\\d+)\\s*[xX×]\\s*(\\d+)\\s*[xX×]\\s*(\\d+)",
      outputMapping: { order: "LxWxT", separator: "x" },
      description: "LxWxT with thickness",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    // Quantity format patterns
    {
      id: "default-qty-x",
      organizationId: null,
      patternType: "quantity_format",
      inputPattern: "[xX](\\d+)",
      outputMapping: { prefix: "x" },
      description: "Quantity as x5, X10",
      confidence: 0.9,
      usageCount: 0,
      successCount: 0,
    },
    {
      id: "default-qty-pcs",
      organizationId: null,
      patternType: "quantity_format",
      inputPattern: "(\\d+)\\s*(?:pcs?|pieces?|qty)",
      outputMapping: { suffix: "pcs" },
      description: "Quantity with pcs suffix",
      confidence: 0.85,
      usageCount: 0,
      successCount: 0,
    },
  ];
}

// ============================================================
// HELPERS
// ============================================================

function mapDbPatternToPattern(data: Record<string, unknown>): ParserPattern {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | null,
    patternType: data.pattern_type as PatternType,
    inputPattern: data.input_pattern as string,
    outputMapping: data.output_mapping as Record<string, unknown>,
    description: data.description as string | undefined,
    confidence: data.confidence as number,
    usageCount: data.usage_count as number,
    successCount: data.success_count as number,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : undefined,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

