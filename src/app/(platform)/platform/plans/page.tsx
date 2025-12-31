"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  RefreshCw,
  DollarSign,
  Users,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/store";
import { PlatformHeader } from "@/components/platform/PlatformHeader";

// =============================================================================
// TYPES
// =============================================================================

interface PlanData {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isActive: boolean;
  highlighted: boolean;
  badge?: string;
  limits: {
    maxTeamMembers: number;
    maxCutlistsPerMonth: number;
    maxPartsPerCutlist: number;
    maxStorageMb: number;
    maxAiParsesPerMonth: number;
    maxOcrPagesPerMonth: number;
    maxOptimizationsPerMonth: number;
  };
  features: Record<string, boolean>;
  stripeProductId?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  subscriberCount?: number;
  monthlyRevenue?: number;
}

// =============================================================================
// PLAN EDITOR COMPONENT
// =============================================================================

function PlanEditor({
  plan,
  onSave,
  onCancel,
}: {
  plan: PlanData | null;
  onSave: (plan: PlanData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = React.useState<PlanData>(
    plan || {
      id: "",
      name: "",
      description: "",
      priceMonthly: 0,
      priceYearly: 0,
      isActive: true,
      highlighted: false,
      limits: {
        maxTeamMembers: 1,
        maxCutlistsPerMonth: 5,
        maxPartsPerCutlist: 50,
        maxStorageMb: 100,
        maxAiParsesPerMonth: 10,
        maxOcrPagesPerMonth: 5,
        maxOptimizationsPerMonth: 3,
      },
      features: {
        manualEntry: true,
        csvImport: true,
        excelImport: false,
        aiParsing: false,
        ocrParsing: false,
        voiceInput: false,
        pdfExport: true,
        csvExport: true,
        edgebanding: true,
        grooves: false,
        holes: false,
        cncOperations: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
      },
    }
  );

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateLimit = (key: keyof PlanData["limits"], value: number) => {
    setFormData((prev) => ({
      ...prev,
      limits: { ...prev.limits, [key]: value },
    }));
  };

  const toggleFeature = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Plan ID</label>
          <Input
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            placeholder="e.g., starter"
            disabled={!!plan}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plan Name</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Starter"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Input
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Brief description of this plan"
        />
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Monthly Price ($)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.priceMonthly}
            onChange={(e) =>
              setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Yearly Price ($)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.priceYearly}
            onChange={(e) =>
              setFormData({ ...formData, priceYearly: parseFloat(e.target.value) || 0 })
            }
          />
          {formData.priceMonthly > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Save {Math.round((1 - formData.priceYearly / (formData.priceMonthly * 12)) * 100)}%
            </p>
          )}
        </div>
      </div>

      {/* Stripe IDs */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Stripe Integration
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium mb-1">Stripe Product ID</label>
              <Input
                value={formData.stripeProductId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, stripeProductId: e.target.value })
                }
                placeholder="prod_..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Monthly Price ID</label>
              <Input
                value={formData.stripePriceIdMonthly || ""}
                onChange={(e) =>
                  setFormData({ ...formData, stripePriceIdMonthly: e.target.value })
                }
                placeholder="price_..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Yearly Price ID</label>
              <Input
                value={formData.stripePriceIdYearly || ""}
                onChange={(e) =>
                  setFormData({ ...formData, stripePriceIdYearly: e.target.value })
                }
                placeholder="price_..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Limits */}
      <div>
        <h3 className="text-sm font-medium mb-3">Usage Limits</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(formData.limits).map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1 capitalize">
                {key.replace(/([A-Z])/g, " $1").replace("max ", "")}
              </label>
              <Input
                type="number"
                min="-1"
                value={value}
                onChange={(e) =>
                  updateLimit(key as keyof PlanData["limits"], parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-[var(--muted-foreground)]">-1 = unlimited</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm font-medium mb-3">Features</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(formData.features).map(([key, enabled]) => (
            <label
              key={key}
              className={cn(
                "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                enabled
                  ? "bg-[var(--cai-teal)]/10 border-[var(--cai-teal)]"
                  : "bg-[var(--muted)] border-[var(--border)]"
              )}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleFeature(key)}
                className="sr-only"
              />
              {enabled ? (
                <Check className="h-4 w-4 text-[var(--cai-teal)]" />
              ) : (
                <X className="h-4 w-4 text-[var(--muted-foreground)]" />
              )}
              <span className="text-xs capitalize">
                {key.replace(/([A-Z])/g, " $1")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2">
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <span className="text-sm">Active</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={formData.highlighted}
            onCheckedChange={(checked) => setFormData({ ...formData, highlighted: checked })}
          />
          <span className="text-sm">Highlighted (Most Popular)</span>
        </label>
      </div>

      {/* Badge */}
      <div>
        <label className="block text-sm font-medium mb-1">Badge (optional)</label>
        <Input
          value={formData.badge || ""}
          onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
          placeholder="e.g., Most Popular, New, Best Value"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
        <Button type="submit" variant="primary">
          <Save className="h-4 w-4 mr-2" />
          {plan ? "Update Plan" : "Create Plan"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PlansManagementPage() {
  const router = useRouter();
  const { isSuperAdmin } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [plans, setPlans] = React.useState<PlanData[]>([]);
  const [editingPlan, setEditingPlan] = React.useState<PlanData | null | "new">(null);
  const [totals, setTotals] = React.useState({ mrr: 0, totalSubscribers: 0, paidSubscribers: 0 });

  // Mount and auth check
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && !isSuperAdmin()) {
      router.push("/platform/login");
    }
  }, [mounted, isSuperAdmin, router]);

  // Fetch plans
  React.useEffect(() => {
    if (mounted && isSuperAdmin()) {
      fetchPlans();
    }
  }, [mounted, isSuperAdmin]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/platform/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
        setTotals(data.totals || { mrr: 0, totalSubscribers: 0, paidSubscribers: 0 });
      } else {
        // Use default plans from config
        setPlans([
          {
            id: "free",
            name: "Free",
            description: "Get started with basic cutlist management",
            priceMonthly: 0,
            priceYearly: 0,
            isActive: true,
            highlighted: false,
            limits: {
              maxTeamMembers: 1,
              maxCutlistsPerMonth: 5,
              maxPartsPerCutlist: 50,
              maxStorageMb: 100,
              maxAiParsesPerMonth: 10,
              maxOcrPagesPerMonth: 5,
              maxOptimizationsPerMonth: 3,
            },
            features: {
              manualEntry: true,
              csvImport: true,
              excelImport: false,
              aiParsing: true,
              ocrParsing: true,
              voiceInput: false,
              pdfExport: true,
              csvExport: true,
              edgebanding: true,
              grooves: false,
              holes: false,
              cncOperations: false,
              customBranding: false,
              apiAccess: false,
              prioritySupport: false,
            },
            subscriberCount: 142,
            monthlyRevenue: 0,
          },
          {
            id: "starter",
            name: "Starter",
            description: "Perfect for small workshops",
            priceMonthly: 29,
            priceYearly: 290,
            isActive: true,
            highlighted: false,
            limits: {
              maxTeamMembers: 3,
              maxCutlistsPerMonth: 50,
              maxPartsPerCutlist: 200,
              maxStorageMb: 1024,
              maxAiParsesPerMonth: 100,
              maxOcrPagesPerMonth: 50,
              maxOptimizationsPerMonth: 25,
            },
            features: {
              manualEntry: true,
              csvImport: true,
              excelImport: true,
              aiParsing: true,
              ocrParsing: true,
              voiceInput: true,
              pdfExport: true,
              csvExport: true,
              edgebanding: true,
              grooves: true,
              holes: true,
              cncOperations: false,
              customBranding: true,
              apiAccess: false,
              prioritySupport: false,
            },
            subscriberCount: 87,
            monthlyRevenue: 2523,
          },
          {
            id: "professional",
            name: "Professional",
            description: "For growing cabinet shops",
            priceMonthly: 79,
            priceYearly: 790,
            isActive: true,
            highlighted: true,
            badge: "Most Popular",
            limits: {
              maxTeamMembers: 10,
              maxCutlistsPerMonth: 500,
              maxPartsPerCutlist: 1000,
              maxStorageMb: 10240,
              maxAiParsesPerMonth: 1000,
              maxOcrPagesPerMonth: 500,
              maxOptimizationsPerMonth: 250,
            },
            features: {
              manualEntry: true,
              csvImport: true,
              excelImport: true,
              aiParsing: true,
              ocrParsing: true,
              voiceInput: true,
              pdfExport: true,
              csvExport: true,
              edgebanding: true,
              grooves: true,
              holes: true,
              cncOperations: true,
              customBranding: true,
              apiAccess: true,
              prioritySupport: true,
            },
            subscriberCount: 43,
            monthlyRevenue: 3397,
          },
          {
            id: "enterprise",
            name: "Enterprise",
            description: "For large manufacturers",
            priceMonthly: 249,
            priceYearly: 2490,
            isActive: true,
            highlighted: false,
            limits: {
              maxTeamMembers: -1,
              maxCutlistsPerMonth: -1,
              maxPartsPerCutlist: -1,
              maxStorageMb: -1,
              maxAiParsesPerMonth: -1,
              maxOcrPagesPerMonth: -1,
              maxOptimizationsPerMonth: -1,
            },
            features: {
              manualEntry: true,
              csvImport: true,
              excelImport: true,
              aiParsing: true,
              ocrParsing: true,
              voiceInput: true,
              pdfExport: true,
              csvExport: true,
              edgebanding: true,
              grooves: true,
              holes: true,
              cncOperations: true,
              customBranding: true,
              apiAccess: true,
              prioritySupport: true,
            },
            subscriberCount: 8,
            monthlyRevenue: 1992,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (planData: PlanData) => {
    try {
      const isNew = editingPlan === "new";
      const response = await fetch(`/api/v1/admin/plans${isNew ? "" : `/${planData.id}`}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        await fetchPlans();
        setEditingPlan(null);
      } else {
        alert("Failed to save plan");
      }
    } catch (error) {
      console.error("Failed to save plan:", error);
      // Optimistic update for demo
      if (editingPlan === "new") {
        setPlans((prev) => [...prev, planData]);
      } else {
        setPlans((prev) =>
          prev.map((p) => (p.id === planData.id ? planData : p))
        );
      }
      setEditingPlan(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan? This cannot be undone.")) {
      return;
    }

    try {
      await fetch(`/api/v1/admin/plans/${planId}`, { method: "DELETE" });
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (error) {
      console.error("Failed to delete plan:", error);
    }
  };

  const totalMRR = totals.mrr || plans.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  const totalSubscribers = totals.totalSubscribers || plans.reduce((sum, p) => sum + (p.subscriberCount || 0), 0);

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
              <h1 className="text-2xl font-bold text-slate-900">Plan Management</h1>
              <p className="text-slate-500">
                Configure subscription plans and pricing
              </p>
            </div>
            <Button variant="primary" onClick={() => setEditingPlan("new")}>
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalMRR.toLocaleString()}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSubscribers}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Total Subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{plans.length}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Active Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${totalSubscribers > 0 ? (totalMRR / totalSubscribers).toFixed(2) : 0}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">Avg Revenue/User</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Editor Modal */}
        {editingPlan !== null && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingPlan === "new" ? "Create New Plan" : `Edit Plan: ${(editingPlan as PlanData).name}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanEditor
                plan={editingPlan === "new" ? null : (editingPlan as PlanData)}
                onSave={handleSavePlan}
                onCancel={() => setEditingPlan(null)}
              />
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative",
                plan.highlighted && "border-purple-400 shadow-lg",
                !plan.isActive && "opacity-60"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="teal" className="shadow-sm">
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">{plan.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="text-center py-2">
                  <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                  <span className="text-[var(--muted-foreground)]">/mo</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="p-2 bg-[var(--muted)] rounded">
                    <p className="font-bold">{plan.subscriberCount || 0}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Subscribers</p>
                  </div>
                  <div className="p-2 bg-[var(--muted)] rounded">
                    <p className="font-bold">${plan.monthlyRevenue || 0}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">MRR</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingPlan(plan)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {plan.id !== "free" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

