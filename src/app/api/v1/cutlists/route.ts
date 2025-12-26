/**
 * CAI Intake - Cutlists API
 * 
 * GET /api/v1/cutlists - List cutlists
 * POST /api/v1/cutlists - Create cutlist
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateId } from "@/lib/utils";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { trackUsage } from "@/lib/usage";
import crypto from "crypto";

// Create cutlist schema - use coerce for flexibility with string/number values
const CreateCutlistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  project_name: z.string().optional(), // Project name for this cutlist
  customer_name: z.string().optional(), // Customer/client name
  job_ref: z.string().optional(), // Legacy field (alias for project)
  client_ref: z.string().optional(), // Legacy field (alias for customer)
  file_ids: z.array(z.string().uuid()).optional(), // IDs of uploaded files to link
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
    label: z.string().optional().nullable(),
    qty: z.coerce.number().int().positive(),
    size: z.object({ 
      L: z.coerce.number().positive(), 
      W: z.coerce.number().positive() 
    }),
    thickness_mm: z.coerce.number().positive(),
    material_id: z.string(),
    grain: z.string().optional().nullable(),
    allow_rotation: z.boolean().optional().nullable(),
    group_id: z.string().optional().nullable(),
    ops: z.any().optional().nullable(),
    notes: z.any().optional().nullable(),
  })).optional(),
});

// List query params
const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["draft", "pending", "processing", "completed", "archived"]).optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization - use service client to bypass RLS
    const serviceClient = getServiceClient();
    const { data: userData, error: userError } = await serviceClient
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      logger.error("Failed to fetch user data for cutlists", userError, { userId: user.id });
    }

    if (!userData?.organization_id) {
      logger.warn("User not associated with organization for cutlists", { userId: user.id, userData, userError });
      return NextResponse.json(
        { error: "User not associated with an organization", details: userError?.message },
        { status: 400 }
      );
    }

    // Parse query params - use undefined instead of null for missing params
    const searchParams = request.nextUrl.searchParams;
    const queryResult = ListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      order: searchParams.get("order") ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryResult.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, status, search, sort, order } = queryResult.data;
    const offset = (page - 1) * limit;

    // Map sort field to database column
    const sortFieldMap: Record<string, string> = {
      updatedAt: "updated_at",
      createdAt: "created_at",
      name: "name",
      status: "status",
    };
    const sortColumn = sortFieldMap[sort || "createdAt"] || "created_at";

    // Build query - use service client to bypass RLS issues
    let query = serviceClient
      .from("cutlists")
      .select("*, parts:cut_parts(count)", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order(sortColumn, { ascending: order === "asc" })
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

    // Get file counts for each cutlist (separate query since relationship may not exist)
    const cutlistIds = cutlists?.map((c: { id: string }) => c.id) || [];
    let fileCounts: Record<string, number> = {};
    let materialCounts: Record<string, number> = {};
    let pieceCounts: Record<string, number> = {};
    
    if (cutlistIds.length > 0) {
      // Get file counts
      try {
        const { data: fileData } = await serviceClient
          .from("uploaded_files")
          .select("cutlist_id")
          .in("cutlist_id", cutlistIds);
        
        if (fileData) {
          fileCounts = fileData.reduce((acc: Record<string, number>, f: { cutlist_id: string }) => {
            acc[f.cutlist_id] = (acc[f.cutlist_id] || 0) + 1;
            return acc;
          }, {});
        }
      } catch {
        // File counts are optional - table may not have cutlist_id column
      }

      // Get unique material counts and total pieces per cutlist
      try {
        const { data: partsData } = await serviceClient
          .from("cut_parts")
          .select("cutlist_id, material_ref, qty")
          .in("cutlist_id", cutlistIds);
        
        if (partsData) {
          // Group by cutlist_id to count unique materials and sum qty
          const cutlistGroups: Record<string, { materials: Set<string>; totalPieces: number }> = {};
          
          for (const part of partsData) {
            if (!cutlistGroups[part.cutlist_id]) {
              cutlistGroups[part.cutlist_id] = { materials: new Set(), totalPieces: 0 };
            }
            if (part.material_ref) {
              cutlistGroups[part.cutlist_id].materials.add(part.material_ref);
            }
            cutlistGroups[part.cutlist_id].totalPieces += part.qty || 1;
          }
          
          for (const [cutlistId, data] of Object.entries(cutlistGroups)) {
            materialCounts[cutlistId] = data.materials.size;
            pieceCounts[cutlistId] = data.totalPieces;
          }
        }
      } catch {
        // Material counts are optional
      }
    }

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cutlists: cutlists?.map((c: any) => ({
        id: c.id,
        docId: c.doc_id,
        name: c.name,
        description: c.description,
        projectName: c.project_name || c.job_ref || null, // Use project_name if available, fallback to job_ref
        customerName: c.customer_name || c.client_ref || null, // Use customer_name if available, fallback to client_ref
        jobRef: c.job_ref,
        clientRef: c.client_ref,
        status: c.status,
        partsCount: c.parts?.[0]?.count ?? 0,
        totalPieces: pieceCounts[c.id] || 0,
        totalArea: 0,   // Will be calculated if needed
        materialsCount: materialCounts[c.id] || 0,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        efficiency: c.efficiency,
        filesCount: fileCounts[c.id] || 0,
        sourceMethod: c.source_method,
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

    // Get user's organization - use service client to bypass RLS
    const serviceClient = getServiceClient();
    const { data: userData } = await serviceClient
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
    
    // Log incoming data for debugging
    logger.info("Creating cutlist", {
      userId: user.id,
      name: body.name,
      partsCount: body.parts?.length,
      hasCapabilities: !!body.capabilities,
    });
    
    const parseResult = CreateCutlistSchema.safeParse(body);
    
    if (!parseResult.success) {
      logger.error("Cutlist validation failed", {
        issues: parseResult.error.issues,
        receivedKeys: Object.keys(body),
        name: body.name,
        nameType: typeof body.name,
        partsCount: body.parts?.length,
        firstPartThickness: body.parts?.[0]?.thickness_mm,
        firstPartThicknessType: typeof body.parts?.[0]?.thickness_mm,
      });
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { name, description, project_name, customer_name, job_ref, client_ref, file_ids, capabilities, parts } = parseResult.data;

    // Generate doc_id and unique cutlist ID
    const doc_id = generateId("DOC");
    const cutlistId = crypto.randomUUID();

    // Create cutlist - explicitly provide ID and updated_at since database defaults may not work
    const now = new Date().toISOString();
    const { data: cutlist, error: cutlistError } = await serviceClient
      .from("cutlists")
      .insert({
        id: cutlistId, // Explicitly provide UUID
        organization_id: organizationId,
        user_id: user.id,
        doc_id,
        name,
        description,
        project_name: project_name || job_ref || null, // Use project_name or fallback to job_ref
        customer_name: customer_name || client_ref || null, // Use customer_name or fallback to client_ref
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
      const { error: partsError } = await serviceClient
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

    // Link uploaded files to this cutlist
    if (file_ids && file_ids.length > 0) {
      const { error: linkError } = await serviceClient
        .from("uploaded_files")
        .update({ cutlist_id: cutlist.id })
        .in("id", file_ids)
        .eq("organization_id", organizationId); // Security: only link files from same org

      if (linkError) {
        logger.warn("Failed to link files to cutlist", { 
          cutlistId: cutlist.id, 
          fileIds: file_ids,
          error: linkError 
        });
        // Don't fail the request, cutlist was created
      } else {
        logger.info("📁 Linked files to cutlist", { 
          cutlistId: cutlist.id, 
          fileCount: file_ids.length 
        });
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
