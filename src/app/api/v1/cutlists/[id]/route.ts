/**
 * CAI Intake - Single Cutlist API
 * 
 * GET /api/v1/cutlists/:id - Get cutlist details
 * PUT /api/v1/cutlists/:id - Update cutlist
 * DELETE /api/v1/cutlists/:id - Delete cutlist
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Update cutlist schema
const UpdateCutlistSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  job_ref: z.string().optional(),
  client_ref: z.string().optional(),
  status: z.enum(["draft", "pending", "processing", "completed", "archived"]).optional(),
  capabilities: z.object({
    core_parts: z.boolean().optional(),
    edging: z.boolean().optional(),
    grooves: z.boolean().optional(),
    cnc_holes: z.boolean().optional(),
    cnc_routing: z.boolean().optional(),
    custom_cnc: z.boolean().optional(),
    advanced_grouping: z.boolean().optional(),
    part_notes: z.boolean().optional(),
  }).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get cutlist with parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cutlist, error } = await (supabase as any)
      .from("cutlists")
      .select(`
        *,
        parts (
          id,
          part_id,
          label,
          qty,
          length_mm,
          width_mm,
          thickness_mm,
          material_id,
          grain,
          allow_rotation,
          group_id,
          ops,
          notes,
          audit,
          created_at
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
      }
      console.error("Failed to fetch cutlist:", error);
      return NextResponse.json(
        { error: "Failed to fetch cutlist" },
        { status: 500 }
      );
    }

    // Transform parts to canonical format
    const transformedParts = cutlist.parts?.map((p: {
      id: string;
      part_id: string;
      label: string | null;
      qty: number;
      length_mm: number;
      width_mm: number;
      thickness_mm: number;
      material_id: string;
      grain: string;
      allow_rotation: boolean;
      group_id: string | null;
      ops: unknown;
      notes: unknown;
      audit: unknown;
      created_at: string;
    }) => ({
      id: p.id,
      part_id: p.part_id,
      label: p.label,
      qty: p.qty,
      size: { L: p.length_mm, W: p.width_mm },
      thickness_mm: p.thickness_mm,
      material_id: p.material_id,
      grain: p.grain,
      allow_rotation: p.allow_rotation,
      group_id: p.group_id,
      ops: p.ops,
      notes: p.notes,
      audit: p.audit,
      created_at: p.created_at,
    })) ?? [];

    return NextResponse.json({
      cutlist: {
        ...cutlist,
        parts: transformedParts,
        parts_count: transformedParts.length,
      },
    });

  } catch (error) {
    console.error("Cutlist GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateCutlistSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // Update cutlist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cutlist, error } = await (supabase as any)
      .from("cutlists")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
      }
      console.error("Failed to update cutlist:", error);
      return NextResponse.json(
        { error: "Failed to update cutlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cutlist,
    });

  } catch (error) {
    console.error("Cutlist PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete cutlist (parts will cascade delete)
    const { error } = await supabase
      .from("cutlists")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete cutlist:", error);
      return NextResponse.json(
        { error: "Failed to delete cutlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cutlist deleted",
    });

  } catch (error) {
    console.error("Cutlist DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

