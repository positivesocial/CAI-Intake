/**
 * CAI Intake - OCR Optimization Utilities
 * 
 * Provides intelligent optimizations for OCR processing:
 * - Adaptive image compression based on content complexity
 * - Parallel provider racing for faster responses
 * - Smart request batching
 * 
 * NOTE: This module uses sharp which is server-only.
 * All functions check for server-side execution.
 */

import { logger } from "@/lib/logger";

// Lazy load sharp to avoid client-side issues
async function getSharp() {
  if (typeof window !== "undefined") {
    throw new Error("Sharp can only be used on the server");
  }
  const sharpModule = await import("sharp");
  return sharpModule.default;
}

// ============================================================
// IMAGE COMPLEXITY ANALYSIS
// ============================================================

export interface ImageAnalysis {
  /** Detected content type */
  contentType: "printed" | "handwritten" | "mixed" | "photo" | "unknown";
  /** Complexity score (0-1) - higher = more complex */
  complexity: number;
  /** Whether image contains tables */
  hasTable: boolean;
  /** Estimated text density */
  textDensity: "sparse" | "normal" | "dense";
  /** Recommended settings */
  recommendations: {
    maxDimension: number;
    quality: number;
    format: "jpeg" | "png";
  };
}

/**
 * Analyze image characteristics to determine optimal processing settings
 * Uses edge detection and histogram analysis
 */
