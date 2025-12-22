/**
 * CAI Intake - Team API
 * 
 * GET /api/v1/team - Get team members for organization
 * POST /api/v1/team/invite - Send invitation to new team member
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient, getUser } from "@/lib/supabase/server";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  lastActive: string;
  cutlistsThisWeek: number;
  avatar?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  status: "pending" | "expired";
}

// =============================================================================
// HELPERS
// =============================================================================

function formatLastActive(date: Date | null): string {
  if (!date) return "Never";
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 5) return "Active now";
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  
  return date.toLocaleDateString();
}

// =============================================================================
// GET - List team members
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    
    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Fetch team members with Prisma for relations
    const members = await prisma.user.findMany({
      where: { organizationId: userData.organization_id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isActive: true,
        lastLoginAt: true,
        role: { select: { name: true } },
        _count: {
          select: {
            cutlists: {
              where: { createdAt: { gte: startOfWeek } },
            },
          },
        },
      },
      orderBy: [
        { lastLoginAt: "desc" },
        { name: "asc" },
      ],
    });

    // Format response
    const formattedMembers: TeamMember[] = members.map(m => ({
      id: m.id,
      name: m.name || "Unknown User",
      email: m.email,
      role: m.role?.name || "operator",
      status: m.isActive ? "active" : "inactive",
      lastActive: formatLastActive(m.lastLoginAt),
      cutlistsThisWeek: m._count.cutlists,
      avatar: m.avatar || undefined,
    }));

    // Fetch pending invitations
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: userData.organization_id,
        acceptedAt: null,
      },
      select: {
        id: true,
        email: true,
        roleId: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get role names for invitations
    const roleIds = invitations.map(i => i.roleId).filter(Boolean);
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });
    const roleMap = new Map(roles.map(r => [r.id, r.name]));

    const formattedInvitations: Invitation[] = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: roleMap.get(inv.roleId) || "operator",
      expiresAt: inv.expiresAt,
      status: inv.expiresAt > now ? "pending" : "expired",
    }));

    return NextResponse.json({
      members: formattedMembers,
      invitations: formattedInvitations,
      stats: {
        total: formattedMembers.length,
        active: formattedMembers.filter(m => m.status === "active").length,
        pendingInvites: formattedInvitations.filter(i => i.status === "pending").length,
      },
    });
  } catch (error) {
    console.error("Team API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch team data" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Invite team member
// =============================================================================

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["manager", "operator", "viewer"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    
    // Get user's organization and check permissions
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    // Only org_admin and manager can invite
    if (!["org_admin", "manager"].includes(userData.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const parseResult = InviteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = parseResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email, organizationId: userData.organization_id },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 }
      );
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: userData.organization_id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 }
      );
    }

    // Get role ID
    const roleRecord = await prisma.role.findUnique({
      where: { name: role },
    });

    if (!roleRecord) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.invitation.create({
      data: {
        email,
        token: crypto.randomUUID(),
        roleId: roleRecord.id,
        organizationId: userData.organization_id,
        invitedById: user.id,
        expiresAt,
      },
    });

    // TODO: Send invitation email

    return NextResponse.json(
      { 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role,
          expiresAt: invitation.expiresAt,
        },
        message: "Invitation sent successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Team invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

