/**
 * CAI Intake - Materials API
 * 
 * GET /api/v1/materials - List materials
 * POST /api/v1/materials - Create material
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Create material schema - matches actual DB columns
const CreateMaterialSchema = z.object({
  material_id: z.string().min(1),
  name: z.string().min(1),
  thickness_mm: z.number().positive(),
  core_type: z.string().optional(),
  grain: z.enum(["none", "length", "width"]).optional().default("none"),
  finish: z.string().optional(),
  color_code: z.string().optional(),
  default_sheet: z.object({
    L: z.number().positive(),
    W: z.number().positive(),
  }).optional(),
  sku: z.string().optional(),
  supplier: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  // Legacy field name - map to meta
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS
    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id && !userData?.is_super_admin) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const thickness = searchParams.get("thickness");

    // Build query
    let query = serviceClient
      .from("materials")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .order("name", { ascending: true });

    if (search) {
      // Sanitize search input to prevent SQL injection via LIKE patterns
      const sanitizedSearch = sanitizeLikePattern(search.slice(0, SIZE_LIMITS.SEARCH_QUERY));
      query = query.or(`name.ilike.%${sanitizedSearch}%,material_id.ilike.%${sanitizedSearch}%`);
    }
    if (thickness) {
      query = query.eq("thickness_mm", parseFloat(thickness));
    }

    const { data: materials, error } = await query;

    if (error) {
      logger.error("Failed to fetch materials", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch materials" },
        { status: 500 }
      );
    }

    // Transform to canonical format - include all DB columns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedMaterials = materials?.map((m: any) => ({
      id: m.id,
      material_id: m.material_id,
      name: m.name,
      thickness_mm: m.thickness_mm,
      core_type: m.core_type,
      grain: m.grain ?? "none",
      finish: m.finish,
      color_code: m.color_code,
      default_sheet: m.default_sheet || undefined,
      sku: m.sku,
      supplier: m.supplier,
      meta: m.meta,
      created_at: m.created_at,
      updated_at: m.updated_at,
    })) ?? [];

    return NextResponse.json({
      materials: transformedMaterials,
      count: transformedMaterials.length,
    });

  } catch (error) {
    logger.error("Materials GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS
    const serviceClient = getServiceClient();

    // Get user's organization and role (join roles table)
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id && !userData?.is_super_admin) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Get role name from joined data
    const roleName = userData.is_super_admin ? "super_admin" : 
      (userData.roles as { name: string } | null)?.name || "viewer";

    // Check permission
    if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parseResult = CreateMaterialSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Create material - include all DB columns
    const { data: material, error } = await serviceClient
      .from("materials")
      .insert({
        organization_id: userData.organization_id,
        material_id: data.material_id,
        name: data.name,
        thickness_mm: data.thickness_mm,
        core_type: data.core_type,
        grain: data.grain || "none",
        finish: data.finish,
        color_code: data.color_code,
        default_sheet: data.default_sheet ? { L: data.default_sheet.L, W: data.default_sheet.W } : null,
        sku: data.sku,
        supplier: data.supplier,
        meta: data.meta || data.metadata || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Material ID already exists" },
          { status: 409 }
        );
      }
      logger.error("Failed to create material", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to create material" },
        { status: 500 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_CREATED,
      entityType: "material",
      entityId: material.id,
      metadata: { materialId: material.material_id, name: material.name },
    });

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        material_id: material.material_id,
        name: material.name,
        thickness_mm: material.thickness_mm,
        core_type: material.core_type,
        grain: material.grain ?? "none",
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet || undefined,
        sku: material.sku,
        supplier: material.supplier,
        meta: material.meta,
        created_at: material.created_at,
      },
    }, { status: 201 });

  } catch (error) {
    logger.error("Materials POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
