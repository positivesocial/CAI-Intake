/**
 * CAI Intake - Organization Branding API
 * 
 * GET /api/v1/organizations/branding - Get current org branding
 * PUT /api/v1/organizations/branding - Update org branding
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
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
      logger.debug("Branding: No user found");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    logger.debug("Branding: User authenticated", { userId: user.id });

    // Use service client to bypass RLS for organization data
    const serviceClient = getServiceClient();

    // Get user's organization - check demo mode first
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let organizationId: string | undefined = undefined;
    let userRole: string = "operator";

    if (isDemoMode) {
      // In demo mode, use the org ID from user metadata
      organizationId = user.user_metadata?.organization_id || "demo-org-id";
      userRole = "org_admin";
    } else {
      // First get user data
      logger.debug("Branding: Looking up user", { userId: user.id });
      
      const { data: userData, error: userError } = await serviceClient
        .from("users")
        .select("organization_id, is_super_admin, role_id")
        .eq("id", user.id)
        .single();

      if (userError) {
        logger.error("Branding: User lookup failed", userError, {
          userId: user.id,
          code: userError.code,
        });
        return NextResponse.json(
          { success: false, error: "User lookup failed" },
          { status: 500 }
        );
      }
      
      if (!userData?.organization_id && !userData?.is_super_admin) {
        logger.warn("User has no organization", {
          userId: user.id,
          userData,
        });
        return NextResponse.json(
          { success: false, error: "Organization not found" },
          { status: 404 }
        );
      }
      
      logger.debug("Branding: Found user org", { organizationId: userData.organization_id });
      organizationId = userData.organization_id;
      
      // Get role name separately if we have a role_id
      if (userData.is_super_admin) {
        userRole = "super_admin";
      } else if (userData.role_id) {
        const { data: roleData } = await serviceClient
          .from("roles")
          .select("name")
          .eq("id", userData.role_id)
          .single();
        userRole = roleData?.name || "viewer";
      } else {
        userRole = "viewer";
      }
    }

    // Get organization branding
    logger.debug("Branding: Fetching org branding", { organizationId });
    
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("id, name, branding")
      .eq("id", organizationId)
      .single();
    
    logger.debug("Branding: Query result", { 
      hasData: !!org,
      hasError: !!orgError,
      errorCode: orgError?.code,
    });

    if (orgError) {
      // If branding column doesn't exist (PostgreSQL error 42703 or message mentions column)
      // Return defaults without logging as error - this is expected during migration
      if (orgError.code === "42703" || orgError.code === "PGRST204" || 
          orgError.message?.includes("column") || orgError.message?.includes("branding")) {
        logger.debug("Branding column not found, returning defaults", { organizationId });
        return NextResponse.json({
          success: true,
          branding: {},
        });
      }
      
      // If organization not found
      if (orgError.code === "PGRST116") {
        logger.debug("Organization not found for branding", { organizationId });
        return NextResponse.json({
          success: true,
          branding: {},
        });
      }
      
      // Only log as error for unexpected issues
      logger.error("Failed to get org branding", orgError, {
        code: orgError.code,
        details: orgError.details,
        hint: orgError.hint,
        organizationId,
      });
      
      return NextResponse.json(
        { success: false, error: "Failed to get branding" },
        { status: 500 }
      );
    }

    // Build branding with defaults
    const branding = org?.branding || {};
    
    // If no company_name in branding, use org name
    if (!branding.company_name && org?.name) {
      branding.company_name = org.name;
    }

    return NextResponse.json({
      success: true,
      branding,
    });

  } catch (error) {
    // Log with proper error handling
    const errorDetails = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
    
    logger.error("Branding GET error", error, { errorDetails });
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

    // Use service client to bypass RLS for organization data
    const serviceClient = getServiceClient();

    // Get user's organization and check permissions - check demo mode first
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let organizationId: string | undefined = undefined;
    let userRole: string = "operator";

    if (isDemoMode) {
      // In demo mode, use the org ID from user metadata
      organizationId = user.user_metadata?.organization_id || "demo-org-id";
      userRole = "org_admin";
    } else {
      // First get user data
      const { data: userData, error: userError } = await serviceClient
        .from("users")
        .select("organization_id, is_super_admin, role_id")
        .eq("id", user.id)
        .single();

      if (userError || (!userData?.organization_id && !userData?.is_super_admin)) {
        return NextResponse.json(
          { success: false, error: "Organization not found" },
          { status: 404 }
        );
      }
      
      organizationId = userData.organization_id;
      
      // Get role name separately if we have a role_id
      if (userData.is_super_admin) {
        userRole = "super_admin";
      } else if (userData.role_id) {
        const { data: roleData } = await serviceClient
          .from("roles")
          .select("name")
          .eq("id", userData.role_id)
          .single();
        userRole = roleData?.name || "viewer";
      } else {
        userRole = "viewer";
      }
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
    const { error: updateError } = await serviceClient
      .from("organizations")
      .update({ branding: parseResult.data })
      .eq("id", organizationId);

    if (updateError) {
      logger.error("Failed to update org branding", { error: updateError.message });
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


