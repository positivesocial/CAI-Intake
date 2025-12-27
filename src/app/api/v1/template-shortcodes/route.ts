/**
 * Template Shortcodes API
 * GET /api/v1/template-shortcodes - Fetch org's shortcodes for template generation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOrgShortcodes } from "@/lib/templates/org-template-generator";

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

    if (!userData?.organization_id) {
      // Return empty shortcodes - template will use defaults
      return NextResponse.json({ shortcodes: [] });
    }

    // Fetch shortcodes from the operations tables
    const shortcodes = await fetchOrgShortcodes(userData.organization_id);

    return NextResponse.json({ shortcodes });
  } catch (error) {
    console.error("Error fetching template shortcodes:", error);
    return NextResponse.json(
      { error: "Failed to fetch shortcodes" },
      { status: 500 }
    );
  }
}

