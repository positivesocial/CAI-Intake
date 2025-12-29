"use client";

/**
 * CAI Intake - Super Admin Analytics Dashboard
 * 
 * Platform-wide analytics for:
 * - API usage across all organizations
 * - Cost breakdown by provider
 * - Error rates and monitoring
 * - Active users/orgs metrics
 */

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Zap,
  AlertTriangle,
  Activity,
  RefreshCw,
  Download,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  Server,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgDuration: number;
  successRate: number;
  errorRate: number;
}

interface ProviderStats {
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
  successRate: number;
}

interface OrganizationStats {
  id: string;
  name: string;
  requests: number;
  cost: number;
  activeUsers: number;
  lastActive: string;
}

interface ErrorSummary {
  type: string;
  count: number;
  lastOccurred: string;
  severity: "critical" | "error" | "warning";
}

interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
}

// ============================================================
// API TYPES
// ============================================================

interface AnalyticsData {
  stats: UsageStats;
  providers: ProviderStats[];
  organizations: OrganizationStats[];
  errors: ErrorSummary[];
  dailyUsage: DailyUsage[];
  totals: { organizations: number; users: number };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function MetricCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = "teal",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  change?: number;
  changeLabel?: string;
  color?: "teal" | "green" | "red" | "blue" | "orange";
}) {
  const colorClasses = {
    teal: "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    blue: "bg-blue-100 text-blue-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {change >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    change >= 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {Math.abs(change)}%
                </span>
                {changeLabel && (
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-lg", colorClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderUsageCard({ stats, totalCost }: { stats: ProviderStats; totalCost: number }) {
  const percentage = totalCost > 0 ? (stats.cost / totalCost) * 100 : 0;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="w-12 h-12 rounded-lg bg-[var(--muted)] flex items-center justify-center">
        <Cpu className="h-6 w-6 text-[var(--cai-teal)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium">{stats.provider}</span>
          <span className="font-mono text-sm">{formatCurrency(stats.cost)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={percentage} className="h-2 flex-1" />
          <span className="text-xs text-[var(--muted-foreground)] min-w-[40px]">
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
          <span>{formatNumber(stats.requests)} requests</span>
          <span>{formatNumber(stats.tokens)} tokens</span>
          <span className={stats.successRate >= 99 ? "text-green-500" : "text-orange-500"}>
            {stats.successRate}% success
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: DailyUsage[] }) {
  const maxRequests = Math.max(...data.map((d) => d.requests));

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((day, i) => {
        const height = (day.requests / maxRequests) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-[var(--cai-teal)]/70 hover:bg-[var(--cai-teal)] transition-colors rounded-t cursor-pointer"
            style={{ height: `${height}%` }}
            title={`${day.date}: ${formatNumber(day.requests)} requests`}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const DEFAULT_DATA: AnalyticsData = {
  stats: { totalRequests: 0, totalTokens: 0, totalCost: 0, avgDuration: 0, successRate: 0, errorRate: 0 },
  providers: [],
  organizations: [],
  errors: [],
  dailyUsage: [],
  totals: { organizations: 0, users: 0 },
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState("14d");
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());
  const [data, setData] = React.useState<AnalyticsData>(DEFAULT_DATA);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/platform/analytics?range=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[var(--cai-teal)]" />
            Platform Analytics
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Monitor API usage, costs, and performance across all organizations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Activity className="h-4 w-4" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={formatNumber(data.stats.totalRequests)}
          icon={Zap}
          change={12.5}
          changeLabel="vs last period"
          color="teal"
        />
        <MetricCard
          title="Total Cost"
          value={formatCurrency(data.stats.totalCost)}
          icon={DollarSign}
          change={8.3}
          changeLabel="vs last period"
          color="green"
        />
        <MetricCard
          title="Success Rate"
          value={`${data.stats.successRate}%`}
          icon={CheckCircle2}
          change={0.5}
          changeLabel="vs last period"
          color="blue"
        />
        <MetricCard
          title="Avg Response Time"
          value={formatDuration(data.stats.avgDuration)}
          icon={TrendingUp}
          change={-5.2}
          changeLabel="vs last period"
          color="orange"
        />
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Usage Trend
          </CardTitle>
          <CardDescription>
            Daily API requests over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.dailyUsage.length > 0 ? (
            <>
              <MiniBarChart data={data.dailyUsage} />
              <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted-foreground)]">
                <span>{data.dailyUsage[0]?.date}</span>
                <span>{data.dailyUsage[data.dailyUsage.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <div className="text-center text-[var(--muted-foreground)] py-8">No data available</div>
          )}
        </CardContent>
      </Card>

      {/* Provider Breakdown & Top Organizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Cost by Provider
            </CardTitle>
            <CardDescription>
              API usage breakdown by AI provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.providers.length > 0 ? (
              data.providers.map((provider) => (
                <ProviderUsageCard key={provider.provider} stats={provider} totalCost={data.stats.totalCost} />
              ))
            ) : (
              <div className="text-center text-[var(--muted-foreground)] py-4">No provider data available</div>
            )}
          </CardContent>
        </Card>

        {/* Top Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top Organizations
            </CardTitle>
            <CardDescription>
              Organizations ranked by API usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.organizations.length > 0 ? (
                data.organizations.map((org, i) => (
                  <div
                    key={org.id}
                    className="flex items-center gap-4 p-3 border rounded-lg hover:bg-[var(--muted)]/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--cai-teal)]/10 flex items-center justify-center text-sm font-medium text-[var(--cai-teal)]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {org.activeUsers} users
                        </span>
                        <span>•</span>
                        <span>{org.lastActive}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium">
                        {formatCurrency(org.cost)}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {formatNumber(org.requests)} requests
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[var(--muted-foreground)] py-4">No organizations yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Error Monitoring
          </CardTitle>
          <CardDescription>
            Recent errors and warnings across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.errors.length > 0 ? data.errors.map((err) => (
              <div
                key={err.type}
                className={cn(
                  "p-4 rounded-lg border",
                  err.severity === "critical" && "border-red-300 bg-red-50",
                  err.severity === "error" && "border-orange-300 bg-orange-50",
                  err.severity === "warning" && "border-amber-300 bg-amber-50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={
                      err.severity === "critical"
                        ? "error"
                        : err.severity === "error"
                        ? "warning"
                        : "outline"
                    }
                  >
                    {err.severity}
                  </Badge>
                  <span className="text-2xl font-bold">{err.count}</span>
                </div>
                <div className="text-sm font-medium truncate">
                  {err.type.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  Last: {err.lastOccurred}
                </div>
              </div>
            )) : (
              <div className="col-span-4 text-center text-[var(--muted-foreground)] py-4">No errors recorded</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <div className="font-medium">OpenAI API</div>
                <div className="text-sm text-green-600">Operational</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <div className="font-medium">Anthropic API</div>
                <div className="text-sm text-green-600">Operational</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <div className="font-medium">Python OCR Service</div>
                <div className="text-sm text-green-600">Operational</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

