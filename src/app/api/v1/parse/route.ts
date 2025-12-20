/**
 * CAI Intake - Parse API
 * 
 * POST /api/v1/parse
 * Parses text, files, or voice input into CutPart objects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTextBatch } from "@/lib/parsers/text-parser";
import { parseExcel } from "@/lib/parser/excel-parser";
import { parseVoiceInput } from "@/lib/parser/voice-parser";
import { getOrCreateProvider, type ParseOptions as AIParseOptions } from "@/lib/ai/provider";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";

// Size limits for security
const SIZE_LIMITS = {
  MAX_TEXT_LENGTH: 500_000, // 500KB of text
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
};

// Request validation schema
const ParseRequestSchema = z.object({
  source_type: z.enum(["text", "file", "voice"]),
  content: z.string().max(SIZE_LIMITS.MAX_TEXT_LENGTH).optional(),
  file_id: z.string().optional(),
  file_url: z.string().url().optional(),
  options: z.object({
    default_material_id: z.string().optional(),
    default_thickness_mm: z.number().optional(),
    dim_order: z.enum(["LxW", "WxL", "infer"]).optional(),
    units: z.enum(["mm", "cm", "inch"]).optional(),
    use_ai: z.boolean().optional(),
    column_mapping: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "parseJobs");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parseResult = ParseRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { source_type, content, file_id, file_url, options } = parseResult.data;

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Handle different source types
    let result;
    
    switch (source_type) {
      case "text":
        if (!content) {
          return NextResponse.json(
            { error: "Content required for text parsing" },
            { status: 400 }
          );
        }
        
        // Use AI parsing if enabled
        if (options?.use_ai) {
          try {
            const provider = await getOrCreateProvider();
            const aiOptions: AIParseOptions = {
              extractMetadata: true,
              confidence: "balanced",
              defaultMaterialId: options?.default_material_id,
              defaultThicknessMm: options?.default_thickness_mm,
            };
            const aiResult = await provider.parseText(content, aiOptions);
            result = {
              parts: aiResult.parts.map(part => ({
                part: part.part,
                confidence: part.confidence,
                warnings: [],
                errors: [],
                originalText: content.slice(0, 100),
              })),
              totalParsed: aiResult.parts.length,
              totalErrors: aiResult.errors.length,
              averageConfidence: aiResult.totalConfidence,
            };
          } catch (aiError) {
            logger.warn("AI parsing failed, falling back to regex", { error: aiError });
            // Fallback to regex parsing
            result = parseTextBatch(content, {
              defaultMaterialId: options?.default_material_id,
              defaultThicknessMm: options?.default_thickness_mm,
              dimOrderHint: options?.dim_order,
              units: options?.units,
              sourceMethod: "paste_parser",
            });
          }
        } else {
          result = parseTextBatch(content, {
            defaultMaterialId: options?.default_material_id,
            defaultThicknessMm: options?.default_thickness_mm,
            dimOrderHint: options?.dim_order,
            units: options?.units,
            sourceMethod: "paste_parser",
          });
        }
        break;

      case "file":
        if (!file_id && !file_url) {
          return NextResponse.json(
            { error: "file_id or file_url required for file parsing" },
            { status: 400 }
          );
        }
        
        let fileBuffer: Buffer;
        let mimeType: string = "";
        let fileName: string = "";
        
        if (file_id) {
          // Fetch file from database/storage
          const { data: fileRecord, error: fileError } = await supabase
            .from("uploaded_files")
            .select("*")
            .eq("id", file_id)
            .eq("organization_id", userData.organization_id)
            .single();
            
          if (fileError || !fileRecord) {
            return NextResponse.json(
              { error: "File not found" },
              { status: 404 }
            );
          }
          
          // Get signed URL for the file
          const { data: signedUrlData, error: urlError } = await supabase
            .storage
            .from("cutlist-files")
            .createSignedUrl(fileRecord.storage_path, 60);
            
          if (urlError || !signedUrlData) {
            return NextResponse.json(
              { error: "Failed to access file" },
              { status: 500 }
            );
          }
          
          // Fetch the file content
          const fileResponse = await fetch(signedUrlData.signedUrl);
          if (!fileResponse.ok) {
            return NextResponse.json(
              { error: "Failed to download file" },
              { status: 500 }
            );
          }
          
          fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
          mimeType = fileRecord.mime_type || "";
          fileName = fileRecord.original_name || "";
        } else if (file_url) {
          // Fetch from URL directly
          const fileResponse = await fetch(file_url);
          if (!fileResponse.ok) {
            return NextResponse.json(
              { error: "Failed to fetch file from URL" },
              { status: 400 }
            );
          }
          
          fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
          mimeType = fileResponse.headers.get("content-type") || "";
          fileName = file_url.split("/").pop() || "unknown";
        } else {
          return NextResponse.json(
            { error: "File source required" },
            { status: 400 }
          );
        }
        
        // Parse based on file type
        if (mimeType.includes("csv") || fileName.endsWith(".csv")) {
          const csvContent = fileBuffer.toString("utf-8");
          result = parseTextBatch(csvContent, {
            defaultMaterialId: options?.default_material_id,
            defaultThicknessMm: options?.default_thickness_mm,
            dimOrderHint: options?.dim_order,
            units: options?.units,
            sourceMethod: "file_upload",
          });
        } else if (
          mimeType.includes("excel") || 
          mimeType.includes("spreadsheet") ||
          fileName.endsWith(".xlsx") ||
          fileName.endsWith(".xls")
        ) {
          // Create a new ArrayBuffer from the Buffer
          const arrayBuffer = new Uint8Array(fileBuffer).buffer;
          const excelResult = parseExcel(arrayBuffer, {
            mapping: options?.column_mapping as Record<string, string> | undefined,
            defaultMaterialId: options?.default_material_id,
            defaultThickness: options?.default_thickness_mm,
          });
          
          const successRate = excelResult.stats.totalRows > 0 
            ? excelResult.stats.parsedRows / excelResult.stats.totalRows 
            : 0;
          result = {
            parts: excelResult.parts.map(part => ({
              part,
              confidence: successRate,
              warnings: [],
              errors: [],
              originalText: "",
            })),
            totalParsed: excelResult.parts.length,
            totalErrors: excelResult.stats.errors,
            averageConfidence: successRate,
          };
        } else if (
          mimeType.includes("image") || 
          mimeType === "application/pdf" ||
          fileName.match(/\.(png|jpg|jpeg|gif|webp|pdf)$/i)
        ) {
          // OCR parsing requires AI provider
          if (options?.use_ai) {
            try {
              const provider = await getOrCreateProvider();
              const base64Data = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
              
              const aiOptions: AIParseOptions = {
                extractMetadata: true,
                confidence: "balanced",
                defaultMaterialId: options?.default_material_id,
                defaultThicknessMm: options?.default_thickness_mm,
              };
              
              const ocrResult = await provider.parseImage(base64Data, aiOptions);
              
              result = {
                parts: ocrResult.parts.map(part => ({
                  part: part.part,
                  confidence: part.confidence,
                  warnings: [],
                  errors: [],
                  originalText: "",
                })),
                totalParsed: ocrResult.parts.length,
                totalErrors: ocrResult.errors.length,
                averageConfidence: ocrResult.totalConfidence,
              };
            } catch (visionError) {
              logger.warn("AI Vision parsing failed", { error: visionError });
              return NextResponse.json(
                { error: "OCR parsing failed. Please try with a clearer image or enable AI mode." },
                { status: 400 }
              );
            }
          } else {
            return NextResponse.json(
              { error: "Enable AI mode for image/PDF parsing" },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Unsupported file type: ${mimeType}` },
            { status: 400 }
          );
        }
        break;

      case "voice":
        if (!content) {
          return NextResponse.json(
            { error: "Content required for voice parsing" },
            { status: 400 }
          );
        }
        
        // Parse voice transcript
        const voiceResult = parseVoiceInput(content, {
          defaultMaterialId: options?.default_material_id,
          defaultThickness: options?.default_thickness_mm,
        });
        
        // Voice parser returns a single part result
        result = {
          parts: voiceResult.part ? [{
            part: voiceResult.part,
            confidence: voiceResult.confidence,
            warnings: voiceResult.warnings,
            errors: voiceResult.errors,
            originalText: voiceResult.originalText,
          }] : [],
          totalParsed: voiceResult.part ? 1 : 0,
          totalErrors: voiceResult.errors.length,
          averageConfidence: voiceResult.confidence,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Unknown source type" },
          { status: 400 }
        );
    }

    // Create parse job record
    const { data: parseJob, error: jobError } = await supabase
      .from("parse_jobs")
      .insert({
        organization_id: userData.organization_id,
        user_id: user.id,
        source_kind: source_type,
        source_data: { content: content?.slice(0, 1000), file_id, options },
        status: "completed",
        parts_preview: result.parts.map(p => p.part),
        summary: {
          partsCount: result.totalParsed,
          parseMethod: source_type,
          confidence: result.averageConfidence,
          errors: result.totalErrors,
        },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      logger.error("Failed to create parse job:", jobError);
    }

    return NextResponse.json({
      success: true,
      job_id: parseJob?.id,
      parts: result.parts.map(p => ({
        ...p.part,
        _confidence: p.confidence,
        _warnings: p.warnings,
        _errors: p.errors,
        _original_text: p.originalText,
      })),
      stats: {
        total_parsed: result.totalParsed,
        total_errors: result.totalErrors,
        average_confidence: result.averageConfidence,
      },
    });

  } catch (error) {
    logger.error("Parse API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
