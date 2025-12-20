/**
 * CAI Intake - Parse Job Detail API
 * 
 * GET /api/v1/parse-jobs/[id] - Get parse job details
 * DELETE /api/v1/parse-jobs/[id] - Cancel/delete a parse job
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/parse-jobs/[id]
 * Get parse job details and results
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the parse job
    const job = await prisma.parseJob.findUnique({
      where: { id },
      include: {
        cutlist: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Parse job not found" },
        { status: 404 }
      );
    }

    // Check access - user must own the job or be in the same organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.userId === user.id ||
      (dbUser?.organizationId && job.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Get parse job error:", error);
    return NextResponse.json(
      { error: "Failed to get parse job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/parse-jobs/[id]
 * Cancel or delete a parse job
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the parse job
    const job = await prisma.parseJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Parse job not found" },
        { status: 404 }
      );
    }

    // Check access
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.userId === user.id ||
      (dbUser?.organizationId && job.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // If job is processing, cancel it
    if (job.status === "processing") {
      await prisma.parseJob.update({
        where: { id },
        data: { 
          status: "cancelled", 
          summary: { errors: ["Cancelled by user"] }
        },
      });

      return NextResponse.json({
        message: "Parse job cancelled",
        job: { id, status: "cancelled" },
      });
    }

    // If job is pending or completed/failed, delete it
    await prisma.parseJob.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Parse job deleted",
      job: { id },
    });
  } catch (error) {
    console.error("Delete parse job error:", error);
    return NextResponse.json(
      { error: "Failed to delete parse job" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/parse-jobs/[id]
 * Retry a failed parse job
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    // Fetch the parse job
    const job = await prisma.parseJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Parse job not found" },
        { status: 404 }
      );
    }

    // Check access
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.userId === user.id ||
      (dbUser?.organizationId && job.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    if (action === "retry") {
      if (job.status !== "failed") {
        return NextResponse.json(
          { error: "Only failed jobs can be retried" },
          { status: 400 }
        );
      }

      // Reset job to queued for retry
      const updatedJob = await prisma.parseJob.update({
        where: { id },
        data: {
          status: "queued",
          partsPreview: Prisma.DbNull,
          summary: Prisma.DbNull,
        },
      });

      // TODO: Queue job for reprocessing

      return NextResponse.json({
        message: "Parse job queued for retry",
        job: {
          id: updatedJob.id,
          status: updatedJob.status,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Patch parse job error:", error);
    return NextResponse.json(
      { error: "Failed to update parse job" },
      { status: 500 }
    );
  }
}

