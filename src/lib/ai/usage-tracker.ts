/**
 * CAI Intake - AI Usage Tracker
 * 
 * Tracks AI provider usage and calculates costs based on token counts.
 * Supports Anthropic, OpenAI, and Python OCR services.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

// =============================================================================
// PRICING CONFIGURATION
// =============================================================================

// Pricing per 1M tokens (as of Jan 2026)
export const AI_PRICING = {
  anthropic: {
    "claude-sonnet-4-5-20250929": {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    },
    "claude-opus-4-5-20251124": {
      inputPer1M: 15.00,
      outputPer1M: 75.00,
    },
    "claude-3-5-sonnet-latest": {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    },
    "claude-3-haiku-20240307": {
      inputPer1M: 0.25,
      outputPer1M: 1.25,
    },
  },
  openai: {
    "gpt-4o": {
      inputPer1M: 2.50,
      outputPer1M: 10.00,
    },
    "gpt-4o-mini": {
      inputPer1M: 0.15,
      outputPer1M: 0.60,
    },
    "gpt-4-turbo": {
      inputPer1M: 10.00,
      outputPer1M: 30.00,
    },
  },
  "python-ocr": {
    default: {
      inputPer1M: 0, // No token cost
      outputPer1M: 0,
      costPerPage: 0.001, // Cost per OCR page
    },
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface UsageLogParams {
  organizationId: string;
  userId?: string;
  provider: "anthropic" | "openai" | "python-ocr";
  model: string;
  operation: "parse_text" | "parse_image" | "parse_pdf" | "ocr" | "training";
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  // For OCR, we might not have tokens but pages
  ocrPages?: number;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

export interface ProviderStats extends UsageStats {
  provider: string;
  models: Record<string, UsageStats>;
}

export interface OrgUsageStats extends UsageStats {
  organizationId: string;
  organizationName: string;
}

// =============================================================================
// COST CALCULATION
// =============================================================================

/**
 * Calculate cost for a given usage.
 */
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  ocrPages?: number
): number {
  if (provider === "python-ocr") {
    const pricing = AI_PRICING["python-ocr"].default;
    return (ocrPages || 1) * pricing.costPerPage;
  }

  const providerPricing = AI_PRICING[provider as keyof typeof AI_PRICING];
  if (!providerPricing) {
    logger.warn(`Unknown provider for pricing: ${provider}`);
    return 0;
  }

  // Try exact model match first, then fallback to partial match
  let modelPricing = providerPricing[model as keyof typeof providerPricing];
  
  if (!modelPricing) {
    // Try partial match (e.g., "gpt-4o-2024-08-06" -> "gpt-4o")
    const modelBase = Object.keys(providerPricing).find(key => 
      model.startsWith(key) || key.startsWith(model.split("-").slice(0, 2).join("-"))
    );
    if (modelBase) {
      modelPricing = providerPricing[modelBase as keyof typeof providerPricing];
    }
  }

  if (!modelPricing || typeof modelPricing !== "object") {
    logger.warn(`Unknown model for pricing: ${provider}/${model}`);
    // Use default conservative estimate
    return (inputTokens / 1_000_000) * 5 + (outputTokens / 1_000_000) * 15;
  }

  const inputCost = (inputTokens / 1_000_000) * (modelPricing as { inputPer1M: number }).inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * (modelPricing as { outputPer1M: number }).outputPer1M;

  return inputCost + outputCost;
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Log AI usage to the database.
 */
export async function logAIUsage(params: UsageLogParams): Promise<void> {
  try {
    const totalTokens = (params.inputTokens || 0) + (params.outputTokens || 0);
    const costUsd = calculateCost(
      params.provider,
      params.model,
      params.inputTokens || 0,
      params.outputTokens || 0,
      params.ocrPages
    );

    await prisma.aIUsageLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        inputTokens: params.inputTokens || 0,
        outputTokens: params.outputTokens || 0,
        totalTokens,
        costUsd: new Decimal(costUsd),
        durationMs: params.durationMs || 0,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    logger.debug("📊 [AI Usage] Logged", {
      provider: params.provider,
      model: params.model,
      tokens: totalTokens,
      costUsd: costUsd.toFixed(6),
      organizationId: params.organizationId,
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    logger.error("📊 [AI Usage] Failed to log usage", {
      error: error instanceof Error ? error.message : "Unknown",
      params,
    });
  }
}

// =============================================================================
// ANALYTICS QUERIES
// =============================================================================

/**
 * Get usage statistics for a time period.
 */
export async function getUsageStats(
  startDate: Date,
  endDate?: Date
): Promise<UsageStats> {
  const where = {
    createdAt: {
      gte: startDate,
      ...(endDate ? { lte: endDate } : {}),
    },
  };

  const [aggregate, counts] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where,
      _sum: {
        totalTokens: true,
        costUsd: true,
        durationMs: true,
      },
      _count: true,
    }),
    prisma.aIUsageLog.groupBy({
      by: ["success"],
      where,
      _count: true,
    }),
  ]);

  const successCount = counts.find(c => c.success)?._count || 0;
  const failCount = counts.find(c => !c.success)?._count || 0;

  return {
    totalRequests: aggregate._count,
    successfulRequests: successCount,
    failedRequests: failCount,
    totalTokens: aggregate._sum.totalTokens || 0,
    totalCostUsd: Number(aggregate._sum.costUsd || 0),
    avgDurationMs: aggregate._count > 0 
      ? Math.round((aggregate._sum.durationMs || 0) / aggregate._count)
      : 0,
  };
}

