/**
 * CAI Intake - OCR Result Caching
 * 
 * Caches AI parsing results to avoid re-processing identical images.
 * Uses content hash (SHA-256) for lookup.
 * 
 * Cache Strategy:
 * - In-memory LRU cache for fast access (100 entries)
 * - Optional Redis/KV store for distributed caching
 * - 24-hour TTL to handle model updates
 */

import crypto from "crypto";
import { logger } from "@/lib/logger";
import type { ParsedPartResult } from "./provider";

// ============================================================
// TYPES
// ============================================================

export interface CachedOCRResult {
  /** Content hash of the image */
  hash: string;
  /** Extracted parts */
  parts: ParsedPartResult[];
  /** Total confidence score */
  totalConfidence: number;
  /** AI provider used */
  provider: "anthropic" | "openai";
  /** Model used */
  model: string;
  /** Timestamp of cache entry */
  cachedAt: number;
  /** Original processing time (for metrics) */
  originalProcessingTimeMs: number;
  /** Hit count */
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  avgSavedTimeMs: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

/** Maximum cache entries (LRU eviction) */
const MAX_CACHE_ENTRIES = 100;

/** Cache TTL in milliseconds (24 hours) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum confidence to cache (don't cache low-quality results) */
const MIN_CONFIDENCE_TO_CACHE = 0.7;

/** Minimum parts to cache (don't cache empty/failed results) */
const MIN_PARTS_TO_CACHE = 1;

// ============================================================
// LRU CACHE IMPLEMENTATION
// ============================================================

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}

// ============================================================
// OCR CACHE
// ============================================================

class OCRCache {
  private cache: LRUCache<string, CachedOCRResult>;
  private stats: {
    hits: number;
    misses: number;
    totalSavedTimeMs: number;
  };

  constructor() {
    this.cache = new LRUCache(MAX_CACHE_ENTRIES);
    this.stats = {
      hits: 0,
      misses: 0,
      totalSavedTimeMs: 0,
    };
  }

  /**
   * Generate a content hash for an image
   */
  hashImage(imageData: ArrayBuffer | string): string {
    let buffer: Buffer;
    
    if (typeof imageData === "string") {
      // Handle data URL
      const match = imageData.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        buffer = Buffer.from(match[1], "base64");
      } else {
        // Assume it's already base64
        buffer = Buffer.from(imageData, "base64");
      }
    } else {
      buffer = Buffer.from(imageData);
    }
    
    return crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 16);
  }

  /**
   * Get cached result for an image
   */
  get(imageData: ArrayBuffer | string): CachedOCRResult | null {
    const hash = this.hashImage(imageData);
    const cached = this.cache.get(hash);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      this.cache.delete(hash);
      this.stats.misses++;
      logger.debug("🗑️ [OCRCache] Cache entry expired", { hash });
      return null;
    }
    
    // Update hit count and stats
    cached.hitCount++;
    this.stats.hits++;
    this.stats.totalSavedTimeMs += cached.originalProcessingTimeMs;
    
    logger.info("✅ [OCRCache] Cache HIT!", {
      hash,
      partsCount: cached.parts.length,
      hitCount: cached.hitCount,
      savedTimeMs: cached.originalProcessingTimeMs,
      provider: cached.provider,
    });
    
    return cached;
  }

  /**
   * Cache a successful parsing result
   */
  set(
    imageData: ArrayBuffer | string,
    parts: ParsedPartResult[],
    totalConfidence: number,
    provider: "anthropic" | "openai",
    model: string,
    processingTimeMs: number
  ): boolean {
    // Validate result before caching
    if (parts.length < MIN_PARTS_TO_CACHE) {
      logger.debug("⏭️ [OCRCache] Not caching - too few parts", { partsCount: parts.length });
      return false;
    }
    
    if (totalConfidence < MIN_CONFIDENCE_TO_CACHE) {
      logger.debug("⏭️ [OCRCache] Not caching - low confidence", { confidence: totalConfidence });
      return false;
    }
    
    const hash = this.hashImage(imageData);
    
    const entry: CachedOCRResult = {
      hash,
      parts,
      totalConfidence,
      provider,
      model,
      cachedAt: Date.now(),
      originalProcessingTimeMs: processingTimeMs,
      hitCount: 0,
    };
    
    this.cache.set(hash, entry);
    
    logger.info("💾 [OCRCache] Result cached", {
      hash,
      partsCount: parts.length,
      confidence: totalConfidence.toFixed(2),
      processingTimeMs,
      cacheSize: this.cache.size,
    });
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      entries: this.cache.size,
      avgSavedTimeMs: this.stats.hits > 0 
        ? this.stats.totalSavedTimeMs / this.stats.hits 
        : 0,
    };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    logger.info("🧹 [OCRCache] Cache cleared");
  }

  /**
   * Invalidate cache for a specific image
   */
  invalidate(imageData: ArrayBuffer | string): boolean {
    const hash = this.hashImage(imageData);
    return this.cache.delete(hash);
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();
    
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > CACHE_TTL_MS) {
        this.cache.delete(hash);
        pruned++;
      }
    }
    
    if (pruned > 0) {
      logger.info("🧹 [OCRCache] Pruned expired entries", { count: pruned });
    }
    
    return pruned;
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let cacheInstance: OCRCache | null = null;

/**
 * Get the singleton OCR cache instance
 */
export function getOCRCache(): OCRCache {
  if (!cacheInstance) {
    cacheInstance = new OCRCache();
  }
  return cacheInstance;
}

/**
 * Reset the cache (for testing)
 */
export function resetOCRCache(): void {
  cacheInstance?.clear();
  cacheInstance = null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if an image is already cached
 */
export function isCached(imageData: ArrayBuffer | string): boolean {
  const cache = getOCRCache();
  const result = cache.get(imageData);
  return result !== null;
}

/**
 * Get cached result or return null
 */
export function getCachedResult(imageData: ArrayBuffer | string): CachedOCRResult | null {
  return getOCRCache().get(imageData);
}

/**
 * Cache a parsing result
 */
export function cacheResult(
  imageData: ArrayBuffer | string,
  parts: ParsedPartResult[],
  totalConfidence: number,
  provider: "anthropic" | "openai",
  model: string,
  processingTimeMs: number
): boolean {
  return getOCRCache().set(imageData, parts, totalConfidence, provider, model, processingTimeMs);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return getOCRCache().getStats();
}

