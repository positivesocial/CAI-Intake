/**
 * CAI Intake - Optimization API
 * 
 * POST /api/v1/optimize - Run panel optimization via CAI 2D
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitOptimization, type CustomerInfo, type MachineSettings, type RunConfig, type RenderOptions } from "@/lib/optimizer/cai2d-client";
import { prisma } from "@/lib/db";
import type { CutPart, MaterialDef } from "@/lib/schema";

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const {
      cutlistId,
      parts,
      materials,
      jobName,
      customer,
      machineSettings,
      runConfig,
      renderOptions,
    } = body as {
      cutlistId?: string;
      parts: CutPart[];
      materials?: MaterialDef[];
      jobName?: string;
      customer?: CustomerInfo;
      machineSettings?: MachineSettings;
      runConfig?: RunConfig;
      renderOptions?: RenderOptions;
    };
    
    if (!parts || parts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No parts provided" },
        { status: 400 }
      );
    }
    
    // Create optimization job record (for tracking) - only if cutlist exists in DB
    let jobRecord;
    if (cutlistId) {
      try {
        // First check if cutlist exists
        const cutlistExists = await prisma.cutlist.findUnique({
          where: { id: cutlistId },
          select: { id: true },
        });
        
        if (cutlistExists) {
          jobRecord = await prisma.optimizeJob.create({
            data: {
              cutlistId,
              status: "processing",
              options: { partsCount: parts.length } as any,
            },
          });
        }
      } catch (e) {
        // Job tracking is optional, continue without it
        console.warn("Could not create optimization job record:", e);
      }
    }
    
    // Run optimization
    const result = await submitOptimization({
      jobId: cutlistId ?? `job_${Date.now()}`,
      jobName: jobName ?? "Cutlist Optimization",
      orgId: "cai-intake-default",
      userId: user.id,
      parts,
      materials,
      customer,
      machineSettings,
      runConfig: runConfig ?? {
        mode: "guillotine",
        search: "beam",
        runs: 30,
      },
      renderOptions: renderOptions ?? {
        svg: true,
        showLabels: true,
        showCutNumbers: true,
      },
    });
    
    // Update job record with result
    if (jobRecord) {
      try {
        await prisma.optimizeJob.update({
          where: { id: jobRecord.id },
          data: {
            status: result.ok ? "completed" : "failed",
            completedAt: new Date(),
            result: result.result ? (result.result as any) : undefined,
            metrics: result.result?.summary ? {
              sheets_used: result.result.summary.sheets_used,
              utilization_pct: result.result.summary.utilization_pct,
              waste_area: result.result.summary.waste_area,
            } : undefined,
          },
        });
      } catch (e) {
        console.warn("Could not update optimization job record:", e);
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Optimization API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Optimization failed" },
      { status: 500 }
    );
  }
}

