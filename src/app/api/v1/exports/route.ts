/**
 * CAI Intake - Exports API
 * 
 * POST /api/v1/exports - Generate export file
 * 
 * Supports all major panel optimization software formats:
 * - JSON (CAI canonical)
 * - CSV (Generic/customizable)
 * - CutList Plus (CSV)
 * - MaxCut (CSV)
 * - CutRite (.xml)
 * - Optimik (CSV)
 * - CAI 2D
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  generateJsonExport,
  generateCsvExport,
  generateMaxcutExport,
  generateCutlistPlusExport,
  generateCai2dExport,
  generateCutRiteExport,
  generateOptimikExport,
  generateOptimikStockExport,
  EXPORT_FORMATS,
  type ExportableCutlist,
  type ExportablePart,
} from "@/lib/exports";

// Export request schema
const ExportRequestSchema = z.object({
  cutlist_id: z.string(),
  format: z.enum(["json", "csv", "maxcut", "cutlistplus", "cai2d", "cutrite", "optimik", "optimik_stock"]),
  options: z.object({
    include_metadata: z.boolean().optional(),
    include_audit: z.boolean().optional(),
    include_edging: z.boolean().optional(),
    include_grain: z.boolean().optional(),
    include_notes: z.boolean().optional(),
    units: z.enum(["mm", "cm", "inch"]).optional(),
    delimiter: z.enum([",", ";", "\t"]).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = ExportRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { cutlist_id, format, options } = parseResult.data;

    // Get cutlist with parts and related data
    const { data: cutlistData, error: cutlistError } = await supabase
      .from("cutlists")
      .select(`
        *,
        parts:cut_parts (*)
      `)
      .eq("id", cutlist_id)
      .single();

    if (cutlistError || !cutlistData) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Get organization materials and edgebands for the export
    const { data: dbUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    let materials: ExportableCutlist["materials"] = [];
    let edgebands: ExportableCutlist["edgebands"] = [];

    if (dbUser?.organization_id) {
      // Fetch materials
      const { data: materialsData } = await supabase
        .from("materials")
        .select("id, code, name, thickness_mm")
        .eq("organization_id", dbUser.organization_id);
      
      if (materialsData) {
        materials = materialsData.map(m => ({
          material_id: m.code || m.id,
          name: m.name,
          thickness_mm: m.thickness_mm || 18,
        }));
      }

      // Fetch edgebands
      const { data: edgebandsData } = await supabase
        .from("edgebands")
        .select("id, code, name, thickness_mm, width_mm")
        .eq("organization_id", dbUser.organization_id);
      
      if (edgebandsData) {
        edgebands = edgebandsData.map(e => ({
          edgeband_id: e.code || e.id,
          name: e.name,
          thickness_mm: e.thickness_mm || 0.5,
          width_mm: e.width_mm || 22,
        }));
      }
    }

    // Transform database cutlist to exportable format
    const cutlist: ExportableCutlist = {
      doc_id: cutlistData.doc_id || cutlistData.id,
      name: cutlistData.name,
      description: cutlistData.description,
      job_ref: cutlistData.job_ref,
      client_ref: cutlistData.client_ref,
      capabilities: cutlistData.capabilities || {},
      created_at: cutlistData.created_at,
      updated_at: cutlistData.updated_at,
      materials,
      edgebands,
      parts: (cutlistData.parts || []).map((p: Record<string, unknown>): ExportablePart => ({
        part_id: p.part_id as string || p.id as string,
        label: p.label as string | undefined,
        qty: (p.qty as number) || 1,
        size: {
          L: (p.size_l as number) || (p.length_mm as number) || 0,
          W: (p.size_w as number) || (p.width_mm as number) || 0,
        },
        thickness_mm: (p.thickness_mm as number) || 18,
        material_id: (p.material_id as string) || "default",
        allow_rotation: (p.allow_rotation as boolean) ?? true,
        group_id: p.group_id as string | undefined,
        ops: p.ops as Record<string, unknown> | undefined,
        notes: p.notes as Record<string, string> | undefined,
        audit: p.audit as Record<string, unknown> | undefined,
      })),
    };

    // Generate export based on format
    let exportData: string;
    let contentType: string;
    let filename: string;
    const safeName = cutlist.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    const exportOptions = {
      units: options?.units || "mm",
      includeEdging: options?.include_edging ?? true,
      includeGrain: options?.include_grain ?? true,
      includeNotes: options?.include_notes ?? true,
      includeOps: options?.include_metadata ?? true,
      includeAudit: options?.include_audit ?? false,
      delimiter: options?.delimiter || ",",
    };

    switch (format) {
      case "json":
        exportData = generateJsonExport(cutlist, {
          includeLibraries: true,
          includeOps: exportOptions.includeOps,
          includeAudit: exportOptions.includeAudit,
          prettyPrint: true,
        });
        contentType = EXPORT_FORMATS.json.mimeType;
        filename = `${safeName}.json`;
        break;

      case "csv":
        exportData = generateCsvExport(cutlist, {
          units: exportOptions.units,
          includeEdging: exportOptions.includeEdging,
          includeNotes: exportOptions.includeNotes,
          delimiter: exportOptions.delimiter as "," | ";" | "\t",
        });
        contentType = EXPORT_FORMATS.csv.mimeType;
        filename = `${safeName}.csv`;
        break;

      case "maxcut":
        exportData = generateMaxcutExport(cutlist, {
          units: exportOptions.units,
          includeHoles: true,
          includeGrooving: true,
        });
        contentType = EXPORT_FORMATS.maxcut.mimeType;
        filename = `${safeName}_maxcut.csv`;
        break;

      case "cutlistplus":
        exportData = generateCutlistPlusExport(cutlist, {
          units: exportOptions.units,
          includeGrain: exportOptions.includeGrain,
          includeNotes: exportOptions.includeNotes,
          includeEdgebanding: exportOptions.includeEdging,
        });
        contentType = EXPORT_FORMATS.cutlistplus.mimeType;
        filename = `${safeName}_cutlistplus.csv`;
        break;

      case "cutrite":
        exportData = generateCutRiteExport(cutlist, {
          units: exportOptions.units,
          includeGrain: exportOptions.includeGrain,
          includeEdging: exportOptions.includeEdging,
        });
        contentType = EXPORT_FORMATS.cutrite.mimeType;
        filename = `${safeName}_cutrite.xml`;
        break;

      case "optimik":
        exportData = generateOptimikExport(cutlist, {
          units: exportOptions.units,
          includeGrain: exportOptions.includeGrain,
          includeEdging: exportOptions.includeEdging,
          delimiter: ";", // Optimik typically uses semicolon
        });
        contentType = EXPORT_FORMATS.optimik.mimeType;
        filename = `${safeName}_optimik.csv`;
        break;

      case "optimik_stock":
        exportData = generateOptimikStockExport(cutlist, {
          units: exportOptions.units,
          delimiter: ";",
        });
        contentType = EXPORT_FORMATS.optimik.mimeType;
        filename = `${safeName}_optimik_stock.csv`;
        break;

      case "cai2d":
        exportData = generateCai2dExport(cutlist, {
          units: exportOptions.units,
          includeOps: exportOptions.includeOps,
          includeEdging: exportOptions.includeEdging,
        });
        contentType = EXPORT_FORMATS.cai2d.mimeType;
        filename = `${safeName}_cai2d.json`;
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported export format" },
          { status: 400 }
        );
    }

    // Return the export data
    return new NextResponse(exportData, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Format": format,
        "X-Parts-Count": cutlist.parts.length.toString(),
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/exports/formats
 * Returns available export formats and their metadata
 */
export async function GET() {
  return NextResponse.json({
    formats: EXPORT_FORMATS,
  });
}
