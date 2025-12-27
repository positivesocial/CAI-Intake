/**
 * Template Shortcodes API
 * GET /api/v1/template-shortcodes - Fetch org's shortcodes for template generation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { OpsShortcode } from "@/lib/templates/org-template-generator";

/**
 * Fetch organization's operations from the database and convert to shortcodes
 */
async function fetchOrgShortcodes(organizationId: string): Promise<OpsShortcode[]> {
  const shortcodes: OpsShortcode[] = [];
  
  try {
    // Fetch edgeband operations
    const edgebandOps = await prisma.edgebandOperation.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null }, // System defaults
          { organizationId: organizationId },
        ],
      },
      orderBy: [{ usageCount: "desc" }, { code: "asc" }],
    });
    
    edgebandOps.forEach(op => {
      shortcodes.push({
        id: op.id,
        code: op.code,
        name: op.name,
        description: op.description || undefined,
        category: "edgebanding",
      });
    });
    
    // Fetch groove operations
    const grooveOps = await prisma.grooveOperation.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { organizationId: organizationId },
        ],
      },
      orderBy: [{ usageCount: "desc" }, { code: "asc" }],
    });
    
    grooveOps.forEach(op => {
      shortcodes.push({
        id: op.id,
        code: op.code,
        name: op.name,
        description: op.description || undefined,
        category: "grooving",
      });
    });
    
    // Fetch drilling operations
    const drillingOps = await prisma.drillingOperation.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { organizationId: organizationId },
        ],
      },
      orderBy: [{ usageCount: "desc" }, { code: "asc" }],
    });
    
    drillingOps.forEach(op => {
      shortcodes.push({
        id: op.id,
        code: op.code,
        name: op.name,
        description: op.description || undefined,
        category: "drilling",
      });
    });
    
    // Fetch CNC operations
    const cncOps = await prisma.cncOperation.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { organizationId: organizationId },
        ],
      },
      orderBy: [{ usageCount: "desc" }, { code: "asc" }],
    });
    
    cncOps.forEach(op => {
      shortcodes.push({
        id: op.id,
        code: op.code,
        name: op.name,
        description: op.description || undefined,
        category: "cnc",
      });
    });
    
  } catch (error) {
    console.error("Error fetching org shortcodes:", error);
  }
  
  return shortcodes;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      // Return empty shortcodes - template will use defaults
      return NextResponse.json({ shortcodes: [] });
    }

    // Fetch shortcodes from the operations tables
    const shortcodes = await fetchOrgShortcodes(userData.organization_id);

    return NextResponse.json({ shortcodes });
  } catch (error) {
    console.error("Error fetching template shortcodes:", error);
    return NextResponse.json(
      { error: "Failed to fetch shortcodes" },
      { status: 500 }
    );
  }
}

