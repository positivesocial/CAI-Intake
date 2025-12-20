/**
 * CAI Intake - Parse Jobs API
 * 
 * POST /api/v1/parse-jobs - Create a new parse job
 * GET /api/v1/parse-jobs - List parse jobs with pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateParseJobSchema = z.object({
  source: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      content: z.string().min(1),
      format: z.enum(["free_text", "csv_inline", "json_inline"]).default("free_text"),
    }),
    z.object({
      type: z.literal("file"),
      fileId: z.string().uuid(),
      mimeType: z.string().optional(),
    }),
    z.object({
      type: z.literal("table"),
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
    z.object({
      type: z.literal("voice"),
      audioUrl: z.string().url().optional(),
      transcript: z.string().optional(),
    }),
  ]),
  options: z.object({
    defaultMaterialId: z.string().optional(),
    defaultThicknessMm: z.number().positive().optional(),
    extractMetadata: z.boolean().default(true),
    aiMode: z.boolean().default(false),
    aiProvider: z.enum(["openai", "anthropic"]).default("openai"),
    confidenceThreshold: z.number().min(0).max(1).default(0.8),
  }).optional(),
  mapping: z.object({
    columnMappings: z.record(z.string(), z.string()).optional(),
    materialMappings: z.record(z.string(), z.string()).optional(),
    unitConversions: z.object({
      lengthUnit: z.enum(["mm", "cm", "m", "in", "ft"]).default("mm"),
      autoConvert: z.boolean().default(true),
    }).optional(),
  }).optional(),
  cutlistId: z.string().uuid().optional(),
});

const ListParseJobsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  cutlistId: z.string().uuid().optional(),
});

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/parse-jobs
 * List parse jobs with pagination
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
    const params = ListParseJobsSchema.parse({
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

    const where: Record<string, unknown> = {};
    
    // Filter by organization if user has one
    if (dbUser?.organizationId) {
      where.organizationId = dbUser.organizationId;
    } else {
      where.userId = user.id;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.cutlistId) {
      where.cutlistId = params.cutlistId;
    }

    // Count total
    const total = await prisma.parseJob.count({ where });

    // Fetch page
    const jobs = await prisma.parseJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        cutlist: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
    console.error("List parse jobs error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to list parse jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/parse-jobs
 * Create a new parse job
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
    const data = CreateParseJobSchema.parse(body);

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    if (!dbUser?.organizationId) {
      return NextResponse.json(
        { error: "User must belong to an organization to create parse jobs" },
        { status: 400 }
      );
    }

    // Create parse job
    const job = await prisma.parseJob.create({
      data: {
        userId: user.id,
        organizationId: dbUser.organizationId,
        cutlistId: data.cutlistId,
        status: "queued",
        sourceKind: data.source.type,
        sourceData: JSON.parse(JSON.stringify(data.source)),
        options: data.options ? JSON.parse(JSON.stringify(data.options)) : undefined,
        mapping: data.mapping ? JSON.parse(JSON.stringify(data.mapping)) : undefined,
      },
    });

    // TODO: Queue job for processing
    // For now, we'll process synchronously in development
    // In production, this would be handled by a background worker

    // Return the created job
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        sourceKind: job.sourceKind,
        createdAt: job.createdAt,
      },
      message: "Parse job created and queued for processing",
    }, { status: 201 });
  } catch (error) {
    console.error("Create parse job error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create parse job" },
      { status: 500 }
    );
  }
}

