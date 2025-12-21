/**
 * CAI Intake - Operations Library Parser Integration
 * 
 * Provides functions to match parsed operations with the organization's
 * operations library (hole patterns, groove profiles, routing profiles)
 */

import type {
  HolePattern,
  GrooveProfile,
  RoutingProfile,
  HolePatternKind,
} from './types';
import {
  fetchHolePatterns,
  fetchGrooveProfiles,
  fetchRoutingProfiles,
} from './service';

// ============================================================
// OPERATIONS LIBRARY CACHE
// ============================================================

interface OperationsLibraryCache {
  holePatterns: HolePattern[];
  grooveProfiles: GrooveProfile[];
  routingProfiles: RoutingProfile[];
  loadedAt: number;
}

// In-memory cache with 5-minute TTL
const CACHE_TTL_MS = 5 * 60 * 1000;
let operationsCache: OperationsLibraryCache | null = null;

/**
 * Load or get cached operations library
 */
export async function getOperationsLibrary(
  forceRefresh = false
): Promise<OperationsLibraryCache> {
  const now = Date.now();
  
  // Return cached if valid
  if (
    !forceRefresh &&
    operationsCache &&
    now - operationsCache.loadedAt < CACHE_TTL_MS
  ) {
    return operationsCache;
  }
  
  // Load from API
  const [holeResult, grooveResult, routingResult] = await Promise.all([
    fetchHolePatterns({ activeOnly: true, limit: 100 }),
    fetchGrooveProfiles({ activeOnly: true, limit: 100 }),
    fetchRoutingProfiles({ activeOnly: true, limit: 100 }),
  ]);
  
  operationsCache = {
    holePatterns: holeResult.patterns,
    grooveProfiles: grooveResult.profiles,
    routingProfiles: routingResult.profiles,
    loadedAt: now,
  };
  
  return operationsCache;
}

/**
 * Clear the operations library cache
 */
export function clearOperationsCache(): void {
  operationsCache = null;
}

// ============================================================
// HOLE PATTERN MATCHING
// ============================================================

/**
 * Find a hole pattern by code or name
 */
export function findHolePattern(
  library: OperationsLibraryCache,
  codeOrName: string
): HolePattern | null {
  const normalized = codeOrName.toUpperCase().trim();
  
  // First try exact pattern_id match
  let pattern = library.holePatterns.find(
    p => p.pattern_id.toUpperCase() === normalized
  );
  if (pattern) return pattern;
  
  // Try name match
  pattern = library.holePatterns.find(
    p => p.name.toUpperCase().includes(normalized) || 
         normalized.includes(p.name.toUpperCase())
  );
  if (pattern) return pattern;
  
  // Try kind-based inference from common codes
  const kindMatch = inferHolePatternKind(normalized);
  if (kindMatch) {
    pattern = library.holePatterns.find(p => p.kind === kindMatch);
    if (pattern) return pattern;
  }
  
  return null;
}

/**
 * Infer hole pattern kind from common codes
 */
function inferHolePatternKind(code: string): HolePatternKind | null {
  const upper = code.toUpperCase();
  
  // H2, H3, H4 = hinges
  if (/^H\d+/.test(upper)) return 'hinge';
  
  // SP, SHELF, 32 = shelf pins
  if (upper.includes('SP') || upper.includes('SHELF') || upper.includes('32')) {
    return 'shelf_pins';
  }
  
  // HD, HANDLE = handle
  if (upper.includes('HD') || upper.includes('HANDLE')) {
    return 'handle';
  }
  
  // KN, KNOB = knob
  if (upper.includes('KN') || upper.includes('KNOB')) {
    return 'knob';
  }
  
  // CAM = cam lock
  if (upper.includes('CAM')) return 'cam_lock';
  
  // SLIDE, DRAWER = drawer slide
  if (upper.includes('SLIDE') || upper.includes('DRAWER')) {
    return 'drawer_slide';
  }
  
  // DOWEL = dowel
  if (upper.includes('DOWEL')) return 'dowel';
  
  return null;
}

/**
 * Match hole info to library
 */
export async function matchHolePattern(
  codeOrName: string
): Promise<HolePattern | null> {
  const library = await getOperationsLibrary();
  return findHolePattern(library, codeOrName);
}

// ============================================================
// GROOVE PROFILE MATCHING
// ============================================================

/**
 * Find a groove profile by code, name, or dimensions
 */
