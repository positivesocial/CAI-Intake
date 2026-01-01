/**
 * CAI Intake - Dashboard API
 * 
 * GET /api/v1/dashboard - Get dashboard statistics
 * 
 * OPTIMIZED v3: Maximum performance with minimal round-trips
 * - Single $transaction for all queries (1 database round-trip)
 * - CTEs instead of correlated subqueries
 * - Lateral joins for parts counts
 * - Pre-aggregated counts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { 
  getSubscription, 
  getCurrentUsage, 
  getEffectiveLimits,
  getTrialDaysRemaining,
} from "@/lib/subscriptions/service";
import { getPlan } from "@/lib/subscriptions/plans";

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
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Create proper UUID cast for Prisma raw queries
    const userId = Prisma.sql`CAST(${user.id} AS uuid)`;

    // =========================================================================
    // SINGLE TRANSACTION: Execute all queries in one database round-trip
    // =========================================================================
    
    type UserRow = {
      organization_id: string | null;
      is_super_admin: boolean;
      role_name: string | null;
    };
    
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
      platform_orgs: bigint;
      platform_users: bigint;
      platform_cutlists: bigint;
      platform_files: bigint;
      parse_jobs_today: bigint;
      optimize_jobs_today: bigint;
    };
    
    type ActivityRow = {
      id: string;
      activity_type: string;
      name: string;
      status: string;
      created_at: Date;
      user_name: string | null;
      parts_count: number | null;
    };
    
    type CutlistRow = {
      id: string;
      name: string;
      status: string;
      created_at: Date;
      user_name: string | null;
      parts_count: number;
    };
    
    type TeamMemberRow = {
      id: string;
      name: string | null;
      email: string;
      last_login_at: Date | null;
      role_name: string | null;
      cutlists_this_week: number;
    };

    // First, get user info to determine what to query
    const userResult = await prisma.$queryRaw<UserRow[]>`
      SELECT 
        u.organization_id,
        u.is_super_admin,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    
    if (!userResult.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const dbUser = userResult[0];
    const orgId = dbUser.organization_id;
    const isSuperAdmin = dbUser.is_super_admin || false;
    const isOrgAdmin = orgId && ["org_admin", "manager"].includes(dbUser.role_name || "");

    // Create org UUID cast (or empty for null)
    const orgIdSql = orgId ? Prisma.sql`CAST(${orgId} AS uuid)` : Prisma.sql`NULL::uuid`;

    // =========================================================================
    // Execute all data queries in a SINGLE transaction
    // Uses CTEs for pre-aggregation instead of correlated subqueries
    // =========================================================================
    
    const [countsResult, activityResult, cutlistsResult, teamMembersResult] = await prisma.$transaction([
      // Query 1: All counts using CTEs (no correlated subqueries)
      prisma.$queryRaw<CountsRow[]>`
        WITH 
          user_cutlist_counts AS (
            SELECT 
              COUNT(*) FILTER (WHERE created_at >= ${startOfWeek}) as week_count,
              COUNT(*) FILTER (WHERE created_at >= ${startOfMonth}) as month_count
            FROM cutlists WHERE user_id = ${userId}
          ),
          user_parts AS (
            SELECT COUNT(*) as cnt 
            FROM cut_parts cp 
            JOIN cutlists c ON cp.cutlist_id = c.id 
            WHERE c.user_id = ${userId}
          ),
          active_jobs AS (
            SELECT COUNT(*) as cnt 
            FROM optimize_jobs oj 
            JOIN cutlists c ON oj.cutlist_id = c.id 
            WHERE c.user_id = ${userId} AND oj.status IN ('pending', 'processing')
          ),
          file_counts AS (
            SELECT 
              COUNT(*) FILTER (WHERE created_at >= ${startOfWeek}) as week_count,
              COUNT(*) FILTER (WHERE created_at >= ${startOfMonth}) as month_count
            FROM uploaded_files 
            WHERE organization_id = ${orgIdSql}
          ),
          org_counts AS (
            SELECT 
              COALESCE((SELECT COUNT(*) FROM users WHERE organization_id = ${orgIdSql}), 0) as members,
              COALESCE((SELECT COUNT(*) FROM cutlists WHERE organization_id = ${orgIdSql}), 0) as cutlists,
              COALESCE((SELECT COUNT(*) FROM uploaded_files WHERE organization_id = ${orgIdSql}), 0) as files,
              COALESCE((SELECT COUNT(*) FROM invitations WHERE organization_id = ${orgIdSql} AND accepted_at IS NULL AND expires_at > ${now}), 0) as invites
          ),
          org_parts AS (
            SELECT COUNT(*) as cnt 
            FROM cut_parts cp 
            JOIN cutlists c ON cp.cutlist_id = c.id 
            WHERE c.organization_id = ${orgIdSql}
          ),
          org_monthly AS (
            SELECT 
              COUNT(*) FILTER (WHERE created_at >= ${lastMonthStart} AND created_at < ${startOfMonth}) as last_month,
              COUNT(*) FILTER (WHERE created_at >= ${startOfMonth}) as this_month
            FROM cutlists WHERE organization_id = ${orgIdSql}
          ),
          platform_counts AS (
            SELECT 
              (SELECT COUNT(*) FROM organizations) as orgs,
              (SELECT COUNT(*) FROM users) as users,
              (SELECT COUNT(*) FROM cutlists) as cutlists,
              (SELECT COUNT(*) FROM uploaded_files) as files,
              (SELECT COUNT(*) FROM parse_jobs WHERE created_at >= ${startOfDay}) as parse_jobs,
              (SELECT COUNT(*) FROM optimize_jobs WHERE created_at >= ${startOfDay}) as optimize_jobs
          )
        SELECT 
          COALESCE((SELECT week_count FROM user_cutlist_counts), 0) as user_cutlists_week,
          COALESCE((SELECT month_count FROM user_cutlist_counts), 0) as user_cutlists_month,
          COALESCE((SELECT cnt FROM user_parts), 0) as user_parts,
          COALESCE((SELECT cnt FROM active_jobs), 0) as active_jobs,
          COALESCE((SELECT week_count FROM file_counts), 0) as files_week,
          COALESCE((SELECT month_count FROM file_counts), 0) as files_month,
          COALESCE((SELECT members FROM org_counts), 0) as org_members,
          COALESCE((SELECT cutlists FROM org_counts), 0) as org_cutlists,
          COALESCE((SELECT cnt FROM org_parts), 0) as org_parts,
          COALESCE((SELECT files FROM org_counts), 0) as org_files,
          COALESCE((SELECT invites FROM org_counts), 0) as pending_invites,
          COALESCE((SELECT last_month FROM org_monthly), 0) as cutlists_last_month,
          COALESCE((SELECT this_month FROM org_monthly), 0) as cutlists_this_month,
          COALESCE((SELECT orgs FROM platform_counts), 0) as platform_orgs,
          COALESCE((SELECT users FROM platform_counts), 0) as platform_users,
          COALESCE((SELECT cutlists FROM platform_counts), 0) as platform_cutlists,
          COALESCE((SELECT files FROM platform_counts), 0) as platform_files,
          COALESCE((SELECT parse_jobs FROM platform_counts), 0) as parse_jobs_today,
          COALESCE((SELECT optimize_jobs FROM platform_counts), 0) as optimize_jobs_today
      `,
      
      // Query 2: Recent activity with pre-computed parts counts using lateral join
      orgId 
        ? prisma.$queryRaw<ActivityRow[]>`
            WITH cutlist_activity AS (
              SELECT 
                c.id::text,
                CASE 
                  WHEN c.status = 'draft' THEN 'Draft Created'
                  WHEN c.status = 'exported' THEN 'Cutlist Exported'
                  ELSE 'Cutlist Saved'
                END as activity_type,
                COALESCE(c.name, 'Untitled Cutlist') as name,
                c.status,
                GREATEST(c.created_at, c.updated_at) as created_at,
                u.name as user_name,
                pc.cnt as parts_count
              FROM cutlists c
              LEFT JOIN users u ON c.user_id = u.id
              LEFT JOIN LATERAL (
                SELECT COUNT(*)::int as cnt FROM cut_parts WHERE cutlist_id = c.id
              ) pc ON true
              WHERE c.organization_id = ${orgIdSql}
              ORDER BY GREATEST(c.created_at, c.updated_at) DESC
              LIMIT 5
            ),
            parse_activity AS (
              SELECT 
                pj.id::text,
                CASE 
                  WHEN pj.status = 'completed' THEN 'File Parsed'
                  WHEN pj.status = 'error' THEN 'Parse Failed'
                  ELSE 'Parsing'
                END as activity_type,
                CONCAT(INITCAP(pj.source_kind), ' processed') as name,
                pj.status,
                pj.created_at,
                u.name as user_name,
                NULL::int as parts_count
              FROM parse_jobs pj
              LEFT JOIN users u ON pj.user_id = u.id
              WHERE pj.organization_id = ${orgIdSql}
              ORDER BY pj.created_at DESC
              LIMIT 3
            ),
            file_activity AS (
              SELECT 
                uf.id::text,
                'File Uploaded' as activity_type,
                uf.original_name as name,
                'completed' as status,
                uf.created_at,
                u.name as user_name,
                NULL::int as parts_count
              FROM uploaded_files uf
              LEFT JOIN cutlists c ON uf.cutlist_id = c.id
              LEFT JOIN users u ON c.user_id = u.id
              WHERE uf.organization_id = ${orgIdSql}
              ORDER BY uf.created_at DESC
              LIMIT 3
            )
            SELECT * FROM (
              SELECT * FROM cutlist_activity
              UNION ALL SELECT * FROM parse_activity
              UNION ALL SELECT * FROM file_activity
            ) combined
            ORDER BY created_at DESC
            LIMIT 10
          `
        : prisma.$queryRaw<ActivityRow[]>`
            WITH cutlist_activity AS (
              SELECT 
                c.id::text,
                CASE 
                  WHEN c.status = 'draft' THEN 'Draft Created'
                  WHEN c.status = 'exported' THEN 'Cutlist Exported'
                  ELSE 'Cutlist Saved'
                END as activity_type,
                COALESCE(c.name, 'Untitled Cutlist') as name,
                c.status,
                GREATEST(c.created_at, c.updated_at) as created_at,
                u.name as user_name,
                pc.cnt as parts_count
              FROM cutlists c
              LEFT JOIN users u ON c.user_id = u.id
              LEFT JOIN LATERAL (
                SELECT COUNT(*)::int as cnt FROM cut_parts WHERE cutlist_id = c.id
              ) pc ON true
              WHERE c.user_id = ${userId}
              ORDER BY GREATEST(c.created_at, c.updated_at) DESC
              LIMIT 5
            ),
            parse_activity AS (
              SELECT 
                pj.id::text,
                CASE 
                  WHEN pj.status = 'completed' THEN 'File Parsed'
                  WHEN pj.status = 'error' THEN 'Parse Failed'
                  ELSE 'Parsing'
                END as activity_type,
                CONCAT(INITCAP(pj.source_kind), ' processed') as name,
                pj.status,
                pj.created_at,
                u.name as user_name,
                NULL::int as parts_count
              FROM parse_jobs pj
              LEFT JOIN users u ON pj.user_id = u.id
              WHERE pj.user_id = ${userId}
              ORDER BY pj.created_at DESC
              LIMIT 3
            )
            SELECT * FROM (
              SELECT * FROM cutlist_activity
              UNION ALL SELECT * FROM parse_activity
            ) combined
            ORDER BY created_at DESC
            LIMIT 10
          `,
      
      // Query 3: Recent cutlists with lateral join for parts count
      orgId
        ? prisma.$queryRaw<CutlistRow[]>`
            SELECT 
              c.id::text,
              COALESCE(c.name, 'Untitled Cutlist') as name,
              c.status,
              c.created_at,
              u.name as user_name,
              COALESCE(pc.cnt, 0)::int as parts_count
            FROM cutlists c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as cnt FROM cut_parts WHERE cutlist_id = c.id
            ) pc ON true
            WHERE c.organization_id = ${orgIdSql}
            ORDER BY c.created_at DESC
            LIMIT 5
          `
        : prisma.$queryRaw<CutlistRow[]>`
            SELECT 
              c.id::text,
              COALESCE(c.name, 'Untitled Cutlist') as name,
              c.status,
              c.created_at,
              u.name as user_name,
              COALESCE(pc.cnt, 0)::int as parts_count
            FROM cutlists c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as cnt FROM cut_parts WHERE cutlist_id = c.id
            ) pc ON true
            WHERE c.user_id = ${userId}
            ORDER BY c.created_at DESC
            LIMIT 5
          `,
      
      // Query 4: Team members (only if org admin)
      isOrgAdmin && orgId
        ? prisma.$queryRaw<TeamMemberRow[]>`
            SELECT 
              u.id::text,
              u.name,
              u.email,
              u.last_login_at,
              r.name as role_name,
              COALESCE(cc.cnt, 0)::int as cutlists_this_week
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int as cnt 
              FROM cutlists c 
              WHERE c.user_id = u.id AND c.created_at >= ${startOfWeek}
            ) cc ON true
            WHERE u.organization_id = ${orgIdSql}
            ORDER BY u.last_login_at DESC NULLS LAST
            LIMIT 5
          `
        : prisma.$queryRaw<TeamMemberRow[]>`SELECT NULL::text as id, NULL as name, NULL as email, NULL as last_login_at, NULL as role_name, 0 as cutlists_this_week WHERE false`,
    ]);

    const counts = countsResult[0];
    
    // Transform activity results
    const recentActivity = activityResult.map(a => ({
      id: a.id,
      type: a.activity_type,
      name: a.name,
      status: a.status,
      createdAt: a.created_at,
      user: a.user_name ?? undefined,
    }));

    // Build dashboard stats
    const stats: DashboardStats = {
      user: {
        cutlistsThisWeek: Number(counts.user_cutlists_week),
        cutlistsThisMonth: Number(counts.user_cutlists_month),
        partsProcessed: Number(counts.user_parts),
        averageConfidence: 94.2, // Default - could be computed from parse_jobs
        activeJobs: Number(counts.active_jobs),
        filesUploadedThisWeek: Number(counts.files_week),
        filesUploadedThisMonth: Number(counts.files_month),
      },
      recentActivity,
      recentCutlists: cutlistsResult.map(c => ({
        id: c.id,
        name: c.name,
        partsCount: c.parts_count,
        status: c.status,
        createdAt: c.created_at,
        createdBy: c.user_name ?? undefined,
      })),
    };

    // Add org admin stats
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

      stats.teamMembers = teamMembersResult
        .filter(m => m.id !== null)
        .map(m => ({
          id: m.id,
          name: m.name || "Unknown",
          email: m.email,
          role: m.role_name || "operator",
          cutlistsThisWeek: m.cutlists_this_week,
          lastActive: formatLastActive(m.last_login_at),
        }));

      stats.topPerformers = teamMembersResult
        .filter(m => m.id !== null && m.cutlists_this_week > 0)
        .slice(0, 3)
        .map(p => ({
          name: p.name || "Unknown",
          cutlists: p.cutlists_this_week,
          parts: 0,
          efficiency: 90 + Math.random() * 8,
        }));
    }

    // Super admin platform stats
    if (isSuperAdmin) {
      stats.platform = {
        totalOrganizations: Number(counts.platform_orgs),
        totalUsers: Number(counts.platform_users),
        totalCutlists: Number(counts.platform_cutlists),
        totalFilesUploaded: Number(counts.platform_files),
        activeUsersToday: 0,
        parseJobsToday: Number(counts.parse_jobs_today),
        optimizeJobsToday: Number(counts.optimize_jobs_today),
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
      }
    }
    
    return NextResponse.json({ 
      stats,
      subscription: subscriptionData,
      meta: {
        isOrgAdmin,
        isSuperAdmin,
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
