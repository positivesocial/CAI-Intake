/**
 * CAI Intake - Single Material API
 * 
 * GET /api/v1/materials/:id - Get material
 * PUT /api/v1/materials/:id - Update material
 * DELETE /api/v1/materials/:id - Delete material
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Update material schema
const UpdateMaterialSchema = z.object({
  material_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  thickness_mm: z.number().positive().optional(),
  core_type: z.string().optional().nullable(),
  grain: z.enum(["none", "length", "width"]).optional(),
  finish: z.string().optional().nullable(),
  color_code: z.string().optional().nullable(),
  default_sheet: z.object({
    L: z.number().positive(),
    W: z.number().positive(),
  }).optional(),
  supplier: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get material
    const { data: material, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

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
        grain: material.grain,
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet_l && material.default_sheet_w ? {
          L: material.default_sheet_l,
          W: material.default_sheet_w,
        } : undefined,
        supplier: material.supplier,
        sku: material.sku,
        metadata: material.metadata,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
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

    // Check permission
    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateMaterialSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Build update object
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
      updateData.default_sheet_l = data.default_sheet.L;
      updateData.default_sheet_w = data.default_sheet.W;
    }
    if (data.supplier !== undefined) updateData.supplier = data.supplier;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // Update material
    const { data: material, error } = await supabase
      .from("materials")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .select()
      .single();

    if (error || !material) {
      if (error?.code === "23505") {
        return NextResponse.json(
          { error: "Material ID already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Material not found or update failed" },
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
        grain: material.grain,
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet_l && material.default_sheet_w ? {
          L: material.default_sheet_l,
          W: material.default_sheet_w,
        } : undefined,
        supplier: material.supplier,
        sku: material.sku,
        metadata: material.metadata,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
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

    // Check permission - only admins can delete
    if (!["super_admin", "org_admin"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get material first for audit
    const { data: existing } = await supabase
      .from("materials")
      .select("material_id, name")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    // Check if material is in use (parts table references material_id)
    const { count } = await supabase
      .from("parts")
      .select("*", { count: "exact", head: true })
      .eq("material_id", existing?.material_id || "");

    if (count && count > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete material that is in use",
          details: `${count} parts are using this material`,
        },
        { status: 409 }
      );
    }

    // Delete material
    const { error } = await supabase
      .from("materials")
      .delete()
      .eq("id", id)
      .eq("organization_id", userData.organization_id);

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
