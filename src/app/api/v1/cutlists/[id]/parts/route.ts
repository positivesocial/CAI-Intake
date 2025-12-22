/**
 * CAI Intake - Cutlist Parts API
 * 
 * GET /api/v1/cutlists/:id/parts - Get parts
 * POST /api/v1/cutlists/:id/parts - Add parts
 * DELETE /api/v1/cutlists/:id/parts - Bulk delete parts
 * PATCH /api/v1/cutlists/:id/parts - Bulk update parts
 * 
 * SECURITY: All operations verify organization ownership for defense-in-depth
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { SIZE_LIMITS } from "@/lib/security";
import { applyRateLimit } from "@/lib/api-middleware";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Add parts schema with size limits
const AddPartsSchema = z.object({
  parts: z.array(z.object({
    part_id: z.string().min(1).max(100),
    label: z.string().max(200).optional(),
    qty: z.number().int().positive().max(10000),
    size: z.object({ 
      L: z.number().positive().max(100000), // Max 100m
      W: z.number().positive().max(100000) 
    }),
    thickness_mm: z.number().positive().max(1000),
    material_id: z.string().min(1).max(100),
    grain: z.string().max(50).optional(),
    allow_rotation: z.boolean().optional(),
    group_id: z.string().max(100).optional(),
    ops: z.any().optional(),
    notes: z.any().optional(),
    audit: z.any().optional(),
  })).max(SIZE_LIMITS.MAX_PARTS_PER_BATCH || 1000),
});

// Bulk delete schema
const BulkDeleteSchema = z.object({
  part_ids: z.array(z.string().max(100)).min(1).max(1000),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Helper to verify cutlist ownership
 */
async function verifyCutlistAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cutlistId: string,
  organizationId: string,
  isSuperAdmin: boolean
): Promise<{ cutlist: { id: string; organization_id: string } | null; error: string | null }> {
  let query = supabase
    .from("cutlists")
    .select("id, organization_id")
    .eq("id", cutlistId);
  
  if (!isSuperAdmin) {
    query = query.eq("organization_id", organizationId);
  }
  
  const { data: cutlist, error } = await query.single();
  
  if (error || !cutlist) {
    return { cutlist: null, error: "Cutlist not found or access denied" };
  }
  
  return { cutlist, error: null };
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
    
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid cutlist ID format" }, { status: 400 });
    }
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
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

    // Verify cutlist access - CRITICAL: check organization ownership
    const { cutlist, error: accessError } = await verifyCutlistAccess(
      supabase,
      id,
      userData.organization_id,
      isSuperAdmin
    );

    if (accessError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Get parts
    const { data: parts, error } = await supabase
      .from("cut_parts")
      .select("*")
      .eq("cutlist_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch parts", error, { userId: user.id, cutlistId: id });
      return NextResponse.json(
        { error: "Failed to fetch parts" },
        { status: 500 }
      );
    }

    // Transform to canonical format
    const transformedParts = (parts as Array<{
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
      updated_at: string;
    }> | null)?.map(p => ({
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
      updated_at: p.updated_at,
    })) ?? [];

    return NextResponse.json({
      parts: transformedParts,
      count: transformedParts.length,
    });

  } catch (error) {
    logger.error("Parts GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Get user's organization
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

    // Verify cutlist access - CRITICAL: check organization ownership
    const { cutlist, error: accessError } = await verifyCutlistAccess(
      supabase,
      id,
      userData.organization_id,
      isSuperAdmin
    );

    if (accessError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = AddPartsSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { parts } = parseResult.data;

    // Insert parts
    const { data: insertedParts, error } = await supabase
      .from("cut_parts")
      .insert(
        parts.map(p => ({
          cutlist_id: id,
          part_id: p.part_id,
          label: p.label,
          qty: p.qty,
          size_l: p.size.L,
          size_w: p.size.W,
          thickness_mm: p.thickness_mm,
          material_id: p.material_id,
          grain: p.grain ?? "none",
          allow_rotation: p.allow_rotation ?? true,
          group_id: p.group_id,
          ops: p.ops,
          notes: p.notes,
          audit: p.audit,
        }))
      )
      .select();

    if (error) {
      logger.error("Failed to add parts", error, { userId: user.id, cutlistId: id });
      return NextResponse.json(
        { error: "Failed to add parts" },
        { status: 500 }
      );
    }

    // Transform response
    const transformedParts = (insertedParts as Array<{
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
    }> | null)?.map(p => ({
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

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: cutlist.organization_id,
      action: AUDIT_ACTIONS.PARTS_ADDED,
      entityType: "cutlist",
      entityId: id,
      metadata: { partsCount: transformedParts.length },
    });

    return NextResponse.json({
      success: true,
      parts: transformedParts,
      count: transformedParts.length,
    }, { status: 201 });

  } catch (error) {
    logger.error("Parts POST error", error);
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

    // Get user's organization
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

    // Verify cutlist access - CRITICAL: check organization ownership
    const { cutlist, error: accessError } = await verifyCutlistAccess(
      supabase,
      id,
      userData.organization_id,
      isSuperAdmin
    );

    if (accessError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = BulkDeleteSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { part_ids } = parseResult.data;

    // Delete parts - cutlist_id constraint ensures we only delete from the verified cutlist
    const { error, count } = await supabase
      .from("cut_parts")
      .delete()
      .eq("cutlist_id", id)
      .in("part_id", part_ids);

    if (error) {
      logger.error("Failed to delete parts", error, { userId: user.id, cutlistId: id });
      return NextResponse.json(
        { error: "Failed to delete parts" },
        { status: 500 }
      );
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: cutlist.organization_id,
      action: AUDIT_ACTIONS.PARTS_DELETED,
      entityType: "cutlist",
      entityId: id,
      metadata: { partIds: part_ids, count },
    });

    return NextResponse.json({
      success: true,
      deleted: count ?? part_ids.length,
    });

  } catch (error) {
    logger.error("Parts DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Bulk update schema with size limits
const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    part_id: z.string().min(1).max(100),
    label: z.string().max(200).optional(),
    qty: z.number().int().positive().max(10000).optional(),
    size: z.object({ 
      L: z.number().positive().max(100000), 
      W: z.number().positive().max(100000) 
    }).optional(),
    thickness_mm: z.number().positive().max(1000).optional(),
    material_id: z.string().min(1).max(100).optional(),
    grain: z.string().max(50).optional(),
    allow_rotation: z.boolean().optional(),
    group_id: z.string().max(100).nullable().optional(),
    ops: z.any().optional(),
    notes: z.any().optional(),
  })).max(500), // Limit batch size for performance
});

