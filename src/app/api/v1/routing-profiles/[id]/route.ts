/**
 * CAI Intake API - Routing Profile by ID
 * 
 * GET /api/v1/routing-profiles/:id - Get routing profile
 * PUT /api/v1/routing-profiles/:id - Update routing profile
 * DELETE /api/v1/routing-profiles/:id - Delete routing profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RoutingProfileInput } from "@/lib/operations/types";

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
    
    const { data: profile, error } = await supabase
      .from("routing_profiles")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Routing profile not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching routing profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch routing profile" },
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
    const body = await request.json() as Partial<RoutingProfileInput>;

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.profile_type !== undefined) updateData.profile_type = body.profile_type;
    if (body.specifications !== undefined) updateData.specifications = body.specifications;
    if (body.tool_dia_mm !== undefined) updateData.tool_dia_mm = body.tool_dia_mm;
    if (body.tool_id !== undefined) updateData.tool_id = body.tool_id;
    if (body.tool_type !== undefined) updateData.tool_type = body.tool_type;
    if (body.feed_rate !== undefined) updateData.feed_rate = body.feed_rate;
    if (body.plunge_rate !== undefined) updateData.plunge_rate = body.plunge_rate;
    if (body.spindle_speed !== undefined) updateData.spindle_speed = body.spindle_speed;
    if (body.step_down_mm !== undefined) updateData.step_down_mm = body.step_down_mm;
    if (body.dxf_layer !== undefined) updateData.dxf_layer = body.dxf_layer;
    if (body.gcode_template !== undefined) updateData.gcode_template = body.gcode_template;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data: profile, error } = await supabase
      .from("routing_profiles")
      .update(updateData)
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating routing profile:", error);
      return NextResponse.json(
        { error: "Failed to update routing profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error updating routing profile:", error);
    return NextResponse.json(
      { error: "Failed to update routing profile" },
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
    
    const { data: profile } = await supabase
      .from("routing_profiles")
      .select("is_system")
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Routing profile not found" },
        { status: 404 }
      );
    }
    
    if (profile.is_system) {
      return NextResponse.json(
        { error: "Cannot delete system profiles" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("routing_profiles")
      .delete()
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id);

    if (error) {
      console.error("Error deleting routing profile:", error);
      return NextResponse.json(
        { error: "Failed to delete routing profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting routing profile:", error);
    return NextResponse.json(
      { error: "Failed to delete routing profile" },
      { status: 500 }
    );
  }
}
