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
  revenue: {
    monthly: 24560,
    growth: 12.5,
  },
};

const SYSTEM_HEALTH = {
  api: { status: "healthy", latency: 45 },
  database: { status: "healthy", latency: 12 },
  storage: { status: "healthy", usage: 67 },
  queue: { status: "warning", pending: 23 },
};

const TOP_ORGANIZATIONS = [
  { id: "1", name: "Premium Cabinets Inc", users: 24, cutlists: 456, plan: "enterprise", status: "active" },
  { id: "2", name: "Modern Woodworks", users: 12, cutlists: 234, plan: "professional", status: "active" },
  { id: "3", name: "FastCut Solutions", users: 18, cutlists: 189, plan: "professional", status: "active" },
  { id: "4", name: "Artisan Furniture Co", users: 8, cutlists: 156, plan: "starter", status: "active" },
  { id: "5", name: "QuickPanel Shop", users: 6, cutlists: 98, plan: "starter", status: "trial" },
];

const RECENT_ACTIVITY = [
  { id: "1", type: "signup", message: "New organization registered: Panel Masters", time: "5 min ago" },
  { id: "2", type: "upgrade", message: "Premium Cabinets upgraded to Enterprise", time: "1 hour ago" },
  { id: "3", type: "alert", message: "High API usage detected from Modern Woodworks", time: "2 hours ago" },
  { id: "4", type: "signup", message: "New user: john@fastcut.com joined FastCut Solutions", time: "3 hours ago" },
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

export default function PlatformDashboardPage() {
  const router = useRouter();
  const { user, logout, isSuperAdmin } = useAuthStore();

  // Redirect if not super admin
  React.useEffect(() => {
    if (!isSuperAdmin()) {
      router.push("/platform/login");
    }
  }, [isSuperAdmin, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/platform/login");
  };

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <p>Verifying access...</p>
        </div>
      </div>
    );
  }

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
                <Link href="/platform/users">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Users className="h-4 w-4 mr-2" />
                    Users
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
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
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
                      <span className="text-xs text-slate-500">{user?.email || "super@caiintake.com"}</span>
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
                  <p className="text-3xl font-bold">{PLATFORM_STATS.totalOrganizations}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-blue-100">
                {PLATFORM_STATS.activeOrganizations} active
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Users</p>
                  <p className="text-3xl font-bold">{PLATFORM_STATS.totalUsers}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-purple-100">
                +{PLATFORM_STATS.newUsersThisMonth} this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-teal-100 text-sm">Cutlists Created</p>
                  <p className="text-3xl font-bold">{PLATFORM_STATS.totalCutlists.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-teal-100">
                {PLATFORM_STATS.parseJobsToday} today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Monthly Revenue</p>
                  <p className="text-3xl font-bold">${(PLATFORM_STATS.revenue.monthly / 1000).toFixed(1)}k</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-100">
                +{PLATFORM_STATS.revenue.growth}% growth
              </p>
            </CardContent>
          </Card>
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
                    <p className="text-xs text-slate-500">{SYSTEM_HEALTH.api.latency}ms</p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.api.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Database className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Database</p>
                    <p className="text-xs text-slate-500">{SYSTEM_HEALTH.database.latency}ms</p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.database.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Cpu className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Storage</p>
                    <p className="text-xs text-slate-500">{SYSTEM_HEALTH.storage.usage}% used</p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.storage.status} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <Clock className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Job Queue</p>
                    <p className="text-xs text-slate-500">{SYSTEM_HEALTH.queue.pending} pending</p>
                  </div>
                </div>
                <StatusIndicator status={SYSTEM_HEALTH.queue.status} />
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
              <div className="space-y-4">
                {RECENT_ACTIVITY.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      activity.type === "signup" && "bg-green-100",
                      activity.type === "upgrade" && "bg-purple-100",
                      activity.type === "alert" && "bg-amber-100",
                    )}>
                      {activity.type === "signup" && <Users className="h-4 w-4 text-green-600" />}
                      {activity.type === "upgrade" && <TrendingUp className="h-4 w-4 text-purple-600" />}
                      {activity.type === "alert" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{activity.message}</p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
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

