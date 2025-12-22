/**
 * CAI Intake - Data Cleanup Cron Job
 * 
 * This endpoint is triggered by Vercel Cron to run data cleanup tasks.
 * 
 * Schedule: Runs daily at 3:00 AM UTC
 * 
 * Security:
 * - Protected by CRON_SECRET header
 * - Only accepts GET requests from Vercel Cron
 */

import { NextRequest, NextResponse } from "next/server";
import { runCleanup, type CleanupConfig, DEFAULT_CONFIG } from "@/lib/cleanup";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CRON_SECRET = process.env.CRON_SECRET;

// Override defaults for production
const PRODUCTION_CONFIG: Partial<CleanupConfig> = {
  retention: {
    auditLogs: 365,          // Keep audit logs for 1 year
    parseJobs: 90,           // Keep parse jobs for 3 months
    uploadedFiles: 30,       // Clean orphaned files after 1 month
    rateTracking: 7,         // Clean rate tracking after 1 week
    usageRecords: 365,       // Keep usage for billing (1 year)
    errorLogs: 30,           // Keep error logs for 1 month
    ocrJobsCompleted: 30,    // Keep OCR jobs for 1 month
    optimizeJobs: 90,        // Keep optimize jobs for 3 months
    sessions: 7,             // Clean expired sessions after 1 week
  },
  dryRun: false,
  verbose: true,
};

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    
    if (CRON_SECRET) {
      if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.log("[Cleanup Cron] Unauthorized request");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      // In production, require CRON_SECRET
      console.log("[Cleanup Cron] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    console.log("[Cleanup Cron] Starting scheduled cleanup");

    // Run cleanup with production config
    const result = await runCleanup(PRODUCTION_CONFIG);

    console.log("[Cleanup Cron] Completed", {
      runId: result.runId,
      durationMs: result.durationMs,
      totalDeleted: result.totalDeleted,
      hasErrors: result.hasErrors,
    });

    // Log task details
    for (const task of result.tasks) {
      if (task.error) {
        console.error(`[Cleanup Cron] Task ${task.taskName} failed:`, task.error);
      } else if (task.recordsDeleted > 0) {
        console.log(
          `[Cleanup Cron] Task ${task.taskName}: ${task.recordsDeleted} records deleted`
        );
      }
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
      durationMs: result.durationMs,
      totalDeleted: result.totalDeleted,
      hasErrors: result.hasErrors,
      tasks: result.tasks.map((t) => ({
        name: t.taskName,
        found: t.recordsFound,
        deleted: t.recordsDeleted,
        durationMs: t.durationMs,
        error: t.error,
      })),
    });
  } catch (error) {
    console.error("[Cleanup Cron] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Manual trigger with custom config (super admin only)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // This endpoint can be used for manual cleanup with custom config
    // In production, should be protected by authentication
    
    const body = await request.json().catch(() => ({}));
    
    // Allow dryRun mode for testing
    const customConfig: Partial<CleanupConfig> = {
      ...PRODUCTION_CONFIG,
      dryRun: body.dryRun ?? false,
      verbose: body.verbose ?? true,
      retention: {
        ...PRODUCTION_CONFIG.retention!,
        ...body.retention,
      },
    };

    console.log("[Cleanup Manual] Starting manual cleanup", {
      dryRun: customConfig.dryRun,
    });

    const result = await runCleanup(customConfig);

    return NextResponse.json({
      success: true,
      runId: result.runId,
      durationMs: result.durationMs,
      totalDeleted: result.totalDeleted,
      hasErrors: result.hasErrors,
      dryRun: customConfig.dryRun,
      tasks: result.tasks.map((t) => ({
        name: t.taskName,
        found: t.recordsFound,
        deleted: t.recordsDeleted,
        durationMs: t.durationMs,
        error: t.error,
      })),
    });
  } catch (error) {
    console.error("[Cleanup Manual] Error:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

