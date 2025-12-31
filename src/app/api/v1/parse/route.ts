/**
 * CAI Intake - Parse API
 * 
 * POST /api/v1/parse
 * Parses text, files, or voice input into CutPart objects.
 * Supports session-based progress tracking and cancellation.
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

// Serverless function config - longer timeout for batch processing
export const maxDuration = 120;
export const dynamic = "force-dynamic";
import { initMaterialMatcher, matchMaterial, matchEdgeband } from "@/lib/matching/material-matcher";
import {
  setProgress,
  getProgress,
  isCancellationRequested,
} from "@/lib/progress/progress-store";
import {
  generateSessionId,
  initProgress,
  startFile,
  updateFileStage,
  completeFile,
  failFile,
  cancelSession,
  completeSession,
} from "@/lib/progress/progress-helpers";
import type { OCRProgressSnapshot } from "@/lib/progress/types";

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
  // Session ID for progress tracking (optional - auto-generated if not provided)
  session_id: z.string().max(100).optional(),
  options: z.object({
    default_material_id: z.string().optional(),
    default_thickness_mm: z.number().optional(),
    dim_order: z.enum(["LxW", "WxL", "infer"]).optional(),
    units: z.enum(["mm", "cm", "inch"]).optional(),
    use_ai: z.boolean().optional(),
    column_mapping: z.record(z.string(), z.string()).optional(),
    // Enable progress tracking
    track_progress: z.boolean().optional(),
    // Enable smart material matching against org materials
    smart_matching: z.boolean().optional(),
  }).optional(),
});

// Helper to update and save progress
function updateProgress(
  sessionId: string | undefined,
  updater: (snapshot: OCRProgressSnapshot) => OCRProgressSnapshot
): void {
  if (!sessionId) return;
  const current = getProgress(sessionId);
  if (current) {
    setProgress(sessionId, updater(current));
  }
}

// Check if processing should be cancelled
function shouldCancel(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  return isCancellationRequested(sessionId);
}

export async function POST(request: NextRequest) {
  let sessionId: string | undefined;
  
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

    const { source_type, content, file_id, file_url, options, session_id } = parseResult.data;

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

    // Initialize progress tracking if enabled
    const trackProgress = options?.track_progress ?? false;
    sessionId = trackProgress ? (session_id || generateSessionId()) : undefined;
    
    if (sessionId) {
      // Determine file info for progress
      const fileName = file_id ? `file_${file_id}` : (file_url ? file_url.split("/").pop() : "text_input");
      const initialSnapshot = initProgress(
        sessionId,
        [{ name: fileName || "input", size: content?.length }],
        {
          organizationId: userData.organization_id,
          userId: user.id,
        }
      );
      setProgress(sessionId, initialSnapshot);
      
      // Start processing the file
      updateProgress(sessionId, (s) => startFile(s, 0, "Starting parse..."));
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
        
        // Check for cancellation
        if (shouldCancel(sessionId)) {
          updateProgress(sessionId, cancelSession);
          return NextResponse.json({
            success: false,
            error: "Processing cancelled",
            session_id: sessionId,
          });
        }
        
        // Update progress: parsing stage
        updateProgress(sessionId, (s) => updateFileStage(s, 0, "parsing", 30, "Parsing text..."));
        
        // Use AI parsing if enabled
        if (options?.use_ai) {
          try {
            updateProgress(sessionId, (s) => updateFileStage(s, 0, "ocr", 40, "Processing with AI..."));
            
            const provider = await getOrCreateProvider();
            const aiOptions: AIParseOptions = {
              extractMetadata: true,
              confidence: "balanced",
              defaultMaterialId: options?.default_material_id,
              defaultThicknessMm: options?.default_thickness_mm,
              // Use pasted text prompt for better header/column detection
              isPastedText: true,
            };
            const aiResult = await provider.parseText(content, aiOptions);
            
            updateProgress(sessionId, (s) => updateFileStage(s, 0, "validating", 90, "Validating results..."));
            
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
            updateProgress(sessionId, (s) => updateFileStage(s, 0, "parsing", 50, "Falling back to regex parser..."));
            
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
        
        // Check for cancellation
        if (shouldCancel(sessionId)) {
          updateProgress(sessionId, cancelSession);
          return NextResponse.json({
            success: false,
            error: "Processing cancelled",
            session_id: sessionId,
          });
        }
        
        updateProgress(sessionId, (s) => updateFileStage(s, 0, "uploading", 10, "Fetching file..."));
        
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
            updateProgress(sessionId, (s) => failFile(s, 0, "File not found"));
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
            updateProgress(sessionId, (s) => failFile(s, 0, "Failed to access file"));
            return NextResponse.json(
              { error: "Failed to access file" },
              { status: 500 }
            );
          }
          
          updateProgress(sessionId, (s) => updateFileStage(s, 0, "uploading", 20, "Downloading file..."));
          
          // Fetch the file content
          const fileResponse = await fetch(signedUrlData.signedUrl);
          if (!fileResponse.ok) {
            updateProgress(sessionId, (s) => failFile(s, 0, "Failed to download file"));
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
            updateProgress(sessionId, (s) => failFile(s, 0, "Failed to fetch file from URL"));
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
        
        updateProgress(sessionId, (s) => updateFileStage(s, 0, "detecting", 30, "Detecting file type..."));
        
        // Parse based on file type
        if (mimeType.includes("csv") || fileName.endsWith(".csv")) {
          updateProgress(sessionId, (s) => updateFileStage(s, 0, "parsing", 50, "Parsing CSV..."));
          
          const csvContent = fileBuffer.toString("utf-8");
          result = parseTextBatch(csvContent, {
            defaultMaterialId: options?.default_material_id,
            defaultThicknessMm: options?.default_thickness_mm,
            dimOrderHint: options?.dim_order,
            units: options?.units,
            sourceMethod: "file_upload",
          });
          
          updateProgress(sessionId, (s) => updateFileStage(s, 0, "validating", 90, "Validating..."));
        } else if (
          mimeType.includes("excel") || 
          mimeType.includes("spreadsheet") ||
          fileName.endsWith(".xlsx") ||
          fileName.endsWith(".xls")
        ) {
          updateProgress(sessionId, (s) => updateFileStage(s, 0, "parsing", 50, "Parsing Excel..."));
          
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
          
          updateProgress(sessionId, (s) => updateFileStage(s, 0, "validating", 90, "Validating..."));
        } else if (
          mimeType.includes("image") || 
          mimeType === "application/pdf" ||
          fileName.match(/\.(png|jpg|jpeg|gif|webp|pdf)$/i)
        ) {
          // OCR parsing requires AI provider
          if (options?.use_ai) {
            try {
              updateProgress(sessionId, (s) => updateFileStage(s, 0, "ocr", 40, "Processing with AI Vision..."));
              
              const provider = await getOrCreateProvider();
              const base64Data = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
              
              // Check for cancellation before expensive OCR
              if (shouldCancel(sessionId)) {
                updateProgress(sessionId, cancelSession);
                return NextResponse.json({
                  success: false,
                  error: "Processing cancelled",
                  session_id: sessionId,
                });
              }
              
              const aiOptions: AIParseOptions = {
                extractMetadata: true,
                confidence: "balanced",
                defaultMaterialId: options?.default_material_id,
                defaultThicknessMm: options?.default_thickness_mm,
              };
              
              updateProgress(sessionId, (s) => updateFileStage(s, 0, "ocr", 60, "Extracting text with AI..."));
              
              const ocrResult = await provider.parseImage(base64Data, aiOptions);
              
              updateProgress(sessionId, (s) => updateFileStage(s, 0, "parsing", 80, "Parsing extracted text..."));
              
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
              
              updateProgress(sessionId, (s) => updateFileStage(s, 0, "validating", 95, "Validating results..."));
            } catch (visionError) {
              logger.warn("AI Vision parsing failed", { error: visionError });
              updateProgress(sessionId, (s) => failFile(s, 0, "OCR parsing failed"));
              return NextResponse.json(
                { error: "OCR parsing failed. Please try with a clearer image or enable AI mode." },
                { status: 400 }
              );
            }
          } else {
            updateProgress(sessionId, (s) => failFile(s, 0, "AI mode required for image/PDF"));
            return NextResponse.json(
              { error: "Enable AI mode for image/PDF parsing" },
              { status: 400 }
            );
          }
        } else {
          updateProgress(sessionId, (s) => failFile(s, 0, `Unsupported file type: ${mimeType}`));
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

    // Apply smart material matching if enabled
    let matchingSummary = null;
    if (options?.smart_matching !== false && result.parts.length > 0) {
      try {
        updateProgress(sessionId, (s) => updateFileStage(s, 0, "validating", 95, "Matching materials..."));
        
        const matcherCtx = await initMaterialMatcher(userData.organization_id);
        
        // Apply matching to each part
        for (const partResult of result.parts) {
          const part = partResult.part;
          
          // Get raw material name from tags or material_id if it looks like a raw name
          const rawMaterial = part.tags?.[0] || 
            (part.material_id !== "default" && !part.material_id.match(/^[a-z0-9-]+$/i) 
              ? part.material_id 
              : undefined);
          
          // Match material
          const materialMatch = matchMaterial(rawMaterial, part.thickness_mm, matcherCtx);
          part.material_id = materialMatch.materialId;
          
          // Store match info in audit (ensure source_method is always present)
          const existingAudit = part.audit || { source_method: "paste_parser" as const };
          part.audit = {
            ...existingAudit,
            material_match: {
              matched_to: materialMatch.materialName,
              confidence: materialMatch.confidence,
              match_type: materialMatch.matchType,
              original_raw: rawMaterial,
            },
          };
          
          // Match edgebands if edging ops exist
          if (part.ops?.edging?.edges) {
            for (const [edge, config] of Object.entries(part.ops.edging.edges)) {
              if (config.apply && !config.edgeband_id) {
                // Get raw edgeband name if specified
                const rawEdgeband = (part.ops.edging as { raw_edgeband?: string })?.raw_edgeband;
                
                // Match edgeband based on material
                const ebMatch = matchEdgeband(rawEdgeband, materialMatch.materialName, matcherCtx);
                if (ebMatch) {
                  part.ops.edging.edges[edge] = {
                    ...config,
                    edgeband_id: ebMatch.edgebandId,
                  };
                  
                  // Store edgeband match info
                  if (!part.audit.edgeband_matches) {
                    part.audit.edgeband_matches = {};
                  }
                  part.audit.edgeband_matches[edge] = {
                    matched_to: ebMatch.edgebandName,
                    confidence: ebMatch.confidence,
                    match_type: ebMatch.matchType,
                  };
                }
              }
            }
          }
          
          // Boost overall confidence based on matching
          if (partResult.confidence) {
            partResult.confidence = Math.min(
              partResult.confidence + (materialMatch.confidence - 0.5) * 0.2,
              1.0
            );
          }
        }
        
        // Calculate matching summary
        const materialMatches = result.parts.filter(
          p => p.part.audit?.material_match?.match_type !== "default"
        ).length;
        const edgebandMatches = result.parts.filter(
          p => Object.keys(p.part.audit?.edgeband_matches || {}).length > 0
        ).length;
        
        matchingSummary = {
          materials_matched: materialMatches,
          edgebands_auto_matched: edgebandMatches,
          total_parts: result.parts.length,
        };
        
      } catch (matchError) {
        logger.warn("Smart material matching failed, continuing without it", { error: matchError });
      }
    }

    // Mark file as complete in progress tracking
    if (sessionId) {
      updateProgress(sessionId, (s) => completeFile(s, 0, result.totalParsed, {
        confidence: result.averageConfidence,
      }));
      updateProgress(sessionId, (s) => completeSession(s, `Parsed ${result.totalParsed} parts`));
    }

    // Create parse job record
    const { data: parseJob, error: jobError } = await supabase
      .from("parse_jobs")
      .insert({
        organization_id: userData.organization_id,
        user_id: user.id,
        source_kind: source_type,
        source_data: { content: content?.slice(0, 1000), file_id, options, session_id: sessionId },
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
      session_id: sessionId,
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
        ...(matchingSummary && { smart_matching: matchingSummary }),
      },
    });

  } catch (error) {
    logger.error("Parse API error:", error);
    
    // Update progress to error state
    if (sessionId) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      updateProgress(sessionId, (s) => failFile(s, 0, errorMessage));
    }
    
    return NextResponse.json(
      { error: "Internal server error", session_id: sessionId },
      { status: 500 }
    );
  }
}
