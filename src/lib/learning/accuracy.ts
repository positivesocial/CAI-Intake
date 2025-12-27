/**
 * CAI Intake - Parsing Accuracy Tracking
 * 
 * Track, analyze, and report on parsing accuracy over time.
 * Helps identify weak areas and measure improvement.
 */

import { getClient } from "@/lib/supabase/client";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export interface AccuracyMetrics {
  totalParts: number;
  correctParts: number;
  accuracy: number;
  
  // Per-field breakdown
  dimensionAccuracy: number;
  materialAccuracy: number;
  edgingAccuracy: number;
  groovingAccuracy: number;
  quantityAccuracy: number;
  labelAccuracy: number;
}

export interface AccuracyLogEntry {
  id?: string;
  organizationId?: string;
  parseJobId?: string;
  provider: "claude" | "gpt" | "python_ocr" | "pdf-parse";
  sourceType?: "pdf" | "image" | "text";
  
  // Metrics
  totalParts: number;
  correctParts: number;
  accuracy: number;
  
  // Detailed breakdown
  dimensionAccuracy?: number;
  materialAccuracy?: number;
  edgingAccuracy?: number;
  groovingAccuracy?: number;
  quantityAccuracy?: number;
  labelAccuracy?: number;
  
  // What helped
  fewShotExamplesUsed: number;
  patternsApplied: number;
  clientTemplateUsed: boolean;
  
  // Context
  documentDifficulty?: "easy" | "medium" | "hard";
  clientName?: string;
  
  createdAt?: Date;
}

export interface AccuracyTrend {
  date: string;
  accuracy: number;
  partsProcessed: number;
  provider?: string;
}

export interface AccuracyBreakdown {
  category: string;
  accuracy: number;
  count: number;
  trend: "improving" | "stable" | "declining";
}

export interface WeakArea {
  field: string;
  accuracy: number;
  sampleSize: number;
  suggestions: string[];
}

// ============================================================
// ACCURACY CALCULATION
// ============================================================

/**
 * Compare parsed parts to ground truth and calculate accuracy metrics
 */
export function calculateAccuracyMetrics(
  parsedParts: CutPart[],
  groundTruthParts: CutPart[]
): AccuracyMetrics {
  if (groundTruthParts.length === 0) {
    return {
      totalParts: 0,
      correctParts: 0,
      accuracy: 0,
      dimensionAccuracy: 0,
      materialAccuracy: 0,
      edgingAccuracy: 0,
      groovingAccuracy: 0,
      quantityAccuracy: 0,
      labelAccuracy: 0,
    };
  }

  let correctParts = 0;
  let dimensionCorrect = 0;
  let materialCorrect = 0;
  let edgingCorrect = 0;
  let groovingCorrect = 0;
  let quantityCorrect = 0;
  let labelCorrect = 0;

  // Match parsed parts to ground truth (by best match)
  const matchedPairs = matchParts(parsedParts, groundTruthParts);

  for (const { parsed, truth } of matchedPairs) {
    if (!parsed || !truth) continue;

    // Check each field
    const dimMatch = checkDimensionsMatch(parsed, truth);
    const matMatch = checkMaterialMatch(parsed, truth);
    const edgeMatch = checkEdgingMatch(parsed, truth);
    const grooveMatch = checkGroovingMatch(parsed, truth);
    const qtyMatch = checkQuantityMatch(parsed, truth);
    const labelMatch = checkLabelMatch(parsed, truth);

    if (dimMatch) dimensionCorrect++;
    if (matMatch) materialCorrect++;
    if (edgeMatch) edgingCorrect++;
    if (grooveMatch) groovingCorrect++;
    if (qtyMatch) quantityCorrect++;
    if (labelMatch) labelCorrect++;

    // Part is correct if all core fields match
    if (dimMatch && matMatch && qtyMatch) {
      correctParts++;
    }
  }

  const total = groundTruthParts.length;
  const matched = matchedPairs.filter(p => p.parsed && p.truth).length;

  return {
    totalParts: total,
    correctParts,
    accuracy: total > 0 ? correctParts / total : 0,
    dimensionAccuracy: matched > 0 ? dimensionCorrect / matched : 0,
    materialAccuracy: matched > 0 ? materialCorrect / matched : 0,
    edgingAccuracy: matched > 0 ? edgingCorrect / matched : 0,
    groovingAccuracy: matched > 0 ? groovingCorrect / matched : 0,
    quantityAccuracy: matched > 0 ? quantityCorrect / matched : 0,
    labelAccuracy: matched > 0 ? labelCorrect / matched : 0,
  };
}

