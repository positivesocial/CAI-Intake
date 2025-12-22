/**
 * CAI Intake - Billing History API
 * 
 * GET /api/v1/billing/history - Get invoices and billing history
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingHistory } from "@/lib/subscriptions/service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get user's organization and check permissions
    const { data: userData } = await supabase
      .from("users")
      .select(`
        organization_id,
        is_super_admin,
        role:roles(name)
      `)
      .eq("id", user.id)
      .single();
    
    if (!userData?.organization_id) {
      return NextResponse.json({ history: [] });
    }
    
    // Only org admins and managers can view billing
    const roleName = userData.role && typeof userData.role === 'object' && 'name' in userData.role 
      ? userData.role.name 
      : null;
    const canViewBilling = userData.is_super_admin || 
      ["org_admin", "manager"].includes(roleName as string);
    
    if (!canViewBilling) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
    
    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    
    const history = await getBillingHistory(userData.organization_id, limit);
    
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing history" },
      { status: 500 }
    );
  }
}

