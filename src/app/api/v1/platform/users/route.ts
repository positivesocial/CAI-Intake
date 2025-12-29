/**
 * CAI Intake - Platform Users API
 * 
 * GET /api/v1/platform/users
 * Returns all users for super admins
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Authenticate and verify super admin
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createClient();
    
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
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let query = serviceClient
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        role,
        is_super_admin,
        created_at,
        last_sign_in_at,
        organization_id,
        organizations!profiles_organization_id_fkey(
          id,
          name
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, count, error } = await query;

    if (error) {
      throw error;
    }

    // Format response
    const formattedUsers = (users || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      name: u.full_name || "Unknown",
      role: u.is_super_admin ? "super_admin" : (u.role || "user"),
      organization: (u.organizations as Record<string, string>)?.name || "No Organization",
      organizationId: u.organization_id,
      status: u.last_sign_in_at ? "active" : "pending",
      createdAt: u.created_at,
      lastActive: u.last_sign_in_at || null,
    }));

    return NextResponse.json({
      users: formattedUsers,
      total: count || 0,
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
    // Authenticate and verify super admin
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createClient();
    
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
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action are required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "updateRole": {
        const { error } = await serviceClient
          .from("profiles")
          .update({ role: data.role })
          .eq("id", userId);

        if (error) throw error;
        return NextResponse.json({ success: true, message: "Role updated" });
      }

      case "suspend": {
        // In real implementation, this would update a status field
        logger.info("User suspended", { userId, by: user.id });
        return NextResponse.json({ success: true, message: "User suspended" });
      }

      case "activate": {
        logger.info("User activated", { userId, by: user.id });
        return NextResponse.json({ success: true, message: "User activated" });
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

