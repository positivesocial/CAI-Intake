/**
 * CAI Intake - Optimize Job Detail API
 * 
 * GET /api/v1/optimize-jobs/[id] - Get optimization job details
 * DELETE /api/v1/optimize-jobs/[id] - Cancel/delete an optimization job
 * PATCH /api/v1/optimize-jobs/[id] - Retry a failed job
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/optimize-jobs/[id]
 * Get optimization job details and results
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

    // Fetch the optimization job
    const job = await prisma.optimizeJob.findUnique({
      where: { id },
      include: {
        cutlist: {
          select: {
            id: true,
            name: true,
            userId: true,
            organizationId: true,
            _count: { select: { parts: true } },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Optimization job not found" },
        { status: 404 }
      );
    }

    // Check access
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.cutlist.userId === user.id ||
      (dbUser?.organizationId && job.cutlist.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Get optimize job error:", error);
    return NextResponse.json(
      { error: "Failed to get optimization job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/optimize-jobs/[id]
 * Cancel or delete an optimization job
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

    // Fetch the optimization job with cutlist for access check
    const job = await prisma.optimizeJob.findUnique({
      where: { id },
      include: {
        cutlist: {
          select: { userId: true, organizationId: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Optimization job not found" },
        { status: 404 }
      );
    }

    // Check access
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.cutlist.userId === user.id ||
      (dbUser?.organizationId && job.cutlist.organizationId === dbUser.organizationId) ||
      dbUser?.isSuperAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // If job is processing, cancel it
    if (job.status === "processing") {
      // TODO: Send cancellation request to CAI 2D optimizer
      
      await prisma.optimizeJob.update({
        where: { id },
        data: { status: "cancelled" },
      });

      return NextResponse.json({
        message: "Optimization job cancelled",
        job: { id, status: "cancelled" },
      });
    }

    // If job is pending or completed/failed, delete it
    await prisma.optimizeJob.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Optimization job deleted",
      job: { id },
    });
  } catch (error) {
    console.error("Delete optimize job error:", error);
    return NextResponse.json(
      { error: "Failed to delete optimization job" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/optimize-jobs/[id]
 * Retry a failed optimization job or update priority
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

    // Fetch the optimization job with cutlist for access check
    const job = await prisma.optimizeJob.findUnique({
      where: { id },
      include: {
        cutlist: {
          select: { userId: true, organizationId: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Optimization job not found" },
        { status: 404 }
      );
    }

    // Check access
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    });

    const hasAccess = 
      job.cutlist.userId === user.id ||
      (dbUser?.organizationId && job.cutlist.organizationId === dbUser.organizationId) ||
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
      const updatedJob = await prisma.optimizeJob.update({
        where: { id },
        data: {
          status: "queued",
          result: Prisma.DbNull,
          metrics: Prisma.DbNull,
          completedAt: null,
        },
      });

      // TODO: Queue job for reprocessing

      return NextResponse.json({
        message: "Optimization job queued for retry",
        job: {
          id: updatedJob.id,
          status: updatedJob.status,
        },
      });
    }

    if (action === "updateOptions" && body.options) {
      if (job.status !== "queued") {
        return NextResponse.json(
          { error: "Can only update options of queued jobs" },
          { status: 400 }
        );
      }

      const updatedJob = await prisma.optimizeJob.update({
        where: { id },
        data: { options: body.options },
      });

      return NextResponse.json({
        message: "Job options updated",
        job: {
          id: updatedJob.id,
          options: updatedJob.options,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Patch optimize job error:", error);
    return NextResponse.json(
      { error: "Failed to update optimization job" },
      { status: 500 }
    );
  }
}

