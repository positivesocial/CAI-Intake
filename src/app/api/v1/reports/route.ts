/**
 * CAI Intake - Reports API
 * 
 * GET /api/v1/reports - Get analytics and report data
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient, getUser } from "@/lib/supabase/server";

// =============================================================================
// TYPES
// =============================================================================

interface ReportStats {
  totalCutlists: number;
  totalParts: number;
  totalPieces: number;
  totalArea: number;
  totalFilesUploaded: number;
  avgEfficiency: number;
  avgPartsPerCutlist: number;
  cutlistsThisPeriod: number;
  partsThisPeriod: number;
  filesThisPeriod: number;
  periodGrowth: {
    cutlists: number;
    parts: number;
    area: number;
    efficiency: number;
    files: number;
  };
}

interface MonthlyData {
  month: string;
  cutlists: number;
  parts: number;
  area: number;
}

interface MaterialUsage {
  material: string;
  area: number;
  percentage: number;
  color: string;
}

interface RecentCutlist {
  id: string;
  name: string;
  parts: number;
  status: string;
  date: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getTimeRangeStart(range: string): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "12m":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "all":
    default:
      return new Date(0); // Beginning of time
  }
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" });
}

const MATERIAL_COLORS = [
  "#00838F", // Teal
  "#C4A35A", // Gold
  "#1A1A1A", // Black
  "#8B7355", // Brown
  "#5D4037", // Dark Brown
  "#9E9E9E", // Gray
  "#1976D2", // Blue
  "#7B1FA2", // Purple
  "#388E3C", // Green
  "#F57C00", // Orange
];

// =============================================================================
// GET - Get reports data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const periodStart = getTimeRangeStart(range);

    // Get user's organization
    const supabase = await createClient();
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgFilter = userData?.organization_id
      ? { organizationId: userData.organization_id }
      : { userId: user.id };

    // Get previous period for comparison
    const periodDuration = new Date().getTime() - periodStart.getTime();
    const previousPeriodStart = new Date(periodStart.getTime() - periodDuration);

    // Current period stats
    const currentCutlists = await prisma.cutlist.count({
      where: { ...orgFilter, createdAt: { gte: periodStart } },
    });

    const currentParts = await prisma.cutPart.count({
      where: {
        cutlist: { ...orgFilter },
        createdAt: { gte: periodStart },
      },
    });

    // Previous period stats
    const previousCutlists = await prisma.cutlist.count({
      where: {
        ...orgFilter,
        createdAt: { gte: previousPeriodStart, lt: periodStart },
      },
    });

    const previousParts = await prisma.cutPart.count({
      where: {
        cutlist: { ...orgFilter },
        createdAt: { gte: previousPeriodStart, lt: periodStart },
      },
    });

    // Total stats
    const totalCutlists = await prisma.cutlist.count({ where: orgFilter });
    const totalParts = await prisma.cutPart.count({
      where: { cutlist: { ...orgFilter } },
    });
    const totalFilesUploaded = await prisma.uploadedFile.count({
      where: { organizationId: userData?.organization_id || undefined },
    });

    // Files this period
    const currentFiles = await prisma.uploadedFile.count({
      where: {
        organizationId: userData?.organization_id || undefined,
        createdAt: { gte: periodStart },
      },
    });

    // Files previous period
    const previousFiles = await prisma.uploadedFile.count({
      where: {
        organizationId: userData?.organization_id || undefined,
        createdAt: { gte: previousPeriodStart, lt: periodStart },
      },
    });

    const filesGrowth = previousFiles > 0
      ? ((currentFiles - previousFiles) / previousFiles) * 100
      : 0;

    // Get parts with dimensions for area calculation
    const partsWithDimensions = await prisma.cutPart.findMany({
      where: { cutlist: { ...orgFilter } },
      select: { sizeL: true, sizeW: true, qty: true },
    });

    const totalArea = partsWithDimensions.reduce((sum, part) => {
      const areaM2 = (part.sizeL * part.sizeW * (part.qty || 1)) / 1000000;
      return sum + areaM2;
    }, 0);

    // Calculate total pieces
    const totalPieces = partsWithDimensions.reduce((sum, part) => sum + (part.qty || 1), 0);

    // Calculate period growth
    const cutlistsGrowth = previousCutlists > 0
      ? ((currentCutlists - previousCutlists) / previousCutlists) * 100
      : 0;

    const partsGrowth = previousParts > 0
      ? ((currentParts - previousParts) / previousParts) * 100
      : 0;

    // Monthly data for the last 6 months
    const monthlyData: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthCutlists = await prisma.cutlist.count({
        where: {
          ...orgFilter,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      });

      const monthParts = await prisma.cutPart.findMany({
        where: {
          cutlist: { ...orgFilter },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        select: { sizeL: true, sizeW: true, qty: true },
      });

      const monthArea = monthParts.reduce((sum, part) => {
        return sum + (part.sizeL * part.sizeW * (part.qty || 1)) / 1000000;
      }, 0);

      monthlyData.push({
        month: getMonthName(monthStart),
        cutlists: monthCutlists,
        parts: monthParts.length,
        area: parseFloat(monthArea.toFixed(1)),
      });
    }

    // Material usage
    const materialStats = await prisma.cutPart.groupBy({
      by: ["materialId"],
      where: { cutlist: { ...orgFilter } },
      _count: { id: true },
    });

    // Get material names
    const materialIds = materialStats.map(s => s.materialId).filter(Boolean) as string[];
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true },
    });

    const materialMap = new Map(materials.map(m => [m.id, m.name]));
    const totalMaterialCount = materialStats.reduce((sum, s) => sum + s._count.id, 0);

    const materialUsage: MaterialUsage[] = materialStats
      .filter(s => s.materialId)
      .map((s, i) => ({
        material: materialMap.get(s.materialId!) || "Unknown",
        area: s._count.id, // Using count as proxy for area
        percentage: parseFloat(((s._count.id / totalMaterialCount) * 100).toFixed(1)),
        color: MATERIAL_COLORS[i % MATERIAL_COLORS.length],
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 6);

    // If we have more materials, add "Other"
    if (materialStats.length > 6) {
      const otherPercentage = 100 - materialUsage.reduce((sum, m) => sum + m.percentage, 0);
      if (otherPercentage > 0) {
        materialUsage.push({
          material: "Other",
          area: 0,
          percentage: parseFloat(otherPercentage.toFixed(1)),
          color: "#9E9E9E",
        });
      }
    }

    // Recent cutlists
    const recentCutlistsData = await prisma.cutlist.findMany({
      where: orgFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { parts: true } },
      },
    });

    const recentCutlists: RecentCutlist[] = recentCutlistsData.map(c => ({
      id: c.id,
      name: c.name || "Untitled",
      parts: c._count.parts,
      status: c.status,
      date: c.createdAt.toISOString().split("T")[0],
    }));

    // Build stats
    const stats: ReportStats = {
      totalCutlists,
      totalParts,
      totalPieces,
      totalArea: parseFloat(totalArea.toFixed(1)),
      totalFilesUploaded,
      avgEfficiency: 0.78, // Would need optimization data
      avgPartsPerCutlist: totalCutlists > 0 ? Math.round(totalParts / totalCutlists) : 0,
      cutlistsThisPeriod: currentCutlists,
      partsThisPeriod: currentParts,
      filesThisPeriod: currentFiles,
      periodGrowth: {
        cutlists: parseFloat(cutlistsGrowth.toFixed(1)),
        parts: parseFloat(partsGrowth.toFixed(1)),
        area: parseFloat(partsGrowth.toFixed(1)), // Using parts growth as proxy
        efficiency: 2.3, // Would need real optimization comparison
        files: parseFloat(filesGrowth.toFixed(1)),
      },
    };

    return NextResponse.json({
      stats,
      monthlyData,
      materialUsage,
      recentCutlists,
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}

