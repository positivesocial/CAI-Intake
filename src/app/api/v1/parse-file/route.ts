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
import { 
  detectTemplateQR, 
  getOrgTemplateConfig, 
  buildDeterministicParsePrompt,
  detectTemplateFromText,
  TEMPLATE_DETECTION_PROMPT,
  type QRDetectionResult,
  type OrgTemplateConfig,
  type TemplateParseResult,
  type ParsedTemplatePart,
} from "@/lib/ai/template-ocr";
import {
  registerTemplatePage,
  checkAutoAccept,
  logTemplateParseAudit,
  AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
} from "@/lib/templates/template-parsing-service";
import { convertPdfToImages } from "@/lib/pdf/pdf-to-images";

// Generate a unique request ID for tracking
function generateRequestId(): string {
  return `parse_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Size limits
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_DIMENSION = 2048; // Max width or height - increased for structured templates/QR codes
const TARGET_IMAGE_KB = 1000; // Target size after optimization - needs to be readable for handwritten text and QR codes

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
    const fileTypeFromForm = formData.get("fileType") as string | null;
    const templateId = formData.get("templateId") as string | null;
    const templateConfigRaw = formData.get("templateConfig") as string | null;

    if (!file) {
      logger.warn("📥 [ParseFile] No file provided", { requestId });
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Determine file type from form data OR from the file's MIME type
    const mimeType = file.type;
    let fileType: "image" | "pdf" | "excel" | null = fileTypeFromForm as "image" | "pdf" | "excel" | null;
    
    if (!fileType) {
      // Auto-detect from MIME type
      if (mimeType.startsWith("image/")) {
        fileType = "image";
      } else if (mimeType === "application/pdf") {
        fileType = "pdf";
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "text/csv"
      ) {
        fileType = "excel";
      }
    }
    
    const fileSizeKB = file.size / 1024;
    logger.info("📥 [ParseFile] Processing file", {
      requestId,
      fileName: file.name,
      mimeType,
      fileType,
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

    // ============================================================
    // TEMPLATE DETECTION & CONFIG LOADING
    // ============================================================
    let detectedTemplateId = templateId;
    let detectedTemplateConfig = templateConfig;
    let deterministicPrompt: string | undefined;
    let qrDetectionResult: QRDetectionResult | undefined;
    
    const parseOptions = {
      extractMetadata: true,
      confidence: "balanced" as const,
      templateId: detectedTemplateId || undefined,
      templateConfig: detectedTemplateConfig,
      defaultMaterialId: "MAT-WHITE-18",
      defaultThicknessMm: 18,
      deterministicPrompt: undefined as string | undefined,
      checkForTemplateText: false, // Set to true if QR detection fails, to look for CAI template text
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
      
      // ============================================================
      // SERVER-SIDE QR TEMPLATE DETECTION
      // If client didn't detect a template, try server-side detection
      // ============================================================
      if (!detectedTemplateId) {
        try {
          logger.info("📥 [ParseFile] Attempting server-side QR detection", { requestId });
          const qrStartTime = Date.now();
          
          qrDetectionResult = await detectTemplateQR(originalBuffer);
          
          if (qrDetectionResult.found && qrDetectionResult.templateId && qrDetectionResult.parsed?.isCAI) {
            detectedTemplateId = qrDetectionResult.templateId;
            const parsedTemplate = qrDetectionResult.parsed;
            
            logger.info("📥 [ParseFile] 🎯 CAI Template detected via QR!", {
              requestId,
              templateId: detectedTemplateId,
              format: parsedTemplate.format, // v1, legacy, or unknown
              orgId: parsedTemplate.orgId,
              version: parsedTemplate.version,
              serial: parsedTemplate.serial,
              qrDetectionMs: Date.now() - qrStartTime,
            });
            
            // For v1 format, load org config with shortcodes
            if (parsedTemplate.format === "v1" && parsedTemplate.orgId && parsedTemplate.version) {
              const orgConfig = await getOrgTemplateConfig(
                parsedTemplate.orgId,
                parsedTemplate.version
              );
              
              if (orgConfig) {
                detectedTemplateConfig = orgConfig;
                deterministicPrompt = buildDeterministicParsePrompt(orgConfig);
                
                logger.info("📥 [ParseFile] 🎯 Loaded org template config with shortcodes", {
                  requestId,
                  orgName: orgConfig.org_name,
                  edgebandCodes: orgConfig.shortcodes.edgebanding?.length || 0,
                  grooveCodes: orgConfig.shortcodes.grooving?.length || 0,
                  drillingCodes: orgConfig.shortcodes.drilling?.length || 0,
                  cncCodes: orgConfig.shortcodes.cnc?.length || 0,
                });
              }
            } else if (parsedTemplate.format === "legacy") {
              // Legacy format (CAI-{version}-{serial}) - recognized but no org config
              // Will proceed with standard AI OCR but knows it's a CAI template
              logger.info("📥 [ParseFile] 📋 Legacy CAI template detected - using standard AI OCR", {
                requestId,
                templateId: detectedTemplateId,
                version: parsedTemplate.version,
                serial: parsedTemplate.serial,
              });
            }
            
            // Update parse options with detected template
            parseOptions.templateId = detectedTemplateId;
            parseOptions.templateConfig = detectedTemplateConfig;
            parseOptions.deterministicPrompt = deterministicPrompt;
          } else if (qrDetectionResult.found && !qrDetectionResult.parsed?.isCAI) {
            // QR found but not a CAI template - proceed with normal OCR
            logger.info("📥 [ParseFile] Non-CAI QR found, proceeding with standard OCR", {
              requestId,
              rawQrData: qrDetectionResult.rawData?.slice(0, 50), // First 50 chars for debugging
              qrDetectionMs: Date.now() - qrStartTime,
            });
          } else {
            logger.info("📥 [ParseFile] No QR code found, will try text-based detection during AI parse", {
              requestId,
              qrFound: qrDetectionResult.found,
              qrError: qrDetectionResult.error,
              qrDetectionMs: Date.now() - qrStartTime,
            });
            
            // Mark that we should check for CAI template text during AI parsing
            parseOptions.checkForTemplateText = true;
          }
        } catch (qrError) {
          logger.warn("📥 [ParseFile] QR detection failed (continuing without template)", {
            requestId,
            error: qrError instanceof Error ? qrError.message : "Unknown error",
          });
        }
      } else {
        // Client already detected template, try to load org config
        logger.info("📥 [ParseFile] Using client-detected template", {
          requestId,
          templateId: detectedTemplateId,
        });
        
        // Parse the template ID to get org info
        const { parseTemplateId } = await import("@/lib/templates/org-template-generator");
        const parsed = parseTemplateId(detectedTemplateId);
        
        if (parsed.isCAI && parsed.orgId && parsed.version) {
          const orgConfig = await getOrgTemplateConfig(parsed.orgId, parsed.version);
          
          if (orgConfig) {
            detectedTemplateConfig = orgConfig;
            deterministicPrompt = buildDeterministicParsePrompt(orgConfig);
            parseOptions.templateConfig = detectedTemplateConfig;
            parseOptions.deterministicPrompt = deterministicPrompt;
            
            logger.info("📥 [ParseFile] 🎯 Loaded org config for client-detected template", {
              requestId,
              orgName: orgConfig.org_name,
            });
          }
        }
      }
      
      // Optimize images using adaptive analysis
      let imageBuffer: Buffer;
      let mimeType = "image/jpeg"; // Default to JPEG for optimization
      const optimizeStart = Date.now();
      
      try {
        const { analyzeImage, optimizeImage } = await import("@/lib/ai/ocr-optimizer");
        const inputBuffer = Buffer.from(originalBuffer);
        
        // Analyze image content for optimal settings
        const analysis = await analyzeImage(inputBuffer);
        
        logger.info("📥 [ParseFile] Image analysis complete", {
          requestId,
          contentType: analysis.contentType,
          complexity: analysis.complexity.toFixed(2),
          textDensity: analysis.textDensity,
          hasTable: analysis.hasTable,
          recommendations: analysis.recommendations,
        });
        
        // Optimize based on analysis
        const optimized = await optimizeImage(inputBuffer, analysis);
        imageBuffer = optimized.buffer;
        mimeType = optimized.mimeType;
        
        if (optimized.optimizedSizeKB < optimized.originalSizeKB) {
          const reduction = ((1 - optimized.optimizedSizeKB / optimized.originalSizeKB) * 100);
          logger.info("📥 [ParseFile] Image optimized with adaptive settings", {
            requestId,
            originalSizeKB: optimized.originalSizeKB.toFixed(1),
            optimizedSizeKB: optimized.optimizedSizeKB.toFixed(1),
            reduction: `${reduction.toFixed(0)}%`,
            contentType: analysis.contentType,
            optimizeTimeMs: Date.now() - optimizeStart,
          });
        } else {
          logger.debug("📥 [ParseFile] Image already optimized", {
            requestId,
            sizeKB: optimized.originalSizeKB.toFixed(1),
            mimeType,
          });
        }
        
      } catch (optimizeError) {
        // Fallback to simple sharp optimization
        logger.warn("📥 [ParseFile] Adaptive optimization failed, using fallback", {
          requestId,
          error: optimizeError instanceof Error ? optimizeError.message : "Unknown error",
        });
        
        try {
          const sharpInstance = sharp(Buffer.from(originalBuffer));
          const metadata = await sharpInstance.metadata();
          
          const needsResize = 
            (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
            (metadata.height && metadata.height > MAX_IMAGE_DIMENSION) ||
            originalSizeKB > TARGET_IMAGE_KB;
          
          if (needsResize) {
            let quality = 90;
            if (originalSizeKB > 15000) quality = 85;
            else if (originalSizeKB > 8000) quality = 88;
            
            imageBuffer = await sharpInstance
              .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
                fit: "inside",
                withoutEnlargement: true,
              })
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();
            mimeType = "image/jpeg";
          } else {
            imageBuffer = Buffer.from(originalBuffer);
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
        } catch (sharpError) {
          logger.warn("📥 [ParseFile] All optimization failed, using original", {
            requestId,
            error: sharpError instanceof Error ? sharpError.message : "Unknown error",
          });
          imageBuffer = Buffer.from(originalBuffer);
          
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
        provider: provider.name,
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
        
        // TEXT-BASED TEMPLATE DETECTION FALLBACK
        // If QR detection failed but we still want to check if this might be a CAI template
        if (parseOptions.checkForTemplateText && aiResult.rawResponse) {
          const textDetectionResult = detectTemplateFromText(aiResult.rawResponse);
          
          if (textDetectionResult.found) {
            logger.info("📥 [ParseFile] 🔍 Text-based template detection succeeded", {
              requestId,
              templateId: textDetectionResult.templateId,
              version: textDetectionResult.version,
              confidence: textDetectionResult.confidence,
              detectionMethod: textDetectionResult.detectionMethod,
              rawMatch: textDetectionResult.rawMatch?.slice(0, 50),
            });
            
            // If we found a parseable template ID, try to load org config
            if (textDetectionResult.parsed?.isCAI && textDetectionResult.parsed.orgId && textDetectionResult.parsed.version) {
              const orgConfig = await getOrgTemplateConfig(
                textDetectionResult.parsed.orgId, 
                textDetectionResult.parsed.version
              );
              
              if (orgConfig) {
                logger.info("📥 [ParseFile] 🎯 Loaded org config from text detection", {
                  requestId,
                  orgName: orgConfig.org_name,
                });
                // Note: At this point we've already parsed with generic prompts
                // Could re-parse with deterministic prompt for better accuracy
                // For now, just log that we detected a template
              }
            }
          } else {
            logger.debug("📥 [ParseFile] No CAI template indicators found in text", { requestId });
          }
        }
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
      aiResult = await processPDF(file, provider, parseOptions, requestId, detectedTemplateId || undefined);
      
      logger.info("📥 [ParseFile] PDF processing completed", {
        requestId,
        success: aiResult.success,
        partsFound: aiResult.parts?.length ?? 0,
        pdfTimeMs: Date.now() - pdfStartTime,
      });
      
    } else if (fileType === "excel") {
      // Excel files need to be parsed client-side with the Excel parser
      logger.info("📥 [ParseFile] Excel file - use client-side parser", {
        requestId,
        fileName: file.name,
      });
      return NextResponse.json(
        { 
          error: "Excel files should be parsed using the Excel parser in the browser. Please use the paste/upload feature in the intake flow.",
          code: "EXCEL_USE_CLIENT_PARSER"
        },
        { status: 400 }
      );
    } else {
      logger.warn("📥 [ParseFile] Unsupported file type", {
        requestId,
        fileType,
        mimeType,
        fileName: file.name,
      });
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType || "unknown"}. Use images (JPG, PNG, WebP) or PDFs.` },
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

    // Save the file to storage and resolve operations IN PARALLEL for better performance
    logger.debug("📥 [ParseFile] Starting parallel storage + operations resolution", {
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
        // Prepare file data for upload (read buffer once)
        const fileBuffer = await file.arrayBuffer();
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userData.organization_id}/${timestamp}_${sanitizedName}`;
        
        // Run operations resolution and storage upload IN PARALLEL
        const [resolveResult, storageResult] = await Promise.allSettled([
          // Task 1: Resolve operations against org's database
          (async () => {
            if (aiResult.parts && aiResult.parts.length > 0) {
              const resolveStart = Date.now();
              const resolvedParts = await resolveOperationsForParts(
                aiResult.parts,
                userData.organization_id
              );
              logger.info("📥 [ParseFile] Operations resolved against org database", {
                requestId,
                organizationId: userData.organization_id,
                partsResolved: resolvedParts.length,
                resolveTimeMs: Date.now() - resolveStart,
              });
              return resolvedParts;
            }
            return aiResult.parts;
          })(),
          
          // Task 2: Upload file to storage
          (async () => {
            logger.debug("📥 [ParseFile] Uploading to storage", {
              requestId,
              storagePath,
              bucket: "cutlist-files",
            });
            
            const { error: storageError } = await serviceClient.storage
              .from("cutlist-files")
              .upload(storagePath, Buffer.from(fileBuffer), {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            
            if (storageError) {
              throw storageError;
            }
            
            // Create uploaded_files record
            const fileId = crypto.randomUUID();
            const { error: dbError } = await serviceClient
              .from("uploaded_files")
              .insert({
                id: fileId,
                organization_id: userData.organization_id,
                file_name: sanitizedName,
                original_name: file.name,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                storage_path: storagePath,
                kind: "source",
                created_at: new Date().toISOString(),
              });
            
            if (dbError) {
              throw dbError;
            }
            
            return { fileId, storagePath };
          })(),
        ]);
        
        // Handle resolve result
        if (resolveResult.status === "fulfilled" && resolveResult.value) {
          aiResult.parts = resolveResult.value;
        } else if (resolveResult.status === "rejected") {
          logger.warn("📥 [ParseFile] Operation resolution failed (non-fatal)", {
            requestId,
            error: resolveResult.reason instanceof Error ? resolveResult.reason.message : "Unknown error",
          });
        }
        
        // Handle storage result
        if (storageResult.status === "fulfilled") {
          uploadedFileId = storageResult.value.fileId;
          logger.info("📥 [ParseFile] File saved to storage", { 
            requestId,
            fileId: storageResult.value.fileId, 
            storagePath: storageResult.value.storagePath, 
            sizeBytes: file.size,
            storageTimeMs: Date.now() - storageStartTime,
          });
        } else {
          logger.warn("📥 [ParseFile] Storage upload failed", {
            requestId,
            error: storageResult.reason?.message || "Unknown error",
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

    // ============================================================
    // TEMPLATE-SPECIFIC POST-PROCESSING
    // ============================================================
    let templateParseInfo: {
      isTemplate: boolean;
      templateId?: string;
      projectCode?: string;
      pageNumber?: number;
      totalPages?: number;
      sessionId?: string;
      isMultiPage?: boolean;
      readyToMerge?: boolean;
      autoAccept?: boolean;
      autoAcceptThreshold?: number;
      autoAcceptReasons?: string[];
    } = { isTemplate: false };
    
    if (detectedTemplateId && qrDetectionResult?.parsed) {
      const processingTimeMs = Date.now() - requestStartTime;
      
      // Extract project info from parsed parts (AI should include this)
      // For now, we'll use basic detection
      const projectCode = `proj_${Date.now()}`; // Will be enhanced with AI extraction
      
      // Build template parse result for registration
      const templateResult: TemplateParseResult = {
        success: true,
        templateId: detectedTemplateId,
        orgId: qrDetectionResult.parsed.orgId || "",
        version: qrDetectionResult.parsed.version || "1.0",
        projectInfo: {
          projectCode,
          page: 1, // Will be extracted from AI response
          totalPages: undefined, // Will be extracted from AI response
        },
        parts: (aiResult.parts || []).map((p: { part?: { label?: string; length_mm?: number; width_mm?: number; thickness_mm?: number; quantity?: number; material_id?: string; ops?: { edging?: { summary?: { code?: string } }; grooves?: Array<{ groove_id?: string }>; holes?: Array<{ pattern_id?: string }>; custom_cnc_ops?: Array<{ op_type?: string }> }; operator_notes?: string; audit?: { confidence?: number } } }, i: number) => ({
          rowNumber: i + 1,
          label: p.part?.label,
          length: p.part?.length_mm,
          width: p.part?.width_mm,
          thickness: p.part?.thickness_mm,
          quantity: p.part?.quantity,
          material: p.part?.material_id,
          edge: p.part?.ops?.edging?.summary?.code,
          groove: p.part?.ops?.grooves?.[0]?.groove_id,
          drill: p.part?.ops?.holes?.[0]?.pattern_id,
          cnc: p.part?.ops?.custom_cnc_ops?.[0]?.op_type,
          notes: p.part?.operator_notes,
          confidence: p.part?.audit?.confidence || 0.8,
        })) as ParsedTemplatePart[],
        errors: [],
        confidence: aiResult.totalConfidence || 0,
      };
      
      // Register for multi-page merging
      const pageRegistration = registerTemplatePage(
        qrDetectionResult.parsed.orgId || "unknown",
        user.id,
        detectedTemplateId,
        uploadedFileId || crypto.randomUUID(),
        file.name,
        templateResult,
        processingTimeMs
      );
      
      // Check auto-accept
      const autoAcceptResult = checkAutoAccept(templateResult.parts, detectedTemplateId);
      
      templateParseInfo = {
        isTemplate: true,
        templateId: detectedTemplateId,
        projectCode,
        pageNumber: pageRegistration.currentPage,
        totalPages: pageRegistration.totalExpectedPages,
        sessionId: pageRegistration.sessionId,
        isMultiPage: pageRegistration.isMultiPage,
        readyToMerge: pageRegistration.readyToMerge,
        autoAccept: autoAcceptResult.shouldAutoAccept,
        autoAcceptThreshold: AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
        autoAcceptReasons: autoAcceptResult.reasons,
      };
      
      // Log audit (async, don't wait)
      const orgIdForAudit = qrDetectionResult.parsed.orgId;
      if (orgIdForAudit) {
        logTemplateParseAudit({
          organizationId: orgIdForAudit,
          userId: user.id,
          templateId: detectedTemplateId,
          version: qrDetectionResult.parsed.version || "1.0",
          projectCode,
          totalPages: 1,
          totalParts: aiResult.parts?.length || 0,
          averageConfidence: aiResult.totalConfidence || 0,
          autoAccepted: autoAcceptResult.shouldAutoAccept,
          humanCorrected: false,
          correctionCount: 0,
          processingTimeMs,
        }).catch(err => {
          logger.warn("📥 [ParseFile] Audit log failed (non-fatal)", {
            requestId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        });
      }
      
      logger.info("📥 [ParseFile] 🎯 Template parsing complete", {
        requestId,
        templateId: detectedTemplateId,
        autoAccept: autoAcceptResult.shouldAutoAccept,
        confidence: aiResult.totalConfidence,
        sessionId: pageRegistration.sessionId,
        isMultiPage: pageRegistration.isMultiPage,
      });
    }

    // DEBUG: Log the exact structure being returned to client
    if (aiResult.parts && aiResult.parts.length > 0) {
      const firstPart = aiResult.parts[0] as Record<string, unknown>;
      logger.info("🔍 [DEBUG] API Response parts structure", {
        requestId,
        partsCount: aiResult.parts.length,
        firstPartKeys: Object.keys(firstPart),
        firstPartSample: {
          size: firstPart.size,
          qty: firstPart.qty,
          label: firstPart.label,
          // Check for alternative formats
          l: firstPart.l,
          w: firstPart.w,
          q: firstPart.q,
          length: firstPart.length,
          width: firstPart.width,
          quantity: firstPart.quantity,
        },
      });
    }

    // Return parsed results with file ID if saved
    return NextResponse.json({
      success: true,
      parts: aiResult.parts,
      totalConfidence: aiResult.totalConfidence,
      processingTimeMs: aiResult.processingTimeMs,
      rawResponse: aiResult.rawResponse,
      uploadedFileId, // Include file ID for linking to cutlist later
      // Template-specific info for 0-human-review flow
      template: templateParseInfo.isTemplate ? templateParseInfo : undefined,
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
  requestId: string,
  initialTemplateId?: string // Template ID detected from QR code (if any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Track template ID - may be detected from QR or from text content
  let detectedTemplateId = initialTemplateId;
  let qrDetectionResult: { found: boolean; templateId?: string; parsed?: { orgId?: string; version?: string } } | null = null;
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
  
  // Quality thresholds for deciding when to try PDF-to-image fallback
  const MIN_OCR_CONFIDENCE = 0.5; // Below this, try vision fallback
  const MIN_TEXT_PER_PAGE = 100; // Expected chars per page of parts data
  
  // Prefer Python OCR if it succeeded (better for tables/scanned docs)
  // But fall back to pdf-parse if Python OCR failed
  let bestResult: { source: string; text: string; success: boolean; confidence?: number; pageCount?: number } | null = null;
  let shouldTryVisionFallback = false;
  
  if (pythonOCRResult?.success) {
    const ocrConfidence = (pythonOCRResult as { confidence?: number }).confidence ?? 1;
    const pageCount = (pythonOCRResult as { pageCount?: number }).pageCount ?? 1;
    const expectedMinText = pageCount * MIN_TEXT_PER_PAGE;
    
    // Check OCR quality - if confidence is too low or text too short, flag for vision fallback
    if (ocrConfidence < MIN_OCR_CONFIDENCE || pythonOCRResult.text.length < expectedMinText) {
      shouldTryVisionFallback = true;
      logger.warn("📥 [ParseFile] ⚠️ Python OCR quality too low", {
        requestId,
        confidence: ocrConfidence.toFixed(2),
        textLength: pythonOCRResult.text.length,
        expectedMinText,
        pageCount,
        willTryVisionFallback: true,
      });
    }
    
    bestResult = pythonOCRResult;
    logger.info("📥 [ParseFile] ✅ Using Python OCR result (preferred)", {
      requestId,
      textLength: pythonOCRResult.text.length,
      confidence: ocrConfidence.toFixed(2),
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
    
    // Detect template ID from extracted text if not already detected
    if (!detectedTemplateId && bestResult.text) {
      // Look for CAI template ID pattern: CAI-{orgId}-v{version}
      const templateIdMatch = bestResult.text.match(/CAI-([a-zA-Z0-9]+)-v(\d+(?:\.\d+)?)/);
      if (templateIdMatch) {
        detectedTemplateId = templateIdMatch[0];
        qrDetectionResult = {
          found: true,
          templateId: detectedTemplateId,
          parsed: {
            orgId: templateIdMatch[1],
            version: templateIdMatch[2],
          },
        };
        logger.info("📥 [ParseFile] 🎯 Detected template ID from PDF text", {
          requestId,
          templateId: detectedTemplateId,
          orgId: templateIdMatch[1],
          version: templateIdMatch[2],
        });
      }
    }
    
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
      const skippedReasons: Record<string, number> = {}; // Track skipped pages
      
      for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        const batch = pages.slice(i, i + BATCH_SIZE);
        
        logger.info(`📥 [ParseFile] Processing page batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)}`, {
          requestId,
          pagesInBatch: batch.map((p: any) => p.pageNumber),
        });
        
        const batchResults = await Promise.allSettled(
          batch.map(async (page: any) => {
            if (!page.text || page.text.length < 50) {
              return { pageNumber: page.pageNumber, parts: [], skipped: true, reason: "too short" };
            }
            
            // Skip fill-in guide, reference, and header-only pages (not parts data)
            const pageTextUpper = page.text.toUpperCase();
            const isFillInGuide = pageTextUpper.includes("FILL-IN GUIDE") || 
                                  pageTextUpper.includes("FILL IN GUIDE") ||
                                  pageTextUpper.includes("BEST OCR TIPS") ||
                                  pageTextUpper.includes("SHORTCODE REFERENCE");
            const isTemplateHeader = pageTextUpper.includes("PROJECT INFORMATION") &&
                                     !pageTextUpper.match(/\d{3,}\s*[×xX]\s*\d{3,}/); // No dimension data
            const isMaterialsRefOnly = pageTextUpper.includes("MATERIALS REFERENCE") &&
                                       !pageTextUpper.match(/\d{3,}\s*[×xX]\s*\d{3,}/);
            
            if (isFillInGuide) {
              logger.info(`📥 [ParseFile] 📝 Skipping fill-in guide page ${page.pageNumber}`, { requestId });
              return { pageNumber: page.pageNumber, parts: [], skipped: true, reason: "fill-in guide" };
            }
            if (isTemplateHeader) {
              logger.info(`📥 [ParseFile] 📋 Skipping header-only page ${page.pageNumber}`, { requestId });
              return { pageNumber: page.pageNumber, parts: [], skipped: true, reason: "header only" };
            }
            if (isMaterialsRefOnly) {
              logger.info(`📥 [ParseFile] 📦 Skipping materials reference page ${page.pageNumber}`, { requestId });
              return { pageNumber: page.pageNumber, parts: [], skipped: true, reason: "materials ref" };
            }
            
            // Check if page appears to be a blank template (has row structure but no data)
            // Blank templates have headers like "Part Name", "L(mm)", "W(mm)" but no actual values
            const hasBlankRows = pageTextUpper.includes("PART NAME") && 
                                 pageTextUpper.includes("L(MM)") &&
                                 !pageTextUpper.match(/\b\d{3,}\b.*\b\d{3,}\b/); // No dimension pairs
            if (hasBlankRows && detectedTemplateId) {
              logger.info(`📥 [ParseFile] 📄 Skipping blank template page ${page.pageNumber}`, { requestId });
              return { pageNumber: page.pageNumber, parts: [], skipped: true, reason: "blank template" };
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
            // Track skipped pages for messaging
            if (result.value.skipped && result.value.reason) {
              skippedReasons[result.value.reason] = (skippedReasons[result.value.reason] || 0) + 1;
            }
            
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
        skippedPages: Object.keys(skippedReasons).length > 0 ? skippedReasons : undefined,
        aiTimeMs: Date.now() - aiStartTime,
        totalPdfTimeMs: Date.now() - pdfStartTime,
      });
      
      // If no parts found and it's a detected template, provide helpful message
      if (allParts.length === 0 && detectedTemplateId) {
        const allPagesSkipped = Object.values(skippedReasons).reduce((a, b) => a + b, 0) === pageCount;
        if (allPagesSkipped || skippedReasons["blank template"] || skippedReasons["fill-in guide"]) {
          return {
            success: false,
            parts: [],
            totalConfidence: 0,
            errors: [
              "This appears to be a blank CAI template PDF. Templates are designed to be:\n\n" +
              "1️⃣ PRINTED out on paper\n" +
              "2️⃣ FILLED IN by hand with your parts data\n" +
              "3️⃣ PHOTOGRAPHED or SCANNED\n" +
              "4️⃣ UPLOADED as an IMAGE (JPG/PNG)\n\n" +
              "💡 Tip: For best OCR accuracy, use BLOCK LETTERS when filling in the template."
            ],
            processingTime: Date.now() - aiStartTime,
          };
        }
      }
      
      const multiPageResult = {
        success: allParts.length > 0,
        parts: allParts,
        totalConfidence: allParts.length > 0 
          ? allParts.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / allParts.length 
          : 0,
        errors: allErrors,
        processingTime: Date.now() - aiStartTime,
      };
      
      // For multi-page: if OCR quality was low AND we found few parts, try vision fallback
      const MIN_EXPECTED_PARTS_MULTI = 5;
      if (shouldTryVisionFallback && allParts.length < MIN_EXPECTED_PARTS_MULTI) {
        logger.info("📥 [ParseFile] 🖼️ Low OCR quality on multi-page + few parts - trying vision", {
          requestId,
          partsFoundFromOCR: allParts.length,
          pageCount,
        });
        
        try {
          const visionResult = await convertPdfToImagesAndParse(
            Buffer.from(pdfBuffer),
            provider,
            parseOptions,
            requestId,
            file.name,
            pythonOCR
          );
          
          if (visionResult.success && visionResult.parts.length > allParts.length) {
            logger.info("📥 [ParseFile] ✅ Vision fallback found more parts on multi-page!", {
              requestId,
              ocrParts: allParts.length,
              visionParts: visionResult.parts.length,
            });
            return {
              ...visionResult,
              processingTimeMs: Date.now() - pdfStartTime,
            };
          }
        } catch (error) {
          logger.warn("📥 [ParseFile] ⚠️ Vision fallback failed on multi-page", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      return multiPageResult;
    }
    
    // Single page or no page data: Use standard text parsing with chunking
    const result = await provider.parseText(bestResult.text, parseOptions);
    
    logger.info("📥 [ParseFile] AI text parsing completed", {
      requestId,
      source: bestResult.source,
      partsFound: result.parts?.length ?? 0,
      aiTimeMs: Date.now() - aiStartTime,
      totalPdfTimeMs: Date.now() - pdfStartTime,
      shouldTryVisionFallback,
    });
    
    // If OCR quality was flagged as low AND we found few parts, try vision fallback
    const partsFound = result.parts?.length ?? 0;
    const MIN_EXPECTED_PARTS = 5; // If we got fewer, and OCR was poor, try vision
    
    if (shouldTryVisionFallback && partsFound < MIN_EXPECTED_PARTS) {
      logger.info("📥 [ParseFile] 🖼️ Low OCR quality + few parts - trying PDF-to-image fallback", {
        requestId,
        partsFoundFromOCR: partsFound,
        confidence: (bestResult as { confidence?: number }).confidence?.toFixed(2),
      });
      
      try {
        const visionResult = await convertPdfToImagesAndParse(
          Buffer.from(pdfBuffer),
          provider,
          parseOptions,
          requestId,
          file.name,
          pythonOCR
        );
        
        // Compare results - use whichever got more parts
        if (visionResult.success && visionResult.parts.length > partsFound) {
          logger.info("📥 [ParseFile] ✅ Vision fallback found more parts!", {
            requestId,
            ocrParts: partsFound,
            visionParts: visionResult.parts.length,
            usingVisionResult: true,
          });
          return {
            ...visionResult,
            processingTimeMs: Date.now() - pdfStartTime,
          };
        } else {
          logger.info("📥 [ParseFile] 📊 OCR result was better than vision fallback", {
            requestId,
            ocrParts: partsFound,
            visionParts: visionResult.parts?.length ?? 0,
          });
        }
      } catch (error) {
        logger.warn("📥 [ParseFile] ⚠️ Vision fallback failed", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return result;
  }
  
  // Neither extraction worked - check if this might be a blank CAI template
  const isLikelyBlankTemplate = 
    file.name.toLowerCase().includes("template") ||
    file.name.toLowerCase().includes("cutlist") ||
    file.name.toLowerCase().includes("smart") ||
    file.name.toLowerCase().includes("cai");
  
  // If not a blank template, try native Claude PDF support FIRST (fastest!)
  if (!isLikelyBlankTemplate) {
    // ============================================
    // STRATEGY 1: Try Claude's NATIVE PDF support
    // Claude can process PDFs directly without conversion!
    // ============================================
    logger.info("📥 [ParseFile] 📄 Trying Claude NATIVE PDF support", {
      requestId,
      fileName: file.name,
      pdfSizeKB: Math.round(pdfBuffer.byteLength / 1024),
    });
    
    try {
      // Check if provider has native PDF support (Anthropic)
      if (provider.parseDocument && typeof provider.parseDocument === "function") {
        const nativePdfResult = await provider.parseDocument(
          pdfBuffer,
          undefined, // No extracted text needed - Claude reads PDF directly
          parseOptions
        );
        
        if (nativePdfResult.success && nativePdfResult.parts && nativePdfResult.parts.length > 0) {
          logger.info("📥 [ParseFile] ✅ Claude NATIVE PDF succeeded!", {
            requestId,
            partsFound: nativePdfResult.parts.length,
            processingTimeMs: Date.now() - pdfStartTime,
          });
          
          return {
            success: true,
            parts: nativePdfResult.parts.map((part: { part_id?: string; label?: string; size?: { L: number; W: number }; qty?: number; thickness_mm?: number; material_id?: string; allow_rotation?: boolean; notes?: string; audit?: { confidence?: number } }) => ({
              ...part,
              part_id: part.part_id || `P-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              size: part.size || { L: 0, W: 0 },
              qty: part.qty || 1,
              audit: {
                source_method: "native_pdf",
                confidence: part.audit?.confidence || nativePdfResult.totalConfidence || 0.8,
                human_verified: false,
              },
            })),
            totalConfidence: nativePdfResult.totalConfidence || 0.8,
            rawResponse: nativePdfResult.rawResponse,
            errors: [],
            processingTimeMs: Date.now() - pdfStartTime,
            templateId: detectedTemplateId,
            templateParsed: !!detectedTemplateId,
            qrDetectionResult,
          };
        } else {
          logger.warn("📥 [ParseFile] ⚠️ Claude NATIVE PDF returned no parts, trying image fallback", {
            requestId,
            errors: nativePdfResult.errors,
          });
        }
      }
    } catch (nativePdfError) {
      logger.warn("📥 [ParseFile] ⚠️ Claude NATIVE PDF failed, trying image fallback", {
        requestId,
        error: nativePdfError instanceof Error ? nativePdfError.message : String(nativePdfError),
      });
    }
    
    // ============================================
    // STRATEGY 2: PDF-to-image fallback
    // Convert PDF pages to images and parse with vision
    // ============================================
    logger.info("📥 [ParseFile] 🖼️ Trying PDF-to-image fallback", {
      requestId,
      fileName: file.name,
    });
    
    try {
      const pdfToImageResult = await convertPdfToImagesAndParse(
        Buffer.from(pdfBuffer),
        provider,
        parseOptions,
        requestId,
        file.name,
        pythonOCR
      );
      
      if (pdfToImageResult.success && pdfToImageResult.parts.length > 0) {
        logger.info("📥 [ParseFile] ✅ PDF-to-image fallback succeeded", {
          requestId,
          partsFound: pdfToImageResult.parts.length,
          processingTimeMs: Date.now() - pdfStartTime,
        });
        
        return {
          ...pdfToImageResult,
          processingTimeMs: Date.now() - pdfStartTime,
        };
      }
    } catch (error) {
      logger.warn("📥 [ParseFile] ⚠️ PDF-to-image fallback failed", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  logger.error("📥 [ParseFile] ❌ Could not extract text from PDF", {
    requestId,
    fileName: file.name,
    pdfParseTextLength: pdfParseResult?.text?.length ?? 0,
    pythonOCRTextLength: pythonOCRResult?.text?.length ?? 0,
    pythonOCRConfigured: pythonOCR.isConfigured(),
    totalPdfTimeMs: Date.now() - pdfStartTime,
    isLikelyBlankTemplate,
    suggestion: isLikelyBlankTemplate ? "This appears to be a blank template" : "Upload as image instead",
  });
  
  // Provide context-specific error message
  const errorMessage = isLikelyBlankTemplate
    ? "This appears to be a blank CAI template PDF. Templates are designed to be:\n\n" +
      "1️⃣ PRINTED out on paper\n" +
      "2️⃣ FILLED IN by hand with your parts data\n" +
      "3️⃣ PHOTOGRAPHED or SCANNED\n" +
      "4️⃣ UPLOADED as an IMAGE (JPG/PNG)\n\n" +
      "💡 Tip: For best OCR accuracy, use BLOCK LETTERS when filling in the template."
    : "Could not extract text from this PDF. This appears to be a scanned document. " +
      "Please try one of these alternatives:\n" +
      "• Take a clear photo of the document and upload the image\n" +
      "• Export the PDF as an image (PNG/JPG) and upload that\n" +
      "• If possible, use a text-based PDF instead";
  
  return {
    success: false,
    parts: [],
    totalConfidence: 0,
    errors: [errorMessage],
    processingTimeMs: Date.now() - pdfStartTime,
  };
}

/**
 * Convert PDF pages to images and parse them using AI vision
 * This is a fallback for scanned/image-based PDFs where text extraction fails
 * 
 * Strategy:
 * 1. Try LOCAL conversion first (using pdf-to-img/pdfjs-dist) - fast and reliable
 * 2. Fall back to Python OCR service only if local fails
 */
async function convertPdfToImagesAndParse(
  pdfBuffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseOptions: any,
  requestId: string,
  fileName: string,
  pythonOCR: ReturnType<typeof getPythonOCRClient>
): Promise<{
  success: boolean;
  parts: Array<{ part_id: string; label?: string; size: { L: number; W: number }; qty: number; thickness_mm?: number; material_id?: string; allow_rotation?: boolean; notes?: string; audit: { source_method: string; confidence: number; human_verified: boolean } }>;
  totalConfidence: number;
  errors: string[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  // ============================================
  // STEP 1: Try LOCAL PDF-to-image conversion first
  // ============================================
  logger.info("📥 [ParseFile] 🖼️ Trying LOCAL PDF-to-image conversion", {
    requestId,
    fileName,
  });
  
  let images: string[] = [];
  let conversionSource = "local";
  
  try {
    const localResult = await convertPdfToImages(pdfBuffer, { scale: 2.0, maxPages: 20 });
    
    if (localResult.success && localResult.images.length > 0) {
      images = localResult.images;
      logger.info("📥 [ParseFile] ✅ Local PDF conversion succeeded", {
        requestId,
        pageCount: images.length,
        processingTimeMs: Date.now() - startTime,
      });
    } else {
      logger.warn("📥 [ParseFile] ⚠️ Local PDF conversion failed, trying Python OCR", {
        requestId,
        error: localResult.error,
      });
    }
  } catch (localError) {
    logger.warn("📥 [ParseFile] ⚠️ Local PDF conversion error, trying Python OCR", {
      requestId,
      error: localError instanceof Error ? localError.message : String(localError),
    });
  }
  
  // ============================================
  // STEP 2: Fall back to Python OCR if local failed
  // ============================================
  if (images.length === 0 && pythonOCR.isConfigured()) {
    conversionSource = "python_ocr";
    
    try {
      logger.info("📥 [ParseFile] 🖼️ Requesting PDF-to-image from Python OCR", {
        requestId,
        fileName,
      });
      
      const base64Pdf = pdfBuffer.toString("base64");
      const ocrResult = await pythonOCR.extractFromPDFAsImages(base64Pdf, fileName);
      
      if (ocrResult?.success && ocrResult.images && ocrResult.images.length > 0) {
        images = ocrResult.images;
        logger.info("📥 [ParseFile] ✅ Python OCR extracted images from PDF", {
          requestId,
          imageCount: images.length,
        });
      } else {
        logger.warn("📥 [ParseFile] ⚠️ Python OCR could not extract images", {
          requestId,
          error: ocrResult?.error,
        });
      }
    } catch (pythonError) {
      logger.warn("📥 [ParseFile] ⚠️ Python OCR failed", {
        requestId,
        error: pythonError instanceof Error ? pythonError.message : String(pythonError),
      });
    }
  }
  
  // ============================================
  // STEP 3: If no images, return error
  // ============================================
  if (images.length === 0) {
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: [
        "Could not convert PDF to images.",
        "💡 Tip: Take photos of each page and upload them as images (PNG/JPG) for better results."
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  logger.info("📥 [ParseFile] 🖼️ PDF converted to images successfully", {
    requestId,
    imageCount: images.length,
    conversionSource,
  });
  
  // ============================================
  // STEP 4: Process images with AI vision
  // ============================================
  try {
    type PartWithAudit = { part_id: string; label?: string; size: { L: number; W: number }; qty: number; thickness_mm?: number; material_id?: string; allow_rotation?: boolean; notes?: string; audit: { source_method: string; confidence: number; human_verified: boolean; source_page?: number } };
    
    // Process pages in parallel with concurrency limit (2 at a time to avoid rate limits)
    const CONCURRENCY_LIMIT = 2;
    const pageResults: Array<{ pageNum: number; parts: PartWithAudit[]; confidence: number; error?: string }> = [];
    
    // Process in batches
    for (let i = 0; i < images.length; i += CONCURRENCY_LIMIT) {
      const batch = images.slice(i, i + CONCURRENCY_LIMIT);
      const batchStartIdx = i;
      
      const batchPromises = batch.map(async (imageBase64, idx) => {
        const pageNum = batchStartIdx + idx + 1;
        try {
          // Parse the image using AI vision
          const parseResult = await provider.parseImage(
            imageBase64,
            "image/png",
            parseOptions
          );
          
          if (parseResult.parts && parseResult.parts.length > 0) {
            const partsWithAudit: PartWithAudit[] = parseResult.parts.map((p: { part_id?: string; label?: string; size?: { L: number; W: number }; qty?: number; thickness_mm?: number; material_id?: string; allow_rotation?: boolean; notes?: string }) => ({
              ...p,
              part_id: p.part_id || `P-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              size: p.size || { L: 0, W: 0 },
              qty: p.qty || 1,
              audit: {
                source_method: "pdf_vision",
                confidence: parseResult.confidence ?? 0.7,
                human_verified: false,
                source_page: pageNum,
              },
            }));
            
            logger.info("📥 [ParseFile] ✅ Page parsed successfully", {
              requestId,
              pageNum,
              partsFound: parseResult.parts.length,
            });
            
            return { pageNum, parts: partsWithAudit, confidence: parseResult.confidence ?? 0.7 };
          }
          
          return { pageNum, parts: [], confidence: 0 };
        } catch (pageError) {
          logger.warn("📥 [ParseFile] ⚠️ Failed to process page", {
            requestId,
            pageNum,
            error: pageError instanceof Error ? pageError.message : String(pageError),
          });
          return { pageNum, parts: [], confidence: 0, error: `Page ${pageNum}: ${pageError instanceof Error ? pageError.message : "Failed to process"}` };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      pageResults.push(...batchResults);
    }
    
    // Aggregate results
    const allParts: PartWithAudit[] = [];
    const errors: string[] = [];
    let totalConfidence = 0;
    let successfulPages = 0;
    
    for (const result of pageResults) {
      if (result.parts.length > 0) {
        allParts.push(...result.parts);
        totalConfidence += result.confidence;
        successfulPages++;
      }
      if (result.error) {
        errors.push(result.error);
      }
    }
    
    const avgConfidence = successfulPages > 0 ? totalConfidence / successfulPages : 0;
    
    return {
      success: allParts.length > 0,
      parts: allParts,
      totalConfidence: avgConfidence,
      errors,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error("📥 [ParseFile] ❌ PDF-to-image conversion failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      parts: [],
      totalConfidence: 0,
      errors: [
        "PDF-to-image conversion failed. This PDF may be scanned or image-based.",
        "💡 Tip: Take photos of each page and upload them as images (PNG/JPG) for better results."
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }
}
