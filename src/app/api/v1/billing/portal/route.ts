/**
 * CAI Intake - Stripe Customer Portal API
 * 
 * POST /api/v1/billing/portal - Create a Stripe Customer Portal session
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Initialize Stripe (only if API key is set)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { 
          error: "Payment system not configured",
          message: "Stripe integration is pending.",
        },
        { status: 503 }
      );
    }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get user's organization
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
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    
    // Check permissions
    const roleName = userData.role && typeof userData.role === 'object' && 'name' in userData.role 
      ? userData.role.name 
      : null;
    const canManageBilling = userData.is_super_admin || roleName === "org_admin";
    
    if (!canManageBilling) {
      return NextResponse.json(
        { error: "Only organization admins can manage billing" },
        { status: 403 }
      );
    }
    
    // Get subscription with Stripe customer ID
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", userData.organization_id)
      .single();
    
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { 
          error: "No billing account found",
          message: "Please upgrade to a paid plan first.",
        },
        { status: 404 }
      );
    }
    
    // Parse request for return URL
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/billing`;
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });
    
    return NextResponse.json({
      portalUrl: session.url,
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}

