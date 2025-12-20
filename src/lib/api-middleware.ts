/**
 * CAI Intake - API Middleware Utilities
 * 
 * Provides middleware functions for API routes including:
 * - Rate limiting
 * - Authentication
 * - Audit logging
 * - Plan enforcement
 * - Request validation
 * - Response helpers
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, createIdentifier, getClientIP, RATE_LIMITS } from "./rate-limiter";
import { logAuditFromRequest, AuditLogParams } from "./audit";
import { logger, createRequestLogger } from "./logger";
import { sanitizeLikePattern, SIZE_LIMITS, isValidBodySize } from "./security";
import { checkPlanForOperation, getOrganizationPlan, PlanType } from "./plans";
import { trackUsage, UsageEventType } from "./usage";
import { nanoid } from "nanoid";

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string | null;
  isSuperAdmin: boolean;
  role: string | null;
  plan: PlanType;
}

export interface ApiContext {
  user: AuthenticatedUser;
  requestId: string;
  ip: string | null;
  logger: ReturnType<typeof createRequestLogger>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: {
    requestId: string;
    timestamp: string;
    version?: string;
  };
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
  data: T,
  requestId: string,
  status = 200,
  headers?: Record<string, string>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: "2024-01-01",
      },
    },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
        "X-API-Version": "2024-01-01",
        ...headers,
      },
    }
  );
}

/**
 * Create a standardized error response
 */
export function apiError(
  message: string,
  requestId: string,
  status = 400,
  code?: string,
  headers?: Record<string, string>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
        ...headers,
      },
    }
  );
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Authenticate the request and return user context
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthenticatedUser; error?: never } | { user?: never; error: NextResponse }> {
  const requestId = nanoid();
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: apiError("Unauthorized", requestId, 401, "UNAUTHORIZED"),
      };
    }

    // Get user details from database
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role, is_super_admin")
      .eq("id", user.id)
      .single();

    const organizationId = userData?.organization_id || null;
    const plan = organizationId
      ? await getOrganizationPlan(organizationId)
      : "free";

    return {
      user: {
        id: user.id,
        email: user.email || "",
        organizationId,
        isSuperAdmin: userData?.is_super_admin || false,
        role: userData?.role || null,
        plan,
      },
    };
  } catch (error) {
    logger.error("Authentication error", error);
    return {
      error: apiError("Authentication failed", requestId, 500, "AUTH_ERROR"),
    };
  }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(
  request: NextRequest,
  userId?: string,
  preset: keyof typeof RATE_LIMITS = "api"
): Promise<{ allowed: true; headers: Record<string, string> } | { allowed: false; response: NextResponse }> {
  const requestId = nanoid();
  const ip = getClientIP(request.headers);
  const identifier = createIdentifier(userId, ip);

  const { allowed, headers, result } = await checkRateLimit(identifier, preset);

  if (!allowed) {
    return {
      allowed: false,
      response: apiError(
        "Rate limit exceeded. Please try again later.",
        requestId,
        429,
        "RATE_LIMIT_EXCEEDED",
        headers
      ),
    };
  }

  return { allowed: true, headers };
}

// =============================================================================
// PLAN ENFORCEMENT
// =============================================================================

/**
 * Check if the operation is allowed under the user's plan
 */
