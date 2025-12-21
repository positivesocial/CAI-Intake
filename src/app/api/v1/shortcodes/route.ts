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
// TYPES
// ============================================================

interface ProfileData {
  organization_id: string | null;
}

// ============================================================
// DEMO DATA
// ============================================================

const DEMO_SHORTCODES = [
  {
    id: "demo-sc1",
    org_id: "demo-org-id",
    shortcode: "L2",
    display_name: "2mm ABS White",
    service_type: "edgebanding",
    default_specs: { thickness_mm: 2, material: "ABS", color: "White" },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-sc2",
    org_id: "demo-org-id",
    shortcode: "L1",
    display_name: "1mm PVC Oak",
    service_type: "edgebanding",
    default_specs: { thickness_mm: 1, material: "PVC", color: "Oak" },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-sc3",
    org_id: "demo-org-id",
    shortcode: "S32",
    display_name: "System 32 Holes",
    service_type: "holes",
    default_specs: { diameter_mm: 5, depth_mm: 13, spacing_mm: 32 },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-sc4",
    org_id: "demo-org-id",
    shortcode: "BP",
    display_name: "Back Panel Groove",
    service_type: "grooves",
    default_specs: { width_mm: 4, depth_mm: 8 },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
// HELPERS
// ============================================================

async function getOrgId(supabase: ReturnType<typeof getClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  
  return (data as ProfileData | null)?.organization_id ?? null;
}

// ============================================================
// GET - List shortcodes
// ============================================================

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
      const serviceType = searchParams.get("service_type");
      
      let shortcodes = [...DEMO_SHORTCODES];
      if (serviceType) {
        shortcodes = shortcodes.filter(s => s.service_type === serviceType);
      }
      
      return NextResponse.json({
        shortcodes,
        total: shortcodes.length,
      });
    }

    const supabase = getClient();
    const organizationId = await getOrgId(supabase, user.id);

    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get("service_type");
    const activeOnly = searchParams.get("active") !== "all";

    let query = supabase
      .from("shortcode_configs")
      .select("*")
      .eq("org_id", organizationId)
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
    const organizationId = await getOrgId(supabase, user.id);

    if (!organizationId) {
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
      .eq("org_id", organizationId)
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
      .eq("org_id", organizationId);

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
        org_id: organizationId,
        service_type: input.service_type,
        shortcode: sanitizedShortcode.toUpperCase(),
        display_name: sanitizedDisplayName,
        default_specs: input.default_specs,
        is_active: input.is_active,
      } as never)
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
    const configData = config as { id?: string; shortcode?: string; service_type?: string };
    await logAudit({
      action: AUDIT_ACTIONS.SHORTCODE_CREATED,
      entityType: "shortcode_config",
      entityId: configData.id || "",
      userId: user.id,
      organizationId: organizationId,
      metadata: { shortcode: configData.shortcode, service_type: configData.service_type },
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
