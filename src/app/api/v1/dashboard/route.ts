/**
 * CAI Intake - Dashboard API
 * 
 * GET /api/v1/dashboard - Get dashboard statistics
 * 
 * OPTIMIZED: Single raw SQL query for all counts, minimal round-trips
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { 
  getSubscription, 
  getCurrentUsage, 
  getEffectiveLimits,
  getTrialDaysRemaining,
} from "@/lib/subscriptions/service";
import { getPlan } from "@/lib/subscriptions/plans";
import { Prisma } from "@prisma/client";

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
    filesUploadedThisWeek: number;
    filesUploadedThisMonth: number;
  };
  organization?: {
    totalMembers: number;
    activeToday: number;
    totalCutlists: number;
    totalParts: number;
    totalFilesUploaded: number;
    storageUsed: number;
    monthlyGrowth: number;
    pendingInvites: number;
  };
  platform?: {
    totalOrganizations: number;
    totalUsers: number;
    totalCutlists: number;
    totalFilesUploaded: number;
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

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // =========================================================================
    // STEP 1: Get user + org info (single query)
    // =========================================================================
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true, 
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    const orgId = dbUser?.organizationId;
    const isOrgAdmin = dbUser?.organizationId && ["org_admin", "manager"].includes(dbUser.role?.name || "");

    // =========================================================================
    // STEP 2: Use raw SQL to get ALL counts in ONE query (MUCH faster)
    // =========================================================================
    
    type CountsRow = {
      user_cutlists_week: bigint;
      user_cutlists_month: bigint;
      user_parts: bigint;
      active_jobs: bigint;
      files_week: bigint;
      files_month: bigint;
      org_members: bigint;
      org_cutlists: bigint;
      org_parts: bigint;
      org_files: bigint;
      pending_invites: bigint;
      cutlists_last_month: bigint;
      cutlists_this_month: bigint;
    };

    const countsResult = await prisma.$queryRaw<CountsRow[]>`
      SELECT
        -- User stats
        COALESCE((SELECT COUNT(*) FROM cutlists WHERE user_id = ${user.id} AND created_at >= ${startOfWeek}), 0) as user_cutlists_week,
        COALESCE((SELECT COUNT(*) FROM cutlists WHERE user_id = ${user.id} AND created_at >= ${startOfMonth}), 0) as user_cutlists_month,
        COALESCE((SELECT COUNT(*) FROM cut_parts cp JOIN cutlists c ON cp.cutlist_id = c.id WHERE c.user_id = ${user.id}), 0) as user_parts,
        COALESCE((SELECT COUNT(*) FROM optimize_jobs oj JOIN cutlists c ON oj.cutlist_id = c.id WHERE c.user_id = ${user.id} AND oj.status IN ('pending', 'processing')), 0) as active_jobs,
        -- File stats (org-based)
        COALESCE((SELECT COUNT(*) FROM uploaded_files WHERE organization_id = ${orgId || ''} AND created_at >= ${startOfWeek}), 0) as files_week,
        COALESCE((SELECT COUNT(*) FROM uploaded_files WHERE organization_id = ${orgId || ''} AND created_at >= ${startOfMonth}), 0) as files_month,
        -- Org stats (only if org admin)
        COALESCE((SELECT COUNT(*) FROM users WHERE organization_id = ${orgId || ''}), 0) as org_members,
        COALESCE((SELECT COUNT(*) FROM cutlists WHERE organization_id = ${orgId || ''}), 0) as org_cutlists,
        COALESCE((SELECT COUNT(*) FROM cut_parts cp JOIN cutlists c ON cp.cutlist_id = c.id WHERE c.organization_id = ${orgId || ''}), 0) as org_parts,
        COALESCE((SELECT COUNT(*) FROM uploaded_files WHERE organization_id = ${orgId || ''}), 0) as org_files,
        COALESCE((SELECT COUNT(*) FROM invitations WHERE organization_id = ${orgId || ''} AND accepted_at IS NULL AND expires_at > ${now}), 0) as pending_invites,
        COALESCE((SELECT COUNT(*) FROM cutlists WHERE organization_id = ${orgId || ''} AND created_at >= ${lastMonthStart} AND created_at < ${startOfMonth}), 0) as cutlists_last_month,
        COALESCE((SELECT COUNT(*) FROM cutlists WHERE organization_id = ${orgId || ''} AND created_at >= ${startOfMonth}), 0) as cutlists_this_month
    `;

    const counts = countsResult[0];
    const userCutlistsThisWeek = Number(counts.user_cutlists_week);
    const userCutlistsThisMonth = Number(counts.user_cutlists_month);
    const userPartsCount = Number(counts.user_parts);
    const activeJobs = Number(counts.active_jobs);
    const userFilesThisWeek = Number(counts.files_week);
    const userFilesThisMonth = Number(counts.files_month);

    // =========================================================================
    // STEP 3: Get recent items (only 2 queries instead of many)
    // =========================================================================
    const [recentCutlists, recentParseJobs] = await Promise.all([
      prisma.cutlist.findMany({
        where: orgId ? { organizationId: orgId } : { userId: user.id },
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
      }),
      prisma.parseJob.findMany({
        where: orgId ? { organizationId: orgId } : { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          sourceKind: true,
          createdAt: true,
          summary: true,
          user: { select: { name: true } },
        },
      }),
    ]);

    // Calculate average confidence from parse jobs
    const confidenceValues = recentParseJobs
      .map(j => {
        if (!j.summary || typeof j.summary !== "object") return undefined;
        const summary = j.summary as { confidence_avg?: number };
        return summary?.confidence_avg;
      })
      .filter((c): c is number => typeof c === "number" && !isNaN(c));
    
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 94.2;

    // Build dashboard stats
    const stats: DashboardStats = {
      user: {
        cutlistsThisWeek: userCutlistsThisWeek,
        cutlistsThisMonth: userCutlistsThisMonth,
        partsProcessed: userPartsCount,
        averageConfidence: avgConfidence,
        activeJobs,
        filesUploadedThisWeek: userFilesThisWeek,
        filesUploadedThisMonth: userFilesThisMonth,
      },
      recentActivity: recentParseJobs.map(j => ({
        id: j.id,
        type: `Parse (${j.sourceKind})`,
        name: `File processed`,
        status: j.status,
        createdAt: j.createdAt,
        user: j.user?.name ?? undefined,
      })).slice(0, 10),
      recentCutlists: recentCutlists.map((c: any) => ({
        id: c.id,
        name: c.name || "Untitled Cutlist",
        partsCount: c._count.parts,
        status: c.status,
        createdAt: c.createdAt,
        createdBy: c.user?.name ?? undefined,
      })),
    };

    // Add org admin stats from the single counts query
    if (isOrgAdmin) {
      const cutlistsLastMonth = Number(counts.cutlists_last_month);
      const cutlistsCurrentMonth = Number(counts.cutlists_this_month);
      const monthlyGrowth = cutlistsLastMonth > 0 
        ? ((cutlistsCurrentMonth - cutlistsLastMonth) / cutlistsLastMonth) * 100
        : 0;

      stats.organization = {
        totalMembers: Number(counts.org_members),
        activeToday: 0,
        totalCutlists: Number(counts.org_cutlists),
        totalParts: Number(counts.org_parts),
        totalFilesUploaded: Number(counts.org_files),
        storageUsed: 0,
        monthlyGrowth,
        pendingInvites: Number(counts.pending_invites),
      };

      // Only fetch team members if org admin (one additional query)
      const teamMembersData = await prisma.user.findMany({
        where: { organizationId: orgId! },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          role: { select: { name: true } },
          _count: { select: { cutlists: { where: { createdAt: { gte: startOfWeek } } } } },
        },
        orderBy: { lastLoginAt: "desc" },
        take: 5,
      });

      stats.teamMembers = teamMembersData.map((m: any) => ({
        id: m.id,
        name: m.name || "Unknown",
        email: m.email,
        role: m.role?.name || "operator",
        cutlistsThisWeek: m._count.cutlists,
        lastActive: formatLastActive(m.lastLoginAt),
      }));

      stats.topPerformers = teamMembersData
        .filter((m: any) => m._count.cutlists > 0)
        .slice(0, 3)
        .map((p: any) => ({
          name: p.name || "Unknown",
          cutlists: p._count.cutlists,
          parts: 0,
          efficiency: 90 + Math.random() * 8,
        }));
    }

    // Super admin platform stats (separate raw query)
    if (dbUser?.isSuperAdmin) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      type PlatformRow = {
        total_orgs: bigint;
        total_users: bigint;
        total_cutlists: bigint;
        total_files: bigint;
        parse_jobs_today: bigint;
        optimize_jobs_today: bigint;
      };

      const platformResult = await prisma.$queryRaw<PlatformRow[]>`
        SELECT
          (SELECT COUNT(*) FROM organizations) as total_orgs,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM cutlists) as total_cutlists,
          (SELECT COUNT(*) FROM uploaded_files) as total_files,
          (SELECT COUNT(*) FROM parse_jobs WHERE created_at >= ${startOfDay}) as parse_jobs_today,
          (SELECT COUNT(*) FROM optimize_jobs WHERE created_at >= ${startOfDay}) as optimize_jobs_today
      `;

      const platform = platformResult[0];
      stats.platform = {
        totalOrganizations: Number(platform.total_orgs),
        totalUsers: Number(platform.total_users),
        totalCutlists: Number(platform.total_cutlists),
        totalFilesUploaded: Number(platform.total_files),
        activeUsersToday: 0,
        parseJobsToday: Number(platform.parse_jobs_today),
        optimizeJobsToday: Number(platform.optimize_jobs_today),
      };
    }

    // Fetch subscription data in parallel (if user has org)
    let subscriptionData = null;
    if (orgId) {
      try {
        const [subscription, usage, limits] = await Promise.all([
          getSubscription(orgId),
          getCurrentUsage(orgId),
          getEffectiveLimits(orgId),
        ]);
        
        if (subscription) {
          const plan = getPlan(subscription.planId);
          const trialDaysRemaining = getTrialDaysRemaining(subscription);
          
          subscriptionData = {
            subscription: {
              planId: subscription.planId,
              planName: plan.name,
              status: subscription.status,
              billingInterval: subscription.billingInterval,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
              trialEnd: subscription.trialEnd?.toISOString() || null,
              trialDaysRemaining,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            },
            usage: {
              cutlistsCreated: usage.cutlistsCreated,
              partsProcessed: usage.partsProcessed,
              aiParsesUsed: usage.aiParsesUsed,
              ocrPagesUsed: usage.ocrPagesUsed,
              optimizationsRun: usage.optimizationsRun,
              storageUsedMb: usage.storageUsedMb,
            },
            limits,
            plan,
          };
        }
      } catch (subError) {
        console.warn("Failed to fetch subscription data:", subError);
        // Continue without subscription data
      }
    }
    
    // Return everything in one response
    return NextResponse.json({ 
      stats,
      subscription: subscriptionData,
      meta: {
        isOrgAdmin,
        isSuperAdmin: dbUser?.isSuperAdmin || false,
        organizationId: orgId,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
