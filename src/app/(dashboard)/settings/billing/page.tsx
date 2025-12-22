"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  CreditCard,
  Calendar,
  AlertCircle,
  Zap,
  Users,
  FileSpreadsheet,
  Cpu,
  Download,
  Shield,
  RefreshCw,
  ChevronRight,
  Star,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  PLANS,
  getAllPlans,
  getPlan,
  getPlanMonthlyPrice,
  getYearlySavingsPercent,
  type PlanId,
  type BillingInterval,
} from "@/lib/subscriptions/plans";

// =============================================================================
// TYPES
// =============================================================================

interface SubscriptionData {
  planId: PlanId;
  planName: string;
  status: string;
  billingInterval: BillingInterval;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  trialDaysRemaining: number;
  cancelAtPeriodEnd: boolean;
}

interface UsageData {
  cutlistsCreated: number;
  partsProcessed: number;
  aiParsesUsed: number;
  ocrPagesUsed: number;
  optimizationsRun: number;
  storageUsedMb: number;
}

interface LimitsData {
  maxCutlistsPerMonth: number;
  maxPartsPerCutlist: number;
  maxStorageMb: number;
  maxAiParsesPerMonth: number;
  maxOcrPagesPerMonth: number;
  maxOptimizationsPerMonth: number;
  maxTeamMembers: number;
}

interface BillingHistoryItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchBillingData(): Promise<{
  subscription: SubscriptionData;
  usage: UsageData;
  limits: LimitsData;
  billingHistory: BillingHistoryItem[];
}> {
  try {
    const [subResponse, historyResponse] = await Promise.all([
      fetch("/api/v1/subscription"),
      fetch("/api/v1/billing/history"),
    ]);

    const subData = subResponse.ok ? await subResponse.json() : null;
    const historyData = historyResponse.ok ? await historyResponse.json() : { history: [] };

    const freePlan = getPlan("free");

    return {
      subscription: subData?.subscription || {
        planId: "free",
        planName: "Free",
        status: "active",
        billingInterval: "monthly",
        currentPeriodEnd: null,
        trialEnd: null,
        trialDaysRemaining: 0,
        cancelAtPeriodEnd: false,
      },
      usage: subData?.usage || {
        cutlistsCreated: 0,
        partsProcessed: 0,
        aiParsesUsed: 0,
        ocrPagesUsed: 0,
        optimizationsRun: 0,
        storageUsedMb: 0,
      },
      limits: subData?.limits || freePlan.limits,
      billingHistory: historyData.history || [],
    };
  } catch {
    const freePlan = getPlan("free");
    return {
      subscription: {
        planId: "free",
        planName: "Free",
        status: "active",
        billingInterval: "monthly",
        currentPeriodEnd: null,
        trialEnd: null,
        trialDaysRemaining: 0,
        cancelAtPeriodEnd: false,
      },
      usage: {
        cutlistsCreated: 0,
        partsProcessed: 0,
        aiParsesUsed: 0,
        ocrPagesUsed: 0,
        optimizationsRun: 0,
        storageUsedMb: 0,
      },
      limits: freePlan.limits as LimitsData,
      billingHistory: [],
    };
  }
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function UsageMeter({
  label,
  current,
  limit,
  icon: Icon,
}: {
  label: string;
  current: number;
  limit: number;
  icon: React.ElementType;
}) {
  const isUnlimited = limit === -1;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isNearLimit = percent >= 80;
  const isOverLimit = percent >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn(
          "text-sm",
          isOverLimit ? "text-red-600 font-medium" : "text-[var(--muted-foreground)]"
        )}>
          {current.toLocaleString()} / {isUnlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <Progress
        value={percent}
        variant={isOverLimit ? "error" : isNearLimit ? "warning" : "default"}
      />
    </div>
  );
}

