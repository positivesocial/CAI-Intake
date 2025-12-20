/**
 * CAI Intake - Security Utilities
 * 
 * Provides security helpers for input sanitization, CSRF protection,
 * and other security-related functionality.
 */

import { createHmac, randomBytes } from "crypto";

// =============================================================================
// INPUT SANITIZATION
// =============================================================================

/**
 * Sanitize a string for use in SQL LIKE/ILIKE patterns
 * Escapes special characters: %, _, and \
 */
export function sanitizeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Sanitize a string for safe database queries
 * Removes potentially dangerous characters
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove other control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Validate and sanitize an email address
 */
export function sanitizeEmail(email: string): string | null {
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(sanitized) ? sanitized : null;
}

/**
 * Sanitize HTML to prevent XSS
 * For display in safe contexts - removes all HTML tags
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// CSRF PROTECTION
// =============================================================================

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || "default-csrf-secret-change-in-production";
const CSRF_TOKEN_EXPIRY = 3600 * 1000; // 1 hour

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString("hex");
  const data = `${sessionId}:${timestamp}:${random}`;
  const signature = createHmac("sha256", CSRF_SECRET)
    .update(data)
    .digest("hex")
    .slice(0, 32);
  
  return `${data}:${signature}`;
}

/**
 * Verify a CSRF token
 */
export function verifyCsrfToken(token: string, sessionId: string): boolean {
  try {
    const parts = token.split(":");
    if (parts.length !== 4) return false;
    
    const [tokenSessionId, timestamp, random, signature] = parts;
    
    // Check session ID matches
    if (tokenSessionId !== sessionId) return false;
    
    // Check token hasn't expired
    const tokenTime = parseInt(timestamp, 36);
    if (Date.now() - tokenTime > CSRF_TOKEN_EXPIRY) return false;
    
    // Verify signature
    const data = `${tokenSessionId}:${timestamp}:${random}`;
    const expectedSignature = createHmac("sha256", CSRF_SECRET)
      .update(data)
      .digest("hex")
      .slice(0, 32);
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

/**
 * Validate Content-Type header for JSON requests
 */
export function isValidJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.includes("application/json");
}

/**
 * Validate request origin against allowed origins
 */
export function isValidOrigin(
  origin: string | null,
  allowedOrigins: string[]
): boolean {
  if (!origin) return false;
  return allowedOrigins.some(
    (allowed) => origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, "")}`)
  );
}

/**
 * Get allowed origins from environment
 */
export function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const additionalOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  return [appUrl, ...additionalOrigins].filter(Boolean);
}

// =============================================================================
// SENSITIVE DATA HANDLING
// =============================================================================

/**
 * Mask sensitive data for logging/display
 */
export function maskSensitiveData(data: string, visibleChars = 4): string {
  if (data.length <= visibleChars * 2) {
    return "*".repeat(data.length);
  }
  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = "*".repeat(Math.min(data.length - visibleChars * 2, 8));
  return `${start}${masked}${end}`;
}

/**
 * Check if a string looks like a JWT token
 */
export function isJwtToken(value: string): boolean {
  return /^eyJ[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*$/.test(value);
}

/**
 * Check if a value contains sensitive data
 */
export function containsSensitiveData(value: unknown): boolean {
  if (typeof value !== "string") return false;
  
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /api[_-]?key/i,
    /token/i,
    /auth/i,
    /credit[_-]?card/i,
    /ssn/i,
  ];
  
  return sensitivePatterns.some((pattern) => pattern.test(value)) || isJwtToken(value);
}

// =============================================================================
// SIZE LIMITS
// =============================================================================

export const SIZE_LIMITS = {
  /** Maximum text content for parsing (1MB) */
  TEXT_CONTENT: 1_000_000,
  
  /** Maximum file upload size (50MB) */
  FILE_UPLOAD: 50 * 1024 * 1024,
  
  /** Maximum JSON payload size (10MB) */
  JSON_PAYLOAD: 10 * 1024 * 1024,
  
  /** Maximum parts per cutlist */
  PARTS_PER_CUTLIST: 10_000,
  
  /** Maximum materials per organization */
  MATERIALS_PER_ORG: 1_000,
  
  /** Maximum search query length */
  SEARCH_QUERY: 500,
  
  /** Maximum label length */
  LABEL: 200,
  
  /** Maximum notes length */
  NOTES: 5_000,
} as const;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate request body size
 */
export function isValidBodySize(body: string, maxSize = SIZE_LIMITS.JSON_PAYLOAD): boolean {
  return Buffer.byteLength(body, "utf-8") <= maxSize;
}

/**
 * Validate UUID format
 */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validate CUID format (Prisma default IDs)
 */
export function isValidCuid(value: string): boolean {
  return /^c[a-z0-9]{24}$/.test(value);
}

/**
 * Validate ID format (either UUID or CUID)
 */
export function isValidId(value: string): boolean {
  return isValidUuid(value) || isValidCuid(value);
}

