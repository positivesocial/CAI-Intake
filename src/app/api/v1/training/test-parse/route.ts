/**
 * CAI Intake - Test Parse API
 * 
 * POST /api/v1/training/test-parse - Test parsing against ground truth
 * 
 * Useful for evaluating how well the system parses specific examples.
 * NOTE: Super admin only - for platform-wide testing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import type { CutPart } from "@/lib/schema";
import { calculateAccuracyMetrics } from "@/lib/learning/accuracy";
import { logParsingAccuracy } from "@/lib/learning/accuracy";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get user - verify super admin access
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true, isSuperAdmin: true },
    });

    // Super admin only
    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden - Super admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      exampleId,       // Test against a specific training example
      sourceText,      // Or provide text directly
      groundTruth,     // Ground truth parts (required if sourceText provided)
      provider = "anthropic",
      extractMetadata = true,
      logResult = false, // Log the result to accuracy tracking
    } = body;

    // Validate input
    if (!exampleId && (!sourceText || !groundTruth)) {
      return NextResponse.json(
        { ok: false, error: "Provide either exampleId OR (sourceText and groundTruth)" },
        { status: 400 }
      );
    }

    let textToTest: string;
    let truthParts: CutPart[];

    if (exampleId) {
      // Load from training example
      const example = await prisma.trainingExample.findUnique({
        where: { id: exampleId },
        select: { sourceText: true, correctParts: true, isActive: true },
      });

      if (!example || !example.isActive) {
        return NextResponse.json(
          { ok: false, error: "Training example not found" },
          { status: 404 }
        );
      }

      textToTest = example.sourceText;
      truthParts = example.correctParts as CutPart[];
    } else {
      textToTest = sourceText;
      truthParts = groundTruth;
    }

    // Get AI provider
    const aiProvider = getAIProvider(provider);

    // Parse the text
    const startTime = Date.now();
    const result = await aiProvider.parseText(textToTest, {
      extractMetadata,
      confidence: "balanced",
      organizationId: dbUser?.organizationId ?? undefined,
    });

    const processingTime = Date.now() - startTime;

    if (!result.success || result.parts.length === 0) {
      return NextResponse.json({
        ok: true,
        success: false,
        error: "Parsing failed",
        errors: result.errors,
        metrics: {
          accuracy: 0,
          totalParts: truthParts.length,
          parsedParts: 0,
          correctParts: 0,
          processingTime,
        },
      });
    }

    // Calculate accuracy metrics
    const parsedParts = result.parts.map(p => p.part);
    const metrics = calculateAccuracyMetrics(parsedParts, truthParts);

    // Log result if requested
    if (logResult) {
      await logParsingAccuracy({
        organizationId: dbUser?.organizationId ?? undefined,
        provider: provider as "claude" | "gpt" | "python_ocr" | "pdf-parse",
        totalParts: truthParts.length,
        correctParts: metrics.correctParts,
        accuracy: metrics.accuracy,
        dimensionAccuracy: metrics.dimensionAccuracy,
        materialAccuracy: metrics.materialAccuracy,
        edgingAccuracy: metrics.edgingAccuracy,
        groovingAccuracy: metrics.groovingAccuracy,
        quantityAccuracy: metrics.quantityAccuracy,
        labelAccuracy: metrics.labelAccuracy,
        fewShotExamplesUsed: (result as any).fewShotExamplesUsed || 0,
        patternsApplied: 0,
        clientTemplateUsed: false,
      });
    }

    // Compare parts for detailed feedback
    const comparison = comparePartsDetail(parsedParts, truthParts);

    return NextResponse.json({
      ok: true,
      success: true,
      metrics: {
        accuracy: metrics.accuracy,
        totalParts: truthParts.length,
        parsedParts: parsedParts.length,
        correctParts: metrics.correctParts,
        processingTime,
        fieldAccuracy: {
          dimensions: metrics.dimensionAccuracy,
          materials: metrics.materialAccuracy,
          edging: metrics.edgingAccuracy,
          grooving: metrics.groovingAccuracy,
          quantities: metrics.quantityAccuracy,
          labels: metrics.labelAccuracy,
        },
      },
      comparison: {
        matched: comparison.matched.length,
        unmatched: comparison.unmatched.length,
        extra: comparison.extra.length,
        details: comparison.details.slice(0, 10), // First 10 for brevity
      },
      provider,
      fewShotExamplesUsed: (result as any).fewShotExamplesUsed || 0,
    });
  } catch (error) {
    console.error("Test parse failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test parse failed" },
      { status: 500 }
    );
  }
}

// ============================================================
// COMPARISON HELPERS
// ============================================================

interface ComparisonResult {
  matched: { parsed: CutPart; truth: CutPart }[];
  unmatched: CutPart[];
  extra: CutPart[];
  details: {
    index: number;
    match: boolean;
    parsed: Partial<CutPart>;
    truth: Partial<CutPart>;
    differences: string[];
  }[];
}

function comparePartsDetail(parsed: CutPart[], truth: CutPart[]): ComparisonResult {
  const matched: { parsed: CutPart; truth: CutPart }[] = [];
  const unmatched: CutPart[] = [];
  const extra: CutPart[] = [];
  const details: ComparisonResult["details"] = [];
  
  const usedParsed = new Set<number>();
  const usedTruth = new Set<number>();

  // Match parts
  for (let ti = 0; ti < truth.length; ti++) {
    const truthPart = truth[ti];
    let bestMatch = -1;
    let bestScore = 0;

    for (let pi = 0; pi < parsed.length; pi++) {
      if (usedParsed.has(pi)) continue;
      
      const parsedPart = parsed[pi];
      const score = calculateMatchScore(parsedPart, truthPart);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pi;
      }
    }

    if (bestMatch >= 0 && bestScore > 0.5) {
      matched.push({ parsed: parsed[bestMatch], truth: truthPart });
      usedParsed.add(bestMatch);
      usedTruth.add(ti);

      // Record differences
      const differences = findDifferences(parsed[bestMatch], truthPart);
      details.push({
        index: ti,
        match: differences.length === 0,
        parsed: summarizePart(parsed[bestMatch]),
        truth: summarizePart(truthPart),
        differences,
      });
    } else {
      unmatched.push(truthPart);
      details.push({
        index: ti,
        match: false,
        parsed: {},
        truth: summarizePart(truthPart),
        differences: ["No matching parsed part found"],
      });
    }
  }

  // Record extra parsed parts
  for (let pi = 0; pi < parsed.length; pi++) {
    if (!usedParsed.has(pi)) {
      extra.push(parsed[pi]);
    }
  }

  return { matched, unmatched, extra, details };
}

function calculateMatchScore(parsed: CutPart, truth: CutPart): number {
  let score = 0;
  const tolerance = 2;

  // Dimensions (0-0.5)
  if (
    Math.abs(parsed.size.L - truth.size.L) <= tolerance &&
    Math.abs(parsed.size.W - truth.size.W) <= tolerance
  ) {
    score += 0.5;
  } else if (
    Math.abs(parsed.size.L - truth.size.L) <= 10 &&
    Math.abs(parsed.size.W - truth.size.W) <= 10
  ) {
    score += 0.3;
  }

  // Quantity (0-0.3)
  if (parsed.qty === truth.qty) {
    score += 0.3;
  }

  // Label (0-0.2)
  if (parsed.label && truth.label) {
    const similarity = stringSimilarity(parsed.label, truth.label);
    score += similarity * 0.2;
  }

  return score;
}

function findDifferences(parsed: CutPart, truth: CutPart): string[] {
  const diff: string[] = [];
  const tolerance = 2;

  if (Math.abs(parsed.size.L - truth.size.L) > tolerance) {
    diff.push(`Length: ${parsed.size.L} vs ${truth.size.L}`);
  }
  if (Math.abs(parsed.size.W - truth.size.W) > tolerance) {
    diff.push(`Width: ${parsed.size.W} vs ${truth.size.W}`);
  }
  if (parsed.qty !== truth.qty) {
    diff.push(`Quantity: ${parsed.qty} vs ${truth.qty}`);
  }
  if (parsed.material_id !== truth.material_id) {
    diff.push(`Material: ${parsed.material_id} vs ${truth.material_id}`);
  }

  // Check edging
  const parsedEdges = getEdgeArray(parsed.ops?.edging);
  const truthEdges = getEdgeArray(truth.ops?.edging);
  if (parsedEdges.sort().join(",") !== truthEdges.sort().join(",")) {
    diff.push(`Edges: [${parsedEdges.join(",")}] vs [${truthEdges.join(",")}]`);
  }

  return diff;
}

function getEdgeArray(edging: CutPart["ops"]["edging"] | undefined): string[] {
  if (!edging) return [];
  const edges: string[] = [];
  if (edging.L1) edges.push("L1");
  if (edging.L2) edges.push("L2");
  if (edging.W1) edges.push("W1");
  if (edging.W2) edges.push("W2");
  return edges;
}

function summarizePart(part: CutPart): Partial<CutPart> {
  return {
    label: part.label,
    size: part.size,
    qty: part.qty,
    material_id: part.material_id,
  };
}

function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return 1;
  
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  
  let matches = 0;
  for (let i = 0; i < Math.min(aLower.length, bLower.length); i++) {
    if (aLower[i] === bLower[i]) matches++;
  }
  
  return matches / maxLen;
}

