"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plus,
  Calendar,
  Zap,
  Users,
  Layers,
  Building2,
  UserPlus,
  Settings,
  BarChart3,
  Target,
  Award,
  Mail,
  Shield,
  Activity,
  RefreshCw,
  Upload,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface FullStats {
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
    pendingInvites?: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    createdAt: string;
    user?: string;
  }>;
  recentCutlists: Array<{
    id: string;
    name: string;
    partsCount: number;
    status: string;
    createdAt: string;
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
// HELPER COMPONENTS
// =============================================================================

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "warning" | "secondary"> = {
    completed: "success",
    processing: "warning",
    draft: "secondary",
  };
  return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "teal" }> = {
    org_admin: { label: "Admin", variant: "teal" },
    manager: { label: "Manager", variant: "default" },
    operator: { label: "Operator", variant: "secondary" },
    viewer: { label: "Viewer", variant: "secondary" },
  };
  const { label, variant } = config[role] || { label: role, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

// Skeleton for individual stat card
function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 sm:pt-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-20 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-8 w-12 bg-[var(--muted)] rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--muted)] animate-pulse" />
        </div>
        <div className="mt-2 h-4 w-24 bg-[var(--muted)] rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

// Skeleton for cutlist items
function CutlistSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]/30 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)]" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-[var(--muted)] rounded" />
              <div className="h-3 w-24 bg-[var(--muted)] rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-[var(--muted)] rounded" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for activity items
function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 pb-4 border-b border-[var(--border)] last:border-0 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-[var(--muted)] mt-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-[var(--muted)] rounded" />
            <div className="h-3 w-32 bg-[var(--muted)] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// DASHBOARD PAGE
// =============================================================================