/**
 * Get usage statistics broken down by provider.
 */
export async function getProviderStats(
  startDate: Date,
  endDate?: Date
): Promise<ProviderStats[]> {
  const where = {
    createdAt: {
      gte: startDate,
      ...(endDate ? { lte: endDate } : {}),
    },
  };

  const providerStats = await prisma.aIUsageLog.groupBy({
    by: ["provider", "model"],
    where,
    _sum: {
      totalTokens: true,
      costUsd: true,
      durationMs: true,
    },
    _count: true,
  });

  const successCounts = await prisma.aIUsageLog.groupBy({
    by: ["provider", "success"],
    where,
    _count: true,
  });

  // Aggregate by provider
  const providerMap = new Map<string, ProviderStats>();

  for (const stat of providerStats) {
    if (!providerMap.has(stat.provider)) {
      const successCount = successCounts
        .filter(c => c.provider === stat.provider && c.success)
        .reduce((sum, c) => sum + c._count, 0);
      const failCount = successCounts
        .filter(c => c.provider === stat.provider && !c.success)
        .reduce((sum, c) => sum + c._count, 0);

      providerMap.set(stat.provider, {
        provider: stat.provider,
        totalRequests: 0,
        successfulRequests: successCount,
        failedRequests: failCount,
        totalTokens: 0,
        totalCostUsd: 0,
        avgDurationMs: 0,
        models: {},
      });
    }

    const p = providerMap.get(stat.provider)!;
    p.totalRequests += stat._count;
    p.totalTokens += stat._sum.totalTokens || 0;
    p.totalCostUsd += Number(stat._sum.costUsd || 0);

    // Add model stats
    p.models[stat.model] = {
      totalRequests: stat._count,
      successfulRequests: stat._count, // We don't have per-model success tracking
      failedRequests: 0,
      totalTokens: stat._sum.totalTokens || 0,
      totalCostUsd: Number(stat._sum.costUsd || 0),
      avgDurationMs: stat._count > 0 
        ? Math.round((stat._sum.durationMs || 0) / stat._count)
        : 0,
    };
  }

  // Calculate average durations
  for (const p of providerMap.values()) {
    if (p.totalRequests > 0) {
      const totalDuration = Object.values(p.models).reduce(
        (sum, m) => sum + m.avgDurationMs * m.totalRequests, 0
      );
      p.avgDurationMs = Math.round(totalDuration / p.totalRequests);
    }
  }

  return Array.from(providerMap.values());
}

