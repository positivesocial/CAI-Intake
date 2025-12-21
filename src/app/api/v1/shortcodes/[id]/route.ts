/**
 * API Routes for Single Shortcode Configuration
 * 
 * GET    /api/v1/shortcodes/[id] - Get a single shortcode
 * PUT    /api/v1/shortcodes/[id] - Update a shortcode
 * DELETE /api/v1/shortcodes/[id] - Delete a shortcode
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser, getClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { sanitizeInput, isValidUuid } from "@/lib/security";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

// ============================================================
// VALIDATION
// ============================================================

const ServiceTypeSchema = z.enum(["edgebanding", "grooves", "holes", "cnc"]);

const ShortcodeUpdateSchema = z.object({
  shortcode: z.string().min(1).max(20).optional(),
  display_name: z.string().min(1).max(100).optional(),
  service_type: ServiceTypeSchema.optional(),
  default_specs: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// ============================================================
// GET - Get single shortcode
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
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

    const { data: config, error } = await supabase
      .from("shortcode_configs")
      .select("*")
      .eq("id", id)
      .eq("org_id", profile.organization_id)
      .single();

    if (error || !config) {
      return NextResponse.json(
        { error: "Shortcode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ config });
  } catch (error) {
    logger.error("Shortcode GET error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT - Update shortcode
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("shortcode_configs")
      .select("id")
      .eq("id", id)
      .eq("org_id", profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Shortcode not found" },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = ShortcodeUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.shortcode !== undefined) {
      const sanitized = sanitizeInput(input.shortcode, 20);
      if (!sanitized) {
        return NextResponse.json(
          { error: "Invalid characters in shortcode" },
          { status: 400 }
        );
      }
      updateData.shortcode = sanitized.toUpperCase();
    }
    if (input.display_name !== undefined) {
      const sanitized = sanitizeInput(input.display_name, 100);
      if (!sanitized) {
        return NextResponse.json(
          { error: "Invalid characters in display name" },
          { status: 400 }
        );
      }
      updateData.display_name = sanitized;
    }
    if (input.service_type !== undefined) {
      updateData.service_type = input.service_type;
    }
    if (input.default_specs !== undefined) {
      updateData.default_specs = input.default_specs;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update
    const { data: config, error: updateError } = await supabase
      .from("shortcode_configs")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", profile.organization_id)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to update shortcode", { error: updateError });
      return NextResponse.json(
        { error: "Failed to update shortcode" },
        { status: 500 }
      );
    }

    // Audit log
    await logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      resource_type: "shortcode_config",
      resource_id: id,
      user_id: user.id,
      organization_id: profile.organization_id,
      details: { changes: Object.keys(input) },
    });

    return NextResponse.json({ config });
  } catch (error) {
    logger.error("Shortcode PUT error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE - Delete shortcode
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
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

    // Verify ownership and get shortcode for audit
    const { data: existing } = await supabase
      .from("shortcode_configs")
      .select("shortcode, service_type")
      .eq("id", id)
      .eq("org_id", profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Shortcode not found" },
        { status: 404 }
      );
    }

    // Delete
    const { error: deleteError } = await supabase
      .from("shortcode_configs")
      .delete()
      .eq("id", id)
      .eq("org_id", profile.organization_id);

    if (deleteError) {
      logger.error("Failed to delete shortcode", { error: deleteError });
      return NextResponse.json(
        { error: "Failed to delete shortcode" },
        { status: 500 }
      );
    }

    // Audit log
    await logAudit({
      action: AUDIT_ACTIONS.DELETE,
      resource_type: "shortcode_config",
      resource_id: id,
      user_id: user.id,
      organization_id: profile.organization_id,
      details: { shortcode: existing.shortcode, service_type: existing.service_type },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Shortcode DELETE error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
