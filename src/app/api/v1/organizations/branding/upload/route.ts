/**
 * CAI Intake - Logo Upload API
 * 
 * POST /api/v1/organizations/branding/upload - Upload org logo
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get user's organization and check permissions
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let organizationId: string | null = null;
    let userRole: string = "operator";

    if (isDemoMode) {
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

    // Only admins can upload logos
    if (!["admin", "org_admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const variant = formData.get("variant") as string || "light";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: PNG, JPG, SVG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum 2MB allowed" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const filename = `${organizationId}/logo-${variant}-${Date.now()}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("org-assets")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logger.error("Failed to upload logo:", uploadError);
      
      // If bucket doesn't exist, provide helpful error
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Storage not configured. Please create 'org-assets' bucket in Supabase." 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("org-assets")
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    // Update branding with new logo URL
    const brandingField = variant === "dark" ? "logo_dark_url" : "logo_url";
    
    // First get current branding
    const { data: org } = await supabase
      .from("organizations")
      .select("branding")
      .eq("id", organizationId)
      .single();

    const currentBranding = org?.branding || {};
    const updatedBranding = {
      ...currentBranding,
      [brandingField]: publicUrl,
    };

    // Update organization
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ branding: updatedBranding })
      .eq("id", organizationId);

    if (updateError) {
      logger.error("Failed to update branding with logo URL:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save logo URL" },
        { status: 500 }
      );
    }

    logger.info("Logo uploaded successfully", {
      org_id: organizationId,
      variant,
      filename,
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      variant,
    });

  } catch (error) {
    logger.error("Logo upload error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


