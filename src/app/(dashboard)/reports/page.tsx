"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Layers,
  FileText,
  Calendar,
  Download,
  Users,
  Clock,
  Target,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface ReportStats {
  totalCutlists: number;
  totalParts: number;
  totalPieces: number;
  totalArea: number;
  avgEfficiency: number;
  avgPartsPerCutlist: number;
  cutlistsThisPeriod: number;
  partsThisPeriod: number;
  periodGrowth: {
    cutlists: number;
    parts: number;
    area: number;
    efficiency: number;
  };
}

interface MonthlyData {
  month: string;
  cutlists: number;
  parts: number;
  area: number;
}

interface MaterialUsage {
  material: string;
  area: number;
  percentage: number;
  color: string;
}

interface RecentCutlist {
  id: string;
  name: string;
  parts: number;
  status: string;
  date: string;
}

type TimeRange = "7d" | "30d" | "90d" | "12m" | "all";

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchReportData(timeRange: TimeRange): Promise<{
  stats: ReportStats;
  monthlyData: MonthlyData[];
  materialUsage: MaterialUsage[];
  recentCutlists: RecentCutlist[];
} | null> {
  try {
    const response = await fetch(`/api/v1/reports?range=${timeRange}`);
    if (!response.ok) {
      throw new Error("Failed to fetch report data");
    }
    return response.json();
  } catch (error) {
    console.error("Failed to fetch report data:", error);
    return null;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReportsPage() {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("30d");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<{
    stats: ReportStats;
    monthlyData: MonthlyData[];
    materialUsage: MaterialUsage[];
    recentCutlists: RecentCutlist[];
  } | null>(null);

  // Fetch data on mount and when time range changes
  React.useEffect(() => {
    setLoading(true);
    fetchReportData(timeRange)
      .then(setData)
      .finally(() => setLoading(false));
  }, [timeRange]);

  const formatArea = (m2: number) => `${m2.toFixed(1)} m²`;
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  const handleExport = () => {
    if (!data) return;
    
    // Create CSV export
    const csv = [
      ["Metric", "Value"],
      ["Total Cutlists", data.stats.totalCutlists],
      ["Total Parts", data.stats.totalParts],
      ["Total Pieces", data.stats.totalPieces],
      ["Total Area (m²)", data.stats.totalArea],
      ["Avg Efficiency", formatPercentage(data.stats.avgEfficiency)],
      ["Avg Parts/Cutlist", data.stats.avgPartsPerCutlist],
      [""],
      ["Monthly Activity"],
      ["Month", "Cutlists", "Parts", "Area (m²)"],
      ...data.monthlyData.map(m => [m.month, m.cutlists, m.parts, m.area]),
      [""],
      ["Material Usage"],
      ["Material", "Area (m²)", "Percentage"],
      ...data.materialUsage.map(m => [m.material, m.area, m.percentage + "%"]),
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cai-intake-report-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
          <p className="text-[var(--muted-foreground)]">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-[var(--muted-foreground)]" />
          <div>
            <h3 className="font-semibold text-lg mb-1">Unable to load reports</h3>
            <p className="text-[var(--muted-foreground)] mb-4">
              There was a problem fetching your analytics data.
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { stats, monthlyData, materialUsage, recentCutlists } = data;
  const maxCutlists = Math.max(...monthlyData.map(d => d.cutlists));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your cutlist activity and material usage
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[var(--muted)] rounded-lg p-1">
            {(["7d", "30d", "90d", "12m", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
                  timeRange === range
                    ? "bg-white shadow text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {range === "all" ? "All Time" : range}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total Cutlists</p>
                <p className="text-3xl font-bold">{stats.totalCutlists}</p>
                <p className={cn(
                  "text-xs flex items-center gap-1 mt-1",
                  stats.periodGrowth.cutlists >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {stats.periodGrowth.cutlists >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stats.periodGrowth.cutlists >= 0 ? "+" : ""}
                  {stats.periodGrowth.cutlists}% vs last period
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[var(--cai-teal)]/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-[var(--cai-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total Parts</p>
                <p className="text-3xl font-bold">{stats.totalParts.toLocaleString()}</p>
                <p className={cn(
                  "text-xs flex items-center gap-1 mt-1",
                  stats.periodGrowth.parts >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {stats.periodGrowth.parts >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stats.periodGrowth.parts >= 0 ? "+" : ""}
                  {stats.periodGrowth.parts}% vs last period
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Material Used</p>
                <p className="text-3xl font-bold">{formatArea(stats.totalArea)}</p>
                <p className={cn(
                  "text-xs flex items-center gap-1 mt-1",
                  stats.periodGrowth.area >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {stats.periodGrowth.area >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stats.periodGrowth.area >= 0 ? "+" : ""}
                  {stats.periodGrowth.area}% vs last period
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Layers className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Avg Efficiency</p>
                <p className="text-3xl font-bold">{formatPercentage(stats.avgEfficiency)}</p>
                <p className={cn(
                  "text-xs flex items-center gap-1 mt-1",
                  stats.periodGrowth.efficiency >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {stats.periodGrowth.efficiency >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stats.periodGrowth.efficiency >= 0 ? "+" : ""}
                  {stats.periodGrowth.efficiency}% improvement
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cutlist Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-2">
              {monthlyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-[var(--cai-teal)] rounded-t transition-all group-hover:bg-[var(--cai-teal)]/80"
                      style={{ 
                        height: `${(data.cutlists / maxCutlists) * 200}px`, 
                        minHeight: "20px" 
                      }}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {data.cutlists} cutlists
                    </div>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">{data.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-[var(--cai-teal)]" />
                <span className="text-[var(--muted-foreground)]">Cutlists Created</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Material Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Material Usage Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {materialUsage.map((material, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">{material.material}</span>
                    <span className="text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatArea(material.area)} ({material.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${material.percentage}%`,
                        backgroundColor: material.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Cutlists */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Cutlists
              </span>
              <a href="/cutlists" className="text-sm text-[var(--cai-teal)] hover:underline">
                View All
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCutlists.map((cutlist) => (
                <a
                  key={cutlist.id}
                  href={`/cutlists/${cutlist.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{cutlist.name}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {cutlist.parts} parts • {cutlist.date}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      cutlist.status === "completed"
                        ? "success"
                        : cutlist.status === "processing"
                        ? "default"
                        : "secondary"
                    }
                    className="flex-shrink-0"
                  >
                    {cutlist.status}
                  </Badge>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">Avg Parts/Cutlist</span>
                </div>
                <span className="font-bold">{stats.avgPartsPerCutlist}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">Total Pieces</span>
                </div>
                <span className="font-bold">{stats.totalPieces.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">This Period</span>
                </div>
                <span className="font-bold">
                  {stats.cutlistsThisPeriod} cutlists
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">Parts This Period</span>
                </div>
                <span className="font-bold">{stats.partsThisPeriod}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">Efficiency Score</span>
                </div>
                <span className="font-bold text-green-700">
                  {formatPercentage(stats.avgEfficiency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
