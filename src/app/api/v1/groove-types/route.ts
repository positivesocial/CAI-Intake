/**
 * CAI Intake API - Groove Types
 * 
 * GET /api/v1/groove-types - List organization's groove types
 * POST /api/v1/groove-types - Create a new groove type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Validation schema
const CreateGrooveTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  default_width_mm: z.number().positive().optional(),
  default_depth_mm: z.number().positive().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get user's organization and role
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    // Determine organization to query
    let organizationId = userData?.organization_id;
    
    // Super admins can optionally query specific org via query param
    if (userData?.role === "super_admin" && searchParams.get("org_id")) {
      organizationId = searchParams.get("org_id");
    }

    // Non-super-admins must have an organization
    if (!organizationId && userData?.role !== "super_admin") {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // If no organization context at all, return empty
    if (!organizationId) {
      return NextResponse.json({ types: [], count: 0 });
    }

    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("groove_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("code", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: types, error } = await query;

    if (error) {
      logger.error("Failed to fetch groove types", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch groove types" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      types: types || [],
      count: types?.length || 0,
    });
  } catch (error) {
    logger.error("Groove types GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get user's organization and role
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

    // Check permission - roles from user_role enum
    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = CreateGrooveTypeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Create groove type
    const { data: grooveType, error } = await supabase
      .from("groove_types")
      .insert({
        organization_id: userData.organization_id,
        code: input.code.toUpperCase(),
        name: input.name,
        default_width_mm: input.default_width_mm,
        default_depth_mm: input.default_depth_mm,
        description: input.description,
        is_active: input.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A groove type with this code already exists" },
          { status: 409 }
        );
      }
      logger.error("Failed to create groove type", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to create groove type" },
        { status: 500 }
      );
    }

    return NextResponse.json({ type: grooveType }, { status: 201 });
  } catch (error) {
    logger.error("Groove types POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

