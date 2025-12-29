/**
 * CAI Intake API - Standardized Response Utilities
 * 
 * Provides consistent response formatting, error handling, and pagination
 * across all API endpoints.
 */

import { NextResponse } from "next/server";

// =============================================================================
// API VERSION
// =============================================================================

export const API_VERSION = "1.0.0";
export const API_PREFIX = "/api/v1";

// =============================================================================
// RESPONSE HEADERS
// =============================================================================

export function getApiHeaders(customHeaders?: Record<string, string>) {
  return {
    "X-API-Version": API_VERSION,
    "X-Powered-By": "CAI Intake",
    ...customHeaders,
  };
}

export function withRateLimitHeaders(
  headers: Record<string, string>,
  limit: number,
  remaining: number,
  resetTime: number
): Record<string, string> {
  return {
    ...headers,
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": resetTime.toString(),
  };
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const API_ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  
  // Validation
  INVALID_REQUEST: "INVALID_REQUEST",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_FORMAT: "INVALID_FORMAT",
  
  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  
  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  
  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  
  // AI/Processing
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_PARSE_FAILED: "AI_PARSE_FAILED",
  OCR_FAILED: "OCR_FAILED",
  PROCESSING_FAILED: "PROCESSING_FAILED",
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// =============================================================================
// ERROR RESPONSES
// =============================================================================

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
  requestId?: string;
}

export function errorResponse(
  status: number,
  message: string,
  code: ApiErrorCode,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      requestId: generateRequestId(),
    },
    {
      status,
      headers: getApiHeaders(),
    }
  );
}

export function unauthorized(message = "Unauthorized") {
  return errorResponse(401, message, API_ERROR_CODES.UNAUTHORIZED);
}

export function forbidden(message = "Forbidden") {
  return errorResponse(403, message, API_ERROR_CODES.FORBIDDEN);
}

export function notFound(resource = "Resource") {
  return errorResponse(404, `${resource} not found`, API_ERROR_CODES.NOT_FOUND);
}

export function badRequest(message: string, details?: unknown) {
  return errorResponse(400, message, API_ERROR_CODES.INVALID_REQUEST, details);
}

export function validationError(details: unknown) {
  return errorResponse(400, "Validation failed", API_ERROR_CODES.VALIDATION_FAILED, details);
}

export function conflict(message: string) {
  return errorResponse(409, message, API_ERROR_CODES.CONFLICT);
}

export function rateLimited(retryAfter = 60) {
  const response = errorResponse(429, "Too many requests", API_ERROR_CODES.RATE_LIMITED);
  response.headers.set("Retry-After", retryAfter.toString());
  return response;
}

export function serverError(message = "Internal server error") {
  return errorResponse(500, message, API_ERROR_CODES.INTERNAL_ERROR);
}

// =============================================================================
// SUCCESS RESPONSES
// =============================================================================

export function successResponse<T>(
  data: T,
  status = 200,
  customHeaders?: Record<string, string>
): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: getApiHeaders(customHeaders),
  });
}

export function createdResponse<T>(data: T): NextResponse<T> {
  return successResponse(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getApiHeaders(),
  });
}

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = defaults;
  
  let page = parseInt(searchParams.get("page") || String(defaultPage), 10);
  let limit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  
  // Ensure valid values
  if (isNaN(page) || page < 1) page = defaultPage;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  
  return { page, limit };
}

export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

// =============================================================================
// UTILITIES
// =============================================================================

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create standard list response with pagination
 */
export function listResponse<T>(
  items: T[],
  pagination: PaginationMeta,
  resourceName: string
): NextResponse {
  return successResponse({
    [resourceName]: items,
    pagination,
  });
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(id);
}

/**
 * Extract and validate ID from params
 */
export function validateId(id: string, resourceName = "Resource"): NextResponse | null {
  if (!isValidUUID(id)) {
    return errorResponse(400, `Invalid ${resourceName} ID format`, API_ERROR_CODES.INVALID_FORMAT);
  }
  return null;
}

