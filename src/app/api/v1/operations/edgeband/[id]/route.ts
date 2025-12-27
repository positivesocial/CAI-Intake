/**
 * Edgeband Operation API (single)
 * PATCH /api/v1/operations/edgeband/:id - Update edgeband operation
 * DELETE /api/v1/operations/edgeband/:id - Delete edgeband operation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateEdgebandOperation,
  deleteEdgebandOperation,
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
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_super_admin, roles(name)")
      .eq("id", user.id)
      .single();

    console.log("[PATCH edgeband] User data:", { userData, userError, userId: user.id });

    const roleName = (userData?.roles as { name: string } | null)?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      console.log("[PATCH edgeband] Access denied - role:", roleName, "is_super_admin:", isSuperAdmin);
      return NextResponse.json({ error: `Admin access required. Your role: ${roleName || 'unknown'}` }, { status: 403 });
    }

    const body = await request.json();
    const operation = await updateEdgebandOperation(id, body);

    return NextResponse.json({ operation });
  } catch (error) {
    console.error("Error updating edgeband operation:", error);
    return NextResponse.json(
      { error: "Failed to update edgeband operation" },
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

    const roleName = (userData?.roles as { name: string } | null)?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await deleteEdgebandOperation(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting edgeband operation:", error);
    return NextResponse.json(
      { error: "Failed to delete edgeband operation" },
      { status: 500 }
    );
  }
}

