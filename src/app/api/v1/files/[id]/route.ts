/**
 * CAI Intake - Single File API
 * 
 * GET /api/v1/files/[id] - Get file details and download URL
 * DELETE /api/v1/files/[id] - Delete a file
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/files/[id]
 * Get file details and signed download URL
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the file
    const file = await prisma.uploadedFile.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Verify user has access (belongs to same organization)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin && file.organizationId !== dbUser?.organizationId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Determine bucket based on file kind
    const bucket = file.kind === "template_scan" ? "templates" : "cutlist-files";

    // Get signed URL
    const { data: urlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file.storagePath, 3600); // 1 hour expiry

    return NextResponse.json({
      file: {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.sizeBytes,
        kind: file.kind,
        url: urlData?.signedUrl,
        organization: file.organization,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json(
      { error: "Failed to get file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/files/[id]
 * Delete a file from storage and database
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the file
    const file = await prisma.uploadedFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Verify user has access (belongs to same organization)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true, role: { select: { name: true } } },
    });

    if (!dbUser?.isSuperAdmin && file.organizationId !== dbUser?.organizationId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Only admins can delete files
    if (!dbUser?.isSuperAdmin && !["org_admin", "manager"].includes(dbUser?.role?.name || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete files" },
        { status: 403 }
      );
    }

    // Determine bucket based on file kind
    const bucket = file.kind === "template_scan" ? "templates" : "cutlist-files";

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([file.storagePath]);

    if (storageError) {
      console.error("Supabase storage delete error:", storageError);
      // Continue with DB deletion even if storage delete fails
    }

    // Delete from database
    await prisma.uploadedFile.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
