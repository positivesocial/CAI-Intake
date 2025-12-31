/**
 * CAI Intake - Platform OCR Audit API
 * 
 * Super admin endpoint for viewing OCR/AI parsing logs and accuracy metrics.
 * Uses the ai_usage_logs table for persistent storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

interface OCRAuditEntry {
  id: string;
  timestamp: string;
  organizationId: string;
  organizationName?: string;
  provider: string;
  model: string;
  operation: string;
  success: boolean;
  partsExtracted: number;
  confidence: number;
  processingTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errorMessage?: string;
}

interface AccuracyMetrics {
  period: string;
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  avgProcessingTimeMs: number;
  avgConfidence: number;
  providerBreakdown: {
    anthropic: { count: number; successRate: number; avgTime: number };
    openai: { count: number; successRate: number; avgTime: number };
  };
}

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
// HELPER FUNCTIONS
// ============================================================

async function getMetricsForPeriod(startDate: Date): Promise<AccuracyMetrics> {
  const stats = await prisma.aIUsageLog.groupBy({
    by: ["provider", "success"],
    where: {
      createdAt: { gte: startDate },
      operation: { in: ["parse_image", "parse_pdf", "ocr", "parse_text"] },
    },
    _count: true,
    _avg: {
      durationMs: true,
    },
  });

  const allLogs = await prisma.aIUsageLog.aggregate({
    where: {
      createdAt: { gte: startDate },
      operation: { in: ["parse_image", "parse_pdf", "ocr", "parse_text"] },
    },
    _count: true,
    _avg: {
      durationMs: true,
    },
  });

  // Calculate provider breakdown
  const anthropicStats = stats.filter(s => s.provider === "anthropic");
  const openaiStats = stats.filter(s => s.provider === "openai");

  const anthropicTotal = anthropicStats.reduce((sum, s) => sum + s._count, 0);
  const anthropicSuccess = anthropicStats.filter(s => s.success).reduce((sum, s) => sum + s._count, 0);
  const anthropicAvgTime = anthropicStats.find(s => s.success)?._avg.durationMs || 0;

  const openaiTotal = openaiStats.reduce((sum, s) => sum + s._count, 0);
  const openaiSuccess = openaiStats.filter(s => s.success).reduce((sum, s) => sum + s._count, 0);
  const openaiAvgTime = openaiStats.find(s => s.success)?._avg.durationMs || 0;

  const totalExtractions = allLogs._count || 0;
  const successfulExtractions = stats.filter(s => s.success).reduce((sum, s) => sum + s._count, 0);

  return {
    period: startDate.toISOString(),
    totalExtractions,
    successfulExtractions,
    failedExtractions: totalExtractions - successfulExtractions,
    avgProcessingTimeMs: allLogs._avg.durationMs || 0,
    avgConfidence: 0.85, // Would need to track in metadata
    providerBreakdown: {
      anthropic: {
        count: anthropicTotal,
        successRate: anthropicTotal > 0 ? (anthropicSuccess / anthropicTotal) * 100 : 100,
        avgTime: anthropicAvgTime,
      },
      openai: {
        count: openaiTotal,
        successRate: openaiTotal > 0 ? (openaiSuccess / openaiTotal) * 100 : 100,
        avgTime: openaiAvgTime,
      },
    },
  };
}

// ============================================================
// GET - Fetch OCR audit logs and metrics
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<OCRAuditResponse>> {
  try {
    // Authenticate user via Supabase
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({
        success: false,
        data: { entries: [], metrics: { day: {} as AccuracyMetrics, week: {} as AccuracyMetrics, month: {} as AccuracyMetrics }, summary: { totalExtractions: 0, successRate: 0, avgQualityScore: 0, avgProcessingTime: 0, truncationRate: 0, reviewRate: 0, fallbackRate: 0 } },
        error: "Unauthorized",
      }, { status: 401 });
    }

    // Check if super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({
        success: false,
        data: { entries: [], metrics: { day: {} as AccuracyMetrics, week: {} as AccuracyMetrics, month: {} as AccuracyMetrics }, summary: { totalExtractions: 0, successRate: 0, avgQualityScore: 0, avgProcessingTime: 0, truncationRate: 0, reviewRate: 0, fallbackRate: 0 } },
        error: "Forbidden - Super admin access required",
      }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    logger.info("📊 [OCR Audit API] Fetching audit data", { limit, userId: authUser.id });

    // Calculate date ranges
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch recent entries from ai_usage_logs
    const [entries, dayMetrics, weekMetrics, monthMetrics] = await Promise.all([
      prisma.aIUsageLog.findMany({
        where: {
          operation: { in: ["parse_image", "parse_pdf", "ocr", "parse_text"] },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          organization: {
            select: { name: true },
          },
        },
      }),
      getMetricsForPeriod(dayAgo),
      getMetricsForPeriod(weekAgo),
      getMetricsForPeriod(monthAgo),
    ]);

    // Transform entries to OCR audit format
    const auditEntries: OCRAuditEntry[] = entries.map(entry => {
      // Extract parts count and confidence from metadata if available
      const metadata = entry.metadata as Record<string, unknown> | null;
      const partsFound = (metadata?.partsFound as number) || 0;
      const confidence = (metadata?.confidence as number) || 0;

      return {
        id: entry.id,
        timestamp: entry.createdAt.toISOString(),
        organizationId: entry.organizationId,
        organizationName: entry.organization.name,
        provider: entry.provider,
        model: entry.model,
        operation: entry.operation,
        success: entry.success,
        partsExtracted: partsFound,
        confidence,
        processingTimeMs: entry.durationMs,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costUsd: Number(entry.costUsd),
        errorMessage: entry.errorMessage || undefined,
      };
    });

    // Calculate summary
    const summary = {
      totalExtractions: monthMetrics.totalExtractions,
      successRate: monthMetrics.totalExtractions > 0 
        ? (monthMetrics.successfulExtractions / monthMetrics.totalExtractions) * 100 
        : 100,
      avgQualityScore: monthMetrics.avgConfidence * 100,
      avgProcessingTime: monthMetrics.avgProcessingTimeMs,
      truncationRate: 0, // Would need to track in metadata
      reviewRate: 0, // Would need to track in metadata
      fallbackRate: monthMetrics.providerBreakdown.openai.count / Math.max(monthMetrics.totalExtractions, 1) * 100,
    };

    return NextResponse.json({
      success: true,
      data: {
        entries: auditEntries,
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
