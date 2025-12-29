/**
 * CAI Intake - Single Webhook API
 * 
 * GET /api/v1/webhooks/:id - Get webhook details
 * PUT /api/v1/webhooks/:id - Update webhook
 * DELETE /api/v1/webhooks/:id - Delete webhook
 * POST /api/v1/webhooks/:id/test - Test webhook
 */

import { NextRequest } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import {
  successResponse,
  unauthorized,
  notFound,
  badRequest,
  serverError,
  validationError,
  validateId,
} from "@/lib/api/response";
import { WEBHOOK_EVENTS } from "../route";
import crypto from "crypto";

// =============================================================================
// SCHEMAS
// =============================================================================

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getWebhookWithAuth(userId: string, webhookId: string) {
  const serviceClient = getServiceClient();

  // Get user's organization
  const { data: userData } = await serviceClient
    .from("users")
    .select("organization_id, is_super_admin, roles:role_id(name)")
    .eq("id", userId)
    .single();

  if (!userData?.organization_id) {
    return { error: "User not associated with an organization" };
  }

  // Get webhook
  const { data: webhook, error } = await serviceClient
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("organization_id", userData.organization_id)
    .single();

  if (error || !webhook) {
    return { error: "Webhook not found" };
  }

  const roleName = userData.is_super_admin ? "super_admin" :
    (userData.roles as { name: string } | null)?.name || "viewer";

  return { webhook, userData, roleName };
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "webhook");
    if (idError) return idError;

    const result = await getWebhookWithAuth(user.id, id);
    if ("error" in result && !("webhook" in result)) {
      return notFound("Webhook");
    }

    const { webhook } = result;

    return successResponse({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        is_active: webhook.is_active,
        last_triggered_at: webhook.last_triggered_at,
        last_status: webhook.last_status,
        failure_count: webhook.failure_count,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      },
    });
  } catch (error) {
    logger.error("Webhook GET error", error);
    return serverError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "webhook");
    if (idError) return idError;

    const result = await getWebhookWithAuth(user.id, id);
    if ("error" in result && !("webhook" in result)) {
      return notFound("Webhook");
    }

    const { webhook, userData, roleName } = result;

    // Check permissions
    if (!["super_admin", "org_admin", "manager"].includes(roleName || "")) {
      return badRequest("Insufficient permissions to update webhooks");
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateWebhookSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const updates = parseResult.data;

    // Update webhook
    const serviceClient = getServiceClient();
    const { data: updatedWebhook, error } = await serviceClient
      .from("webhooks")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update webhook", error, { userId: user.id });
      return serverError("Failed to update webhook");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData?.organization_id,
      action: "webhook.updated",
      entityType: "webhook",
      entityId: id,
      metadata: { updates: Object.keys(updates) },
    });

    return successResponse({
      webhook: {
        id: updatedWebhook.id,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        description: updatedWebhook.description,
        is_active: updatedWebhook.is_active,
        updated_at: updatedWebhook.updated_at,
      },
    });
  } catch (error) {
    logger.error("Webhook PUT error", error);
    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "webhook");
    if (idError) return idError;

    const result = await getWebhookWithAuth(user.id, id);
    if ("error" in result && !("webhook" in result)) {
      return notFound("Webhook");
    }

    const { userData, roleName } = result;

    // Check permissions
    if (!["super_admin", "org_admin", "manager"].includes(roleName || "")) {
      return badRequest("Insufficient permissions to delete webhooks");
    }

    // Delete webhook
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("webhooks")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Failed to delete webhook", error, { userId: user.id });
      return serverError("Failed to delete webhook");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData?.organization_id,
      action: "webhook.deleted",
      entityType: "webhook",
      entityId: id,
      metadata: {},
    });

    return successResponse({
      success: true,
      message: "Webhook deleted",
    });
  } catch (error) {
    logger.error("Webhook DELETE error", error);
    return serverError();
  }
}

/**
 * POST /api/v1/webhooks/:id/test
 * Send a test event to the webhook
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "webhook");
    if (idError) return idError;

    const result = await getWebhookWithAuth(user.id, id);
    if ("error" in result && !("webhook" in result)) {
      return notFound("Webhook");
    }

    const { webhook } = result;

    // Create test payload
    const testPayload = {
      event: "test.webhook",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook from CAI Intake",
        webhook_id: webhook.id,
      },
    };

    // Create signature
    const payloadString = JSON.stringify(testPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payloadString}`;
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(signaturePayload)
      .digest("hex");

    // Send test request
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CAI-Signature": `t=${timestamp},v1=${signature}`,
          "X-CAI-Event": "test.webhook",
          "X-CAI-Webhook-Id": webhook.id,
          ...(webhook.headers || {}),
        },
        body: payloadString,
      });

      const success = response.ok;

      // Update webhook status
      const serviceClient = getServiceClient();
      await serviceClient
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: response.status,
          failure_count: success ? 0 : (webhook.failure_count || 0) + 1,
        })
        .eq("id", id);

      return successResponse({
        success,
        status_code: response.status,
        message: success ? "Test webhook sent successfully" : "Webhook returned non-2xx status",
      });
    } catch (fetchError) {
      // Update failure count
      const serviceClient = getServiceClient();
      await serviceClient
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: 0,
          failure_count: (webhook.failure_count || 0) + 1,
        })
        .eq("id", id);

      return successResponse({
        success: false,
        status_code: 0,
        message: fetchError instanceof Error ? fetchError.message : "Failed to reach webhook URL",
      });
    }
  } catch (error) {
    logger.error("Webhook test error", error);
    return serverError();
  }
}

