/**
 * CAI Intake - Training Example by ID API
 * 
 * GET /api/v1/training/examples/[id] - Get a specific training example
 * PATCH /api/v1/training/examples/[id] - Update a training example
 * DELETE /api/v1/training/examples/[id] - Delete (soft) a training example
 * 
 * NOTE: Super admin only - training affects the entire platform.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { CutPart } from "@/lib/schema";

// Helper to verify super admin access
async function verifySuperAdmin(email: string): Promise<{ isSuperAdmin: boolean; error?: NextResponse }> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true },
  });
  
  if (!dbUser?.isSuperAdmin) {
    return {
      isSuperAdmin: false,
      error: NextResponse.json(
        { ok: false, error: "Forbidden - Super admin access required" },
        { status: 403 }
      ),
    };
  }
  
  return { isSuperAdmin: true };
}

// ============================================================
// GET SINGLE EXAMPLE (Super Admin Only)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Super admin only
    const { isSuperAdmin, error } = await verifySuperAdmin(user.email!);
    if (!isSuperAdmin) return error!;

    const example = await prisma.trainingExample.findUnique({
      where: { id },
    });

    if (!example || !example.isActive) {
      return NextResponse.json({ ok: false, error: "Training example not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      example: {
        id: example.id,
        sourceType: example.sourceType,
        sourceText: example.sourceText,
        sourceFileName: example.sourceFileName,
        correctParts: example.correctParts,
        correctMetadata: example.correctMetadata,
        category: example.category,
        difficulty: example.difficulty,
        clientName: example.clientName,
        features: {
          hasHeaders: example.hasHeaders,
          columnCount: example.columnCount,
          rowCount: example.rowCount,
          hasEdgeNotation: example.hasEdgeNotation,
          hasGrooveNotation: example.hasGrooveNotation,
        },
        stats: {
          usageCount: example.usageCount,
          successCount: example.successCount,
          successRate: example.usageCount > 0 ? example.successCount / example.usageCount : null,
          lastUsedAt: example.lastUsedAt,
        },
        isGlobal: example.organizationId === null,
        createdAt: example.createdAt,
        updatedAt: example.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to get training example:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to get training example" },
      { status: 500 }
    );
  }
}

// ============================================================
// UPDATE EXAMPLE (Super Admin Only)
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Super admin only
    const { isSuperAdmin, error } = await verifySuperAdmin(user.email!);
    if (!isSuperAdmin) return error!;

    // Verify example exists
    const existing = await prisma.trainingExample.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing || !existing.isActive) {
      return NextResponse.json({ ok: false, error: "Training example not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      correctParts,
      correctMetadata,
      category,
      difficulty,
      clientName,
    } = body;

    const updateData: Record<string, unknown> = {};
    
    if (correctParts !== undefined) {
      if (!Array.isArray(correctParts) || correctParts.length === 0) {
        return NextResponse.json(
          { ok: false, error: "correctParts must be a non-empty array" },
          { status: 400 }
        );
      }
      updateData.correctParts = correctParts;
    }
    
    if (correctMetadata !== undefined) updateData.correctMetadata = correctMetadata;
    if (category !== undefined) updateData.category = category;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (clientName !== undefined) updateData.clientName = clientName;

    const updated = await prisma.trainingExample.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      example: {
        id: updated.id,
        sourceType: updated.sourceType,
        sourceFileName: updated.sourceFileName,
        partsCount: (updated.correctParts as CutPart[]).length,
        category: updated.category,
        difficulty: updated.difficulty,
        clientName: updated.clientName,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to update training example:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update training example" },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE EXAMPLE (Super Admin Only - soft delete)
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Super admin only
    const { isSuperAdmin, error } = await verifySuperAdmin(user.email!);
    if (!isSuperAdmin) return error!;

    // Verify example exists
    const existing = await prisma.trainingExample.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing || !existing.isActive) {
      return NextResponse.json({ ok: false, error: "Training example not found" }, { status: 404 });
    }

    // Soft delete
    await prisma.trainingExample.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete training example:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete training example" },
      { status: 500 }
    );
  }
}

