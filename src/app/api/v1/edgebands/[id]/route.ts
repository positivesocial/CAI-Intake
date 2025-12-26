/**
 * CAI Intake - Single Edgeband API
 * 
 * GET /api/v1/edgebands/:id - Get edgeband
 * PUT /api/v1/edgebands/:id - Update edgeband
 * DELETE /api/v1/edgebands/:id - Delete edgeband
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Update edgeband schema - matches actual DB columns
const UpdateEdgebandSchema = z.object({
  edgeband_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  thickness_mm: z.number().positive().optional(),
  width_mm: z.number().positive().optional(),
  material: z.string().optional().nullable(),
  color_code: z.string().optional().nullable(),
  color_match_material_id: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  waste_factor_pct: z.number().min(0).max(100).optional(),
  overhang_mm: z.number().min(0).optional(),
  supplier: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS
    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id && !userData?.is_super_admin) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Get edgeband
    const { data: edgeband, error } = await serviceClient
      .from("edgebands")
      .select("*")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (error || !edgeband) {
      return NextResponse.json(
        { error: "Edgeband not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      edgeband: {
        id: edgeband.id,
        edgeband_id: edgeband.edgeband_id,
        name: edgeband.name,
        thickness_mm: edgeband.thickness_mm,
        width_mm: edgeband.width_mm ?? 22,
        material: edgeband.material ?? "PVC",
        color_code: edgeband.color_code ?? "#FFFFFF",
        color_match_material_id: edgeband.color_match_material_id,
        finish: edgeband.finish,
        waste_factor_pct: edgeband.waste_factor_pct ?? 1,
        overhang_mm: edgeband.overhang_mm ?? 0,
        supplier: edgeband.supplier,
        meta: edgeband.meta,
        created_at: edgeband.created_at,
        updated_at: edgeband.updated_at,
      },
    });

  } catch (error) {
    logger.error("Edgeband GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS
    const serviceClient = getServiceClient();

    // Get user's organization and role (join roles table)
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id && !userData?.is_super_admin) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Get role name from joined data
    const roleName = userData.is_super_admin ? "super_admin" : 
      (userData.roles as { name: string } | null)?.name || "viewer";

    // Check permission
    if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateEdgebandSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Update edgeband - only include actual DB columns
    const { data: edgeband, error } = await serviceClient
      .from("edgebands")
      .update({
        ...(data.edgeband_id !== undefined && { edgeband_id: data.edgeband_id }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.thickness_mm !== undefined && { thickness_mm: data.thickness_mm }),
        ...(data.width_mm !== undefined && { width_mm: data.width_mm }),
        ...(data.material !== undefined && { material: data.material }),
        ...(data.color_code !== undefined && { color_code: data.color_code }),
        ...(data.color_match_material_id !== undefined && { color_match_material_id: data.color_match_material_id }),
        ...(data.finish !== undefined && { finish: data.finish }),
        ...(data.waste_factor_pct !== undefined && { waste_factor_pct: data.waste_factor_pct }),
        ...(data.overhang_mm !== undefined && { overhang_mm: data.overhang_mm }),
        ...(data.supplier !== undefined && { supplier: data.supplier }),
        ...(data.meta !== undefined && { meta: data.meta }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .select()
      .single();

    if (error || !edgeband) {
      if (error?.code === "23505") {
        return NextResponse.json(
          { error: "Edgeband ID already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Edgeband not found or update failed" },
        { status: 404 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_UPDATED,
      entityType: "edgeband",
      entityId: edgeband.id,
      metadata: { edgebandId: edgeband.edgeband_id, name: edgeband.name, updates: data },
    });

    return NextResponse.json({
      success: true,
      edgeband: {
        id: edgeband.id,
        edgeband_id: edgeband.edgeband_id,
        name: edgeband.name,
        thickness_mm: edgeband.thickness_mm,
        width_mm: edgeband.width_mm ?? 22,
        material: edgeband.material ?? "PVC",
        color_code: edgeband.color_code ?? "#FFFFFF",
        color_match_material_id: edgeband.color_match_material_id,
        finish: edgeband.finish,
        waste_factor_pct: edgeband.waste_factor_pct ?? 1,
        overhang_mm: edgeband.overhang_mm ?? 0,
        supplier: edgeband.supplier,
        meta: edgeband.meta,
        created_at: edgeband.created_at,
        updated_at: edgeband.updated_at,
      },
    });

  } catch (error) {
    logger.error("Edgeband PUT error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS
    const serviceClient = getServiceClient();

    // Get user's organization and role (join roles table)
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id && !userData?.is_super_admin) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Get role name from joined data
    const roleName = userData.is_super_admin ? "super_admin" : 
      (userData.roles as { name: string } | null)?.name || "viewer";

    // Check permission - only admins can delete
    if (!["super_admin", "org_admin"].includes(roleName)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get edgeband first for audit
    const { data: existing } = await serviceClient
      .from("edgebands")
      .select("edgeband_id, name")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    // Delete edgeband
    const { error } = await serviceClient
      .from("edgebands")
      .delete()
      .eq("id", id)
      .eq("organization_id", userData.organization_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete edgeband" },
        { status: 500 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_DELETED,
      entityType: "edgeband",
      entityId: id,
      metadata: { edgebandId: existing?.edgeband_id, name: existing?.name },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error("Edgeband DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
