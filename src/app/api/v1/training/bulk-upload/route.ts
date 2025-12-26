/**
 * CAI Intake - Bulk Training Upload API
 * 
 * POST /api/v1/training/bulk-upload - Upload PDFs for verification and training
 * 
 * NOTE: Super admin only - training affects the entire platform.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import type { CutPart } from "@/lib/schema";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get user - verify super admin access
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true, isSuperAdmin: true },
    });

    // Super admin only
    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden - Super admin access required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const provider = formData.get("provider") as string || "anthropic";
    const extractMetadata = formData.get("extractMetadata") !== "false";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files provided" },
        { status: 400 }
      );
    }

    // Limit file count
    const MAX_FILES = 10;
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_FILES} files allowed per upload` },
        { status: 400 }
      );
    }

    // Process each file
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          return await processFile(file, {
            provider,
            extractMetadata,
            organizationId: dbUser?.organizationId ?? undefined,
          });
        } catch (error) {
          return {
            fileName: file.name,
            success: false,
            error: error instanceof Error ? error.message : "Processing failed",
          };
        }
      })
    );

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    console.error("Bulk upload failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bulk upload failed" },
      { status: 500 }
    );
  }
}

// ============================================================
// FILE PROCESSING
// ============================================================

interface ProcessOptions {
  provider: string;
  extractMetadata: boolean;
  organizationId?: string;
}

interface ProcessResult {
  fileName: string;
  success: boolean;
  extractedText?: string;
  parsedParts?: CutPart[];
  partsCount?: number;
  confidence?: number;
  error?: string;
  textFeatures?: {
    hasHeaders: boolean;
    estimatedColumns: number;
    estimatedRows: number;
    hasEdgeNotation: boolean;
    hasGrooveNotation: boolean;
  };
}

async function processFile(file: File, options: ProcessOptions): Promise<ProcessResult> {
  const { provider, extractMetadata, organizationId } = options;

  // Validate file type
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "text/plain", "text/csv"];
  if (!allowedTypes.includes(file.type)) {
    return {
      fileName: file.name,
      success: false,
      error: `Unsupported file type: ${file.type}`,
    };
  }

  // Determine source type
  const sourceType = getSourceType(file.type);

  // Extract text from file
  let extractedText: string;
  
  if (file.type === "text/plain" || file.type === "text/csv") {
    extractedText = await file.text();
  } else if (file.type === "application/pdf") {
    // For PDFs, use OCR
    extractedText = await extractTextFromPDF(file);
  } else {
    // For images, use OCR
    extractedText = await extractTextFromImage(file);
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return {
      fileName: file.name,
      success: false,
      error: "Failed to extract text from file",
    };
  }

  // Analyze text features
  const textFeatures = analyzeTextFeatures(extractedText);

  // Parse with AI
  const aiProvider = getAIProvider(provider as "openai" | "anthropic");
  const parseResult = await aiProvider.parseText(extractedText, {
    extractMetadata,
    confidence: "balanced",
    organizationId,
  });

  if (!parseResult.success || parseResult.parts.length === 0) {
    return {
      fileName: file.name,
      success: false,
      extractedText,
      textFeatures,
      error: parseResult.errors?.[0] || "No parts extracted",
    };
  }

  const parsedParts = parseResult.parts.map(p => p.part);

  return {
    fileName: file.name,
    success: true,
    extractedText,
    parsedParts,
    partsCount: parsedParts.length,
    confidence: parseResult.totalConfidence,
    textFeatures,
  };
}

function getSourceType(mimeType: string): "pdf" | "image" | "text" | "csv" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/csv") return "csv";
  return "text";
}

async function extractTextFromPDF(file: File): Promise<string> {
  // Use Python OCR service if available, otherwise fall back to basic extraction
  try {
    const { PythonOCRClient } = await import("@/lib/services/python-ocr-client");
    const client = new PythonOCRClient();
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const health = await client.checkHealth();
    if (health.status === "ok") {
      const result = await client.extractFromPDF(buffer);
      if (result.success && result.text) {
        return result.text;
      }
    }
    
    // Fall back to pdf-parse
    const pdfParse = await import("pdf-parse").then(m => m.default);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    
    // Fall back to pdf-parse
    try {
      const pdfParse = await import("pdf-parse").then(m => m.default);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (fallbackError) {
      console.error("PDF-parse fallback error:", fallbackError);
      return "";
    }
  }
}

async function extractTextFromImage(file: File): Promise<string> {
  // Use AI vision for image OCR
  try {
    const { getAIProvider } = await import("@/lib/ai");
    const provider = getAIProvider("anthropic");
    
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    
    const result = await provider.processImageOCR(base64, mimeType, {
      extractMetadata: false,
      confidence: "balanced",
    });
    
    return result.extractedText || "";
  } catch (error) {
    console.error("Image OCR error:", error);
    return "";
  }
}

// ============================================================
// TEXT ANALYSIS
// ============================================================

interface TextFeatures {
  hasHeaders: boolean;
  estimatedColumns: number;
  estimatedRows: number;
  hasEdgeNotation: boolean;
  hasGrooveNotation: boolean;
}

function analyzeTextFeatures(text: string): TextFeatures {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  
  // Check for header patterns
  const headerPatterns = /\b(label|description|name|length|width|height|qty|quantity|material|edge|groove|l1|l2|w1|w2|gl|gw)\b/i;
  const hasHeaders = lines.length > 0 && headerPatterns.test(lines[0]);

  // Estimate columns by looking at consistent separators
  const tabCount = (text.match(/\t/g) || []).length;
  const commaCount = (text.match(/,/g) || []).length;
  
  let estimatedColumns = 1;
  if (lines.length > 0) {
    const firstDataLine = hasHeaders ? lines[1] : lines[0];
    if (firstDataLine) {
      if (tabCount > lines.length * 2) {
        estimatedColumns = firstDataLine.split("\t").length;
      } else if (commaCount > lines.length * 2) {
        estimatedColumns = firstDataLine.split(",").length;
      }
    }
  }

  // Check for edge/groove patterns
  const edgePatterns = /\b(x{1,4}|2l|4l|2w|l1|l2|w1|w2|edge)\b/i;
  const groovePatterns = /\b(gl|gw|groove|grv|dado|rebate|bpg)\b/i;

  return {
    hasHeaders,
    estimatedColumns,
    estimatedRows: lines.length,
    hasEdgeNotation: edgePatterns.test(text),
    hasGrooveNotation: groovePatterns.test(text),
  };
}

