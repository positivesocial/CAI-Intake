/**
 * CAI Intake - Subscription API
 * 
 * GET /api/v1/subscription - Get current subscription, usage, and limits
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  getSubscription, 
  getCurrentUsage, 
  getTrialDaysRemaining,
  getEffectiveLimits,
} from "@/lib/subscriptions/service";
import { getPlan } from "@/lib/subscriptions/plans";

export async function GET(request: NextRequest) {
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
      // Return default free plan for users without organization
      const freePlan = getPlan("free");
      return NextResponse.json({
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
        limits: freePlan.limits,
        plan: freePlan,
      });
    }
    
    const organizationId = userData.organization_id;
    
    // Fetch subscription, usage, and limits in parallel
    const [subscription, usage, limits] = await Promise.all([
      getSubscription(organizationId),
      getCurrentUsage(organizationId),
      getEffectiveLimits(organizationId),
    ]);
    
    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }
    
    const plan = getPlan(subscription.planId);
    const trialDaysRemaining = getTrialDaysRemaining(subscription);
    
    return NextResponse.json({
      subscription: {
        planId: subscription.planId,
        planName: plan.name,
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        trialEnd: subscription.trialEnd?.toISOString() || null,
        trialDaysRemaining,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      usage: {
        cutlistsCreated: usage.cutlistsCreated,
        partsProcessed: usage.partsProcessed,
        aiParsesUsed: usage.aiParsesUsed,
        ocrPagesUsed: usage.ocrPagesUsed,
        optimizationsRun: usage.optimizationsRun,
        storageUsedMb: usage.storageUsedMb,
      },
      limits,
      plan,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
