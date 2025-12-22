/**
 * CAI Intake - Single Cutlist API
 * 
 * GET /api/v1/cutlists/:id - Get cutlist details
 * PUT /api/v1/cutlists/:id - Update cutlist
 * DELETE /api/v1/cutlists/:id - Delete cutlist
 * 
 * SECURITY: All operations verify organization ownership for defense-in-depth
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { applyRateLimit } from "@/lib/api-middleware";

// Update cutlist schema
const UpdateCutlistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  job_ref: z.string().max(100).optional(),
  client_ref: z.string().max(100).optional(),
  status: z.enum(["draft", "pending", "processing", "completed", "archived"]).optional(),
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
});

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "api");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    // Validate UUID format to prevent injection
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid cutlist ID format" }, { status: 400 });
    }
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization for authorization check
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const isSuperAdmin = userData.role === "super_admin";

    // Get cutlist with parts and linked files - CRITICAL: filter by organization_id for multi-tenant isolation
    let query = supabase
      .from("cutlists")
      .select(`
        *,
        parts (
          id,
          part_id,
          label,
          qty,
          size_l,
          size_w,
          thickness_mm,
          material_id,
          grain,
          allow_rotation,
          group_id,
          ops,
          notes,
          audit,
          created_at
        ),
        source_files:uploaded_files (
          id,
          file_name,
          original_name,
          mime_type,
          size_bytes,
          storage_path,
          kind,
          created_at
        )
      `)
      .eq("id", id);
    
    // Non-super-admins can only access their organization's cutlists
    if (!isSuperAdmin) {
      query = query.eq("organization_id", userData.organization_id);
    }
    
    const { data: cutlist, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
      }
      console.error("Failed to fetch cutlist:", error);
      return NextResponse.json(
        { error: "Failed to fetch cutlist" },
        { status: 500 }
      );
    }

    // Transform parts to canonical format
    const transformedParts = cutlist.parts?.map((p: {
      id: string;
      part_id: string;
      label: string | null;
      qty: number;
      size_l: number;
      size_w: number;
      thickness_mm: number;
      material_id: string;
      grain: string;
      allow_rotation: boolean;
      group_id: string | null;
      ops: unknown;
      notes: unknown;
      audit: unknown;
      created_at: string;
    }) => ({
      id: p.id,
      part_id: p.part_id,
      label: p.label,
      qty: p.qty,
      size: { L: p.size_l, W: p.size_w },
      thickness_mm: p.thickness_mm,
      material_id: p.material_id,
      grain: p.grain,
      allow_rotation: p.allow_rotation,
      group_id: p.group_id,
      ops: p.ops,
      notes: p.notes,
      audit: p.audit,
      created_at: p.created_at,
    })) ?? [];

    // Generate signed URLs for source files
    const sourceFilesWithUrls = await Promise.all(
      (cutlist.source_files || []).map(async (file: {
        id: string;
        file_name: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
        storage_path: string;
        kind: string;
        created_at: string;
      }) => {
        const { data: urlData } = await supabase.storage
          .from("cutlist-files")
          .createSignedUrl(file.storage_path, 3600); // 1 hour expiry
        
        return {
          ...file,
          url: urlData?.signedUrl,
        };
      })
    );

    return NextResponse.json({
      cutlist: {
        ...cutlist,
        parts: transformedParts,
        parts_count: transformedParts.length,
        source_files: sourceFilesWithUrls,
      },
    });

  } catch (error) {
    console.error("Cutlist GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "api");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid cutlist ID format" }, { status: 400 });
    }
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization for authorization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateCutlistSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;
    const isSuperAdmin = userData.role === "super_admin";

    // Update cutlist - CRITICAL: filter by organization_id
    let query = supabase
      .from("cutlists")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (!isSuperAdmin) {
      query = query.eq("organization_id", userData.organization_id);
    }
    
    const { data: cutlist, error } = await query.select().single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
      }
      logger.error("Failed to update cutlist", error, { userId: user.id, cutlistId: id });
      return NextResponse.json(
        { error: "Failed to update cutlist" },
        { status: 500 }
      );
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: cutlist.organization_id,
      action: AUDIT_ACTIONS.CUTLIST_UPDATED,
      entityType: "cutlist",
      entityId: cutlist.id,
      metadata: { name: cutlist.name, updates: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      cutlist,
    });

  } catch (error) {
    logger.error("Cutlist PUT error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "api");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid cutlist ID format" }, { status: 400 });
    }
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization for authorization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Check permissions - only admins and managers can delete
    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete cutlists" },
        { status: 403 }
      );
    }

    const isSuperAdmin = userData.role === "super_admin";

    // First get the cutlist to verify ownership and for audit log
    let selectQuery = supabase
      .from("cutlists")
      .select("id, name, organization_id")
      .eq("id", id);
    
    if (!isSuperAdmin) {
      selectQuery = selectQuery.eq("organization_id", userData.organization_id);
    }
    
    const { data: cutlist } = await selectQuery.single();
    
    if (!cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Get linked files BEFORE deleting the cutlist
    const { data: linkedFiles } = await supabase
      .from("uploaded_files")
      .select("id, storage_path")
      .eq("cutlist_id", id);

    // Delete files from storage first
    if (linkedFiles && linkedFiles.length > 0) {
      const storagePaths = linkedFiles.map(f => f.storage_path).filter(Boolean);
      
      if (storagePaths.length > 0) {
        // Delete from cutlist-files bucket
        const { error: storageError } = await supabase.storage
          .from("cutlist-files")
          .remove(storagePaths);
        
        if (storageError) {
          logger.warn("Failed to delete some files from storage", { 
            cutlistId: id, 
            error: storageError,
            paths: storagePaths 
          });
          // Continue with deletion - storage cleanup is best-effort
        }
      }

      // Delete file records from database (in case ON DELETE SET NULL doesn't handle it)
      await supabase
        .from("uploaded_files")
        .delete()
        .eq("cutlist_id", id);
    }

    // Delete cutlist - CRITICAL: filter by organization_id (parts will cascade delete)
    let deleteQuery = supabase
      .from("cutlists")
      .delete()
      .eq("id", id);
    
    if (!isSuperAdmin) {
      deleteQuery = deleteQuery.eq("organization_id", userData.organization_id);
    }
    
    const { error } = await deleteQuery;

    if (error) {
      logger.error("Failed to delete cutlist", error, { userId: user.id, cutlistId: id });
      return NextResponse.json(
        { error: "Failed to delete cutlist" },
        { status: 500 }
      );
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: cutlist.organization_id,
      action: AUDIT_ACTIONS.CUTLIST_DELETED,
      entityType: "cutlist",
      entityId: cutlist.id,
      metadata: { 
        name: cutlist.name,
        filesDeleted: linkedFiles?.length ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cutlist deleted",
      filesDeleted: linkedFiles?.length ?? 0,
    });

  } catch (error) {
    logger.error("Cutlist DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

