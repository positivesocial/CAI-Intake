/**
 * CAI Intake - Organization-Specific Shortcode Configuration
 * 
 * Manages org-specific shortcode overrides with system defaults fallback.
 * Allows organizations to customize shortcode behavior and create aliases.
 */

import { createClient } from "@/lib/supabase/server";
import {
  parseShortcode,
  parseEdgeCode,
  parseGrooveCode,
  parseHoleCode,
  parseCncCode,
  EDGE_CODES,
  GROOVE_PRESETS,
  HOLE_PRESETS,
  CNC_PRESETS,
  type ParsedShortcode,
  type ShortcodeOverrides,
} from "@/lib/services/canonical-shortcodes";
import type { EdgeSide, HolePatternKind, CncOpType } from "@/lib/services/canonical-types";

// ============================================================
// TYPES
// ============================================================

/** Service type for shortcode categorization */
export type ShortcodeServiceType = "edgeband" | "groove" | "hole" | "cnc" | "material" | "custom";

/** Organization shortcode configuration */
export interface OrgShortcodeConfig {
  id: string;
  org_id: string;
  service_type: ShortcodeServiceType;
  shortcode: string;
  display_name?: string;
  description?: string;
  /** Default specs that get applied when shortcode is used */
  default_specs: Record<string, number | string | boolean>;
  /** Whether this shortcode is active */
  is_active: boolean;
  /** Priority for conflict resolution (higher = preferred) */
  priority?: number;
  created_at: string;
  updated_at: string;
}

/** Resolved shortcode with org-specific configuration */
export interface ResolvedShortcode {
  /** Original input */
  input: string;
  /** Base code */
  baseCode: string;
  /** Service type */
  serviceType: ShortcodeServiceType;
  /** Whether org-specific config was found */
  isOrgSpecific: boolean;
  /** Display name (org-specific or generated) */
  displayName: string;
  /** Resolved specs (org defaults + overrides) */
  specs: Record<string, number | string | boolean>;
  /** The org config if found */
  orgConfig?: OrgShortcodeConfig;
}

// ============================================================
// SYSTEM DEFAULTS
// ============================================================

/** 
 * System-wide default shortcode specs
 * These are used when no org-specific config exists
 */
export const SYSTEM_DEFAULTS: Record<ShortcodeServiceType, Record<string, Record<string, number | string | boolean>>> = {
  edgeband: Object.fromEntries(
    Object.entries(EDGE_CODES).map(([code, edges]) => [
      code,
      { edges: edges.join(","), thickness_mm: 0.5 },
    ])
  ),
  groove: Object.fromEntries(
    Object.entries(GROOVE_PRESETS).map(([code, spec]) => [
      code,
      { edges: spec.edges.join(","), width_mm: spec.widthMm, offset_mm: spec.offsetMm },
    ])
  ),
  hole: Object.fromEntries(
    Object.entries(HOLE_PRESETS).map(([code, spec]) => [
      code,
      { kind: spec.kind, count: spec.count ?? 1, offset_mm: spec.offsetMm ?? 0 },
    ])
  ),
  cnc: Object.fromEntries(
    Object.entries(CNC_PRESETS).map(([code, spec]) => [
      code,
      { type: spec.type, shape_id: spec.shapeId, ...spec.params },
    ])
  ),
  material: {},
  custom: {},
};

// ============================================================
// CACHE
// ============================================================

