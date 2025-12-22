/**
 * CAI Intake - Super Admin Plans API
 * 
 * GET /api/v1/admin/plans - List all subscription plans
 * POST /api/v1/admin/plans - Create a new plan
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { z } from "zod";

// =============================================================================
// SCHEMAS
// =============================================================================

const PlanLimitsSchema = z.object({
  maxTeamMembers: z.number().default(1),
  maxCutlistsPerMonth: z.number().default(5),
  maxPartsPerCutlist: z.number().default(50),
  maxStorageMb: z.number().default(100),
  maxAiParsesPerMonth: z.number().default(10),
  maxOcrPagesPerMonth: z.number().default(5),
  maxOptimizationsPerMonth: z.number().default(3),
});

const PlanFeaturesSchema = z.record(z.string(), z.boolean());

const CreatePlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  isActive: z.boolean().default(true),
  highlighted: z.boolean().default(false),
  badge: z.string().optional().nullable(),
  limits: PlanLimitsSchema,
  features: PlanFeaturesSchema,
  stripeProductId: z.string().optional().nullable(),
  stripePriceIdMonthly: z.string().optional().nullable(),
  stripePriceIdYearly: z.string().optional().nullable(),
});

// =============================================================================
// HELPER: Check Super Admin
// =============================================================================

async function checkSuperAdmin(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return dbUser?.isSuperAdmin === true;
}

// =============================================================================
// GET - List all plans
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = await checkSuperAdmin(user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // In a real implementation, this would fetch from a plans table
    // For now, we'll use the plan field from organizations to get subscriber counts
    const planCounts = await prisma.organization.groupBy({
      by: ["plan"],
      _count: true,
    });

    const planCountMap = new Map<string, number>();
    planCounts.forEach((p) => {
      planCountMap.set(p.plan || "free", p._count);
    });

    // Default plans (would be stored in DB in production)
    const plans = [
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
        subscriberCount: planCountMap.get("free") || 0,
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
        subscriberCount: planCountMap.get("starter") || 0,
        monthlyRevenue: (planCountMap.get("starter") || 0) * 29,
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
        subscriberCount: planCountMap.get("professional") || 0,
        monthlyRevenue: (planCountMap.get("professional") || 0) * 79,
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
        subscriberCount: planCountMap.get("enterprise") || 0,
        monthlyRevenue: (planCountMap.get("enterprise") || 0) * 249,
      },
    ];

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Plans GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create a new plan
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = await checkSuperAdmin(user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = CreatePlanSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid plan data", details: validation.error.format() },
        { status: 400 }
      );
    }

    // In production, this would insert into a plans table
    // For now, we just return success
    const plan = validation.data;

    return NextResponse.json({
      success: true,
      message: "Plan created successfully",
      plan: {
        ...plan,
        subscriberCount: 0,
        monthlyRevenue: 0,
      },
    });
  } catch (error) {
    console.error("Plans POST error:", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}