export async function analyzeImage(imageData: Buffer): Promise<ImageAnalysis> {
  try {
    const sharp = await getSharp();
    const image = sharp(imageData);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // Calculate image characteristics
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const pixelCount = width * height;
    
    // Analyze contrast (useful for detecting printed vs handwritten)
    const channels = stats.channels || [];
    const avgContrast = channels.reduce((sum, ch) => {
      return sum + (ch.max - ch.min) / 255;
    }, 0) / Math.max(channels.length, 1);
    
    // High contrast typically = printed text
    // Medium contrast = mixed
    // Low contrast = handwritten or photo
    let contentType: ImageAnalysis["contentType"];
    if (avgContrast > 0.8) {
      contentType = "printed";
    } else if (avgContrast > 0.5) {
      contentType = "mixed";
    } else if (avgContrast > 0.3) {
      contentType = "handwritten";
    } else {
      contentType = "photo";
    }
    
    // Estimate complexity based on standard deviation
    const avgStdDev = channels.reduce((sum, ch) => sum + ch.stdev, 0) / Math.max(channels.length, 1);
    const complexity = Math.min(avgStdDev / 100, 1);
    
    // Estimate text density from aspect ratio and content type
    const aspectRatio = width / Math.max(height, 1);
    let textDensity: ImageAnalysis["textDensity"];
    if (aspectRatio > 1.5 || aspectRatio < 0.67) {
      // Wide or tall - likely dense tables
      textDensity = "dense";
    } else if (contentType === "printed") {
      textDensity = "normal";
    } else {
      textDensity = "sparse";
    }
    
    // Determine if likely a table (high contrast, moderate complexity)
    const hasTable = contentType === "printed" && complexity > 0.3;
    
    // Generate recommendations based on analysis
    let maxDimension: number;
    let quality: number;
    let format: "jpeg" | "png";
    
    if (contentType === "printed" && hasTable) {
      // High quality for structured data
      maxDimension = 2048;
      quality = 92;
      format = "jpeg";
    } else if (contentType === "handwritten") {
      // Higher quality for handwriting recognition
      maxDimension = 2048;
      quality = 95;
      format = "jpeg";
    } else if (textDensity === "dense") {
      // Keep resolution for dense text
      maxDimension = 2048;
      quality = 90;
      format = "jpeg";
    } else {
      // Standard processing
      maxDimension = 1600;
      quality = 85;
      format = "jpeg";
    }
    
    logger.debug("🔍 [Optimizer] Image analysis complete", {
      contentType,
      complexity: complexity.toFixed(2),
      textDensity,
      hasTable,
      avgContrast: avgContrast.toFixed(2),
      recommendations: { maxDimension, quality },
    });
    
    return {
      contentType,
      complexity,
      hasTable,
      textDensity,
      recommendations: { maxDimension, quality, format },
    };
    
  } catch (error) {
    logger.warn("⚠️ [Optimizer] Image analysis failed, using defaults", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    // Return safe defaults
    return {
      contentType: "unknown",
      complexity: 0.5,
      hasTable: false,
      textDensity: "normal",
      recommendations: {
        maxDimension: 2048,
        quality: 90,
        format: "jpeg",
      },
    };
  }
}

/**
 * Optimize image based on analysis
 */
export async function optimizeImage(
  imageData: Buffer,
  analysis?: ImageAnalysis
): Promise<{ buffer: Buffer; mimeType: string; originalSizeKB: number; optimizedSizeKB: number }> {
  const originalSizeKB = imageData.byteLength / 1024;
  
  // Analyze if not provided
  const settings = analysis?.recommendations ?? (await analyzeImage(imageData)).recommendations;
  
  try {
    const sharp = await getSharp();
    const image = sharp(imageData);
    const metadata = await image.metadata();
    
    // Check if resize needed
    const needsResize = 
      (metadata.width && metadata.width > settings.maxDimension) ||
      (metadata.height && metadata.height > settings.maxDimension);
    
    // Build the transform chain
    let transform = image;
    
    if (needsResize) {
      transform = transform.resize(settings.maxDimension, settings.maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    
    // Apply format-specific optimization
    let buffer: Buffer;
    let mimeType: string;
    
    if (settings.format === "png") {
      buffer = await transform.png({ quality: settings.quality, compressionLevel: 6 }).toBuffer();
      mimeType = "image/png";
    } else {
      buffer = await transform.jpeg({ quality: settings.quality, mozjpeg: true }).toBuffer();
      mimeType = "image/jpeg";
    }
    
    const optimizedSizeKB = buffer.byteLength / 1024;
    const reduction = ((1 - optimizedSizeKB / originalSizeKB) * 100);
    
    logger.info("🖼️ [Optimizer] Image optimized", {
      originalSizeKB: originalSizeKB.toFixed(1),
      optimizedSizeKB: optimizedSizeKB.toFixed(1),
      reduction: `${reduction.toFixed(0)}%`,
      settings,
    });
    
    return { buffer, mimeType, originalSizeKB, optimizedSizeKB };
    
  } catch (error) {
    logger.warn("⚠️ [Optimizer] Optimization failed, using original", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    return {
      buffer: imageData,
      mimeType: "image/jpeg",
      originalSizeKB,
      optimizedSizeKB: originalSizeKB,
    };
  }
}

// ============================================================
// PARALLEL PROVIDER RACING
// ============================================================

export interface RaceResult<T> {
  /** Winner of the race */
  winner: "primary" | "fallback";
  /** The winning result */
  result: T;
  /** Time the winner took (ms) */
  winnerTimeMs: number;
  /** Whether the other provider was cancelled */
  otherCancelled: boolean;
}

/**
 * Race two promises and return the first successful one
 * Cancels the slower one (if possible) to save resources
 */
export async function raceProviders<T>(
  primaryPromise: Promise<T>,
  fallbackPromise: Promise<T>,
  options: {
    /** Minimum time to wait for primary before considering fallback (ms) */
    primaryGracePeriodMs?: number;
    /** Validator to check if result is acceptable */
    isAcceptable?: (result: T) => boolean;
  } = {}
): Promise<RaceResult<T>> {
  const startTime = Date.now();
  const { primaryGracePeriodMs = 5000, isAcceptable = () => true } = options;
  
  // Create abort controllers for potential cancellation
  let primaryResolved = false;
  let fallbackResolved = false;
  
  // Wrap promises to track resolution
  const wrappedPrimary = primaryPromise.then(result => {
    primaryResolved = true;
    return { source: "primary" as const, result };
  });
  
  const wrappedFallback = fallbackPromise.then(result => {
    fallbackResolved = true;
    return { source: "fallback" as const, result };
  });
  
  // Add grace period delay to fallback
  const delayedFallback = new Promise<{ source: "fallback"; result: T }>((resolve) => {
    setTimeout(() => {
      if (!primaryResolved) {
        wrappedFallback.then(resolve).catch(() => {});
      }
    }, primaryGracePeriodMs);
  });
  
  try {
    // Race with primary getting a head start
    const winner = await Promise.race([
      wrappedPrimary,
      delayedFallback,
    ]);
    
    const winnerTimeMs = Date.now() - startTime;
    
    // Validate the result
    if (!isAcceptable(winner.result)) {
      logger.warn("⚠️ [Race] Winner result not acceptable, waiting for other", {
        winner: winner.source,
        timeMs: winnerTimeMs,
      });
      
      // Wait for the other one
      const other = winner.source === "primary" ? wrappedFallback : wrappedPrimary;
      const otherResult = await other;
      
      if (isAcceptable(otherResult.result)) {
        return {
          winner: otherResult.source,
          result: otherResult.result,
          winnerTimeMs: Date.now() - startTime,
          otherCancelled: false,
        };
      }
    }
    
    logger.info("🏁 [Race] Winner!", {
      winner: winner.source,
      timeMs: winnerTimeMs,
      otherResolved: winner.source === "primary" ? fallbackResolved : primaryResolved,
    });
    
    return {
      winner: winner.source,
      result: winner.result,
      winnerTimeMs,
      otherCancelled: !(winner.source === "primary" ? fallbackResolved : primaryResolved),
    };
    
  } catch (error) {
    // If primary fails, wait for fallback
    logger.warn("⚠️ [Race] Primary failed, waiting for fallback");
    
    const fallbackResult = await wrappedFallback;
    return {
      winner: "fallback",
      result: fallbackResult.result,
      winnerTimeMs: Date.now() - startTime,
      otherCancelled: false,
    };
  }
}

// ============================================================
// SMART REQUEST BATCHING
// ============================================================

interface BatchedRequest<TInput, TOutput> {
  input: TInput;
  resolve: (output: TOutput) => void;
  reject: (error: Error) => void;
}

/**
 * Batches multiple requests together for efficient processing
 */
export class RequestBatcher<TInput, TOutput> {
  private queue: BatchedRequest<TInput, TOutput>[] = [];
  private processing = false;
  private batchSize: number;
  private batchDelayMs: number;
  private processor: (inputs: TInput[]) => Promise<TOutput[]>;
  private timeout: NodeJS.Timeout | null = null;

  constructor(options: {
    batchSize: number;
    batchDelayMs: number;
    processor: (inputs: TInput[]) => Promise<TOutput[]>;
  }) {
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
    this.processor = options.processor;
  }

  /**
   * Add a request to the batch
   */
  async add(input: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      this.queue.push({ input, resolve, reject });
      
      // Start timer if not already running
      if (!this.timeout && !this.processing) {
        this.timeout = setTimeout(() => this.flush(), this.batchDelayMs);
      }
      
      // Flush immediately if batch is full
      if (this.queue.length >= this.batchSize) {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        this.flush();
      }
    });
  }

  /**
   * Process the current batch
   */
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      const inputs = batch.map(r => r.input);
      const outputs = await this.processor(inputs);
      
      // Match outputs to requests
      batch.forEach((request, index) => {
        if (outputs[index] !== undefined) {
          request.resolve(outputs[index]);
        } else {
          request.reject(new Error("No output for request"));
        }
      });
      
    } catch (error) {
      // Reject all requests in batch
      batch.forEach(request => {
        request.reject(error instanceof Error ? error : new Error("Batch processing failed"));
      });
    } finally {
      this.processing = false;
      
      // Process next batch if queue not empty
      if (this.queue.length > 0) {
        this.timeout = setTimeout(() => this.flush(), this.batchDelayMs);
      }
    }
  }

  /**
   * Get current queue size
   */
  get queueSize(): number {
    return this.queue.length;
  }
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

export interface PerformanceMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Average processing time (ms) */
  avgProcessingTimeMs: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Primary provider success rate */
  primarySuccessRate: number;
  /** Fallback usage rate */
  fallbackUsageRate: number;
  /** Average parts per request */
  avgPartsPerRequest: number;
  /** p50 processing time (ms) */
  p50ProcessingTimeMs: number;
  /** p95 processing time (ms) */
  p95ProcessingTimeMs: number;
}