/**
 * Match parsed parts to ground truth parts
 * Uses dimensions and label similarity to find best matches
 */
function matchParts(
  parsedParts: CutPart[],
  groundTruthParts: CutPart[]
): Array<{ parsed?: CutPart; truth?: CutPart }> {
  const results: Array<{ parsed?: CutPart; truth?: CutPart }> = [];
  const usedParsed = new Set<number>();
  const usedTruth = new Set<number>();

  // First pass: exact dimension matches
  for (let ti = 0; ti < groundTruthParts.length; ti++) {
    const truth = groundTruthParts[ti];
    
    for (let pi = 0; pi < parsedParts.length; pi++) {
      if (usedParsed.has(pi)) continue;
      
      const parsed = parsedParts[pi];
      
      // Exact dimension match
      if (
        parsed.size.L === truth.size.L &&
        parsed.size.W === truth.size.W
      ) {
        results.push({ parsed, truth });
        usedParsed.add(pi);
        usedTruth.add(ti);
        break;
      }
    }
  }

  // Second pass: close dimension matches (within 2mm tolerance)
  for (let ti = 0; ti < groundTruthParts.length; ti++) {
    if (usedTruth.has(ti)) continue;
    const truth = groundTruthParts[ti];
    
    let bestMatch = -1;
    let bestScore = 0;
    
    for (let pi = 0; pi < parsedParts.length; pi++) {
      if (usedParsed.has(pi)) continue;
      
      const parsed = parsedParts[pi];
      const score = calculateMatchScore(parsed, truth);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pi;
      }
    }
    
    if (bestMatch >= 0 && bestScore > 0.5) {
      results.push({ parsed: parsedParts[bestMatch], truth });
      usedParsed.add(bestMatch);
      usedTruth.add(ti);
    } else {
      // No match found for this truth part
      results.push({ truth });
    }
  }

  // Add any unmatched parsed parts (extra parts)
  for (let pi = 0; pi < parsedParts.length; pi++) {
    if (!usedParsed.has(pi)) {
      results.push({ parsed: parsedParts[pi] });
    }
  }

  return results;
}

function calculateMatchScore(parsed: CutPart, truth: CutPart): number {
  let score = 0;
  
  // Dimension similarity (0-0.5)
  const dimTolerance = 2; // mm
  const lDiff = Math.abs(parsed.size.L - truth.size.L);
  const wDiff = Math.abs(parsed.size.W - truth.size.W);
  
  if (lDiff <= dimTolerance && wDiff <= dimTolerance) {
    score += 0.5;
  } else if (lDiff <= 10 && wDiff <= 10) {
    score += 0.3;
  }
  
  // Label similarity (0-0.3)
  if (parsed.label && truth.label) {
    const similarity = calculateStringSimilarity(parsed.label, truth.label);
    score += similarity * 0.3;
  }
  
  // Quantity match (0-0.2)
  if (parsed.qty === truth.qty) {
    score += 0.2;
  }
  
  return score;
}

// ============================================================
// FIELD COMPARISON HELPERS
// ============================================================

function checkDimensionsMatch(parsed: CutPart, truth: CutPart): boolean {
  const tolerance = 2; // mm
  return (
    Math.abs(parsed.size.L - truth.size.L) <= tolerance &&
    Math.abs(parsed.size.W - truth.size.W) <= tolerance
  );
}

function checkMaterialMatch(parsed: CutPart, truth: CutPart): boolean {
  if (!parsed.material_id && !truth.material_id) return true;
  if (!parsed.material_id || !truth.material_id) return false;
  
  return (
    parsed.material_id === truth.material_id ||
    parsed.material_id.toLowerCase() === truth.material_id.toLowerCase()
  );
}

function checkEdgingMatch(parsed: CutPart, truth: CutPart): boolean {
  const parsedEdges = getEdgeArray(parsed.ops);
  const truthEdges = getEdgeArray(truth.ops);
  
  if (parsedEdges.length !== truthEdges.length) return false;
  
  const sortedParsed = [...parsedEdges].sort();
  const sortedTruth = [...truthEdges].sort();
  
  return sortedParsed.every((e, i) => e === sortedTruth[i]);
}

