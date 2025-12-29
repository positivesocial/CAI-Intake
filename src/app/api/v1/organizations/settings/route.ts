/**
 * CAI Intake - Organization Settings API
 * 
 * GET /api/v1/organizations/settings - Get organization settings
 * PATCH /api/v1/organizations/settings - Update organization settings
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Settings schema
const settingsSchema = z.object({
  // General
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  date_format: z.string().optional(),
  default_units: z.enum(["mm", "cm", "inches"]).optional(),
  
  // Cutlist defaults
  default_thickness_mm: z.number().min(1).max(100).optional(),
  default_grain: z.enum(["none", "along_L"]).optional(),
  auto_optimize: z.boolean().optional(),
  
  // Capabilities
  enable_edging: z.boolean().optional(),
  enable_grooves: z.boolean().optional(),
  enable_cnc_holes: z.boolean().optional(),
  enable_cnc_routing: z.boolean().optional(),
  
  // Branding
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logo_url: z.string().url().optional(),
  
  // Integrations
  webhook_url: z.string().url().or(z.literal("")).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    
    // Get user's organization
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get organization with settings
    const { data: org, error } = await serviceClient
      .from("organizations")
      .select(`
        id,
        name,
        slug,
        timezone,
        date_format,
        default_units,
        default_thickness_mm,
        default_grain,
        auto_optimize,
        enable_edging,
        enable_grooves,
        enable_cnc_holes,
        enable_cnc_routing,
        primary_color,
        logo_url,
        webhook_url,
        created_at
      `)
      .eq("id", profile.organization_id)
      .single();

    if (error) {
      // If columns don't exist, return defaults
      if (error.code === "42703") {
        return NextResponse.json({
          settings: {
            name: "Organization",
            timezone: "America/New_York",
            date_format: "YYYY-MM-DD",
            default_units: "mm",
            default_thickness_mm: 18,
            default_grain: "none",
            auto_optimize: false,
            enable_edging: true,
            enable_grooves: false,
            enable_cnc_holes: false,
            enable_cnc_routing: false,
            primary_color: "#0D9488",
            logo_url: null,
            webhook_url: "",
          },
        });
      }
      throw error;
    }

    return NextResponse.json({ settings: org });

  } catch (error) {
    logger.error("Get organization settings error", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    
    // Get user's organization and verify admin role
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Parse and validate settings
    const body = await request.json();
    const result = settingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid settings", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Update organization
    const { data: org, error } = await serviceClient
      .from("organizations")
      .update(result.data)
      .eq("id", profile.organization_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Organization settings updated", {
      orgId: profile.organization_id,
      by: user.id,
      changes: Object.keys(result.data),
    });

    return NextResponse.json({
      success: true,
      settings: org,
    });

  } catch (error) {
    logger.error("Update organization settings error", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

