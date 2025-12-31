/**
 * CAI Intake - Text Parse API
 * 
 * POST /api/v1/parse-text
 * Parses text input using AI for cutlist extraction.
 * Handles the AI processing server-side where API keys are available.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { getOrCreateProvider } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import { logAIUsage } from "@/lib/ai/usage-tracker";

// Serverless function config
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Size limits
const MAX_TEXT_LENGTH = 500_000; // 500KB

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

    // Parse request body
    const body = await request.json();
    const { text, options = {} } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Validate text size
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long. Maximum length is ${MAX_TEXT_LENGTH} characters.` },
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

    const parseOptions = {
      extractMetadata: options.extractMetadata ?? true,
      confidence: options.confidence ?? "balanced" as const,
      defaultMaterialId: options.defaultMaterialId ?? "MAT-WHITE-18",
      defaultThicknessMm: options.defaultThicknessMm ?? 18,
    };

    const startTime = Date.now();
    const aiResult = await provider.parseText(text, parseOptions);
    const durationMs = Date.now() - startTime;

    // Get user's organization for usage logging
    const supabase = await createClient();
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Log AI usage (non-blocking)
    if (userData?.organization_id) {
      logAIUsage({
        organizationId: userData.organization_id,
        userId: user.id,
        provider: provider.name.toLowerCase().includes("anthropic") ? "anthropic" : "openai",
        model: provider.name.toLowerCase().includes("anthropic") ? "claude-3-5-sonnet-latest" : "gpt-4o",
        operation: "parse_text",
        inputTokens: Math.round(text.length / 4), // Rough estimate: ~4 chars per token
        outputTokens: Math.round((aiResult.parts?.length ?? 0) * 30),
        durationMs,
        success: aiResult.success !== false,
        metadata: {
          textLength: text.length,
          partsFound: aiResult.parts?.length ?? 0,
          confidence: aiResult.totalConfidence,
        },
      }).catch(err => logger.warn("Failed to log AI usage", { error: err }));
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
      processingTimeMs: durationMs,
      rawResponse: aiResult.rawResponse,
    });

  } catch (error) {
    logger.error("Text parse error", { error });
    
    return NextResponse.json(
      { 
        error: "Failed to process text. Please try again.",
        code: "PARSE_ERROR"
      },
      { status: 500 }
    );
  }
}



