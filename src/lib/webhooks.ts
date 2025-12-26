/**
 * CAI Intake - Outbound Webhooks System
 * 
 * Enables organizations to receive real-time notifications about events.
 */

import { createHmac } from "crypto";
import { db } from "./db";
import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

export type WebhookEventType =
  | "cutlist.created"
  | "cutlist.updated"
  | "cutlist.deleted"
  | "cutlist.exported"
  | "optimize_job.started"
  | "optimize_job.completed"
  | "optimize_job.failed"
  | "parse_job.completed"
  | "parse_job.failed"
  | "user.invited"
  | "user.joined";

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  organizationId: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
}

// =============================================================================
// SIGNATURE
// =============================================================================

/**
 * Generate webhook signature for payload verification
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateWebhookSignature(payload, secret);
  return signature === expected;
}

// =============================================================================
// WEBHOOK DELIVERY
// =============================================================================

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

/**
 * Deliver webhook to a single endpoint
 */
async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const start = Date.now();
  const body = JSON.stringify(payload);
  const signature = generateWebhookSignature(body, endpoint.secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Id": payload.id,
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Timestamp": payload.timestamp,
        "User-Agent": "CAI-Intake-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      success: response.ok,
      statusCode: response.status,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start,
    };
  }
}

/**
 * Retry failed webhook delivery with exponential backoff
 */
async function deliverWithRetry(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  maxRetries = 3
): Promise<DeliveryResult> {
  let lastResult: DeliveryResult = { success: false, error: "No attempts made", duration: 0 };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 4s, 16s
      const delay = Math.pow(4, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    lastResult = await deliverToEndpoint(endpoint, payload);

    if (lastResult.success) {
      return lastResult;
    }

    // Don't retry on 4xx errors (client errors)
    if (lastResult.statusCode && lastResult.statusCode >= 400 && lastResult.statusCode < 500) {
      break;
    }
  }

  return lastResult;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Emit a webhook event to all subscribed endpoints
 */
export async function emitWebhook(
  organizationId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Get active webhook endpoints for this organization
    // Note: Webhooks table would need to be added to schema
    // For now, we'll check organization settings
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org?.settings) return;

    const settings = org.settings as Record<string, unknown>;
    const webhookEndpoints = (settings.webhooks as WebhookEndpoint[]) || [];

    // Filter endpoints subscribed to this event
    const subscribedEndpoints = webhookEndpoints.filter(
      (ep) => ep.active && ep.events.includes(event)
    );

    if (subscribedEndpoints.length === 0) return;

    const payload: WebhookPayload = {
      id: `whk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      event,
      timestamp: new Date().toISOString(),
      data,
      organizationId,
    };

    // Deliver to all endpoints in parallel
    const results = await Promise.allSettled(
      subscribedEndpoints.map((endpoint) => deliverWithRetry(endpoint, payload))
    );

    // Log results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const endpoint = subscribedEndpoints[i];

      if (result.status === "fulfilled") {
        logger.info("Webhook delivered", {
          event,
          endpointUrl: endpoint.url,
          success: result.value.success,
          statusCode: result.value.statusCode,
          duration: result.value.duration,
        });
      } else {
        logger.error("Webhook delivery failed", result.reason, {
          event,
          endpointUrl: endpoint.url,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to emit webhook", error, { event, organizationId });
  }
}

/**
 * Test a webhook endpoint
 */
export async function testWebhookEndpoint(
  url: string,
  secret: string
): Promise<{ success: boolean; message: string }> {
  const testPayload: WebhookPayload = {
    id: `test_${Date.now()}`,
    event: "cutlist.created",
    timestamp: new Date().toISOString(),
    data: { test: true, message: "This is a test webhook from CAI Intake" },
    organizationId: "test",
  };

  const result = await deliverToEndpoint({ id: "test", url, secret, events: [], active: true }, testPayload);

  if (result.success) {
    return { success: true, message: `Webhook delivered successfully (${result.statusCode})` };
  }

  return {
    success: false,
    message: result.error || `Failed with status ${result.statusCode}`,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a new webhook secret
 */
export function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whsec_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * List of all available webhook events
 */
export const WEBHOOK_EVENTS: { event: WebhookEventType; description: string }[] = [
  { event: "cutlist.created", description: "A new cutlist was created" },
  { event: "cutlist.updated", description: "A cutlist was updated" },
  { event: "cutlist.deleted", description: "A cutlist was deleted" },
  { event: "cutlist.exported", description: "A cutlist was exported" },
  { event: "optimize_job.started", description: "An optimization job started" },
  { event: "optimize_job.completed", description: "An optimization job completed successfully" },
  { event: "optimize_job.failed", description: "An optimization job failed" },
  { event: "parse_job.completed", description: "A parse job completed successfully" },
  { event: "parse_job.failed", description: "A parse job failed" },
  { event: "user.invited", description: "A user was invited to the organization" },
  { event: "user.joined", description: "A user accepted an invitation" },
];





