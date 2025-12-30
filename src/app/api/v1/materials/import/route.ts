/**
 * CAI Intake - Materials Import API
 * 
 * POST /api/v1/materials/import - Bulk import materials
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";

// Schema for imported materials
const ImportMaterialSchema = z.object({
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
  }).optional().nullable(),
  sku: z.string().optional(),
  supplier: z.string().optional(),
});

const ImportEdgebandSchema = z.object({
  edgeband_id: z.string().min(1),
  name: z.string().min(1),
  thickness_mm: z.number().positive(),
  width_mm: z.number().positive().default(22),
  material: z.string().optional().default("PVC"),
  color_code: z.string().optional().default("#FFFFFF"),
  color_match_material_id: z.string().optional(),
  finish: z.string().optional(),
  waste_factor_pct: z.number().min(0).max(100).default(1),
  overhang_mm: z.number().min(0).default(0),
  supplier: z.string().optional(),
});

const ImportRequestSchema = z.object({
  type: z.enum(["materials", "edgebands"]),
  mode: z.enum(["add", "replace", "upsert"]).default("upsert"),
  data: z.array(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Get user's organization and role
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

    const roleName = userData.is_super_admin ? "super_admin" : 
      (userData.roles as { name: string } | null)?.name || "viewer";

    if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request
    const body = await request.json();
    const parseResult = ImportRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { type, mode, data } = parseResult.data;
    const orgId = userData.organization_id;

    // Validate and prepare data
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { index: number; id: string; error: string }[],
    };

    if (type === "materials") {
      // Validate materials
      const validMaterials: z.infer<typeof ImportMaterialSchema>[] = [];
      for (let i = 0; i < data.length; i++) {
        const result = ImportMaterialSchema.safeParse(data[i]);
        if (result.success) {
          validMaterials.push(result.data);
        } else {
          results.failed++;
          results.errors.push({
            index: i,
            id: (data[i] as { material_id?: string })?.material_id || `row-${i}`,
            error: result.error.issues.map(e => e.message).join(", "),
          });
        }
      }

      if (validMaterials.length === 0) {
        return NextResponse.json({
          success: false,
          message: "No valid materials to import",
          results,
        }, { status: 400 });
      }

      // If replace mode, delete existing materials first
      if (mode === "replace") {
        await serviceClient
          .from("materials")
          .delete()
          .eq("organization_id", orgId);
      }

      // Get existing material IDs for upsert logic
      const { data: existingMaterials } = await serviceClient
        .from("materials")
        .select("material_id")
        .eq("organization_id", orgId);
      
      const existingIds = new Set(existingMaterials?.map(m => m.material_id) || []);

      // Process materials
      for (const mat of validMaterials) {
        const exists = existingIds.has(mat.material_id);
        
        if (mode === "add" && exists) {
          results.skipped++;
          continue;
        }

        try {
          if (exists && mode === "upsert") {
            // Update existing
            await serviceClient
              .from("materials")
              .update({
                name: mat.name,
                thickness_mm: mat.thickness_mm,
                core_type: mat.core_type,
                grain: mat.grain || "none",
                finish: mat.finish,
                color_code: mat.color_code,
                default_sheet: mat.default_sheet,
                sku: mat.sku,
                supplier: mat.supplier,
              })
              .eq("organization_id", orgId)
              .eq("material_id", mat.material_id);
          } else {
            // Insert new
            await serviceClient
              .from("materials")
              .insert({
                id: crypto.randomUUID(),
                organization_id: orgId,
                material_id: mat.material_id,
                name: mat.name,
                thickness_mm: mat.thickness_mm,
                core_type: mat.core_type,
                grain: mat.grain || "none",
                finish: mat.finish,
                color_code: mat.color_code,
                default_sheet: mat.default_sheet,
                sku: mat.sku,
                supplier: mat.supplier,
              });
          }
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({
            index: validMaterials.indexOf(mat),
            id: mat.material_id,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    } else {
      // Edgebands import
      const validEdgebands: z.infer<typeof ImportEdgebandSchema>[] = [];
      for (let i = 0; i < data.length; i++) {
        const result = ImportEdgebandSchema.safeParse(data[i]);
        if (result.success) {
          validEdgebands.push(result.data);
        } else {
          results.failed++;
          results.errors.push({
            index: i,
            id: (data[i] as { edgeband_id?: string })?.edgeband_id || `row-${i}`,
            error: result.error.issues.map(e => e.message).join(", "),
          });
        }
      }

      if (validEdgebands.length === 0) {
        return NextResponse.json({
          success: false,
          message: "No valid edgebands to import",
          results,
        }, { status: 400 });
      }

      // If replace mode, delete existing
      if (mode === "replace") {
        await serviceClient
          .from("edgebands")
          .delete()
          .eq("organization_id", orgId);
      }

      // Get existing IDs
      const { data: existingEdgebands } = await serviceClient
        .from("edgebands")
        .select("edgeband_id")
        .eq("organization_id", orgId);
      
      const existingIds = new Set(existingEdgebands?.map(e => e.edgeband_id) || []);

      // Process edgebands
      for (const eb of validEdgebands) {
        const exists = existingIds.has(eb.edgeband_id);
        
        if (mode === "add" && exists) {
          results.skipped++;
          continue;
        }

        try {
          if (exists && mode === "upsert") {
            await serviceClient
              .from("edgebands")
              .update({
                name: eb.name,
                thickness_mm: eb.thickness_mm,
                width_mm: eb.width_mm,
                material: eb.material,
                color_code: eb.color_code,
                color_match_material_id: eb.color_match_material_id,
                finish: eb.finish,
                waste_factor_pct: eb.waste_factor_pct,
                overhang_mm: eb.overhang_mm,
                supplier: eb.supplier,
              })
              .eq("organization_id", orgId)
              .eq("edgeband_id", eb.edgeband_id);
          } else {
            await serviceClient
              .from("edgebands")
              .insert({
                id: crypto.randomUUID(),
                organization_id: orgId,
                edgeband_id: eb.edgeband_id,
                name: eb.name,
                thickness_mm: eb.thickness_mm,
                width_mm: eb.width_mm,
                material: eb.material,
                color_code: eb.color_code,
                color_match_material_id: eb.color_match_material_id,
                finish: eb.finish,
                waste_factor_pct: eb.waste_factor_pct,
                overhang_mm: eb.overhang_mm,
                supplier: eb.supplier,
              });
          }
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({
            index: validEdgebands.indexOf(eb),
            id: eb.edgeband_id,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    // Log audit
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: orgId,
      action: AUDIT_ACTIONS.MATERIAL_CREATED,
      entityType: type,
      entityId: "bulk-import",
      metadata: { 
        mode,
        success: results.success,
        failed: results.failed,
        skipped: results.skipped,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Import complete: ${results.success} added/updated, ${results.skipped} skipped, ${results.failed} failed`,
      results,
    });

  } catch (error) {
    logger.error("Materials import error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