function checkGroovingMatch(parsed: CutPart, truth: CutPart): boolean {
  const parsedGrooves = parsed.ops?.grooves || [];
  const truthGrooves = truth.ops?.grooves || [];
  
  // Simple check: same number of grooves
  if (parsedGrooves.length !== truthGrooves.length) return false;
  
  // If both have no grooves, match
  if (parsedGrooves.length === 0 && truthGrooves.length === 0) return true;
  
  // Check groove directions match
  const parsedDirs = new Set(parsedGrooves.map(g => g.side));
  const truthDirs = new Set(truthGrooves.map(g => g.side));
  
  if (parsedDirs.size !== truthDirs.size) return false;
  
  for (const dir of parsedDirs) {
    if (!truthDirs.has(dir)) return false;
  }
  
  return true;
}

function checkQuantityMatch(parsed: CutPart, truth: CutPart): boolean {
  return parsed.qty === truth.qty;
}

function checkLabelMatch(parsed: CutPart, truth: CutPart): boolean {
  if (!parsed.label && !truth.label) return true;
  if (!parsed.label || !truth.label) return false;
  
  const similarity = calculateStringSimilarity(parsed.label, truth.label);
  return similarity > 0.8;
}

function getEdgeArray(ops: CutPart["ops"] | undefined): string[] {
  if (!ops?.edging?.edges) return [];
  
  const edges: string[] = [];
  const e = ops.edging.edges;
  if (e.L1?.apply) edges.push("L1");
  if (e.L2?.apply) edges.push("L2");
  if (e.W1?.apply) edges.push("W1");
  if (e.W2?.apply) edges.push("W2");
  
  return edges;
}

function calculateStringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  
  // Simple Levenshtein-based similarity
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(aLower, bLower);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// ============================================================
// LOGGING
// ============================================================

/**
 * Log parsing accuracy to the database
 */
export async function logParsingAccuracy(
  entry: Omit<AccuracyLogEntry, "id" | "createdAt">
): Promise<AccuracyLogEntry | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const insertData = {
      organization_id: entry.organizationId,
      parse_job_id: entry.parseJobId,
      provider: entry.provider,
      source_type: entry.sourceType,
      total_parts: entry.totalParts,
      correct_parts: entry.correctParts,
      accuracy: entry.accuracy,
      dimension_accuracy: entry.dimensionAccuracy,
      material_accuracy: entry.materialAccuracy,
      edging_accuracy: entry.edgingAccuracy,
      grooving_accuracy: entry.groovingAccuracy,
      quantity_accuracy: entry.quantityAccuracy,
      label_accuracy: entry.labelAccuracy,
      few_shot_examples_used: entry.fewShotExamplesUsed,
      patterns_applied: entry.patternsApplied,
      client_template_used: entry.clientTemplateUsed,
      document_difficulty: entry.documentDifficulty,
      client_name: entry.clientName,
    };

    const { data, error } = await supabase
      .from("parsing_accuracy_logs")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return mapDbLogToEntry(data);
  } catch (error) {
    console.error("Failed to log parsing accuracy:", error);
    return null;
  }
}

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get accuracy trends over time
 */
export async function getAccuracyTrends(
  organizationId?: string,
  options?: {
    days?: number;
    provider?: string;
    groupBy?: "day" | "week" | "month";
  }
): Promise<AccuracyTrend[]> {
  const supabase = getClient();
  if (!supabase) return [];

  const days = options?.days || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    let query = supabase
      .from("parsing_accuracy_logs")
      .select("accuracy, total_parts, provider, created_at")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    if (options?.provider) {
      query = query.eq("provider", options.provider);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Group by date
    const grouped = new Map<string, { accuracy: number[]; parts: number }>();
    
    for (const row of data) {
      const date = new Date(row.created_at).toISOString().split("T")[0];
      const existing = grouped.get(date) || { accuracy: [], parts: 0 };
      existing.accuracy.push(row.accuracy);
      existing.parts += row.total_parts;
      grouped.set(date, existing);
    }

    return Array.from(grouped.entries()).map(([date, { accuracy, parts }]) => ({
      date,
      accuracy: accuracy.reduce((a, b) => a + b, 0) / accuracy.length,
      partsProcessed: parts,
    }));
  } catch (error) {
    console.error("Failed to get accuracy trends:", error);
    return [];
  }
}

