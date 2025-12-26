/**
 * CAI Intake - Single Material API
 * 
 * GET /api/v1/materials/:id - Get material
 * PUT /api/v1/materials/:id - Update material
 * DELETE /api/v1/materials/:id - Delete material
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Update material schema - matches actual DB columns
const UpdateMaterialSchema = z.object({
  material_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  thickness_mm: z.number().positive().optional(),
  core_type: z.string().optional().nullable(),
  grain: z.enum(["none", "length", "width"]).optional().nullable(),
  finish: z.string().optional().nullable(),
  color_code: z.string().optional().nullable(),
  default_sheet: z.object({
    L: z.number().positive(),
    W: z.number().positive(),
  }).optional(),
  sku: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
  // Legacy field name - map to meta
  metadata: z.record(z.string(), z.unknown()).optional(),
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

    // Get material - handle super admins who may not have org_id
    let query = serviceClient
      .from("materials")
      .select("*")
      .eq("id", id);
    
    // Only filter by org if user has one (super admins may not)
    if (userData.organization_id) {
      query = query.eq("organization_id", userData.organization_id);
    }
    
    const { data: material, error } = await query.single();

    if (error || !material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      material: {
        id: material.id,
        material_id: material.material_id,
        name: material.name,
        thickness_mm: material.thickness_mm,
        core_type: material.core_type,
        grain: material.grain ?? "none",
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet || undefined,
        sku: material.sku,
        supplier: material.supplier,
        meta: material.meta,
        created_at: material.created_at,
        updated_at: material.updated_at,
      },
    });

  } catch (error) {
    logger.error("Material GET error", error);
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
    const { data: userData, error: userError } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    // Debug logging
    console.log("PUT /materials - User lookup:", {
      authUserId: user.id,
      authUserEmail: user.email,
      userData: userData ? {
        organization_id: userData.organization_id,
        is_super_admin: userData.is_super_admin,
        roles: userData.roles,
      } : null,
      userError: userError ? JSON.stringify(userError) : null,
    });

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
    console.log("PUT /materials - Request body:", JSON.stringify(body));
    
    const parseResult = UpdateMaterialSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.log("PUT /materials - Validation failed:", parseResult.error.issues);
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    console.log("PUT /materials - Validated data:", JSON.stringify(data));

    // Build update object - include all DB columns
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.material_id !== undefined) updateData.material_id = data.material_id;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.thickness_mm !== undefined) updateData.thickness_mm = data.thickness_mm;
    if (data.core_type !== undefined) updateData.core_type = data.core_type;
    if (data.grain !== undefined) updateData.grain = data.grain;
    if (data.finish !== undefined) updateData.finish = data.finish;
    if (data.color_code !== undefined) updateData.color_code = data.color_code;
    if (data.default_sheet !== undefined) {
      // default_sheet is a JSONB column storing { L, W }
      updateData.default_sheet = { L: data.default_sheet.L, W: data.default_sheet.W };
    }
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.supplier !== undefined) updateData.supplier = data.supplier;
    // meta column (was metadata)
    if (data.meta !== undefined) updateData.meta = data.meta;
    if (data.metadata !== undefined) updateData.meta = data.metadata; // Legacy support

    // Update material - handle super admins who may not have org_id
    let query = serviceClient
      .from("materials")
      .update(updateData)
      .eq("id", id);
    
    // Only filter by org if user has one (super admins may not)
    if (userData.organization_id) {
      query = query.eq("organization_id", userData.organization_id);
    }
    
    const { data: material, error } = await query.select().single();

    // Debug logging
    console.log("Material update attempt:", {
      materialId: id,
      orgId: userData.organization_id,
      hasError: !!error,
      hasMaterial: !!material,
      errorDetails: error ? JSON.stringify(error) : null,
    });

    if (error || !material) {
      logger.error("Material update failed", { 
        materialId: id, 
        orgId: userData.organization_id,
        error: error ? JSON.stringify(error) : "No material returned",
        errorCode: error?.code,
        errorMessage: error?.message,
        errorHint: error?.hint,
      });
      if (error?.code === "23505") {
        return NextResponse.json(
          { error: "Material ID already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Material not found or update failed", details: error?.message },
        { status: 404 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_UPDATED,
      entityType: "material",
      entityId: material.id,
      metadata: { materialId: material.material_id, name: material.name, updates: data },
    });

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        material_id: material.material_id,
        name: material.name,
        thickness_mm: material.thickness_mm,
        core_type: material.core_type,
        grain: material.grain ?? "none",
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet || undefined,
        sku: material.sku,
        supplier: material.supplier,
        meta: material.meta,
        created_at: material.created_at,
        updated_at: material.updated_at,
      },
    });

  } catch (error) {
    logger.error("Material PUT error", error);
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

    // Get material first for audit - handle super admins
    let getQuery = serviceClient
      .from("materials")
      .select("material_id, name, organization_id")
      .eq("id", id);
    
    if (userData.organization_id) {
      getQuery = getQuery.eq("organization_id", userData.organization_id);
    }
    
    const { data: existing } = await getQuery.single();

    // Check if material is in use (parts table references material_ref)
    const { count } = await serviceClient
      .from("cut_parts")
      .select("*", { count: "exact", head: true })
      .eq("material_ref", existing?.material_id || "");

    if (count && count > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete material that is in use",
          details: `${count} parts are using this material`,
        },
        { status: 409 }
      );
    }

    // Delete material - handle super admins
    let deleteQuery = serviceClient
      .from("materials")
      .delete()
      .eq("id", id);
    
    if (userData.organization_id) {
      deleteQuery = deleteQuery.eq("organization_id", userData.organization_id);
    }
    
    const { error } = await deleteQuery;

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete material" },
        { status: 500 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_DELETED,
      entityType: "material",
      entityId: id,
      metadata: { materialId: existing?.material_id, name: existing?.name },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error("Material DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
