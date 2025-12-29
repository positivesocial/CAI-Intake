/**
 * CAI Intake - Cutlist Statistics API
 * 
 * GET /api/v1/cutlists/:id/stats - Get detailed statistics for a cutlist
 * 
 * Provides comprehensive statistics including:
 * - Part counts and quantities
 * - Material usage summary
 * - Total area calculations
 * - Edge banding summary
 * - Operation counts
 */

import { NextRequest } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorized,
  notFound,
  badRequest,
  serverError,
  validateId,
} from "@/lib/api/response";

// =============================================================================
// TYPES
// =============================================================================

interface MaterialSummary {
  material_id: string;
  name?: string;
  thickness_mm: number;
  unique_parts: number;
  total_pieces: number;
  total_area_sqm: number;
}

interface EdgeBandSummary {
  position: string;
  total_length_m: number;
  piece_count: number;
}

interface OperationSummary {
  type: string;
  count: number;
}

interface CutlistStats {
  cutlist_id: string;
  unique_parts: number;
  total_pieces: number;
  total_area_sqm: number;
  total_perimeter_m: number;
  materials: MaterialSummary[];
  edge_banding: EdgeBandSummary[];
  operations: OperationSummary[];
  parts_with_grain: number;
  parts_locked_rotation: number;
  parts_with_notes: number;
  groups: { group_id: string | null; count: number }[];
}

// =============================================================================
// HELPERS
// =============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

function calculateArea(length: number, width: number): number {
  return (length * width) / 1_000_000; // mm² to m²
}

function calculatePerimeter(length: number, width: number): number {
  return (2 * (length + width)) / 1_000; // mm to m
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function GET(
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
      .select("organization_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Verify cutlist access
    let cutlistQuery = serviceClient
      .from("cutlists")
      .select("id, name, organization_id")
      .eq("id", id);

    if (!userData.is_super_admin) {
      cutlistQuery = cutlistQuery.eq("organization_id", userData.organization_id);
    }

    const { data: cutlist, error: cutlistError } = await cutlistQuery.single();

    if (cutlistError || !cutlist) {
      return notFound("Cutlist");
    }

    // Get all parts
    const { data: parts, error: partsError } = await serviceClient
      .from("cut_parts")
      .select("*")
      .eq("cutlist_id", id);

    if (partsError) {
      logger.error("Failed to fetch parts for stats", partsError, { cutlistId: id });
      return serverError("Failed to calculate statistics");
    }

    if (!parts || parts.length === 0) {
      return successResponse({
        stats: {
          cutlist_id: id,
          unique_parts: 0,
          total_pieces: 0,
          total_area_sqm: 0,
          total_perimeter_m: 0,
          materials: [],
          edge_banding: [],
          operations: [],
          parts_with_grain: 0,
          parts_locked_rotation: 0,
          parts_with_notes: 0,
          groups: [],
        } satisfies CutlistStats,
      });
    }

    // Calculate statistics
    let totalPieces = 0;
    let totalArea = 0;
    let totalPerimeter = 0;
    let partsWithGrain = 0;
    let partsLockedRotation = 0;
    let partsWithNotes = 0;

    const materialMap = new Map<string, MaterialSummary>();
    const edgeBandMap = new Map<string, EdgeBandSummary>();
    const operationMap = new Map<string, number>();
    const groupMap = new Map<string | null, number>();

    for (const part of parts) {
      const qty = part.qty || 1;
      const length = part.size_l || 0;
      const width = part.size_w || 0;
      const area = calculateArea(length, width);
      const perimeter = calculatePerimeter(length, width);

      totalPieces += qty;
      totalArea += area * qty;
      totalPerimeter += perimeter * qty;

      // Track rotation status
      if (part.allow_rotation === false) {
        partsLockedRotation++;
      }

      // Track grain (legacy support)
      if (part.grain && part.grain !== "none") {
        partsWithGrain++;
      }

      // Track notes
      if (part.notes && Object.keys(part.notes).length > 0) {
        partsWithNotes++;
      }

      // Material summary
      const materialId = part.material_ref || "unknown";
      if (!materialMap.has(materialId)) {
        materialMap.set(materialId, {
          material_id: materialId,
          thickness_mm: part.thickness_mm || 18,
          unique_parts: 0,
          total_pieces: 0,
          total_area_sqm: 0,
        });
      }
      const mat = materialMap.get(materialId)!;
      mat.unique_parts++;
      mat.total_pieces += qty;
      mat.total_area_sqm += area * qty;

      // Edge banding summary
      if (part.ops?.edging) {
        const edging = part.ops.edging as Record<string, unknown>;
        for (const [position, value] of Object.entries(edging)) {
          if (value) {
            const edgeLength = ["L1", "L2"].includes(position) ? length : width;
            
            if (!edgeBandMap.has(position)) {
              edgeBandMap.set(position, {
                position,
                total_length_m: 0,
                piece_count: 0,
              });
            }
            const edge = edgeBandMap.get(position)!;
            edge.total_length_m += (edgeLength / 1000) * qty;
            edge.piece_count += qty;
          }
        }
      }

      // Operation counts
      if (part.ops) {
        const ops = part.ops as Record<string, unknown>;
        for (const [opType, value] of Object.entries(ops)) {
          if (opType !== "edging" && value) {
            const count = Array.isArray(value) ? value.length * qty : qty;
            operationMap.set(opType, (operationMap.get(opType) || 0) + count);
          }
        }
      }

      // Group tracking
      const groupId = part.group_id || null;
      groupMap.set(groupId, (groupMap.get(groupId) || 0) + 1);
    }

    // Build response
    const stats: CutlistStats = {
      cutlist_id: id,
      unique_parts: parts.length,
      total_pieces: totalPieces,
      total_area_sqm: Math.round(totalArea * 1000) / 1000,
      total_perimeter_m: Math.round(totalPerimeter * 100) / 100,
      materials: Array.from(materialMap.values()).map(m => ({
        ...m,
        total_area_sqm: Math.round(m.total_area_sqm * 1000) / 1000,
      })),
      edge_banding: Array.from(edgeBandMap.values()).map(e => ({
        ...e,
        total_length_m: Math.round(e.total_length_m * 100) / 100,
      })),
      operations: Array.from(operationMap.entries()).map(([type, count]) => ({
        type,
        count,
      })),
      parts_with_grain: partsWithGrain,
      parts_locked_rotation: partsLockedRotation,
      parts_with_notes: partsWithNotes,
      groups: Array.from(groupMap.entries())
        .map(([group_id, count]) => ({ group_id, count }))
        .sort((a, b) => b.count - a.count),
    };

    return successResponse({ stats });
  } catch (error) {
    logger.error("Cutlist stats error", error);
    return serverError();
  }
}

