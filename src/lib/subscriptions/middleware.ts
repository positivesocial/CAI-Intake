/**
 * CAI Intake - Subscription Middleware
 * 
 * Server-side utilities for feature gating in API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  checkFeature, 
  checkLimit, 
  incrementUsage,
  getSubscription,
  type FeatureCheck,
} from "./service";
import { type PlanLimits } from "./plans";

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionContext {
  organizationId: string;
  planId: string;
  isActive: boolean;
  checkFeature: (key: keyof PlanLimits["features"]) => Promise<FeatureCheck>;
  checkLimit: (key: keyof Omit<PlanLimits, "features">, amount?: number) => Promise<FeatureCheck>;
  incrementUsage: (metric: string, amount?: number) => Promise<void>;
}

export type SubscriptionMiddlewareHandler = (
  request: NextRequest,
  context: SubscriptionContext
) => Promise<NextResponse>;

// =============================================================================
// MIDDLEWARE WRAPPER
// =============================================================================

/**
 * Wrap an API handler with subscription context
 */
export function withSubscription(handler: SubscriptionMiddlewareHandler) {
  return async (request: NextRequest) => {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      // Get user's organization
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      
      if (!userData?.organization_id) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }
      
      const organizationId = userData.organization_id;
      const subscription = await getSubscription(organizationId);
      
      const context: SubscriptionContext = {
        organizationId,
        planId: subscription?.planId || "free",
        isActive: subscription?.status === "active" || subscription?.status === "trialing",
        checkFeature: (key) => checkFeature(organizationId, key),
        checkLimit: (key, amount) => checkLimit(organizationId, key, amount),
        incrementUsage: (metric, amount) => incrementUsage(organizationId, metric as any, amount),
      };
      
      return handler(request, context);
    } catch (error) {
      console.error("Subscription middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

// =============================================================================
// FEATURE GATE DECORATORS
// =============================================================================

/**
 * Require a specific feature to be available
 */
export function requireFeature(featureKey: keyof PlanLimits["features"]) {
  return (handler: SubscriptionMiddlewareHandler): SubscriptionMiddlewareHandler => {
    return async (request, context) => {
      const check = await context.checkFeature(featureKey);
      
      if (!check.allowed) {
        return NextResponse.json(
          { 
            error: "Feature not available",
            reason: check.reason,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
      
      return handler(request, context);
    };
  };
}

/**
 * Require usage limit to not be exceeded
 */
export function requireLimit(
  limitKey: keyof Omit<PlanLimits, "features">,
  getAmount?: (request: NextRequest) => number
) {
  return (handler: SubscriptionMiddlewareHandler): SubscriptionMiddlewareHandler => {
    return async (request, context) => {
      const amount = getAmount ? getAmount(request) : 1;
      const check = await context.checkLimit(limitKey, amount);
      
      if (!check.allowed) {
        return NextResponse.json(
          { 
            error: "Usage limit exceeded",
            reason: check.reason,
            limit: check.limit,
            current: check.current,
            remaining: check.remaining,
            upgradeRequired: true,
          },
          { status: 429 }
        );
      }
      
      return handler(request, context);
    };
  };
}

// =============================================================================
// COMPOSABLE MIDDLEWARE
// =============================================================================

type MiddlewareDecorator = (
  handler: SubscriptionMiddlewareHandler
) => SubscriptionMiddlewareHandler;

/**
 * Compose multiple middleware decorators
 */
export function compose(...decorators: MiddlewareDecorator[]) {
  return (handler: SubscriptionMiddlewareHandler): SubscriptionMiddlewareHandler => {
    return decorators.reduceRight((acc, decorator) => decorator(acc), handler);
  };
}

// =============================================================================
// USAGE TRACKING HELPERS
// =============================================================================

/**
 * Track cutlist creation
 */
export async function trackCutlistCreation(organizationId: string): Promise<void> {
  await incrementUsage(organizationId, "cutlists_created", 1);
}

/**
 * Track parts processed
 */
export async function trackPartsProcessed(organizationId: string, count: number): Promise<void> {
  await incrementUsage(organizationId, "parts_processed", count);
}

/**
 * Track AI parse usage
 */
export async function trackAiParse(organizationId: string): Promise<void> {
  await incrementUsage(organizationId, "ai_parses_used", 1);
}

/**
 * Track OCR page usage
 */
export async function trackOcrPages(organizationId: string, pages: number): Promise<void> {
  await incrementUsage(organizationId, "ocr_pages_used", pages);
}

/**
 * Track optimization run
 */
export async function trackOptimization(organizationId: string): Promise<void> {
  await incrementUsage(organizationId, "optimizations_run", 1);
}

