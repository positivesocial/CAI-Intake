/**
 * CAI Intake API - Hole Patterns
 * 
 * GET /api/v1/hole-patterns - List hole patterns
 * POST /api/v1/hole-patterns - Create hole pattern
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import type { HolePatternInput } from "@/lib/operations/types";

// Demo data for development/testing - matches HolePattern type
const DEMO_PATTERNS = [
  {
    pattern_id: "sys32-shelf",
    organization_id: "demo-org-id",
    name: "System 32 Shelf Pins",
    kind: "shelf_pin",
    description: "Standard 32mm system holes for adjustable shelves",
    holes: [
      { x_mm: 0, y_mm: 37, diameter_mm: 5, depth_mm: 13 },
      { x_mm: 0, y_mm: 69, diameter_mm: 5, depth_mm: 13 },
      { x_mm: 0, y_mm: 101, diameter_mm: 5, depth_mm: 13 },
    ],
    ref_edge: "bottom",
    usage_count: 156,
    is_active: true,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    pattern_id: "blum-hinge-35",
    organization_id: "demo-org-id",
    name: "Blum Hinge 35mm",
    kind: "hinge",
    description: "35mm cup hole for Blum clip-top hinges",
    holes: [
      { x_mm: 22, y_mm: 0, diameter_mm: 35, depth_mm: 13 },
    ],
    ref_edge: "top",
    hardware_brand: "Blum",
    hardware_model: "Clip-Top",
    usage_count: 89,
    is_active: true,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    pattern_id: "cam-lock-15",
    organization_id: "demo-org-id",
    name: "Cam Lock 15mm",
    kind: "cam_lock",
    description: "15mm hole for cam lock fasteners",
    holes: [
      { x_mm: 34, y_mm: 8, diameter_mm: 15, depth_mm: 12.5 },
    ],
    ref_edge: "top",
    usage_count: 67,
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
      const kind = searchParams.get("kind");
      
      let patterns = [...DEMO_PATTERNS];
      if (kind) {
        patterns = patterns.filter(p => p.kind === kind);
      }
      
      return NextResponse.json({
        patterns,
        total: patterns.length,
      });
    }

    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") || undefined;
    const activeOnly = searchParams.get("active") !== "all";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;

    let query = supabase
      .from("hole_patterns")
      .select("*", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("usage_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (kind) {
      query = query.eq("kind", kind);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: patterns, error, count } = await query;

    if (error) {
      console.error("Error fetching hole patterns:", error);
      return NextResponse.json(
        { error: "Failed to fetch hole patterns" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patterns: patterns || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching hole patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch hole patterns" },
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

    // Get user's organization
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

    const body = await request.json() as HolePatternInput;

    // Validate required fields
    if (!body.pattern_id || !body.name || !body.kind) {
      return NextResponse.json(
        { error: "Missing required fields: pattern_id, name, kind" },
        { status: 400 }
      );
    }

    const { data: pattern, error } = await supabase
      .from("hole_patterns")
      .insert({
        organization_id: userData.organization_id,
        pattern_id: body.pattern_id,
        name: body.name,
        description: body.description,
        kind: body.kind,
        holes: body.holes || [],
        ref_edge: body.ref_edge,
        ref_corner: body.ref_corner,
        parametric_config: body.parametric_config,
        hardware_id: body.hardware_id,
        hardware_brand: body.hardware_brand,
        hardware_model: body.hardware_model,
        is_active: body.is_active ?? true,
        metadata: body.metadata,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A pattern with this ID already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating hole pattern:", error);
      return NextResponse.json(
        { error: "Failed to create hole pattern" },
        { status: 500 }
      );
    }

    return NextResponse.json(pattern, { status: 201 });
  } catch (error) {
    console.error("Error creating hole pattern:", error);
    return NextResponse.json(
      { error: "Failed to create hole pattern" },
      { status: 500 }
    );
  }
}
