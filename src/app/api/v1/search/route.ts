/**
 * CAI Intake - Global Search API
 * 
 * GET /api/v1/search - Search across cutlists, materials, and more
 * 
 * Provides unified search across multiple resource types.
 */

import { NextRequest } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sanitizeLikePattern, SIZE_LIMITS } from "@/lib/security";
import {
  successResponse,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api/response";

// =============================================================================
// SCHEMAS
// =============================================================================

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(), // Comma-separated: cutlists,materials,edgebands,parts
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string;
  type: "cutlist" | "material" | "edgeband" | "part";
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const serviceClient = getServiceClient();

    // Get user's organization
    const { data: userData } = await serviceClient
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return badRequest("User not associated with an organization");
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const parseResult = SearchQuerySchema.safeParse({
      q: searchParams.get("q"),
      types: searchParams.get("types"),
      limit: searchParams.get("limit"),
    });

    if (!parseResult.success) {
      return badRequest("Invalid search parameters", parseResult.error.issues);
    }

    const { q, types, limit } = parseResult.data;
    const sanitizedQuery = sanitizeLikePattern(q.slice(0, SIZE_LIMITS.SEARCH_QUERY));
    const searchTypes = types?.split(",") || ["cutlists", "materials", "edgebands"];
    
    const results: SearchResult[] = [];
    const perTypeLimit = Math.ceil(limit / searchTypes.length);

    // Search cutlists
    if (searchTypes.includes("cutlists")) {
      const { data: cutlists } = await serviceClient
        .from("cutlists")
        .select("id, name, description, job_ref, client_ref, status, created_at")
        .eq("organization_id", userData.organization_id)
        .or(`name.ilike.%${sanitizedQuery}%,job_ref.ilike.%${sanitizedQuery}%,client_ref.ilike.%${sanitizedQuery}%`)
        .limit(perTypeLimit);

      if (cutlists) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.push(...cutlists.map((c: any) => ({
          id: c.id,
          type: "cutlist" as const,
          title: c.name,
          subtitle: c.job_ref || c.client_ref || undefined,
          metadata: { status: c.status },
          created_at: c.created_at,
        })));
      }
    }

    // Search materials
    if (searchTypes.includes("materials")) {
      const { data: materials } = await serviceClient
        .from("materials")
        .select("id, material_id, name, thickness_mm, core_type, created_at")
        .eq("organization_id", userData.organization_id)
        .or(`name.ilike.%${sanitizedQuery}%,material_id.ilike.%${sanitizedQuery}%`)
        .limit(perTypeLimit);

      if (materials) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.push(...materials.map((m: any) => ({
          id: m.id,
          type: "material" as const,
          title: m.name,
          subtitle: `${m.material_id} - ${m.thickness_mm}mm`,
          metadata: { thickness_mm: m.thickness_mm, core_type: m.core_type },
          created_at: m.created_at,
        })));
      }
    }

    // Search edgebands
    if (searchTypes.includes("edgebands")) {
      const { data: edgebands } = await serviceClient
        .from("edgebands")
        .select("id, edgeband_id, name, thickness_mm, material, created_at")
        .eq("organization_id", userData.organization_id)
        .or(`name.ilike.%${sanitizedQuery}%,edgeband_id.ilike.%${sanitizedQuery}%`)
        .limit(perTypeLimit);

      if (edgebands) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.push(...edgebands.map((e: any) => ({
          id: e.id,
          type: "edgeband" as const,
          title: e.name,
          subtitle: `${e.edgeband_id} - ${e.thickness_mm}mm ${e.material || ""}`,
          metadata: { thickness_mm: e.thickness_mm, material: e.material },
          created_at: e.created_at,
        })));
      }
    }

    // Search parts (across all cutlists)
    if (searchTypes.includes("parts")) {
      const { data: parts } = await serviceClient
        .from("cut_parts")
        .select(`
          id, 
          part_id, 
          label, 
          size_l, 
          size_w, 
          material_ref,
          cutlist:cutlist_id(id, name, organization_id)
        `)
        .ilike("label", `%${sanitizedQuery}%`)
        .limit(perTypeLimit);

      if (parts) {
        // Filter by organization (parts don't have direct org_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filteredParts = parts.filter((p: any) => 
          (p.cutlist as { organization_id: string })?.organization_id === userData.organization_id
        );
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.push(...filteredParts.map((p: any) => ({
          id: p.id,
          type: "part" as const,
          title: p.label || p.part_id,
          subtitle: `${p.size_l}x${p.size_w}mm - ${(p.cutlist as { name: string })?.name || "Unknown cutlist"}`,
          metadata: { 
            size: { L: p.size_l, W: p.size_w },
            material_id: p.material_ref,
            cutlist_id: (p.cutlist as { id: string })?.id,
          },
        })));
      }
    }

    // Sort by relevance (exact matches first) and limit
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === q.toLowerCase();
      const bExact = b.title.toLowerCase() === q.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      const aStarts = a.title.toLowerCase().startsWith(q.toLowerCase());
      const bStarts = b.title.toLowerCase().startsWith(q.toLowerCase());
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return 0;
    });

    return successResponse({
      query: q,
      results: results.slice(0, limit),
      total: results.length,
      types: searchTypes,
    });
  } catch (error) {
    logger.error("Search error", error);
    return serverError();
  }
}

