/**
 * CAI Intake - File Parse API
 * 
 * POST /api/v1/parse-file
 * Parses image and PDF files using AI vision capabilities.
 * 
 * For PDFs:
 * - Uses Python OCR microservice for superior text/table extraction
 * - Falls back to AI vision if Python OCR is unavailable
 * 
 * For Images:
 * - Uses AI vision directly for parsing
 * 
 * LOGGING:
 * - Comprehensive logging for debugging and performance analysis
 * - Set LOG_LEVEL=debug for verbose output
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { getOrCreateProvider } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import { getPythonOCRClient } from "@/lib/services/python-ocr-client";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { AnthropicProvider, type StreamingProgress } from "@/lib/ai/anthropic";
import { resolveOperationsForParts } from "@/lib/operations/resolver";

// Generate a unique request ID for tracking
function generateRequestId(): string {
  return `parse_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Size limits
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_DIMENSION = 2048; // Max width or height in pixels
const TARGET_IMAGE_KB = 500; // Target size after optimization (500KB)

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const requestStartTime = Date.now();
  
  // Check if streaming is requested via query param
  const url = new URL(request.url);
  const useStreaming = url.searchParams.get("stream") === "true";
  
  logger.info("📥 [ParseFile] Request received", {
    requestId,
    timestamp: new Date().toISOString(),
    streaming: useStreaming,
  });
  
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "parseJobs");
    if (!rateLimitResult.allowed) {
      logger.warn("📥 [ParseFile] Rate limited", { requestId });
      return rateLimitResult.response;
    }

    // Authenticate user
    const user = await getUser();
    if (!user) {
      logger.warn("📥 [ParseFile] Unauthorized request", { requestId });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    logger.debug("📥 [ParseFile] User authenticated", {
      requestId,
      userId: user.id,
    });

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string | null;
    const templateId = formData.get("templateId") as string | null;
    const templateConfigRaw = formData.get("templateConfig") as string | null;

    if (!file) {
      logger.warn("📥 [ParseFile] No file provided", { requestId });
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    const fileSizeKB = file.size / 1024;
    logger.info("📥 [ParseFile] Processing file", {
      requestId,
      fileName: file.name,
      fileType: fileType || file.type,
      sizeKB: fileSizeKB.toFixed(1),
      hasTemplate: !!templateId,
      templateId,
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.warn("📥 [ParseFile] File too large", {
        requestId,
        sizeKB: fileSizeKB.toFixed(1),
        maxSizeMB: MAX_FILE_SIZE / 1024 / 1024,
      });
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get AI provider
    logger.debug("📥 [ParseFile] Initializing AI provider", { requestId });
    const providerStartTime = Date.now();
    const provider = await getOrCreateProvider();
    
    if (!provider.isConfigured()) {
      logger.error("📥 [ParseFile] AI provider not configured", {
        requestId,
        userId: user.id,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      });
      
      return NextResponse.json(
        { 
          error: "AI processing is not available. Please contact your system administrator.",
          code: "AI_NOT_CONFIGURED"
        },
        { status: 503 }
      );
    }
    
    logger.debug("📥 [ParseFile] AI provider ready", {
      requestId,
      initTimeMs: Date.now() - providerStartTime,
    });

    let templateConfig = undefined;
    if (templateConfigRaw) {
      try {
        templateConfig = JSON.parse(templateConfigRaw);
        logger.debug("📥 [ParseFile] Template config parsed", {
          requestId,
          templateId,
        });
      } catch {
        logger.warn("📥 [ParseFile] Invalid template config JSON", { requestId });
      }
    }

    const parseOptions = {
      extractMetadata: true,
      confidence: "balanced" as const,
      templateId: templateId || undefined,
      templateConfig,
      defaultMaterialId: "MAT-WHITE-18",
      defaultThicknessMm: 18,
    };

    let aiResult;

    if (fileType === "image") {
      // Process image - use AI vision directly
      logger.info("📥 [ParseFile] Processing image file", {
        requestId,
        stage: "image_load",
      });
      
      const imageLoadStart = Date.now();
      const originalBuffer = await file.arrayBuffer();
      const originalSizeKB = originalBuffer.byteLength / 1024;
      
      logger.info("📥 [ParseFile] Image loaded", { 
        requestId,
        fileName: file.name, 
        originalSizeKB: originalSizeKB.toFixed(1),
        mimeType: file.type,
        loadTimeMs: Date.now() - imageLoadStart,
      });
      
      // Optimize large images before sending to AI
      let imageBuffer: Buffer;
      let mimeType = "image/jpeg"; // Default to JPEG for optimization
      const optimizeStart = Date.now();
      
      try {
        const sharpInstance = sharp(Buffer.from(originalBuffer));
        const metadata = await sharpInstance.metadata();
        
        logger.debug("📥 [ParseFile] Image metadata", {
          requestId,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        });
        
        const needsResize = 
          (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
          (metadata.height && metadata.height > MAX_IMAGE_DIMENSION) ||
          originalSizeKB > TARGET_IMAGE_KB;
        
        if (needsResize) {
          logger.info("📥 [ParseFile] Optimizing large image", {
            requestId,
            stage: "image_optimize",
            originalWidth: metadata.width,
            originalHeight: metadata.height,
            originalSizeKB: originalSizeKB.toFixed(1),
            reason: originalSizeKB > TARGET_IMAGE_KB ? "size" : "dimensions",
          });
          
          // Calculate quality based on original size
          // Larger files get more aggressive compression
          let quality = 85;
          if (originalSizeKB > 5000) quality = 60; // >5MB: 60% quality
          else if (originalSizeKB > 2000) quality = 70; // >2MB: 70% quality
          else if (originalSizeKB > 1000) quality = 80; // >1MB: 80% quality
          
          imageBuffer = await sharpInstance
            .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          
          mimeType = "image/jpeg";
          
          const newSizeKB = imageBuffer.byteLength / 1024;
          const reduction = ((1 - newSizeKB / originalSizeKB) * 100);
          
          logger.info("📥 [ParseFile] Image optimized successfully", {
            requestId,
            originalSizeKB: originalSizeKB.toFixed(1),
            newSizeKB: newSizeKB.toFixed(1),
            reduction: `${reduction.toFixed(0)}%`,
            quality,
            optimizeTimeMs: Date.now() - optimizeStart,
          });
        } else {
          // Image is already small enough, use original
          imageBuffer = Buffer.from(originalBuffer);
          
          // Detect proper MIME type
          const ext = file.name.split(".").pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
          };
          mimeType = file.type || mimeMap[ext || ""] || "image/jpeg";
          
          logger.debug("📥 [ParseFile] Image within limits, using original", {
            requestId,
            sizeKB: originalSizeKB.toFixed(1),
            mimeType,
          });
        }
      } catch (sharpError) {
        logger.warn("📥 [ParseFile] Image optimization failed, using original", {
          requestId,
          error: sharpError instanceof Error ? sharpError.message : "Unknown error",
        });
        imageBuffer = Buffer.from(originalBuffer);
        
        // Fallback MIME type detection
        const ext = file.name.split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "png": "image/png",
          "gif": "image/gif",
          "webp": "image/webp",
        };
        mimeType = file.type || mimeMap[ext || ""] || "image/jpeg";
      }
      
      const base64 = imageBuffer.toString("base64");
      
      // Validate base64 encoding
      if (!base64 || base64.length < 100) {
        logger.error("📥 [ParseFile] Base64 encoding failed", {
          requestId,
          base64Length: base64?.length ?? 0,
        });
        return NextResponse.json(
          { 
            error: "Failed to encode image. Please try with a different image format.",
            code: "IMAGE_ENCODE_ERROR"
          },
          { status: 400 }
        );
      }
      
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      // For Claude, image tokens are based on dimensions, not file size
      // A typical 1024x1024 image ≈ 800-1000 tokens, 2048x2048 ≈ 1600-2000 tokens
      // This is a rough estimate for logging purposes only
      const imageSizeKB = base64.length / 1024;
      const estimatedImageTokens = Math.min(
        Math.ceil(imageSizeKB * 3), // Rough estimate: ~3 tokens per KB of base64
        4000 // Cap at 4000 tokens (typical max for a 2048x2048 image)
      );
      
      logger.info("📥 [ParseFile] Sending image to AI", { 
        requestId,
        stage: "ai_request",
        mimeType, 
        base64LengthKB: imageSizeKB.toFixed(1),
        estimatedImageTokens,
        model: "claude-3-5-sonnet-20241022",
        streaming: useStreaming,
      });
      
      const aiStartTime = Date.now();
      
      // ============================================================
      // STREAMING MODE - Return SSE stream with real-time progress
      // ============================================================
      if (useStreaming && provider instanceof AnthropicProvider) {
        logger.info("📥 [ParseFile] Using streaming mode", { requestId });
        
        // Create a TransformStream for SSE
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        
        // Process in background, writing to stream
        (async () => {
          try {
            const streamingResult = await provider.parseImageWithStreaming(dataUrl, {
              ...parseOptions,
              onProgress: async (progress: StreamingProgress) => {
                const sseData = `data: ${JSON.stringify({
                  type: "progress",
                  ...progress,
                  requestId,
                })}\n\n`;
                await writer.write(encoder.encode(sseData));
              },
              onPartFound: async (partIndex: number) => {
                const sseData = `data: ${JSON.stringify({
                  type: "part_found",
                  partIndex,
                  requestId,
                })}\n\n`;
                await writer.write(encoder.encode(sseData));
              },
            });
            
            // Send final result
            const finalData = `data: ${JSON.stringify({
              type: "complete",
              success: streamingResult.success,
              parts: streamingResult.parts,
              totalConfidence: streamingResult.totalConfidence,
              processingTimeMs: streamingResult.processingTime,
              partsFound: streamingResult.parts?.length ?? 0,
              requestId,
            })}\n\n`;
            await writer.write(encoder.encode(finalData));
            
            logger.info("📥 [ParseFile] Streaming completed", {
              requestId,
              partsFound: streamingResult.parts?.length ?? 0,
              totalTimeMs: Date.now() - requestStartTime,
            });
          } catch (error) {
            const errorData = `data: ${JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
              requestId,
            })}\n\n`;
            await writer.write(encoder.encode(errorData));
          } finally {
            await writer.close();
          }
        })();
        
        // Return SSE response
        return new Response(stream.readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
      
      // ============================================================
      // NON-STREAMING MODE - Original behavior
      // ============================================================
      try {
        aiResult = await provider.parseImage(dataUrl, parseOptions);
        
        logger.info("📥 [ParseFile] AI parsing completed", {
          requestId,
          stage: "ai_response",
          success: aiResult.success,
          partsFound: aiResult.parts?.length ?? 0,
          confidence: aiResult.totalConfidence?.toFixed(2),
          aiTimeMs: Date.now() - aiStartTime,
        });
      } catch (imageError) {
        const errorMessage = imageError instanceof Error ? imageError.message : "Unknown error";
        logger.error("📥 [ParseFile] AI vision error", {
          requestId,
          error: errorMessage,
          fileName: file.name,
          aiTimeMs: Date.now() - aiStartTime,
        });
        
        // Handle specific error patterns
        if (errorMessage.includes("did not match the expected pattern") || 
            errorMessage.includes("Invalid URL") ||
            errorMessage.includes("invalid_image")) {
          return NextResponse.json(
            { 
              error: "The image format is not supported. Please try converting to JPG or PNG format and uploading again.",
              code: "IMAGE_FORMAT_ERROR",
              details: errorMessage
            },
            { status: 400 }
          );
        }
        
        throw imageError;
      }
      
    } else if (fileType === "pdf") {
      // Process PDF - use Python OCR service
      logger.info("📥 [ParseFile] Processing PDF file", {
        requestId,
        stage: "pdf_process",
      });
      
      const pdfStartTime = Date.now();
      aiResult = await processPDF(file, provider, parseOptions, requestId);
      
      logger.info("📥 [ParseFile] PDF processing completed", {
        requestId,
        success: aiResult.success,
        partsFound: aiResult.parts?.length ?? 0,
        pdfTimeMs: Date.now() - pdfStartTime,
      });
      
    } else {
      logger.warn("📥 [ParseFile] Unsupported file type", {
        requestId,
        fileType,
        fileName: file.name,
      });
      return NextResponse.json(
        { error: "Unsupported file type. Use images or PDFs." },
        { status: 400 }
      );
    }

    if (!aiResult.success) {
      logger.error("📥 [ParseFile] AI parsing failed", {
        requestId,
        errors: aiResult.errors,
        totalTimeMs: Date.now() - requestStartTime,
      });
      return NextResponse.json(
        { 
          error: aiResult.errors.join(", ") || "AI parsing failed",
          code: "AI_PARSE_FAILED"
        },
        { status: 422 }
      );
    }

    // Save the file to storage and create uploaded_files record
    logger.debug("📥 [ParseFile] Saving file to storage", {
      requestId,
      stage: "storage",
    });
    
    let uploadedFileId: string | undefined;
    const storageStartTime = Date.now();
    
    try {
      const serviceClient = getServiceClient();
      
      // Get user's organization
      const { data: userData } = await serviceClient
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      
      if (userData?.organization_id) {
        // Resolve operations against org's database
        if (aiResult.parts && aiResult.parts.length > 0) {
          try {
            const resolveStart = Date.now();
            aiResult.parts = await resolveOperationsForParts(
              aiResult.parts,
              userData.organization_id
            );
            logger.info("📥 [ParseFile] Operations resolved against org database", {
              requestId,
              organizationId: userData.organization_id,
              partsResolved: aiResult.parts.length,
              resolveTimeMs: Date.now() - resolveStart,
            });
          } catch (resolveError) {
            logger.warn("📥 [ParseFile] Operation resolution failed (non-fatal)", {
              requestId,
              error: resolveError instanceof Error ? resolveError.message : "Unknown error",
            });
          }
        }
        
        // Generate unique file name
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userData.organization_id}/${timestamp}_${sanitizedName}`;
        
        logger.debug("📥 [ParseFile] Uploading to storage", {
          requestId,
          storagePath,
          bucket: "cutlist-files",
        });
        
        // Upload file to storage
        const fileBuffer = await file.arrayBuffer();
        const { error: storageError } = await serviceClient.storage
          .from("cutlist-files")
          .upload(storagePath, Buffer.from(fileBuffer), {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        
        if (!storageError) {
          // Create uploaded_files record (without cutlist_id - will be linked later)
          const fileId = crypto.randomUUID();
          const { error: dbError } = await serviceClient
            .from("uploaded_files")
            .insert({
              id: fileId,
              organization_id: userData.organization_id,
              user_id: user.id,
              file_name: sanitizedName,
              original_name: file.name,
              mime_type: file.type || "application/octet-stream",
              size_bytes: file.size,
              storage_path: storagePath,
              kind: "source",
              created_at: new Date().toISOString(),
            });
          
          if (!dbError) {
            uploadedFileId = fileId;
            logger.info("📥 [ParseFile] File saved to storage", { 
              requestId,
              fileId, 
              storagePath, 
              sizeBytes: file.size,
              storageTimeMs: Date.now() - storageStartTime,
            });
          } else {
            logger.warn("📥 [ParseFile] Failed to create uploaded_files record", {
              requestId,
              error: dbError.message,
              code: dbError.code,
            });
          }
        } else {
          logger.warn("📥 [ParseFile] Storage upload failed", {
            requestId,
            error: storageError.message,
          });
        }
      } else {
        logger.debug("📥 [ParseFile] No organization found, skipping storage", {
          requestId,
          userId: user.id,
        });
      }
    } catch (uploadError) {
      // Don't fail the parse if file upload fails - just log it
      logger.warn("📥 [ParseFile] File upload error (non-fatal)", {
        requestId,
        error: uploadError instanceof Error ? uploadError.message : "Unknown error",
      });
    }

    const totalTimeMs = Date.now() - requestStartTime;
    
    // Log final summary
    logger.info("📥 [ParseFile] ✅ Request completed successfully", {
      requestId,
      fileName: file.name,
      fileType,
      partsFound: aiResult.parts?.length ?? 0,
      confidence: aiResult.totalConfidence?.toFixed(2),
      uploadedFileId,
      totalTimeMs,
      breakdown: {
        aiProcessingMs: aiResult.processingTimeMs,
        overheadMs: totalTimeMs - (aiResult.processingTimeMs ?? 0),
      },
    });

    // Return parsed results with file ID if saved
    return NextResponse.json({
      success: true,
      parts: aiResult.parts,
      totalConfidence: aiResult.totalConfidence,
      processingTimeMs: aiResult.processingTimeMs,
      rawResponse: aiResult.rawResponse,
      uploadedFileId, // Include file ID for linking to cutlist later
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const totalTimeMs = Date.now() - requestStartTime;
    
    logger.error("📥 [ParseFile] ❌ Request failed", {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      totalTimeMs,
    });
    
    return NextResponse.json(
      { 
        error: "Failed to process file. Please try again.",
        code: "PARSE_ERROR"
      },
      { status: 500 }
    );
  }
}

/**
 * Process a PDF file using PARALLEL strategy:
 * 1. Start pdf-parse immediately (fast, works for text-based PDFs)
 * 2. Start Python OCR in parallel (for scanned PDFs, has cold start delays)
 * 3. Use whichever succeeds first with meaningful text
 */
