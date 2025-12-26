/**
 * CAI Intake - Training Accuracy API
 * 
 * GET /api/v1/training/accuracy - Get accuracy metrics and analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

// ============================================================
// GET ACCURACY METRICS
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const provider = searchParams.get("provider");
    const view = searchParams.get("view") || "summary"; // summary, trends, breakdown

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };

    if (dbUser?.organizationId) {
      where.organizationId = dbUser.organizationId;
    }

    if (provider) {
      where.provider = provider;
    }

    // Fetch accuracy logs
    const logs = await prisma.parsingAccuracyLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    if (logs.length === 0) {
      return NextResponse.json({
        ok: true,
        view,
        data: view === "summary" ? getEmptySummary() : [],
      });
    }

    switch (view) {
      case "trends":
        return NextResponse.json({
          ok: true,
          view: "trends",
          data: calculateTrends(logs, days),
        });

      case "breakdown":
        return NextResponse.json({
          ok: true,
          view: "breakdown",
          data: calculateBreakdown(logs),
        });

      case "summary":
      default:
        return NextResponse.json({
          ok: true,
          view: "summary",
          data: calculateSummary(logs),
        });
    }
  } catch (error) {
    console.error("Failed to get accuracy metrics:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to get accuracy metrics" },
      { status: 500 }
    );
  }
}

// ============================================================
// CALCULATION HELPERS
// ============================================================

interface AccuracyLog {
  id: string;
  provider: string;
  accuracy: number;
  totalParts: number;
  correctParts: number;
  dimensionAccuracy: number | null;
  materialAccuracy: number | null;
  edgingAccuracy: number | null;
  groovingAccuracy: number | null;
  quantityAccuracy: number | null;
  labelAccuracy: number | null;
  fewShotExamplesUsed: number;
  patternsApplied: number;
  clientTemplateUsed: boolean;
  documentDifficulty: string | null;
  clientName: string | null;
  createdAt: Date;
}

function calculateSummary(logs: AccuracyLog[]) {
  const totalParts = logs.reduce((sum, l) => sum + l.totalParts, 0);
  const correctParts = logs.reduce((sum, l) => sum + l.correctParts, 0);
  const overallAccuracy = logs.reduce((sum, l) => sum + l.accuracy, 0) / logs.length;

  // Calculate field averages
  const fieldAverages = calculateFieldAverages(logs);

  // Calculate trend
  const midpoint = Math.floor(logs.length / 2);
  const recentLogs = logs.slice(0, midpoint);
  const olderLogs = logs.slice(midpoint);
  
  const recentAvg = recentLogs.length > 0 
    ? recentLogs.reduce((sum, l) => sum + l.accuracy, 0) / recentLogs.length 
    : 0;
  const olderAvg = olderLogs.length > 0 
    ? olderLogs.reduce((sum, l) => sum + l.accuracy, 0) / olderLogs.length 
    : 0;
  
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentAvg > olderAvg + 0.03) trend = "improving";
  else if (recentAvg < olderAvg - 0.03) trend = "declining";

  // Find weakest and strongest fields
  const sortedFields = Object.entries(fieldAverages)
    .filter(([_, v]) => v !== null)
    .sort((a, b) => (a[1] as number) - (b[1] as number));
  
  const weakestField = sortedFields[0]?.[0] || "unknown";
  const strongestField = sortedFields[sortedFields.length - 1]?.[0] || "unknown";

  // Calculate few-shot effectiveness
  const withFewShot = logs.filter(l => l.fewShotExamplesUsed > 0);
  const withoutFewShot = logs.filter(l => l.fewShotExamplesUsed === 0);
  
  const fewShotAvg = withFewShot.length > 0 
    ? withFewShot.reduce((sum, l) => sum + l.accuracy, 0) / withFewShot.length 
    : null;
  const noFewShotAvg = withoutFewShot.length > 0 
    ? withoutFewShot.reduce((sum, l) => sum + l.accuracy, 0) / withoutFewShot.length 
    : null;

  return {
    overallAccuracy,
    totalPartsProcessed: totalParts,
    correctParts,
    totalDocuments: logs.length,
    trend,
    weakestField,
    strongestField,
    fieldAccuracy: fieldAverages,
    fewShotEffectiveness: {
      withFewShot: {
        count: withFewShot.length,
        avgAccuracy: fewShotAvg,
      },
      withoutFewShot: {
        count: withoutFewShot.length,
        avgAccuracy: noFewShotAvg,
      },
      improvement: fewShotAvg && noFewShotAvg ? fewShotAvg - noFewShotAvg : null,
    },
  };
}

function calculateTrends(logs: AccuracyLog[], days: number) {
  // Group by date
  const grouped = new Map<string, { accuracy: number[]; parts: number; fewShot: number }>();
  
  for (const log of logs) {
    const date = log.createdAt.toISOString().split("T")[0];
    const existing = grouped.get(date) || { accuracy: [], parts: 0, fewShot: 0 };
    existing.accuracy.push(log.accuracy);
    existing.parts += log.totalParts;
    existing.fewShot += log.fewShotExamplesUsed;
    grouped.set(date, existing);
  }

  return Array.from(grouped.entries())
    .map(([date, { accuracy, parts, fewShot }]) => ({
      date,
      accuracy: accuracy.reduce((a, b) => a + b, 0) / accuracy.length,
      partsProcessed: parts,
      documentsProcessed: accuracy.length,
      avgFewShotExamples: fewShot / accuracy.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateBreakdown(logs: AccuracyLog[]) {
  // By provider
  const byProvider = groupBy(logs, "provider");
  const providerStats = Object.entries(byProvider).map(([provider, providerLogs]) => ({
    category: "provider",
    name: provider,
    count: providerLogs.length,
    accuracy: providerLogs.reduce((sum, l) => sum + l.accuracy, 0) / providerLogs.length,
  }));

  // By difficulty
  const byDifficulty = groupBy(logs.filter(l => l.documentDifficulty), "documentDifficulty");
  const difficultyStats = Object.entries(byDifficulty).map(([difficulty, diffLogs]) => ({
    category: "difficulty",
    name: difficulty,
    count: diffLogs.length,
    accuracy: diffLogs.reduce((sum, l) => sum + l.accuracy, 0) / diffLogs.length,
  }));

  // Weak areas (fields below 90% accuracy)
  const fieldAverages = calculateFieldAverages(logs);
  const weakAreas = Object.entries(fieldAverages)
    .filter(([_, accuracy]) => accuracy !== null && accuracy < 0.9)
    .map(([field, accuracy]) => ({
      field,
      accuracy,
      suggestions: getSuggestionsForField(field, accuracy as number),
    }))
    .sort((a, b) => (a.accuracy as number) - (b.accuracy as number));

  return {
    byProvider: providerStats,
    byDifficulty: difficultyStats,
    weakAreas,
    fieldAccuracy: fieldAverages,
  };
}

function calculateFieldAverages(logs: AccuracyLog[]): Record<string, number | null> {
  const fields = [
    { key: "dimensionAccuracy", name: "dimensions" },
    { key: "materialAccuracy", name: "materials" },
    { key: "edgingAccuracy", name: "edging" },
    { key: "groovingAccuracy", name: "grooving" },
    { key: "quantityAccuracy", name: "quantities" },
    { key: "labelAccuracy", name: "labels" },
  ];

  const averages: Record<string, number | null> = {};

  for (const field of fields) {
    const values = logs
      .map(l => l[field.key as keyof AccuracyLog])
      .filter((v): v is number => v !== null && typeof v === "number");
    
    averages[field.name] = values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length 
      : null;
  }

  return averages;
}

function getEmptySummary() {
  return {
    overallAccuracy: 0,
    totalPartsProcessed: 0,
    correctParts: 0,
    totalDocuments: 0,
    trend: "stable",
    weakestField: "unknown",
    strongestField: "unknown",
    fieldAccuracy: {
      dimensions: null,
      materials: null,
      edging: null,
      grooving: null,
      quantities: null,
      labels: null,
    },
    fewShotEffectiveness: {
      withFewShot: { count: 0, avgAccuracy: null },
      withoutFewShot: { count: 0, avgAccuracy: null },
      improvement: null,
    },
  };
}

function getSuggestionsForField(field: string, accuracy: number): string[] {
  const suggestions: string[] = [];
  
  switch (field) {
    case "dimensions":
      suggestions.push("Add more training examples with varied dimension formats");
      if (accuracy < 0.7) {
        suggestions.push("Check if dimension columns are being confused with other data");
      }
      break;
      
    case "materials":
      suggestions.push("Add material mappings for commonly misidentified codes");
      suggestions.push("Consider adding more material alias patterns");
      break;
      
    case "edging":
      suggestions.push("Review edge notation patterns in client templates");
      suggestions.push("Add examples showing different edge marking systems");
      if (accuracy < 0.7) {
        suggestions.push("Check if uppercase X vs lowercase x confusion is occurring");
      }
      break;
      
    case "grooving":
      suggestions.push("Add more examples with groove notation");
      suggestions.push("Review GL/GW column detection patterns");
      break;
      
    case "quantities":
      suggestions.push("Check for quantity notation patterns like 'x2', '2pcs', '(2)'");
      break;
      
    case "labels":
      suggestions.push("Ensure label column is correctly identified");
      suggestions.push("Add training examples with varied label formats");
      break;
  }
  
  return suggestions;
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const value = String(item[key] || "unknown");
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

