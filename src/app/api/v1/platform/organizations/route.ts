/**
 * CAI Intake - Platform Organizations API
 * 
 * GET /api/v1/platform/organizations
 * Returns all organizations for super admins
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Authenticate and verify super admin
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    
    // Check if super admin
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let query = serviceClient
      .from("organizations")
      .select(`
        id,
        name,
        slug,
        created_at,
        subscription_plan,
        subscription_status,
        profiles!profiles_organization_id_fkey(count)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data: organizations, count, error } = await query;

    if (error) {
      throw error;
    }

    // Get cutlist counts per org
    const orgIds = (organizations || []).map((o: Record<string, unknown>) => o.id);
    const { data: cutlistCounts } = await serviceClient
      .from("cutlists")
      .select("organization_id")
      .in("organization_id", orgIds);

    const cutlistCountMap = (cutlistCounts || []).reduce((acc: Record<string, number>, c: Record<string, string>) => {
      acc[c.organization_id] = (acc[c.organization_id] || 0) + 1;
      return acc;
    }, {});

    // Format response
    const formattedOrgs = (organizations || []).map((org: Record<string, unknown>) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.subscription_plan || "free",
      status: org.subscription_status || "active",
      members: (org.profiles as { count: number }[])?.length || 0,
      cutlists: cutlistCountMap[org.id as string] || 0,
      createdAt: org.created_at,
    }));

    return NextResponse.json({
      organizations: formattedOrgs,
      total: count || 0,
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
    // Authenticate and verify super admin
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    
    // Check if super admin
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, adminEmail, plan } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Create organization
    const { data: org, error } = await serviceClient
      .from("organizations")
      .insert({
        name,
        slug,
        subscription_plan: plan || "free",
        subscription_status: "active",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Organization with this slug already exists" },
          { status: 400 }
        );
      }
      throw error;
    }

    logger.info("Organization created by super admin", {
      orgId: org.id,
      name,
      by: user.id,
    });

    return NextResponse.json({
      success: true,
      organization: org,
    });

  } catch (error) {
    logger.error("Platform organization create error", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}