function PlanCard({
  planId,
  currentPlanId,
  billingInterval,
  onSelect,
  loading,
}: {
  planId: PlanId;
  currentPlanId: PlanId;
  billingInterval: BillingInterval;
  onSelect: (planId: PlanId) => void;
  loading?: boolean;
}) {
  const plan = getPlan(planId);
  const isCurrent = planId === currentPlanId;
  const monthlyPrice = getPlanMonthlyPrice(planId, billingInterval);
  const yearlySavings = getYearlySavingsPercent(planId);

  const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
  const isUpgrade = planOrder.indexOf(planId) > planOrder.indexOf(currentPlanId);
  const isDowngrade = planOrder.indexOf(planId) < planOrder.indexOf(currentPlanId);

  return (
    <Card
      className={cn(
        "relative transition-all",
        plan.highlighted && "border-[var(--cai-teal)] shadow-lg",
        isCurrent && "ring-2 ring-[var(--cai-teal)]"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="teal" className="shadow-sm">
            <Star className="h-3 w-3 mr-1" />
            {plan.badge}
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">{plan.description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">
              ${monthlyPrice}
            </span>
            <span className="text-[var(--muted-foreground)]">/mo</span>
          </div>
          {billingInterval === "yearly" && yearlySavings > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Save {yearlySavings}% with yearly billing
            </p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2">
          {plan.features.slice(0, 6).map((feature) => (
            <li key={feature.id} className="flex items-center gap-2 text-sm">
              {feature.included ? (
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
              )}
              <span className={cn(!feature.included && "text-[var(--muted-foreground)]")}>
                {feature.name}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="pt-2">
          {isCurrent ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : planId === "enterprise" ? (
            <a href="mailto:sales@caiintake.com">
              <Button variant="primary" className="w-full">
                Contact Sales
              </Button>
            </a>
          ) : (
            <Button
              variant={isUpgrade ? "primary" : "outline"}
              className="w-full"
              onClick={() => onSelect(planId)}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Select"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function BillingPage() {
  const [loading, setLoading] = React.useState(true);
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("monthly");
  const [subscription, setSubscription] = React.useState<SubscriptionData | null>(null);
  const [usage, setUsage] = React.useState<UsageData | null>(null);
  const [limits, setLimits] = React.useState<LimitsData | null>(null);
  const [billingHistory, setBillingHistory] = React.useState<BillingHistoryItem[]>([]);

  React.useEffect(() => {
    fetchBillingData().then((data) => {
      setSubscription(data.subscription);
      setUsage(data.usage);
      setLimits(data.limits);
      setBillingHistory(data.billingHistory);
      setBillingInterval(data.subscription.billingInterval);
      setLoading(false);
    });
  }, []);

  const [checkoutLoading, setCheckoutLoading] = React.useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);

  const handleSelectPlan = async (planId: PlanId) => {
    try {
      setCheckoutLoading(planId);
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingInterval,
          organizationId: localStorage.getItem("organizationId") || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManagePayment = async () => {
    try {
      setPortalLoading(true);
      const response = await fetch("/api/v1/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: localStorage.getItem("organizationId") || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to open billing portal");
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert(error instanceof Error ? error.message : "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-[var(--border)] bg-[var(--card)]">
          <div className="container mx-auto px-4 py-6">
            <div className="h-8 w-48 bg-[var(--muted)] rounded animate-pulse" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
          </div>
        </main>
      </div>
    );
  }

  const currentPlanId = subscription?.planId || "free";
  const currentPlan = getPlan(currentPlanId);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Billing & Subscription</h1>
              <p className="text-[var(--muted-foreground)]">
                Manage your subscription and payment methods
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {/* Current Plan Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              {subscription?.status === "trialing" && (
                <Badge variant="warning">
                  <Clock className="h-3 w-3 mr-1" />
                  Trial: {subscription.trialDaysRemaining} days left
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                  {currentPlanId !== "free" && (
                    <Badge variant="teal">
                      ${getPlanMonthlyPrice(currentPlanId, subscription?.billingInterval || "monthly")}/mo
                    </Badge>
                  )}
                </div>
                <p className="text-[var(--muted-foreground)]">{currentPlan.description}</p>
                {subscription?.currentPeriodEnd && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              {subscription?.cancelAtPeriodEnd && (
                <Badge variant="warning">Cancels at period end</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        {usage && limits && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Current Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <UsageMeter
                  label="Cutlists Created"
                  current={usage.cutlistsCreated}
                  limit={limits.maxCutlistsPerMonth}
                  icon={FileSpreadsheet}
                />
                <UsageMeter
                  label="AI Parses"
                  current={usage.aiParsesUsed}
                  limit={limits.maxAiParsesPerMonth}
                  icon={Zap}
                />
                <UsageMeter
                  label="OCR Pages"
                  current={usage.ocrPagesUsed}
                  limit={limits.maxOcrPagesPerMonth}
                  icon={Cpu}
                />
                <UsageMeter
                  label="Optimizations"
                  current={usage.optimizationsRun}
                  limit={limits.maxOptimizationsPerMonth}
                  icon={BarChart3}
                />
                <UsageMeter
                  label="Storage"
                  current={usage.storageUsedMb}
                  limit={limits.maxStorageMb}
                  icon={Download}
                />
                <UsageMeter
                  label="Team Members"
                  current={0} // Would need to fetch actual count
                  limit={limits.maxTeamMembers}
                  icon={Users}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Available Plans</h2>
            <div className="flex items-center gap-3 bg-[var(--muted)] p-1 rounded-lg">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingInterval === "monthly"
                    ? "bg-white shadow text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingInterval === "yearly"
                    ? "bg-white shadow text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]"
                )}
              >
                Yearly
                <Badge variant="success" className="ml-2">Save 17%</Badge>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {getAllPlans().map((plan) => (
              <PlanCard
                key={plan.id}
                planId={plan.id}
                currentPlanId={currentPlanId}
                billingInterval={billingInterval}
                onSelect={handleSelectPlan}
                loading={checkoutLoading === plan.id}
              />
            ))}
          </div>
        </div>

        {/* Billing History */}
        {billingHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.invoiceNumber}</TableCell>
                      <TableCell>
                        ${(item.amount).toFixed(2)} {item.currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === "paid" ? "success" : "warning"}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.paidAt
                          ? new Date(item.paidAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.invoiceUrl && (
                          <a
                            href={item.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              View
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 bg-[var(--muted)] rounded flex items-center justify-center text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="font-medium">•••• •••• •••• 4242</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Expires 12/25</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManagePayment}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Manage"
                )}
              </Button>
            </div>
            
            {/* Payment Options Info */}
            <div className="mt-4 p-4 bg-[var(--muted)]/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Accepted Payment Methods</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-6 bg-white rounded border border-[var(--border)] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-4 w-6" fill="#1A1F71">
                      <path d="M9.5 4h5v16h-5z" />
                      <path d="M2 12a7.5 7.5 0 0 1 7.5-7.5V12H2z" fill="#EB001B" />
                      <path d="M22 12a7.5 7.5 0 0 1-7.5 7.5V12H22z" fill="#F79E1B" />
                    </svg>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">Cards</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-6 bg-[#003087] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">PayPal</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">PayPal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-6 bg-black rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">ACH</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">Bank Transfer</span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-[var(--muted-foreground)] mt-4">
              <Shield className="h-4 w-4 inline mr-1" />
              Payments are securely processed by Stripe. PayPal available at checkout.
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {currentPlanId !== "free" && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Cancel Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--muted-foreground)] mb-4">
                {subscription?.cancelAtPeriodEnd
                  ? "Your subscription is scheduled to cancel at the end of the current billing period."
                  : "Cancel your subscription. You'll still have access until the end of your current billing period."}
              </p>
              <Button
                variant={subscription?.cancelAtPeriodEnd ? "outline" : "destructive"}
              >
                {subscription?.cancelAtPeriodEnd
                  ? "Reactivate Subscription"
                  : "Cancel Subscription"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

