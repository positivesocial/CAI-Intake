/**
 * CAI Intake - Rate Limiter
 * 
 * Implements rate limiting for API routes with:
 * - In-memory storage for fast checks
 * - Per-org/per-user custom limits from database
 * - Burst protection
 * - Rate limit headers
 */

import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
  burstCount?: number;
  burstResetAt?: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface RateLimiterConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
  /** Maximum burst requests (optional) */
  burstLimit?: number;
  /** Burst window in seconds (optional, default 1) */
  burstWindowSec?: number;
}

/** Database-backed rate limit config */
interface CustomRateLimit {
  endpoint: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  burstWindowSeconds: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

/** Cache for custom rate limits */
const customLimitsCache = new Map<string, { config: CustomRateLimit | null; fetchedAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

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

// =============================================================================
// PRODUCTION RATE LIMITER WITH CUSTOM ORG/USER LIMITS
// =============================================================================

/**
 * Get custom rate limits for an organization or user from database
 */
export async function getCustomRateLimit(
  organizationId?: string | null,
  userId?: string | null,
  endpoint = "*"
): Promise<CustomRateLimit | null> {
  // Check cache first
  const cacheKey = `${organizationId || ""}:${userId || ""}:${endpoint}`;
  const cached = customLimitsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Build query for custom rate limits
    let query = supabase
      .from("rate_limits")
      .select("*")
      .eq("is_active", true)
      .order("endpoint", { ascending: false }); // More specific endpoints first
    
    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    
    // Filter by endpoint pattern
    query = query.or(`endpoint.eq.*,endpoint.eq.${endpoint}`);
    
    const { data, error } = await query.limit(1);
    
    if (error) {
      logger.warn("Failed to fetch custom rate limits", { error });
      customLimitsCache.set(cacheKey, { config: null, fetchedAt: Date.now() });
      return null;
    }
    
    if (!data || data.length === 0) {
      customLimitsCache.set(cacheKey, { config: null, fetchedAt: Date.now() });
      return null;
    }
    
    const limit = data[0];
    const config: CustomRateLimit = {
      endpoint: limit.endpoint,
      requestsPerMinute: limit.requests_per_minute,
      requestsPerHour: limit.requests_per_hour,
      requestsPerDay: limit.requests_per_day,
      burstLimit: limit.burst_limit || 10,
      burstWindowSeconds: limit.burst_window_seconds || 1,
      tokensPerMinute: limit.tokens_per_minute,
      tokensPerDay: limit.tokens_per_day,
    };
    
    customLimitsCache.set(cacheKey, { config, fetchedAt: Date.now() });
    return config;
  } catch (error) {
    logger.error("Error fetching custom rate limits", { error });
    customLimitsCache.set(cacheKey, { config: null, fetchedAt: Date.now() });
    return null;
  }
}

/**
 * Advanced rate limiter that combines presets with custom org/user limits
 */
export async function checkAdvancedRateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMITS = "api",
  options?: {
    organizationId?: string | null;
    userId?: string | null;
    endpoint?: string;
    tokensUsed?: number;
  }
): Promise<{ allowed: boolean; headers: Record<string, string>; result: RateLimitResult }> {
  // First check burst limit (very short window)
  const burstKey = `burst:${identifier}`;
  const burstEntry = store.get(burstKey);
  const now = Date.now();
  
  // Get custom limits if available
  let customConfig: CustomRateLimit | null = null;
  if (options?.organizationId || options?.userId) {
    customConfig = await getCustomRateLimit(
      options.organizationId,
      options.userId,
      options.endpoint
    );
  }
  
  // Determine burst limits
  const burstLimit = customConfig?.burstLimit || 10;
  const burstWindowMs = (customConfig?.burstWindowSeconds || 1) * 1000;
  
  // Check burst rate
  if (burstEntry && burstEntry.resetAt > now) {
    if (burstEntry.count >= burstLimit) {
      const retryAfter = Math.ceil((burstEntry.resetAt - now) / 1000);
      return {
        allowed: false,
        headers: {
          "X-RateLimit-Limit": burstLimit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": burstEntry.resetAt.toString(),
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Type": "burst",
        },
        result: {
          success: false,
          limit: burstLimit,
          remaining: 0,
          reset: burstEntry.resetAt,
          retryAfter,
        },
      };
    }
    burstEntry.count++;
    store.set(burstKey, burstEntry);
  } else {
    store.set(burstKey, { count: 1, resetAt: now + burstWindowMs });
  }
  
  // Determine the effective rate limit config
  let config: RateLimiterConfig;
  if (customConfig) {
    // Use custom per-minute limit
    config = {
      limit: customConfig.requestsPerMinute,
      windowSec: 60,
    };
  } else {
    config = RATE_LIMITS[preset];
  }
  
  // Check main rate limit
  const limiter = new RateLimiter(config);
  const result = await limiter.check(identifier);
  
  // Also check hourly limit if custom config has it
  if (customConfig && customConfig.requestsPerHour) {
    const hourlyLimiter = new RateLimiter({
      limit: customConfig.requestsPerHour,
      windowSec: 3600,
    });
    const hourlyResult = await hourlyLimiter.check(`hourly:${identifier}`);
    
    if (!hourlyResult.success) {
      const retryAfter = Math.ceil((hourlyResult.reset - now) / 1000);
      return {
        allowed: false,
        headers: {
          "X-RateLimit-Limit": hourlyResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": hourlyResult.reset.toString(),
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Type": "hourly",
        },
        result: {
          success: false,
          limit: hourlyResult.limit,
          remaining: 0,
          reset: hourlyResult.reset,
          retryAfter,
        },
      };
    }
  }
  
  // Track token usage if provided
  if (options?.tokensUsed && customConfig?.tokensPerMinute) {
    const tokenKey = `tokens:${identifier}`;
    const tokenEntry = store.get(tokenKey);
    
    if (tokenEntry && tokenEntry.resetAt > now) {
      tokenEntry.count += options.tokensUsed;
      if (tokenEntry.count > customConfig.tokensPerMinute) {
        const retryAfter = Math.ceil((tokenEntry.resetAt - now) / 1000);
        return {
          allowed: false,
          headers: {
            "X-RateLimit-Type": "tokens",
            "X-RateLimit-Tokens-Limit": customConfig.tokensPerMinute.toString(),
            "X-RateLimit-Tokens-Remaining": "0",
            "Retry-After": retryAfter.toString(),
          },
          result: {
            success: false,
            limit: customConfig.tokensPerMinute,
            remaining: 0,
            reset: tokenEntry.resetAt,
            retryAfter,
          },
        };
      }
      store.set(tokenKey, tokenEntry);
    } else {
      store.set(tokenKey, { count: options.tokensUsed, resetAt: now + 60000 });
    }
  }
  
  return {
    allowed: result.success,
    headers: getRateLimitHeaders(result),
    result,
  };
}

/**
 * Record rate limit tracking to database (for analytics)
 */
export async function recordRateLimitEvent(
  organizationId: string | null,
  userId: string | null,
  endpoint: string,
  wasLimited: boolean,
  tokenCount = 0
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - (now.getMinutes() % 5) * 60000);
    windowStart.setSeconds(0, 0);
    
    // Upsert tracking record
    await supabase.from("rate_limit_tracking").upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        endpoint,
        window_start: windowStart.toISOString(),
        window_type: "minute",
        request_count: 1,
        token_count: tokenCount,
      },
      {
        onConflict: "organization_id,user_id,ip_address,endpoint,window_start,window_type",
        ignoreDuplicates: false,
      }
    );
    
    if (wasLimited) {
      // Log rate limit exceeded events
      logger.warn("Rate limit exceeded", {
        organizationId: organizationId ?? undefined,
        userId: userId ?? undefined,
        endpoint,
      });
    }
  } catch (error) {
    // Non-critical, log and continue
    logger.warn("Failed to record rate limit event", { error });
  }
}

/**
 * Clear rate limit cache (useful for testing or when limits are updated)
 */
export function clearRateLimitCache(): void {
  customLimitsCache.clear();
  store.clear();
}


