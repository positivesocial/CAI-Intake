/**
 * Operation Type API (single)
 * PATCH /api/v1/operations/types/:id - Update operation type
 * DELETE /api/v1/operations/types/:id - Delete operation type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateOperationType,
  deleteOperationType,
} from "@/lib/operations/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role (role_id references the roles table)
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin, roles(name)")
      .eq("id", user.id)
      .single();

    const roles = userData?.roles as { name: string }[] | null;
    const roleName = roles?.[0]?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const type = await updateOperationType(id, body);

    return NextResponse.json({ type });
  } catch (error) {
    console.error("Error updating operation type:", error);
    return NextResponse.json(
      { error: "Failed to update operation type" },
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role (role_id references the roles table)
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin, roles(name)")
      .eq("id", user.id)
      .single();

    const roles = userData?.roles as { name: string }[] | null;
    const roleName = roles?.[0]?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await deleteOperationType(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting operation type:", error);
    return NextResponse.json(
      { error: "Failed to delete operation type" },
      { status: 500 }
    );
  }
}

