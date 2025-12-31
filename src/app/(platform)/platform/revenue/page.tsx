"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
  Download,
  CreditCard,
  BarChart3,
  PieChart,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/store";
import { PlatformHeader } from "@/components/platform/PlatformHeader";

// =============================================================================
// TYPES
// =============================================================================

interface RevenueStats {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  arrGrowth: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  ltv: number;
}

interface PlanBreakdown {
  planId: string;
  planName: string;
  subscribers: number;
  mrr: number;
  percentOfRevenue: number;
  growth: number;
}

interface RecentTransaction {
  id: string;
  organizationName: string;
  planName: string;
  amount: number;
  type: "subscription" | "upgrade" | "downgrade" | "refund";
  date: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconBg,
  iconColor,
  prefix = "",
  suffix = "",
}: {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  prefix?: string;
  suffix?: string;
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {prefix}
              {typeof value === "number" ? value.toLocaleString() : value}
              {suffix}
            </p>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 mt-1 text-sm",
                isPositive && "text-green-600",
                isNegative && "text-red-600",
                !isPositive && !isNegative && "text-[var(--muted-foreground)]"
              )}>
                {isPositive && <ArrowUpRight className="h-4 w-4" />}
                {isNegative && <ArrowDownRight className="h-4 w-4" />}
                <span>{Math.abs(change)}% {changeLabel || "vs last month"}</span>
              </div>
            )}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between h-48 gap-2">
        {data.map((month) => (
          <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--cai-teal)] rounded-t transition-all"
              style={{ height: `${(month.revenue / maxRevenue) * 100}%` }}
            />
            <span className="text-xs text-[var(--muted-foreground)]">{month.month}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>New MRR</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Expansion</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Churned</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function RevenueDashboardPage() {
  const router = useRouter();
  const { isSuperAdmin } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [dateRange, setDateRange] = React.useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [stats, setStats] = React.useState<RevenueStats | null>(null);
  const [planBreakdown, setPlanBreakdown] = React.useState<PlanBreakdown[]>([]);
  const [transactions, setTransactions] = React.useState<RecentTransaction[]>([]);
  const [monthlyData, setMonthlyData] = React.useState<MonthlyRevenue[]>([]);

  // Mount and auth check
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && !isSuperAdmin()) {
      router.push("/platform/login");
    }
  }, [mounted, isSuperAdmin, router]);

  // Fetch data from API
  React.useEffect(() => {
    if (!mounted || !isSuperAdmin()) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/platform/revenue?range=${dateRange}`);
        
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
          setPlanBreakdown(data.planBreakdown);
          setTransactions(data.transactions);
          setMonthlyData(data.monthlyData);
        } else {
          // Fallback to default data
          setStats({
            mrr: 0,
            mrrGrowth: 0,
            arr: 0,
            arrGrowth: 0,
            totalRevenue: 0,
            averageRevenuePerUser: 0,
            churnRate: 0,
            ltv: 0,
          });
          setPlanBreakdown([]);
          setTransactions([]);
          setMonthlyData([]);
        }
      } catch (error) {
        console.error("Failed to fetch revenue data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted, isSuperAdmin, dateRange]);

  // Show loading state until mounted
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
    return (
      <div className="min-h-screen bg-slate-50">
        <PlatformHeader />
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />
      
      {/* Page Header */}
      <div className="border-b border-[var(--border)] bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Revenue Dashboard</h1>
              <p className="text-slate-500">
                Track subscription revenue and growth metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                {(["7d", "30d", "90d", "1y"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={cn(
                      "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                      dateRange === range
                        ? "bg-white shadow text-slate-900"
                        : "text-slate-500"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Key Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Monthly Recurring Revenue"
              value={stats.mrr}
              change={stats.mrrGrowth}
              icon={DollarSign}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              prefix="$"
            />
            <StatCard
              title="Annual Recurring Revenue"
              value={stats.arr}
              change={stats.arrGrowth}
              icon={TrendingUp}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              prefix="$"
            />
            <StatCard
              title="Avg Revenue Per User"
              value={stats.averageRevenuePerUser}
              icon={Users}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              prefix="$"
            />
            <StatCard
              title="Customer LTV"
              value={stats.ltv}
              icon={CreditCard}
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
              prefix="$"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Revenue Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={monthlyData} />
            </CardContent>
          </Card>

          {/* Plan Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Revenue by Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {planBreakdown.map((plan) => (
                <div key={plan.planId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{plan.planName}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      ${plan.mrr} ({plan.percentOfRevenue}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--cai-teal)] rounded-full transition-all"
                      style={{ width: `${plan.percentOfRevenue}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>{plan.subscribers} subscribers</span>
                    <span className={plan.growth > 0 ? "text-green-600" : "text-red-600"}>
                      {plan.growth > 0 ? "+" : ""}{plan.growth}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Total Revenue (YTD)</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Monthly Churn Rate</p>
                    <p className="text-2xl font-bold">{stats.churnRate}%</p>
                    <p className="text-xs text-green-600">Below industry avg (5%)</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Paying Customers</p>
                    <p className="text-2xl font-bold">{planBreakdown.filter(p => p.planId !== "free").reduce((s, p) => s + p.subscribers, 0)}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      of {planBreakdown.reduce((s, p) => s + p.subscribers, 0)} total
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">Organization</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">Type</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
                      <td className="py-3 px-4 font-medium">{tx.organizationName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{tx.planName}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            tx.type === "subscription" || tx.type === "upgrade"
                              ? "success"
                              : tx.type === "refund"
                              ? "error"
                              : "warning"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className={cn(
                        "py-3 px-4 text-right font-medium",
                        tx.amount < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--muted-foreground)]">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

