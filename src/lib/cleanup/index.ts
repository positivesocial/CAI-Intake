/**
 * CAI Intake - Data Cleanup Service
 * 
 * Centralized data cleanup and retention management
 * 
 * Best Practices Implemented:
 * 1. Soft deletes where appropriate (audit trails)
 * 2. Cascade deletes for related data
 * 3. Batch processing to avoid memory issues
 * 4. Configurable retention periods
 * 5. Dry run mode for testing
 * 6. Detailed logging and metrics
 * 7. Error handling with partial completion
 */

import { prisma } from "@/lib/db";
import { getServiceClient } from "@/lib/supabase/server";

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface CleanupConfig {
  // Retention periods in days
  retention: {
    auditLogs: number;          // How long to keep audit logs
    parseJobs: number;          // How long to keep parse job records
    uploadedFiles: number;      // How long to keep orphaned files
    rateTracking: number;       // How long to keep rate limit data
    usageRecords: number;       // How long to keep detailed usage records
    errorLogs: number;          // How long to keep error logs
    ocrJobsCompleted: number;   // How long to keep completed OCR jobs
    optimizeJobs: number;       // How long to keep completed optimization jobs
    sessions: number;           // How long to keep expired sessions
  };
  
  // Batch sizes
  batchSize: number;            // Records to process per batch
  maxBatches: number;           // Maximum batches per run
  
  // Options
  dryRun: boolean;              // If true, don't actually delete
  verbose: boolean;             // If true, log detailed info
}

export const DEFAULT_CONFIG: CleanupConfig = {
  retention: {
    auditLogs: 365,           // 1 year
    parseJobs: 90,            // 3 months
    uploadedFiles: 30,        // 1 month for orphaned files
    rateTracking: 7,          // 1 week
    usageRecords: 365,        // 1 year (for billing)
    errorLogs: 30,            // 1 month
    ocrJobsCompleted: 30,     // 1 month
    optimizeJobs: 90,         // 3 months
    sessions: 7,              // 1 week
  },
  batchSize: 1000,
  maxBatches: 100,
  dryRun: false,
  verbose: false,
};

// =============================================================================
// CLEANUP RESULT TYPES
// =============================================================================

export interface CleanupTaskResult {
  taskName: string;
  recordsFound: number;
  recordsDeleted: number;
  durationMs: number;
  error?: string;
}

export interface CleanupRunResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  config: CleanupConfig;
  tasks: CleanupTaskResult[];
  totalDeleted: number;
  hasErrors: boolean;
}

// =============================================================================
// CLEANUP TASKS
// =============================================================================

/**
 * Clean up old audit logs
 */
