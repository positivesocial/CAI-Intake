/**
 * CAI Intake - Duplicate Cutlist API
 * 
 * POST /api/v1/cutlists/:id/duplicate - Create a copy of a cutlist
 * 
 * Creates a new cutlist with all parts and settings copied from the original.
 */

import { NextRequest } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import { generateId } from "@/lib/utils";
import {
  createdResponse,
  unauthorized,
  notFound,
  badRequest,
  serverError,
  validationError,
  validateId,
} from "@/lib/api/response";
import crypto from "crypto";

// =============================================================================
// SCHEMAS
// =============================================================================

const DuplicateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  include_parts: z.boolean().default(true),
  include_files: z.boolean().default(false),
});

// =============================================================================
// HELPERS
// =============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "cutlist");
    if (idError) return idError;

    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Get original cutlist with parts
    const { data: original, error: fetchError } = await serviceClient
      .from("cutlists")
      .select(`
        *,
        cut_parts (*)
      `)
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (fetchError || !original) {
      return notFound("Cutlist");
    }

    // Parse options
    const body = await request.json().catch(() => ({}));
    const parseResult = DuplicateSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const { name, include_parts } = parseResult.data;

    // Generate new IDs
    const newCutlistId = crypto.randomUUID();
    const newDocId = generateId("DOC");
    const now = new Date().toISOString();

    // Create new cutlist
    const { data: newCutlist, error: createError } = await serviceClient
      .from("cutlists")
      .insert({
        id: newCutlistId,
        organization_id: userData.organization_id,
        user_id: user.id,
        doc_id: newDocId,
        name: name || `${original.name} (Copy)`,
        description: original.description,
        project_name: original.project_name,
        customer_name: original.customer_name,
        job_ref: original.job_ref,
        client_ref: original.client_ref,
        capabilities: original.capabilities,
        source_method: "duplicate",
        status: "draft",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (createError) {
      logger.error("Failed to duplicate cutlist", createError, { userId: user.id, originalId: id });
      return serverError("Failed to duplicate cutlist");
    }

    let partsCount = 0;

    // Copy parts if requested
    if (include_parts && original.cut_parts?.length > 0) {
      const newParts = original.cut_parts.map((p: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        cutlist_id: newCutlistId,
        part_id: p.part_id,
        label: p.label,
        qty: p.qty,
        size_l: p.size_l,
        size_w: p.size_w,
        thickness_mm: p.thickness_mm,
        material_ref: p.material_ref,
        allow_rotation: p.allow_rotation,
        group_id: p.group_id,
        ops: p.ops,
        notes: p.notes,
        created_at: now,
        updated_at: now,
      }));

      const { error: partsError } = await serviceClient
        .from("cut_parts")
        .insert(newParts);

      if (partsError) {
        logger.warn("Failed to copy parts during duplicate", { cutlistId: newCutlistId, error: partsError });
      } else {
        partsCount = newParts.length;
      }
    }

    // Audit log
    await logAuditFromRequest(request, {
      userId: user.id,
      organizationId: userData.organization_id,
      action: "cutlist.duplicated",
      entityType: "cutlist",
      entityId: newCutlistId,
      metadata: { originalId: id, partsCount },
    });

    return createdResponse({
      cutlist: {
        id: newCutlist.id,
        doc_id: newCutlist.doc_id,
        name: newCutlist.name,
        status: newCutlist.status,
        parts_count: partsCount,
        created_at: newCutlist.created_at,
      },
      original_id: id,
      message: "Cutlist duplicated successfully",
    });
  } catch (error) {
    logger.error("Duplicate cutlist error", error);
    return serverError();
  }
}