export function findGrooveProfile(
  library: OperationsLibraryCache,
  input: string | { widthMm: number; depthMm: number }
): GrooveProfile | null {
  // If input is dimensions object, find by closest match
  if (typeof input === 'object') {
    const { widthMm, depthMm } = input;
    
    // Try exact match first
    let profile = library.grooveProfiles.find(
      p => p.width_mm === widthMm && p.depth_mm === depthMm
    );
    if (profile) return profile;
    
    // Find closest match within tolerance (0.5mm)
    profile = library.grooveProfiles.find(
      p => Math.abs(p.width_mm - widthMm) <= 0.5 && 
           Math.abs(p.depth_mm - depthMm) <= 0.5
    );
    if (profile) return profile;
    
    return null;
  }
  
  // String input - try code match
  const normalized = input.toUpperCase().trim();
  
  // Try exact profile_id match
  let profile = library.grooveProfiles.find(
    p => p.profile_id.toUpperCase() === normalized
  );
  if (profile) return profile;
  
  // Try name match
  profile = library.grooveProfiles.find(
    p => p.name.toUpperCase().includes(normalized) ||
         normalized.includes(p.name.toUpperCase())
  );
  if (profile) return profile;
  
  // Try purpose-based match
  if (normalized.includes('BACK')) {
    profile = library.grooveProfiles.find(p => p.purpose === 'back_panel');
    if (profile) return profile;
  }
  if (normalized.includes('DRAWER') || normalized.includes('BOTTOM')) {
    profile = library.grooveProfiles.find(p => p.purpose === 'drawer_bottom');
    if (profile) return profile;
  }
  if (normalized.includes('LIGHT') || normalized.includes('LED')) {
    profile = library.grooveProfiles.find(p => p.purpose === 'light_profile');
    if (profile) return profile;
  }
  if (normalized.includes('GLASS')) {
    profile = library.grooveProfiles.find(p => p.purpose === 'glass_panel');
    if (profile) return profile;
  }
  
  // Try extracting dimensions from code like "4x10" or "G4-10"
  const dimMatch = normalized.match(/(\d+)[x×\-](\d+)/);
  if (dimMatch) {
    const w = parseFloat(dimMatch[1]);
    const d = parseFloat(dimMatch[2]);
    return findGrooveProfile(library, { widthMm: w, depthMm: d });
  }
  
  return null;
}

/**
 * Match groove info to library
 */
export async function matchGrooveProfile(
  input: string | { widthMm: number; depthMm: number }
): Promise<GrooveProfile | null> {
  const library = await getOperationsLibrary();
  return findGrooveProfile(library, input);
}

// ============================================================
// ROUTING PROFILE MATCHING
// ============================================================

/**
 * Find a routing profile by code or name
 */
export function findRoutingProfile(
  library: OperationsLibraryCache,
  codeOrName: string
): RoutingProfile | null {
  const normalized = codeOrName.toUpperCase().trim();
  
  // Try exact profile_id match
  let profile = library.routingProfiles.find(
    p => p.profile_id.toUpperCase() === normalized
  );
  if (profile) return profile;
  
  // Try name match
  profile = library.routingProfiles.find(
    p => p.name.toUpperCase().includes(normalized) ||
         normalized.includes(p.name.toUpperCase())
  );
  if (profile) return profile;
  
  // Try type-based inference
  if (normalized.includes('CUTOUT') || normalized.includes('SINK') || normalized.includes('HOB')) {
    profile = library.routingProfiles.find(p => p.profile_type === 'cutout');
    if (profile) return profile;
  }
  
  if (normalized.includes('RADIUS') || normalized.includes('ROUND')) {
    profile = library.routingProfiles.find(p => p.profile_type === 'radius');
    if (profile) return profile;
  }
  
  if (normalized.includes('POCKET')) {
    profile = library.routingProfiles.find(p => p.profile_type === 'pocket');
    if (profile) return profile;
  }
  
  if (normalized.includes('CHAMFER')) {
    profile = library.routingProfiles.find(p => p.profile_type === 'chamfer');
    if (profile) return profile;
  }
  
  if (normalized.includes('REBATE')) {
    profile = library.routingProfiles.find(p => p.profile_type === 'rebate');
    if (profile) return profile;
  }
  
  return null;
}

/**
 * Match routing/CNC info to library
 */
export async function matchRoutingProfile(
  codeOrName: string
): Promise<RoutingProfile | null> {
  const library = await getOperationsLibrary();
  return findRoutingProfile(library, codeOrName);
}

