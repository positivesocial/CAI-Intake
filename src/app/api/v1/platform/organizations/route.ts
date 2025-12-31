/**
 * CAI Intake - Platform Organizations API
 * 
 * GET /api/v1/platform/organizations
 * Returns all organizations for super admins
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

    // Check if super admin using Prisma (users table, not profiles)
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
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Get organizations with user count
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              cutlists: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    // Format response
    const formattedOrgs = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan || "free",
      status: "active", // All orgs are active by default
      members: org._count.users,
      cutlists: org._count.cutlists,
      createdAt: org.createdAt.toISOString(),
    }));

    return NextResponse.json({
      organizations: formattedOrgs,
      total,
      limit,
      offset,
    });

  } catch (error) {
    logger.error("Platform organizations error", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { name, slug, plan } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this slug already exists" },
        { status: 400 }
      );
    }

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        plan: plan || "free",
      },
    });

    logger.info("Organization created by super admin", {
      orgId: org.id,
      name,
      by: authUser.id,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        createdAt: org.createdAt.toISOString(),
      },
    });

  } catch (error) {
    logger.error("Platform organization create error", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
