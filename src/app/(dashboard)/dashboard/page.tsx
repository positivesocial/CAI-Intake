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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Mock data for dashboard
const MOCK_STATS = {
  cutlistsThisWeek: 12,
  partsProcessed: 847,
  averageConfidence: 94.2,
  optimizedSheets: 45,
  savedMaterial: 8.3, // percentage
  activeJobs: 3,
};

const MOCK_RECENT_CUTLISTS = [
  {
    id: "1",
    name: "Kitchen Cabinet Set",
    status: "completed",
    partsCount: 48,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "2",
    name: "Office Desk Components",
    status: "processing",
    partsCount: 12,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "3",
    name: "Bedroom Wardrobe",
    status: "draft",
    partsCount: 36,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "4",
    name: "Bathroom Vanity",
    status: "completed",
    partsCount: 18,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
];

const MOCK_ACTIVITY = [
  { action: "Cutlist exported", target: "Kitchen Cabinet Set", time: "2 hours ago" },
  { action: "Parts parsed", target: "156 parts via Excel import", time: "3 hours ago" },
  { action: "Optimization completed", target: "Office Desk - 89% utilization", time: "5 hours ago" },
  { action: "New cutlist created", target: "Bedroom Wardrobe", time: "1 day ago" },
];

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

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Welcome back, {user?.name?.split(" ")[0] || "User"}
              </h1>
              <p className="text-[var(--muted-foreground)]">
                Here's what's happening with your cutlists
              </p>
            </div>
            <Link href="/intake">
              <Button variant="primary" size="lg">
                <Plus className="h-5 w-5" />
                New Cutlist
              </Button>
            </Link>
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
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Cutlists This Week
                  </p>
                  <p className="text-3xl font-bold">
                    {MOCK_STATS.cutlistsThisWeek}
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
                    {MOCK_STATS.partsProcessed.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm text-[var(--muted-foreground)]">
                <Clock className="h-4 w-4 mr-1" />
                {MOCK_STATS.activeJobs} jobs in progress
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
                    {MOCK_STATS.averageConfidence}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <Progress
                value={MOCK_STATS.averageConfidence}
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
                  <p className="text-3xl font-bold">{MOCK_STATS.savedMaterial}%</p>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Cutlists */}
          <div className="lg:col-span-2">
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
                            {cutlist.partsCount} parts •{" "}
                            {formatTimeAgo(cutlist.createdAt)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={cutlist.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed */}
          <div>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
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
                      <div>
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {activity.target}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="mt-6">
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
                <Link href="/settings" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Team
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

