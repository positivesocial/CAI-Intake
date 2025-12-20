/**
 * CAI Intake - Optimize Jobs API
 * 
 * POST /api/v1/optimize-jobs - Create a new optimization job
 * GET /api/v1/optimize-jobs - List optimization jobs with pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateOptimizeJobSchema = z.object({
  cutlistId: z.string().uuid(),
  options: z.object({
    // Optimization parameters
    bladeWidth: z.number().positive().default(3.2),
    minRemnant: z.number().positive().default(200),
    grainPriority: z.enum(["strict", "preferred", "ignore"]).default("preferred"),
    rotationAllowed: z.boolean().default(true),
    // Output preferences
    labelFormat: z.enum(["standard", "qr", "barcode"]).default("standard"),
    includeCuttingDiagram: z.boolean().default(true),
    includePartsList: z.boolean().default(true),
    // Material preferences
    preferredSheetSizes: z.array(z.object({
      L: z.number().positive(),
      W: z.number().positive(),
    })).optional(),
  }).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

const ListOptimizeJobsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  cutlistId: z.string().uuid().optional(),
});

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/optimize-jobs
 * List optimization jobs with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const params = ListOptimizeJobsSchema.parse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      status: searchParams.get("status"),
      cutlistId: searchParams.get("cutlistId"),
    });

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    // Build where clause - filter through cutlist relation
    const where: Record<string, unknown> = {};
    
    // Filter by organization or user through the cutlist
    if (dbUser?.organizationId) {
      where.cutlist = { organizationId: dbUser.organizationId };
    } else {
      where.cutlist = { userId: user.id };
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.cutlistId) {
      where.cutlistId = params.cutlistId;
    }

    // Count total
    const total = await prisma.optimizeJob.count({ where });

    // Fetch page
    const jobs = await prisma.optimizeJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        cutlist: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      jobs,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    console.error("List optimize jobs error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to list optimization jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/optimize-jobs
 * Create a new optimization job
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const data = CreateOptimizeJobSchema.parse(body);

    // Verify cutlist exists and user has access
    const cutlist = await prisma.cutlist.findUnique({
      where: { id: data.cutlistId },
      select: { 
        id: true, 
        organizationId: true,
        userId: true,
        _count: { select: { parts: true } },
      },
    });

    if (!cutlist) {
      return NextResponse.json(
        { error: "Cutlist not found" },
        { status: 404 }
      );
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      cutlist.userId === user.id ||
      (dbUser?.organizationId && cutlist.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to cutlist" },
        { status: 403 }
      );
    }

    // Check if cutlist has parts
    if (cutlist._count.parts === 0) {
      return NextResponse.json(
        { error: "Cutlist has no parts to optimize" },
        { status: 400 }
      );
    }

    // Create optimization job
    const job = await prisma.optimizeJob.create({
      data: {
        cutlistId: data.cutlistId,
        status: "queued",
        options: data.options ? JSON.parse(JSON.stringify(data.options)) : undefined,
      },
    });

    // TODO: Queue job for processing by CAI 2D optimizer
    // For now, we'll return the created job

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        cutlistId: job.cutlistId,
        createdAt: job.createdAt,
      },
      message: "Optimization job created and queued",
    }, { status: 201 });
  } catch (error) {
    console.error("Create optimize job error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create optimization job" },
      { status: 500 }
    );
  }
}

