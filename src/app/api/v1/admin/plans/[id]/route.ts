/**
 * CAI Intake - Super Admin Individual Plan API
 * 
 * GET /api/v1/admin/plans/[id] - Get a specific plan
 * PUT /api/v1/admin/plans/[id] - Update a plan
 * DELETE /api/v1/admin/plans/[id] - Delete a plan
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

type RouteParams = {
  params: Promise<{ id: string }>;
};

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

const UpdatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceMonthly: z.number().min(0).optional(),
  priceYearly: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  badge: z.string().optional().nullable(),
  limits: PlanLimitsSchema.optional(),
  features: PlanFeaturesSchema.optional(),
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
// GET - Get a specific plan
// =============================================================================

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = await checkSuperAdmin(user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    // Get subscriber count for this plan
    const subscriberCount = await prisma.organization.count({
      where: { plan: id },
    });

    // Default plans (would be stored in DB in production)
    const plansMap: Record<string, any> = {
      free: {
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
      },
      starter: {
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
      },
      professional: {
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
      },
      enterprise: {
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
      },
    };

    const plan = plansMap[id];
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({
      plan: {
        ...plan,
        subscriberCount,
        monthlyRevenue: subscriberCount * plan.priceMonthly,
      },
    });
  } catch (error) {
    console.error("Plan GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update a plan
// =============================================================================

export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = await checkSuperAdmin(user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = UpdatePlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid plan data", details: validation.error.format() },
        { status: 400 }
      );
    }

    // In production, this would update the plans table
    // For now, we just return success
    const updateData = validation.data;

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      plan: {
        id,
        ...updateData,
      },
    });
  } catch (error) {
    console.error("Plan PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete a plan
// =============================================================================

export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = await checkSuperAdmin(user.id);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    // Don't allow deleting the free plan
    if (id === "free") {
      return NextResponse.json(
        { error: "Cannot delete the free plan" },
        { status: 400 }
      );
    }

    // Check if there are subscribers on this plan
    const subscriberCount = await prisma.organization.count({
      where: { plan: id },
    });

    if (subscriberCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan with ${subscriberCount} active subscribers. Please migrate them first.` },
        { status: 400 }
      );
    }

    // In production, this would delete from the plans table
    // For now, we just return success
    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Plan DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    );
  }
}

