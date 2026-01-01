/**
 * CAI Intake - Quick Dashboard API
 * 
 * GET /api/v1/dashboard/quick - Get essential user stats only (fast)
 * 
 * This endpoint returns minimal data for instant page load.
 * OPTIMIZED v3: Use Prisma ORM for user lookup, raw SQL for stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate UUID format to prevent SQL injection
    if (!UUID_REGEX.test(user.id)) {
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Use Prisma ORM for user lookup (simpler and type-safe)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        organizationId: true,
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create safe UUID literal for raw SQL (validated above)
    const userIdLiteral = Prisma.raw(`'${user.id}'::uuid`);

    // Single query for stats using CTEs
    type StatsRow = {
      cutlists_week: bigint;
      cutlists_month: bigint;
      active_jobs: bigint;
    };

    const statsResult = await prisma.$queryRaw<StatsRow[]>`
      WITH 
        cutlist_stats AS (
          SELECT 
            COUNT(*) FILTER (WHERE created_at >= ${startOfWeek}) as week_count,
            COUNT(*) FILTER (WHERE created_at >= ${startOfMonth}) as month_count
          FROM cutlists
          WHERE user_id = ${userIdLiteral}
        ),
        active_jobs AS (
          SELECT COUNT(*) as cnt
          FROM optimize_jobs oj 
          JOIN cutlists c ON oj.cutlist_id = c.id 
          WHERE c.user_id = ${userIdLiteral}
            AND oj.status IN ('pending', 'processing')
        )
      SELECT 
        COALESCE(cs.week_count, 0) as cutlists_week,
        COALESCE(cs.month_count, 0) as cutlists_month,
        COALESCE(aj.cnt, 0) as active_jobs
      FROM cutlist_stats cs
      CROSS JOIN active_jobs aj
    `;

    const stats = statsResult[0] || { cutlists_week: BigInt(0), cutlists_month: BigInt(0), active_jobs: BigInt(0) };
    const isOrgAdmin = dbUser.organizationId && ["org_admin", "manager"].includes(dbUser.role?.name || "");

    return NextResponse.json({
      user: {
        cutlistsThisWeek: Number(stats.cutlists_week),
        cutlistsThisMonth: Number(stats.cutlists_month),
        activeJobs: Number(stats.active_jobs),
      },
      organizationId: dbUser.organizationId,
      isOrgAdmin,
      isSuperAdmin: dbUser.isSuperAdmin,
    }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Quick dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quick stats" },
      { status: 500 }
    );
  }
}
