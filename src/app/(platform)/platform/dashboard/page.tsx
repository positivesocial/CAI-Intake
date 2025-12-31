"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  LogOut,
  ChevronDown,
  Bell,
  Search,
  RefreshCw,
  DollarSign,
  CreditCard,
  ListOrdered,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

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
  subscription: {
    mrr: number;
    mrrGrowth: number;
    activeSubscribers: number;
    churnRate: number;
    planBreakdown: {
      free: number;
      starter: number;
      professional: number;
      enterprise: number;
    };
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
  type: "signup" | "upgrade" | "alert" | "org_created" | "cutlist" | "parse";
  message: string;
  time: string;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchPlatformStats(): Promise<{
  stats: PlatformStats;
  systemHealth: SystemHealth;
  topOrganizations: TopOrganization[];
  recentActivity: ActivityItem[];
} | null> {
  try {
    const response = await fetch("/api/v1/platform/stats");
    if (!response.ok) {
      throw new Error("Failed to fetch platform stats");
    }
    return response.json();
  } catch (error) {
    console.error("Failed to fetch platform stats:", error);
    return null;
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", colors[status] || "bg-gray-500")} />
      <span className="capitalize text-sm">{status}</span>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    enterprise: "bg-purple-100 text-purple-700",
    professional: "bg-blue-100 text-blue-700",
    starter: "bg-green-100 text-green-700",
    free: "bg-gray-100 text-gray-700",
    trial: "bg-amber-100 text-amber-700",
  };
  return (
    <Badge className={cn("capitalize", colors[plan] || "bg-gray-100")}>
      {plan}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-300" />
              </div>
              <span className="font-bold text-lg">CAI Platform</span>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-slate-500">Loading platform data...</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PlatformDashboardPage() {
  const router = useRouter();
  const { user, logout, isSuperAdmin } = useAuthStore();
  
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<{
    stats: PlatformStats;
    systemHealth: SystemHealth;
    topOrganizations: TopOrganization[];
    recentActivity: ActivityItem[];
  } | null>(null);

  // Handle client-side mounting to prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data on mount (only after mounted)
  React.useEffect(() => {
    async function loadData() {
      if (!mounted) return;
      if (!isSuperAdmin()) {
        router.push("/platform/login");
        return;
      }
      setLoading(true);
      const result = await fetchPlatformStats();
      setData(result);
      setLoading(false);
    }
    loadData();
  }, [mounted, isSuperAdmin, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/platform/login");
  };

  // Show loading state until mounted (prevents hydration mismatch)
  if (!mounted || !isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <p>Verifying access...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Default values if data is null
  const stats = data?.stats || {
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    newUsersThisMonth: 0,
    totalCutlists: 0,
    parseJobsToday: 0,
    averageConfidence: 0,
    totalPartsProcessed: 0,
    revenue: { monthly: 0, growth: 0 },
    subscription: {
      mrr: 0,
      mrrGrowth: 0,
      activeSubscribers: 0,
      churnRate: 0,
      planBreakdown: { free: 0, starter: 0, professional: 0, enterprise: 0 },
    },
  };

  const systemHealth = data?.systemHealth || {
    api: { status: "unknown", latency: 0 },
    database: { status: "unknown", latency: 0 },
    storage: { status: "unknown", usage: 0 },
    queue: { status: "unknown", pending: 0 },
  };

  const topOrganizations = data?.topOrganizations || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Nav */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-300" />
                </div>
                <div>
                  <span className="font-bold text-lg">CAI Platform</span>
                  <Badge className="ml-2 bg-purple-500/30 text-purple-200 text-xs">Super Admin</Badge>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/platform/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/platform/organizations">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Building2 className="h-4 w-4 mr-2" />
                    Organizations
                  </Button>
                </Link>
                <Link href="/platform/analytics">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Activity className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
                <Link href="/platform/plans">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <ListOrdered className="h-4 w-4 mr-2" />
                    Plans
                  </Button>
                </Link>
                <Link href="/platform/revenue">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Revenue
                  </Button>
                </Link>
                <Link href="/platform/settings">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-white/50" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-transparent border-none text-sm text-white placeholder:text-white/50 focus:outline-none w-40"
                />
              </div>
              
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 relative">
                <Bell className="h-5 w-5" />
                {recentActivity.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-sm font-medium">SA</span>
                    </div>
                    <span className="hidden md:inline text-sm">{user?.name || "Super Admin"}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user?.name || "Super Admin"}</span>
                      <span className="text-xs text-slate-500">{user?.email || "super@cai-intake.io"}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/platform/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Platform Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
          <p className="text-slate-500">Monitor and manage the CAI Intake platform</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Organizations</p>
                  <p className="text-3xl font-bold">{stats.totalOrganizations}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-blue-100">
                {stats.activeOrganizations} active
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Users</p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-purple-100">
                +{stats.newUsersThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-teal-100 text-sm">Cutlists Created</p>
                  <p className="text-3xl font-bold">{stats.totalCutlists.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-teal-100">
                {stats.parseJobsToday} parsed today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Parts Processed</p>
                  <p className="text-3xl font-bold">
                    {(stats.totalPartsProcessed / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-100">
                {stats.averageConfidence.toFixed(1)}% avg confidence
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Monthly Recurring Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">${stats.subscription.mrr.toLocaleString()}</p>
                  <div className={cn(
                    "flex items-center gap-1 text-sm",
                    stats.subscription.mrrGrowth >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    <TrendingUp className="h-3 w-3" />
                    <span>{stats.subscription.mrrGrowth >= 0 ? "+" : ""}{stats.subscription.mrrGrowth}% vs last month</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Subscribers</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.subscription.activeSubscribers}</p>
                  <p className="text-sm text-slate-500">Paid plans</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Churn Rate</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.subscription.churnRate}%</p>
                  <p className="text-sm text-green-600">Below industry avg</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Plan Distribution</p>
                  <div className="flex gap-2 mt-1 text-xs">
                    <Badge className="bg-gray-100 text-gray-700">Free: {stats.subscription.planBreakdown.free}</Badge>
                    <Badge className="bg-green-100 text-green-700">Starter: {stats.subscription.planBreakdown.starter}</Badge>
                  </div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <Badge className="bg-blue-100 text-blue-700">Pro: {stats.subscription.planBreakdown.professional}</Badge>
                    <Badge className="bg-purple-100 text-purple-700">Ent: {stats.subscription.planBreakdown.enterprise}</Badge>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <PieChart className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/platform/revenue">
            <Card className="hover:border-green-300 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Revenue Dashboard</p>
                  <p className="text-sm text-slate-500">View detailed financial metrics</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/platform/plans">
            <Card className="hover:border-purple-300 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <ListOrdered className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Manage Plans</p>
                  <p className="text-sm text-slate-500">Create and configure pricing</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/platform/organizations">
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Organizations</p>
                  <p className="text-sm text-slate-500">Manage customer accounts</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* System Health */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Server className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">API Server</p>
                    <p className="text-xs text-slate-500">{systemHealth.api.latency}ms</p>
                  </div>
                </div>
                <StatusIndicator status={systemHealth.api.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Database className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Database</p>
                    <p className="text-xs text-slate-500">{systemHealth.database.latency}ms</p>
                  </div>
                </div>
                <StatusIndicator status={systemHealth.database.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Cpu className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Storage</p>
                    <p className="text-xs text-slate-500">{systemHealth.storage.usage}% used</p>
                  </div>
                </div>
                <StatusIndicator status={systemHealth.storage.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Clock className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Job Queue</p>
                    <p className="text-xs text-slate-500">{systemHealth.queue.pending} pending</p>
                  </div>
                </div>
                <StatusIndicator status={systemHealth.queue.status} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Organizations */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  Top Organizations
                </CardTitle>
                <Link href="/platform/organizations">
                  <Button variant="ghost" size="sm" className="text-slate-600">
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {topOrganizations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No organizations yet</p>
                </div>
              ) : (
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
                    {topOrganizations.map((org) => (
                      <TableRow key={org.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-slate-500" />
                            </div>
                            <span className="font-medium">{org.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{org.users}</TableCell>
                        <TableCell className="text-right">{org.cutlists}</TableCell>
                        <TableCell>
                          <PlanBadge plan={org.plan} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => {
                    // Determine icon based on message content for more specific styling
                    const isError = activity.type === "alert" || activity.message.toLowerCase().includes("failed");
                    const isOrg = activity.message.toLowerCase().includes("organization") || activity.message.toLowerCase().includes("subscribed");
                    const isCutlist = activity.message.toLowerCase().includes("cutlist") || activity.message.toLowerCase().includes("parsed");
                    
                    return (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isError ? "bg-red-100" :
                          activity.type === "upgrade" ? "bg-purple-100" :
                          isOrg ? "bg-blue-100" :
                          isCutlist ? "bg-teal-100" :
                          "bg-green-100",
                        )}>
                          {isError ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                           activity.type === "upgrade" ? <TrendingUp className="h-4 w-4 text-purple-600" /> :
                           isOrg ? <Building2 className="h-4 w-4 text-blue-600" /> :
                           isCutlist ? <FileSpreadsheet className="h-4 w-4 text-teal-600" /> :
                           <Users className="h-4 w-4 text-green-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{activity.message}</p>
                          <p className="text-xs text-slate-500">{activity.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
