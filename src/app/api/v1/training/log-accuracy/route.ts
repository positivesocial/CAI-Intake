/**
 * CAI Intake - Log Accuracy API
 * 
 * POST /api/v1/training/log-accuracy - Log parsing accuracy from corrections
 * 
 * This endpoint is called after a cutlist is saved to log how accurate
 * the AI parsing was compared to the user's corrections.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logAccuracyFromCorrections } from "@/lib/learning/accuracy";
import type { CutPart } from "@/lib/schema";

// Serverless function config
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    const body = await request.json();
    const {
      originalParts,
      correctedParts,
      provider,
      sourceType,
      sourceFileName,
      fewShotExamplesUsed,
      patternsApplied,
      clientTemplateUsed,
      clientName,
      parseJobId,
    } = body;

    // Validate required fields
    if (!originalParts || !Array.isArray(originalParts)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid originalParts" },
        { status: 400 }
      );
    }

    if (!correctedParts || !Array.isArray(correctedParts)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid correctedParts" },
        { status: 400 }
      );
    }

    // Skip logging if no original parts (manual entry, not AI parsed)
    if (originalParts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Skipped - no original parts to compare",
        logged: false,
      });
    }

    // Log accuracy
    const entry = await logAccuracyFromCorrections(
      originalParts as CutPart[],
      correctedParts as CutPart[],
      {
        organizationId: dbUser?.organizationId ?? undefined,
        parseJobId,
        provider: provider || "claude",
        sourceType: sourceType || "image",
        fewShotExamplesUsed: fewShotExamplesUsed || 0,
        patternsApplied: patternsApplied || 0,
        clientTemplateUsed: clientTemplateUsed || false,
        clientName,
      }
    );

    if (entry) {
      return NextResponse.json({
        ok: true,
        message: "Accuracy logged successfully",
        logged: true,
        accuracy: entry.accuracy,
        metrics: {
          totalParts: entry.totalParts,
          correctParts: entry.correctParts,
          dimensionAccuracy: entry.dimensionAccuracy,
          materialAccuracy: entry.materialAccuracy,
          edgingAccuracy: entry.edgingAccuracy,
        },
      });
    } else {
      return NextResponse.json({
        ok: true,
        message: "Accuracy logging skipped",
        logged: false,
      });
    }
  } catch (error) {
    console.error("Failed to log accuracy:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to log accuracy" },
      { status: 500 }
    );
  }
}

