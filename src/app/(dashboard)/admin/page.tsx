"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileSpreadsheet,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Database,
  Cpu,
  ArrowRight,
  Settings,
  Shield,
  Globe,
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
import { useAuthStore, SUPER_ADMIN_USER } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Mock platform stats
const PLATFORM_STATS = {
  totalOrganizations: 156,
  activeOrganizations: 142,
  totalUsers: 847,
  newUsersThisMonth: 67,
  totalCutlists: 12453,
  parseJobsToday: 234,
  averageConfidence: 93.7,
  totalPartsProcessed: 2847562,
};

const SYSTEM_HEALTH = {
  api: { status: "healthy", latency: 45 },
  database: { status: "healthy", latency: 12 },
  storage: { status: "healthy", usage: 67 },
  queue: { status: "warning", pending: 23 },
};

const TOP_ORGANIZATIONS = [
  { id: "1", name: "Premium Cabinets Inc", users: 24, cutlists: 456, plan: "enterprise" },
  { id: "2", name: "Modern Woodworks", users: 12, cutlists: 234, plan: "professional" },
  { id: "3", name: "FastCut Solutions", users: 18, cutlists: 189, plan: "professional" },
  { id: "4", name: "Artisan Furniture Co", users: 8, cutlists: 156, plan: "starter" },
  { id: "5", name: "QuickPanel Shop", users: 6, cutlists: 98, plan: "starter" },
];

const RECENT_SIGNUPS = [
  { id: "1", name: "John Smith", email: "john@example.com", org: "New Workshop", date: "2 hours ago" },
  { id: "2", name: "Sarah Johnson", email: "sarah@wood.co", org: "Wood & Co", date: "5 hours ago" },
  { id: "3", name: "Mike Chen", email: "mike@panels.io", org: "Panel Masters", date: "1 day ago" },
];

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", colors[status] || "bg-gray-500")} />
      <span className="capitalize">{status}</span>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const variants: Record<string, "default" | "secondary" | "teal"> = {
    enterprise: "teal",
    professional: "default",
    starter: "secondary",
    free: "secondary",
  };
  return <Badge variant={variants[plan] || "secondary"}>{plan}</Badge>;
}

export default function AdminDashboardPage() {
  const { user, setUser } = useAuthStore();

  // Redirect if not super admin
  React.useEffect(() => {
    // For demo, allow switching to super admin
    if (!user?.isSuperAdmin) {
      // In production, redirect to regular dashboard
      // For now, we'll show a button to switch
    }
  }, [user]);

  const handleSwitchToSuperAdmin = () => {
    setUser(SUPER_ADMIN_USER);
  };

  if (!user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-16 w-16 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Super Admin Access Required</h2>
            <p className="text-[var(--muted-foreground)] mb-6">
              This dashboard is only accessible to platform administrators.
            </p>
            <Button variant="primary" onClick={handleSwitchToSuperAdmin}>
              <Shield className="h-4 w-4 mr-2" />
              Switch to Super Admin (Demo)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--cai-navy)] text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--cai-teal)] flex items-center justify-center">
                <Shield className="h-6 w-6 text-[var(--cai-navy)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Platform Admin</h1>
                <p className="text-white/70">CAI Intake System Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="teal" className="text-sm">
                Super Admin
              </Badge>
              <Link href="/admin/settings">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <Settings className="h-4 w-4 mr-2" />
                  Platform Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Organizations</p>
                  <p className="text-3xl font-bold">{PLATFORM_STATS.totalOrganizations}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-600">
                {PLATFORM_STATS.activeOrganizations} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Total Users</p>
                  <p className="text-3xl font-bold">{PLATFORM_STATS.totalUsers}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-600">
                +{PLATFORM_STATS.newUsersThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Total Cutlists</p>
                  <p className="text-3xl font-bold">
                    {PLATFORM_STATS.totalCutlists.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-[var(--cai-teal)]" />
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {PLATFORM_STATS.parseJobsToday} jobs today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Parts Processed</p>
                  <p className="text-3xl font-bold">
                    {(PLATFORM_STATS.totalPartsProcessed / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {PLATFORM_STATS.averageConfidence}% avg accuracy
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-medium">API</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {SYSTEM_HEALTH.api.latency}ms latency
                    </p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.api.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-medium">Database</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {SYSTEM_HEALTH.database.latency}ms latency
                    </p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.database.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-medium">Storage</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {SYSTEM_HEALTH.storage.usage}% used
                    </p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.storage.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-medium">Job Queue</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {SYSTEM_HEALTH.queue.pending} pending
                    </p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.queue.status} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Organizations */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Top Organizations
                </CardTitle>
                <Link href="/admin/organizations">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Cutlists</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TOP_ORGANIZATIONS.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-right">{org.users}</TableCell>
                      <TableCell className="text-right">{org.cutlists}</TableCell>
                      <TableCell>
                        <PlanBadge plan={org.plan} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Signups */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recent Signups
                </CardTitle>
                <Link href="/admin/users">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {RECENT_SIGNUPS.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--muted)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center">
                        <span className="text-[var(--cai-teal)] font-medium">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{user.org}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {user.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

