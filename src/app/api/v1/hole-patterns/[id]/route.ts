/**
 * CAI Intake API - Hole Pattern by ID
 * 
 * GET /api/v1/hole-patterns/:id - Get hole pattern
 * PUT /api/v1/hole-patterns/:id - Update hole pattern
 * DELETE /api/v1/hole-patterns/:id - Delete hole pattern
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { HolePatternInput } from "@/lib/operations/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { id } = await params;
    
    const { data: pattern, error } = await supabase
      .from("hole_patterns")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .eq("pattern_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Hole pattern not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(pattern);
  } catch (error) {
    console.error("Error fetching hole pattern:", error);
    return NextResponse.json(
      { error: "Failed to fetch hole pattern" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json() as Partial<HolePatternInput>;

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.kind !== undefined) updateData.kind = body.kind;
    if (body.holes !== undefined) updateData.holes = body.holes;
    if (body.ref_edge !== undefined) updateData.ref_edge = body.ref_edge;
    if (body.ref_corner !== undefined) updateData.ref_corner = body.ref_corner;
    if (body.parametric_config !== undefined) updateData.parametric_config = body.parametric_config;
    if (body.hardware_id !== undefined) updateData.hardware_id = body.hardware_id;
    if (body.hardware_brand !== undefined) updateData.hardware_brand = body.hardware_brand;
    if (body.hardware_model !== undefined) updateData.hardware_model = body.hardware_model;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data: pattern, error } = await supabase
      .from("hole_patterns")
      .update(updateData)
      .eq("organization_id", userData.organization_id)
      .eq("pattern_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating hole pattern:", error);
      return NextResponse.json(
        { error: "Failed to update hole pattern" },
        { status: 500 }
      );
    }

    return NextResponse.json(pattern);
  } catch (error) {
    console.error("Error updating hole pattern:", error);
    return NextResponse.json(
      { error: "Failed to update hole pattern" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    // Check if pattern exists and is not system
    const { data: pattern } = await supabase
      .from("hole_patterns")
      .select("is_system")
      .eq("organization_id", userData.organization_id)
      .eq("pattern_id", id)
      .single();

    if (!pattern) {
      return NextResponse.json(
        { error: "Hole pattern not found" },
        { status: 404 }
      );
    }
    
    if (pattern.is_system) {
      return NextResponse.json(
        { error: "Cannot delete system patterns" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("hole_patterns")
      .delete()
      .eq("organization_id", userData.organization_id)
      .eq("pattern_id", id);

    if (error) {
      console.error("Error deleting hole pattern:", error);
      return NextResponse.json(
        { error: "Failed to delete hole pattern" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hole pattern:", error);
    return NextResponse.json(
      { error: "Failed to delete hole pattern" },
      { status: 500 }
    );
  }
}
