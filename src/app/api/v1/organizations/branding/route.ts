/**
 * CAI Intake - Organization Branding API
 * 
 * GET /api/v1/organizations/branding - Get current org branding
 * PUT /api/v1/organizations/branding - Update org branding
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

// ============================================================
// VALIDATION
// ============================================================

const BrandingSchema = z.object({
  logo_url: z.string().url().optional().nullable(),
  logo_dark_url: z.string().url().optional().nullable(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  company_name: z.string().max(200).optional(),
  company_tagline: z.string().max(500).optional().nullable(),
  contact_info: z.object({
    phone: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    website: z.string().url().optional().nullable(),
  }).optional(),
  template_settings: z.object({
    header_text: z.string().max(500).optional().nullable(),
    footer_text: z.string().max(1000).optional(),
    include_logo: z.boolean().optional(),
    include_qr_code: z.boolean().optional(),
    qr_style: z.enum(["standard", "rounded", "dots"]).optional(),
    page_size: z.enum(["A4", "Letter", "A3"]).optional(),
    orientation: z.enum(["portrait", "landscape"]).optional(),
  }).optional(),
  pdf_theme: z.object({
    font_family: z.string().max(50).optional(),
    heading_size: z.number().min(8).max(32).optional(),
    body_size: z.number().min(6).max(20).optional(),
    table_style: z.enum(["bordered", "striped", "minimal"]).optional(),
  }).optional(),
});

// ============================================================
// GET - Get organization branding
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get user's organization - check demo mode first
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let organizationId: string | null = null;
    let userRole: string = "operator";

    if (isDemoMode) {
      // In demo mode, use the org ID from user metadata
      organizationId = user.user_metadata?.organization_id || "demo-org-id";
      userRole = "org_admin";
    } else {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (userError || !userData?.organization_id) {
        return NextResponse.json(
          { success: false, error: "Organization not found" },
          { status: 404 }
        );
      }
      organizationId = userData.organization_id;
      userRole = userData.role;
    }

    // Get organization branding
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("branding")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      logger.error("Failed to get org branding:", orgError);
      return NextResponse.json(
        { success: false, error: "Failed to get branding" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      branding: org?.branding || {},
    });

  } catch (error) {
    logger.error("Branding GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT - Update organization branding
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get user's organization and check permissions - check demo mode first
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let organizationId: string | null = null;
    let userRole: string = "operator";

    if (isDemoMode) {
      // In demo mode, use the org ID from user metadata
      organizationId = user.user_metadata?.organization_id || "demo-org-id";
      userRole = "org_admin";
    } else {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (userError || !userData?.organization_id) {
        return NextResponse.json(
          { success: false, error: "Organization not found" },
          { status: 404 }
        );
      }
      organizationId = userData.organization_id;
      userRole = userData.role;
    }

    // Only admins can update branding
    if (!["admin", "org_admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = BrandingSchema.safeParse(body.branding);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid branding data", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // Update branding
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ branding: parseResult.data })
      .eq("id", organizationId);

    if (updateError) {
      logger.error("Failed to update org branding:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update branding" },
        { status: 500 }
      );
    }

    logger.info("Organization branding updated", {
      org_id: organizationId,
      user_id: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Branding updated successfully",
    });

  } catch (error) {
    logger.error("Branding PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


