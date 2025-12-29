/**
 * CAI Intake - Webhooks API
 * 
 * GET /api/v1/webhooks - List webhooks
 * POST /api/v1/webhooks - Create webhook
 * 
 * Allows organizations to receive real-time notifications for events.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { 
  successResponse, 
  createdResponse, 
  unauthorized, 
  badRequest, 
  serverError,
  validationError,
  parsePaginationParams,
  calculatePagination,
  getOffset,
} from "@/lib/api/response";
import crypto from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export const WEBHOOK_EVENTS = [
  "cutlist.created",
  "cutlist.updated",
  "cutlist.deleted",
  "cutlist.archived",
  "parse_job.started",
  "parse_job.completed",
  "parse_job.failed",
  "export.completed",
  "optimization.completed",
  "optimization.failed",
  "team.member_added",
  "team.member_removed",
  "subscription.updated",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateWebhookSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "At least one event is required"),
  description: z.string().max(500).optional(),
  is_active: z.boolean().default(true),
  headers: z.record(z.string(), z.string()).optional(),
});

// =============================================================================
// HANDLERS
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Parse pagination
    const { page, limit } = parsePaginationParams(request.nextUrl.searchParams);
    const offset = getOffset(page, limit);

    // Fetch webhooks
    const { data: webhooks, error, count } = await serviceClient
      .from("webhooks")
      .select("*", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error("Failed to fetch webhooks", error, { userId: user.id });
      return serverError("Failed to fetch webhooks");
    }

    const pagination = calculatePagination(page, limit, count ?? 0);

    return successResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      webhooks: webhooks?.map((w: any) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        description: w.description,
        is_active: w.is_active,
        last_triggered_at: w.last_triggered_at,
        last_status: w.last_status,
        failure_count: w.failure_count,
        created_at: w.created_at,
        updated_at: w.updated_at,
      })) ?? [],
      pagination,
    });
  } catch (error) {
    logger.error("Webhooks GET error", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const serviceClient = getServiceClient();

    // Get user's organization and role
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Check permissions
    const roleName = userData.is_super_admin ? "super_admin" :
      (userData.roles as { name: string } | null)?.name || "viewer";

    if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
      return badRequest("Insufficient permissions to create webhooks");
    }

    // Parse request body
    const body = await request.json();
    const parseResult = CreateWebhookSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const { url, events, description, is_active, headers } = parseResult.data;

    // Generate secret for signature verification
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    // Create webhook
    const { data: webhook, error } = await serviceClient
      .from("webhooks")
      .insert({
        organization_id: userData.organization_id,
        url,
        events,
        description,
        is_active,
        secret,
        headers: headers || {},
        failure_count: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create webhook", error, { userId: user.id });
      return serverError("Failed to create webhook");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: "webhook.created",
      entityType: "webhook",
      entityId: webhook.id,
      metadata: { url, events },
    });

    return createdResponse({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        is_active: webhook.is_active,
        secret: webhook.secret, // Only returned on creation
        created_at: webhook.created_at,
      },
      message: "Webhook created successfully. Store the secret securely.",
    });
  } catch (error) {
    logger.error("Webhooks POST error", error);
    return serverError();
  }
}

