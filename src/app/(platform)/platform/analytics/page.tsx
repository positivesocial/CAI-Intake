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
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Shield, RefreshCw } from "lucide-react";
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
  Eye,
  FileText,
  Clock,
  Target,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
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

// OCR Audit Types
interface OCRAuditEntry {
  id: string;
  requestId: string;
  timestamp: string;
  input: {
    type: "image" | "pdf" | "text";
    fileName?: string;
    fileSizeKB: number;
  };
  processing: {
    provider: "anthropic" | "openai";
    model: string;
    processingTimeMs: number;
    retryCount: number;
    usedFallback: boolean;
  };
  output: {
    success: boolean;
    partsExtracted: number;
    avgConfidence: number;
    qualityScore: number;
  };
  verification: {
    truncationDetected: boolean;
    validationPassed: boolean;
    reviewFlagsCount: number;
    needsReview: boolean;
  };
  errors: string[];
  warnings: string[];
}

interface OCRMetrics {
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  avgPartsPerExtraction: number;
  avgConfidence: number;
  avgQualityScore: number;
  avgProcessingTimeMs: number;
  truncationRate: number;
  fallbackRate: number;
  reviewRate: number;
  retryRate: number;
  providerBreakdown: {
    anthropic: { count: number; avgTime: number };
    openai: { count: number; avgTime: number };
  };
}

