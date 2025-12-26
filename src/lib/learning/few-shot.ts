/**
 * CAI Intake - Few-Shot Learning Module
 * 
 * Select and format training examples for few-shot prompting.
 * Improves AI parsing accuracy by providing relevant examples.
 */

import { getClient } from "@/lib/supabase/client";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export interface TrainingExample {
  id: string;
  organizationId: string | null;
  
  // Source data
  sourceType: "pdf" | "image" | "text" | "csv";
  sourceText: string;
  sourceFileName?: string;
  sourceFileHash?: string;
  
  // Ground truth output
  correctParts: CutPart[];
  correctMetadata?: {
    jobName?: string;
    clientName?: string;
    defaultMaterial?: string;
    defaultThickness?: number;
  };
  
  // Classification
  category?: string;
  difficulty: "easy" | "medium" | "hard";
  clientName?: string;
  
  // Text features for similarity matching
  hasHeaders: boolean;
  columnCount?: number;
  rowCount?: number;
  hasEdgeNotation: boolean;
  hasGrooveNotation: boolean;
  
  // Quality metrics
  usageCount: number;
  successCount: number;
  successRate: number;
  lastUsedAt?: Date;
  
  // Audit
  isActive: boolean;
  createdAt: Date;
}

export interface FewShotSelectionOptions {
  /** Maximum number of examples to select */
  maxExamples?: number;
  /** Prefer examples from this client */
  clientHint?: string;
  /** Prefer examples from this category */
  categoryHint?: string;
  /** Minimum success rate to include */
  minSuccessRate?: number;
  /** Prioritize examples with edge notation */
  needsEdgeExamples?: boolean;
  /** Prioritize examples with groove notation */
  needsGrooveExamples?: boolean;
}

export interface FormattedExample {
  input: string;
  output: string;
  metadata: {
    exampleId: string;
    category?: string;
    clientName?: string;
    difficulty: string;
  };
}

// ============================================================
// EXAMPLE SELECTION
// ============================================================

/**
 * Select the most relevant few-shot examples for a given input
 */
export async function selectFewShotExamples(
  sourceText: string,
  organizationId?: string,
  options: FewShotSelectionOptions = {}
): Promise<TrainingExample[]> {
  const {
    maxExamples = 3,
    clientHint,
    categoryHint,
    minSuccessRate = 0.6,
    needsEdgeExamples,
    needsGrooveExamples,
  } = options;

  const supabase = getClient();
  if (!supabase) return [];

  try {
    // Analyze source text to determine what kind of examples we need
    const textFeatures = analyzeTextFeatures(sourceText);
    
    // Build query
    let query = supabase
      .from("training_examples")
      .select("*")
      .eq("is_active", true)
      .or(`organization_id.eq.${organizationId},organization_id.is.null`);

    // Filter by client if we have a hint
    if (clientHint) {
      query = query.or(`client_name.ilike.%${clientHint}%`);
    }

    // Filter by category if we have a hint
    if (categoryHint) {
      query = query.or(`category.eq.${categoryHint}`);
    }

    // Fetch candidates
    const { data, error } = await query
      .order("success_count", { ascending: false })
      .limit(50); // Get more than we need for ranking

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Map and calculate success rates
    const examples: TrainingExample[] = data.map(mapDbExampleToExample);

    // Score and rank examples
    const scoredExamples = examples
      .filter(ex => calculateSuccessRate(ex) >= minSuccessRate)
      .map(ex => ({
        example: ex,
        score: scoreExample(ex, textFeatures, {
          clientHint,
          categoryHint,
          needsEdgeExamples,
          needsGrooveExamples,
        }),
      }))
      .sort((a, b) => b.score - a.score);

    // Return top examples
    return scoredExamples.slice(0, maxExamples).map(s => s.example);
  } catch (error) {
    console.error("Failed to select few-shot examples:", error);
    return [];
  }
}

/**
 * Score an example based on relevance to the input
 */
