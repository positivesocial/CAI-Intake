/**
 * CAI Intake - Single API Key Management
 * 
 * GET /api/v1/api-keys/:id - Get API key details
 * PUT /api/v1/api-keys/:id - Update API key
 * DELETE /api/v1/api-keys/:id - Revoke API key
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

// =============================================================================
// SCHEMAS
// =============================================================================

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scopes: z.array(z.enum([
    "cutlists:read",
    "cutlists:write",
    "parts:read",
    "parts:write",
    "materials:read",
    "materials:write",
    "files:read",
    "files:write",
    "exports:read",
    "parse:execute",
    "webhooks:manage",
  ])).min(1).optional(),
  is_active: z.boolean().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getApiKeyWithAuth(userId: string, keyId: string) {
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

  const roleName = userData.is_super_admin ? "super_admin" :
    (userData.roles as { name: string } | null)?.name || "viewer";

  if (!["super_admin", "org_admin"].includes(roleName)) {
    return { error: "Insufficient permissions" };
  }

  // Get API key
  const { data: apiKey, error } = await serviceClient
    .from("api_keys")
    .select("*")
    .eq("id", keyId)
    .eq("organization_id", userData.organization_id)
    .single();

  if (error || !apiKey) {
    return { error: "API key not found" };
  }

  return { apiKey, userData, roleName };
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
    const idError = validateId(id, "API key");
    if (idError) return idError;

    const result = await getApiKeyWithAuth(user.id, id);
    if ("error" in result && !("apiKey" in result)) {
      return notFound("API key");
    }

    const { apiKey } = result;

    return successResponse({
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        last_used_at: apiKey.last_used_at,
        expires_at: apiKey.expires_at,
        is_active: apiKey.is_active,
        created_at: apiKey.created_at,
        created_by: apiKey.created_by,
      },
    });
  } catch (error) {
    logger.error("API key GET error", error);
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
    const idError = validateId(id, "API key");
    if (idError) return idError;

    const result = await getApiKeyWithAuth(user.id, id);
    if ("error" in result && !("apiKey" in result)) {
      return notFound("API key");
    }

    const { userData } = result;

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateApiKeySchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const updates = parseResult.data;

    // Update API key
    const serviceClient = getServiceClient();
    const { data: updatedKey, error } = await serviceClient
      .from("api_keys")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update API key", error, { userId: user.id });
      return serverError("Failed to update API key");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData?.organization_id,
      action: "api_key.updated",
      entityType: "api_key",
      entityId: id,
      metadata: { updates: Object.keys(updates) },
    });

    return successResponse({
      api_key: {
        id: updatedKey.id,
        name: updatedKey.name,
        description: updatedKey.description,
        prefix: updatedKey.prefix,
        scopes: updatedKey.scopes,
        is_active: updatedKey.is_active,
        updated_at: updatedKey.updated_at,
      },
    });
  } catch (error) {
    logger.error("API key PUT error", error);
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
    const idError = validateId(id, "API key");
    if (idError) return idError;

    const result = await getApiKeyWithAuth(user.id, id);
    if ("error" in result && !("apiKey" in result)) {
      return notFound("API key");
    }

    const { apiKey, userData } = result;

    // Revoke (soft delete) the API key
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("api_keys")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq("id", id);

    if (error) {
      logger.error("Failed to revoke API key", error, { userId: user.id });
      return serverError("Failed to revoke API key");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData?.organization_id,
      action: "api_key.revoked",
      entityType: "api_key",
      entityId: id,
      metadata: { name: apiKey.name },
    });

    return successResponse({
      success: true,
      message: "API key revoked",
    });
  } catch (error) {
    logger.error("API key DELETE error", error);
    return serverError();
  }
}

