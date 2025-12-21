/**
 * CAI Intake - Materials API
 * 
 * GET /api/v1/materials - List materials
 * POST /api/v1/materials - Create material
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Demo mode mock materials
const DEMO_MATERIALS = [
  {
    id: "demo-mat-1",
    material_id: "MAT-WHITE-18",
    name: "18mm White Melamine PB",
    thickness_mm: 18,
    core_type: "particleboard",
    grain: "none",
    finish: "melamine",
    color_code: "#FFFFFF",
    default_sheet: { L: 2440, W: 1220 },
    supplier: "Demo Supplier",
    sku: "WM-18-2440",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-mat-2",
    material_id: "MAT-WHITE-16",
    name: "16mm White Melamine PB",
    thickness_mm: 16,
    core_type: "particleboard",
    grain: "none",
    finish: "melamine",
    color_code: "#FFFFFF",
    default_sheet: { L: 2440, W: 1220 },
    supplier: "Demo Supplier",
    sku: "WM-16-2440",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-mat-3",
    material_id: "MAT-OAK-18",
    name: "18mm Natural Oak Veneer",
    thickness_mm: 18,
    core_type: "mdf",
    grain: "length",
    finish: "veneer",
    color_code: "#DEB887",
    default_sheet: { L: 2440, W: 1220 },
    supplier: "Demo Supplier",
    sku: "OV-18-2440",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-mat-4",
    material_id: "MAT-BLACK-18",
    name: "18mm Black Melamine PB",
    thickness_mm: 18,
    core_type: "particleboard",
    grain: "none",
    finish: "melamine",
    color_code: "#1A1A1A",
    default_sheet: { L: 2440, W: 1220 },
    supplier: "Demo Supplier",
    sku: "BM-18-2440",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Create material schema
const CreateMaterialSchema = z.object({
  material_id: z.string().min(1),
  name: z.string().min(1),
  thickness_mm: z.number().positive(),
  core_type: z.string().optional(),
  grain: z.enum(["none", "length", "width"]).optional(),
  finish: z.string().optional(),
  color_code: z.string().optional(),
  default_sheet: z.object({
    L: z.number().positive(),
    W: z.number().positive(),
  }).optional(),
  supplier: z.string().optional(),
  sku: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Check for demo mode
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    
    if (isDemoMode) {
      // Return demo materials
      const searchParams = request.nextUrl.searchParams;
      const search = searchParams.get("search")?.toLowerCase();
      const thickness = searchParams.get("thickness");
      
      let filteredMaterials = [...DEMO_MATERIALS];
      
      if (search) {
        filteredMaterials = filteredMaterials.filter(m => 
          m.name.toLowerCase().includes(search) || 
          m.material_id.toLowerCase().includes(search)
        );
      }
      if (thickness) {
        filteredMaterials = filteredMaterials.filter(m => 
          m.thickness_mm === parseFloat(thickness)
        );
      }
      
      return NextResponse.json({
        materials: filteredMaterials,
        count: filteredMaterials.length,
      });
    }

    // Production mode - use Supabase
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

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

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const thickness = searchParams.get("thickness");

    // Build query
    let query = supabase
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

    // Transform to canonical format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedMaterials = materials?.map((m: any) => ({
      id: m.id,
      material_id: m.material_id,
      name: m.name,
      thickness_mm: m.thickness_mm,
      core_type: m.core_type,
      grain: m.grain,
      finish: m.finish,
      color_code: m.color_code,
      default_sheet: m.default_sheet_l && m.default_sheet_w ? {
        L: m.default_sheet_l,
        W: m.default_sheet_w,
      } : undefined,
      supplier: m.supplier,
      sku: m.sku,
      metadata: m.metadata,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Check permission
    if (!["super_admin", "org_admin", "manager"].includes(userData.role)) {
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

    // Create material
    const { data: material, error } = await supabase
      .from("materials")
      .insert({
        organization_id: userData.organization_id,
        material_id: data.material_id,
        name: data.name,
        thickness_mm: data.thickness_mm,
        core_type: data.core_type,
        grain: data.grain,
        finish: data.finish,
        color_code: data.color_code,
        default_sheet_l: data.default_sheet?.L,
        default_sheet_w: data.default_sheet?.W,
        supplier: data.supplier,
        sku: data.sku,
        metadata: data.metadata,
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
        grain: material.grain,
        finish: material.finish,
        color_code: material.color_code,
        default_sheet: material.default_sheet_l && material.default_sheet_w ? {
          L: material.default_sheet_l,
          W: material.default_sheet_w,
        } : undefined,
        supplier: material.supplier,
        sku: material.sku,
        metadata: material.metadata,
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
