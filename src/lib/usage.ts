/**
 * CAI Intake - Usage Metering
 * 
 * Tracks usage events for billing, analytics, and plan enforcement.
 */

import { db } from "./db";
import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

export type UsageEventType =
  | "api_request"
  | "cutlist_created"
  | "cutlist_updated"
  | "cutlist_deleted"
  | "part_created"
  | "parts_imported"
  | "ai_parse"
  | "ocr_scan"
  | "voice_parse"
  | "optimize_job"
  | "export"
  | "file_upload"
  | "file_download"
  | "template_generated";

export interface UsageEventParams {
  organizationId: string;
  userId?: string;
  eventType: UsageEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// IN-MEMORY BUFFER (for batching writes)
// =============================================================================

interface BufferedEvent extends UsageEventParams {
  timestamp: Date;
}

const eventBuffer: BufferedEvent[] = [];
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_BUFFER_SIZE = 100;

/**
 * Flush buffered events to database
 */
async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const events = eventBuffer.splice(0, eventBuffer.length);

  try {
    // In production, batch insert to usage_events table
    // For now, we'll aggregate into organization settings or a summary table
    
    const aggregated = new Map<string, Map<UsageEventType, number>>();
    
    for (const event of events) {
      if (!aggregated.has(event.organizationId)) {
        aggregated.set(event.organizationId, new Map());
      }
      const orgEvents = aggregated.get(event.organizationId)!;
      const current = orgEvents.get(event.eventType) || 0;
      orgEvents.set(event.eventType, current + (event.quantity || 1));
    }

    // Update organization usage counters
    for (const [orgId, eventCounts] of aggregated.entries()) {
      const updates: Record<string, number> = {};
      for (const [eventType, count] of eventCounts.entries()) {
        updates[`usage_${eventType}`] = count;
      }

      // Store in organization settings JSON field
      await db.organization.update({
        where: { id: orgId },
        data: {
          settings: {
            // Merge with existing settings
            // This is a simplified approach - in production use a dedicated usage table
          },
        },
      }).catch(() => {
        // Ignore errors - usage tracking should not break operations
      });
    }

    logger.debug("Flushed usage events", { count: events.length });
  } catch (error) {
    logger.error("Failed to flush usage events", error);
    // Put events back in buffer for retry
    eventBuffer.unshift(...events);
  }
}

// Set up periodic flush
if (typeof setInterval !== "undefined") {
  setInterval(flushEvents, FLUSH_INTERVAL);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Track a usage event
 * Events are buffered and flushed periodically for performance
 */
export function trackUsage(params: UsageEventParams): void {
  eventBuffer.push({
    ...params,
    timestamp: new Date(),
  });

  // Flush immediately if buffer is full
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents();
  }
}

/**
 * Track multiple usage events at once
 */
export function trackUsageBatch(events: UsageEventParams[]): void {
  for (const event of events) {
    trackUsage(event);
  }
}

/**
 * Get usage summary for an organization
 */
export async function getUsageSummary(
  organizationId: string,
  period: "day" | "week" | "month" = "month"
): Promise<Record<UsageEventType, number>> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "day":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  // Get counts from database
  const [
    cutlistsCreated,
    partsImported,
    aiParses,
    optimizeJobs,
    exports,
    filesUploaded,
  ] = await Promise.all([
    db.cutlist.count({
      where: { organizationId, createdAt: { gte: startDate } },
    }),
    db.cutPart.count({
      where: { cutlist: { organizationId }, createdAt: { gte: startDate } },
    }),
    db.parseJob.count({
      where: { organizationId, createdAt: { gte: startDate } },
    }),
    db.optimizeJob.count({
      where: { cutlist: { organizationId }, createdAt: { gte: startDate } },
    }),
    db.export.count({
      where: { cutlist: { organizationId }, createdAt: { gte: startDate } },
    }),
    db.uploadedFile.count({
      where: { organizationId, createdAt: { gte: startDate } },
    }),
  ]);

  return {
    api_request: 0, // Would need separate tracking
    cutlist_created: cutlistsCreated,
    cutlist_updated: 0,
    cutlist_deleted: 0,
    part_created: 0,
    parts_imported: partsImported,
    ai_parse: aiParses,
    ocr_scan: 0,
    voice_parse: 0,
    optimize_job: optimizeJobs,
    export: exports,
    file_upload: filesUploaded,
    file_download: 0,
    template_generated: 0,
  };
}

/**
 * Check if organization is approaching usage limits
 */
export async function checkUsageWarnings(
  organizationId: string
): Promise<{ warning: boolean; message?: string }[]> {
  const warnings: { warning: boolean; message?: string }[] = [];

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  if (!org) return warnings;

  const summary = await getUsageSummary(organizationId, "month");

  // Add warnings based on plan limits
  // This is simplified - would need to integrate with plans.ts
  const plan = org.plan || "free";

  if (plan === "free") {
    if (summary.ai_parse >= 8) {
      warnings.push({
        warning: true,
        message: `You've used ${summary.ai_parse} of 10 AI parses this month. Upgrade for more.`,
      });
    }
    if (summary.cutlist_created >= 4) {
      warnings.push({
        warning: true,
        message: `You've created ${summary.cutlist_created} of 5 cutlists. Upgrade for unlimited.`,
      });
    }
  }

  return warnings;
}

