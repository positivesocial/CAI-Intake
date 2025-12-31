"use client";

/**
 * CAI Intake - Super Admin Training Dashboard
 * 
 * Platform-wide AI training metrics:
 * - Training examples across all organizations
 * - Accuracy metrics and trends
 * - OCR audit logs
 * - User corrections tracking
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
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
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Clock,
  BarChart3,
  Lightbulb,
  BookOpen,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Image,
  FileSpreadsheet,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

interface TrainingMetrics {
  totalExamples: number;
  examplesThisWeek: number;
  examplesThisMonth: number;
  avgAccuracy: number;
  accuracyTrend: number; // positive = improving
  correctionsApplied: number;
  autoTrainedExamples: number;
}

interface AccuracyByCategory {
  category: string;
  accuracy: number;
  samples: number;
  trend: number;
}

interface TrainingExample {
  id: string;
  organizationName: string;
  sourceType: string;
  partsCount: number;
  accuracy: number;
  createdAt: string;
  isAutoTrained: boolean;
  templateType?: string;
}

interface OCRAuditEntry {
  id: string;
  timestamp: string;
  provider: string;
  success: boolean;
  partsExtracted: number;
  confidence: number;
  processingTime: number;
  organizationId?: string;
}

interface TrainingData {
  metrics: TrainingMetrics;
  accuracyByCategory: AccuracyByCategory[];
  recentExamples: TrainingExample[];
  ocrAudit: {
    entries: OCRAuditEntry[];
    summary: {
      totalExtractions: number;
      successRate: number;
      avgQualityScore: number;
      avgProcessingTime: number;
    };
  };
  accuracyTrend: Array<{
    date: string;
    accuracy: number;
    samples: number;
  }>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PlatformTrainingPage() {
  const router = useRouter();
  const { user, isSuperAdmin } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<TrainingData | null>(null);
  const [timeRange, setTimeRange] = React.useState("30d");

  // Auth check
  React.useEffect(() => {
    if (!isSuperAdmin()) {
      router.push("/dashboard");
    }
  }, [isSuperAdmin, router]);

  // Fetch training data
  React.useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch from multiple endpoints in parallel
        const [accuracyRes, examplesRes, auditRes] = await Promise.all([
          fetch(`/api/v1/training/accuracy?range=${timeRange}`).catch(() => null),
          fetch(`/api/v1/training/examples?limit=20`).catch(() => null),
          fetch(`/api/v1/platform/ocr-audit?limit=50`).catch(() => null),
        ]);

        // Parse responses
        const accuracyData = accuracyRes?.ok ? await accuracyRes.json() : null;
        const examplesData = examplesRes?.ok ? await examplesRes.json() : null;
        const auditData = auditRes?.ok ? await auditRes.json() : null;

        // Build combined data
        const metrics: TrainingMetrics = {
          totalExamples: examplesData?.total || 0,
          examplesThisWeek: examplesData?.thisWeek || 0,
          examplesThisMonth: examplesData?.thisMonth || 0,
          avgAccuracy: accuracyData?.overall?.accuracy || 0,
          accuracyTrend: accuracyData?.trend || 0,
          correctionsApplied: accuracyData?.correctionsApplied || 0,
          autoTrainedExamples: examplesData?.autoTrained || 0,
        };

        // Build accuracy by category from API data or defaults
        const fieldData = accuracyData?.data?.fieldAccuracy || accuracyData?.byField || {};
        const sampleCount = accuracyData?.data?.totalDocuments || 0;
        
        const accuracyByCategory: AccuracyByCategory[] = [
          { 
            category: "Dimensions", 
            accuracy: (fieldData.dimensions ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Materials", 
            accuracy: (fieldData.materials ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Edge Banding", 
            accuracy: (fieldData.edging ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Grooving", 
            accuracy: (fieldData.grooving ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Holes/Drilling", 
            accuracy: (fieldData.holes ?? fieldData.drilling ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "CNC/Routing", 
            accuracy: (fieldData.cnc ?? fieldData.routing ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Labels/Names", 
            accuracy: (fieldData.labels ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
          { 
            category: "Quantities", 
            accuracy: (fieldData.quantities ?? 0) * 100, 
            samples: sampleCount, 
            trend: 0 
          },
        ];

        const recentExamples: TrainingExample[] = (examplesData?.examples || []).map((e: {
          id: string;
          organization?: { name: string };
          source_type?: string;
          sourceType?: string;
          expected_output?: { parts?: unknown[] };
          expectedOutput?: { parts?: unknown[] };
          accuracy?: number;
          created_at?: string;
          createdAt?: string;
          auto_created?: boolean;
          autoCreated?: boolean;
          template_type?: string;
          templateType?: string;
        }) => ({
          id: e.id,
          organizationName: e.organization?.name || "Unknown",
          sourceType: e.source_type || e.sourceType || "unknown",
          partsCount: e.expected_output?.parts?.length || e.expectedOutput?.parts?.length || 0,
          accuracy: e.accuracy || 0,
          createdAt: e.created_at || e.createdAt || "",
          isAutoTrained: e.auto_created || e.autoCreated || false,
          templateType: e.template_type || e.templateType,
        }));

        const ocrAudit = {
          entries: (auditData?.data?.entries || []).slice(0, 20).map((e: {
            id: string;
            timestamp: string;
            processing?: { provider: string };
            output?: { success: boolean; partsExtracted: number; avgConfidence: number };
            processingTimeMs?: number;
            organizationId?: string;
          }) => ({
            id: e.id,
            timestamp: e.timestamp,
            provider: e.processing?.provider || "unknown",
            success: e.output?.success ?? true,
            partsExtracted: e.output?.partsExtracted || 0,
            confidence: e.output?.avgConfidence || 0,
            processingTime: e.processingTimeMs || 0,
            organizationId: e.organizationId,
          })),
          summary: auditData?.data?.summary || {
            totalExtractions: 0,
            successRate: 0,
            avgQualityScore: 0,
            avgProcessingTime: 0,
          },
        };

        // Generate accuracy trend (mock for now - would come from API)
        const accuracyTrend = Array.from({ length: 14 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (13 - i));
          return {
            date: date.toISOString().split("T")[0],
            accuracy: 85 + Math.random() * 10,
            samples: Math.floor(10 + Math.random() * 50),
          };
        });

        setData({
          metrics,
          accuracyByCategory,
          recentExamples,
          ocrAudit,
          accuracyTrend,
        });
      } catch (err) {
        console.error("Failed to fetch training data:", err);
        setError("Failed to load training data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [timeRange]);

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PlatformHeader 
        title="AI Training" 
        description="Platform-wide AI training metrics and accuracy tracking"
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
          </div>
        )}

        {/* Main Content */}
        {!loading && data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Total Examples</p>
                      <p className="text-2xl font-bold">{data.metrics.totalExamples.toLocaleString()}</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        +{data.metrics.examplesThisWeek} this week
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-[var(--cai-teal)]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Average Accuracy</p>
                      <p className="text-2xl font-bold">{data.metrics.avgAccuracy.toFixed(1)}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        {data.metrics.accuracyTrend >= 0 ? (
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-red-500" />
                        )}
                        <span className={cn(
                          "text-xs",
                          data.metrics.accuracyTrend >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {Math.abs(data.metrics.accuracyTrend).toFixed(1)}% vs last period
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Auto-Trained</p>
                      <p className="text-2xl font-bold">{data.metrics.autoTrainedExamples.toLocaleString()}</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        From user corrections
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">OCR Success Rate</p>
                      <p className="text-2xl font-bold">{data.ocrAudit.summary.successRate.toFixed(1)}%</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {data.ocrAudit.summary.totalExtractions} extractions
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Accuracy by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Accuracy by Category
                </CardTitle>
                <CardDescription>
                  How well the AI performs across different data types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.accuracyByCategory.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat.category}</span>
                          <Badge variant="secondary" className="text-xs">
                            {cat.samples} samples
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cat.accuracy.toFixed(1)}%</span>
                          {cat.trend >= 0 ? (
                            <span className="text-xs text-green-500 flex items-center">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              +{cat.trend.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-red-500 flex items-center">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              {cat.trend.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress 
                        value={cat.accuracy} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Training Examples & OCR Audit */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Training Examples */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Recent Training Examples
                  </CardTitle>
                  <CardDescription>
                    Latest examples added to the training set
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {data.recentExamples.length === 0 ? (
                      <p className="text-center text-[var(--muted-foreground)] py-8">
                        No training examples yet
                      </p>
                    ) : (
                      data.recentExamples.map((example) => (
                        <div
                          key={example.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]/50 hover:bg-[var(--muted)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              example.sourceType === "image" 
                                ? "bg-blue-500/10" 
                                : "bg-orange-500/10"
                            )}>
                              {example.sourceType === "image" ? (
                                <Image className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FileSpreadsheet className="h-4 w-4 text-orange-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {example.partsCount} parts
                                </p>
                                {example.isAutoTrained && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Auto
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {example.organizationName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "text-sm font-medium",
                              example.accuracy >= 90 ? "text-green-500" :
                              example.accuracy >= 70 ? "text-yellow-500" :
                              "text-red-500"
                            )}>
                              {example.accuracy.toFixed(0)}%
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {new Date(example.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* OCR Audit Log */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    OCR Audit Log
                  </CardTitle>
                  <CardDescription>
                    Recent OCR extractions and their outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {data.ocrAudit.entries.length === 0 ? (
                      <p className="text-center text-[var(--muted-foreground)] py-8">
                        No OCR audit entries yet
                      </p>
                    ) : (
                      data.ocrAudit.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]/50 hover:bg-[var(--muted)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              entry.success ? "bg-green-500/10" : "bg-red-500/10"
                            )}>
                              {entry.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {entry.partsExtracted} parts
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {entry.provider}
                                </Badge>
                              </div>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {entry.processingTime}ms • {(entry.confidence * 100).toFixed(0)}% confidence
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* OCR Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  OCR Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--muted)]/50">
                    <p className="text-sm text-[var(--muted-foreground)]">Total Extractions</p>
                    <p className="text-xl font-bold">{data.ocrAudit.summary.totalExtractions}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--muted)]/50">
                    <p className="text-sm text-[var(--muted-foreground)]">Success Rate</p>
                    <p className="text-xl font-bold text-green-500">
                      {data.ocrAudit.summary.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--muted)]/50">
                    <p className="text-sm text-[var(--muted-foreground)]">Avg Quality Score</p>
                    <p className="text-xl font-bold">
                      {data.ocrAudit.summary.avgQualityScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--muted)]/50">
                    <p className="text-sm text-[var(--muted-foreground)]">Avg Processing Time</p>
                    <p className="text-xl font-bold">
                      {(data.ocrAudit.summary.avgProcessingTime / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