// ============================================================
// ENHANCED PARSING WITH LIBRARY MATCHING
// ============================================================

export interface EnhancedOperationsResult {
  holes?: {
    pattern: HolePattern;
    matched: boolean;
  };
  grooves?: {
    profile: GrooveProfile;
    matched: boolean;
  }[];
  routing?: {
    profile: RoutingProfile;
    matched: boolean;
  }[];
}

/**
 * Parse and match operations text against the library
 * Returns both parsed operations and matched library items
 */
export async function parseAndMatchOperations(
  text: string
): Promise<EnhancedOperationsResult> {
  const library = await getOperationsLibrary();
  const result: EnhancedOperationsResult = {};
  
  // Normalize text
  const normalized = text.toUpperCase().trim();
  
  // Try to extract and match holes
  const holePatterns = [
    /H(\d)[-@](\d+)/i,  // H2-110, H3@100
    /SP[-\s]?(\w+)/i,   // SP-32, SP ALL
    /HD[-\s]?CC(\d+)/i, // HD-CC96
    /HINGE/i,
    /SHELF/i,
    /HANDLE/i,
    /CAM/i,
  ];
  
  for (const regex of holePatterns) {
    const match = normalized.match(regex);
    if (match) {
      const holePattern = findHolePattern(library, match[0]);
      if (holePattern) {
        result.holes = { pattern: holePattern, matched: true };
        break;
      }
    }
  }
  
  // Try to extract and match grooves
  const groovePatterns = [
    /G[LW]?\d?[-@]?(\d+)[-x×](\d+)/i,  // GL-4-10, G4x10
    /GROOVE/i,
    /BACK\s*PANEL/i,
    /DRAWER\s*BOTTOM/i,
  ];
  
  const matchedGrooves: { profile: GrooveProfile; matched: boolean }[] = [];
  for (const regex of groovePatterns) {
    const match = normalized.match(regex);
    if (match) {
      const grooveProfile = findGrooveProfile(library, match[0]);
      if (grooveProfile && !matchedGrooves.some(g => g.profile.profile_id === grooveProfile.profile_id)) {
        matchedGrooves.push({ profile: grooveProfile, matched: true });
      }
    }
  }
  if (matchedGrooves.length > 0) {
    result.grooves = matchedGrooves;
  }
  
  // Try to extract and match CNC/routing
  const routingPatterns = [
    /CUTOUT[-\s]?(SINK|HOB|VENT)?/i,
    /RADIUS[-\s]?(\d+)/i,
    /POCKET/i,
    /CHAMFER/i,
    /REBATE/i,
    /CNC[-:\s]?(\w+)/i,
  ];
  
  const matchedRouting: { profile: RoutingProfile; matched: boolean }[] = [];
  for (const regex of routingPatterns) {
    const match = normalized.match(regex);
    if (match) {
      const routingProfile = findRoutingProfile(library, match[0]);
      if (routingProfile && !matchedRouting.some(r => r.profile.profile_id === routingProfile.profile_id)) {
        matchedRouting.push({ profile: routingProfile, matched: true });
      }
    }
  }
  if (matchedRouting.length > 0) {
    result.routing = matchedRouting;
  }
  
  return result;
}

// ============================================================
// PART OPERATIONS CONVERSION
// ============================================================

/**
 * Convert matched library items to PartOps format
 */
export function convertToPartOps(
  matched: EnhancedOperationsResult
): Record<string, unknown> {
  const ops: Record<string, unknown> = {};
  
  // Convert holes
  if (matched.holes) {
    const hp = matched.holes.pattern;
    ops.holes = [{
      pattern_id: hp.pattern_id,
      holes: hp.holes,
      face: 'front',
      notes: hp.name,
    }];
  }
  
  // Convert grooves
  if (matched.grooves && matched.grooves.length > 0) {
    ops.grooves = matched.grooves.map(g => ({
      groove_id: g.profile.profile_id,
      profile_id: g.profile.profile_id,
      side: 'W2', // Default to back
      distance_mm: g.profile.default_offset_mm,
      depth_mm: g.profile.depth_mm,
      width_mm: g.profile.width_mm,
      offset_mm: g.profile.default_offset_mm,
    }));
  }
  
  // Convert routing/CNC
  if (matched.routing && matched.routing.length > 0) {
    ops.custom_cnc_ops = matched.routing.map(r => ({
      op_type: r.profile.profile_type,
      payload: r.profile.specifications,
      notes: r.profile.name,
    }));
  }
  
  return ops;
}
