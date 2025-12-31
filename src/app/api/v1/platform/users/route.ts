/**
 * CAI Intake - Platform Users API
 * 
 * GET /api/v1/platform/users
 * Returns all users for super admins
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user via Supabase
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if super admin using Prisma (users table)
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - Super admin access required" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build Prisma query
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Get users with organization info
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          role: {
            select: {
              name: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Format response
    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || "Unknown",
      role: u.isSuperAdmin ? "super_admin" : (u.role?.name || "user"),
      roleDisplay: u.isSuperAdmin ? "Super Admin" : (u.role?.displayName || "User"),
      organization: u.organization?.name || "No Organization",
      organizationId: u.organizationId,
      status: u.isActive ? (u.lastLoginAt ? "active" : "pending") : "suspended",
      createdAt: u.createdAt.toISOString(),
      lastActive: u.lastLoginAt?.toISOString() || null,
    }));

    return NextResponse.json({
      users: formattedUsers,
      total,
      limit,
      offset,
    });

  } catch (error) {
    logger.error("Platform users error", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user via Supabase
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if super admin using Prisma
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { isSuperAdmin: true },
    });

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - Super admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action are required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "updateRole": {
        if (!data?.roleId) {
          return NextResponse.json({ error: "roleId is required" }, { status: 400 });
        }
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: data.roleId },
        });
        logger.info("User role updated", { userId, roleId: data.roleId, by: authUser.id });
        return NextResponse.json({ success: true, message: "Role updated" });
      }

      case "suspend": {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
        logger.info("User suspended", { userId, by: authUser.id });
        return NextResponse.json({ success: true, message: "User suspended" });
      }

      case "activate": {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: true },
        });
        logger.info("User activated", { userId, by: authUser.id });
        return NextResponse.json({ success: true, message: "User activated" });
      }

      case "makeSuperAdmin": {
        await prisma.user.update({
          where: { id: userId },
          data: { isSuperAdmin: true },
        });
        logger.info("User promoted to super admin", { userId, by: authUser.id });
        return NextResponse.json({ success: true, message: "User is now a super admin" });
      }

      case "removeSuperAdmin": {
        // Don't allow removing your own super admin status
        if (userId === authUser.id) {
          return NextResponse.json({ error: "Cannot remove your own super admin status" }, { status: 400 });
        }
        await prisma.user.update({
          where: { id: userId },
          data: { isSuperAdmin: false },
        });
        logger.info("Super admin status removed", { userId, by: authUser.id });
        return NextResponse.json({ success: true, message: "Super admin status removed" });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error("Platform user update error", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
