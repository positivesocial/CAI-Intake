/**
 * CAI Intake - Optimizer Webhook Handler
 * 
 * @deprecated This webhook handler is no longer needed.
 * 
 * The CAI 2D Optimizer API (https://cai-2d.app/api) uses synchronous
 * optimization - results are returned directly in the POST /api/optimize
 * response. No webhooks or polling required.
 * 
 * This file is kept for:
 * 1. Backwards compatibility with any external systems that may still call it
 * 2. Reference for potential future async optimization support
 * 
 * POST /api/webhooks/optimizer - Receive optimization completion notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db as prisma } from "@/lib/db";

// =============================================================================
// TYPES
// =============================================================================

interface OptimizationWebhookPayload {
  event: "optimization.completed" | "optimization.failed" | "optimization.progress";
  jobId: string;
  timestamp: string;
  data?: {
    success?: boolean;
    layouts?: unknown[];
    statistics?: {
      totalSheets: number;
      totalParts: number;
      overallEfficiency: number;
    };
    error?: string;
    progress?: number;
  };
}

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Verify webhook signature
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CAI2D_WEBHOOK_SECRET;
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify signature if webhook secret is configured
    if (webhookSecret) {
      const signature = request.headers.get("x-cai2d-signature");
      
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.error("Invalid webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }
    
    // Parse payload
    const payload: OptimizationWebhookPayload = JSON.parse(rawBody);
    
    console.log(`[Webhook] Received ${payload.event} for job ${payload.jobId}`);
    
    // Find the optimization job
    const job = await prisma.optimizeJob.findUnique({
      where: { id: payload.jobId },
    });
    
    if (!job) {
      console.error(`[Webhook] Job not found: ${payload.jobId}`);
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }
    
    // Handle different events
    switch (payload.event) {
      case "optimization.completed":
        await prisma.optimizeJob.update({
          where: { id: payload.jobId },
          data: {
            status: payload.data?.success ? "completed" : "failed",
            completedAt: new Date(),
            result: payload.data?.layouts ? JSON.parse(JSON.stringify({ layouts: payload.data.layouts })) : undefined,
            metrics: payload.data?.statistics ? JSON.parse(JSON.stringify(payload.data.statistics)) : undefined,
          },
        });
        
        console.log(`[Webhook] Job ${payload.jobId} completed`);
        break;
        
      case "optimization.failed":
        await prisma.optimizeJob.update({
          where: { id: payload.jobId },
          data: {
            status: "failed",
            completedAt: new Date(),
            result: JSON.parse(JSON.stringify({ error: payload.data?.error || "Optimization failed" })),
          },
        });
        
        console.log(`[Webhook] Job ${payload.jobId} failed: ${payload.data?.error}`);
        break;
        
      case "optimization.progress":
        // Update progress if tracking is needed
        // For now, just log it
        console.log(`[Webhook] Job ${payload.jobId} progress: ${payload.data?.progress}%`);
        break;
        
      default:
        console.log(`[Webhook] Unknown event: ${payload.event}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Force dynamic rendering for webhook handler
export const dynamic = 'force-dynamic';