export async function PATCH(
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

    // Get user's organization
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

    // Verify cutlist access - CRITICAL: check organization ownership
    const { cutlist, error: accessError } = await verifyCutlistAccess(
      supabase,
      id,
      userData.organization_id,
      isSuperAdmin
    );

    if (accessError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = BulkUpdateSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { updates } = parseResult.data;
    
    // PERFORMANCE: Batch updates using Promise.all with concurrency limit
    // This is much faster than sequential updates (N+1 problem)
    const BATCH_SIZE = 10; // Process 10 at a time to avoid overwhelming DB
    const results: Array<{ part_id: string; success: boolean; error?: string }> = [];
    
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (update) => {
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          
          if (update.label !== undefined) updateData.label = update.label;
          if (update.qty !== undefined) updateData.qty = update.qty;
          if (update.size !== undefined) {
            updateData.size_l = update.size.L;
            updateData.size_w = update.size.W;
          }
          if (update.thickness_mm !== undefined) updateData.thickness_mm = update.thickness_mm;
          if (update.material_id !== undefined) updateData.material_id = update.material_id;
          if (update.grain !== undefined) updateData.grain = update.grain;
          if (update.allow_rotation !== undefined) updateData.allow_rotation = update.allow_rotation;
          if (update.group_id !== undefined) updateData.group_id = update.group_id;
          if (update.ops !== undefined) updateData.ops = update.ops;
          if (update.notes !== undefined) updateData.notes = update.notes;

          // Only updated_at means no actual updates
          if (Object.keys(updateData).length === 1) {
            return { part_id: update.part_id, success: false, error: "No fields to update" };
          }

          const { error } = await supabase
            .from("cut_parts")
            .update(updateData)
            .eq("cutlist_id", id)
            .eq("part_id", update.part_id);

          if (error) {
            return { part_id: update.part_id, success: false, error: error.message };
          }
          return { part_id: update.part_id, success: true };
        })
      );
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Audit log
    if (successCount > 0) {
      await logAuditFromRequest(request, {
        userId: user.id,
        organizationId: cutlist.organization_id,
        action: AUDIT_ACTIONS.PARTS_UPDATED,
        entityType: "cutlist",
        entityId: id,
        metadata: { updatedCount: successCount, failedCount: failCount },
      });
    }

    return NextResponse.json({
      success: failCount === 0,
      updated: successCount,
      failed: failCount,
      results,
    });

  } catch (error) {
    logger.error("Parts PATCH error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

