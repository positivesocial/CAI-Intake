/**
 * CAI Intake - Auth Profile API
 * 
 * GET /api/v1/auth/profile - Get user profile by Supabase user ID
 * PUT /api/v1/auth/profile - Update user profile
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch user with organization and role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            plan: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Transform to session user format
    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      jobTitle: user.jobTitle,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      organizationId: user.organizationId,
      organization: user.organization,
      roleId: user.roleId,
      role: user.role,
      preferences: user.preferences,
      notifications: user.notifications,
    };

    return NextResponse.json({ user: sessionUser });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/auth/profile - Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, phone, jobTitle, avatar } = body;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(avatar !== undefined && { avatar }),
        updatedAt: new Date(),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            plan: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            permissions: true,
          },
        },
      },
    });

    // Transform to session user format
    const sessionUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      phone: updatedUser.phone,
      jobTitle: updatedUser.jobTitle,
      emailVerified: updatedUser.emailVerified,
      isActive: updatedUser.isActive,
      isSuperAdmin: updatedUser.isSuperAdmin,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
      organizationId: updatedUser.organizationId,
      organization: updatedUser.organization,
      roleId: updatedUser.roleId,
      role: updatedUser.role,
      preferences: updatedUser.preferences,
      notifications: updatedUser.notifications,
    };

    return NextResponse.json({ 
      user: sessionUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}





