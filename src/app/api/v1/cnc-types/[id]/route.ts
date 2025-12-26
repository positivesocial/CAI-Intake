/**
 * CAI Intake API - CNC Type by ID
 * 
 * GET /api/v1/cnc-types/[id] - Get a specific CNC type
 * PUT /api/v1/cnc-types/[id] - Update a CNC type
 * DELETE /api/v1/cnc-types/[id] - Delete a CNC type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getRoleName, type RoleJoin } from "@/lib/utils/role-helpers";

// Validation schema
const UpdateCncTypeSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  op_type: z.enum(["pocket", "profile", "drill", "engrave", "cutout", "custom"]).optional(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get user's organization
    const { data: userData } = await supabase
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

    // Fetch the CNC type
    let query = supabase
      .from("cnc_operation_types")
      .select("*")
      .eq("id", id);

    if (!userData?.is_super_admin) {
      query = query.eq("organization_id", userData.organization_id);
    }

    const { data: cncType, error } = await query.single();

    if (error || !cncType) {
      return NextResponse.json({ error: "CNC type not found" }, { status: 404 });
    }

    return NextResponse.json({ type: cncType });
  } catch (error) {
    logger.error("CNC type GET error", error);
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
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get user's organization and role
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, is_super_admin, role:roles(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const roleName = getRoleName(userData?.role as RoleJoin);
    const isSuperAdmin = userData?.is_super_admin === true;

    // Check permission
    if (!isSuperAdmin && !["org_admin", "manager"].includes(roleName || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = UpdateCncTypeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.op_type !== undefined) updateData.op_type = input.op_type;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    updateData.updated_at = new Date().toISOString();

    // Update CNC type
    const { data: cncType, error } = await supabase
      .from("cnc_operation_types")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update CNC type", error, { userId: user.id, id });
      return NextResponse.json(
        { error: "Failed to update CNC type" },
        { status: 500 }
      );
    }

    if (!cncType) {
      return NextResponse.json({ error: "CNC type not found" }, { status: 404 });
    }

    return NextResponse.json({ type: cncType });
  } catch (error) {
    logger.error("CNC type PUT error", error);
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
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get user's organization and role
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, is_super_admin, role:roles(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const roleName = getRoleName(userData?.role as RoleJoin);
    const isSuperAdmin = userData?.is_super_admin === true;

    // Check permission
    if (!isSuperAdmin && !["org_admin", "manager"].includes(roleName || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Delete CNC type
    const { error } = await supabase
      .from("cnc_operation_types")
      .delete()
      .eq("id", id)
      .eq("organization_id", userData.organization_id);

    if (error) {
      logger.error("Failed to delete CNC type", error, { userId: user.id, id });
      return NextResponse.json(
        { error: "Failed to delete CNC type" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("CNC type DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


