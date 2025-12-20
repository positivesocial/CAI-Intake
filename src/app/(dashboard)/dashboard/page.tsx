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
// MOCK DATA - Replace with real API calls
// =============================================================================

// Personal stats
const MOCK_PERSONAL_STATS = {
  cutlistsThisWeek: 12,
  partsProcessed: 847,
  averageConfidence: 94.2,
  optimizedSheets: 45,
  savedMaterial: 8.3,
  activeJobs: 3,
};

// Organization stats (for org admins)
const MOCK_ORG_STATS = {
  totalCutlists: 234,
  totalParts: 15847,
  teamMembers: 8,
  activeToday: 5,
  monthlyGrowth: 18.5,
  averageEfficiency: 91.2,
  pendingInvites: 2,
  storageUsed: 45, // percentage
};

// Team members (for org admins)
const MOCK_TEAM_MEMBERS = [
  {
    id: "1",
    name: "John Smith",
    email: "john@acmecabinets.com",
    role: "org_admin",
    cutlistsThisWeek: 15,
    lastActive: "Active now",
    avatar: null,
  },
  {
    id: "2",
    name: "Mike Johnson",
    email: "mike@acmecabinets.com",
    role: "operator",
    cutlistsThisWeek: 28,
    lastActive: "2 hours ago",
    avatar: null,
  },
  {
    id: "3",
    name: "Sarah Davis",
    email: "sarah@acmecabinets.com",
    role: "operator",
    cutlistsThisWeek: 12,
    lastActive: "1 day ago",
    avatar: null,
  },
  {
    id: "4",
    name: "Tom Wilson",
    email: "tom@acmecabinets.com",
    role: "viewer",
    cutlistsThisWeek: 0,
    lastActive: "3 days ago",
    avatar: null,
  },
];

