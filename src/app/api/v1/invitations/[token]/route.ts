/**
 * CAI Intake - Invitation API
 * 
 * GET /api/v1/invitations/:token - Get invitation details
 * POST /api/v1/invitations/:token/accept - Accept invitation
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorized,
  notFound,
  badRequest,
  serverError,
} from "@/lib/api/response";

// =============================================================================
// HELPERS
// =============================================================================

interface RouteParams {
  params: Promise<{ token: string }>;
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/v1/invitations/:token
 * Get invitation details without needing to be logged in
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return badRequest("Invalid invitation token");
    }

    // Find invitation with organization
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!invitation) {
      return notFound("Invitation");
    }

    // Get role name
    const role = await prisma.role.findUnique({
      where: { id: invitation.roleId },
      select: { name: true },
    });

    // Check if expired
    const isExpired = invitation.expiresAt < new Date();
    const isAccepted = !!invitation.acceptedAt;

    return successResponse({
      invitation: {
        email: invitation.email,
        organization: invitation.organization.name,
        role: role?.name || "operator",
        invited_by: invitation.invitedBy?.name || invitation.invitedBy?.email,
        expires_at: invitation.expiresAt,
        status: isAccepted ? "accepted" : isExpired ? "expired" : "pending",
      },
    });
  } catch (error) {
    logger.error("Invitation GET error", error);
    return serverError();
  }
}

/**
 * POST /api/v1/invitations/:token/accept
 * Accept an invitation (requires logged-in user)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { token } = await params;

    if (!token || token.length < 10) {
      return badRequest("Invalid invitation token");
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    // Get role separately
    const role = invitation ? await prisma.role.findUnique({
      where: { id: invitation.roleId },
    }) : null;

    if (!invitation) {
      return notFound("Invitation");
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return badRequest("Invitation has already been accepted");
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return badRequest("Invitation has expired");
    }

    // Verify email matches
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return badRequest(
        `This invitation was sent to ${invitation.email}. Please sign in with that email address.`
      );
    }

    // Check if user is already in an organization
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    if (existingUser?.organizationId) {
      return badRequest("You are already a member of an organization. Please leave your current organization first.");
    }

    // Accept invitation - update user and mark invitation as accepted
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          organizationId: invitation.organizationId,
          roleId: invitation.roleId,
          isActive: true,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
        },
      }),
    ]);

    return successResponse({
      success: true,
      message: `Welcome to ${invitation.organization.name}!`,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
      },
      role: role?.name || "operator",
    });
  } catch (error) {
    logger.error("Invitation accept error", error);
    return serverError();
  }
}

