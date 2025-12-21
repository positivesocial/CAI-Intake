/**
 * CAI Intake API - Groove Profiles
 * 
 * GET /api/v1/groove-profiles - List groove profiles
 * POST /api/v1/groove-profiles - Create groove profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import type { GrooveProfileInput } from "@/lib/operations/types";

// Demo data for development/testing - matches GrooveProfile type
const DEMO_PROFILES = [
  {
    id: "demo-g1",
    organization_id: "demo-org-id",
    profile_id: "back-panel-dado",
    name: "Back Panel Dado",
    purpose: "back_panel",
    description: "Standard dado for 3mm back panels",
    width_mm: 4,
    depth_mm: 8,
    default_offset_mm: 10,
    default_face: "back",
    allow_stopped: false,
    default_start_offset_mm: 0,
    default_end_offset_mm: 0,
    usage_count: 234,
    is_active: true,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-g2",
    organization_id: "demo-org-id",
    profile_id: "drawer-bottom",
    name: "Drawer Bottom Groove",
    purpose: "drawer_bottom",
    description: "Groove for 6mm drawer bottoms",
    width_mm: 6.5,
    depth_mm: 10,
    default_offset_mm: 12,
    default_face: "back",
    allow_stopped: false,
    default_start_offset_mm: 0,
    default_end_offset_mm: 0,
    usage_count: 178,
    is_active: true,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In demo mode, return mock data
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (isDemoMode) {
      const { searchParams } = new URL(request.url);
      const purpose = searchParams.get("purpose");
      
      let profiles = [...DEMO_PROFILES];
      if (purpose) {
        profiles = profiles.filter(p => p.purpose === purpose);
      }
      
      return NextResponse.json({
        profiles,
        total: profiles.length,
      });
    }

    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose") || undefined;
    const activeOnly = searchParams.get("active") !== "all";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;

    let query = supabase
      .from("groove_profiles")
      .select("*", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("usage_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (purpose) {
      query = query.eq("purpose", purpose);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: profiles, error, count } = await query;

    if (error) {
      console.error("Error fetching groove profiles:", error);
      return NextResponse.json(
        { error: "Failed to fetch groove profiles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profiles: profiles || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching groove profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch groove profiles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json() as GrooveProfileInput;

    if (!body.profile_id || !body.name || body.width_mm === undefined || body.depth_mm === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, name, width_mm, depth_mm" },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from("groove_profiles")
      .insert({
        organization_id: userData.organization_id,
        profile_id: body.profile_id,
        name: body.name,
        description: body.description,
        width_mm: body.width_mm,
        depth_mm: body.depth_mm,
        purpose: body.purpose,
        default_offset_mm: body.default_offset_mm ?? 10,
        default_face: body.default_face ?? "back",
        allow_stopped: body.allow_stopped ?? true,
        default_start_offset_mm: body.default_start_offset_mm ?? 0,
        default_end_offset_mm: body.default_end_offset_mm ?? 0,
        tool_dia_mm: body.tool_dia_mm,
        tool_id: body.tool_id,
        feed_rate: body.feed_rate,
        is_active: body.is_active ?? true,
        metadata: body.metadata,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A profile with this ID already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating groove profile:", error);
      return NextResponse.json(
        { error: "Failed to create groove profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating groove profile:", error);
    return NextResponse.json(
      { error: "Failed to create groove profile" },
      { status: 500 }
    );
  }
}
