/**
 * Operation Types API
 * GET /api/v1/operations/types - List operation types
 * POST /api/v1/operations/types - Create operation type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOperationTypes,
  createOperationType,
} from "@/lib/operations/service";
import { OperationCategory } from "@/lib/operations/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const organizationId = userData?.organization_id;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as OperationCategory | null;

    const types = await getOperationTypes(
      organizationId ?? undefined,
      category ?? undefined
    );

    return NextResponse.json({ types });
  } catch (error) {
    console.error("Error fetching operation types:", error);
    return NextResponse.json(
      { error: "Failed to fetch operation types" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role (role_id references the roles table)
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, is_super_admin, roles(name)")
      .eq("id", user.id)
      .single();

    const roleName = (userData?.roles as { name: string } | null)?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();

    const type = await createOperationType(body, userData.organization_id);

    return NextResponse.json({ type }, { status: 201 });
  } catch (error) {
    console.error("Error creating operation type:", error);
    return NextResponse.json(
      { error: "Failed to create operation type" },
      { status: 500 }
    );
  }
}

