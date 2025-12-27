/**
 * Seed System Defaults API
 * POST /api/v1/operations/seed - Seed system default operations
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { seedSystemDefaults } from "@/lib/operations/service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role - only super_admin can seed system defaults
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData || !userData.is_super_admin) {
      return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
    }

    const results = await seedSystemDefaults();

    return NextResponse.json({
      success: true,
      message: "System defaults seeded successfully",
      created: results,
    });
  } catch (error) {
    console.error("Error seeding system defaults:", error);
    return NextResponse.json(
      { error: "Failed to seed system defaults" },
      { status: 500 }
    );
  }
}

