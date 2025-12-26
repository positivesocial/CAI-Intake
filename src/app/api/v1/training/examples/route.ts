/**
 * CAI Intake - Training Examples API
 * 
 * POST /api/v1/training/examples - Create a new training example
 * GET /api/v1/training/examples - List training examples with filters
 * 
 * NOTE: These endpoints are SUPER ADMIN ONLY - training affects the entire platform.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { CutPart } from "@/lib/schema";

// ============================================================
// CREATE TRAINING EXAMPLE (Super Admin Only)
// ============================================================

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

    const body = await request.json();
    const {
      sourceType,
      sourceText,
      sourceFileName,
      correctParts,
      correctMetadata,
      category,
      difficulty,
      clientName,
    } = body;

    // Validate required fields
    if (!sourceType || !sourceText || !correctParts) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: sourceType, sourceText, correctParts" },
        { status: 400 }
      );
    }

    if (!Array.isArray(correctParts) || correctParts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "correctParts must be a non-empty array" },
        { status: 400 }
      );
    }

    // Analyze text features for similarity matching
    const features = analyzeTextFeatures(sourceText);
    
    // Generate hash for deduplication
    const sourceHash = await hashText(sourceText);

    // Check for duplicate
    const existing = await prisma.trainingExample.findFirst({
      where: { sourceFileHash: sourceHash },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "A training example with identical content already exists", existingId: existing.id },
        { status: 409 }
      );
    }

    // Create training example
    const example = await prisma.trainingExample.create({
      data: {
        organizationId: dbUser?.organizationId,
        sourceType,
        sourceText,
        sourceFileName,
        sourceFileHash: sourceHash,
        correctParts: correctParts as unknown[],
        correctMetadata,
        category,
        difficulty: difficulty || "medium",
        clientName,
        hasHeaders: features.hasHeaders,
        columnCount: features.estimatedColumns,
        rowCount: features.estimatedRows,
        hasEdgeNotation: features.hasEdgePatterns,
        hasGrooveNotation: features.hasGroovePatterns,
        createdById: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      example: {
        id: example.id,
        sourceType: example.sourceType,
        sourceFileName: example.sourceFileName,
        partsCount: (example.correctParts as CutPart[]).length,
        category: example.category,
        difficulty: example.difficulty,
        clientName: example.clientName,
        createdAt: example.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to create training example:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create training example" },
      { status: 500 }
    );
  }
}

// ============================================================
// LIST TRAINING EXAMPLES (Super Admin Only)
// ============================================================

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const category = searchParams.get("category");
    const clientName = searchParams.get("clientName");
    const difficulty = searchParams.get("difficulty");
    const includeGlobal = searchParams.get("includeGlobal") !== "false";

    // Build where clause
    const where: Record<string, unknown> = { isActive: true };

    // Organization filtering
    if (dbUser?.organizationId) {
      if (includeGlobal) {
        where.OR = [
          { organizationId: dbUser.organizationId },
          { organizationId: null },
        ];
      } else {
        where.organizationId = dbUser.organizationId;
      }
    } else if (!dbUser?.isSuperAdmin) {
      // Non-org users only see global examples
      where.organizationId = null;
    }

    if (category) where.category = category;
    if (clientName) where.clientName = { contains: clientName, mode: "insensitive" };
    if (difficulty) where.difficulty = difficulty;

    // Fetch examples
    const [examples, total] = await Promise.all([
      prisma.trainingExample.findMany({
        where,
        orderBy: [
          { successCount: "desc" },
          { createdAt: "desc" },
        ],
        skip: offset,
        take: limit,
        select: {
          id: true,
          sourceType: true,
          sourceFileName: true,
          sourceText: true,
          correctParts: true,
          correctMetadata: true,
          category: true,
          difficulty: true,
          clientName: true,
          hasHeaders: true,
          columnCount: true,
          rowCount: true,
          hasEdgeNotation: true,
          hasGrooveNotation: true,
          usageCount: true,
          successCount: true,
          lastUsedAt: true,
          createdAt: true,
          organizationId: true,
        },
      }),
      prisma.trainingExample.count({ where }),
    ]);

    // Format response
    const formatted = examples.map(ex => ({
      id: ex.id,
      sourceType: ex.sourceType,
      sourceFileName: ex.sourceFileName,
      sourceTextPreview: ex.sourceText.substring(0, 500),
      partsCount: (ex.correctParts as CutPart[]).length,
      correctMetadata: ex.correctMetadata,
      category: ex.category,
      difficulty: ex.difficulty,
      clientName: ex.clientName,
      features: {
        hasHeaders: ex.hasHeaders,
        columnCount: ex.columnCount,
        rowCount: ex.rowCount,
        hasEdgeNotation: ex.hasEdgeNotation,
        hasGrooveNotation: ex.hasGrooveNotation,
      },
      stats: {
        usageCount: ex.usageCount,
        successCount: ex.successCount,
        successRate: ex.usageCount > 0 ? ex.successCount / ex.usageCount : null,
        lastUsedAt: ex.lastUsedAt,
      },
      isGlobal: ex.organizationId === null,
      createdAt: ex.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      examples: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + examples.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to list training examples:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to list training examples" },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

interface TextFeatures {
  hasHeaders: boolean;
  estimatedColumns: number;
  estimatedRows: number;
  hasEdgePatterns: boolean;
  hasGroovePatterns: boolean;
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
    hasEdgePatterns: edgePatterns.test(text),
    hasGroovePatterns: groovePatterns.test(text),
  };
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

