/**
 * CAI Intake - Python OCR Service Client
 * 
 * Client for communicating with the Python OCR microservice.
 * Provides superior PDF text extraction, table detection, and OCR capabilities.
 * 
 * Service URL: https://cabinetai-ocr.onrender.com
 */

import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

/**
 * OCR request options
 */
export interface OCROptions {
  /** Enable denoising (default: true) */
  denoise?: boolean;
  /** Enable contrast enhancement (default: true) */
  enhance_contrast?: boolean;
  /** Enable binarization (default: true) */
  binarize?: boolean;
  /** Enable deskewing (default: true) */
  deskew?: boolean;
  /** Custom Tesseract config */
  config?: string;
  /** OCR mode hint */
  mode?: "text" | "number" | "code";
}

/**
 * OCR extraction request
 */
export interface OCRRequest {
  /** Base64 encoded file data */
  fileData: string;
  /** Original filename (e.g., "cutlist.pdf") */
  fileName: string;
  /** MIME type (e.g., "application/pdf", "image/jpeg") */
  fileType: string;
  /** Processing options */
  options?: OCROptions;
}

/**
 * OCR extraction result metadata
 */
export interface OCRMetadata {
  /** Number of pages (PDF) */
  pages?: number;
  /** Processing strategy used */
  strategy?: string;
  /** Extraction method used */
  extraction_method?: string;
  /** Number of tables found */
  table_count?: number;
  /** Preprocessing steps applied */
  preprocessing?: string[];
  /** Tesseract config used */
  ocr_config?: string;
  /** Why fallback was used */
  fallback_reason?: string;
}

/**
 * OCR extraction result
 */
export interface OCRResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** Extracted text content */
  text: string;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Extraction method used */
  method: string;
  /** Extracted tables (if applicable) - 3D array: tables -> rows -> cells */
  tables?: string[][][];
  /** Processing metadata */
  metadata: OCRMetadata;
  /** Processing time in seconds */
  processingTime: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  dependencies?: Record<string, string>;
}

/**
 * Service info response
 */
export interface ServiceInfo {
  service: string;
  version: string;
  status: string;
  capabilities: string[];
}

// ============================================================
// CLIENT
// ============================================================

/**
 * Python OCR Service Client
 * 
 * Provides methods to interact with the Python OCR microservice.
 * Includes retry logic with exponential backoff for cold starts.
 */