function scoreExample(
  example: TrainingExample,
  textFeatures: TextFeatures,
  preferences: {
    clientHint?: string;
    categoryHint?: string;
    needsEdgeExamples?: boolean;
    needsGrooveExamples?: boolean;
  }
): number {
  let score = 0;

  // Base score from success rate (0-30 points)
  score += calculateSuccessRate(example) * 30;

  // Usage count indicates reliability (0-10 points)
  score += Math.min(example.usageCount / 10, 1) * 10;

  // Structure similarity (0-20 points)
  if (example.hasHeaders === textFeatures.hasHeaders) score += 5;
  if (example.columnCount && textFeatures.estimatedColumns) {
    const colDiff = Math.abs(example.columnCount - textFeatures.estimatedColumns);
    score += Math.max(0, 10 - colDiff * 2);
  }
  if (example.rowCount && textFeatures.estimatedRows) {
    const rowDiff = Math.abs(example.rowCount - textFeatures.estimatedRows);
    if (rowDiff < 20) score += 5;
  }

  // Feature matching (0-20 points)
  if (preferences.needsEdgeExamples && example.hasEdgeNotation) score += 10;
  if (preferences.needsGrooveExamples && example.hasGrooveNotation) score += 10;
  if (textFeatures.hasEdgePatterns && example.hasEdgeNotation) score += 5;
  if (textFeatures.hasGroovePatterns && example.hasGrooveNotation) score += 5;

  // Client/category match (0-20 points)
  if (preferences.clientHint && example.clientName?.toLowerCase().includes(preferences.clientHint.toLowerCase())) {
    score += 15;
  }
  if (preferences.categoryHint && example.category === preferences.categoryHint) {
    score += 5;
  }

  // Difficulty match - prefer medium difficulty as most representative
  if (example.difficulty === "medium") score += 5;

  return score;
}

// ============================================================
// TEXT ANALYSIS
// ============================================================

interface TextFeatures {
  hasHeaders: boolean;
  estimatedColumns: number;
  estimatedRows: number;
  hasEdgePatterns: boolean;
  hasGroovePatterns: boolean;
  hasDimensionPatterns: boolean;
  isTabular: boolean;
}

/**
 * Analyze text to extract features for similarity matching
 */
function analyzeTextFeatures(text: string): TextFeatures {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  
  // Check for header patterns
  const headerPatterns = /\b(label|description|name|length|width|height|qty|quantity|material|edge|groove|l1|l2|w1|w2|gl|gw)\b/i;
  const hasHeaders = lines.length > 0 && headerPatterns.test(lines[0]);

  // Estimate columns by looking at consistent separators
  const tabCount = (text.match(/\t/g) || []).length;
  const commaCount = (text.match(/,/g) || []).length;
  const pipeCount = (text.match(/\|/g) || []).length;
  
  let estimatedColumns = 1;
  if (lines.length > 0) {
    const firstDataLine = hasHeaders ? lines[1] : lines[0];
    if (firstDataLine) {
      if (tabCount > lines.length * 2) {
        estimatedColumns = firstDataLine.split("\t").length;
      } else if (commaCount > lines.length * 2) {
        estimatedColumns = firstDataLine.split(",").length;
      } else if (pipeCount > lines.length) {
        estimatedColumns = firstDataLine.split("|").length;
      }
    }
  }

  // Check for edge/groove patterns
  const edgePatterns = /\b(x{1,4}|2l|4l|2w|l1|l2|w1|w2|edge)\b/i;
  const groovePatterns = /\b(gl|gw|groove|grv|dado|rebate|bpg)\b/i;
  const dimensionPatterns = /\d+\s*[xX×]\s*\d+/;

  return {
    hasHeaders,
    estimatedColumns,
    estimatedRows: lines.length,
    hasEdgePatterns: edgePatterns.test(text),
    hasGroovePatterns: groovePatterns.test(text),
    hasDimensionPatterns: dimensionPatterns.test(text),
    isTabular: estimatedColumns > 2 || tabCount > lines.length,
  };
}