export async function checkPlanLimits(
  organizationId: string,
  operation: Parameters<typeof checkPlanForOperation>[1]
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const result = await checkPlanForOperation(organizationId, operation);

  if (!result.canProceed) {
    return { allowed: false, error: result.error || "Plan limit exceeded" };
  }

  return { allowed: true };
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate request body size
 */
export function validateBodySize(body: string, maxSize = SIZE_LIMITS.JSON_PAYLOAD): boolean {
  return isValidBodySize(body, maxSize);
}

/**
 * Sanitize search input for database queries
 */
export function sanitizeSearchInput(search: string | null): string | null {
  if (!search) return null;
  return sanitizeLikePattern(search.trim().slice(0, SIZE_LIMITS.SEARCH_QUERY));
}

// =============================================================================
// COMBINED MIDDLEWARE
// =============================================================================

export interface WithApiContextOptions {
  /** Rate limit preset to use */
  rateLimit?: keyof typeof RATE_LIMITS;
  /** Skip authentication (for public routes) */
  skipAuth?: boolean;
  /** Require organization membership */
  requireOrg?: boolean;
  /** Required role(s) */
  requiredRoles?: string[];
  /** Plan operation to check */
  planOperation?: Parameters<typeof checkPlanForOperation>[1];
  /** Audit action to log */
  auditAction?: string;
  /** Usage event to track */
  usageEvent?: UsageEventType;
}

/**
 * Wrap an API handler with common middleware
 */
export async function withApiContext<T>(
  request: NextRequest,
  options: WithApiContextOptions,
  handler: (context: ApiContext) => Promise<NextResponse<T>>
): Promise<NextResponse> {
  const requestId = nanoid();
  const ip = getClientIP(request.headers);
  const log = createRequestLogger(requestId);

  try {
    // Apply rate limiting
    if (options.rateLimit) {
      const rateLimitResult = await applyRateLimit(request, undefined, options.rateLimit);
      if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
      }
    }

    // Authenticate if required
    let user: AuthenticatedUser | null = null;
    if (!options.skipAuth) {
      const authResult = await authenticateRequest(request);
      if (authResult.error) {
        return authResult.error;
      }
      user = authResult.user;

      // Apply user-specific rate limit
      if (options.rateLimit) {
        const userRateLimit = await applyRateLimit(request, user.id, options.rateLimit);
        if (!userRateLimit.allowed) {
          return userRateLimit.response;
        }
      }

      // Check organization requirement
      if (options.requireOrg && !user.organizationId) {
        return apiError(
          "Organization membership required",
          requestId,
          400,
          "ORG_REQUIRED"
        );
      }

      // Check role requirement
      if (options.requiredRoles && options.requiredRoles.length > 0) {
        if (!user.isSuperAdmin && (!user.role || !options.requiredRoles.includes(user.role))) {
          return apiError(
            "Insufficient permissions",
            requestId,
            403,
            "FORBIDDEN"
          );
        }
      }

      // Check plan limits
      if (options.planOperation && user.organizationId) {
        const planCheck = await checkPlanLimits(user.organizationId, options.planOperation);
        if (!planCheck.allowed) {
          return apiError(planCheck.error, requestId, 403, "PLAN_LIMIT_EXCEEDED");
        }
      }
    }

    // Create context
    const context: ApiContext = {
      user: user!,
      requestId,
      ip,
      logger: log,
    };

    // Execute handler
    const response = await handler(context);

    // Track usage
    if (options.usageEvent && user?.organizationId) {
      trackUsage({
        organizationId: user.organizationId,
        userId: user.id,
        eventType: options.usageEvent,
      });
    }

    // Log audit
    if (options.auditAction && user) {
      await logAuditFromRequest(request, {
        userId: user.id,
        organizationId: user.organizationId,
        action: options.auditAction,
      });
    }

    return response;
  } catch (error) {
    log.error("API error", error);
    return apiError(
      "Internal server error",
      requestId,
      500,
      "INTERNAL_ERROR"
    );
  }
}

// =============================================================================
// CACHING HELPERS
// =============================================================================

/**
 * Add cache headers to response
 */
export function addCacheHeaders(
  response: NextResponse,
  maxAge: number,
  staleWhileRevalidate?: number
): NextResponse {
  const cacheControl = staleWhileRevalidate
    ? `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    : `private, max-age=${maxAge}`;

  response.headers.set("Cache-Control", cacheControl);
  return response;
}

/**
 * Add no-cache headers to response
 */
export function addNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

