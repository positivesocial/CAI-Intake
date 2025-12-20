/**
 * CAI Intake - Cutlist Parts API
 * 
 * GET /api/v1/cutlists/:id/parts - Get parts
 * POST /api/v1/cutlists/:id/parts - Add parts
 * DELETE /api/v1/cutlists/:id/parts - Bulk delete parts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Add parts schema
const AddPartsSchema = z.object({
  parts: z.array(z.object({
    part_id: z.string().min(1),
    label: z.string().optional(),
    qty: z.number().int().positive(),
    size: z.object({ L: z.number().positive(), W: z.number().positive() }),
    thickness_mm: z.number().positive(),
    material_id: z.string().min(1),
    grain: z.string().optional(),
    allow_rotation: z.boolean().optional(),
    group_id: z.string().optional(),
    ops: z.any().optional(),
    notes: z.any().optional(),
    audit: z.any().optional(),
  })),
});

// Bulk delete schema
const BulkDeleteSchema = z.object({
  part_ids: z.array(z.string()).min(1),
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

    // Verify cutlist access
    const { data: cutlist, error: cutlistError } = await supabase
      .from("cutlists")
      .select("id")
      .eq("id", id)
      .single();

    if (cutlistError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Get parts
    const { data: parts, error } = await supabase
      .from("parts")
      .select("*")
      .eq("cutlist_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch parts:", error);
      return NextResponse.json(
        { error: "Failed to fetch parts" },
        { status: 500 }
      );
    }

    // Transform to canonical format
    const transformedParts = (parts as Array<{
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
      updated_at: string;
    }> | null)?.map(p => ({
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
      updated_at: p.updated_at,
    })) ?? [];

    return NextResponse.json({
      parts: transformedParts,
      count: transformedParts.length,
    });

  } catch (error) {
    console.error("Parts GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Verify cutlist access
    const { data: cutlist, error: cutlistError } = await supabase
      .from("cutlists")
      .select("id")
      .eq("id", id)
      .single();

    if (cutlistError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = AddPartsSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { parts } = parseResult.data;

    // Insert parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedParts, error } = await (supabase as any)
      .from("parts")
      .insert(
        parts.map(p => ({
          cutlist_id: id,
          part_id: p.part_id,
          label: p.label,
          qty: p.qty,
          length_mm: p.size.L,
          width_mm: p.size.W,
          thickness_mm: p.thickness_mm,
          material_id: p.material_id,
          grain: p.grain ?? "none",
          allow_rotation: p.allow_rotation ?? true,
          group_id: p.group_id,
          ops: p.ops,
          notes: p.notes,
          audit: p.audit,
        }))
      )
      .select();

    if (error) {
      console.error("Failed to add parts:", error);
      return NextResponse.json(
        { error: "Failed to add parts" },
        { status: 500 }
      );
    }

    // Transform response
    const transformedParts = (insertedParts as Array<{
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
    }> | null)?.map(p => ({
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
      success: true,
      parts: transformedParts,
      count: transformedParts.length,
    }, { status: 201 });

  } catch (error) {
    console.error("Parts POST error:", error);
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

    // Parse request body
    const body = await request.json();
    const parseResult = BulkDeleteSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { part_ids } = parseResult.data;

    // Delete parts
    const { error } = await supabase
      .from("parts")
      .delete()
      .eq("cutlist_id", id)
      .in("part_id", part_ids);

    if (error) {
      console.error("Failed to delete parts:", error);
      return NextResponse.json(
        { error: "Failed to delete parts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: part_ids.length,
    });

  } catch (error) {
    console.error("Parts DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Bulk update schema
const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    part_id: z.string().min(1),
    label: z.string().optional(),
    qty: z.number().int().positive().optional(),
    size: z.object({ L: z.number().positive(), W: z.number().positive() }).optional(),
    thickness_mm: z.number().positive().optional(),
    material_id: z.string().min(1).optional(),
    grain: z.string().optional(),
    allow_rotation: z.boolean().optional(),
    group_id: z.string().nullable().optional(),
    ops: z.any().optional(),
    notes: z.any().optional(),
  })),
});

export async function PATCH(
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

    // Verify cutlist access
    const { data: cutlist, error: cutlistError } = await supabase
      .from("cutlists")
      .select("id")
      .eq("id", id)
      .single();

    if (cutlistError || !cutlist) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const parseResult = BulkUpdateSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { updates } = parseResult.data;
    const results: Array<{ part_id: string; success: boolean; error?: string }> = [];

    // Update parts one by one (Supabase doesn't support bulk upsert easily)
    for (const update of updates) {
      const updateData: Record<string, unknown> = {};
      
      if (update.label !== undefined) updateData.label = update.label;
      if (update.qty !== undefined) updateData.qty = update.qty;
      if (update.size !== undefined) {
        updateData.length_mm = update.size.L;
        updateData.width_mm = update.size.W;
      }
      if (update.thickness_mm !== undefined) updateData.thickness_mm = update.thickness_mm;
      if (update.material_id !== undefined) updateData.material_id = update.material_id;
      if (update.grain !== undefined) updateData.grain = update.grain;
      if (update.allow_rotation !== undefined) updateData.allow_rotation = update.allow_rotation;
      if (update.group_id !== undefined) updateData.group_id = update.group_id;
      if (update.ops !== undefined) updateData.ops = update.ops;
      if (update.notes !== undefined) updateData.notes = update.notes;

      if (Object.keys(updateData).length === 0) {
        results.push({ part_id: update.part_id, success: false, error: "No fields to update" });
        continue;
      }

      const { error } = await supabase
        .from("parts")
        .update(updateData)
        .eq("cutlist_id", id)
        .eq("part_id", update.part_id);

      if (error) {
        results.push({ part_id: update.part_id, success: false, error: error.message });
      } else {
        results.push({ part_id: update.part_id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      updated: successCount,
      failed: failCount,
      results,
    });

  } catch (error) {
    console.error("Parts PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

