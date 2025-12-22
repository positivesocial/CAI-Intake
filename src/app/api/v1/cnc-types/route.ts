/**
 * CAI Intake API - CNC Operation Types
 * 
 * GET /api/v1/cnc-types - List organization's CNC operation types
 * POST /api/v1/cnc-types - Create a new CNC operation type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Validation schema
const CreateCncTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  op_type: z.enum(["pocket", "profile", "drill", "engrave", "cutout", "custom"]).optional(),
  default_params: z.record(z.string(), z.unknown()).optional().default({}),
  profile_id: z.string().optional(),
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
    const opType = searchParams.get("op_type");

    let query = supabase
      .from("cnc_operation_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("code", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (opType) {
      query = query.eq("op_type", opType);
    }

    const { data: types, error } = await query;

    if (error) {
      logger.error("Failed to fetch CNC operation types", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch CNC operation types" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      types: types || [],
      count: types?.length || 0,
    });
  } catch (error) {
    logger.error("CNC types GET error", error);
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
    const parseResult = CreateCncTypeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Create CNC operation type
    const { data: cncType, error } = await supabase
      .from("cnc_operation_types")
      .insert({
        organization_id: userData.organization_id,
        code: input.code.toUpperCase(),
        name: input.name,
        op_type: input.op_type,
        default_params: input.default_params,
        profile_id: input.profile_id,
        description: input.description,
        is_active: input.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A CNC operation type with this code already exists" },
          { status: 409 }
        );
      }
      logger.error("Failed to create CNC operation type", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to create CNC operation type" },
        { status: 500 }
      );
    }

    return NextResponse.json({ type: cncType }, { status: 201 });
  } catch (error) {
    logger.error("CNC types POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