async function processPDF(
  file: File,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseOptions: any,
  requestId: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const pdfStartTime = Date.now();
  const pythonOCR = getPythonOCRClient();
  
  logger.debug("📥 [ParseFile] Loading PDF buffer", {
    requestId,
    fileName: file.name,
    sizeKB: (file.size / 1024).toFixed(1),
  });
  
  const pdfBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(pdfBuffer).toString("base64");
  
  logger.debug("📥 [ParseFile] PDF encoded to base64", {
    requestId,
    base64LengthKB: (base64.length / 1024).toFixed(1),
  });

  // STRATEGY: Run pdf-parse and Python OCR in parallel
  // pdf-parse is fast but only works for text-based PDFs
  // Python OCR is slower but works for scanned PDFs
  
  logger.info("📥 [ParseFile] 🚀 Starting parallel PDF extraction", {
    requestId,
    fileName: file.name,
    pythonOCRConfigured: pythonOCR.isConfigured(),
  });

  // 1. Start pdf-parse immediately (fast for text-based PDFs)
  const pdfParsePromise = (async () => {
    const startTime = Date.now();
    try {
      // Dynamic import with proper handling for CommonJS module
      const pdfParseModule = await import("pdf-parse");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = pdfParseModule as any;
      
      // pdf-parse may export as default, PDFParse class, or directly
      // Handle all cases: class (needs new), function, or default export
      let pdfData;
      
      if (mod.PDFParse && typeof mod.PDFParse === "function") {
        // It's a class - use new
        try {
          pdfData = await new mod.PDFParse(Buffer.from(pdfBuffer));
        } catch {
          // Maybe not a class, try calling directly
          pdfData = await mod.PDFParse(Buffer.from(pdfBuffer));
        }
      } else if (mod.default && typeof mod.default === "function") {
        // Default export - could be class or function
        try {
          pdfData = await mod.default(Buffer.from(pdfBuffer));
        } catch {
          pdfData = await new mod.default(Buffer.from(pdfBuffer));
        }
      } else if (typeof mod === "function") {
        // Module itself is the function
        pdfData = await mod(Buffer.from(pdfBuffer));
      } else {
        // Log what we got for debugging
        const keys = typeof mod === "object" ? Object.keys(mod) : [];
        throw new Error(`pdf-parse loaded incorrectly: keys: ${keys.join(", ")}`);
      }
      
      const text = pdfData.text?.trim() || "";
      const meaningfulText = text.replace(/\s+/g, " ").trim();
      
      logger.debug("📥 [ParseFile] 📄 pdf-parse completed", {
        requestId,
        textLength: meaningfulText.length,
        pages: pdfData.numpages,
        parseTimeMs: Date.now() - startTime,
      });
      
      return { 
        source: "pdf-parse" as const, 
        text: meaningfulText, 
        success: meaningfulText.length > 50,
        timeMs: Date.now() - startTime,
      };
    } catch (err) {
      logger.warn("📥 [ParseFile] pdf-parse failed", {
        requestId,
        error: err instanceof Error ? err.message : "Unknown error",
        timeMs: Date.now() - startTime,
      });
      return { source: "pdf-parse" as const, text: "", success: false, timeMs: Date.now() - startTime };
    }
  })();

  // 2. Start Python OCR in parallel (with per-page extraction for multi-page PDFs)
  const pythonOCRPromise = (async () => {
    if (!pythonOCR.isConfigured()) {
      return { source: "python-ocr" as const, text: "", pages: [] as Array<{pageNumber: number; text: string}>, success: false, timeMs: 0 };
    }
    
    const startTime = Date.now();
    
    // Quick health check first (10 second timeout)
    const isHealthy = await Promise.race([
      pythonOCR.checkHealth(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
    ]);
    
    if (!isHealthy) {
      logger.info("📥 [ParseFile] 🐍 Python OCR service unhealthy/cold, skipping", {
        requestId,
        healthCheckTimeMs: Date.now() - startTime,
      });
      return { source: "python-ocr" as const, text: "", pages: [] as Array<{pageNumber: number; text: string}>, success: false, timeMs: Date.now() - startTime };
    }
    
    logger.info("📥 [ParseFile] 🐍 Python OCR service healthy, extracting", {
      requestId,
      fileName: file.name,
      serviceUrl: process.env.PYTHON_OCR_SERVICE_URL,
    });
    
    // Use per-page extraction for better chunking
    const ocrResult = await pythonOCR.extractFromPDFByPage(base64, file.name);
    const timeMs = Date.now() - startTime;
    
    if (ocrResult && ocrResult.success) {
      let textForParsing = ocrResult.text;
      
      // Format tables if extracted
      if (ocrResult.tables && ocrResult.tables.length > 0) {
        const tablesText = pythonOCR.formatTablesAsText(ocrResult.tables);
        textForParsing = `${tablesText}\n\n${ocrResult.text}`;
        
        logger.info("📥 [ParseFile] 📊 Python OCR extracted tables", {
          requestId,
          tableCount: ocrResult.tables.length,
          method: ocrResult.method,
          confidence: ocrResult.confidence?.toFixed(2),
          timeMs,
        });
      }
      
      const meaningfulText = textForParsing.replace(/\s+/g, " ").trim();
      
      return { 
        source: "python-ocr" as const, 
        text: meaningfulText,
        pages: ocrResult.pages || [],
        success: meaningfulText.length > 30,
        timeMs,
        confidence: ocrResult.confidence,
        method: ocrResult.method,
        pageCount: ocrResult.metadata?.pages || 1,
      };
    }
    
    logger.warn("📥 [ParseFile] ⚠️ Python OCR failed", {
      requestId,
      error: ocrResult?.error,
      timeMs,
    });
    
    return { source: "python-ocr" as const, text: "", pages: [] as Array<{pageNumber: number; text: string}>, success: false, timeMs };
  })();

  // 3. Race both strategies - use first successful result
  const results = await Promise.allSettled([pdfParsePromise, pythonOCRPromise]);
  
  // Check which extraction succeeded
  const pdfParseResult = results[0].status === "fulfilled" ? results[0].value : null;
  const pythonOCRResult = results[1].status === "fulfilled" ? results[1].value : null;
  
  logger.info("📥 [ParseFile] 📊 Parallel extraction complete", {
    requestId,
    pdfParseSuccess: pdfParseResult?.success,
    pdfParseTextLength: pdfParseResult?.text?.length ?? 0,
    pdfParseTimeMs: pdfParseResult?.timeMs ?? 0,
    pythonOCRSuccess: pythonOCRResult?.success,
    pythonOCRTextLength: pythonOCRResult?.text?.length ?? 0,
    pythonOCRTimeMs: pythonOCRResult?.timeMs ?? 0,
  });
  
  // Prefer Python OCR if it succeeded (better for tables/scanned docs)
  // But fall back to pdf-parse if Python OCR failed
  let bestResult: { source: string; text: string; success: boolean } | null = null;
  
  if (pythonOCRResult?.success) {
    bestResult = pythonOCRResult;
    logger.info("📥 [ParseFile] ✅ Using Python OCR result (preferred)", {
      requestId,
      textLength: pythonOCRResult.text.length,
      textPreview: pythonOCRResult.text.substring(0, 100) + "...",
    });
  } else if (pdfParseResult?.success) {
    bestResult = pdfParseResult;
    logger.info("📥 [ParseFile] ✅ Using pdf-parse result (fallback)", {
      requestId,
      textLength: pdfParseResult.text.length,
      textPreview: pdfParseResult.text.substring(0, 100) + "...",
    });
  }
  
  if (bestResult?.success) {
    const aiStartTime = Date.now();
    
    // Check if we have per-page data for page-based chunking
    const pages = (bestResult as any).pages || [];
    const pageCount = (bestResult as any).pageCount || pages.length || 1;
    
    if (pageCount > 1 && pages.length > 1) {
      // Multi-page PDF: Process each page separately (page-based chunking)
      logger.info("📥 [ParseFile] 📄 Using page-based chunking for multi-page PDF", {
        requestId,
        pageCount,
        pagesWithText: pages.filter((p: any) => p.text?.length > 50).length,
      });
      
      // Process pages in parallel (all at once for small PDFs, batched for large ones)
      // OpenAI handles up to 60 RPM on standard tier, so 10 parallel is safe
      const BATCH_SIZE = Math.min(pages.length, 10);
      const allParts: any[] = [];
      const allErrors: string[] = [];
      
      for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        const batch = pages.slice(i, i + BATCH_SIZE);
        
        logger.info(`📥 [ParseFile] Processing page batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)}`, {
          requestId,
          pagesInBatch: batch.map((p: any) => p.pageNumber),
        });
        
        const batchResults = await Promise.allSettled(
          batch.map(async (page: any) => {
            if (!page.text || page.text.length < 50) {
              return { pageNumber: page.pageNumber, parts: [], skipped: true };
            }
            
            // Use parseTextDirect to avoid double-chunking (pages are already chunked)
            const pageResult = await provider.parseTextDirect 
              ? await provider.parseTextDirect(page.text, parseOptions)
              : await provider.parseText(page.text, { ...parseOptions, skipChunking: true });
            return {
              pageNumber: page.pageNumber,
              parts: pageResult.parts || [],
              success: pageResult.success,
            };
          })
        );
        
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            if (result.value.parts && result.value.parts.length > 0) {
              allParts.push(...result.value.parts);
              logger.info(`📥 [ParseFile] ✅ Page ${result.value.pageNumber} parsed: ${result.value.parts.length} parts`, {
                requestId,
              });
            } else if (!result.value.skipped) {
              logger.warn(`📥 [ParseFile] ⚠️ Page ${result.value.pageNumber} returned 0 parts`, {
                requestId,
              });
            }
          } else {
            allErrors.push(`Page parsing failed: ${result.reason}`);
          }
        }
      }
      
      logger.info("📥 [ParseFile] AI text parsing completed (page-based)", {
        requestId,
        source: bestResult.source,
        pageCount,
        partsFound: allParts.length,
        errors: allErrors.length,
        aiTimeMs: Date.now() - aiStartTime,
        totalPdfTimeMs: Date.now() - pdfStartTime,
      });
      
      return {
        success: allParts.length > 0,
        parts: allParts,
        totalConfidence: allParts.length > 0 
          ? allParts.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / allParts.length 
          : 0,
        errors: allErrors,
        processingTime: Date.now() - aiStartTime,
      };
    }
    
    // Single page or no page data: Use standard text parsing with chunking
    const result = await provider.parseText(bestResult.text, parseOptions);
    
    logger.info("📥 [ParseFile] AI text parsing completed", {
      requestId,
      source: bestResult.source,
      partsFound: result.parts?.length ?? 0,
      aiTimeMs: Date.now() - aiStartTime,
      totalPdfTimeMs: Date.now() - pdfStartTime,
    });
    
    return result;
  }
  
  // Neither extraction worked - PDF is likely a scanned image
  logger.error("📥 [ParseFile] ❌ Could not extract text from PDF", {
    requestId,
    fileName: file.name,
    pdfParseTextLength: pdfParseResult?.text?.length ?? 0,
    pythonOCRTextLength: pythonOCRResult?.text?.length ?? 0,
    pythonOCRConfigured: pythonOCR.isConfigured(),
    totalPdfTimeMs: Date.now() - pdfStartTime,
    suggestion: "Upload as image instead",
  });
  
  return {
    success: false,
    parts: [],
    totalConfidence: 0,
    errors: [
      "Could not extract text from this PDF. This appears to be a scanned document. " +
      "Please try one of these alternatives:\n" +
      "• Take a clear photo of the document and upload the image\n" +
      "• Export the PDF as an image (PNG/JPG) and upload that\n" +
      "• If possible, use a text-based PDF instead"
    ],
    processingTimeMs: Date.now() - pdfStartTime,
  };
}