export default function DashboardPage() {
  const { user, isOrgAdmin } = useAuthStore();
  
  // All dashboard data in single state
  const [dashboardData, setDashboardData] = React.useState<{
    stats: FullStats | null;
    meta: { isOrgAdmin: boolean; isSuperAdmin: boolean; organizationId?: string } | null;
  }>({ stats: null, meta: null });
  const [loading, setLoading] = React.useState(true);

  // Single API call for all dashboard data
  React.useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/v1/dashboard");
        if (response.ok) {
          const data = await response.json();
          setDashboardData({
            stats: data.stats,
            meta: data.meta,
          });
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const showOrgAdmin = dashboardData.meta?.isOrgAdmin || isOrgAdmin();
  const fullStats = dashboardData.stats;
  const teamMembers = fullStats?.teamMembers || [];

  // Use stats from API response
  const userStats = fullStats?.user || {
    cutlistsThisWeek: 0,
    cutlistsThisMonth: 0,
    partsProcessed: 0,
    averageConfidence: 94.2,
    activeJobs: 0,
    filesUploadedThisWeek: 0,
    filesUploadedThisMonth: 0,
  };

  const orgStats = fullStats?.organization || {
    totalMembers: teamMembers?.length || 0,
    activeToday: 0,
    totalCutlists: 0,
    totalParts: 0,
    totalFilesUploaded: 0,
    storageUsed: 0,
    monthlyGrowth: 0,
    pendingInvites: 0,
  };

  const recentCutlists = fullStats?.recentCutlists || [];
  const recentActivity = fullStats?.recentActivity || [];
  const topPerformers = fullStats?.topPerformers || [];

  // Show loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-[var(--border)] bg-[var(--card)]">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-6 w-6 animate-spin text-[var(--cai-teal)]" />
              <div className="h-8 w-48 bg-[var(--muted)] rounded animate-pulse" />
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold">
                  Welcome back, {user?.name?.split(" ")[0] || "User"}
                </h1>
                {showOrgAdmin && (
                  <Badge variant="teal" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    Org Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm sm:text-base text-[var(--muted-foreground)]">
                {showOrgAdmin 
                  ? `${user?.organization?.name || "Your Organization"} Dashboard`
                  : "Here's what's happening with your cutlists"
                }
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {showOrgAdmin && (
                <Link href="/settings/team">
                  <Button variant="outline" size="sm" className="sm:size-default">
                    <Users className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Manage Team</span>
                  </Button>
                </Link>
              )}
              <Link href="/intake">
                <Button variant="primary" size="sm" className="sm:size-lg">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-1" />
                  <span className="hidden xs:inline">New Cutlist</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Org Admin Banner */}
        {showOrgAdmin && (
          <Card className="mb-6 bg-gradient-to-r from-[var(--cai-navy)] to-[var(--cai-navy)]/80 text-white overflow-hidden">
            <CardContent className="py-4 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-[var(--cai-teal)] flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 sm:h-8 sm:w-8 text-[var(--cai-navy)]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold truncate">{user?.organization?.name}</h2>
                    <p className="text-white/70 text-sm">
                      {loading ? (
                        <span className="inline-block h-4 w-32 bg-white/20 rounded animate-pulse" />
                      ) : (
                        `${orgStats.totalMembers} team members • ${orgStats.activeToday || "0"} active today`
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-6">
                  <div className="text-center">
                    {loading ? (
                      <div className="h-8 w-12 mx-auto bg-white/20 rounded animate-pulse" />
                    ) : (
                      <p className="text-xl sm:text-3xl font-bold">{orgStats.totalCutlists}</p>
                    )}
                    <p className="text-white/70 text-xs sm:text-sm">Total Cutlists</p>
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <div className="h-8 w-16 mx-auto bg-white/20 rounded animate-pulse" />
                    ) : (
                      <p className="text-xl sm:text-3xl font-bold">{orgStats.totalParts.toLocaleString()}</p>
                    )}
                    <p className="text-white/70 text-xs sm:text-sm">Parts Processed</p>
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <div className="h-8 w-12 mx-auto bg-white/20 rounded animate-pulse" />
                    ) : (
                      <p className="text-xl sm:text-3xl font-bold text-[var(--cai-teal)]">
                        {orgStats.monthlyGrowth >= 0 ? "+" : ""}{orgStats.monthlyGrowth.toFixed(1)}%
                      </p>
                    )}
                    <p className="text-white/70 text-xs sm:text-sm">This Month</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid - Shows immediately with quick data */}
        <div className={cn(
          "grid gap-3 sm:gap-4 mb-6 sm:mb-8",
          showOrgAdmin 
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" 
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        )}>
          {/* Cutlists This Week - Available immediately */}
          <Card>
            <CardContent className="p-4 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-[var(--muted-foreground)] truncate">
                    {showOrgAdmin ? "Team Cutlists" : "Cutlists"} This Week
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold">
                    {userStats.cutlistsThisWeek}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--cai-teal)]" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {userStats.cutlistsThisMonth} this month
              </div>
            </CardContent>
          </Card>

          {/* Parts Processed - Loads with full stats */}
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <Card>
              <CardContent className="p-4 sm:pt-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      Parts Processed
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {userStats.partsProcessed.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {userStats.activeJobs} jobs in progress
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parse Accuracy - Loads with full stats */}
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <Card>
              <CardContent className="p-4 sm:pt-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      Parse Accuracy
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {userStats.averageConfidence.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                </div>
                <Progress
                  value={userStats.averageConfidence}
                  variant="success"
                  className="mt-2 sm:mt-3"
                />
              </CardContent>
            </Card>
          )}

          {/* Active Jobs - Available immediately */}
          <Card>
            <CardContent className="p-4 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                    Active Jobs
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold">{userStats.activeJobs}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
                Processing & pending
              </div>
            </CardContent>
          </Card>

          {/* Files Uploaded - Loads with full stats */}
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <Card>
              <CardContent className="p-4 sm:pt-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      Files Uploaded
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {showOrgAdmin ? orgStats.totalFilesUploaded : userStats.filesUploadedThisWeek}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                    <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                  <FileImage className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {userStats.filesUploadedThisMonth} this month
                </div>
              </CardContent>
            </Card>
          )}

          {/* Org Admin Extra Stat */}
          {showOrgAdmin && (
            loading ? (
              <StatCardSkeleton />
            ) : (
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-4 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                        Team Members
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold">{orgStats.totalMembers}</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                    </div>
                  </div>
                  {(orgStats.pendingInvites || 0) > 0 && (
                    <div className="mt-2 flex items-center text-xs sm:text-sm text-amber-600">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      {orgStats.pendingInvites} pending invites
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Cutlists - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Recent Cutlists
                  </CardTitle>
                  <Link href="/cutlists">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <CutlistSkeleton />
                ) : recentCutlists.length === 0 ? (
                  <div className="text-center py-8 text-[var(--muted-foreground)]">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No cutlists yet</p>
                    <Link href="/intake">
                      <Button variant="outline" size="sm" className="mt-3">
                        Create your first cutlist
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentCutlists.map((cutlist) => (
                      <Link
                        key={cutlist.id}
                        href={`/cutlists/${cutlist.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--muted)] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              cutlist.status === "completed"
                                ? "bg-green-100"
                                : cutlist.status === "processing"
                                ? "bg-amber-100"
                                : "bg-[var(--muted)]"
                            )}
                          >
                            {cutlist.status === "completed" ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : cutlist.status === "processing" ? (
                              <Clock className="h-5 w-5 text-amber-600" />
                            ) : (
                              <FileSpreadsheet className="h-5 w-5 text-[var(--muted-foreground)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{cutlist.name}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {cutlist.partsCount} parts • {formatTimeAgo(cutlist.createdAt)}
                              {showOrgAdmin && cutlist.createdBy && ` • by ${cutlist.createdBy}`}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={cutlist.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members - Only for Org Admins, loaded lazily */}
            {showOrgAdmin && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Link href="/settings/team">
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Invite
                        </Button>
                      </Link>
                      <Link href="/settings/team">
                        <Button variant="ghost" size="sm">
                          Manage
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-[var(--muted)]" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-[var(--muted)] rounded" />
                            <div className="h-3 w-24 bg-[var(--muted)] rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : teamMembers && teamMembers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">This Week</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.slice(0, 5).map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center">
                                  <span className="text-sm font-medium text-[var(--cai-teal)]">
                                    {member.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium">{member.name}</p>
                                  <p className="text-xs text-[var(--muted-foreground)]">
                                    {member.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={member.role} />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">{member.cutlistsThisWeek}</span>
                              <span className="text-[var(--muted-foreground)]"> cutlists</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "text-sm",
                                member.lastActive === "Active now" 
                                  ? "text-green-600" 
                                  : "text-[var(--muted-foreground)]"
                              )}>
                                {member.lastActive}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-6 text-[var(--muted-foreground)]">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No team members yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Activity Feed */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {showOrgAdmin ? "Team Activity" : "Recent Activity"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ActivitySkeleton />
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-6 text-[var(--muted-foreground)]">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.slice(0, 5).map((activity, i) => (
                      <div
                        key={activity.id || i}
                        className="flex items-start gap-3 pb-4 border-b border-[var(--border)] last:border-0 last:pb-0"
                      >
                        <div className="w-2 h-2 rounded-full bg-[var(--cai-teal)] mt-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.type}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {activity.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {formatTimeAgo(activity.createdAt)}
                            </p>
                            {showOrgAdmin && activity.user && (
                              <>
                                <span className="text-xs text-[var(--muted-foreground)]">•</span>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                  {activity.user}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers - Only for Org Admins */}
            {showOrgAdmin && topPerformers && topPerformers.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topPerformers.map((performer, i) => (
                      <div
                        key={performer.name}
                        className="flex items-center gap-3"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white",
                          i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : "bg-amber-700"
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {performer.cutlists} cutlists • {performer.parts.toLocaleString()} parts
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {performer.efficiency.toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/intake" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Cutlist
                  </Button>
                </Link>
                <Link href="/intake?mode=excel" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import Excel/CSV
                  </Button>
                </Link>
                {showOrgAdmin ? (
                  <>
                    <Link href="/settings/team" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Team Member
                      </Button>
                    </Link>
                    <Link href="/settings/organization" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <Settings className="h-4 w-4 mr-2" />
                        Organization Settings
                      </Button>
                    </Link>
                    <Link href="/reports" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Reports
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link href="/settings" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Storage Usage - Only for Org Admins */}
            {showOrgAdmin && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Usage & Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Storage Used</span>
                      <span className="font-medium">{orgStats.storageUsed}%</span>
                    </div>
                    <Progress value={orgStats.storageUsed} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Team Seats</span>
                      <span className="font-medium">{orgStats.totalMembers}/15</span>
                    </div>
                    <Progress value={(orgStats.totalMembers / 15) * 100} />
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Plan: <span className="font-medium text-[var(--foreground)]">Professional</span>
                    </p>
                    <Link href="/settings/organization?tab=billing">
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        Upgrade Plan
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
