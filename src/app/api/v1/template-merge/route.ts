/**
 * CAI Intake - Template Multi-Page Merge API
 * 
 * POST /api/v1/template-merge
 * Merges multiple pages of a template into a single result.
 * 
 * GET /api/v1/template-merge?sessionId=xxx
 * Gets status of a multi-page session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  getSessionStatus,
  mergeSessionPages,
  checkAutoAccept,
} from "@/lib/templates/template-parsing-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const session = getSessionStatus(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        templateId: session.templateId,
        projectCode: session.projectCode,
        pagesCollected: session.pages.length,
        totalExpectedPages: session.totalExpectedPages,
        status: session.status,
        pages: session.pages.map(p => ({
          pageNumber: p.pageNumber,
          fileName: p.fileName,
          partsCount: p.rawParts.length,
          confidence: p.confidence,
        })),
      },
    });
  } catch (error) {
    logger.error("[TemplateMerge] GET error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    return NextResponse.json(
      { error: "Failed to get session status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required in request body" },
        { status: 400 }
      );
    }

    logger.info("[TemplateMerge] Merging pages", {
      userId: user.id,
      sessionId,
    });

    // Merge pages
    const mergeResult = mergeSessionPages(sessionId);

    if (!mergeResult.success) {
      return NextResponse.json(
        { error: mergeResult.errors.join(", ") || "Merge failed" },
        { status: 422 }
      );
    }

    // Check auto-accept for merged result
    const autoAcceptResult = checkAutoAccept(mergeResult.parts, sessionId);

    logger.info("[TemplateMerge] Merge complete", {
      sessionId,
      projectCode: mergeResult.projectCode,
      totalPages: mergeResult.totalPages,
      totalParts: mergeResult.parts.length,
      avgConfidence: mergeResult.averageConfidence,
      autoAccept: autoAcceptResult.shouldAutoAccept,
    });

    return NextResponse.json({
      success: true,
      merged: mergeResult.merged,
      projectCode: mergeResult.projectCode,
      totalPages: mergeResult.totalPages,
      parts: mergeResult.parts,
      averageConfidence: mergeResult.averageConfidence,
      autoAccept: {
        shouldAutoAccept: autoAcceptResult.shouldAutoAccept,
        confidence: autoAcceptResult.confidence,
        threshold: autoAcceptResult.threshold,
        reasons: autoAcceptResult.reasons,
      },
      warnings: mergeResult.errors,
    });
  } catch (error) {
    logger.error("[TemplateMerge] POST error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to merge template pages" },
      { status: 500 }
    );
  }
}

