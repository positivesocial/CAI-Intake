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
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getOrCreateProvider } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import { getPythonOCRClient } from "@/lib/services/python-ocr-client";

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
      // Process image - use AI vision directly
      const imageBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      aiResult = await provider.parseImage(dataUrl, parseOptions);
      
    } else if (fileType === "pdf") {
      // Process PDF - use Python OCR service
      aiResult = await processPDF(file, provider, parseOptions);
      
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

/**
 * Process a PDF file using Python OCR service
 * Falls back to simple text extraction + AI if Python OCR is unavailable
 */
async function processPDF(
  file: File,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseOptions: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const pythonOCR = getPythonOCRClient();
  const pdfBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(pdfBuffer).toString("base64");

  // Check if Python OCR service is available
  if (pythonOCR.isConfigured()) {
    logger.info("🐍 Using Python OCR for PDF extraction", { fileName: file.name });
    
    const ocrResult = await pythonOCR.extractFromPDF(base64, file.name);
    
    if (ocrResult && ocrResult.success) {
      // Python OCR succeeded - prepare text for LLM parsing
      let textForParsing = ocrResult.text;
      
      // If tables were extracted, format them nicely for the LLM
      if (ocrResult.tables && ocrResult.tables.length > 0) {
        const tablesText = pythonOCR.formatTablesAsText(ocrResult.tables);
        textForParsing = `${tablesText}\n\n${ocrResult.text}`;
        
        logger.info("📊 Python OCR extracted tables", {
          tableCount: ocrResult.tables.length,
          method: ocrResult.method,
          confidence: ocrResult.confidence,
        });
      }

      // Check if we got meaningful text
      const meaningfulText = textForParsing.replace(/\s+/g, " ").trim();
      
      if (meaningfulText.length > 30) {
        logger.info("✅ Python OCR extraction successful", {
          textLength: meaningfulText.length,
          confidence: ocrResult.confidence,
          method: ocrResult.method,
          processingTime: ocrResult.processingTime,
        });
        
        // Use AI to parse the extracted text
        return await provider.parseText(textForParsing, parseOptions);
      } else {
        logger.warn("⚠️ Python OCR returned insufficient text", {
          textLength: meaningfulText.length,
          method: ocrResult.method,
        });
      }
    } else {
      logger.warn("⚠️ Python OCR failed or unavailable", {
        error: ocrResult?.error,
        success: ocrResult?.success,
      });
    }
  } else {
    logger.info("Python OCR service not configured, using fallback", {
      serviceUrl: process.env.PYTHON_OCR_SERVICE_URL,
    });
  }

  // Fallback: Try simple text extraction with pdf-parse
  logger.info("📄 Falling back to pdf-parse for text extraction", { fileName: file.name });
  
  let extractedText = "";
  
  try {
    const pdfParseModule = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const pdfData = await pdfParse(Buffer.from(pdfBuffer));
    extractedText = pdfData.text?.trim() || "";
  } catch (err) {
    logger.warn("PDF text extraction failed", { error: err });
  }
  
  // Check if we got meaningful text
  const meaningfulText = extractedText.replace(/\s+/g, " ").trim();
  
  if (meaningfulText.length > 50) {
    // Use text parsing for text-based PDFs
    logger.info("📝 Using extracted text for AI parsing", { textLength: meaningfulText.length });
    return await provider.parseText(extractedText, parseOptions);
  }
  
  // PDF is scanned/image-based and we couldn't get text
  // Return a helpful error suggesting alternatives
  logger.error("❌ Could not extract text from PDF", {
    fileName: file.name,
    textLength: meaningfulText.length,
    pythonOCRConfigured: pythonOCR.isConfigured(),
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
    processingTimeMs: 0,
  };
}
