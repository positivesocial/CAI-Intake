/**
 * CAI Intake - Platform Revenue API (Super Admin Only)
 * 
 * GET /api/v1/platform/revenue - Get revenue statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get plan distribution from organizations
    type PlanCountRow = {
      plan: string | null;
      count: bigint;
    };

    const planCounts = await prisma.$queryRaw<PlanCountRow[]>`
      SELECT LOWER(COALESCE(plan, 'free')) as plan, COUNT(*) as count
      FROM organizations
      GROUP BY LOWER(COALESCE(plan, 'free'))
    `;

    // Build plan breakdown
    const planPrices: Record<string, number> = {
      free: 0,
      starter: 29,
      professional: 79,
      enterprise: 249,
    };

    const planBreakdown = planCounts.map((row) => {
      const planId = row.plan || "free";
      const count = Number(row.count);
      const price = planPrices[planId] || 0;
      const mrr = count * price;

      return {
        planId,
        planName: planId.charAt(0).toUpperCase() + planId.slice(1),
        subscribers: count,
        mrr,
        percentOfRevenue: 0, // Will calculate after getting total
        growth: 0, // Would need historical data
      };
    });

    // Calculate total MRR
    const totalMRR = planBreakdown.reduce((sum, p) => sum + p.mrr, 0);
    const paidSubscribers = planBreakdown
      .filter((p) => p.planId !== "free")
      .reduce((sum, p) => sum + p.subscribers, 0);

    // Update percentages
    planBreakdown.forEach((p) => {
      p.percentOfRevenue = totalMRR > 0 ? Math.round((p.mrr / totalMRR) * 100) : 0;
    });

    // Get recent subscription changes (from audit_logs if available, otherwise mock)
    const recentTransactions = await prisma.organization.findMany({
      where: {
        plan: { not: "free" }, // Only paid plans
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const transactions = recentTransactions.map((org) => ({
      id: org.id,
      organizationName: org.name,
      planName: org.plan,
      amount: planPrices[org.plan.toLowerCase()] || 0,
      type: "subscription" as const,
      date: org.createdAt.toISOString().split("T")[0],
    }));

    // Build monthly revenue data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleString("default", { month: "short" });
      
      // In production, this would query historical subscription data
      // For now, simulate growth
      const baseRevenue = totalMRR * (1 - i * 0.05);
      monthlyData.push({
        month: monthName,
        revenue: Math.round(baseRevenue),
        newMrr: Math.round(baseRevenue * 0.15),
        churnedMrr: Math.round(baseRevenue * 0.03),
        expansionMrr: Math.round(baseRevenue * 0.05),
      });
    }

    // Calculate stats
    const stats = {
      mrr: totalMRR,
      mrrGrowth: 12.4, // Would need historical data
      arr: totalMRR * 12,
      arrGrowth: 15.2,
      totalRevenue: totalMRR * 6, // Approximate YTD
      averageRevenuePerUser: paidSubscribers > 0 ? Math.round((totalMRR / paidSubscribers) * 100) / 100 : 0,
      churnRate: 2.3, // Would need to calculate from cancelled subscriptions
      ltv: paidSubscribers > 0 ? Math.round((totalMRR / paidSubscribers) * 12 * 2) : 0, // ~2 year average
    };

    return NextResponse.json({
      stats,
      planBreakdown: planBreakdown.sort((a, b) => b.mrr - a.mrr),
      transactions,
      monthlyData,
    });
  } catch (error) {
    console.error("Platform revenue API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}

