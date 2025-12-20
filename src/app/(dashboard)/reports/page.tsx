"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Package,
  Layers,
  FileText,
  Calendar,
  Download,
  Filter,
  Users,
  Clock,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Mock data for demonstration
const MOCK_STATS = {
  totalCutlists: 156,
  totalParts: 4823,
  totalPieces: 12456,
  totalArea: 892.5, // m²
  avgEfficiency: 0.78,
  avgPartsPerCutlist: 31,
};

const MOCK_MONTHLY_DATA = [
  { month: "Jul", cutlists: 12, parts: 312, area: 45.2 },
  { month: "Aug", cutlists: 15, parts: 425, area: 58.3 },
  { month: "Sep", cutlists: 18, parts: 521, area: 72.1 },
  { month: "Oct", cutlists: 22, parts: 687, area: 89.5 },
  { month: "Nov", cutlists: 25, parts: 798, area: 105.2 },
  { month: "Dec", cutlists: 20, parts: 612, area: 82.4 },
];

const MOCK_MATERIAL_USAGE = [
  { material: "White Melamine 18mm", area: 245.3, percentage: 27.5, color: "#00838F" },
  { material: "Oak Veneer 18mm", area: 189.2, percentage: 21.2, color: "#C4A35A" },
  { material: "Black Melamine 16mm", area: 156.8, percentage: 17.6, color: "#1A1A1A" },
  { material: "MDF 18mm", area: 134.5, percentage: 15.1, color: "#8B7355" },
  { material: "Walnut Veneer 19mm", area: 98.2, percentage: 11.0, color: "#5D4037" },
  { material: "Other", area: 68.5, percentage: 7.6, color: "#9E9E9E" },
];

const MOCK_RECENT_CUTLISTS = [
  { id: "CL-001", name: "Kitchen Cabinets - Smith", parts: 45, status: "completed", date: "2024-12-18" },
  { id: "CL-002", name: "Office Storage Units", parts: 28, status: "processing", date: "2024-12-19" },
  { id: "CL-003", name: "Bathroom Vanity", parts: 12, status: "completed", date: "2024-12-19" },
  { id: "CL-004", name: "Wardrobe Set - Johnson", parts: 56, status: "draft", date: "2024-12-20" },
  { id: "CL-005", name: "TV Unit Custom", parts: 18, status: "completed", date: "2024-12-20" },
];

type TimeRange = "7d" | "30d" | "90d" | "12m" | "all";

export default function ReportsPage() {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("30d");

  const formatArea = (m2: number) => `${m2.toFixed(1)} m²`;
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your cutlist activity and material usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--muted)] rounded-lg p-1">
            {(["7d", "30d", "90d", "12m", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  timeRange === range
                    ? "bg-white shadow text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {range === "all" ? "All Time" : range}
              </button>
            ))}
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total Cutlists</p>
                <p className="text-3xl font-bold">{MOCK_STATS.totalCutlists}</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  +12% vs last period
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
                <p className="text-3xl font-bold">{MOCK_STATS.totalParts.toLocaleString()}</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  +8% vs last period
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
                <p className="text-3xl font-bold">{formatArea(MOCK_STATS.totalArea)}</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  +15% vs last period
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
                <p className="text-3xl font-bold">{formatPercentage(MOCK_STATS.avgEfficiency)}</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  +2.3% improvement
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
              {MOCK_MONTHLY_DATA.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[var(--cai-teal)] rounded-t transition-all hover:bg-[var(--cai-teal)]/80"
                    style={{ height: `${(data.cutlists / 30) * 100}%`, minHeight: "20px" }}
                    title={`${data.cutlists} cutlists`}
                  />
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
              {MOCK_MATERIAL_USAGE.map((material, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{material.material}</span>
                    <span className="text-[var(--muted-foreground)]">
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
              <Button variant="ghost" size="sm">View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_RECENT_CUTLISTS.map((cutlist) => (
                <div
                  key={cutlist.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <p className="font-medium">{cutlist.name}</p>
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
                  >
                    {cutlist.status}
                  </Badge>
                </div>
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
                <span className="font-bold">{MOCK_STATS.avgPartsPerCutlist}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">Total Pieces</span>
                </div>
                <span className="font-bold">{MOCK_STATS.totalPieces.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">This Month</span>
                </div>
                <span className="font-bold">
                  {MOCK_MONTHLY_DATA[MOCK_MONTHLY_DATA.length - 1].cutlists} cutlists
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm">Team Members</span>
                </div>
                <span className="font-bold">5</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">Material Saved</span>
                </div>
                <span className="font-bold text-green-700">23.5 m²</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