/** Cache for org shortcode configs */
const configCache = new Map<string, { configs: OrgShortcodeConfig[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached org configs or fetch from database
 */
async function getOrgConfigs(orgId: string): Promise<OrgShortcodeConfig[]> {
  const cached = configCache.get(orgId);
  if (cached && Date.now() < cached.expiry) {
    return cached.configs;
  }
  
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shortcode_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    
    if (error) {
      console.warn("[OrgShortcodes] Failed to fetch configs:", error);
      return [];
    }
    
    const configs = data ?? [];
    configCache.set(orgId, { configs, expiry: Date.now() + CACHE_TTL_MS });
    return configs;
  } catch {
    return [];
  }
}

/**
 * Invalidate cache for an org
 */
export function invalidateOrgCache(orgId: string): void {
  configCache.delete(orgId);
}

// ============================================================
// RESOLUTION
// ============================================================

/**
 * Resolve a shortcode using org-specific config with system fallback
 */
export async function resolveShortcode(
  input: string,
  orgId: string
): Promise<ResolvedShortcode> {
  const parsed = parseShortcode(input);
  const baseCode = parsed.baseCode;
  
  // Determine service type from code pattern
  const serviceType = detectServiceType(baseCode);
  
  // Try to find org-specific config
  const orgConfigs = await getOrgConfigs(orgId);
  const orgConfig = orgConfigs.find(c => 
    c.shortcode.toUpperCase() === baseCode && 
    c.service_type === serviceType
  );
  
  if (orgConfig) {
    // Merge org defaults with any overrides from the input
    const specs = { ...orgConfig.default_specs };
    applyOverrides(specs, parsed.overrides);
    
    return {
      input,
      baseCode,
      serviceType,
      isOrgSpecific: true,
      displayName: orgConfig.display_name ?? baseCode,
      specs,
      orgConfig,
    };
  }
  
  // Fall back to system defaults
  const systemDefaults = SYSTEM_DEFAULTS[serviceType]?.[baseCode] ?? {};
  const specs = { ...systemDefaults };
  applyOverrides(specs, parsed.overrides);
  
  return {
    input,
    baseCode,
    serviceType,
    isOrgSpecific: false,
    displayName: generateDisplayName(baseCode, serviceType),
    specs,
  };
}

/**
 * Detect service type from shortcode pattern
 */
function detectServiceType(code: string): ShortcodeServiceType {
  const upper = code.toUpperCase();
  
  // Edge codes
  if (EDGE_CODES[upper as keyof typeof EDGE_CODES] !== undefined) {
    return "edgeband";
  }
  
  // Groove codes
  if (upper.startsWith("G") && (upper.includes("-") || /^G[LW]/.test(upper))) {
    return "groove";
  }
  if (GROOVE_PRESETS[upper as keyof typeof GROOVE_PRESETS]) {
    return "groove";
  }
  
  // Hole codes
  if (/^H\d/.test(upper) || upper.startsWith("SP-") || upper.startsWith("HD-") || upper.startsWith("KN-")) {
    return "hole";
  }
  if (HOLE_PRESETS[upper as keyof typeof HOLE_PRESETS]) {
    return "hole";
  }
  
  // CNC codes
  if (upper.startsWith("CUTOUT-") || upper.startsWith("RADIUS-") || upper.startsWith("POCKET-") || upper.startsWith("PROFILE-")) {
    return "cnc";
  }
  if (CNC_PRESETS[upper as keyof typeof CNC_PRESETS]) {
    return "cnc";
  }
  
  return "custom";
}

/**
 * Apply overrides to specs
 */
function applyOverrides(specs: Record<string, number | string | boolean>, overrides: ShortcodeOverrides): void {
  if (overrides.depth !== undefined) specs.depth_mm = overrides.depth;
  if (overrides.width !== undefined) specs.width_mm = overrides.width;
  if (overrides.offset !== undefined) specs.offset_mm = overrides.offset;
  if (overrides.diameter !== undefined) specs.diameter_mm = overrides.diameter;
  if (overrides.count !== undefined) specs.count = overrides.count;
  if (overrides.centers !== undefined) specs.centers_mm = overrides.centers;
  if (overrides.value !== undefined) specs.value = overrides.value;
}

/**
 * Generate display name from code
 */
function generateDisplayName(code: string, serviceType: ShortcodeServiceType): string {
  switch (serviceType) {
    case "edgeband":
      return `Edge: ${code}`;
    case "groove":
      return `Groove: ${code}`;
    case "hole":
      return `Holes: ${code}`;
    case "cnc":
      return `CNC: ${code}`;
    default:
      return code;
  }
}

// ============================================================
// MANAGEMENT API
// ============================================================

/**
 * Create or update an org shortcode config
 */
export async function upsertOrgShortcode(
  config: Omit<OrgShortcodeConfig, "id" | "created_at" | "updated_at">
): Promise<OrgShortcodeConfig | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("shortcode_configs")
      .upsert({
        ...config,
        shortcode: config.shortcode.toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error("[OrgShortcodes] Upsert failed:", error);
      return null;
    }
    
    // Invalidate cache
    invalidateOrgCache(config.org_id);
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Delete an org shortcode config
 */
export async function deleteOrgShortcode(configId: string, orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from("shortcode_configs")
      .delete()
      .eq("id", configId)
      .eq("org_id", orgId);
    
    if (error) {
      console.error("[OrgShortcodes] Delete failed:", error);
      return false;
    }
    
    invalidateOrgCache(orgId);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all shortcode configs for an org
 */
export async function listOrgShortcodes(
  orgId: string,
  serviceType?: ShortcodeServiceType
): Promise<OrgShortcodeConfig[]> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("shortcode_configs")
      .select("*")
      .eq("org_id", orgId)
      .order("service_type")
      .order("shortcode");
    
    if (serviceType) {
      query = query.eq("service_type", serviceType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[OrgShortcodes] List failed:", error);
      return [];
    }
    
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Get all available shortcodes for an org (system + custom)
 */
export async function getAllAvailableShortcodes(
  orgId: string,
  serviceType?: ShortcodeServiceType
): Promise<Array<{ code: string; displayName: string; isOrgSpecific: boolean; serviceType: ShortcodeServiceType }>> {
  const results: Array<{ code: string; displayName: string; isOrgSpecific: boolean; serviceType: ShortcodeServiceType }> = [];
  
  // Get org-specific configs
  const orgConfigs = await listOrgShortcodes(orgId, serviceType);
  
  for (const config of orgConfigs) {
    results.push({
      code: config.shortcode,
      displayName: config.display_name ?? config.shortcode,
      isOrgSpecific: true,
      serviceType: config.service_type,
    });
  }
  
  // Add system defaults (if not overridden)
  const orgCodes = new Set(orgConfigs.map(c => `${c.service_type}:${c.shortcode}`));
  
  const serviceTypes: ShortcodeServiceType[] = serviceType 
    ? [serviceType] 
    : ["edgeband", "groove", "hole", "cnc"];
  
  for (const st of serviceTypes) {
    const defaults = SYSTEM_DEFAULTS[st];
    for (const code of Object.keys(defaults)) {
      const key = `${st}:${code}`;
      if (!orgCodes.has(key)) {
        results.push({
          code,
          displayName: generateDisplayName(code, st),
          isOrgSpecific: false,
          serviceType: st,
        });
      }
    }
  }
  
  return results.sort((a, b) => a.code.localeCompare(b.code));
}


