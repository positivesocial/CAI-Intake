/**
 * CAI Intake - File Parse API
 * 
 * POST /api/v1/parse-file
 * Parses image and PDF files using AI vision capabilities.
 * Handles the AI processing server-side where API keys are available.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getOrCreateProvider } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";

// Size limits
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "parseJobs");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authenticate user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string | null;
    const templateId = formData.get("templateId") as string | null;
    const templateConfigRaw = formData.get("templateConfig") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get AI provider
    const provider = await getOrCreateProvider();
    
    if (!provider.isConfigured()) {
      logger.error("AI provider not configured - missing API keys", {
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

    let templateConfig = undefined;
    if (templateConfigRaw) {
      try {
        templateConfig = JSON.parse(templateConfigRaw);
      } catch {
        // Ignore invalid template config
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
      // Process image
      const imageBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      aiResult = await provider.parseImage(dataUrl, parseOptions);
    } else if (fileType === "pdf") {
      // Process PDF - try text extraction first, then convert to images
      const pdfBuffer = await file.arrayBuffer();
      let extractedText = "";
      
      try {
        const pdfParseModule = await import("pdf-parse");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
        const pdfData = await pdfParse(Buffer.from(pdfBuffer));
        extractedText = pdfData.text?.trim() || "";
      } catch (err) {
        logger.warn("PDF text extraction failed, will try image conversion", { error: err });
      }
      
      // Check if we got meaningful text (more than 50 chars of actual content)
      const meaningfulText = extractedText.replace(/\s+/g, " ").trim();
      
      if (meaningfulText.length > 50) {
        // Use text parsing for text-based PDFs
        aiResult = await provider.parseText(extractedText, parseOptions);
      } else {
        // PDF is scanned/image-based - convert to images and use AI vision
        logger.info("Converting PDF to images for vision processing", { 
          textLength: meaningfulText.length,
          fileName: file.name
        });
        
        try {
          // Use pdfjs-dist to render PDF pages to images
          const pdfjsLib = await import("pdfjs-dist");
          const { createCanvas } = await import("canvas");
          
          // Load PDF document
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true,
          });
          const pdfDoc = await loadingTask.promise;
          
          const pdfImages: string[] = [];
          const numPages = Math.min(pdfDoc.numPages, 5); // Limit to 5 pages
          
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const scale = 2.0; // Higher resolution for better OCR
            const viewport = page.getViewport({ scale });
            
            // Create canvas
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext("2d");
            
            // Render PDF page to canvas
            await page.render({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              canvasContext: context as any,
              viewport,
            }).promise;
            
            // Convert to base64 PNG
            const imageData = canvas.toDataURL("image/png");
            pdfImages.push(imageData);
          }
          
          if (pdfImages.length === 0) {
            throw new Error("No pages found in PDF");
          }
          
          logger.info("PDF converted to images", { pageCount: pdfImages.length });
          
          // Process first page
          aiResult = await provider.parseImage(pdfImages[0], parseOptions);
          
          // If multi-page PDF, process additional pages and merge results
          if (pdfImages.length > 1 && aiResult.success) {
            logger.info("Processing additional PDF pages", { remaining: pdfImages.length - 1 });
            
            for (let i = 1; i < pdfImages.length; i++) {
              try {
                const pageResult = await provider.parseImage(pdfImages[i], parseOptions);
                if (pageResult.success) {
                  aiResult.parts.push(...pageResult.parts);
                }
              } catch (pageError) {
                logger.warn(`Failed to process PDF page ${i + 1}`, { error: pageError });
              }
            }
          }
          
        } catch (conversionError) {
          logger.error("PDF to image conversion failed", { error: conversionError });
          
          return NextResponse.json(
            { 
              error: "Could not process this PDF. Please try uploading as an image (screenshot or photo) instead.",
              code: "PDF_CONVERSION_FAILED"
            },
            { status: 400 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use images or PDFs." },
        { status: 400 }
      );
    }

    if (!aiResult.success) {
      return NextResponse.json(
        { 
          error: aiResult.errors.join(", ") || "AI parsing failed",
          code: "AI_PARSE_FAILED"
        },
        { status: 422 }
      );
    }

    // Return parsed results
    return NextResponse.json({
      success: true,
      parts: aiResult.parts,
      totalConfidence: aiResult.totalConfidence,
      processingTimeMs: aiResult.processingTimeMs,
      rawResponse: aiResult.rawResponse,
    });

  } catch (error) {
    logger.error("File parse error", { error });
    
    return NextResponse.json(
      { 
        error: "Failed to process file. Please try again.",
        code: "PARSE_ERROR"
      },
      { status: 500 }
    );
  }
}

