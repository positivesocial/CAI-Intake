/**
 * CAI Intake - Parse API
 * 
 * POST /api/v1/parse
 * Parses text, files, or voice input into CutPart objects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTextBatch } from "@/lib/parsers/text-parser";
import { z } from "zod";

// Request validation schema
const ParseRequestSchema = z.object({
  source_type: z.enum(["text", "file", "voice"]),
  content: z.string().optional(),
  file_id: z.string().optional(),
  options: z.object({
    default_material_id: z.string().optional(),
    default_thickness_mm: z.number().optional(),
    dim_order: z.enum(["LxW", "WxL", "infer"]).optional(),
    units: z.enum(["mm", "cm", "inch"]).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
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

    const { source_type, content, file_id, options } = parseResult.data;

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
        
        result = parseTextBatch(content, {
          defaultMaterialId: options?.default_material_id,
          defaultThicknessMm: options?.default_thickness_mm,
          dimOrderHint: options?.dim_order,
          units: options?.units,
          sourceMethod: "paste_parser",
        });
        break;

      case "file":
        if (!file_id) {
          return NextResponse.json(
            { error: "file_id required for file parsing" },
            { status: 400 }
          );
        }
        // TODO: Implement file parsing
        return NextResponse.json(
          { error: "File parsing not yet implemented" },
          { status: 501 }
        );

      case "voice":
        if (!content) {
          return NextResponse.json(
            { error: "Content required for voice parsing" },
            { status: 400 }
          );
        }
        
        // Voice parsing uses the same text parser but with different source method
        result = parseTextBatch(content, {
          defaultMaterialId: options?.default_material_id,
          defaultThicknessMm: options?.default_thickness_mm,
          dimOrderHint: options?.dim_order,
          units: options?.units,
          sourceMethod: "voice",
        });
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
        source_type,
        source_data: { content, file_id, options },
        status: "completed",
        result: {
          parts: result.parts.map(p => p.part),
          stats: {
            total_parsed: result.totalParsed,
            total_errors: result.totalErrors,
            average_confidence: result.averageConfidence,
          },
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create parse job:", jobError);
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
    console.error("Parse API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

