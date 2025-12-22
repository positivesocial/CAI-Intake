/**
 * CAI Intake - Cutlists API
 * 
 * GET /api/v1/cutlists - List cutlists
 * POST /api/v1/cutlists - Create cutlist
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateId } from "@/lib/utils";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { trackUsage } from "@/lib/usage";
import crypto from "crypto";

// Create cutlist schema
const CreateCutlistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  job_ref: z.string().optional(),
  client_ref: z.string().optional(),
  capabilities: z.object({
    core_parts: z.boolean().optional(),
    edging: z.boolean().optional(),
    grooves: z.boolean().optional(),
    cnc_holes: z.boolean().optional(),
    cnc_routing: z.boolean().optional(),
    custom_cnc: z.boolean().optional(),
    advanced_grouping: z.boolean().optional(),
    part_notes: z.boolean().optional(),
  }).optional(),
  parts: z.array(z.object({
    part_id: z.string(),
    label: z.string().optional(),
    qty: z.number().int().positive(),
    size: z.object({ L: z.number(), W: z.number() }),
    thickness_mm: z.number().positive(),
    material_id: z.string(),
    grain: z.string().optional(),
    allow_rotation: z.boolean().optional(),
    group_id: z.string().optional(),
    ops: z.any().optional(),
    notes: z.any().optional(),
  })).optional(),
});

// List query params
const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["draft", "pending", "processing", "completed", "archived"]).optional(),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const queryResult = ListQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      search: searchParams.get("search"),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryResult.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, status, search } = queryResult.data;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("cutlists")
      .select("*, parts:cut_parts(count)", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (search) {
      // Sanitize search input to prevent SQL injection via LIKE patterns
      const sanitizedSearch = sanitizeLikePattern(search.slice(0, SIZE_LIMITS.SEARCH_QUERY));
      query = query.or(`name.ilike.%${sanitizedSearch}%,job_ref.ilike.%${sanitizedSearch}%,client_ref.ilike.%${sanitizedSearch}%`);
    }

    const { data: cutlists, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch cutlists", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch cutlists" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cutlists: cutlists?.map((c: any) => ({
        ...c,
        parts_count: c.parts?.[0]?.count ?? 0,
        parts: undefined,
      })),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
      },
    });

  } catch (error) {
    logger.error("Cutlists GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const organizationId = userData.organization_id;

    // Parse request body
    const body = await request.json();
    const parseResult = CreateCutlistSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { name, description, job_ref, client_ref, capabilities, parts } = parseResult.data;

    // Generate doc_id and unique cutlist ID
    const doc_id = generateId("DOC");
    const cutlistId = crypto.randomUUID();

    // Create cutlist - explicitly provide ID and updated_at since database defaults may not work
    const now = new Date().toISOString();
    const { data: cutlist, error: cutlistError } = await supabase
      .from("cutlists")
      .insert({
        id: cutlistId, // Explicitly provide UUID
        organization_id: organizationId,
        user_id: user.id,
        doc_id,
        name,
        description,
        job_ref,
        client_ref,
        source_method: "web", // Required field
        created_at: now,
        updated_at: now, // Required field - no database default
        capabilities: capabilities ?? {
          core_parts: true,
          edging: true,
          grooves: false,
          cnc_holes: false,
          cnc_routing: false,
          custom_cnc: false,
          advanced_grouping: false,
          part_notes: true,
        },
      })
      .select()
      .single();

    if (cutlistError) {
      logger.error("Failed to create cutlist", cutlistError, { 
        userId: user.id,
        organizationId,
        errorCode: cutlistError.code,
        errorMessage: cutlistError.message,
        errorDetails: cutlistError.details,
      });
      return NextResponse.json(
        { 
          error: "Failed to create cutlist",
          details: process.env.NODE_ENV === "development" ? cutlistError.message : undefined,
        },
        { status: 500 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: organizationId,
      action: AUDIT_ACTIONS.CUTLIST_CREATED,
      entityType: "cutlist",
      entityId: cutlist.id,
      metadata: { name, partsCount: parts?.length || 0 },
    });
    
    // Track usage
    trackUsage({
      organizationId: organizationId,
      userId: user.id,
      eventType: "cutlist_created",
    });

    // Create parts if provided
    if (parts && parts.length > 0) {
      const { error: partsError } = await supabase
        .from("cut_parts")
        .insert(
          parts.map(p => ({
            id: crypto.randomUUID(), // Explicitly provide UUID for each part
            cutlist_id: cutlist.id,
            part_id: p.part_id,
            label: p.label,
            qty: p.qty,
            size_l: p.size.L,
            size_w: p.size.W,
            thickness_mm: p.thickness_mm,
            material_ref: p.material_id, // DB column is material_ref
            grain: p.grain ?? "none",
            allow_rotation: p.allow_rotation ?? true,
            group_id: p.group_id,
            ops: p.ops,
            notes: p.notes,
            created_at: now,
            updated_at: now,
          }))
        );

      if (partsError) {
        logger.error("Failed to create parts", partsError, { cutlistId: cutlist.id });
        // Don't fail the whole request, cutlist was created
      }
    }

    return NextResponse.json({
      success: true,
      cutlist: {
        ...cutlist,
        parts_count: parts?.length ?? 0,
      },
    }, { status: 201 });

  } catch (error) {
    logger.error("Cutlists POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
