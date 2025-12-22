"use client";

import * as React from "react";
import { Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeatureGate, useLimitGate } from "@/lib/subscriptions/hooks";
import { type PlanLimits, getPlan, type PlanId } from "@/lib/subscriptions/plans";
import { cn } from "@/lib/utils";
import Link from "next/link";

// =============================================================================
// FEATURE GATE COMPONENT
// =============================================================================

interface FeatureGateProps {
  feature: keyof PlanLimits["features"];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLock?: boolean;
  showBadge?: boolean;
  className?: string;
}

/**
 * Gate access to a feature based on subscription plan
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showLock = true,
  showBadge = false,
  className,
}: FeatureGateProps) {
  const { isAvailable, isLoading, planRequired, showUpgradeModal, setShowUpgradeModal } = 
    useFeatureGate(feature);
  
  if (isLoading) {
    return (
      <div className={cn("animate-pulse bg-[var(--muted)] rounded", className)}>
        {children}
      </div>
    );
  }
  
  if (isAvailable) {
    return <>{children}</>;
  }
  
  // Show fallback or locked state
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return (
    <>
      <div 
        className={cn(
          "relative group cursor-pointer",
          className
        )}
        onClick={() => setShowUpgradeModal(true)}
      >
        {/* Locked overlay */}
        <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-sm flex items-center justify-center z-10 rounded">
          {showLock && (
            <div className="flex flex-col items-center gap-2">
              <Lock className="h-6 w-6 text-[var(--muted-foreground)]" />
              {showBadge && planRequired && (
                <Badge variant="secondary" className="text-xs">
                  {getPlan(planRequired).name} Plan
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Disabled content */}
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      </div>
      
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        planRequired={planRequired || "starter"}
        featureName={feature}
      />
    </>
  );
}

// =============================================================================
// LIMIT GATE COMPONENT
// =============================================================================

interface LimitGateProps {
  limit: keyof Omit<PlanLimits, "features">;
  requestedAmount?: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showProgress?: boolean;
  className?: string;
}

/**
 * Gate access based on usage limits
 */
export function LimitGate({
  limit,
  requestedAmount = 1,
  children,
  fallback,
  showProgress = false,
  className,
}: LimitGateProps) {
  const {
    remaining,
    percentUsed,
    isUnlimited,
    isAtLimit,
    showUpgradeModal,
    setShowUpgradeModal,
    formattedLimit,
    isLoading,
  } = useLimitGate(limit);
  
  if (isLoading) {
    return <div className={cn("animate-pulse", className)}>{children}</div>;
  }
  
  // Check if can proceed
  const canProceed = isUnlimited || remaining >= requestedAmount;
  
  if (canProceed) {
    return (
      <>
        {showProgress && !isUnlimited && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span>{limit}</span>
              <span>{percentUsed}% used</span>
            </div>
            <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  percentUsed >= 90 ? "bg-red-500" :
                  percentUsed >= 75 ? "bg-yellow-500" :
                  "bg-[var(--cai-teal)]"
                )}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        )}
        {children}
      </>
    );
  }
  
  // At limit
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return (
    <>
      <div 
        className={cn("relative cursor-pointer", className)}
        onClick={() => setShowUpgradeModal(true)}
      >
        <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-sm flex items-center justify-center z-10 rounded p-4">
          <div className="text-center">
            <Zap className="h-6 w-6 text-[var(--cai-teal)] mx-auto mb-2" />
            <p className="text-sm font-medium">Limit Reached</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {formattedLimit} {limit} per month
            </p>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
      </div>
      
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        planRequired="starter"
        limitName={limit}
      />
    </>
  );
}

// =============================================================================
// UPGRADE MODAL
// =============================================================================

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planRequired: PlanId;
  featureName?: string;
  limitName?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  planRequired,
  featureName,
  limitName,
}: UpgradeModalProps) {
  const plan = getPlan(planRequired);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-[var(--cai-teal)] to-teal-600 rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center">Upgrade to {plan.name}</DialogTitle>
          <DialogDescription className="text-center">
            {featureName && (
              <>Unlock <strong>{formatFeatureName(featureName)}</strong> and more.</>
            )}
            {limitName && (
              <>Get higher limits for <strong>{formatLimitName(limitName)}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-[var(--muted)]/50 rounded-lg p-4 space-y-2">
            {plan.features.slice(0, 5).map((feature) => (
              <div key={feature.id} className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-[var(--cai-teal)]" />
                <span>{feature.name}</span>
              </div>
            ))}
            <p className="text-sm text-[var(--muted-foreground)] pt-2">
              and much more...
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <div className="text-3xl font-bold">
              ${plan.pricing.monthly}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">/month</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              or ${Math.round(plan.pricing.yearly / 12)}/mo billed yearly
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Link href="/settings/billing" className="w-full">
            <Button className="w-full" variant="primary">
              View Plans
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// UPGRADE BADGE
// =============================================================================

interface UpgradeBadgeProps {
  planRequired: PlanId;
  className?: string;
}

export function UpgradeBadge({ planRequired, className }: UpgradeBadgeProps) {
  const plan = getPlan(planRequired);
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "bg-gradient-to-r from-[var(--cai-teal)]/10 to-teal-600/10 text-[var(--cai-teal)] border-[var(--cai-teal)]/20",
        className
      )}
    >
      <Sparkles className="h-3 w-3 mr-1" />
      {plan.name}
    </Badge>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatFeatureName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatLimitName(key: string): string {
  return key
    .replace(/^max/, "")
    .replace(/PerMonth$/, "")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();
}

