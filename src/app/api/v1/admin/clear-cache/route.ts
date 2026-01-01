/**
 * CAI Intake - Clear OCR Cache API
 * 
 * POST /api/v1/admin/clear-cache
 * Clears the in-memory OCR cache. Requires super admin access.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { resetOCRCache, getCacheStats } from "@/lib/ai/ocr-cache";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if super admin - use email for lookup since Supabase auth ID may differ from Prisma user ID
    const userData = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { isSuperAdmin: true },
    });

    if (!userData?.isSuperAdmin) {
      return NextResponse.json({ error: "Requires super admin access" }, { status: 403 });
    }

    // Get stats before clearing
    const statsBefore = getCacheStats();

    // Clear the cache
    resetOCRCache();

    // Get stats after clearing
    const statsAfter = getCacheStats();

    return NextResponse.json({
      success: true,
      message: "OCR cache cleared successfully",
      before: {
        entries: statsBefore.entries,
        hitRate: `${(statsBefore.hitRate * 100).toFixed(1)}%`,
      },
      after: {
        entries: statsAfter.entries,
        hitRate: `${(statsAfter.hitRate * 100).toFixed(1)}%`,
      },
    });
  } catch (error) {
    console.error("Clear cache error:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get cache stats
    const stats = getCacheStats();

    return NextResponse.json({
      entries: stats.entries,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
    });
  } catch (error) {
    console.error("Get cache stats error:", error);
    return NextResponse.json(
      { error: "Failed to get cache stats" },
      { status: 500 }
    );
  }
}

