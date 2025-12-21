/**
 * CAI Intake - File Cache Service
 * 
 * Caches OCR/parsing results by file hash to avoid reprocessing.
 * Uses a combination of in-memory cache and database storage.
 */

import { createClient } from "@/lib/supabase/server";
import type { CutPart } from "@/lib/schema";
import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

export interface CachedParseResult {
  /** Hash of the original file */
  fileHash: string;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSizeBytes: number;
  /** MIME type */
  mimeType: string;
  /** Parsed parts */
  parts: CutPart[];
  /** Parse metadata */
  metadata: {
    parseMethod: string;
    confidence: number;
    templateDetected?: boolean;
    templateId?: string;
    processingTimeMs: number;
  };
  /** When the result was cached */
  cachedAt: number;
  /** Cache TTL (time-to-live) in ms */
  ttlMs: number;
  /** Hit count for cache analytics */
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  memoryEntries: number;
  databaseEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

/** Default cache TTL: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum memory cache size */
const MAX_MEMORY_CACHE_SIZE = 100;

/** Memory cache cleanup interval */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================
// IN-MEMORY CACHE
// ============================================================

const globalForCache = globalThis as unknown as {
  fileCache: Map<string, CachedParseResult> | undefined;
  cacheStats: { hits: number; misses: number } | undefined;
  cacheCleanupInterval: NodeJS.Timeout | undefined;
};

if (!globalForCache.fileCache) {
  globalForCache.fileCache = new Map();
}

if (!globalForCache.cacheStats) {
  globalForCache.cacheStats = { hits: 0, misses: 0 };
}

const memoryCache = globalForCache.fileCache;
const stats = globalForCache.cacheStats;

// ============================================================
// HASH COMPUTATION
// ============================================================

/**
 * Compute SHA-256 hash of file content
 */
export async function computeFileHash(file: File | ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else if (file instanceof ArrayBuffer) {
    buffer = file;
  } else {
    // Convert Uint8Array to ArrayBuffer
    buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  }
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute hash from file metadata (faster but less accurate)
 */
export function computeQuickHash(fileName: string, fileSize: number, mimeType: string): string {
  const data = `${fileName}|${fileSize}|${mimeType}`;
  // Simple hash for quick lookups (not cryptographic)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `quick_${Math.abs(hash).toString(16)}`;
}

// ============================================================
// CACHE OPERATIONS
// ============================================================

/**
 * Get cached result by file hash
 */
export async function getCachedResult(
  fileHash: string,
  options?: { checkDatabase?: boolean }
): Promise<CachedParseResult | null> {
  // Check memory cache first
  const memoryCached = memoryCache.get(fileHash);
  
  if (memoryCached) {
    // Check if expired
    if (Date.now() < memoryCached.cachedAt + memoryCached.ttlMs) {
      memoryCached.hitCount++;
      stats.hits++;
      return memoryCached;
    } else {
      // Expired, remove
      memoryCache.delete(fileHash);
    }
  }
  
  // Check database if enabled
  if (options?.checkDatabase !== false) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("file_cache")
        .select("*")
        .eq("file_hash", fileHash)
        .single();
      
      if (!error && data) {
        const cached = data as CachedParseResult;
        
        // Check if expired
        if (Date.now() < cached.cachedAt + cached.ttlMs) {
          // Restore to memory cache
          cached.hitCount++;
          memoryCache.set(fileHash, cached);
          
          // Update hit count in database (fire and forget)
          supabase
            .from("file_cache")
            .update({ hit_count: cached.hitCount })
            .eq("file_hash", fileHash)
            .then(() => {});
          
          stats.hits++;
          return cached;
        } else {
          // Expired, delete from database (fire and forget)
          supabase
            .from("file_cache")
            .delete()
            .eq("file_hash", fileHash)
            .then(() => {});
        }
      }
    } catch (error) {
      logger.warn("Database cache lookup failed", { error });
    }
  }
  
  stats.misses++;
  return null;
}

/**
 * Cache a parse result
 */
export async function setCachedResult(
  fileHash: string,
  file: { name: string; size: number; type: string },
  result: {
    parts: CutPart[];
    parseMethod: string;
    confidence: number;
    templateDetected?: boolean;
    templateId?: string;
    processingTimeMs: number;
  },
  options?: {
    ttlMs?: number;
    persistToDatabase?: boolean;
    orgId?: string;
  }
): Promise<void> {
  const cached: CachedParseResult = {
    fileHash,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type,
    parts: result.parts,
    metadata: {
      parseMethod: result.parseMethod,
      confidence: result.confidence,
      templateDetected: result.templateDetected,
      templateId: result.templateId,
      processingTimeMs: result.processingTimeMs,
    },
    cachedAt: Date.now(),
    ttlMs: options?.ttlMs ?? DEFAULT_TTL_MS,
    hitCount: 0,
  };
  
  // Store in memory cache
  memoryCache.set(fileHash, cached);
  
  // Trim memory cache if too large
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    trimMemoryCache();
  }
  
  // Persist to database if enabled
  if (options?.persistToDatabase !== false && options?.orgId) {
    try {
      const supabase = await createClient();
      await supabase
        .from("file_cache")
        .upsert({
          file_hash: fileHash,
          org_id: options.orgId,
          file_name: cached.fileName,
          file_size_bytes: cached.fileSizeBytes,
          mime_type: cached.mimeType,
          parts: cached.parts,
          metadata: cached.metadata,
          cached_at: cached.cachedAt,
          ttl_ms: cached.ttlMs,
          hit_count: cached.hitCount,
        });
    } catch (error) {
      logger.warn("Failed to persist cache to database", { error });
    }
  }
}

