/**
 * CAI Intake - API Keys Management
 * 
 * GET /api/v1/api-keys - List API keys
 * POST /api/v1/api-keys - Create API key
 * 
 * API keys allow external systems to authenticate with CAI Intake.
 */

import { NextRequest } from "next/server";
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
// SCHEMAS
// =============================================================================

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
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
  ])).min(1, "At least one scope is required"),
  expires_at: z.string().datetime().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate a 32-byte random key
  const keyBytes = crypto.randomBytes(32);
  const key = `cai_live_${keyBytes.toString("base64url")}`;
  
  // Hash for storage
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  
  // Prefix for identification (first 8 chars after cai_live_)
  const prefix = key.slice(9, 17);
  
  return { key, hash, prefix };
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}${"•".repeat(20)}${key.slice(-4)}`;
}

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
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Check permissions - only admins can view API keys
    const roleName = userData.is_super_admin ? "super_admin" :
      (userData.roles as { name: string } | null)?.name || "viewer";

    if (!["super_admin", "org_admin"].includes(roleName)) {
      return badRequest("Insufficient permissions to view API keys");
    }

    // Parse pagination
    const { page, limit } = parsePaginationParams(request.nextUrl.searchParams);
    const offset = getOffset(page, limit);

    // Fetch API keys
    const { data: apiKeys, error, count } = await serviceClient
      .from("api_keys")
      .select("*", { count: "exact" })
      .eq("organization_id", userData.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error("Failed to fetch API keys", error, { userId: user.id });
      return serverError("Failed to fetch API keys");
    }

    const pagination = calculatePagination(page, limit, count ?? 0);

    return successResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api_keys: apiKeys?.map((k: any) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        prefix: k.prefix,
        scopes: k.scopes,
        last_used_at: k.last_used_at,
        expires_at: k.expires_at,
        is_active: k.is_active,
        created_at: k.created_at,
        created_by: k.created_by,
      })) ?? [],
      pagination,
    });
  } catch (error) {
    logger.error("API keys GET error", error);
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

    // Check permissions - only admins can create API keys
    const roleName = userData.is_super_admin ? "super_admin" :
      (userData.roles as { name: string } | null)?.name || "viewer";

    if (!["super_admin", "org_admin"].includes(roleName)) {
      return badRequest("Insufficient permissions to create API keys");
    }

    // Parse request body
    const body = await request.json();
    const parseResult = CreateApiKeySchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const { name, description, scopes, expires_at } = parseResult.data;

    // Generate API key
    const { key, hash, prefix } = generateApiKey();

    // Create API key record
    const { data: apiKey, error } = await serviceClient
      .from("api_keys")
      .insert({
        organization_id: userData.organization_id,
        name,
        description,
        key_hash: hash,
        prefix,
        scopes,
        expires_at: expires_at || null,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create API key", error, { userId: user.id });
      return serverError("Failed to create API key");
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: "api_key.created",
      entityType: "api_key",
      entityId: apiKey.id,
      metadata: { name, scopes },
    });

    return createdResponse({
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        key: key, // Full key - only shown once
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        expires_at: apiKey.expires_at,
        created_at: apiKey.created_at,
      },
      message: "API key created. This is the only time you will see the full key. Store it securely.",
    });
  } catch (error) {
    logger.error("API keys POST error", error);
    return serverError();
  }
}