// ============================================================
// PROMPT FORMATTING
// ============================================================

/**
 * Format selected examples for inclusion in AI prompts
 */
export function formatExamplesForPrompt(
  examples: TrainingExample[]
): string {
  if (examples.length === 0) return "";

  const formattedExamples = examples.map((ex, idx) => formatSingleExample(ex, idx + 1));
  
  return `
## REFERENCE EXAMPLES

The following are examples of successful parsing. Use them as reference for format and interpretation:

${formattedExamples.join("\n\n---\n\n")}

---

Now parse the INPUT DATA below using the same approach:
`;
}

/**
 * Format a single example for the prompt
 */
function formatSingleExample(example: TrainingExample, index: number): string {
  // Truncate source text if too long (keep first 20 lines)
  const sourceLines = example.sourceText.split("\n").slice(0, 20);
  const truncatedSource = sourceLines.join("\n") + 
    (example.sourceText.split("\n").length > 20 ? "\n... (truncated)" : "");

  // Format output parts (show first 5 parts)
  const outputParts = example.correctParts.slice(0, 5).map(part => ({
    label: part.label,
    L: part.size.L,
    W: part.size.W,
    qty: part.qty,
    material_id: part.material_id,
    ops: part.ops ? summarizeOps(part.ops) : undefined,
  }));

  const outputJson = JSON.stringify(outputParts, null, 2);

  return `### Example ${index}${example.clientName ? ` (${example.clientName})` : ""}

**Input:**
\`\`\`
${truncatedSource}
\`\`\`

**Correct Output (${example.correctParts.length} parts total${outputParts.length < example.correctParts.length ? ", showing first 5" : ""}):**
\`\`\`json
${outputJson}
\`\`\``;
}

/**
 * Summarize operations for display in examples
 */
function summarizeOps(ops: CutPart["ops"]): Record<string, unknown> | undefined {
  if (!ops) return undefined;
  
  const summary: Record<string, unknown> = {};
  
  if (ops.edging) {
    const edges = Object.entries(ops.edging)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    if (edges.length > 0) {
      summary.edging = edges;
    }
  }
  
  if (ops.grooves && ops.grooves.length > 0) {
    summary.grooves = ops.grooves.length;
  }
  
  return Object.keys(summary).length > 0 ? summary : undefined;
}

// ============================================================
// USAGE TRACKING
// ============================================================

/**
 * Record that an example was used and whether parsing was successful
 */
export async function recordExampleUsage(
  exampleId: string,
  success: boolean
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    // Get current values
    const { data: current } = await supabase
      .from("training_examples")
      .select("usage_count, success_count")
      .eq("id", exampleId)
      .single();

    if (current) {
      await supabase
        .from("training_examples")
        .update({
          usage_count: (current.usage_count || 0) + 1,
          success_count: success ? (current.success_count || 0) + 1 : current.success_count,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", exampleId);
    }
  } catch (error) {
    console.error("Failed to record example usage:", error);
  }
}

/**
 * Record usage for multiple examples
 */
export async function recordBatchUsage(
  exampleIds: string[],
  success: boolean
): Promise<void> {
  await Promise.all(exampleIds.map(id => recordExampleUsage(id, success)));
}

// ============================================================
// EXAMPLE MANAGEMENT
// ============================================================

/**
 * Create a new training example from a verified cutlist
 */
export async function createTrainingExample(
  input: {
    organizationId?: string;
    sourceType: "pdf" | "image" | "text" | "csv";
    sourceText: string;
    sourceFileName?: string;
    correctParts: CutPart[];
    correctMetadata?: Record<string, unknown>;
    category?: string;
    difficulty?: "easy" | "medium" | "hard";
    clientName?: string;
    createdById?: string;
  }
): Promise<TrainingExample | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    // Analyze text features
    const features = analyzeTextFeatures(input.sourceText);
    
    // Calculate hash for deduplication
    const sourceHash = await hashText(input.sourceText);

    // Check for duplicate
    const { data: existing } = await supabase
      .from("training_examples")
      .select("id")
      .eq("source_file_hash", sourceHash)
      .single();

    if (existing) {
      console.log("Training example with same content already exists:", existing.id);
      return null;
    }

    const insertData = {
      organization_id: input.organizationId,
      source_type: input.sourceType,
      source_text: input.sourceText,
      source_file_name: input.sourceFileName,
      source_file_hash: sourceHash,
      correct_parts: input.correctParts,
      correct_metadata: input.correctMetadata,
      category: input.category,
      difficulty: input.difficulty || "medium",
      client_name: input.clientName,
      has_headers: features.hasHeaders,
      column_count: features.estimatedColumns,
      row_count: features.estimatedRows,
      has_edge_notation: features.hasEdgePatterns,
      has_groove_notation: features.hasGroovePatterns,
      created_by: input.createdById,
    };

    const { data, error } = await supabase
      .from("training_examples")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return mapDbExampleToExample(data);
  } catch (error) {
    console.error("Failed to create training example:", error);
    return null;
  }
}

