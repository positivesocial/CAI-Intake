/**
 * Drilling Operations API
 * GET /api/v1/operations/drilling - List drilling operations
 * POST /api/v1/operations/drilling - Create drilling operation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDrillingOperations,
  createDrillingOperation,
} from "@/lib/operations/service";

// Cache operations for 5 minutes (300 seconds)
const CACHE_MAX_AGE = 300;
const CACHE_STALE_WHILE_REVALIDATE = 600;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const operations = await getDrillingOperations(
      userData?.organization_id ?? undefined
    );

    // Return with cache headers for better performance
    return NextResponse.json(
      { operations },
      {
        headers: {
          "Cache-Control": `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching drilling operations:", error);
    return NextResponse.json(
      { error: "Failed to fetch drilling operations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role (role_id references the roles table)
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, is_super_admin, roles(name)")
      .eq("id", user.id)
      .single();

    const roles = userData?.roles as { name: string }[] | null;
    const roleName = roles?.[0]?.name;
    const isSuperAdmin = userData?.is_super_admin;
    const isAdmin = roleName === "org_admin" || roleName === "admin" || isSuperAdmin;
    
    if (!userData || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const operation = await createDrillingOperation(body, userData.organization_id);

    return NextResponse.json({ operation }, { status: 201 });
  } catch (error) {
    console.error("Error creating drilling operation:", error);
    return NextResponse.json(
      { error: "Failed to create drilling operation" },
      { status: 500 }
    );
  }
}

