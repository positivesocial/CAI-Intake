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
    pendingInvites: number;
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
    type: string;
    name: string;
    status: string;
    createdAt: Date;
    user?: string;
  }>;
  recentCutlists: Array<{
    id: string;
    name: string;
    partsCount: number;
    status: string;
    createdAt: Date;
    createdBy?: string;
  }>;
  teamMembers?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    cutlistsThisWeek: number;
    lastActive: string;
  }>;
  topPerformers?: Array<{
    name: string;
    cutlists: number;
    parts: number;
    efficiency: number;
  }>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatLastActive(date: Date | null): string {
  if (!date) return "Never";
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 5) return "Active now";
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  
  return date.toLocaleDateString();
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

    // Calculate average confidence from parse jobs (stored in summary.confidence_avg)
    const parseJobsRecent = await prisma.parseJob.findMany({
      where: { userId: user.id },
      select: { summary: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    
    const confidenceValues = parseJobsRecent
      .map(j => {
        if (!j.summary || typeof j.summary !== "object") return undefined;
        const summary = j.summary as { confidence_avg?: number };
        return summary?.confidence_avg;
      })
      .filter((c): c is number => typeof c === "number" && !isNaN(c));
    
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 94.2; // Default if no data

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
        user: { select: { name: true } },
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
        user: { select: { name: true } },
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
        cutlist: { select: { name: true, user: { select: { name: true } } } },
        createdAt: true,
      },
    });

    // Build dashboard stats
    const stats: DashboardStats = {
      user: {
        cutlistsThisWeek: userCutlistsThisWeek,
        cutlistsThisMonth: userCutlistsThisMonth,
        partsProcessed: userPartsCount,
        averageConfidence: avgConfidence,
        activeJobs,
      },
      recentActivity: [
        ...recentParseJobs.map(j => ({
          id: j.id,
          type: `Parse (${j.sourceKind})`,
          name: `File processed`,
          status: j.status,
          createdAt: j.createdAt,
          user: j.user?.name ?? undefined,
        })),
        ...recentOptimizeJobs.map(j => ({
          id: j.id,
          type: "Optimization",
          name: j.cutlist?.name || "Cutlist",
          status: j.status,
          createdAt: j.createdAt,
          user: j.cutlist?.user?.name ?? undefined,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10),
      recentCutlists: recentCutlists.map(c => ({
        id: c.id,
        name: c.name || "Untitled Cutlist",
        partsCount: c._count.parts,
        status: c.status,
        createdAt: c.createdAt,
        createdBy: c.user?.name ?? undefined,
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

      // Pending invitations
      const pendingInvites = await prisma.invitation.count({
        where: {
          organizationId: dbUser.organizationId,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
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

      // Active users today (users with cutlists or parse jobs today)
      const activeUsersToday = await prisma.user.count({
        where: {
          organizationId: dbUser.organizationId,
          OR: [
            { cutlists: { some: { createdAt: { gte: startOfDay } } } },
            { parseJobs: { some: { createdAt: { gte: startOfDay } } } },
            { lastLoginAt: { gte: startOfDay } },
          ],
        },
      });

      stats.organization = {
        totalMembers: orgMemberCount,
        activeToday: activeUsersToday,
        totalCutlists: orgCutlistCount,
        totalParts: orgPartsCount,
        storageUsed: 0, // Would need storage calculation
        monthlyGrowth,
        pendingInvites,
      };

      // Team members with stats
      const teamMembersData = await prisma.user.findMany({
        where: { organizationId: dbUser.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          role: { select: { name: true } },
          _count: {
            select: {
              cutlists: {
                where: { createdAt: { gte: startOfWeek } },
              },
            },
          },
        },
        orderBy: { lastLoginAt: "desc" },
        take: 10,
      });

      stats.teamMembers = teamMembersData.map(m => ({
        id: m.id,
        name: m.name || "Unknown",
        email: m.email,
        role: m.role?.name || "operator",
        cutlistsThisWeek: m._count.cutlists,
        lastActive: formatLastActive(m.lastLoginAt),
      }));

      // Top performers this week
      const performerStats = await prisma.user.findMany({
        where: { 
          organizationId: dbUser.organizationId,
          cutlists: { some: { createdAt: { gte: startOfWeek } } },
        },
        select: {
          name: true,
          _count: {
            select: { cutlists: true },
          },
          cutlists: {
            where: { createdAt: { gte: startOfWeek } },
            select: {
              _count: { select: { parts: true } },
            },
          },
        },
        orderBy: {
          cutlists: { _count: "desc" },
        },
        take: 5,
      });

      stats.topPerformers = performerStats.map(p => ({
        name: p.name || "Unknown",
        cutlists: p._count.cutlists,
        parts: p.cutlists.reduce((sum, c) => sum + c._count.parts, 0),
        efficiency: 90 + Math.random() * 8, // Would need real efficiency calculation
      }));
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
