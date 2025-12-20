/**
 * CAI Intake - Files API
 * 
 * POST /api/v1/files - Upload a file
 * GET /api/v1/files - List uploaded files
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || "50") * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

// =============================================================================
// SCHEMAS
// =============================================================================

const ListFilesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum(["cutlist_source", "template_scan", "voice_audio", "all"]).default("all"),
});

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/files
 * List uploaded files with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const params = ListFilesSchema.parse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      kind: searchParams.get("kind") || "all",
    });

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    // Build where clause - UploadedFile doesn't have uploadedById, only organizationId
    if (!dbUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const where: { organizationId: string; kind?: string } = {
      organizationId: dbUser.organizationId,
    };

    if (params.kind !== "all") {
      where.kind = params.kind;
    }

    // Count total
    const total = await prisma.uploadedFile.count({ where });

    // Fetch page
    const files = await prisma.uploadedFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        kind: true,
        storagePath: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      files: files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.sizeBytes,
        kind: f.kind,
        createdAt: f.createdAt,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    console.error("List files error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/files
 * Upload a file to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileKind = (formData.get("kind") as string) || "cutlist_source";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    if (!dbUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}-${safeOriginalName}`;

    // Determine bucket based on file kind
    const bucket = fileKind === "template_scan" ? "templates" : "cutlist-files";
    const storagePath = `${dbUser.organizationId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Create file record in database
    const fileRecord = await prisma.uploadedFile.create({
      data: {
        fileName,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: uploadData.path,
        kind: fileKind,
        organizationId: dbUser.organizationId,
      },
    });

    // Get signed URL for the file
    const { data: urlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(uploadData.path, 3600); // 1 hour expiry

    return NextResponse.json({
      file: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.sizeBytes,
        kind: fileRecord.kind,
        url: urlData?.signedUrl,
        createdAt: fileRecord.createdAt,
      },
      message: "File uploaded successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Upload file error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
