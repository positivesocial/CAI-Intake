/**
 * CAI Intake - Edgebands API
 * 
 * GET /api/v1/edgebands - List edgebands
 * POST /api/v1/edgebands - Create edgeband
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Create edgeband schema - matches actual DB columns
const CreateEdgebandSchema = z.object({
  edgeband_id: z.string().min(1, "Edgeband ID is required"),
  name: z.string().min(1, "Name is required"),
  thickness_mm: z.number().positive("Thickness must be positive"),
  width_mm: z.number().positive("Width must be positive").default(22),
  material: z.string().optional().default("PVC"),
  color_code: z.string().optional().default("#FFFFFF"),
  color_match_material_id: z.string().optional(),
  finish: z.string().optional(),
  // Waste factor as percentage (1 = 1%, default)
  waste_factor_pct: z.number().min(0).max(100).default(1),
  // Overhang on each end of the edgeband (adds 2x this to total length)
  overhang_mm: z.number().min(0).default(0),
  supplier: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
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
    const material = searchParams.get("material");

    // Build query
    let query = serviceClient
      .from("edgebands")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .order("name", { ascending: true });

    if (search) {
      const sanitizedSearch = sanitizeLikePattern(search.slice(0, SIZE_LIMITS.SEARCH_QUERY));
      query = query.or(`name.ilike.%${sanitizedSearch}%,edgeband_id.ilike.%${sanitizedSearch}%`);
    }
    if (thickness) {
      query = query.eq("thickness_mm", parseFloat(thickness));
    }
    if (material) {
      query = query.eq("material", material);
    }

    const { data: edgebands, error } = await query;

    if (error) {
      logger.error("Failed to fetch edgebands", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to fetch edgebands" },
        { status: 500 }
      );
    }

    // Transform to canonical format - only include actual DB columns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedEdgebands = edgebands?.map((e: any) => ({
      id: e.id,
      edgeband_id: e.edgeband_id,
      name: e.name,
      thickness_mm: e.thickness_mm,
      width_mm: e.width_mm ?? 22,
      material: e.material ?? "PVC",
      color_code: e.color_code ?? "#FFFFFF",
      color_match_material_id: e.color_match_material_id,
      finish: e.finish,
      waste_factor_pct: e.waste_factor_pct ?? 1,
      overhang_mm: e.overhang_mm ?? 0,
      supplier: e.supplier,
      meta: e.meta,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })) ?? [];

    return NextResponse.json({
      edgebands: transformedEdgebands,
      count: transformedEdgebands.length,
    });

  } catch (error) {
    logger.error("Edgebands GET error", error);
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
    const parseResult = CreateEdgebandSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Create edgeband - only include actual DB columns
    const now = new Date().toISOString();
    const { data: edgeband, error } = await serviceClient
      .from("edgebands")
      .insert({
        id: crypto.randomUUID(),
        organization_id: userData.organization_id,
        edgeband_id: data.edgeband_id,
        name: data.name,
        thickness_mm: data.thickness_mm,
        width_mm: data.width_mm,
        material: data.material,
        color_code: data.color_code,
        color_match_material_id: data.color_match_material_id,
        finish: data.finish,
        waste_factor_pct: data.waste_factor_pct,
        overhang_mm: data.overhang_mm,
        supplier: data.supplier,
        meta: data.meta,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Edgeband ID already exists" },
          { status: 409 }
        );
      }
      logger.error("Failed to create edgeband", error, { userId: user.id });
      return NextResponse.json(
        { error: "Failed to create edgeband" },
        { status: 500 }
      );
    }
    
    // Log audit event
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: AUDIT_ACTIONS.MATERIAL_CREATED,
      entityType: "edgeband",
      entityId: edgeband.id,
      metadata: { edgebandId: edgeband.edgeband_id, name: edgeband.name },
    });

    return NextResponse.json({
      success: true,
      edgeband: {
        id: edgeband.id,
        edgeband_id: edgeband.edgeband_id,
        name: edgeband.name,
        thickness_mm: edgeband.thickness_mm,
        width_mm: edgeband.width_mm ?? 22,
        material: edgeband.material ?? "PVC",
        color_code: edgeband.color_code ?? "#FFFFFF",
        color_match_material_id: edgeband.color_match_material_id,
        finish: edgeband.finish,
        waste_factor_pct: edgeband.waste_factor_pct ?? 1,
        overhang_mm: edgeband.overhang_mm ?? 0,
        supplier: edgeband.supplier,
        meta: edgeband.meta,
        created_at: edgeband.created_at,
      },
    }, { status: 201 });

  } catch (error) {
    logger.error("Edgebands POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