/**
 * Get accuracy breakdown by category
 */
export async function getAccuracyByCategory(
  organizationId?: string,
  options?: { field?: string }
): Promise<AccuracyBreakdown[]> {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("parsing_accuracy_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Group by provider and calculate averages
    const byProvider = new Map<string, { accuracies: number[]; count: number }>();
    
    for (const row of data) {
      const provider = row.provider || "unknown";
      const existing = byProvider.get(provider) || { accuracies: [], count: 0 };
      existing.accuracies.push(row.accuracy);
      existing.count++;
      byProvider.set(provider, existing);
    }

    return Array.from(byProvider.entries()).map(([category, { accuracies, count }]) => {
      const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      
      // Calculate trend (compare first half to second half)
      const midpoint = Math.floor(accuracies.length / 2);
      const firstHalf = accuracies.slice(0, midpoint);
      const secondHalf = accuracies.slice(midpoint);
      
      const firstAvg = firstHalf.length > 0 
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length 
        : 0;
      const secondAvg = secondHalf.length > 0 
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length 
        : 0;
      
      let trend: "improving" | "stable" | "declining" = "stable";
      if (secondAvg > firstAvg + 0.05) trend = "improving";
      else if (secondAvg < firstAvg - 0.05) trend = "declining";
      
      return {
        category,
        accuracy: avgAccuracy,
        count,
        trend,
      };
    });
  } catch (error) {
    console.error("Failed to get accuracy by category:", error);
    return [];
  }
}

/**
 * Identify areas needing improvement
 */
export async function identifyWeakAreas(
  organizationId?: string
): Promise<WeakArea[]> {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("parsing_accuracy_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Calculate averages for each field
    const fields = [
      { key: "dimension_accuracy", name: "Dimensions" },
      { key: "material_accuracy", name: "Materials" },
      { key: "edging_accuracy", name: "Edge Banding" },
      { key: "grooving_accuracy", name: "Grooving" },
      { key: "quantity_accuracy", name: "Quantities" },
      { key: "label_accuracy", name: "Labels" },
    ];

    const weakAreas: WeakArea[] = [];

    for (const field of fields) {
      const values = data
        .map(row => row[field.key])
        .filter((v): v is number => v != null);
      
      if (values.length === 0) continue;
      
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Consider it weak if below 90% accuracy
      if (avg < 0.9) {
        weakAreas.push({
          field: field.name,
          accuracy: avg,
          sampleSize: values.length,
          suggestions: getSuggestionsForField(field.name, avg),
        });
      }
    }

    // Sort by accuracy (worst first)
    return weakAreas.sort((a, b) => a.accuracy - b.accuracy);
  } catch (error) {
    console.error("Failed to identify weak areas:", error);
    return [];
  }
}

function getSuggestionsForField(field: string, accuracy: number): string[] {
  const suggestions: string[] = [];
  
  switch (field) {
    case "Dimensions":
      suggestions.push("Add more training examples with varied dimension formats");
      if (accuracy < 0.7) {
        suggestions.push("Check if dimension columns are being confused with other data");
      }
      break;
      
    case "Materials":
      suggestions.push("Add material mappings for commonly misidentified codes");
      suggestions.push("Consider adding more material alias patterns");
      break;
      
    case "Edge Banding":
      suggestions.push("Review edge notation patterns in client templates");
      suggestions.push("Add examples showing different edge marking systems");
      if (accuracy < 0.7) {
        suggestions.push("Check if uppercase X vs lowercase x confusion is occurring");
      }
      break;
      
    case "Grooving":
      suggestions.push("Add more examples with groove notation");
      suggestions.push("Review GL/GW column detection patterns");
      break;
      
    case "Quantities":
      suggestions.push("Check for quantity notation patterns like 'x2', '2pcs', '(2)'");
      break;
      
    case "Labels":
      suggestions.push("Ensure label column is correctly identified");
      suggestions.push("Add training examples with varied label formats");
      break;
  }
  
  return suggestions;
}

