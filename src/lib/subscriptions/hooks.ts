/**
 * CAI Intake - Subscription Hooks
 * 
 * React hooks for subscription state, feature gating, and usage tracking.
 */

"use client";

import * as React from "react";
import useSWR from "swr";
import { useAuthStore } from "@/lib/auth/store";
import { 
  type PlanId, 
  type PlanLimits, 
  type Plan,
  getPlan,
  isFeatureAvailable,
  getLimit,
  isUnlimited,
  formatLimit,
} from "./plans";

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionState {
  planId: PlanId;
  planName: string;
  status: string;
  billingInterval: "monthly" | "yearly";
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  trialDaysRemaining: number;
  cancelAtPeriodEnd: boolean;
}

export interface UsageState {
  cutlistsCreated: number;
  partsProcessed: number;
  aiParsesUsed: number;
  ocrPagesUsed: number;
  optimizationsRun: number;
  storageUsedMb: number;
}

export interface SubscriptionData {
  subscription: SubscriptionState;
  usage: UsageState;
  limits: PlanLimits;
  plan: Plan;
}

// =============================================================================
// FETCHER
// =============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch subscription");
  }
  return res.json();
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to get the current subscription state
 */
export function useSubscription() {
  const { user } = useAuthStore();
  const organizationId = user?.organizationId;
  
  const { data, error, isLoading, mutate } = useSWR<SubscriptionData>(
    organizationId ? "/api/v1/subscription" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );
  
  const subscription = data?.subscription;
  const usage = data?.usage;
  const limits = data?.limits;
  const plan = data?.plan;
  
  return {
    subscription,
    usage,
    limits,
    plan,
    isLoading,
    isError: !!error,
    error,
    refetch: mutate,
    
    // Convenience getters
    planId: subscription?.planId || "free",
    planName: subscription?.planName || "Free",
    isActive: subscription?.status === "active" || subscription?.status === "trialing",
    isTrial: subscription?.status === "trialing",
    isPaid: subscription?.planId !== "free",
    
    // Trial info
    trialDaysRemaining: subscription?.trialDaysRemaining || 0,
  };
}

/**
 * Hook to check if a feature is available
 */
export function useFeature(featureKey: keyof PlanLimits["features"]) {
  const { subscription, plan, isLoading } = useSubscription();
  
  const isAvailable = React.useMemo(() => {
    if (!plan) return false;
    return plan.limits.features[featureKey];
  }, [plan, featureKey]);
  
  return {
    isAvailable,
    isLoading,
    planRequired: isAvailable ? null : getMinimumPlanForFeature(featureKey),
  };
}

/**
 * Hook to check usage against limits
 */
export function useUsageLimit(limitKey: keyof Omit<PlanLimits, "features">) {
  const { usage, limits, isLoading } = useSubscription();
  
  const result = React.useMemo(() => {
    if (!limits || !usage) {
      return {
        current: 0,
        limit: 0,
        remaining: 0,
        percentUsed: 0,
        isUnlimited: false,
        isNearLimit: false,
        isAtLimit: false,
      };
    }
    
    const limit = limits[limitKey] as number;
    const unlimited = isUnlimited(limit);
    
    // Map limit key to usage key
    const usageKeyMap: Record<string, keyof UsageState> = {
      maxCutlistsPerMonth: "cutlistsCreated",
      maxAiParsesPerMonth: "aiParsesUsed",
      maxOcrPagesPerMonth: "ocrPagesUsed",
      maxOptimizationsPerMonth: "optimizationsRun",
      maxStorageMb: "storageUsedMb",
    };
    
    const usageKey = usageKeyMap[limitKey];
    const current = usageKey ? usage[usageKey] : 0;
    const remaining = unlimited ? Infinity : Math.max(0, limit - current);
    const percentUsed = unlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
    
    return {
      current,
      limit,
      remaining,
      percentUsed,
      isUnlimited: unlimited,
      isNearLimit: percentUsed >= 80,
      isAtLimit: percentUsed >= 100,
    };
  }, [usage, limits, limitKey]);
  
  return {
    ...result,
    isLoading,
    formattedLimit: formatLimit(result.limit),
  };
}

/**
 * Hook to gate access to a feature with upgrade prompt
 */
export function useFeatureGate(featureKey: keyof PlanLimits["features"]) {
  const { isAvailable, isLoading, planRequired } = useFeature(featureKey);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  
  const checkAccess = React.useCallback(() => {
    if (isAvailable) return true;
    setShowUpgradeModal(true);
    return false;
  }, [isAvailable]);
  
  return {
    isAvailable,
    isLoading,
    planRequired,
    showUpgradeModal,
    setShowUpgradeModal,
    checkAccess,
  };
}

/**
 * Hook to gate access based on usage limits
 */
export function useLimitGate(limitKey: keyof Omit<PlanLimits, "features">) {
  const limitState = useUsageLimit(limitKey);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  
  const checkAccess = React.useCallback((requestedAmount: number = 1) => {
    if (limitState.isUnlimited) return true;
    if (limitState.remaining >= requestedAmount) return true;
    setShowUpgradeModal(true);
    return false;
  }, [limitState.isUnlimited, limitState.remaining]);
  
  return {
    ...limitState,
    showUpgradeModal,
    setShowUpgradeModal,
    checkAccess,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the minimum plan required for a feature
 */
function getMinimumPlanForFeature(featureKey: keyof PlanLimits["features"]): PlanId {
  const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
  
  for (const planId of planOrder) {
    const plan = getPlan(planId);
    if (plan.limits.features[featureKey]) {
      return planId;
    }
  }
  
  return "enterprise";
}

// =============================================================================
// CONTEXT (for global subscription state)
// =============================================================================

interface SubscriptionContextValue {
  subscription: SubscriptionState | undefined;
  usage: UsageState | undefined;
  limits: PlanLimits | undefined;
  plan: Plan | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const SubscriptionContext = React.createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const subscriptionData = useSubscription();
  
  return React.createElement(
    SubscriptionContext.Provider,
    { value: subscriptionData },
    children
  );
}

export function useSubscriptionContext() {
  const context = React.useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptionContext must be used within a SubscriptionProvider");
  }
  return context;
}
