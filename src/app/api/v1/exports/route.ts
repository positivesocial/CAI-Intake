/**
 * CAI Intake - Exports API
 * 
 * POST /api/v1/exports - Generate export file
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Export request schema
const ExportRequestSchema = z.object({
  cutlist_id: z.string().uuid(),
  format: z.enum(["json", "csv", "maxcut", "cutlistplus", "cai2d"]),
  options: z.object({
    include_metadata: z.boolean().optional(),
    include_audit: z.boolean().optional(),
    units: z.enum(["mm", "cm", "inch"]).optional(),
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

    // Get cutlist with parts
    const { data: cutlist, error: cutlistError } = await supabase
      .from("cutlists")
      .select(`
        *,
        parts (*)
      `)
      .eq("id", cutlist_id)
      .single();

    if (cutlistError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Generate export based on format
    let exportData: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case "json":
        exportData = generateJsonExport(cutlist, options);
        contentType = "application/json";
        filename = `${cutlist.name.replace(/\s+/g, "_")}.json`;
        break;

      case "csv":
        exportData = generateCsvExport(cutlist, options);
        contentType = "text/csv";
        filename = `${cutlist.name.replace(/\s+/g, "_")}.csv`;
        break;

      case "maxcut":
        exportData = generateMaxcutExport(cutlist, options);
        contentType = "text/plain";
        filename = `${cutlist.name.replace(/\s+/g, "_")}.mcp`;
        break;

      case "cutlistplus":
        exportData = generateCutlistPlusExport(cutlist, options);
        contentType = "text/csv";
        filename = `${cutlist.name.replace(/\s+/g, "_")}_clp.csv`;
        break;

      case "cai2d":
        exportData = generateCai2dExport(cutlist, options);
        contentType = "application/json";
        filename = `${cutlist.name.replace(/\s+/g, "_")}_cai2d.json`;
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

// ============================================================
// EXPORT GENERATORS
// ============================================================

interface CutlistData {
  id: string;
  doc_id: string;
  name: string;
  description?: string;
  job_ref?: string;
  client_ref?: string;
  status: string;
  capabilities: Record<string, boolean>;
  parts: Array<{
    part_id: string;
    label?: string;
    qty: number;
    length_mm: number;
    width_mm: number;
    thickness_mm: number;
    material_id: string;
    grain: string;
    allow_rotation: boolean;
    group_id?: string;
    ops?: Record<string, unknown>;
    notes?: Record<string, unknown>;
    audit?: Record<string, unknown>;
  }>;
  created_at: string;
  updated_at: string;
}

interface ExportOptions {
  include_metadata?: boolean;
  include_audit?: boolean;
  units?: "mm" | "cm" | "inch";
}

function generateJsonExport(cutlist: CutlistData, options?: ExportOptions): string {
  const parts = cutlist.parts.map(p => ({
    part_id: p.part_id,
    label: p.label,
    qty: p.qty,
    size: { L: p.length_mm, W: p.width_mm },
    thickness_mm: p.thickness_mm,
    material_id: p.material_id,
    grain: p.grain,
    allow_rotation: p.allow_rotation,
    group_id: p.group_id,
    ...(options?.include_metadata ? { ops: p.ops, notes: p.notes } : {}),
    ...(options?.include_audit ? { audit: p.audit } : {}),
  }));

  const doc = {
    schema_version: "cai-cutlist/v1",
    doc_id: cutlist.doc_id,
    name: cutlist.name,
    description: cutlist.description,
    job_ref: cutlist.job_ref,
    client_ref: cutlist.client_ref,
    capabilities: cutlist.capabilities,
    parts,
    exported_at: new Date().toISOString(),
  };

  return JSON.stringify(doc, null, 2);
}

function generateCsvExport(cutlist: CutlistData, options?: ExportOptions): string {
  const headers = [
    "Part ID",
    "Label",
    "Qty",
    "Length",
    "Width",
    "Thickness",
    "Material",
    "Grain",
    "Rotate",
    "Group",
  ];

  const rows = cutlist.parts.map(p => [
    p.part_id,
    p.label ?? "",
    p.qty.toString(),
    p.length_mm.toString(),
    p.width_mm.toString(),
    p.thickness_mm.toString(),
    p.material_id,
    p.grain,
    p.allow_rotation ? "Yes" : "No",
    p.group_id ?? "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

function generateMaxcutExport(cutlist: CutlistData, _options?: ExportOptions): string {
  // MaxCut format: Part Name, Length, Width, Qty, Material, Grain, Label
  const lines = cutlist.parts.map(p => {
    const grain = p.grain === "along_L" ? "GL" : p.grain === "along_W" ? "GW" : "";
    return `${p.label ?? p.part_id},${p.length_mm},${p.width_mm},${p.qty},${p.material_id},${grain}`;
  });

  return lines.join("\n");
}

function generateCutlistPlusExport(cutlist: CutlistData, _options?: ExportOptions): string {
  // CutList Plus format
  const headers = ["Name", "Length", "Width", "Qty", "Material", "Grain", "Notes"];
  
  const rows = cutlist.parts.map(p => [
    p.label ?? p.part_id,
    p.length_mm.toString(),
    p.width_mm.toString(),
    p.qty.toString(),
    p.material_id,
    p.grain === "along_L" ? "L" : p.grain === "along_W" ? "W" : "",
    "",
  ]);

  return [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");
}

function generateCai2dExport(cutlist: CutlistData, options?: ExportOptions): string {
  // CAI 2D optimizer format
  const doc = {
    version: "1.0",
    job: {
      id: cutlist.doc_id,
      name: cutlist.name,
      reference: cutlist.job_ref,
    },
    parts: cutlist.parts.map(p => ({
      id: p.part_id,
      name: p.label ?? p.part_id,
      length: p.length_mm,
      width: p.width_mm,
      thickness: p.thickness_mm,
      quantity: p.qty,
      material: p.material_id,
      grain: p.grain !== "none" ? p.grain : undefined,
      canRotate: p.allow_rotation,
      group: p.group_id,
      operations: options?.include_metadata ? p.ops : undefined,
    })),
    settings: {
      units: options?.units ?? "mm",
    },
  };

  return JSON.stringify(doc, null, 2);
}

