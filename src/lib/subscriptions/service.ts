/**
 * CAI Intake - Subscription Service
 * 
 * Business logic for subscription management, usage tracking, and feature gating.
 */

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { 
  getPlan, 
  isFeatureAvailable, 
  getLimit, 
  isUnlimited,
  type PlanId, 
  type PlanLimits,
  type BillingInterval,
} from "./plans";

// =============================================================================
// TYPES
// =============================================================================

export interface Subscription {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export type SubscriptionStatus = 
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface UsageRecord {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  cutlistsCreated: number;
  partsProcessed: number;
  aiParsesUsed: number;
  ocrPagesUsed: number;
  optimizationsRun: number;
  storageUsedMb: number;
}

export interface FeatureCheck {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  remaining?: number;
}

// =============================================================================
// SUBSCRIPTION QUERIES
// =============================================================================

/**
 * Get an organization's current subscription
 */
export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single();
  
  if (error || !data) {
    // Return a default free subscription if none exists
    return {
      id: "default",
      organizationId,
      planId: "free",
      status: "active",
      billingInterval: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trialStart: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }
  
  return {
    id: data.id,
    organizationId: data.organization_id,
    planId: data.plan_id as PlanId,
    status: data.status as SubscriptionStatus,
    billingInterval: (data.billing_interval || "monthly") as BillingInterval,
    currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : null,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    trialStart: data.trial_start ? new Date(data.trial_start) : null,
    trialEnd: data.trial_end ? new Date(data.trial_end) : null,
    cancelAtPeriodEnd: data.cancel_at_period_end || false,
    canceledAt: data.canceled_at ? new Date(data.canceled_at) : null,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

/**
 * Get current usage for an organization
 */
export async function getCurrentUsage(organizationId: string): Promise<UsageRecord> {
  const supabase = await createClient();
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  
  const { data } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("period_start", periodStart.toISOString())
    .single();
  
  if (!data) {
    // Return empty usage
    return {
      organizationId,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000),
      cutlistsCreated: 0,
      partsProcessed: 0,
      aiParsesUsed: 0,
      ocrPagesUsed: 0,
      optimizationsRun: 0,
      storageUsedMb: 0,
    };
  }
  
  return {
    organizationId: data.organization_id,
    periodStart: new Date(data.period_start),
    periodEnd: new Date(data.period_end),
    cutlistsCreated: data.cutlists_created || 0,
    partsProcessed: data.parts_processed || 0,
    aiParsesUsed: data.ai_parses_used || 0,
    ocrPagesUsed: data.ocr_pages_used || 0,
    optimizationsRun: data.optimizations_run || 0,
    storageUsedMb: parseFloat(data.storage_used_mb) || 0,
  };
}

/**
 * Get feature overrides for an organization
 */
export async function getFeatureOverrides(organizationId: string): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("feature_overrides")
    .select("feature_key, override_value, expires_at")
    .eq("organization_id", organizationId);
  
  if (!data) return {};
  
  const overrides: Record<string, unknown> = {};
  const now = new Date();
  
  for (const override of data) {
    // Skip expired overrides
    if (override.expires_at && new Date(override.expires_at) < now) {
      continue;
    }
    overrides[override.feature_key] = override.override_value;
  }
  
  return overrides;
}

// =============================================================================
// FEATURE GATING
// =============================================================================

/**
 * Check if a feature is available for an organization
 */
export async function checkFeature(
  organizationId: string,
  featureKey: keyof PlanLimits["features"]
): Promise<FeatureCheck> {
  const subscription = await getSubscription(organizationId);
  if (!subscription) {
    return { allowed: false, reason: "No active subscription" };
  }
  
  // Check subscription status
  if (!["active", "trialing"].includes(subscription.status)) {
    return { allowed: false, reason: `Subscription is ${subscription.status}` };
  }
  
  // Check feature overrides first
  const overrides = await getFeatureOverrides(organizationId);
  if (featureKey in overrides) {
    const overrideValue = overrides[featureKey];
    if (typeof overrideValue === "boolean") {
      return { 
        allowed: overrideValue, 
        reason: overrideValue ? undefined : "Feature disabled by override" 
      };
    }
  }
  
  // Check plan feature
  const isAvailable = isFeatureAvailable(subscription.planId, featureKey);
  
  return {
    allowed: isAvailable,
    reason: isAvailable ? undefined : `Feature not available on ${subscription.planId} plan`,
  };
}

/**
 * Check if a usage limit allows an operation
 */
export async function checkLimit(
  organizationId: string,
  limitKey: keyof Omit<PlanLimits, "features">,
  requestedAmount: number = 1
): Promise<FeatureCheck> {
  const subscription = await getSubscription(organizationId);
  if (!subscription) {
    return { allowed: false, reason: "No active subscription" };
  }
  
  // Check subscription status
  if (!["active", "trialing"].includes(subscription.status)) {
    return { allowed: false, reason: `Subscription is ${subscription.status}` };
  }
  
  // Get the limit from the plan
  const limit = getLimit(subscription.planId, limitKey);
  
  // Check for unlimited
  if (isUnlimited(limit)) {
    return { allowed: true, limit: -1 };
  }
  
  // Check feature overrides
  const overrides = await getFeatureOverrides(organizationId);
  const effectiveLimit = typeof overrides[limitKey] === "number" 
    ? overrides[limitKey] as number 
    : limit;
  
  // Get current usage
  const usage = await getCurrentUsage(organizationId);
  
  // Map limit key to usage key
  const usageKeyMap: Record<string, keyof UsageRecord> = {
    maxCutlistsPerMonth: "cutlistsCreated",
    maxAiParsesPerMonth: "aiParsesUsed",
    maxOcrPagesPerMonth: "ocrPagesUsed",
    maxOptimizationsPerMonth: "optimizationsRun",
    maxStorageMb: "storageUsedMb",
  };
  
  const usageKey = usageKeyMap[limitKey];
  const currentUsage = usageKey ? (usage[usageKey] as number) : 0;
  const remaining = effectiveLimit - currentUsage;
  
  if (currentUsage + requestedAmount > effectiveLimit) {
    return {
      allowed: false,
      reason: `${limitKey} limit reached (${currentUsage}/${effectiveLimit})`,
      limit: effectiveLimit,
      current: currentUsage,
      remaining: Math.max(0, remaining),
    };
  }
  
  return {
    allowed: true,
    limit: effectiveLimit,
    current: currentUsage,
    remaining: remaining - requestedAmount,
  };
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

type UsageMetric = 
  | "cutlists_created" 
  | "parts_processed" 
  | "ai_parses_used" 
  | "ocr_pages_used" 
  | "optimizations_run";

/**
 * Increment a usage counter for an organization
 */
export async function incrementUsage(
  organizationId: string,
  metric: UsageMetric,
  amount: number = 1
): Promise<void> {
  const supabase = await createClient();
  
  // Call the database function
  await supabase.rpc("increment_usage", {
    p_org_id: organizationId,
    p_metric: metric,
    p_amount: amount,
  });
}

/**
 * Update storage usage for an organization
 */
export async function updateStorageUsage(
  organizationId: string,
  storageUsedMb: number
): Promise<void> {
  const supabase = await createClient();
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  
  await supabase
    .from("subscription_usage")
    .upsert({
      organization_id: organizationId,
      period_start: periodStart.toISOString(),
      period_end: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      storage_used_mb: storageUsedMb,
    }, {
      onConflict: "organization_id,period_start",
    });
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Update subscription plan (after Stripe webhook)
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<{
    planId: PlanId;
    status: SubscriptionStatus;
    billingInterval: BillingInterval;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  }>
): Promise<void> {
  const supabase = await createClient();
  
  const updateData: Record<string, unknown> = {};
  
  if (updates.planId) updateData.plan_id = updates.planId;
  if (updates.status) updateData.status = updates.status;
  if (updates.billingInterval) updateData.billing_interval = updates.billingInterval;
  if (updates.currentPeriodStart) updateData.current_period_start = updates.currentPeriodStart.toISOString();
  if (updates.currentPeriodEnd) updateData.current_period_end = updates.currentPeriodEnd.toISOString();
  if (updates.cancelAtPeriodEnd !== undefined) updateData.cancel_at_period_end = updates.cancelAtPeriodEnd;
  if (updates.canceledAt !== undefined) {
    updateData.canceled_at = updates.canceledAt?.toISOString() || null;
  }
  
  await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("id", subscriptionId);
}

/**
 * Create or update Stripe customer mapping
 */
export async function setStripeCustomer(
  organizationId: string,
  stripeCustomerId: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("subscriptions")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("organization_id", organizationId);
}

/**
 * Set Stripe subscription ID
 */
export async function setStripeSubscription(
  organizationId: string,
  stripeSubscriptionId: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("subscriptions")
    .update({ stripe_subscription_id: stripeSubscriptionId })
    .eq("organization_id", organizationId);
}

// =============================================================================
// BILLING HISTORY
// =============================================================================

/**
 * Get billing history for an organization
 */
export async function getBillingHistory(
  organizationId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  invoiceUrl: string | null;
}>> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (!data) return [];
  
  return data.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
    amount: (invoice.total_cents || 0) / 100,
    currency: invoice.currency || "USD",
    status: invoice.status,
    paidAt: invoice.paid_at ? new Date(invoice.paid_at) : null,
    invoiceUrl: invoice.hosted_invoice_url,
  }));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate trial days remaining
 */
export function getTrialDaysRemaining(subscription: Subscription): number {
  if (!subscription.trialEnd || subscription.status !== "trialing") {
    return 0;
  }
  
  const now = new Date();
  const trialEnd = new Date(subscription.trialEnd);
  const diffMs = trialEnd.getTime() - now.getTime();
  
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check if subscription is active (including trial)
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  return ["active", "trialing"].includes(subscription.status);
}

/**
 * Get the effective plan limits for an organization (including overrides)
 */
export async function getEffectiveLimits(organizationId: string): Promise<PlanLimits> {
  const subscription = await getSubscription(organizationId);
  const plan = getPlan(subscription?.planId || "free");
  const overrides = await getFeatureOverrides(organizationId);
  
  // Deep merge plan limits with overrides
  const limits = { ...plan.limits };
  
  for (const [key, value] of Object.entries(overrides)) {
    if (key in limits) {
      (limits as Record<string, unknown>)[key] = value;
    } else if (key in limits.features) {
      limits.features[key as keyof PlanLimits["features"]] = value as boolean;
    }
  }
  
  return limits;
}
