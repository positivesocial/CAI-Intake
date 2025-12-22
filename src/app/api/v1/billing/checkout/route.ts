/**
 * CAI Intake - Stripe Checkout API
 * 
 * POST /api/v1/billing/checkout - Create a Stripe Checkout session for upgrading
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { z } from "zod";
import { getPlan, type PlanId, type BillingInterval } from "@/lib/subscriptions/plans";

// Initialize Stripe (only if API key is set)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const CheckoutRequestSchema = z.object({
  planId: z.enum(["starter", "professional", "enterprise"]),
  billingInterval: z.enum(["monthly", "yearly"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { 
          error: "Payment system not configured",
          message: "Stripe integration is pending. Contact sales for Enterprise plans.",
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
    
    // Parse and validate request body
    const body = await request.json();
    const validation = CheckoutRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { planId, billingInterval, successUrl, cancelUrl } = validation.data;
    
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
    
    // Get organization details
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", userData.organization_id)
      .single();
    
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    
    // Get current subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", org.id)
      .single();
    
    // Get or create Stripe customer
    let customerId = subscription?.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          organization_id: org.id,
          user_id: user.id,
        },
      });
      customerId = customer.id;
      
      // Save customer ID
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("organization_id", org.id);
    }
    
    // Get plan price ID
    const plan = getPlan(planId as PlanId);
    const priceId = billingInterval === "yearly" 
      ? plan.stripePriceIds?.yearly 
      : plan.stripePriceIds?.monthly;
    
    if (!priceId) {
      return NextResponse.json(
        { 
          error: "Price not configured",
          message: `Stripe price for ${planId} (${billingInterval}) is not set up yet.`,
        },
        { status: 503 }
      );
    }
    
    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${baseUrl}/settings/billing?success=true`,
      cancel_url: cancelUrl || `${baseUrl}/settings/billing?canceled=true`,
      subscription_data: {
        trial_period_days: planId === "starter" || planId === "professional" ? 14 : undefined,
        metadata: {
          organization_id: org.id,
          plan_id: planId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: {
        organization_id: org.id,
        plan_id: planId,
        billing_interval: billingInterval,
      },
    });
    
    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

