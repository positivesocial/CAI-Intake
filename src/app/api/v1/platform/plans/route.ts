/**
 * CAI Intake - Platform Plans API (Super Admin Only)
 * 
 * GET /api/v1/platform/plans - Get all plans with subscriber counts
 * POST /api/v1/platform/plans - Create a new plan (future)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { PLANS } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get subscriber counts per plan
    type PlanCountRow = {
      plan: string | null;
      count: bigint;
    };

    const planCounts = await prisma.$queryRaw<PlanCountRow[]>`
      SELECT LOWER(COALESCE(plan, 'free')) as plan, COUNT(*) as count
      FROM organizations
      GROUP BY LOWER(COALESCE(plan, 'free'))
    `;

    const countMap: Record<string, number> = {};
    planCounts.forEach((row) => {
      countMap[row.plan || "free"] = Number(row.count);
    });

    // Build plan data from config with real subscriber counts
    const plans = Object.entries(PLANS).map(([planId, planConfig]) => {
      const subscriberCount = countMap[planId] || 0;
      const monthlyRevenue = subscriberCount * planConfig.pricing.monthly;

      return {
        id: planId,
        name: planConfig.name,
        description: planConfig.description || "",
        priceMonthly: planConfig.pricing.monthly,
        priceYearly: planConfig.pricing.yearly,
        isActive: true,
        highlighted: planId === "professional",
        badge: planId === "professional" ? "Most Popular" : undefined,
        limits: planConfig.limits,
        features: planConfig.features,
        stripeProductId: undefined, // Would come from Stripe integration
        stripePriceIdMonthly: undefined,
        stripePriceIdYearly: undefined,
        subscriberCount,
        monthlyRevenue,
      };
    });

    // Calculate totals
    const totalMRR = plans.reduce((sum, p) => sum + p.monthlyRevenue, 0);
    const totalSubscribers = plans.reduce((sum, p) => sum + p.subscriberCount, 0);
    const paidSubscribers = plans
      .filter((p) => p.id !== "free")
      .reduce((sum, p) => sum + p.subscriberCount, 0);

    return NextResponse.json({
      plans,
      totals: {
        mrr: totalMRR,
        totalSubscribers,
        paidSubscribers,
        averageRevenuePerUser: paidSubscribers > 0 ? Math.round((totalMRR / paidSubscribers) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    console.error("Platform plans API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // In production, this would create a plan in Stripe and store config
    // For now, return a placeholder response
    return NextResponse.json({
      success: true,
      message: "Plan creation would be handled via Stripe dashboard or config files",
    });
  } catch (error) {
    console.error("Platform plans POST error:", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}

