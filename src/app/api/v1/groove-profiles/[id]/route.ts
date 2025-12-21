/**
 * CAI Intake API - Groove Profile by ID
 * 
 * GET /api/v1/groove-profiles/:id - Get groove profile
 * PUT /api/v1/groove-profiles/:id - Update groove profile
 * DELETE /api/v1/groove-profiles/:id - Delete groove profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GrooveProfileInput } from "@/lib/operations/types";

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
      .from("groove_profiles")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Groove profile not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching groove profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch groove profile" },
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
    const body = await request.json() as Partial<GrooveProfileInput>;

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.width_mm !== undefined) updateData.width_mm = body.width_mm;
    if (body.depth_mm !== undefined) updateData.depth_mm = body.depth_mm;
    if (body.purpose !== undefined) updateData.purpose = body.purpose;
    if (body.default_offset_mm !== undefined) updateData.default_offset_mm = body.default_offset_mm;
    if (body.default_face !== undefined) updateData.default_face = body.default_face;
    if (body.allow_stopped !== undefined) updateData.allow_stopped = body.allow_stopped;
    if (body.default_start_offset_mm !== undefined) updateData.default_start_offset_mm = body.default_start_offset_mm;
    if (body.default_end_offset_mm !== undefined) updateData.default_end_offset_mm = body.default_end_offset_mm;
    if (body.tool_dia_mm !== undefined) updateData.tool_dia_mm = body.tool_dia_mm;
    if (body.tool_id !== undefined) updateData.tool_id = body.tool_id;
    if (body.feed_rate !== undefined) updateData.feed_rate = body.feed_rate;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data: profile, error } = await supabase
      .from("groove_profiles")
      .update(updateData)
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating groove profile:", error);
      return NextResponse.json(
        { error: "Failed to update groove profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error updating groove profile:", error);
    return NextResponse.json(
      { error: "Failed to update groove profile" },
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
      .from("groove_profiles")
      .select("is_system")
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Groove profile not found" },
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
      .from("groove_profiles")
      .delete()
      .eq("organization_id", userData.organization_id)
      .eq("profile_id", id);

    if (error) {
      console.error("Error deleting groove profile:", error);
      return NextResponse.json(
        { error: "Failed to delete groove profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting groove profile:", error);
    return NextResponse.json(
      { error: "Failed to delete groove profile" },
      { status: 500 }
    );
  }
}