class MetricsCollector {
  private processingTimes: number[] = [];
  private partsPerRequest: number[] = [];
  private primarySuccesses = 0;
  private fallbackUsages = 0;
  private cacheHits = 0;
  private totalRequests = 0;
  private readonly maxSamples = 1000;

  record(metrics: {
    processingTimeMs: number;
    partsFound: number;
    provider: "primary" | "fallback" | "cache";
    success: boolean;
  }): void {
    this.totalRequests++;
    
    // Store processing time (with sliding window)
    this.processingTimes.push(metrics.processingTimeMs);
    if (this.processingTimes.length > this.maxSamples) {
      this.processingTimes.shift();
    }
    
    // Store parts count
    this.partsPerRequest.push(metrics.partsFound);
    if (this.partsPerRequest.length > this.maxSamples) {
      this.partsPerRequest.shift();
    }
    
    // Track provider usage
    if (metrics.provider === "cache") {
      this.cacheHits++;
    } else if (metrics.provider === "primary" && metrics.success) {
      this.primarySuccesses++;
    } else if (metrics.provider === "fallback") {
      this.fallbackUsages++;
    }
  }

  getMetrics(): PerformanceMetrics {
    const sortedTimes = [...this.processingTimes].sort((a, b) => a - b);
    const p50Index = Math.floor(sortedTimes.length * 0.5);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    
    const nonCacheRequests = this.totalRequests - this.cacheHits;
    
    return {
      totalRequests: this.totalRequests,
      avgProcessingTimeMs: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
      cacheHitRate: this.totalRequests > 0 ? this.cacheHits / this.totalRequests : 0,
      primarySuccessRate: nonCacheRequests > 0 ? this.primarySuccesses / nonCacheRequests : 0,
      fallbackUsageRate: nonCacheRequests > 0 ? this.fallbackUsages / nonCacheRequests : 0,
      avgPartsPerRequest: this.partsPerRequest.length > 0
        ? this.partsPerRequest.reduce((a, b) => a + b, 0) / this.partsPerRequest.length
        : 0,
      p50ProcessingTimeMs: sortedTimes[p50Index] || 0,
      p95ProcessingTimeMs: sortedTimes[p95Index] || 0,
    };
  }

  reset(): void {
    this.processingTimes = [];
    this.partsPerRequest = [];
    this.primarySuccesses = 0;
    this.fallbackUsages = 0;
    this.cacheHits = 0;
    this.totalRequests = 0;
  }
}

// Singleton metrics collector
let metricsInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

export function recordMetrics(metrics: {
  processingTimeMs: number;
  partsFound: number;
  provider: "primary" | "fallback" | "cache";
  success: boolean;
}): void {
  getMetricsCollector().record(metrics);
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return getMetricsCollector().getMetrics();
}

