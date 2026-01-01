/**
 * CAI Intake - Bulk Operations API
 * 
 * POST /api/v1/bulk - Execute bulk operations
 * 
 * Allows performing multiple operations in a single request for efficiency.
 */

import { NextRequest } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAuditFromRequest, AUDIT_ACTIONS } from "@/lib/audit";
import {
  successResponse,
  unauthorized,
  badRequest,
  serverError,
  validationError,
} from "@/lib/api/response";

// =============================================================================
// SCHEMAS
// =============================================================================

const BulkOperationSchema = z.object({
  operation: z.enum([
    "cutlists.archive",
    "cutlists.delete",
    "cutlists.update_status",
    "parts.delete",
    "parts.update_material",
    "parts.update_rotation",
    "materials.delete",
    "edgebands.delete",
  ]),
  ids: z.array(z.string()).min(1).max(100),
  data: z.record(z.string(), z.unknown()).optional(),
});

const BulkRequestSchema = z.object({
  operations: z.array(BulkOperationSchema).min(1).max(10),
});

// =============================================================================
// TYPES
// =============================================================================

interface OperationResult {
  operation: string;
  success: boolean;
  affected: number;
  errors?: string[];
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id, is_super_admin, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Check permissions
    const roleName = userData.is_super_admin ? "super_admin" :
      (userData.roles as { name: string } | null)?.name || "viewer";

    // Parse request body
    const body = await request.json();
    const parseResult = BulkRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const { operations } = parseResult.data;
    const results: OperationResult[] = [];