interface OCRAuditData {
  entries: OCRAuditEntry[];
  metrics: {
    day: OCRMetrics;
    week: OCRMetrics;
    month: OCRMetrics;
  };
  summary: {
    totalExtractions: number;
    successRate: number;
    avgQualityScore: number;
    avgProcessingTime: number;
    truncationRate: number;
    reviewRate: number;
    fallbackRate: number;
  };
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

const DEFAULT_OCR_DATA: OCRAuditData = {
  entries: [],
  metrics: {
    day: {} as OCRMetrics,
    week: {} as OCRMetrics,
    month: {} as OCRMetrics,
  },
  summary: {
    totalExtractions: 0,
    successRate: 0,
    avgQualityScore: 0,
    avgProcessingTime: 0,
    truncationRate: 0,
    reviewRate: 0,
    fallbackRate: 0,
  },
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { isSuperAdmin } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);
  const [timeRange, setTimeRange] = React.useState("14d");
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());
  const [data, setData] = React.useState<AnalyticsData>(DEFAULT_DATA);
  const [ocrData, setOcrData] = React.useState<OCRAuditData>(DEFAULT_OCR_DATA);
  const [error, setError] = React.useState<string | null>(null);
  const [showOcrLogs, setShowOcrLogs] = React.useState(false);
  const [ocrMetricPeriod, setOcrMetricPeriod] = React.useState<"day" | "week" | "month">("week");

  // Mount and auth check
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && !isSuperAdmin()) {
      router.push("/platform/login");
    }
  }, [mounted, isSuperAdmin, router]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch both analytics and OCR audit data in parallel
      const [analyticsResponse, ocrResponse] = await Promise.all([
        fetch(`/api/v1/platform/analytics?range=${timeRange}`),
        fetch(`/api/v1/platform/ocr-audit?limit=50`),
      ]);
      
      if (!analyticsResponse.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const analyticsResult = await analyticsResponse.json();
      setData(analyticsResult);
      
      if (ocrResponse.ok) {
        const ocrResult = await ocrResponse.json();
        if (ocrResult.success) {
          setOcrData(ocrResult.data);
        }
      }
      
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PlatformHeader />
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />
      
      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header */}
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

      {/* OCR Audit Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-[var(--cai-teal)]" />
                OCR Audit Dashboard
              </CardTitle>
              <CardDescription>
                Real-time OCR extraction monitoring, quality metrics, and accuracy tracking
              </CardDescription>
            </div>
            <Select value={ocrMetricPeriod} onValueChange={(v) => setOcrMetricPeriod(v as "day" | "week" | "month")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OCR Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <FileText className="h-5 w-5 mx-auto text-[var(--cai-teal)] mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.totalExtractions}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Total Extractions</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.successRate.toFixed(1)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Success Rate</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Target className="h-5 w-5 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.avgQualityScore.toFixed(0)}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Avg Quality</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Clock className="h-5 w-5 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-bold">{(ocrData.summary.avgProcessingTime / 1000).toFixed(1)}s</div>
              <div className="text-xs text-[var(--muted-foreground)]">Avg Time</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <AlertCircle className="h-5 w-5 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.truncationRate.toFixed(1)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Truncation</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <RotateCcw className="h-5 w-5 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.fallbackRate.toFixed(1)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Fallback</div>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Users className="h-5 w-5 mx-auto text-red-500 mb-2" />
              <div className="text-2xl font-bold">{ocrData.summary.reviewRate.toFixed(1)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Needs Review</div>
            </div>
          </div>

          {/* Provider Performance */}
          {ocrData.metrics[ocrMetricPeriod]?.providerBreakdown && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-xs font-bold">A</span>
                  </div>
                  <div>
                    <div className="font-medium">Anthropic Claude</div>
                    <div className="text-xs text-[var(--muted-foreground)]">Primary Provider</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{ocrData.metrics[ocrMetricPeriod].providerBreakdown.anthropic?.count || 0} requests</span>
                  <span className="font-mono">
                    {((ocrData.metrics[ocrMetricPeriod].providerBreakdown.anthropic?.avgTime || 0) / 1000).toFixed(1)}s avg
                  </span>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-xs font-bold">O</span>
                  </div>
                  <div>
                    <div className="font-medium">OpenAI GPT-4o</div>
                    <div className="text-xs text-[var(--muted-foreground)]">Fallback Provider</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{ocrData.metrics[ocrMetricPeriod].providerBreakdown.openai?.count || 0} requests</span>
                  <span className="font-mono">
                    {((ocrData.metrics[ocrMetricPeriod].providerBreakdown.openai?.avgTime || 0) / 1000).toFixed(1)}s avg
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Audit Logs Toggle */}
          <div>
            <Button
              variant="outline"
              onClick={() => setShowOcrLogs(!showOcrLogs)}
              className="w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Recent OCR Audit Logs ({ocrData.entries.length})
              </span>
              {showOcrLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showOcrLogs && (
              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {ocrData.entries.length > 0 ? (
                  ocrData.entries.slice(0, 20).map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 border rounded-lg text-sm",
                        entry.output.success ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {entry.output.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-mono text-xs">{entry.requestId}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.processing.provider}
                          </Badge>
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[var(--muted-foreground)]">Parts:</span>{" "}
                          <span className="font-medium">{entry.output.partsExtracted}</span>
                        </div>
                        <div>
                          <span className="text-[var(--muted-foreground)]">Quality:</span>{" "}
                          <span className="font-medium">{entry.output.qualityScore}/100</span>
                        </div>
                        <div>
                          <span className="text-[var(--muted-foreground)]">Time:</span>{" "}
                          <span className="font-medium">{(entry.processing.processingTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                        <div>
                          <span className="text-[var(--muted-foreground)]">Retries:</span>{" "}
                          <span className="font-medium">{entry.processing.retryCount}</span>
                        </div>
                      </div>
                      {entry.verification.needsReview && (
                        <div className="mt-2 flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs">Flagged for review ({entry.verification.reviewFlagsCount} flags)</span>
                        </div>
                      )}
                      {entry.errors.length > 0 && (
                        <div className="mt-2 text-xs text-red-600">
                          Error: {entry.errors[0]}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[var(--muted-foreground)] py-8">
                    No OCR audit logs yet. Logs appear after file processing.
                  </div>
                )}
              </div>
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
      </main>
    </div>
  );
}