/**
 * Get all training examples for an organization
 */
export async function getTrainingExamples(
  organizationId?: string,
  options?: {
    limit?: number;
    offset?: number;
    category?: string;
    clientName?: string;
    includeGlobal?: boolean;
  }
): Promise<TrainingExample[]> {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("training_examples")
      .select("*")
      .eq("is_active", true);

    if (organizationId) {
      if (options?.includeGlobal !== false) {
        query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        query = query.eq("organization_id", organizationId);
      }
    }

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    if (options?.clientName) {
      query = query.ilike("client_name", `%${options.clientName}%`);
    }

    query = query
      .order("success_count", { ascending: false })
      .limit(options?.limit || 100);

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(mapDbExampleToExample);
  } catch (error) {
    console.error("Failed to get training examples:", error);
    return [];
  }
}

/**
 * Delete a training example (soft delete)
 */
export async function deleteTrainingExample(exampleId: string): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("training_examples")
      .update({ is_active: false })
      .eq("id", exampleId);

    return !error;
  } catch (error) {
    console.error("Failed to delete training example:", error);
    return false;
  }
}

// ============================================================
// HELPERS
// ============================================================

function mapDbExampleToExample(data: Record<string, unknown>): TrainingExample {
  const usageCount = (data.usage_count as number) || 0;
  const successCount = (data.success_count as number) || 0;
  
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | null,
    sourceType: data.source_type as TrainingExample["sourceType"],
    sourceText: data.source_text as string,
    sourceFileName: data.source_file_name as string | undefined,
    sourceFileHash: data.source_file_hash as string | undefined,
    correctParts: data.correct_parts as CutPart[],
    correctMetadata: data.correct_metadata as TrainingExample["correctMetadata"],
    category: data.category as string | undefined,
    difficulty: (data.difficulty as TrainingExample["difficulty"]) || "medium",
    clientName: data.client_name as string | undefined,
    hasHeaders: (data.has_headers as boolean) ?? true,
    columnCount: data.column_count as number | undefined,
    rowCount: data.row_count as number | undefined,
    hasEdgeNotation: (data.has_edge_notation as boolean) ?? false,
    hasGrooveNotation: (data.has_groove_notation as boolean) ?? false,
    usageCount,
    successCount,
    successRate: usageCount > 0 ? successCount / usageCount : 0,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : undefined,
    isActive: (data.is_active as boolean) ?? true,
    createdAt: new Date(data.created_at as string),
  };
}

function calculateSuccessRate(example: TrainingExample): number {
  if (example.usageCount === 0) return 0.5; // Default for unused examples
  return example.successCount / example.usageCount;
}

async function hashText(text: string): Promise<string> {
  // Simple hash for deduplication
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// EXPORTS
// ============================================================

export {
  analyzeTextFeatures,
  type TextFeatures,
};