/**
 * Get summary statistics
 */
export async function getAccuracySummary(
  organizationId?: string
): Promise<{
  overallAccuracy: number;
  totalPartsProcessed: number;
  totalDocuments: number;
  weakestField: string;
  strongestField: string;
  recentTrend: "improving" | "stable" | "declining";
}> {
  const supabase = getClient();
  if (!supabase) {
    return {
      overallAccuracy: 0,
      totalPartsProcessed: 0,
      totalDocuments: 0,
      weakestField: "unknown",
      strongestField: "unknown",
      recentTrend: "stable",
    };
  }

  try {
    let query = supabase
      .from("parsing_accuracy_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        overallAccuracy: 0,
        totalPartsProcessed: 0,
        totalDocuments: 0,
        weakestField: "unknown",
        strongestField: "unknown",
        recentTrend: "stable",
      };
    }

    // Calculate overall accuracy
    const totalAccuracy = data.reduce((sum, row) => sum + row.accuracy, 0);
    const overallAccuracy = totalAccuracy / data.length;

    // Calculate total parts
    const totalPartsProcessed = data.reduce((sum, row) => sum + row.total_parts, 0);

    // Calculate field averages
    const fieldAverages: Record<string, number> = {};
    const fields = ["dimension", "material", "edging", "grooving", "quantity", "label"];
    
    for (const field of fields) {
      const key = `${field}_accuracy`;
      const values = data.map(row => row[key]).filter((v): v is number => v != null);
      if (values.length > 0) {
        fieldAverages[field] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    // Find weakest and strongest
    const sortedFields = Object.entries(fieldAverages).sort((a, b) => a[1] - b[1]);
    const weakestField = sortedFields[0]?.[0] || "unknown";
    const strongestField = sortedFields[sortedFields.length - 1]?.[0] || "unknown";

    // Calculate trend
    const midpoint = Math.floor(data.length / 2);
    const recentData = data.slice(0, midpoint);
    const olderData = data.slice(midpoint);
    
    const recentAvg = recentData.length > 0 
      ? recentData.reduce((sum, row) => sum + row.accuracy, 0) / recentData.length 
      : 0;
    const olderAvg = olderData.length > 0 
      ? olderData.reduce((sum, row) => sum + row.accuracy, 0) / olderData.length 
      : 0;
    
    let recentTrend: "improving" | "stable" | "declining" = "stable";
    if (recentAvg > olderAvg + 0.03) recentTrend = "improving";
    else if (recentAvg < olderAvg - 0.03) recentTrend = "declining";

    return {
      overallAccuracy,
      totalPartsProcessed,
      totalDocuments: data.length,
      weakestField,
      strongestField,
      recentTrend,
    };
  } catch (error) {
    console.error("Failed to get accuracy summary:", error);
    return {
      overallAccuracy: 0,
      totalPartsProcessed: 0,
      totalDocuments: 0,
      weakestField: "unknown",
      strongestField: "unknown",
      recentTrend: "stable",
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

function mapDbLogToEntry(data: Record<string, unknown>): AccuracyLogEntry {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | undefined,
    parseJobId: data.parse_job_id as string | undefined,
    provider: data.provider as AccuracyLogEntry["provider"],
    sourceType: data.source_type as AccuracyLogEntry["sourceType"],
    totalParts: data.total_parts as number,
    correctParts: data.correct_parts as number,
    accuracy: data.accuracy as number,
    dimensionAccuracy: data.dimension_accuracy as number | undefined,
    materialAccuracy: data.material_accuracy as number | undefined,
    edgingAccuracy: data.edging_accuracy as number | undefined,
    groovingAccuracy: data.grooving_accuracy as number | undefined,
    quantityAccuracy: data.quantity_accuracy as number | undefined,
    labelAccuracy: data.label_accuracy as number | undefined,
    fewShotExamplesUsed: data.few_shot_examples_used as number,
    patternsApplied: data.patterns_applied as number,
    clientTemplateUsed: data.client_template_used as boolean,
    documentDifficulty: data.document_difficulty as AccuracyLogEntry["documentDifficulty"],
    clientName: data.client_name as string | undefined,
    createdAt: data.created_at ? new Date(data.created_at as string) : undefined,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  calculateAccuracyMetrics as calculateMetrics,
};