    for (const op of operations) {
      try {
        let result: OperationResult = {
          operation: op.operation,
          success: false,
          affected: 0,
        };

        switch (op.operation) {
          // ===== CUTLIST OPERATIONS =====
          case "cutlists.archive": {
            if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const { error, count } = await serviceClient
              .from("cutlists")
              .update({ status: "archived", updated_at: new Date().toISOString() })
              .eq("organization_id", userData.organization_id)
              .in("id", op.ids);

            result.success = !error;
            result.affected = count ?? 0;
            if (error) result.errors = [error.message];
            break;
          }

          case "cutlists.delete": {
            if (!["super_admin", "org_admin"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const { error, count } = await serviceClient
              .from("cutlists")
              .delete()
              .eq("organization_id", userData.organization_id)
              .in("id", op.ids);

            result.success = !error;
            result.affected = count ?? 0;
            if (error) result.errors = [error.message];
            break;
          }

          case "cutlists.update_status": {
            if (!["super_admin", "org_admin", "manager"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const status = (op.data?.status as string) || "draft";
            const validStatuses = ["draft", "pending", "processing", "completed", "exported", "archived"];
            
            if (!validStatuses.includes(status)) {
              result.errors = [`Invalid status: ${status}`];
              break;
            }

            const { error, count } = await serviceClient
              .from("cutlists")
              .update({ status, updated_at: new Date().toISOString() })
              .eq("organization_id", userData.organization_id)
              .in("id", op.ids);

            result.success = !error;
            result.affected = count ?? 0;
            if (error) result.errors = [error.message];
            break;
          }

          // ===== PARTS OPERATIONS =====
          case "parts.delete": {
            if (!["super_admin", "org_admin", "manager", "operator"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            // First verify cutlist ownership
            const { data: parts } = await serviceClient
              .from("cut_parts")
              .select("id, cutlist_id, cutlists!inner(organization_id)")
              .in("id", op.ids);

            const validIds = parts
              ?.filter((p: { cutlists: { organization_id: string } }) => 
                p.cutlists.organization_id === userData.organization_id
              )
              .map((p: { id: string }) => p.id) || [];

            if (validIds.length > 0) {
              const { error, count } = await serviceClient
                .from("cut_parts")
                .delete()
                .in("id", validIds);

              result.success = !error;
              result.affected = count ?? 0;
              if (error) result.errors = [error.message];
            } else {
              result.success = true;
              result.affected = 0;
            }
            break;
          }

          case "parts.update_material": {
            if (!["super_admin", "org_admin", "manager", "operator"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const materialId = op.data?.material_id as string;
            if (!materialId) {
              result.errors = ["material_id is required"];
              break;
            }

            // Verify parts ownership via cutlist
            const { data: parts } = await serviceClient
              .from("cut_parts")
              .select("id, cutlist_id, cutlists!inner(organization_id)")
              .in("id", op.ids);

            const validIds = parts
              ?.filter((p: { cutlists: { organization_id: string } }) => 
                p.cutlists.organization_id === userData.organization_id
              )
              .map((p: { id: string }) => p.id) || [];

            if (validIds.length > 0) {
              const { error, count } = await serviceClient
                .from("cut_parts")
                .update({ material_ref: materialId, updated_at: new Date().toISOString() })
                .in("id", validIds);

              result.success = !error;
              result.affected = count ?? 0;
              if (error) result.errors = [error.message];
            } else {
              result.success = true;
              result.affected = 0;
            }
            break;
          }

          case "parts.update_rotation": {
            if (!["super_admin", "org_admin", "manager", "operator"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const allowRotation = op.data?.allow_rotation === true;

            // Verify parts ownership via cutlist
            const { data: parts } = await serviceClient
              .from("cut_parts")
              .select("id, cutlist_id, cutlists!inner(organization_id)")
              .in("id", op.ids);

            const validIds = parts
              ?.filter((p: { cutlists: { organization_id: string } }) => 
                p.cutlists.organization_id === userData.organization_id
              )
              .map((p: { id: string }) => p.id) || [];

            if (validIds.length > 0) {
              const { error, count } = await serviceClient
                .from("cut_parts")
                .update({ allow_rotation: allowRotation, updated_at: new Date().toISOString() })
                .in("id", validIds);

              result.success = !error;
              result.affected = count ?? 0;
              if (error) result.errors = [error.message];
            } else {
              result.success = true;
              result.affected = 0;
            }
            break;
          }

          // ===== MATERIALS OPERATIONS =====
          case "materials.delete": {
            if (!["super_admin", "org_admin"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const { error, count } = await serviceClient
              .from("materials")
              .delete()
              .eq("organization_id", userData.organization_id)
              .in("id", op.ids);

            result.success = !error;
            result.affected = count ?? 0;
            if (error) result.errors = [error.message];
            break;
          }

          // ===== EDGEBANDS OPERATIONS =====
          case "edgebands.delete": {
            if (!["super_admin", "org_admin"].includes(roleName)) {
              result.errors = ["Insufficient permissions"];
              break;
            }

            const { error, count } = await serviceClient
              .from("edgebands")
              .delete()
              .eq("organization_id", userData.organization_id)
              .in("id", op.ids);

            result.success = !error;
            result.affected = count ?? 0;
            if (error) result.errors = [error.message];
            break;
          }

          default:
            result.errors = ["Unknown operation"];
        }

        results.push(result);
      } catch (opError) {
        logger.error("Bulk operation failed", { operation: op.operation, error: opError });
        results.push({
          operation: op.operation,
          success: false,
          affected: 0,
          errors: [opError instanceof Error ? opError.message : "Operation failed"],
        });
      }
    }

    // Audit log for successful operations
    const successfulOps = results.filter(r => r.success && r.affected > 0);
    if (successfulOps.length > 0) {
      await logAuditFromRequest(request, {
        userId: user.id,
        organizationId: userData.organization_id,
        action: "bulk.operation",
        entityType: "bulk",
        entityId: "bulk",
        metadata: { 
          operations: successfulOps.map(o => o.operation),
          totalAffected: successfulOps.reduce((sum, o) => sum + o.affected, 0),
        },
      });
    }

    const allSuccessful = results.every(r => r.success);

    return successResponse({
      success: allSuccessful,
      results,
      summary: {
        total_operations: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_affected: results.reduce((sum, r) => sum + r.affected, 0),
      },
    });
  } catch (error) {
    logger.error("Bulk operations error", error);
    return serverError();
  }
}

