/**
 * CAI Intake - Quick Dashboard API
 * 
 * GET /api/v1/dashboard/quick - Get essential user stats only (fast)
 * 
 * This endpoint returns minimal data for instant page load.
 * OPTIMIZED v2: Single query using CTEs, no correlated subqueries.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Single query using CTEs - faster than correlated subqueries
    type QuickStatsRow = {
      org_id: string | null;
      is_super_admin: boolean;
      role_name: string | null;
      cutlists_week: bigint;
      cutlists_month: bigint;
      active_jobs: bigint;
    };

    const result = await prisma.$queryRaw<QuickStatsRow[]>`
      WITH user_info AS (
        SELECT 
          u.organization_id as org_id,
          u.is_super_admin,
          r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ${user.id}::uuid
        LIMIT 1
      ),
      cutlist_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= ${startOfWeek}) as week_count,
          COUNT(*) FILTER (WHERE created_at >= ${startOfMonth}) as month_count
        FROM cutlists
        WHERE user_id = ${user.id}::uuid
      ),
      active_jobs AS (
        SELECT COUNT(*) as cnt
        FROM optimize_jobs oj 
        JOIN cutlists c ON oj.cutlist_id = c.id 
        WHERE c.user_id = ${user.id}::uuid 
          AND oj.status IN ('pending', 'processing')
      )
      SELECT 
        ui.org_id,
        ui.is_super_admin,
        ui.role_name,
        COALESCE(cs.week_count, 0) as cutlists_week,
        COALESCE(cs.month_count, 0) as cutlists_month,
        COALESCE(aj.cnt, 0) as active_jobs
      FROM user_info ui
      CROSS JOIN cutlist_stats cs
      CROSS JOIN active_jobs aj
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const row = result[0];
    const isOrgAdmin = row.org_id && ["org_admin", "manager"].includes(row.role_name || "");

    return NextResponse.json({
      user: {
        cutlistsThisWeek: Number(row.cutlists_week),
        cutlistsThisMonth: Number(row.cutlists_month),
        activeJobs: Number(row.active_jobs),
      },
      organizationId: row.org_id,
      isOrgAdmin,
      isSuperAdmin: row.is_super_admin,
    }, {
      headers: {
        // Cache for 30 seconds - quick stats are relatively stable
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
