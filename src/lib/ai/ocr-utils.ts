/**
 * CAI Intake - Enterprise-Grade OCR Utilities
 * 
 * Provides robust utilities for OCR operations:
 * - Retry with exponential backoff
 * - Truncation detection
 * - Part count estimation
 * - Rate limiting
 * - Error classification
 */

import { logger } from "@/lib/logger";
import { parseAIResponseJSON } from "./provider";

// ============================================================
// TYPES
// ============================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: Error) => boolean;
}

export interface TruncationResult {
  isTruncated: boolean;
  reason?: string;
  partialParts?: number;
  expectedParts?: number;
}

export interface RateLimitConfig {
  maxTokensPerMinute: number;
  maxRequestsPerMinute: number;
}

export type ErrorCategory = 
  | "NETWORK_ERROR"
  | "RATE_LIMIT"
  | "TRUNCATION"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "CONTENT_FILTER"
  | "API_ERROR"
  | "UNKNOWN";

// ============================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOn: () => true,
};

/**
 * Execute an operation with retry logic and exponential backoff.
 * 
 * @example
 * const result = await withRetry(
 *   () => aiProvider.parseImage(image),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry this error
      if (!config.retryOn(lastError)) {
        throw lastError;
      }
      
      // Check if we've exhausted retries
      if (attempt === config.maxRetries) {
        logger.error("🔄 [Retry] All retries exhausted", {
          attempts: attempt + 1,
          lastError: lastError.message,
        });
        throw lastError;
      }
      
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);
      
      logger.warn("🔄 [Retry] Attempt failed, retrying...", {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delayMs: Math.round(delay),
        error: lastError.message,
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError || new Error("Unknown error in retry");
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// ERROR CLASSIFICATION
// ============================================================

/**
 * Classify an error into a category for appropriate handling.
 */
export function classifyError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name?.toLowerCase() || "";
  
  // Network errors
  if (message.includes("network") || 
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("fetch failed")) {
    return "NETWORK_ERROR";
  }
  
  // Rate limits
  if (message.includes("rate limit") || 
      message.includes("429") ||
      message.includes("too many requests")) {
    return "RATE_LIMIT";
  }
  
  // Timeouts
  if (message.includes("timeout") ||
      message.includes("timed out") ||
      name.includes("timeout")) {
    return "TIMEOUT";
  }
  
  // Content filter / refusal
  if (message.includes("sorry") ||
      message.includes("can't assist") ||
      message.includes("cannot assist") ||
      message.includes("content policy") ||
      message.includes("refused")) {
    return "CONTENT_FILTER";
  }
  
  // Invalid response
  if (message.includes("json") ||
      message.includes("parse") ||
      message.includes("invalid response")) {
    return "INVALID_RESPONSE";
  }
  
  // API errors
  if (message.includes("api") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")) {
    return "API_ERROR";
  }
  
  return "UNKNOWN";
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const category = classifyError(error);
  
  // Don't retry content filter rejections
  if (category === "CONTENT_FILTER") {
    return false;
  }
  
  // Retry network, rate limit, timeout, and API errors
  return ["NETWORK_ERROR", "RATE_LIMIT", "TIMEOUT", "API_ERROR"].includes(category);
}

// ============================================================
// TRUNCATION DETECTION
// ============================================================

/**
 * Detect if an AI response was truncated.
 * 
 * Checks for:
 * - Incomplete JSON structure
 * - Missing closing brackets
 * - Suspiciously low part count
 * - Cut-off in middle of part
 */