/**
 * Get usage statistics broken down by organization.
 */
export async function getOrgUsageStats(
  startDate: Date,
  endDate?: Date,
  limit: number = 10
): Promise<OrgUsageStats[]> {
  const where = {
    createdAt: {
      gte: startDate,
      ...(endDate ? { lte: endDate } : {}),
    },
  };

  const orgStats = await prisma.aIUsageLog.groupBy({
    by: ["organizationId"],
    where,
    _sum: {
      totalTokens: true,
      costUsd: true,
      durationMs: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        costUsd: "desc",
      },
    },
    take: limit,
  });

  // Get organization names
  const orgIds = orgStats.map(s => s.organizationId);
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNameMap = new Map(orgs.map(o => [o.id, o.name]));

  // Get success counts per org
  const successCounts = await prisma.aIUsageLog.groupBy({
    by: ["organizationId", "success"],
    where: {
      ...where,
      organizationId: { in: orgIds },
    },
    _count: true,
  });

  return orgStats.map(stat => {
    const successCount = successCounts
      .filter(c => c.organizationId === stat.organizationId && c.success)
      .reduce((sum, c) => sum + c._count, 0);
    const failCount = successCounts
      .filter(c => c.organizationId === stat.organizationId && !c.success)
      .reduce((sum, c) => sum + c._count, 0);

    return {
      organizationId: stat.organizationId,
      organizationName: orgNameMap.get(stat.organizationId) || "Unknown",
      totalRequests: stat._count,
      successfulRequests: successCount,
      failedRequests: failCount,
      totalTokens: stat._sum.totalTokens || 0,
      totalCostUsd: Number(stat._sum.costUsd || 0),
      avgDurationMs: stat._count > 0 
        ? Math.round((stat._sum.durationMs || 0) / stat._count)
        : 0,
    };
  });
}

/**
 * Get daily usage for a time period.
 */
export async function getDailyUsage(
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
}>> {
  // Use raw SQL for date grouping
  const results = await prisma.$queryRaw<Array<{
    date: string;
    requests: bigint;
    tokens: bigint;
    cost: string;
    errors: bigint;
  }>>`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(*) FILTER (WHERE NOT success) as errors
    FROM ai_usage_logs
    WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return results.map(r => ({
    date: String(r.date),
    requests: Number(r.requests),
    tokens: Number(r.tokens),
    cost: parseFloat(r.cost) || 0,
    errors: Number(r.errors),
  }));
}

/**
 * Get error breakdown.
 */
export async function getErrorBreakdown(
  startDate: Date,
  endDate?: Date
): Promise<Array<{
  type: string;
  count: number;
  lastOccurred: string;
  severity: "error" | "warning";
}>> {
  const where = {
    success: false,
    createdAt: {
      gte: startDate,
      ...(endDate ? { lte: endDate } : {}),
    },
  };

  const errors = await prisma.aIUsageLog.groupBy({
    by: ["errorMessage"],
    where,
    _count: true,
    orderBy: {
      _count: {
        errorMessage: "desc",
      },
    },
    take: 10,
  });

  // Get last occurrence for each error type
  const errorTypes = errors.map(e => e.errorMessage).filter(Boolean);
  const lastOccurrences = await Promise.all(
    errorTypes.map(async (errorMsg) => {
      const last = await prisma.aIUsageLog.findFirst({
        where: { errorMessage: errorMsg, success: false },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return { errorMsg, lastOccurred: last?.createdAt };
    })
  );
  const lastOccMap = new Map(lastOccurrences.map(l => [l.errorMsg, l.lastOccurred]));

  return errors
    .filter(e => e.errorMessage)
    .map(e => ({
      type: e.errorMessage || "unknown",
      count: e._count,
      lastOccurred: lastOccMap.get(e.errorMessage)?.toISOString() || "-",
      severity: (e.errorMessage?.toLowerCase().includes("timeout") || 
                 e.errorMessage?.toLowerCase().includes("rate")) 
        ? "warning" as const 
        : "error" as const,
    }));
}

