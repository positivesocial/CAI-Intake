/**
 * CAI Intake - Dashboard API
 * 
 * GET /api/v1/dashboard - Get dashboard statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// TYPES
// =============================================================================

interface DashboardStats {
  user: {
    cutlistsThisWeek: number;
    cutlistsThisMonth: number;
    partsProcessed: number;
    averageConfidence: number;
    activeJobs: number;
  };
  organization?: {
    totalMembers: number;
    activeToday: number;
    totalCutlists: number;
    totalParts: number;
    storageUsed: number;
    monthlyGrowth: number;
  };
  platform?: {
    totalOrganizations: number;
    totalUsers: number;
    totalCutlists: number;
    activeUsersToday: number;
    parseJobsToday: number;
    optimizeJobsToday: number;
  };
  recentActivity: Array<{
    id: string;
    type: "cutlist" | "parse" | "optimize" | "export";
    name: string;
    status: string;
    createdAt: Date;
  }>;
  recentCutlists: Array<{
    id: string;
    name: string;
    partsCount: number;
    status: string;
    createdAt: Date;
  }>;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user details
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true, 
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // User stats
    const userCutlistsThisWeek = await prisma.cutlist.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfWeek },
      },
    });

    const userCutlistsThisMonth = await prisma.cutlist.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfMonth },
      },
    });

    const userPartsCount = await prisma.cutPart.count({
      where: {
        cutlist: { userId: user.id },
      },
    });

    const activeJobs = await prisma.optimizeJob.count({
      where: {
        cutlist: { userId: user.id },
        status: { in: ["pending", "processing"] },
      },
    });

    // Recent cutlists
    const recentCutlists = await prisma.cutlist.findMany({
      where: dbUser?.organizationId 
        ? { organizationId: dbUser.organizationId }
        : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { parts: true } },
      },
    });

    // Recent activity
    const recentParseJobs = await prisma.parseJob.findMany({
      where: dbUser?.organizationId 
        ? { organizationId: dbUser.organizationId }
        : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        sourceKind: true,
        createdAt: true,
      },
    });

    const recentOptimizeJobs = await prisma.optimizeJob.findMany({
      where: dbUser?.organizationId 
        ? { cutlist: { organizationId: dbUser.organizationId } }
        : { cutlist: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        cutlist: { select: { name: true } },
        createdAt: true,
      },
    });

    // Build dashboard stats
    const stats: DashboardStats = {
      user: {
        cutlistsThisWeek: userCutlistsThisWeek,
        cutlistsThisMonth: userCutlistsThisMonth,
        partsProcessed: userPartsCount,
        averageConfidence: 94.2, // Mock for now
        activeJobs,
      },
      recentActivity: [
        ...recentParseJobs.map(j => ({
          id: j.id,
          type: "parse" as const,
          name: `Parse job (${j.sourceKind})`,
          status: j.status,
          createdAt: j.createdAt,
        })),
        ...recentOptimizeJobs.map(j => ({
          id: j.id,
          type: "optimize" as const,
          name: j.cutlist?.name || "Optimization",
          status: j.status,
          createdAt: j.createdAt,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10),
      recentCutlists: recentCutlists.map(c => ({
        id: c.id,
        name: c.name || "Untitled Cutlist",
        partsCount: c._count.parts,
        status: c.status,
        createdAt: c.createdAt,
      })),
    };

    // Organization stats (for org admins)
    if (dbUser?.organizationId && ["org_admin", "manager"].includes(dbUser.role?.name || "")) {
      const orgMemberCount = await prisma.user.count({
        where: { organizationId: dbUser.organizationId },
      });

      const orgCutlistCount = await prisma.cutlist.count({
        where: { organizationId: dbUser.organizationId },
      });

      const orgPartsCount = await prisma.cutPart.count({
        where: { cutlist: { organizationId: dbUser.organizationId } },
      });

      // Monthly growth calculation
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const cutlistsLastMonth = await prisma.cutlist.count({
        where: {
          organizationId: dbUser.organizationId,
          createdAt: { gte: lastMonthStart, lt: startOfMonth },
        },
      });
      const cutlistsCurrentMonth = await prisma.cutlist.count({
        where: {
          organizationId: dbUser.organizationId,
          createdAt: { gte: startOfMonth },
        },
      });
      const monthlyGrowth = cutlistsLastMonth > 0 
        ? ((cutlistsCurrentMonth - cutlistsLastMonth) / cutlistsLastMonth) * 100
        : 0;

      stats.organization = {
        totalMembers: orgMemberCount,
        activeToday: 0, // Would need session tracking
        totalCutlists: orgCutlistCount,
        totalParts: orgPartsCount,
        storageUsed: 0, // Would need storage calculation
        monthlyGrowth,
      };
    }

    // Platform stats (for super admins)
    if (dbUser?.isSuperAdmin) {
      const totalOrgs = await prisma.organization.count();
      const totalUsers = await prisma.user.count();
      const totalCutlists = await prisma.cutlist.count();
      const parseJobsToday = await prisma.parseJob.count({
        where: { createdAt: { gte: startOfDay } },
      });
      const optimizeJobsToday = await prisma.optimizeJob.count({
        where: { createdAt: { gte: startOfDay } },
      });

      stats.platform = {
        totalOrganizations: totalOrgs,
        totalUsers,
        totalCutlists,
        activeUsersToday: 0, // Would need session tracking
        parseJobsToday,
        optimizeJobsToday,
      };
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

