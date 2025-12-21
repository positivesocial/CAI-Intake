/**
 * CAI Intake - Rate Limiter
 * 
 * Implements rate limiting for API routes using in-memory storage.
 * For production, consider using Upstash Redis or similar.
 */

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimiterConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

// =============================================================================
// IN-MEMORY STORE (Replace with Redis in production)
// =============================================================================

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// =============================================================================
// RATE LIMITER PRESETS
// =============================================================================

export const RATE_LIMITS = {
  /** Standard API rate limit: 60 requests per minute */
  api: { limit: 60, windowSec: 60 },
  
  /** Auth rate limit: 10 attempts per minute (brute force protection) */
  auth: { limit: 10, windowSec: 60 },
  
  /** Parse jobs: 100 per hour */
  parseJobs: { limit: 100, windowSec: 3600 },
  
  /** File uploads: 20 per minute */
  uploads: { limit: 20, windowSec: 60 },
  
  /** AI parsing: 30 per hour (expensive operations) */
  aiParsing: { limit: 30, windowSec: 3600 },
  
  /** Export operations: 10 per minute */
  exports: { limit: 10, windowSec: 60 },
  
  /** Webhook callbacks: 1000 per minute */
  webhooks: { limit: 1000, windowSec: 60 },
} as const;

// =============================================================================
// RATE LIMITER CLASS
// =============================================================================

export class RateLimiter {
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier (userId, IP address, etc.)
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = `rate:${identifier}`;
    const now = Date.now();
    const windowMs = this.config.windowSec * 1000;
    
    let entry = store.get(key);
    
    // If no entry or window expired, create new entry
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(key, entry);
      
      return {
        success: true,
        limit: this.config.limit,
        remaining: this.config.limit - 1,
        reset: entry.resetAt,
      };
    }
    
    // Increment counter
    entry.count++;
    store.set(key, entry);
    
    const remaining = Math.max(0, this.config.limit - entry.count);
    const success = entry.count <= this.config.limit;
    
    return {
      success,
      limit: this.config.limit,
      remaining,
      reset: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `rate:${identifier}`;
    store.delete(key);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a rate limiter with preset configuration
 */
export function createRateLimiter(preset: keyof typeof RATE_LIMITS): RateLimiter {
  return new RateLimiter(RATE_LIMITS[preset]);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
    "Retry-After": result.success ? "" : Math.ceil((result.reset - Date.now()) / 1000).toString(),
  };
}

/**
 * Check rate limit and return error response if exceeded
 */
export async function checkRateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMITS = "api"
): Promise<{ allowed: boolean; headers: Record<string, string>; result: RateLimitResult }> {
  const limiter = createRateLimiter(preset);
  const result = await limiter.check(identifier);
  const headers = getRateLimitHeaders(result);
  
  return {
    allowed: result.success,
    headers,
    result,
  };
}

// =============================================================================
// COMPOSITE RATE LIMITER
// =============================================================================

/**
 * Create identifier from request context
 */
export function createIdentifier(
  userId?: string | null,
  ip?: string | null,
  organizationId?: string | null
): string {
  if (userId) return `user:${userId}`;
  if (organizationId) return `org:${organizationId}`;
  if (ip) return `ip:${ip}`;
  return "anonymous";
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    null
  );
}



