/**
 * API Routes for Shortcode Configurations
 * 
 * GET  /api/v1/shortcodes - List shortcodes for organization
 * POST /api/v1/shortcodes - Create a new shortcode
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sanitizeInput } from "@/lib/security";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { getRoleName, type RoleJoin } from "@/lib/utils/role-helpers";

// ============================================================
// VALIDATION
// ============================================================

// Match the DB constraint: 'edgeband', 'groove', 'hole', 'cnc', 'material', 'custom'
const ServiceTypeSchema = z.enum(["edgeband", "groove", "hole", "cnc", "material", "custom"]);

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

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get user's organization and role
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, is_super_admin, role:roles(name)")
      .eq("id", user.id)
      .single();

    // Extract role name safely
    const roleName = getRoleName(userData?.role as RoleJoin);
    const isSuperAdmin = userData?.is_super_admin === true;

    // Determine organization to query
    let organizationId = userData?.organization_id;
    
    // Super admins can optionally query specific org via query param
    if (isSuperAdmin && searchParams.get("org_id")) {
      organizationId = searchParams.get("org_id");
    }

    // Non-super-admins must have an organization
    if (!organizationId && !isSuperAdmin) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    // If no organization context at all, return empty
    if (!organizationId) {
      return NextResponse.json({ configs: [] });
    }

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

    const supabase = await createClient();

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
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
      .eq("org_id", userData.organization_id)
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
      .eq("org_id", userData.organization_id);

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
        org_id: userData.organization_id,
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
      organizationId: userData.organization_id,
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