export class PythonOCRClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private healthCache: { healthy: boolean; timestamp: number } | null = null;
  private healthCacheSuccessTTL = 60000; // 60 seconds for successful health check
  private healthCacheFailureTTL = 5000;  // 5 seconds for failed health check

  constructor(
    baseUrl: string = process.env.PYTHON_OCR_SERVICE_URL || "http://localhost:8001",
    timeout: number = 90000, // 90s for cold starts
    maxRetries: number = 3
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.baseUrl && this.baseUrl.length > 0;
  }

  /**
   * Check service health (cached)
   */
  async checkHealth(): Promise<boolean> {
    // Return cached result if still valid
    if (this.healthCache) {
      const ttl = this.healthCache.healthy 
        ? this.healthCacheSuccessTTL 
        : this.healthCacheFailureTTL;
      
      if (Date.now() - this.healthCache.timestamp < ttl) {
        return this.healthCache.healthy;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for health check

      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const healthy = response.ok;
      this.healthCache = { healthy, timestamp: Date.now() };
      
      return healthy;
    } catch (error) {
      logger.warn("Python OCR health check failed", { error, baseUrl: this.baseUrl });
      this.healthCache = { healthy: false, timestamp: Date.now() };
      return false;
    }
  }

  /**
   * Get service info
   */
  async getServiceInfo(): Promise<ServiceInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: "GET",
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Extract text/tables from a file using OCR
   * 
   * @param fileData Base64 encoded file data
   * @param fileName Original filename
   * @param fileType MIME type
   * @param options Processing options
   * @returns OCR result or null if service unavailable
   */
  async extractText(
    fileData: string,
    fileName: string,
    fileType: string,
    options?: OCROptions
  ): Promise<OCRResult | null> {
    const request: OCRRequest = {
      fileData,
      fileName,
      fileType,
      options,
    };

    return this.sendRequestWithRetry("/api/ocr/extract", request);
  }

  /**
   * Extract text from a PDF file
   */
  async extractFromPDF(
    fileData: string,
    fileName: string
  ): Promise<OCRResult | null> {
    return this.extractText(fileData, fileName, "application/pdf", {
      denoise: true,
      enhance_contrast: true,
    });
  }

  /**
   * Extract text from an image file
   */
  async extractFromImage(
    fileData: string,
    fileName: string,
    fileType: string
  ): Promise<OCRResult | null> {
    return this.extractText(fileData, fileName, fileType, {
      denoise: true,
      enhance_contrast: true,
      binarize: true,
      deskew: true,
    });
  }

  /**
   * Enhance an image for better OCR results
   */
  async enhanceImage(
    fileData: string,
    fileName: string,
    fileType: string,
    options?: OCROptions
  ): Promise<{ success: boolean; enhancedImage: string; enhancements: string[] } | null> {
    const request = {
      fileData,
      fileName,
      fileType,
      options: options || {
        denoise: true,
        enhance_contrast: true,
        binarize: true,
        deskew: true,
      },
    };

    try {
      const response = await this.sendRequestWithRetry("/api/ocr/enhance-image", request);
      if (response && response.success) {
        return {
          success: true,
          enhancedImage: (response as unknown as { enhancedImage: string }).enhancedImage,
          enhancements: (response as unknown as { enhancements: string[] }).enhancements || [],
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Align a photographed template using perspective transform
   */
  async alignTemplate(
    imageBase64: string,
    targetWidth: number = 2480,
    targetHeight: number = 3508
  ): Promise<{ success: boolean; alignedBase64: string; message: string } | null> {
    const request = {
      image_base64: imageBase64,
      target_width: targetWidth,
      target_height: targetHeight,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/ocr/align-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        success: data.success,
        alignedBase64: data.aligned_base64,
        message: data.message,
      };
    } catch {
      return null;
    }
  }

  /**
   * Send request with retry logic and exponential backoff
   */
  private async sendRequestWithRetry(
    endpoint: string,
    request: OCRRequest | Record<string, unknown>
  ): Promise<OCRResult | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.sendRequest(endpoint, request);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a cold start error (502/503)
        const isColdStart = lastError.message.includes("502") || 
                           lastError.message.includes("503") ||
                           lastError.message.includes("ECONNRESET");

        if (attempt < this.maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000;
          logger.info(`Python OCR retry ${attempt}/${this.maxRetries} after ${delay}ms`, {
            endpoint,
            error: lastError.message,
            isColdStart,
          });
          await this.sleep(delay);
        }
      }
    }

    logger.error("Python OCR request failed after all retries", {
      endpoint,
      error: lastError?.message,
      attempts: this.maxRetries,
    });

    return null;
  }

  /**
   * Send a single request to the OCR service
   */
  private async sendRequest(
    endpoint: string,
    request: OCRRequest | Record<string, unknown>
  ): Promise<OCRResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.info("🐍 Sending to Python OCR", {
        endpoint,
        fileName: (request as OCRRequest).fileName,
        fileType: (request as OCRRequest).fileType,
      });

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result: OCRResult = await response.json();
      
      logger.info("✅ Python OCR completed", {
        success: result.success,
        confidence: result.confidence,
        method: result.method,
        tableCount: result.metadata?.table_count,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout - service may be warming up");
      }
      
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format extracted tables as text for LLM parsing
   */
  formatTablesAsText(tables: string[][][]): string {
    if (!tables || tables.length === 0) {
      return "";
    }

    const parts: string[] = [];

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      parts.push(`=== Table ${i + 1} ===`);
      
      for (const row of table) {
        parts.push(row.join(" | "));
      }
      
      parts.push(""); // Empty line between tables
    }

    return parts.join("\n");
  }
}

// ============================================================
// SINGLETON
// ============================================================

let clientInstance: PythonOCRClient | null = null;

/**
 * Get the singleton Python OCR client instance
 */
export function getPythonOCRClient(): PythonOCRClient {
  if (!clientInstance) {
    clientInstance = new PythonOCRClient();
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPythonOCRClient(): void {
  clientInstance = null;
}

