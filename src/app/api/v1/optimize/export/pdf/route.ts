/**
 * CAI Intake - Optimization PDF Export API
 * 
 * POST /api/v1/optimize/export/pdf - Export optimization results as PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CAI2DClient, type OptimizeResult, type CustomerInfo, type MachineSettings, type RunConfig, type RenderOptions } from "@/lib/optimizer/cai2d-client";
import type { CutPart, MaterialDef } from "@/lib/schema";

export async function POST(request: NextRequest) {
  try {
    // Authenticate (optional but recommended for user_id)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Parse request body
    const body = await request.json();
    const {
      cutlistId,
      parts,
      materials,
      jobName,
      customer,
      machineSettings,
      runConfig,
      renderOptions,
      result, // Existing optimization result (optional)
    } = body as {
      cutlistId?: string;
      parts: CutPart[];
      materials?: MaterialDef[];
      jobName?: string;
      customer?: CustomerInfo;
      machineSettings?: MachineSettings;
      runConfig?: RunConfig;
      renderOptions?: RenderOptions;
      result?: OptimizeResult;
    };
    
    if (!parts || parts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No parts provided" },
        { status: 400 }
      );
    }
    
    const client = new CAI2DClient();
    
    // Build materials map
    const materialMap = new Map<string, MaterialDef["default_sheet"]>();
    if (materials) {
      for (const mat of materials) {
        materialMap.set(mat.material_id, mat.default_sheet);
      }
    }
    
    // Build sheet inventory
    const sheetInventory = Array.from(
      new Set(parts.map(p => p.material_id))
    ).map((matId, idx) => {
      const sheet = materialMap.get(matId);
      return {
        sheet_id: `s${idx + 1}`,
        material_id: matId,
        size: sheet?.size ?? { L: 2440, W: 1220 },
        quantity: 999,
        grained: false,
      };
    });
    
    // Build job request
    const request_payload = {
      job: {
        job_id: cutlistId ?? `job_${Date.now()}`,
        job_name: jobName ?? "Cutlist Optimization",
        org_id: "cai-intake-default",
        user_id: user?.id ?? "anonymous",
        units: "mm" as const,
        customer,
        materials: (materials ?? []).map(mat => ({
          material_id: mat.material_id,
          name: mat.name,
          thickness: mat.thickness_mm,
          sheet_size: mat.default_sheet?.size ?? { L: 2440, W: 1220 },
        })),
        sheet_inventory: sheetInventory,
        parts: parts.map((part, idx) => ({
          part_id: part.part_id,
          label: part.label || `Part ${idx + 1}`,
          material_id: part.material_id,
          size: part.size,
          qty: part.qty,
          allow_rotation: part.allow_rotation ?? true,
          grained: false,
        })),
        machine: {
          type: machineSettings?.type ?? "panel_saw",
          profile_id: machineSettings?.profile_id ?? "default",
          kerf: machineSettings?.kerf ?? 4,
          trim_margin: machineSettings?.trim_margin ?? { L1: 10, L2: 10, W1: 10, W2: 10 },
          min_offcut_L: machineSettings?.min_offcut_L ?? 200,
          min_offcut_W: machineSettings?.min_offcut_W ?? 100,
          panel_saw: machineSettings?.panel_saw ?? { workflow: "auto", guillotine_mode: "strip_shelf" },
        },
        objective: {
          primary: "min_sheets" as const,
          secondary: ["min_waste_area"],
          weights: { sheets: 1000000, waste_area: 1 },
        },
      },
      run: runConfig ?? { mode: "guillotine", search: "beam", runs: 30 },
      render: renderOptions ?? { svg: true, showLabels: true },
    };
    
    // Try to get PDF from CAI 2D API
    const pdfBlob = await client.exportPDF(request_payload);
    
    if (pdfBlob) {
      // Return the PDF blob
      const arrayBuffer = await pdfBlob.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${jobName || "optimization"}-report.pdf"`,
        },
      });
    }
    
    // If CAI 2D PDF export failed, generate a simple fallback PDF
    // (In a real implementation, you'd use a PDF library here)
    return NextResponse.json(
      { ok: false, error: "PDF export not available. Please use the web interface." },
      { status: 501 }
    );
  } catch (error) {
    console.error("PDF Export API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PDF export failed" },
      { status: 500 }
    );
  }
}

