/**
 * CAI Intake - Quick Dashboard API
 * 
 * GET /api/v1/dashboard/quick - Get essential user stats only (fast)
 * 
 * This endpoint returns minimal data for instant page load.
 * The full dashboard data is loaded lazily afterward.
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

    // Get user info first (needed for other queries)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true, 
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    // Single transaction for all count queries
    const [cutlistsThisWeek, cutlistsThisMonth, activeJobs] = await prisma.$transaction([
      prisma.cutlist.count({
        where: { userId: user.id, createdAt: { gte: startOfWeek } },
      }),
      prisma.cutlist.count({
        where: { userId: user.id, createdAt: { gte: startOfMonth } },
      }),
      prisma.optimizeJob.count({
        where: { cutlist: { userId: user.id }, status: { in: ["pending", "processing"] } },
      }),
    ]);

    const isOrgAdmin = dbUser?.organizationId && 
      ["org_admin", "manager"].includes(dbUser.role?.name || "");

    return NextResponse.json({
      user: {
        cutlistsThisWeek,
        cutlistsThisMonth,
        activeJobs,
      },
      organizationId: dbUser?.organizationId,
      isOrgAdmin,
      isSuperAdmin: dbUser?.isSuperAdmin,
    });
  } catch (error) {
    console.error("Quick dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quick stats" },
      { status: 500 }
    );
  }
}