// Recent cutlists
const MOCK_RECENT_CUTLISTS = [
  {
    id: "1",
    name: "Kitchen Cabinet Set",
    status: "completed",
    partsCount: 48,
    createdBy: "John Smith",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "2",
    name: "Office Desk Components",
    status: "processing",
    partsCount: 12,
    createdBy: "Mike Johnson",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "3",
    name: "Bedroom Wardrobe",
    status: "draft",
    partsCount: 36,
    createdBy: "Sarah Davis",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "4",
    name: "Bathroom Vanity",
    status: "completed",
    partsCount: 18,
    createdBy: "John Smith",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
];

// Activity feed
const MOCK_ACTIVITY = [
  { action: "Cutlist exported", target: "Kitchen Cabinet Set", time: "2 hours ago", user: "John Smith" },
  { action: "Parts parsed", target: "156 parts via Excel import", time: "3 hours ago", user: "Mike Johnson" },
  { action: "Optimization completed", target: "Office Desk - 89% utilization", time: "5 hours ago", user: "System" },
  { action: "New cutlist created", target: "Bedroom Wardrobe", time: "1 day ago", user: "Sarah Davis" },
  { action: "Team member invited", target: "alex@acmecabinets.com", time: "2 days ago", user: "John Smith" },
];

// Top performers (for org admins)
const MOCK_TOP_PERFORMERS = [
  { name: "Mike Johnson", cutlists: 28, parts: 1247, efficiency: 94.5 },
  { name: "Sarah Davis", cutlists: 12, parts: 856, efficiency: 92.1 },
  { name: "John Smith", cutlists: 15, parts: 723, efficiency: 91.8 },
];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function formatTimeAgo(date: Date): string {
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

// =============================================================================
// DASHBOARD PAGE
// =============================================================================

export default function DashboardPage() {
  const { user, isOrgAdmin } = useAuthStore();
  const showOrgAdmin = isOrgAdmin();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  Welcome back, {user?.name?.split(" ")[0] || "User"}
                </h1>
                {showOrgAdmin && (
                  <Badge variant="teal" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    Org Admin
                  </Badge>
                )}
              </div>
              <p className="text-[var(--muted-foreground)]">
                {showOrgAdmin 
                  ? `${user?.organization?.name || "Your Organization"} Dashboard`
                  : "Here's what's happening with your cutlists"
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {showOrgAdmin && (
                <Link href="/settings/team">
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Team
                  </Button>
                </Link>
              )}
              <Link href="/intake">
                <Button variant="primary" size="lg">
                  <Plus className="h-5 w-5" />
                  New Cutlist
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Org Admin Banner */}
        {showOrgAdmin && (
          <Card className="mb-6 bg-gradient-to-r from-[var(--cai-navy)] to-[var(--cai-navy)]/80 text-white">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[var(--cai-teal)] flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-[var(--cai-navy)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{user?.organization?.name}</h2>
                    <p className="text-white/70">
                      {MOCK_ORG_STATS.teamMembers} team members • {MOCK_ORG_STATS.activeToday} active today
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{MOCK_ORG_STATS.totalCutlists}</p>
                    <p className="text-white/70 text-sm">Total Cutlists</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{MOCK_ORG_STATS.totalParts.toLocaleString()}</p>
                    <p className="text-white/70 text-sm">Parts Processed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--cai-teal)]">+{MOCK_ORG_STATS.monthlyGrowth}%</p>
                    <p className="text-white/70 text-sm">This Month</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className={cn(
          "grid gap-4 mb-8",
          showOrgAdmin ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-5" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        )}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {showOrgAdmin ? "Team Cutlists" : "Cutlists"} This Week
                  </p>
                  <p className="text-3xl font-bold">
                    {MOCK_PERSONAL_STATS.cutlistsThisWeek}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-[var(--cai-teal)]" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                +23% from last week
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Parts Processed
                  </p>
                  <p className="text-3xl font-bold">
                    {MOCK_PERSONAL_STATS.partsProcessed.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm text-[var(--muted-foreground)]">
                <Clock className="h-4 w-4 mr-1" />
                {MOCK_PERSONAL_STATS.activeJobs} jobs in progress
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Parse Accuracy
                  </p>
                  <p className="text-3xl font-bold">
                    {MOCK_PERSONAL_STATS.averageConfidence}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <Progress
                value={MOCK_PERSONAL_STATS.averageConfidence}
                variant="success"
                className="mt-3"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Material Saved
                  </p>
                  <p className="text-3xl font-bold">{MOCK_PERSONAL_STATS.savedMaterial}%</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                vs. manual nesting
              </div>
            </CardContent>
          </Card>

          {/* Org Admin Extra Stat */}
          {showOrgAdmin && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Team Members
                    </p>
                    <p className="text-3xl font-bold">{MOCK_ORG_STATS.teamMembers}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                {MOCK_ORG_STATS.pendingInvites > 0 && (
                  <div className="mt-2 flex items-center text-sm text-amber-600">
                    <Mail className="h-4 w-4 mr-1" />
                    {MOCK_ORG_STATS.pendingInvites} pending invites
                  </div>
                )}
              </CardContent>
            </Card>
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
                <div className="space-y-3">
                  {MOCK_RECENT_CUTLISTS.map((cutlist) => (
                    <div
                      key={cutlist.id}
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
                            {showOrgAdmin && ` • by ${cutlist.createdBy}`}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={cutlist.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team Members - Only for Org Admins */}
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
                      {MOCK_TEAM_MEMBERS.map((member) => (
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
                <div className="space-y-4">
                  {MOCK_ACTIVITY.map((activity, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 pb-4 border-b border-[var(--border)] last:border-0 last:pb-0"
                    >
                      <div className="w-2 h-2 rounded-full bg-[var(--cai-teal)] mt-2" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {activity.target}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {activity.time}
                          </p>
                          {showOrgAdmin && (
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
              </CardContent>
            </Card>

            {/* Top Performers - Only for Org Admins */}
            {showOrgAdmin && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_TOP_PERFORMERS.map((performer, i) => (
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
                          {performer.efficiency}%
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
                      <span className="font-medium">{MOCK_ORG_STATS.storageUsed}%</span>
                    </div>
                    <Progress value={MOCK_ORG_STATS.storageUsed} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Team Seats</span>
                      <span className="font-medium">{MOCK_ORG_STATS.teamMembers}/15</span>
                    </div>
                    <Progress value={(MOCK_ORG_STATS.teamMembers / 15) * 100} />
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
