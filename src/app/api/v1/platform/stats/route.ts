/**
 * CAI Intake - Platform Stats API (Super Admin Only)
 * 
 * GET /api/v1/platform/stats - Get platform-wide statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

// =============================================================================
// TYPES
// =============================================================================

interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  newUsersThisMonth: number;
  totalCutlists: number;
  parseJobsToday: number;
  averageConfidence: number;
  totalPartsProcessed: number;
  revenue: {
    monthly: number;
    growth: number;
  };
}

interface SystemHealth {
  api: { status: string; latency: number };
  database: { status: string; latency: number };
  storage: { status: string; usage: number };
  queue: { status: string; pending: number };
}

interface TopOrganization {
  id: string;
  name: string;
  users: number;
  cutlists: number;
  plan: string;
  status: string;
}

interface ActivityItem {
  id: string;
  type: "signup" | "upgrade" | "alert";
  message: string;
  time: string;
}

// =============================================================================
// GET - Platform Stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Organization stats
    const totalOrganizations = await prisma.organization.count();
    
    // Active orgs (have cutlists in last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeOrganizations = await prisma.organization.count({
      where: {
        cutlists: {
          some: { createdAt: { gte: thirtyDaysAgo } },
        },
      },
    });

    // User stats
    const totalUsers = await prisma.user.count();
    const newUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: startOfMonth } },
    });

    // Cutlist stats
    const totalCutlists = await prisma.cutlist.count();
    
    // Parse jobs today
    const parseJobsToday = await prisma.parseJob.count({
      where: { createdAt: { gte: startOfDay } },
    });

    // Total parts
    const totalPartsProcessed = await prisma.cutPart.count();

    // Average confidence from recent parse jobs (stored in summary.confidence_avg)
    const recentParseJobs = await prisma.parseJob.findMany({
      select: { summary: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    
    const confidenceValues = recentParseJobs
      .map(j => {
        if (!j.summary || typeof j.summary !== "object") return undefined;
        const summary = j.summary as { confidence_avg?: number };
        return summary?.confidence_avg;
      })
      .filter((c): c is number => typeof c === "number" && !isNaN(c));
    
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 0;

    // Platform stats
    const stats: PlatformStats = {
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      newUsersThisMonth,
      totalCutlists,
      parseJobsToday,
      averageConfidence: parseFloat(avgConfidence.toFixed(1)),
      totalPartsProcessed,
      revenue: {
        // Would need actual billing integration
        monthly: 0,
        growth: 0,
      },
    };

    // System health (simplified - would need actual monitoring)
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    const pendingJobs = await prisma.optimizeJob.count({
      where: { status: { in: ["pending", "processing"] } },
    });

    const systemHealth: SystemHealth = {
      api: { status: "healthy", latency: 45 }, // Would need actual API metrics
      database: { status: dbLatency < 100 ? "healthy" : "warning", latency: dbLatency },
      storage: { status: "healthy", usage: 45 }, // Would need actual storage metrics
      queue: { status: pendingJobs > 50 ? "warning" : "healthy", pending: pendingJobs },
    };

    // Top organizations
    const topOrgsData = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        _count: {
          select: {
            users: true,
            cutlists: true,
          },
        },
      },
      orderBy: {
        cutlists: { _count: "desc" },
      },
      take: 5,
    });

    const topOrganizations: TopOrganization[] = topOrgsData.map(org => ({
      id: org.id,
      name: org.name,
      users: org._count.users,
      cutlists: org._count.cutlists,
      plan: org.plan || "free",
      status: "active",
    }));

    // Recent activity
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: {
        id: true,
        email: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const recentActivity: ActivityItem[] = recentUsers.map((u, i) => ({
      id: u.id,
      type: "signup" as const,
      message: u.organization
        ? `New user: ${u.email} joined ${u.organization.name}`
        : `New user registered: ${u.email}`,
      time: formatTimeAgo(u.createdAt),
    }));

    return NextResponse.json({
      stats,
      systemHealth,
      topOrganizations,
      recentActivity,
    });
  } catch (error) {
    console.error("Platform stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform stats" },
      { status: 500 }
    );
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

