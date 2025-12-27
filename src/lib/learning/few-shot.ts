/**
 * CAI Intake - Few-Shot Learning Module
 * 
 * Select and format training examples for few-shot prompting.
 * Improves AI parsing accuracy by providing relevant examples.
 */

import { getClient } from "@/lib/supabase/client";
import { prisma } from "@/lib/db";
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

  try {
    // Analyze source text to determine what kind of examples we need
    const textFeatures = analyzeTextFeatures(sourceText);
    
    // Build where clause for Prisma
    const whereClause: {
      isActive: boolean;
      OR: Array<{ organizationId: string | null } | { clientName?: { contains: string; mode: "insensitive" } } | { category?: string }>;
    } = {
      isActive: true,
      OR: [
        { organizationId: organizationId || null },
        { organizationId: null },
      ],
    };

    // Add client hint filter
    if (clientHint) {
      whereClause.OR.push({ clientName: { contains: clientHint, mode: "insensitive" } });
    }

    // Add category hint filter
    if (categoryHint) {
      whereClause.OR.push({ category: categoryHint });
    }

    // Fetch candidates
    const data = await prisma.trainingExample.findMany({
      where: whereClause,
      orderBy: { successCount: "desc" },
      take: 50,
    });

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
  try {
    // Get current values
    const current = await prisma.trainingExample.findUnique({
      where: { id: exampleId },
      select: { usageCount: true, successCount: true },
    });

    if (current) {
      await prisma.trainingExample.update({
        where: { id: exampleId },
        data: {
          usageCount: (current.usageCount || 0) + 1,
          successCount: success ? (current.successCount || 0) + 1 : current.successCount,
          lastUsedAt: new Date(),
        },
      });
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
  try {
    // Analyze text features
    const features = analyzeTextFeatures(input.sourceText);
    
    // Calculate hash for deduplication
    const sourceHash = await hashText(input.sourceText);

    // Check for duplicate
    const existing = await prisma.trainingExample.findFirst({
      where: { sourceFileHash: sourceHash },
      select: { id: true },
    });

    if (existing) {
      console.log("Training example with same content already exists:", existing.id);
      return null;
    }

    const data = await prisma.trainingExample.create({
      data: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceText: input.sourceText,
        sourceFileName: input.sourceFileName,
        sourceFileHash: sourceHash,
        correctParts: input.correctParts as object[],
        correctMetadata: input.correctMetadata as object,
        category: input.category,
        difficulty: input.difficulty || "medium",
        clientName: input.clientName,
        hasHeaders: features.hasHeaders,
        columnCount: features.estimatedColumns,
        rowCount: features.estimatedRows,
        hasEdgeNotation: features.hasEdgePatterns,
        hasGrooveNotation: features.hasGroovePatterns,
        createdBy: input.createdById,
      },
    });

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
  try {
    // Build where clause
    type WhereClause = {
      isActive: boolean;
      OR?: Array<{ organizationId: string | null }>;
      organizationId?: string;
      category?: string;
      clientName?: { contains: string; mode: "insensitive" };
    };

    const whereClause: WhereClause = {
      isActive: true,
    };

    if (organizationId) {
      if (options?.includeGlobal !== false) {
        whereClause.OR = [
          { organizationId: organizationId },
          { organizationId: null },
        ];
      } else {
        whereClause.organizationId = organizationId;
      }
    }

    if (options?.category) {
      whereClause.category = options.category;
    }

    if (options?.clientName) {
      whereClause.clientName = { contains: options.clientName, mode: "insensitive" };
    }

    const data = await prisma.trainingExample.findMany({
      where: whereClause,
      orderBy: { successCount: "desc" },
      take: options?.limit || 100,
      skip: options?.offset,
    });

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
  try {
    await prisma.trainingExample.update({
      where: { id: exampleId },
      data: { isActive: false },
    });

    return true;
  } catch (error) {
    console.error("Failed to delete training example:", error);
    return false;
  }
}

// ============================================================
// HELPERS
// ============================================================

function mapDbExampleToExample(data: Record<string, unknown>): TrainingExample {
  // Support both snake_case (Supabase) and camelCase (Prisma) keys
  const usageCount = (data.usageCount ?? data.usage_count ?? 0) as number;
  const successCount = (data.successCount ?? data.success_count ?? 0) as number;
  
  return {
    id: data.id as string,
    organizationId: (data.organizationId ?? data.organization_id ?? null) as string | null,
    sourceType: (data.sourceType ?? data.source_type) as TrainingExample["sourceType"],
    sourceText: (data.sourceText ?? data.source_text) as string,
    sourceFileName: (data.sourceFileName ?? data.source_file_name) as string | undefined,
    sourceFileHash: (data.sourceFileHash ?? data.source_file_hash) as string | undefined,
    correctParts: (data.correctParts ?? data.correct_parts) as CutPart[],
    correctMetadata: (data.correctMetadata ?? data.correct_metadata) as TrainingExample["correctMetadata"],
    category: data.category as string | undefined,
    difficulty: ((data.difficulty as TrainingExample["difficulty"]) || "medium"),
    clientName: (data.clientName ?? data.client_name) as string | undefined,
    hasHeaders: ((data.hasHeaders ?? data.has_headers) as boolean) ?? true,
    columnCount: (data.columnCount ?? data.column_count) as number | undefined,
    rowCount: (data.rowCount ?? data.row_count) as number | undefined,
    hasEdgeNotation: ((data.hasEdgeNotation ?? data.has_edge_notation) as boolean) ?? false,
    hasGrooveNotation: ((data.hasGrooveNotation ?? data.has_groove_notation) as boolean) ?? false,
    usageCount,
    successCount,
    successRate: usageCount > 0 ? successCount / usageCount : 0,
    lastUsedAt: (data.lastUsedAt ?? data.last_used_at) 
      ? new Date((data.lastUsedAt ?? data.last_used_at) as string | Date) 
      : undefined,
    isActive: ((data.isActive ?? data.is_active) as boolean) ?? true,
    createdAt: new Date((data.createdAt ?? data.created_at) as string | Date),
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