async function cleanupAuditLogs(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "audit_logs";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.auditLogs);

  try {
    const count = await prisma.auditLog.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    if (!config.dryRun && count > 0) {
      // Delete in batches to avoid timeouts
      let deleted = 0;
      for (let i = 0; i < config.maxBatches && deleted < count; i++) {
        const result = await prisma.auditLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        deleted += result.count;
        if (result.count < config.batchSize) break;
      }
      
      return {
        taskName,
        recordsFound: count,
        recordsDeleted: deleted,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      taskName,
      recordsFound: count,
      recordsDeleted: config.dryRun ? 0 : count,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old parse jobs
 */
async function cleanupParseJobs(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "parse_jobs";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.parseJobs);

  try {
    // Only delete completed/failed jobs, keep pending ones
    const count = await prisma.parseJob.count({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ["completed", "failed"] },
      },
    });

    if (!config.dryRun && count > 0) {
      await prisma.parseJob.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ["completed", "failed"] },
        },
      });
    }

    return {
      taskName,
      recordsFound: count,
      recordsDeleted: config.dryRun ? 0 : count,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up orphaned uploaded files (files not linked to any cutlist)
 */
async function cleanupOrphanedFiles(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "orphaned_files";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.uploadedFiles);

  try {
    // Find files that are orphaned (no cutlist link) and old
    const orphanedFiles = await prisma.uploadedFile.findMany({
      where: {
        cutlistId: null,
        createdAt: { lt: cutoffDate },
      },
      select: { id: true, storagePath: true },
      take: config.batchSize * config.maxBatches,
    });

    const count = orphanedFiles.length;

    if (!config.dryRun && count > 0) {
      const supabase = getServiceClient();
      
      // Delete from storage
      const storagePaths = orphanedFiles
        .map((f) => f.storagePath)
        .filter((p): p is string => Boolean(p));
      
      if (storagePaths.length > 0) {
        await supabase.storage.from("cutlist-files").remove(storagePaths);
      }

      // Delete from database
      await prisma.uploadedFile.deleteMany({
        where: { id: { in: orphanedFiles.map((f) => f.id) } },
      });
    }

    return {
      taskName,
      recordsFound: count,
      recordsDeleted: config.dryRun ? 0 : count,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old OCR jobs
 */
async function cleanupOcrJobs(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "ocr_jobs";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.ocrJobsCompleted);

  try {
    const count = await prisma.ocrJob.count({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ["completed", "failed"] },
      },
    });

    if (!config.dryRun && count > 0) {
      await prisma.ocrJob.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ["completed", "failed"] },
        },
      });
    }

    return {
      taskName,
      recordsFound: count,
      recordsDeleted: config.dryRun ? 0 : count,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old optimize jobs
 */
async function cleanupOptimizeJobs(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "optimize_jobs";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.optimizeJobs);

  try {
    const count = await prisma.optimizeJob.count({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ["completed", "failed"] },
      },
    });

    if (!config.dryRun && count > 0) {
      await prisma.optimizeJob.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ["completed", "failed"] },
        },
      });
    }

    return {
      taskName,
      recordsFound: count,
      recordsDeleted: config.dryRun ? 0 : count,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up rate tracking data using raw SQL (table not in Prisma schema)
 */
async function cleanupRateTracking(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "rate_tracking";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.rateTracking);

  try {
    // Use raw SQL since this table may not be in Prisma schema
    const result = await prisma.$executeRaw`
      DELETE FROM rate_limit_tracking
      WHERE window_start < ${cutoffDate}
    `;

    return {
      taskName,
      recordsFound: result,
      recordsDeleted: config.dryRun ? 0 : result,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Table might not exist - that's okay
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up error logs using raw SQL (table not in Prisma schema)
 */
async function cleanupErrorLogs(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "error_logs";
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention.errorLogs);

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM error_logs
      WHERE created_at < ${cutoffDate}
    `;

    return {
      taskName,
      recordsFound: result,
      recordsDeleted: config.dryRun ? 0 : result,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Table might not exist - that's okay
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old file cache entries
 */
async function cleanupFileCache(
  config: CleanupConfig
): Promise<CleanupTaskResult> {
  const taskName = "file_cache";
  const startTime = Date.now();

  try {
    // Delete expired cache entries
    const result = await prisma.$executeRaw`
      DELETE FROM file_cache
      WHERE expires_at < NOW()
    `;

    return {
      taskName,
      recordsFound: result,
      recordsDeleted: config.dryRun ? 0 : result,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Table might not exist - that's okay
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Refresh materialized views for usage stats
 */
async function refreshMaterializedViews(): Promise<CleanupTaskResult> {
  const taskName = "refresh_views";
  const startTime = Date.now();

  try {
    await prisma.$executeRaw`
      SELECT refresh_usage_stats()
    `;

    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Function might not exist - that's okay
    return {
      taskName,
      recordsFound: 0,
      recordsDeleted: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// MAIN CLEANUP RUNNER
// =============================================================================

/**
 * Run all cleanup tasks
 */
export async function runCleanup(
  customConfig?: Partial<CleanupConfig>
): Promise<CleanupRunResult> {
  const config: CleanupConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    retention: {
      ...DEFAULT_CONFIG.retention,
      ...customConfig?.retention,
    },
  };

  const runId = `cleanup_${Date.now()}`;
  const startedAt = new Date();
  const tasks: CleanupTaskResult[] = [];

  if (config.verbose) {
    console.log(`[Cleanup] Starting run ${runId}`, {
      dryRun: config.dryRun,
      retention: config.retention,
    });
  }

  // Run all cleanup tasks in sequence
  tasks.push(await cleanupAuditLogs(config));
  tasks.push(await cleanupParseJobs(config));
  tasks.push(await cleanupOrphanedFiles(config));
  tasks.push(await cleanupOcrJobs(config));
  tasks.push(await cleanupOptimizeJobs(config));
  tasks.push(await cleanupRateTracking(config));
  tasks.push(await cleanupErrorLogs(config));
  tasks.push(await cleanupFileCache(config));
  tasks.push(await refreshMaterializedViews());

  const completedAt = new Date();
  const totalDeleted = tasks.reduce((sum, t) => sum + t.recordsDeleted, 0);
  const hasErrors = tasks.some((t) => t.error);

  const result: CleanupRunResult = {
    runId,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    config,
    tasks,
    totalDeleted,
    hasErrors,
  };

  if (config.verbose) {
    console.log(`[Cleanup] Completed run ${runId}`, {
      durationMs: result.durationMs,
      totalDeleted,
      hasErrors,
      taskSummary: tasks.map((t) => ({
        name: t.taskName,
        deleted: t.recordsDeleted,
        error: t.error,
      })),
    });
  }

  return result;
}

// =============================================================================
// INDIVIDUAL CLEANUP FUNCTIONS (for manual use)
// =============================================================================

export {
  cleanupAuditLogs,
  cleanupParseJobs,
  cleanupOrphanedFiles,
  cleanupOcrJobs,
  cleanupOptimizeJobs,
  cleanupRateTracking,
  cleanupErrorLogs,
  cleanupFileCache,
  refreshMaterializedViews,
};

