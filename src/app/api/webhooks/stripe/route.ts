/**
 * CAI Intake - Stripe Webhook Handler
 * 
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { updateSubscription, setStripeSubscription } from "@/lib/subscriptions/service";
import type { PlanId, BillingInterval } from "@/lib/subscriptions/plans";
import type { SubscriptionStatus } from "@/lib/subscriptions/service";

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Create a service-role Supabase client for webhook handling
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase service role not configured");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error("Stripe webhook not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }
  
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }
    
    const supabase = getServiceClient();
    
    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }
      
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }
      
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialEnding(supabase, subscription);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

async function handleSubscriptionUpdate(
  supabase: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const organizationId = subscription.metadata?.organization_id;
  
  if (!organizationId) {
    // Try to find org by customer ID
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", customerId)
      .single();
    
    if (!existingSub) {
      console.error("Cannot find organization for subscription:", subscription.id);
      return;
    }
  }
  
  const orgId = organizationId || (await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .single()).data?.organization_id;
  
  if (!orgId) return;
  
  // Map Stripe status to our status
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
    paused: "paused",
  };
  
  // Get plan ID from price
  const priceId = subscription.items.data[0]?.price.id;
  let planId: PlanId = "free";
  
  // Map price ID to plan ID (you'd configure these in your environment)
  const priceToPlans: Record<string, PlanId> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || ""]: "starter",
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID || ""]: "starter",
    [process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || ""]: "professional",
    [process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || ""]: "professional",
    [process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || ""]: "enterprise",
    [process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || ""]: "enterprise",
  };
  
  if (priceId && priceToPlans[priceId]) {
    planId = priceToPlans[priceId];
  }
  
  // Determine billing interval
  const billingInterval: BillingInterval = 
    subscription.items.data[0]?.price.recurring?.interval === "year" 
      ? "yearly" 
      : "monthly";
  
  // Update subscription in database
  // Note: Stripe subscription timestamps may be numbers (Unix) or undefined
  // Cast through unknown to access dynamic properties safely
  const subData = subscription as unknown as Record<string, unknown>;
  const periodStart = subData.current_period_start;
  const periodEnd = subData.current_period_end;
  const trialStart = subData.trial_start;
  const trialEnd = subData.trial_end;
  const canceledAt = subData.canceled_at;
  
  await supabase
    .from("subscriptions")
    .update({
      plan_id: planId,
      status: statusMap[subscription.status] || "active",
      billing_interval: billingInterval,
      stripe_subscription_id: subscription.id,
      current_period_start: typeof periodStart === "number" 
        ? new Date(periodStart * 1000).toISOString() 
        : null,
      current_period_end: typeof periodEnd === "number" 
        ? new Date(periodEnd * 1000).toISOString() 
        : null,
      trial_start: typeof trialStart === "number" 
        ? new Date(trialStart * 1000).toISOString() 
        : null,
      trial_end: typeof trialEnd === "number" 
        ? new Date(trialEnd * 1000).toISOString() 
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: typeof canceledAt === "number" 
        ? new Date(canceledAt * 1000).toISOString() 
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);
  
  console.log(`Updated subscription for org ${orgId}: ${planId} (${subscription.status})`);
}

async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  
  // Find organization by customer ID
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
  if (!existingSub) return;
  
  // Downgrade to free plan
  await supabase
    .from("subscriptions")
    .update({
      plan_id: "free",
      status: "canceled",
      stripe_subscription_id: null,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", existingSub.organization_id);
  
  console.log(`Subscription canceled for org ${existingSub.organization_id}`);
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof getServiceClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  
  // Find organization by customer ID
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, organization_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
  if (!existingSub) return;
  
  // Create invoice record
  // Cast through unknown to access properties that may vary by Stripe API version
  const invData = invoice as unknown as Record<string, unknown>;
  
  await supabase
    .from("invoices")
    .upsert({
      organization_id: existingSub.organization_id,
      subscription_id: existingSub.id,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number,
      subtotal_cents: invoice.subtotal ?? 0,
      tax_cents: (invData.tax as number | undefined) ?? 0,
      total_cents: invoice.total ?? 0,
      amount_paid_cents: invoice.amount_paid ?? 0,
      amount_due_cents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "paid",
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      period_start: typeof invData.period_start === "number"
        ? new Date((invData.period_start as number) * 1000).toISOString() 
        : null,
      period_end: typeof invData.period_end === "number"
        ? new Date((invData.period_end as number) * 1000).toISOString() 
        : null,
      paid_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_invoice_id",
    });
  
  console.log(`Invoice ${invoice.number} paid for org ${existingSub.organization_id}`);
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof getServiceClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  
  // Find organization by customer ID
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, organization_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
  if (!existingSub) return;
  
  // Update subscription status to past_due
  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", existingSub.organization_id);
  
  // Record failed invoice
  const failedInvData = invoice as unknown as Record<string, unknown>;
  await supabase
    .from("invoices")
    .upsert({
      organization_id: existingSub.organization_id,
      subscription_id: existingSub.id,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number,
      subtotal_cents: invoice.subtotal ?? 0,
      tax_cents: (failedInvData.tax as number | undefined) ?? 0,
      total_cents: invoice.total ?? 0,
      amount_paid_cents: 0,
      amount_due_cents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "open",
      hosted_invoice_url: invoice.hosted_invoice_url,
    }, {
      onConflict: "stripe_invoice_id",
    });
  
  console.log(`Payment failed for invoice ${invoice.number} (org ${existingSub.organization_id})`);
  
  // TODO: Send email notification about failed payment
}

async function handleTrialEnding(
  supabase: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  
  // Find organization by customer ID
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
  if (!existingSub) return;
  
  console.log(`Trial ending soon for org ${existingSub.organization_id}`);
  
  // TODO: Send trial ending email notification
}

