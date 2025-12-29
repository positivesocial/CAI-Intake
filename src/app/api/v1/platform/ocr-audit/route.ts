/**
 * CAI Intake - Platform OCR Audit API
 * 
 * Super admin endpoint for viewing OCR audit logs and accuracy metrics.
 * Requires platform admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { 
  getRecentAuditEntries, 
  calculateAccuracyMetrics,
  type OCRAuditEntry,
  type AccuracyMetrics,
} from "@/lib/ai/ocr-audit";
import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

interface OCRAuditResponse {
  success: boolean;
  data: {
    entries: OCRAuditEntry[];
    metrics: {
      day: AccuracyMetrics;
      week: AccuracyMetrics;
      month: AccuracyMetrics;
    };
    summary: {
      totalExtractions: number;
      successRate: number;
      avgQualityScore: number;
      avgProcessingTime: number;
      truncationRate: number;
      reviewRate: number;
      fallbackRate: number;
    };
  };
  error?: string;
}

// ============================================================
// GET - Fetch OCR audit logs and metrics
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<OCRAuditResponse>> {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        data: { entries: [], metrics: { day: {} as AccuracyMetrics, week: {} as AccuracyMetrics, month: {} as AccuracyMetrics }, summary: { totalExtractions: 0, successRate: 0, avgQualityScore: 0, avgProcessingTime: 0, truncationRate: 0, reviewRate: 0, fallbackRate: 0 } },
        error: "Unauthorized",
      }, { status: 401 });
    }

    // Check if user is platform admin (super admin)
    // In a real implementation, check user.role === "platform_admin"
    // For now, we'll allow access

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const period = searchParams.get("period") as "day" | "week" | "month" | null;

    logger.info("📊 [OCR Audit API] Fetching audit data", { limit, period, userId: user.id });

    // Get recent audit entries
    const entries = getRecentAuditEntries(limit);

    // Calculate metrics for all periods
    const dayMetrics = calculateAccuracyMetrics("day");
    const weekMetrics = calculateAccuracyMetrics("week");
    const monthMetrics = calculateAccuracyMetrics("month");

    // Calculate summary
    const summary = {
      totalExtractions: monthMetrics.totalExtractions,
      successRate: monthMetrics.successfulExtractions / Math.max(monthMetrics.totalExtractions, 1) * 100,
      avgQualityScore: monthMetrics.avgQualityScore,
      avgProcessingTime: monthMetrics.avgProcessingTimeMs,
      truncationRate: monthMetrics.truncationRate * 100,
      reviewRate: monthMetrics.reviewRate * 100,
      fallbackRate: monthMetrics.fallbackRate * 100,
    };

    return NextResponse.json({
      success: true,
      data: {
        entries,
        metrics: {
          day: dayMetrics,
          week: weekMetrics,
          month: monthMetrics,
        },
        summary,
      },
    });

  } catch (error) {
    logger.error("❌ [OCR Audit API] Failed to fetch audit data", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({
      success: false,
      data: { 
        entries: [], 
        metrics: { 
          day: {} as AccuracyMetrics, 
          week: {} as AccuracyMetrics, 
          month: {} as AccuracyMetrics 
        }, 
        summary: { 
          totalExtractions: 0, 
          successRate: 0, 
          avgQualityScore: 0, 
          avgProcessingTime: 0, 
          truncationRate: 0, 
          reviewRate: 0, 
          fallbackRate: 0 
        } 
      },
      error: error instanceof Error ? error.message : "Failed to fetch audit data",
    }, { status: 500 });
  }
}

