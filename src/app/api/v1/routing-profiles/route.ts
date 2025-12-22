/**
 * CAI Intake API - Routing Profiles
 * 
 * GET /api/v1/routing-profiles - List routing profiles
 * POST /api/v1/routing-profiles - Create routing profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import type { RoutingProfileInput } from "@/lib/operations/types";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const profileType = searchParams.get("type") || undefined;
    const activeOnly = searchParams.get("active") !== "all";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;

    let query = supabase
      .from("routing_profiles")
      .select("*", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("usage_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (profileType) {
      query = query.eq("profile_type", profileType);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: profiles, error, count } = await query;

    if (error) {
      console.error("Error fetching routing profiles:", error);
      return NextResponse.json(
        { error: "Failed to fetch routing profiles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profiles: profiles || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching routing profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch routing profiles" },
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

    const body = await request.json() as RoutingProfileInput;

    if (!body.profile_id || !body.name || !body.profile_type) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, name, profile_type" },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from("routing_profiles")
      .insert({
        organization_id: userData.organization_id,
        profile_id: body.profile_id,
        name: body.name,
        description: body.description,
        profile_type: body.profile_type,
        specifications: body.specifications || {},
        tool_dia_mm: body.tool_dia_mm,
        tool_id: body.tool_id,
        tool_type: body.tool_type,
        feed_rate: body.feed_rate,
        plunge_rate: body.plunge_rate,
        spindle_speed: body.spindle_speed,
        step_down_mm: body.step_down_mm,
        dxf_layer: body.dxf_layer,
        gcode_template: body.gcode_template,
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
      console.error("Error creating routing profile:", error);
      return NextResponse.json(
        { error: "Failed to create routing profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating routing profile:", error);
    return NextResponse.json(
      { error: "Failed to create routing profile" },
      { status: 500 }
    );
  }
}
