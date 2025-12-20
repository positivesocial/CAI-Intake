/**
 * CAI Intake - Material Detail API
 * 
 * GET /api/v1/materials/[id] - Get material details
 * PATCH /api/v1/materials/[id] - Update a material
 * DELETE /api/v1/materials/[id] - Delete a material
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// SCHEMAS
// =============================================================================

const UpdateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional().nullable(),
  thicknessMm: z.number().positive().optional(),
  coreType: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  colorCode: z.string().optional().nullable(),
  defaultSheet: z.object({
    size: z.object({
      L: z.number().positive(),
      W: z.number().positive(),
    }),
    grained: z.boolean().optional(),
  }).optional().nullable(),
  costPerSqm: z.number().positive().optional().nullable(),
  supplier: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/materials/[id]
 * Get material details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    // Fetch the material
    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Check access
    const hasAccess = 
      (dbUser?.organizationId && material.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ material });
  } catch (error) {
    console.error("Get material error:", error);
    return NextResponse.json(
      { error: "Failed to get material" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/materials/[id]
 * Update a material
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization and role
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true, 
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    // Check permission
    const canManageMaterials = 
      dbUser?.isSuperAdmin ||
      ["org_admin", "manager"].includes(dbUser?.role?.name || "");

    if (!canManageMaterials) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch the material
    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Check access
    const hasAccess = 
      (dbUser?.organizationId && material.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const data = UpdateMaterialSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.thicknessMm !== undefined) updateData.thicknessMm = data.thicknessMm;
    if (data.coreType !== undefined) updateData.coreType = data.coreType;
    if (data.finish !== undefined) updateData.finish = data.finish;
    if (data.colorCode !== undefined) updateData.colorCode = data.colorCode;
    if (data.defaultSheet !== undefined) updateData.defaultSheet = data.defaultSheet;
    if (data.costPerSqm !== undefined) updateData.costPerSqm = data.costPerSqm;
    if (data.supplier !== undefined) updateData.supplier = data.supplier;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // Update material
    const updatedMaterial = await prisma.material.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      material: updatedMaterial,
      message: "Material updated successfully",
    });
  } catch (error) {
    console.error("Update material error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update material" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/materials/[id]
 * Delete a material
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization and role
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true, 
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    // Check permission
    const canManageMaterials = 
      dbUser?.isSuperAdmin ||
      ["org_admin", "manager"].includes(dbUser?.role?.name || "");

    if (!canManageMaterials) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch the material
    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Check access
    const hasAccess = 
      (dbUser?.organizationId && material.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if material is in use
    const partsUsingMaterial = await prisma.cutPart.count({
      where: { materialId: material.materialId },
    });

    if (partsUsingMaterial > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete material that is in use",
          details: `${partsUsingMaterial} parts are using this material`,
        },
        { status: 409 }
      );
    }

    // Delete material
    await prisma.material.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Material deleted successfully",
      material: { id },
    });
  } catch (error) {
    console.error("Delete material error:", error);
    return NextResponse.json(
      { error: "Failed to delete material" },
      { status: 500 }
    );
  }
}