export function detectTruncation(
  response: string,
  expectedMinParts?: number
): TruncationResult {
  const trimmed = response.trim();
  
  // Check 1: Empty or very short response
  if (!trimmed || trimmed.length < 10) {
    return {
      isTruncated: true,
      reason: "Response is empty or too short",
      partialParts: 0,
    };
  }
  
  // Check 2: Strip markdown fences and check for valid JSON terminator
  let cleanedResponse = trimmed;
  const openingFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*)/);
  if (openingFenceMatch) {
    cleanedResponse = openingFenceMatch[1].replace(/```\s*$/, "").trim();
  }
  
  if (!cleanedResponse.endsWith("]") && !cleanedResponse.endsWith("}")) {
    // Count how many parts we got before truncation
    const partMatches = cleanedResponse.match(/"row"\s*:/g) || [];
    return {
      isTruncated: true,
      reason: "Response ends without valid JSON terminator",
      partialParts: partMatches.length,
    };
  }
  
  // Check 3: Try to parse JSON using robust parser
  try {
    const parsed = parseAIResponseJSON<{ parts?: unknown[] } | unknown[]>(trimmed);
    if (!parsed) {
      const partMatches = cleanedResponse.match(/"row"\s*:/g) || [];
      return {
        isTruncated: true,
        reason: "Failed to parse response as JSON",
        partialParts: partMatches.length,
      };
    }
    const parts = Array.isArray(parsed) ? parsed : (parsed as { parts?: unknown[] })?.parts;
    
    if (!parts || !Array.isArray(parts)) {
      return {
        isTruncated: true,
        reason: "Response doesn't contain parts array",
        partialParts: 0,
      };
    }
    
    // Check 4: If we have an expected count, verify we got enough
    if (expectedMinParts && parts.length < expectedMinParts * 0.5) {
      return {
        isTruncated: true,
        reason: `Got ${parts.length} parts but expected at least ${Math.floor(expectedMinParts * 0.5)}`,
        partialParts: parts.length,
        expectedParts: expectedMinParts,
      };
    }
    
    // Check 5: Look for incomplete last part
    const lastPart = parts[parts.length - 1];
    if (lastPart && (!lastPart.length || !lastPart.width)) {
      return {
        isTruncated: true,
        reason: "Last part appears incomplete (missing dimensions)",
        partialParts: parts.length - 1,
      };
    }
    
    return { isTruncated: false };
    
  } catch {
    // Fallback - count row patterns
    const partMatches = cleanedResponse.match(/"row"\s*:/g) || [];
    return {
      isTruncated: true,
      reason: "Response parsing failed unexpectedly",
      partialParts: partMatches.length,
    };
  }
}

/**
 * Attempt to recover partial data from a truncated response.
 * 
 * This tries to extract as many complete parts as possible
 * from a truncated JSON response.
 */
export function recoverFromTruncation(response: string): unknown[] {
  const parts: unknown[] = [];
  
  // Try to find complete part objects
  const partRegex = /\{[^{}]*"length"\s*:\s*\d+[^{}]*"width"\s*:\s*\d+[^{}]*\}/g;
  const matches = response.match(partRegex);
  
  if (matches) {
    for (const match of matches) {
      try {
        const part = JSON.parse(match);
        if (part.length && part.width) {
          parts.push(part);
        }
      } catch {
        // Skip malformed parts
      }
    }
  }
  
  logger.info("🔧 [Recovery] Recovered parts from truncated response", {
    recoveredParts: parts.length,
    originalLength: response.length,
  });
  
  return parts;
}

// ============================================================
// PART COUNT ESTIMATION
// ============================================================

/**
 * Quick estimation prompt for counting items.
 * Used to verify extraction completeness.
 */
export const PART_COUNT_ESTIMATION_PROMPT = `
Count the TOTAL number of numbered items/rows in this image.

Instructions:
1. Scan ALL columns (left, middle, right)
2. Scan ALL sections (if there are section headers like "CARCASES", "DOORS", etc.)
3. Count every numbered item (①, ②, (1), (2), 1., 2., etc.)
4. If items aren't numbered, count each line with dimensions

Return ONLY a JSON object: {"estimatedCount": NUMBER, "sections": ["section1", "section2"]}
`.trim();

export interface PartCountEstimate {
  estimatedCount: number;
  sections: string[];
  confidence: number;
}

/**
 * Parse the part count estimation response.
 */
export function parsePartCountEstimate(response: string): PartCountEstimate {
  try {
    const parsed = JSON.parse(response);
    return {
      estimatedCount: parsed.estimatedCount || 0,
      sections: parsed.sections || [],
      confidence: 0.8,
    };
  } catch {
    // Try to extract just a number
    const match = response.match(/\d+/);
    return {
      estimatedCount: match ? parseInt(match[0], 10) : 0,
      sections: [],
      confidence: 0.5,
    };
  }
}

// ============================================================
// RATE LIMITER
// ============================================================

/**
 * Token bucket rate limiter for API calls.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  
  constructor(config: RateLimitConfig) {
    // Convert requests per minute to tokens per second
    this.maxTokens = config.maxRequestsPerMinute;
    this.refillRate = config.maxRequestsPerMinute / 60;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  /**
   * Acquire tokens (wait if necessary).
   * 
   * @param cost Number of tokens to acquire (default: 1)
   */
  async acquire(cost: number = 1): Promise<void> {
    this.refill();
    
    while (this.tokens < cost) {
      const waitTime = ((cost - this.tokens) / this.refillRate) * 1000;
      await sleep(Math.min(waitTime + 100, 5000)); // Wait at most 5 seconds
      this.refill();
    }
    
    this.tokens -= cost;
  }
  
  /**
   * Check if we can acquire without waiting.
   */
  canAcquire(cost: number = 1): boolean {
    this.refill();
    return this.tokens >= cost;
  }
  
  /**
   * Get current available tokens.
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Global rate limiters for each provider
export const rateLimiters = {
  anthropic: new RateLimiter({ maxTokensPerMinute: 100000, maxRequestsPerMinute: 50 }),
  openai: new RateLimiter({ maxTokensPerMinute: 150000, maxRequestsPerMinute: 100 }),
};

// ============================================================
// RESPONSE QUALITY METRICS
// ============================================================

export interface QualityMetrics {
  partsExtracted: number;
  avgConfidence: number;
  lowConfidenceCount: number;
  suspiciousDimensions: number;
  highQuantityCount: number;
  missingFields: number;
  qualityScore: number; // 0-100
}

/**
 * Normalize a part to get length, width, quantity regardless of source format.
 * Handles both AI response format (length/width/quantity) and CutPart format (size.L/size.W/qty).
 */
function normalizePartForMetrics(part: Record<string, unknown>): {
  length: number;
  width: number;
  quantity: number;
  confidence: number;
} {
  // Try CutPart format first (size.L/size.W/qty)
  const size = part.size as { L?: number; W?: number } | undefined;
  if (size && (size.L || size.W)) {
    return {
      length: size.L || 0,
      width: size.W || 0,
      quantity: (part.qty as number) || 1,
      confidence: (part.confidence as number) ?? 0.8,
    };
  }
  
  // Fall back to AI response format (length/width/quantity)
  return {
    length: (part.length as number) || 0,
    width: (part.width as number) || 0,
    quantity: (part.quantity as number) || 1,
    confidence: (part.confidence as number) ?? 0.8,
  };
}

/**
 * Calculate quality metrics for extracted parts.
 * Accepts both AI response format and CutPart format.
 */
export function calculateQualityMetrics(parts: unknown[]): QualityMetrics {
  if (!parts || parts.length === 0) {
    return {
      partsExtracted: 0,
      avgConfidence: 0,
      lowConfidenceCount: 0,
      suspiciousDimensions: 0,
      highQuantityCount: 0,
      missingFields: 0,
      qualityScore: 0,
    };
  }
  
  let totalConfidence = 0;
  let lowConfidenceCount = 0;
  let suspiciousDimensions = 0;
  let highQuantityCount = 0;
  let missingFields = 0;
  
  for (const rawPart of parts) {
    const part = normalizePartForMetrics(rawPart as Record<string, unknown>);
    
    // Confidence
    totalConfidence += part.confidence;
    if (part.confidence < 0.7) lowConfidenceCount++;
    
    // Suspicious dimensions (too large or too small)
    if (part.length > 3500 || part.length < 30) suspiciousDimensions++;
    if (part.width > 1800 || part.width < 30) suspiciousDimensions++;
    
    // High quantity
    if (part.quantity > 100) highQuantityCount++;
    
    // Missing critical fields
    if (!part.length || !part.width) missingFields++;
  }
  
  const avgConfidence = totalConfidence / parts.length;
  
  // Calculate quality score (0-100)
  let qualityScore = 100;
  qualityScore -= lowConfidenceCount * 3; // -3 per low confidence part
  qualityScore -= suspiciousDimensions * 5; // -5 per suspicious dimension
  qualityScore -= highQuantityCount * 2; // -2 per high quantity
  qualityScore -= missingFields * 10; // -10 per missing field
  qualityScore = Math.max(0, Math.min(100, qualityScore));
  
  return {
    partsExtracted: parts.length,
    avgConfidence,
    lowConfidenceCount,
    suspiciousDimensions,
    highQuantityCount,
    missingFields,
    qualityScore: Math.round(qualityScore),
  };
}

