"use client";

/**
 * CAI Intake - Training Dashboard
 * 
 * View accuracy metrics, manage training examples, and monitor
 * parsing performance over time.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Upload,
  Plus,
  RefreshCw,
  ShieldX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BulkTrainingUpload from "@/components/training/BulkTrainingUpload";
import AddExampleModal from "@/components/training/AddExampleModal";
import { useAuthStore } from "@/lib/auth/store";

// ============================================================
// TYPES
// ============================================================

interface AccuracySummary {
  overallAccuracy: number;
  totalPartsProcessed: number;
  totalDocuments: number;
  trend: "improving" | "stable" | "declining";
  weakestField: string;
  strongestField: string;
  fieldAccuracy: Record<string, number | null>;
  fewShotEffectiveness: {
    withFewShot: { count: number; avgAccuracy: number | null };
    withoutFewShot: { count: number; avgAccuracy: number | null };
    improvement: number | null;
  };
}

interface TrainingExample {
  id: string;
  sourceType: string;
  sourceFileName: string | null;
  sourceTextPreview: string;
  partsCount: number;
  category: string | null;
  difficulty: string;
  clientName: string | null;
  features: {
    hasHeaders: boolean;
    columnCount: number | null;
    rowCount: number | null;
    hasEdgeNotation: boolean;
    hasGrooveNotation: boolean;
  };
  stats: {
    usageCount: number;
    successCount: number;
    successRate: number | null;
    lastUsedAt: string | null;
  };
  isGlobal: boolean;
  createdAt: string;
}

interface WeakArea {
  field: string;
  accuracy: number;
  suggestions: string[];
}

// ============================================================
// COMPONENT
// ============================================================

export default function TrainingDashboard() {
  const router = useRouter();
  const { isSuperAdmin, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [accuracy, setAccuracy] = useState<AccuracySummary | null>(null);
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to appropriate page based on user role
  useEffect(() => {
    if (mounted && !authLoading && isAuthenticated) {
      if (!isSuperAdmin()) {
        // Non-super-admins go back to settings
        router.push("/settings");
      } else {
        // Super admins should use the platform training page
        router.push("/platform/training");
      }
    }
  }, [mounted, authLoading, isAuthenticated, isSuperAdmin, router]);

  // Fetch data on mount
  useEffect(() => {
    if (mounted && isSuperAdmin()) {
      fetchData();
    }
  }, [mounted]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch accuracy summary and examples in parallel
      const [accuracyRes, examplesRes, breakdownRes] = await Promise.all([
        fetch("/api/v1/training/accuracy?view=summary"),
        fetch("/api/v1/training/examples?limit=20"),
        fetch("/api/v1/training/accuracy?view=breakdown"),
      ]);

      if (accuracyRes.ok) {
        const data = await accuracyRes.json();
        setAccuracy(data.data);
      }

      if (examplesRes.ok) {
        const data = await examplesRes.json();
        setExamples(data.examples || []);
      }

      if (breakdownRes.ok) {
        const data = await breakdownRes.json();
        setWeakAreas(data.data?.weakAreas || []);
      }
    } catch (error) {
      console.error("Failed to fetch training data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Show loading while checking auth
  if (!mounted || authLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-super-admins
  if (!isSuperAdmin()) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <ShieldX className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          AI Training is a platform-wide feature available only to super administrators.
        </p>
        <Button onClick={() => router.push("/settings")}>
          Back to Settings
        </Button>
      </div>
    );
  }

  // Show loading for data
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-[var(--cai-teal)]" />
            AI Training & Accuracy
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Monitor parsing accuracy, manage training examples, and improve extraction quality.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Example
          </Button>
        </div>
      </div>

      {/* Add Example Modal */}
      <AddExampleModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchData}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Accuracy"
          value={accuracy?.overallAccuracy ? `${(accuracy.overallAccuracy * 100).toFixed(1)}%` : "N/A"}
          trend={accuracy?.trend}
          icon={<Target className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          title="Parts Processed"
          value={accuracy?.totalPartsProcessed?.toLocaleString() || "0"}
          subtitle={`${accuracy?.totalDocuments || 0} documents`}
          icon={<BarChart3 className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Training Examples"
          value={examples.length.toString()}
          subtitle="active examples"
          icon={<FileText className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Few-Shot Impact"
          value={
            accuracy?.fewShotEffectiveness?.improvement != null
              ? `+${(accuracy.fewShotEffectiveness.improvement * 100).toFixed(1)}%`
              : "N/A"
          }
          subtitle="accuracy improvement"
          icon={<Brain className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="examples">Training Examples</TabsTrigger>
          <TabsTrigger value="upload">Bulk Upload</TabsTrigger>
          <TabsTrigger value="weak-areas">Areas to Improve</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Field Accuracy Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Accuracy</CardTitle>
                <CardDescription>How accurately each field is being parsed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accuracy?.fieldAccuracy && Object.entries(accuracy.fieldAccuracy).map(([field, value]) => (
                    <FieldAccuracyBar
                      key={field}
                      field={field}
                      accuracy={value}
                      isWeakest={field === accuracy.weakestField}
                      isStrongest={field === accuracy.strongestField}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Few-Shot Effectiveness */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Few-Shot Learning Impact</CardTitle>
                <CardDescription>Comparing accuracy with and without training examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {accuracy?.fewShotEffectiveness?.withFewShot?.avgAccuracy != null
                          ? `${(accuracy.fewShotEffectiveness.withFewShot.avgAccuracy * 100).toFixed(1)}%`
                          : "N/A"}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">With Examples</div>
                      <div className="text-xs mt-1">
                        {accuracy?.fewShotEffectiveness?.withFewShot?.count || 0} documents
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold">
                        {accuracy?.fewShotEffectiveness?.withoutFewShot?.avgAccuracy != null
                          ? `${(accuracy.fewShotEffectiveness.withoutFewShot.avgAccuracy * 100).toFixed(1)}%`
                          : "N/A"}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">Without Examples</div>
                      <div className="text-xs mt-1">
                        {accuracy?.fewShotEffectiveness?.withoutFewShot?.count || 0} documents
                      </div>
                    </div>
                  </div>
                  
                  {accuracy?.fewShotEffectiveness?.improvement != null && (
                    <div className="text-center p-3 bg-[var(--cai-teal)]/10 rounded-lg">
                      <span className="text-lg font-semibold text-[var(--cai-teal)]">
                        {accuracy.fewShotEffectiveness.improvement > 0 ? "+" : ""}
                        {(accuracy.fewShotEffectiveness.improvement * 100).toFixed(1)}%
                      </span>
                      <span className="text-sm ml-2">improvement with few-shot learning</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Training Examples</CardTitle>
                <CardDescription>
                  Examples used to improve parsing accuracy through few-shot learning
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
            </CardHeader>
            <CardContent>
              {examples.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-3" />
                  <h3 className="font-medium">No training examples yet</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    Add verified cutlists to improve parsing accuracy
                  </p>
                  <Button variant="primary" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Example
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {examples.map(example => (
                    <ExampleCard key={example.id} example={example} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <BulkTrainingUpload />
        </TabsContent>

        {/* Weak Areas Tab */}
        <TabsContent value="weak-areas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Areas Needing Improvement
              </CardTitle>
              <CardDescription>
                Fields with accuracy below 90% that could benefit from more training
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weakAreas.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <h3 className="font-medium">All areas performing well!</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    All fields are above 90% accuracy
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weakAreas.map(area => (
                    <WeakAreaCard key={area.field} area={area} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "improving" | "stable" | "declining";
  icon: React.ReactNode;
  color: "teal" | "blue" | "purple" | "green";
}) {
  const colorClasses = {
    teal: "text-[var(--cai-teal)] bg-[var(--cai-teal)]/10",
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    green: "text-green-500 bg-green-500/10",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", colorClasses[color])}>
            {icon}
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {trend === "improving" && <TrendingUp className="h-4 w-4 text-green-500" />}
              {trend === "declining" && <TrendingDown className="h-4 w-4 text-red-500" />}
              {trend === "stable" && <Minus className="h-4 w-4 text-gray-400" />}
              <span className="text-xs text-[var(--muted-foreground)]">{trend}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <div className="text-sm text-[var(--muted-foreground)]">{subtitle}</div>
          )}
          <div className="text-xs text-[var(--muted-foreground)] mt-1">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldAccuracyBar({
  field,
  accuracy,
  isWeakest,
  isStrongest,
}: {
  field: string;
  accuracy: number | null;
  isWeakest: boolean;
  isStrongest: boolean;
}) {
  if (accuracy === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-24 text-sm capitalize">{field}</div>
        <div className="flex-1 text-sm text-[var(--muted-foreground)]">No data</div>
      </div>
    );
  }

  const percentage = accuracy * 100;
  const barColor = percentage >= 90 ? "bg-green-500" : percentage >= 70 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm capitalize flex items-center gap-1">
        {field}
        {isStrongest && <span className="text-green-500">★</span>}
        {isWeakest && <span className="text-amber-500">!</span>}
      </div>
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
        <div
          className={cn("h-2.5 rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="w-12 text-sm text-right font-medium">
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

function ExampleCard({ example }: { example: TrainingExample }) {
  return (
    <div className="p-3 border border-[var(--border)] rounded-lg hover:border-[var(--cai-teal)]/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">
              {example.sourceFileName || `Example ${example.id.slice(0, 8)}`}
            </span>
            <Badge variant="secondary" className="text-xs">
              {example.partsCount} parts
            </Badge>
            {example.isGlobal && (
              <Badge variant="outline" className="text-xs">Global</Badge>
            )}
          </div>
          <div className="text-sm text-[var(--muted-foreground)] mt-1 flex gap-3 flex-wrap">
            <span>Type: {example.sourceType}</span>
            {example.clientName && <span>Client: {example.clientName}</span>}
            <span>Difficulty: {example.difficulty}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted-foreground)]">
            <span>Used {example.stats.usageCount} times</span>
            <span>Success rate: {example.stats.successRate != null ? `${(example.stats.successRate * 100).toFixed(0)}%` : "N/A"}</span>
            {example.features.hasEdgeNotation && <Badge variant="outline" className="text-xs">Edges</Badge>}
            {example.features.hasGrooveNotation && <Badge variant="outline" className="text-xs">Grooves</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="sm">View</Button>
      </div>
    </div>
  );
}

function WeakAreaCard({ area }: { area: WeakArea }) {
  return (
    <div className="p-4 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium capitalize flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {area.field}
        </div>
        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
          {(area.accuracy * 100).toFixed(0)}% accuracy
        </Badge>
      </div>
      <div className="space-y-1">
        {area.suggestions.map((suggestion, i) => (
          <div key={i} className="text-sm text-[var(--muted-foreground)] flex items-start gap-2">
            <span className="text-amber-500">•</span>
            {suggestion}
          </div>
        ))}
      </div>
    </div>
  );
}

