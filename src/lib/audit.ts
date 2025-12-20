/**
 * CAI Intake - Audit Logging
 * 
 * Provides audit trail functionality for tracking user actions.
 * Logs are stored in the audit_logs table for compliance and forensics.
 */

import { db } from "./db";
import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

export interface AuditLogParams {
  /** User who performed the action */
  userId?: string | null;
  /** Organization context */
  organizationId?: string | null;
  /** Action performed (e.g., "cutlist.create", "user.login") */
  action: string;
  /** Type of entity affected */
  entityType?: string;
  /** ID of entity affected */
  entityId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Client IP address */
  ipAddress?: string | null;
  /** User agent string */
  userAgent?: string | null;
}

// =============================================================================
// AUDIT ACTIONS
// =============================================================================

export const AUDIT_ACTIONS = {
  // Authentication
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_LOGIN_FAILED: "user.login_failed",
  USER_PASSWORD_RESET: "user.password_reset",
  USER_PASSWORD_CHANGED: "user.password_changed",
  
  // User management
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_INVITED: "user.invited",
  USER_ROLE_CHANGED: "user.role_changed",
  
  // Organization
  ORG_CREATED: "organization.created",
  ORG_UPDATED: "organization.updated",
  ORG_SETTINGS_CHANGED: "organization.settings_changed",
  ORG_PLAN_CHANGED: "organization.plan_changed",
  
  // Cutlists
  CUTLIST_CREATED: "cutlist.created",
  CUTLIST_UPDATED: "cutlist.updated",
  CUTLIST_DELETED: "cutlist.deleted",
  CUTLIST_EXPORTED: "cutlist.exported",
  CUTLIST_OPTIMIZED: "cutlist.optimized",
  
  // Parts
  PART_CREATED: "part.created",
  PART_UPDATED: "part.updated",
  PART_DELETED: "part.deleted",
  PARTS_IMPORTED: "parts.imported",
  
  // Materials
  MATERIAL_CREATED: "material.created",
  MATERIAL_UPDATED: "material.updated",
  MATERIAL_DELETED: "material.deleted",
  
  // Files
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",
  
  // Parse Jobs
  PARSE_JOB_CREATED: "parse_job.created",
  PARSE_JOB_COMPLETED: "parse_job.completed",
  PARSE_JOB_FAILED: "parse_job.failed",
  
  // Optimize Jobs
  OPTIMIZE_JOB_CREATED: "optimize_job.created",
  OPTIMIZE_JOB_COMPLETED: "optimize_job.completed",
  OPTIMIZE_JOB_FAILED: "optimize_job.failed",
  
  // Settings
  SETTINGS_UPDATED: "settings.updated",
  API_KEY_CREATED: "api_key.created",
  API_KEY_REVOKED: "api_key.revoked",
  WEBHOOK_CREATED: "webhook.created",
  WEBHOOK_DELETED: "webhook.deleted",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// AUDIT LOG FUNCTION
// =============================================================================

/**
 * Log an audit event to the database
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    logger.error("Failed to create audit log", error, {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }
}

/**
 * Log an audit event with request context
 */
export async function logAuditFromRequest(
  request: Request,
  params: Omit<AuditLogParams, "ipAddress" | "userAgent">
): Promise<void> {
  const headers = request.headers;
  
  await logAudit({
    ...params,
    ipAddress: 
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip") ||
      null,
    userAgent: headers.get("user-agent"),
  });
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

export interface AuditLogQueryParams {
  organizationId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: AuditLogQueryParams) {
  const where: Record<string, unknown> = {};
  
  if (params.organizationId) where.organizationId = params.organizationId;
  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.entityType) where.entityType = params.entityType;
  if (params.entityId) where.entityId = params.entityId;
  
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }
  
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit || 50,
      skip: params.offset || 0,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);
  
  return { logs, total };
}

