/**
 * CAI Intake - OCR Performance Metrics API
 * 
 * GET /api/v1/ocr/metrics
 * Returns OCR processing performance metrics and cache statistics.
 * 
 * Requires authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCacheStats } from "@/lib/ai/ocr-cache";
import { getPerformanceMetrics } from "@/lib/ai/ocr-optimizer";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get metrics
    const cacheStats = getCacheStats();
    const performanceMetrics = getPerformanceMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        entries: cacheStats.entries,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
        avgTimeSavedMs: Math.round(cacheStats.avgSavedTimeMs),
      },
      performance: {
        totalRequests: performanceMetrics.totalRequests,
        avgProcessingTimeMs: Math.round(performanceMetrics.avgProcessingTimeMs),
        p50ProcessingTimeMs: Math.round(performanceMetrics.p50ProcessingTimeMs),
        p95ProcessingTimeMs: Math.round(performanceMetrics.p95ProcessingTimeMs),
        cacheHitRate: `${(performanceMetrics.cacheHitRate * 100).toFixed(1)}%`,
        primarySuccessRate: `${(performanceMetrics.primarySuccessRate * 100).toFixed(1)}%`,
        fallbackUsageRate: `${(performanceMetrics.fallbackUsageRate * 100).toFixed(1)}%`,
        avgPartsPerRequest: performanceMetrics.avgPartsPerRequest.toFixed(1),
      },
      recommendations: generateRecommendations(cacheStats, performanceMetrics),
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: "Failed to get metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate optimization recommendations based on metrics
 */
function generateRecommendations(
  cache: ReturnType<typeof getCacheStats>,
  perf: ReturnType<typeof getPerformanceMetrics>
): string[] {
  const recommendations: string[] = [];

  // Cache recommendations
  if (cache.hitRate < 0.1 && cache.misses > 10) {
    recommendations.push("Low cache hit rate. Consider enabling cache warming for frequently used templates.");
  }
  if (cache.entries >= 90) {
    recommendations.push("Cache near capacity. Consider increasing MAX_CACHE_ENTRIES for better hit rates.");
  }

  // Performance recommendations
  if (perf.avgProcessingTimeMs > 60000) {
    recommendations.push("Average processing time is high. Consider enabling parallel provider racing.");
  }
  if (perf.fallbackUsageRate > 0.3) {
    recommendations.push("High fallback usage. Check primary provider health and rate limits.");
  }
  if (perf.primarySuccessRate < 0.8 && perf.totalRequests > 10) {
    recommendations.push("Primary provider success rate is low. Review error logs for patterns.");
  }
  if (perf.p95ProcessingTimeMs > 120000) {
    recommendations.push("P95 latency is very high. Consider aggressive image optimization.");
  }

  // Good performance indicators
  if (cache.hitRate > 0.5 && cache.avgSavedTimeMs > 30000) {
    recommendations.push("✅ Cache is saving significant processing time!");
  }
  if (perf.primarySuccessRate > 0.95) {
    recommendations.push("✅ Primary provider performing excellently!");
  }

  return recommendations.length > 0 ? recommendations : ["All metrics within normal ranges."];
}

