/**
 * CAI Intake - Parse Progress API
 * 
 * GET /api/v1/parse/progress?sessionId=xxx
 * Poll for parsing progress updates.
 * 
 * POST /api/v1/parse/progress/cancel?sessionId=xxx
 * Request cancellation of a parsing session.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProgress, requestCancellation, hasSession } from "@/lib/progress/progress-store";
import type { OCRProgressClient } from "@/lib/progress/types";
import { z } from "zod";

// ============================================================
// VALIDATION
// ============================================================

const QuerySchema = z.object({
  sessionId: z.string().min(1).max(100),
});

// ============================================================
// GET - Poll for progress
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = QuerySchema.safeParse({
      sessionId: searchParams.get("sessionId"),
    });
    
    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid sessionId" },
        { status: 400 }
      );
    }

    const { sessionId } = queryResult.data;

    // Get progress
    const snapshot = getProgress(sessionId);
    
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 404 }
      );
    }

    // Check if user owns this session (optional - for security)
    // If organizationId/userId was stored, we could verify here

    // Convert to client format
    const clientProgress: OCRProgressClient = {
      ...snapshot,
      isProcessing: snapshot.status === 'processing',
    };

    return NextResponse.json({
      success: true,
      data: clientProgress,
    });

  } catch (error) {
    console.error("[Progress API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - Request cancellation
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId required" },
        { status: 400 }
      );
    }

    // Check if session exists
    if (!hasSession(sessionId)) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Request cancellation
    const cancelled = requestCancellation(sessionId);
    
    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: "Session cannot be cancelled (already complete or cancelled)" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cancellation requested",
    });

  } catch (error) {
    console.error("[Progress API] Cancel error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