/**
 * Delete cached result
 */
export async function deleteCachedResult(
  fileHash: string,
  options?: { deleteFromDatabase?: boolean }
): Promise<void> {
  memoryCache.delete(fileHash);
  
  if (options?.deleteFromDatabase !== false) {
    try {
      const supabase = await createClient();
      await supabase
        .from("file_cache")
        .delete()
        .eq("file_hash", fileHash);
    } catch (error) {
      logger.warn("Failed to delete from database cache", { error });
    }
  }
}

/**
 * Clear all cache entries
 */
export async function clearCache(
  options?: { clearDatabase?: boolean; orgId?: string }
): Promise<void> {
  memoryCache.clear();
  stats.hits = 0;
  stats.misses = 0;
  
  if (options?.clearDatabase) {
    try {
      const supabase = await createClient();
      
      if (options.orgId) {
        await supabase
          .from("file_cache")
          .delete()
          .eq("org_id", options.orgId);
      } else {
        // Only allow full clear for admins
        logger.warn("Attempted to clear all cache without org filter");
      }
    } catch (error) {
      logger.warn("Failed to clear database cache", { error });
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const totalHits = stats.hits;
  const totalMisses = stats.misses;
  const total = totalHits + totalMisses;
  
  return {
    totalEntries: memoryCache.size,
    memoryEntries: memoryCache.size,
    databaseEntries: 0, // Would need a count query
    totalHits,
    totalMisses,
    hitRate: total > 0 ? totalHits / total : 0,
  };
}

// ============================================================
// CACHE MAINTENANCE
// ============================================================

/**
 * Trim memory cache to MAX_MEMORY_CACHE_SIZE
 */
function trimMemoryCache(): void {
  if (memoryCache.size <= MAX_MEMORY_CACHE_SIZE) return;
  
  // Sort by last access (cachedAt + hitCount as proxy)
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => {
      const scoreA = a[1].cachedAt + a[1].hitCount * 60000;
      const scoreB = b[1].cachedAt + b[1].hitCount * 60000;
      return scoreA - scoreB;
    });
  
  // Remove oldest entries
  const toRemove = entries.slice(0, entries.length - MAX_MEMORY_CACHE_SIZE);
  for (const [hash] of toRemove) {
    memoryCache.delete(hash);
  }
}

/**
 * Remove expired entries from memory cache
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expired: string[] = [];
  
  for (const [hash, cached] of memoryCache.entries()) {
    if (now >= cached.cachedAt + cached.ttlMs) {
      expired.push(hash);
    }
  }
  
  for (const hash of expired) {
    memoryCache.delete(hash);
  }
  
  if (expired.length > 0) {
    logger.info(`[FileCache] Cleaned up ${expired.length} expired entries`);
  }
}

// Start cleanup interval
if (typeof globalForCache.cacheCleanupInterval === "undefined") {
  if (typeof setInterval !== "undefined") {
    globalForCache.cacheCleanupInterval = setInterval(
      cleanupExpiredEntries,
      CLEANUP_INTERVAL_MS
    );
    
    if (globalForCache.cacheCleanupInterval.unref) {
      globalForCache.cacheCleanupInterval.unref();
    }
  }
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Get or compute cache result (cache-aside pattern)
 */
export async function getOrComputeResult(
  file: File,
  computeFn: () => Promise<{
    parts: CutPart[];
    parseMethod: string;
    confidence: number;
    templateDetected?: boolean;
    templateId?: string;
  }>,
  options?: {
    orgId?: string;
    ttlMs?: number;
    skipCache?: boolean;
  }
): Promise<{ parts: CutPart[]; fromCache: boolean; processingTimeMs: number }> {
  const startTime = Date.now();
  
  // Skip cache if requested
  if (options?.skipCache) {
    const result = await computeFn();
    return {
      parts: result.parts,
      fromCache: false,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Compute file hash
  const fileHash = await computeFileHash(file);
  
  // Check cache
  const cached = await getCachedResult(fileHash);
  
  if (cached) {
    return {
      parts: cached.parts,
      fromCache: true,
      processingTimeMs: 0, // Instant from cache
    };
  }
  
  // Compute result
  const result = await computeFn();
  const processingTimeMs = Date.now() - startTime;
  
  // Cache the result
  await setCachedResult(
    fileHash,
    { name: file.name, size: file.size, type: file.type },
    { ...result, processingTimeMs },
    { orgId: options?.orgId, ttlMs: options?.ttlMs }
  );
  
  return {
    parts: result.parts,
    fromCache: false,
    processingTimeMs,
  };
}

