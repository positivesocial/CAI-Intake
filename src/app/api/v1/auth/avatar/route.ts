/**
 * CAI Intake - Avatar Upload API
 * 
 * POST /api/v1/auth/avatar - Upload user avatar
 * DELETE /api/v1/auth/avatar - Remove user avatar
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * POST /api/v1/auth/avatar - Upload user avatar
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, GIF, or WebP image." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    // Get Supabase client for storage
    const supabase = await createClient();

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatars/${authUser.id}/${Date.now()}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Delete old avatar if exists
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { avatar: true },
    });

    if (existingUser?.avatar) {
      // Extract path from URL and delete
      const oldPath = existingUser.avatar.split("/").slice(-2).join("/");
      if (oldPath.startsWith("avatars/")) {
        await supabase.storage
          .from("user-files")
          .remove([oldPath]);
      }
    }

    // Upload new avatar
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("user-files")
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Update user in database
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        avatar: avatarUrl,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      avatar: avatarUrl,
      message: "Avatar uploaded successfully",
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/auth/avatar - Remove user avatar
 */
export async function DELETE() {
  try {
    // Authenticate user
    const authUser = await getUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current avatar
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { avatar: true },
    });

    if (user?.avatar) {
      // Delete from storage
      const supabase = await createClient();
      const oldPath = user.avatar.split("/").slice(-2).join("/");
      if (oldPath.startsWith("avatars/")) {
        await supabase.storage
          .from("user-files")
          .remove([oldPath]);
      }
    }

    // Update user
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        avatar: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Avatar removed successfully",
    });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}

