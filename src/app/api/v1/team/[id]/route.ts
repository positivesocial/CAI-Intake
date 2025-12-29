/**
 * CAI Intake - Single Team Member API
 * 
 * GET /api/v1/team/:id - Get team member details
 * PUT /api/v1/team/:id - Update team member role
 * DELETE /api/v1/team/:id - Remove team member
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorized,
  notFound,
  badRequest,
  forbidden,
  serverError,
  validationError,
  validateId,
} from "@/lib/api/response";

// =============================================================================
// SCHEMAS
// =============================================================================

const UpdateMemberSchema = z.object({
  role: z.enum(["org_admin", "manager", "operator", "viewer"]).optional(),
  is_active: z.boolean().optional(),
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

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "team member");
    if (idError) return idError;

    // Get current user's organization
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        organizationId: true,
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    if (!currentUser?.organizationId) {
      return badRequest("User not associated with an organization");
    }

    // Get target team member
    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        organizationId: true,
        role: { select: { id: true, name: true } },
        _count: {
          select: { cutlists: true },
        },
      },
    });

    if (!member) {
      return notFound("Team member");
    }

    // Verify same organization
    if (!currentUser.isSuperAdmin && member.organizationId !== currentUser.organizationId) {
      return forbidden("Cannot access team members from other organizations");
    }

    return successResponse({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        role: member.role?.name || "operator",
        is_active: member.isActive,
        last_login_at: member.lastLoginAt,
        cutlists_count: member._count.cutlists,
        created_at: member.createdAt,
      },
    });
  } catch (error) {
    logger.error("Team member GET error", error);
    return serverError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "team member");
    if (idError) return idError;

    // Get current user's organization and permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        organizationId: true,
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    if (!currentUser?.organizationId) {
      return badRequest("User not associated with an organization");
    }

    // Check permissions
    const roleName = currentUser.isSuperAdmin ? "super_admin" : currentUser.role?.name || "viewer";
    if (!["super_admin", "org_admin"].includes(roleName)) {
      return forbidden("Insufficient permissions to modify team members");
    }

    // Get target team member
    const member = await prisma.user.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!member) {
      return notFound("Team member");
    }

    // Verify same organization
    if (!currentUser.isSuperAdmin && member.organizationId !== currentUser.organizationId) {
      return forbidden("Cannot modify team members from other organizations");
    }

    // Prevent self-demotion (security)
    if (id === user.id) {
      return badRequest("Cannot modify your own role. Ask another admin.");
    }

    // Parse request body
    const body = await request.json();
    const parseResult = UpdateMemberSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const { role, is_active } = parseResult.data;

    // Build update data
    const updateData: { roleId?: string; isActive?: boolean } = {};

    if (role !== undefined) {
      const roleRecord = await prisma.role.findUnique({
        where: { name: role },
      });
      if (!roleRecord) {
        return badRequest(`Invalid role: ${role}`);
      }
      updateData.roleId = roleRecord.id;
    }

    if (is_active !== undefined) {
      updateData.isActive = is_active;
    }

    // Update member
    const updatedMember = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });

    return successResponse({
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role?.name,
        is_active: updatedMember.isActive,
      },
      message: "Team member updated",
    });
  } catch (error) {
    logger.error("Team member PUT error", error);
    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const idError = validateId(id, "team member");
    if (idError) return idError;

    // Get current user's organization and permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        organizationId: true,
        isSuperAdmin: true,
        role: { select: { name: true } },
      },
    });

    if (!currentUser?.organizationId) {
      return badRequest("User not associated with an organization");
    }

    // Check permissions
    const roleName = currentUser.isSuperAdmin ? "super_admin" : currentUser.role?.name || "viewer";
    if (!["super_admin", "org_admin"].includes(roleName)) {
      return forbidden("Insufficient permissions to remove team members");
    }

    // Prevent self-removal
    if (id === user.id) {
      return badRequest("Cannot remove yourself from the team");
    }

    // Get target team member
    const member = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, organizationId: true },
    });

    if (!member) {
      return notFound("Team member");
    }

    // Verify same organization
    if (!currentUser.isSuperAdmin && member.organizationId !== currentUser.organizationId) {
      return forbidden("Cannot remove team members from other organizations");
    }

    // Remove from organization (set organizationId to null)
    // We don't delete the user - they can still exist for auth purposes
    await prisma.user.update({
      where: { id },
      data: {
        organizationId: null,
        isActive: false,
      },
    });

    return successResponse({
      success: true,
      message: `${member.name || member.email} has been removed from the team`,
    });
  } catch (error) {
    logger.error("Team member DELETE error", error);
    return serverError();
  }
}

