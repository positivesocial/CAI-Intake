/**
 * CAI Intake API - Hole Types
 * 
 * GET /api/v1/hole-types - List organization's hole types
 * POST /api/v1/hole-types - Create a new hole type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Validation schema
const CreateHoleTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  diameter_mm: z.number().positive().optional(),
  depth_mm: z.number().positive().optional(),
  spacing_mm: z.number().positive().optional(),
  pattern_id: z.string().optional(),
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
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("hole_types")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .order("code", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: types, error } = await query;

    if (error) {
      logger.error("Failed to fetch hole types", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch hole types" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      types: types || [],
      count: types?.length || 0,
    });
  } catch (error) {
    logger.error("Hole types GET error", error);
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

    // Check permission
    if (!["super_admin", "org_admin", "admin", "manager"].includes(userData.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = CreateHoleTypeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Create hole type
    const { data: holeType, error } = await supabase
      .from("hole_types")
      .insert({
        organization_id: userData.organization_id,
        code: input.code.toUpperCase(),
        name: input.name,
        diameter_mm: input.diameter_mm,
        depth_mm: input.depth_mm,
        spacing_mm: input.spacing_mm,
        pattern_id: input.pattern_id,
        description: input.description,
        is_active: input.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A hole type with this code already exists" },
          { status: 409 }
        );
      }
      logger.error("Failed to create hole type", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to create hole type" },
        { status: 500 }
      );
    }

    return NextResponse.json({ type: holeType }, { status: 201 });
  } catch (error) {
    logger.error("Hole types POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

