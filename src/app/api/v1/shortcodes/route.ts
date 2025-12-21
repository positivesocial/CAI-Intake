/**
 * API Routes for Shortcode Configurations
 * 
 * GET  /api/v1/shortcodes - List shortcodes for organization
 * POST /api/v1/shortcodes - Create a new shortcode
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser, getClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { sanitizeInput } from "@/lib/security";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

// ============================================================
// VALIDATION
// ============================================================

const ServiceTypeSchema = z.enum(["edgebanding", "grooves", "holes", "cnc"]);

const ShortcodeInputSchema = z.object({
  shortcode: z.string().min(1).max(20),
  display_name: z.string().min(1).max(100),
  service_type: ServiceTypeSchema,
  default_specs: z.record(z.string(), z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

// ============================================================
// GET - List shortcodes
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getClient();
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get("service_type");
    const activeOnly = searchParams.get("active") !== "all";

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    let query = supabase
      .from("shortcode_configs")
      .select("*")
      .eq("org_id", profile.organization_id)
      .order("shortcode", { ascending: true });

    if (serviceType) {
      query = query.eq("service_type", serviceType);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch shortcodes", { error });
      return NextResponse.json(
        { error: "Failed to fetch shortcodes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ configs: data || [] });
  } catch (error) {
    logger.error("Shortcodes GET error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - Create shortcode
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getClient();

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = ShortcodeInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Sanitize inputs
    const sanitizedShortcode = sanitizeInput(input.shortcode, 20);
    const sanitizedDisplayName = sanitizeInput(input.display_name, 100);

    if (!sanitizedShortcode || !sanitizedDisplayName) {
      return NextResponse.json(
        { error: "Invalid characters in input" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("shortcode_configs")
      .select("id")
      .eq("org_id", profile.organization_id)
      .eq("service_type", input.service_type)
      .eq("shortcode", sanitizedShortcode.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Shortcode already exists for this service type" },
        { status: 409 }
      );
    }

    // Check limit
    const { count } = await supabase
      .from("shortcode_configs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", profile.organization_id);

    if ((count || 0) >= 200) {
      return NextResponse.json(
        { error: "Maximum shortcode limit reached (200)" },
        { status: 400 }
      );
    }

    // Create shortcode
    const { data: config, error: insertError } = await supabase
      .from("shortcode_configs")
      .insert({
        org_id: profile.organization_id,
        service_type: input.service_type,
        shortcode: sanitizedShortcode.toUpperCase(),
        display_name: sanitizedDisplayName,
        default_specs: input.default_specs,
        is_active: input.is_active,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create shortcode", { error: insertError });
      return NextResponse.json(
        { error: "Failed to create shortcode" },
        { status: 500 }
      );
    }

    // Audit log
    await logAudit({
      action: AUDIT_ACTIONS.CREATE,
      resource_type: "shortcode_config",
      resource_id: config.id,
      user_id: user.id,
      organization_id: profile.organization_id,
      details: { shortcode: config.shortcode, service_type: config.service_type },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    logger.error("Shortcodes POST error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
