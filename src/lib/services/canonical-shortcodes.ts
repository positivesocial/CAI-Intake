/**
 * CAI Intake - Canonical Shortcode Dialect
 * 
 * These are the OFFICIAL CabinetAI shortcodes used for:
 * - Template input fields
 * - Manual entry quick-add
 * - Display in UI
 * - Export formats
 * 
 * External formats (customer cutlists) get translated to these codes
 * via the normalization layer.
 */

import type { 
  EdgeSide, 
  HolePatternKind, 
  CncOpType,
  GrooveSpec,
  HolePatternSpec,
  CncOperation,
} from "./canonical-types";

// ============================================================
// OVERRIDE SYNTAX TYPES
// ============================================================

/**
 * Parsed shortcode with optional overrides
 * 
 * Override syntax: CODE@[overrides]
 * 
 * Examples:
 * - GL@10       → GL edgebanding with 10mm override (thickness)
 * - GL@d10      → GL with depth=10mm override
 * - GL@d10w4    → GL with depth=10mm and width=4mm overrides
 * - H2-100@d8   → H2-100 hinges with diameter=8mm override
 * - SP-32@c5    → SP-32 shelf pins with count=5 override
 */
export interface ParsedShortcode {
  /** Original raw input */
  raw: string;
  /** Base code without overrides */
  baseCode: string;
  /** Parsed overrides */
  overrides: ShortcodeOverrides;
  /** Whether overrides were present */
  hasOverrides: boolean;
}

/**
 * Possible override values
 */
export interface ShortcodeOverrides {
  /** Depth/thickness override (d) */
  depth?: number;
  /** Width override (w) */
  width?: number;
  /** Offset/distance override (o) */
  offset?: number;
  /** Diameter override (dia) */
  diameter?: number;
  /** Count override (c) */
  count?: number;
  /** Center-to-center distance (cc) */
  centers?: number;
  /** Generic numeric override (bare number) */
  value?: number;
  /** Additional named parameters */
  [key: string]: number | undefined;
}

// ============================================================
// OVERRIDE PARSING
// ============================================================

/**
 * Parse shortcode with override syntax
 * 
 * @param input - Raw shortcode input like "GL@10" or "H2-100@d8w4"
 * @returns Parsed shortcode with base code and overrides
 */
export function parseShortcode(input: string): ParsedShortcode {
  const raw = input.trim();
  
  // Check for @ override syntax
  const atIndex = raw.indexOf("@");
  
  if (atIndex === -1) {
    // No overrides
    return {
      raw,
      baseCode: raw.toUpperCase(),
      overrides: {},
      hasOverrides: false,
    };
  }
  
  const baseCode = raw.slice(0, atIndex).trim().toUpperCase();
  const overrideStr = raw.slice(atIndex + 1).trim().toLowerCase();
  const overrides = parseOverrideString(overrideStr);
  
  return {
    raw,
    baseCode,
    overrides,
    hasOverrides: Object.keys(overrides).length > 0,
  };
}

/**
 * Parse the override string after the @
 * 
 * Supported formats:
 * - "10"        → { value: 10 }
 * - "d10"       → { depth: 10 }
 * - "d10w4"     → { depth: 10, width: 4 }
 * - "dia8"      → { diameter: 8 }
 * - "cc128"     → { centers: 128 }
 * - "c5"        → { count: 5 }
 * - "o15"       → { offset: 15 }
 */
function parseOverrideString(str: string): ShortcodeOverrides {
  const overrides: ShortcodeOverrides = {};
  
  if (!str) return overrides;
  
  // Try bare number first
  const bareNumber = parseFloat(str);
  if (!isNaN(bareNumber) && /^\d+(\.\d+)?$/.test(str)) {
    overrides.value = bareNumber;
    return overrides;
  }
  
  // Parse named overrides: d10w4cc128
  const pattern = /([a-z]+)(\d+(?:\.\d+)?)/g;
  let match;
  
  while ((match = pattern.exec(str)) !== null) {
    const [, prefix, numStr] = match;
    const num = parseFloat(numStr);
    
    if (isNaN(num)) continue;
    
    switch (prefix) {
      case "d":
      case "depth":
        overrides.depth = num;
        break;
      case "w":
      case "width":
        overrides.width = num;
        break;
      case "o":
      case "off":
      case "offset":
        overrides.offset = num;
        break;
      case "dia":
      case "diameter":
        overrides.diameter = num;
        break;
      case "c":
      case "cnt":
      case "count":
        overrides.count = Math.round(num);
        break;
      case "cc":
      case "ctr":
      case "centers":
        overrides.centers = num;
        break;
      case "t":
      case "thk":
      case "thickness":
        overrides.depth = num; // Thickness is same as depth for edgebanding
        break;
      case "r":
      case "radius":
        overrides[prefix] = num;
        break;
      default:
        // Store unknown prefixes as-is
        overrides[prefix] = num;
    }
  }
  
  return overrides;
}

/**
 * Apply overrides to parsed groove code
 */
export function applyGrooveOverrides(
  parsed: ParsedGrooveCode,
  overrides: ShortcodeOverrides
): ParsedGrooveCode {
  return {
    ...parsed,
    widthMm: overrides.width ?? overrides.value ?? parsed.widthMm,
    offsetMm: overrides.offset ?? parsed.offsetMm,
  };
}

/**
 * Apply overrides to parsed hole code
 */
export function applyHoleOverrides(
  parsed: ParsedHoleCode,
  overrides: ShortcodeOverrides
): ParsedHoleCode {
  return {
    ...parsed,
    count: overrides.count ?? parsed.count,
    offsetMm: overrides.offset ?? overrides.value ?? parsed.offsetMm,
    centersMm: overrides.centers ?? parsed.centersMm,
  };
}

/**
 * Generate shortcode string with overrides
 */
export function shortcodeWithOverrides(baseCode: string, overrides: ShortcodeOverrides): string {
  if (Object.keys(overrides).length === 0) {
    return baseCode;
  }
  
  const parts: string[] = [];
  
  // Handle bare value specially
  if (overrides.value !== undefined && Object.keys(overrides).length === 1) {
    return `${baseCode}@${overrides.value}`;
  }
  
  // Build override string
  if (overrides.depth !== undefined) parts.push(`d${overrides.depth}`);
  if (overrides.width !== undefined) parts.push(`w${overrides.width}`);
  if (overrides.offset !== undefined) parts.push(`o${overrides.offset}`);
  if (overrides.diameter !== undefined) parts.push(`dia${overrides.diameter}`);
  if (overrides.count !== undefined) parts.push(`c${overrides.count}`);
  if (overrides.centers !== undefined) parts.push(`cc${overrides.centers}`);
  
  // Add any remaining unknown overrides
  for (const [key, val] of Object.entries(overrides)) {
    if (!["depth", "width", "offset", "diameter", "count", "centers", "value"].includes(key)) {
      if (val !== undefined) {
        parts.push(`${key}${val}`);
      }
    }
  }
  
  return parts.length > 0 ? `${baseCode}@${parts.join("")}` : baseCode;
}

/**
 * Parse and apply edgebanding with thickness override
 * 
 * @example
 * parseEdgeWithOverride("2L2W@10") → { edges: ["L1", "L2", "W1", "W2"], thickness: 10 }
 */
export function parseEdgeWithOverride(input: string): {
  edges: EdgeSide[];
  thickness?: number;
} {
  const parsed = parseShortcode(input);
  const edges = parseEdgeCode(parsed.baseCode);
  
  return {
    edges,
    thickness: parsed.overrides.depth ?? parsed.overrides.value,
  };
}

/**
 * Parse groove with overrides
 * 
 * @example
 * parseGrooveWithOverride("GL-4-10@d6") → { edges, widthMm: 4, offsetMm: 10, depth: 6 }
 */
export function parseGrooveWithOverride(input: string): ParsedGrooveCode & { depthMm?: number } | null {
  const parsed = parseShortcode(input);
  const groove = parseGrooveCode(parsed.baseCode);
  
  if (!groove) return null;
  
  const withOverrides = applyGrooveOverrides(groove, parsed.overrides);
  
  return {
    ...withOverrides,
    depthMm: parsed.overrides.depth,
  };
}

/**
 * Parse hole pattern with overrides
 * 
 * @example
 * parseHoleWithOverride("H2-100@dia35") → { kind: "hinge", count: 2, offsetMm: 100, diameter: 35 }
 */
export function parseHoleWithOverride(input: string): ParsedHoleCode & { diameterMm?: number } | null {
  const parsed = parseShortcode(input);
  const hole = parseHoleCode(parsed.baseCode);
  
  if (!hole) return null;
  
  const withOverrides = applyHoleOverrides(hole, parsed.overrides);
  
  return {
    ...withOverrides,
    diameterMm: parsed.overrides.diameter,
  };
}

// ============================================================
// EDGEBANDING SHORTCODES
// ============================================================

/**
 * Canonical edge banding codes
 * 
 * Format: [count][edge-type]
 * - L = Long edge(s)
 * - W = Width edge(s)
 * - 2L = Both long edges
 * - 2W = Both width edges
 * 
 * Combinations: 2L2W (all), L2W (1 long + 2 width), etc.
 */
export const EDGE_CODES = {
  // No banding
  "0": [] as EdgeSide[],
  "-": [] as EdgeSide[],
  "NONE": [] as EdgeSide[],
  
  // Single edges
  "L": ["L1"] as EdgeSide[],
  "L1": ["L1"] as EdgeSide[],
  "L2": ["L2"] as EdgeSide[],
  "W": ["W1"] as EdgeSide[],
  "W1": ["W1"] as EdgeSide[],
  "W2": ["W2"] as EdgeSide[],
  
  // Both of one dimension
  "2L": ["L1", "L2"] as EdgeSide[],
  "2W": ["W1", "W2"] as EdgeSide[],
  
  // Three edges
  "L2W": ["L1", "W1", "W2"] as EdgeSide[],       // 1 long + 2 width
  "2L1W": ["L1", "L2", "W1"] as EdgeSide[],      // 2 long + 1 width
  "2LW": ["L1", "L2", "W1"] as EdgeSide[],       // Alias for 2L1W
  "L2W1": ["L1", "W1", "W2"] as EdgeSide[],      // Alias for L2W
  
  // All four edges
  "2L2W": ["L1", "L2", "W1", "W2"] as EdgeSide[],
  "ALL": ["L1", "L2", "W1", "W2"] as EdgeSide[],
  "4": ["L1", "L2", "W1", "W2"] as EdgeSide[],
  "4S": ["L1", "L2", "W1", "W2"] as EdgeSide[],  // 4 sides
} as const;

/**
 * Reverse lookup: edges array to canonical code
 */
export function edgesToCode(edges: EdgeSide[]): string {
  const sorted = [...edges].sort();
  const key = sorted.join(",");
  
  const mapping: Record<string, string> = {
    "": "0",
    "L1": "L1",
    "L2": "L2",
    "W1": "W1",
    "W2": "W2",
    "L1,L2": "2L",
    "W1,W2": "2W",
    "L1,W1,W2": "L2W",
    "L1,L2,W1": "2L1W",
    "L1,L2,W1,W2": "2L2W",
  };
  
  return mapping[key] ?? edges.join("+");
}

/**
 * Parse edge code to EdgeSide array
 */
export function parseEdgeCode(code: string): EdgeSide[] {
  const normalized = code.trim().toUpperCase();
  const edges = EDGE_CODES[normalized as keyof typeof EDGE_CODES];
  return edges ? [...edges] : [];
}

// ============================================================
// GROOVE SHORTCODES
// ============================================================

/**
 * Groove code format: G[edge]-[width]-[offset]
 * 
 * Examples:
 * - G-ALL-4-12  → Groove all edges, 4mm wide, 12mm from edge
 * - GL-4-12    → Groove along long edges
 * - GW-4-10    → Groove along width edges
 * - GL1-4-10   → Groove along L1 only
 */

export interface ParsedGrooveCode {
  edges: EdgeSide[];
  widthMm: number;
  offsetMm: number;
}

/**
 * Predefined groove codes for common operations
 */
export const GROOVE_PRESETS = {
  // Back panel grooves (all edges)
  "G-ALL-4-12": { edges: ["L1", "L2", "W1", "W2"] as EdgeSide[], widthMm: 4, offsetMm: 12 },
  "G-ALL-4-10": { edges: ["L1", "L2", "W1", "W2"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  "G-ALL-3-10": { edges: ["L1", "L2", "W1", "W2"] as EdgeSide[], widthMm: 3, offsetMm: 10 },
  
  // Long edge grooves
  "GL-4-12": { edges: ["L1", "L2"] as EdgeSide[], widthMm: 4, offsetMm: 12 },
  "GL-4-10": { edges: ["L1", "L2"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  
  // Width edge grooves
  "GW-4-12": { edges: ["W1", "W2"] as EdgeSide[], widthMm: 4, offsetMm: 12 },
  "GW-4-10": { edges: ["W1", "W2"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  
  // Single edge grooves
  "GL1-4-10": { edges: ["L1"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  "GL2-4-10": { edges: ["L2"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  "GW1-4-10": { edges: ["W1"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
  "GW2-4-10": { edges: ["W2"] as EdgeSide[], widthMm: 4, offsetMm: 10 },
} as const;

/**
 * Parse groove shortcode
 */
export function parseGrooveCode(code: string): ParsedGrooveCode | null {
  const normalized = code.trim().toUpperCase();
  
  // Check presets first
  const preset = GROOVE_PRESETS[normalized as keyof typeof GROOVE_PRESETS];
  if (preset) {
    return { ...preset, edges: [...preset.edges] };
  }
  
  // Parse dynamic format: G[edge]-[width]-[offset]
  const match = normalized.match(/^G([A-Z0-9]*)-(\d+)-(\d+)$/);
  if (!match) return null;
  
  const [, edgePart, widthStr, offsetStr] = match;
  const widthMm = parseInt(widthStr, 10);
  const offsetMm = parseInt(offsetStr, 10);
  
  let edges: EdgeSide[];
  switch (edgePart) {
    case "":
    case "ALL":
      edges = ["L1", "L2", "W1", "W2"];
      break;
    case "L":
      edges = ["L1", "L2"];
      break;
    case "W":
      edges = ["W1", "W2"];
      break;
    case "L1":
      edges = ["L1"];
      break;
    case "L2":
      edges = ["L2"];
      break;
    case "W1":
      edges = ["W1"];
      break;
    case "W2":
      edges = ["W2"];
      break;
    default:
      return null;
  }
  
  return { edges, widthMm, offsetMm };
}

/**
 * Generate groove code from spec
 */
export function grooveToCode(spec: GrooveSpec): string {
  const sorted = [spec.onEdge].sort();
  let edgePart: string;
  
  if (sorted.length === 4) {
    edgePart = "-ALL";
  } else if (sorted.length === 2 && sorted[0].startsWith("L") && sorted[1].startsWith("L")) {
    edgePart = "L";
  } else if (sorted.length === 2 && sorted[0].startsWith("W") && sorted[1].startsWith("W")) {
    edgePart = "W";
  } else {
    edgePart = spec.onEdge;
  }
  
  return `G${edgePart}-${spec.widthMm}-${spec.distanceFromEdgeMm}`;
}

// ============================================================
// HOLE PATTERN SHORTCODES
// ============================================================

/**
 * Hole pattern code formats:
 * 
 * Hinges:
 * - H2-110  → 2 hinges, 110mm from top/bottom
 * - H3-90   → 3 hinges, 90mm from top/bottom
 * 
 * Shelf pins:
 * - SP-ALL  → Full column of shelf pins
 * - SP-32   → System 32 shelf pins
 * 
 * Handles:
 * - HD-CC96   → Handle with 96mm center-to-center
 * - HD-CC128  → Handle with 128mm center-to-center
 * 
 * Knobs:
 * - KN-CTR    → Knob centered
 * - KN-37     → Knob 37mm from edge
 */

export interface ParsedHoleCode {
  kind: HolePatternKind;
  count?: number;
  offsetMm?: number;
  centersMm?: number;
  position?: "center" | "custom";
  pattern?: string;
}

/**
 * Predefined hole pattern codes
 */
export const HOLE_PRESETS: Record<string, ParsedHoleCode> = {
  // Hinge patterns
  "H2-110": { kind: "hinge", count: 2, offsetMm: 110 },
  "H2-100": { kind: "hinge", count: 2, offsetMm: 100 },
  "H3-90": { kind: "hinge", count: 3, offsetMm: 90 },
  "H3-100": { kind: "hinge", count: 3, offsetMm: 100 },
  "H4-80": { kind: "hinge", count: 4, offsetMm: 80 },
  
  // Shelf pin patterns
  "SP-ALL": { kind: "shelf_pins", pattern: "full_column" },
  "SP-32": { kind: "system32", pattern: "32mm_system" },
  "SP-HALF": { kind: "shelf_pins", pattern: "half_column" },
  
  // Handle patterns
  "HD-CC96": { kind: "handle", centersMm: 96 },
  "HD-CC128": { kind: "handle", centersMm: 128 },
  "HD-CC160": { kind: "handle", centersMm: 160 },
  "HD-CC192": { kind: "handle", centersMm: 192 },
  "HD-CC256": { kind: "handle", centersMm: 256 },
  
  // Knob patterns
  "KN-CTR": { kind: "knob", position: "center" },
  "KN-CENTRE": { kind: "knob", position: "center" },
  "KN-37": { kind: "knob", offsetMm: 37 },
  
  // Drawer slide patterns
  "DS-STD": { kind: "drawer_slide", pattern: "standard" },
  "DS-UNDER": { kind: "drawer_slide", pattern: "undermount" },
  
  // Cam lock patterns
  "CAM-STD": { kind: "cam_lock", pattern: "standard" },
  "CAM-MINI": { kind: "cam_lock", pattern: "minifix" },
  
  // Dowel patterns
  "DWL-2": { kind: "dowel", count: 2 },
  "DWL-3": { kind: "dowel", count: 3 },
} as const;

/**
 * Parse hole pattern shortcode
 */
export function parseHoleCode(code: string): ParsedHoleCode | null {
  const normalized = code.trim().toUpperCase();
  
  // Check presets first
  const preset = HOLE_PRESETS[normalized];
  if (preset) {
    return { ...preset };
  }
  
  // Parse dynamic hinge format: H[count]-[offset]
  const hingeMatch = normalized.match(/^H(\d+)-(\d+)$/);
  if (hingeMatch) {
    return {
      kind: "hinge",
      count: parseInt(hingeMatch[1], 10),
      offsetMm: parseInt(hingeMatch[2], 10),
    };
  }
  
  // Parse dynamic handle format: HD-CC[centers]
  const handleMatch = normalized.match(/^HD-CC(\d+)$/);
  if (handleMatch) {
    return {
      kind: "handle",
      centersMm: parseInt(handleMatch[1], 10),
    };
  }
  
  // Parse dynamic knob format: KN-[offset]
  const knobMatch = normalized.match(/^KN-(\d+)$/);
  if (knobMatch) {
    return {
      kind: "knob",
      offsetMm: parseInt(knobMatch[1], 10),
    };
  }
  
  return null;
}

/**
 * Generate hole pattern code from spec
 */
export function holePatternToCode(spec: HolePatternSpec): string {
  switch (spec.kind) {
    case "hinge":
      return `H${spec.count ?? 2}-${spec.offsetsMm[0] ?? 100}`;
    case "handle":
      return `HD-CC${spec.offsetsMm[1] - spec.offsetsMm[0]}`;
    case "knob":
      return spec.distanceFromEdgeMm ? `KN-${spec.distanceFromEdgeMm}` : "KN-CTR";
    case "shelf_pins":
      return "SP-ALL";
    case "system32":
      return "SP-32";
    default:
      return `HOLE-${spec.kind.toUpperCase()}`;
  }
}

// ============================================================
// CNC OPERATION SHORTCODES
// ============================================================

/**
 * CNC operation code formats:
 * 
 * - CUTOUT-SINK-600x500  → Sink cutout 600x500mm
 * - RADIUS-25-FRONT      → 25mm radius on front corners
 * - POCKET-100x50x10     → Pocket 100x50mm, 10mm deep
 * - TEXT-LABEL           → Engraved text
 */

export interface ParsedCncCode {
  type: CncOpType;
  shapeId: string;
  params: Record<string, number | string>;
}

/**
 * Predefined CNC operation codes
 */
export const CNC_PRESETS: Record<string, ParsedCncCode> = {
  // Cutouts
  "CUTOUT-SINK-600x500": { type: "cutout", shapeId: "sink_rect", params: { width: 600, height: 500 } },
  "CUTOUT-SINK-800x500": { type: "cutout", shapeId: "sink_rect", params: { width: 800, height: 500 } },
  "CUTOUT-HOB-580x510": { type: "cutout", shapeId: "hob_rect", params: { width: 580, height: 510 } },
  "CUTOUT-VENT-200x100": { type: "cutout", shapeId: "vent_rect", params: { width: 200, height: 100 } },
  
  // Radius
  "RADIUS-3-ALL": { type: "radius", shapeId: "corner_radius", params: { radius: 3, corners: "all" } },
  "RADIUS-6-ALL": { type: "radius", shapeId: "corner_radius", params: { radius: 6, corners: "all" } },
  "RADIUS-25-FRONT": { type: "radius", shapeId: "corner_radius", params: { radius: 25, corners: "front" } },
  
  // Edge profiles
  "PROFILE-OGEE": { type: "contour", shapeId: "ogee_profile", params: {} },
  "PROFILE-BEVEL": { type: "contour", shapeId: "bevel_profile", params: { angle: 45 } },
  "PROFILE-ROUND": { type: "contour", shapeId: "round_profile", params: {} },
  
  // Rebates
  "REBATE-10x10": { type: "rebate", shapeId: "rebate", params: { width: 10, depth: 10 } },
  "REBATE-18x10": { type: "rebate", shapeId: "rebate", params: { width: 18, depth: 10 } },
} as const;

/**
 * Parse CNC operation shortcode
 */
export function parseCncCode(code: string): ParsedCncCode | null {
  const normalized = code.trim().toUpperCase();
  
  // Check presets first
  const preset = CNC_PRESETS[normalized];
  if (preset) {
    return { ...preset, params: { ...preset.params } };
  }
  
  // Parse dynamic cutout format: CUTOUT-[shape]-[WxH]
  const cutoutMatch = normalized.match(/^CUTOUT-(\w+)-(\d+)x(\d+)$/);
  if (cutoutMatch) {
    return {
      type: "cutout",
      shapeId: cutoutMatch[1].toLowerCase(),
      params: {
        width: parseInt(cutoutMatch[2], 10),
        height: parseInt(cutoutMatch[3], 10),
      },
    };
  }
  
  // Parse dynamic radius format: RADIUS-[size]-[corners]
  const radiusMatch = normalized.match(/^RADIUS-(\d+)-(\w+)$/);
  if (radiusMatch) {
    return {
      type: "radius",
      shapeId: "corner_radius",
      params: {
        radius: parseInt(radiusMatch[1], 10),
        corners: radiusMatch[2].toLowerCase(),
      },
    };
  }
  
  // Parse dynamic pocket format: POCKET-[WxHxD]
  const pocketMatch = normalized.match(/^POCKET-(\d+)x(\d+)x(\d+)$/);
  if (pocketMatch) {
    return {
      type: "pocket",
      shapeId: "rect_pocket",
      params: {
        width: parseInt(pocketMatch[1], 10),
        height: parseInt(pocketMatch[2], 10),
        depth: parseInt(pocketMatch[3], 10),
      },
    };
  }
  
  return null;
}

/**
 * Generate CNC code from operation
 */
export function cncOperationToCode(op: CncOperation): string {
  switch (op.type) {
    case "cutout":
      return `CUTOUT-${op.shapeId.toUpperCase()}-${op.params.width}x${op.params.height}`;
    case "radius":
      return `RADIUS-${op.params.radius}-${String(op.params.corners).toUpperCase()}`;
    case "pocket":
      return `POCKET-${op.params.width}x${op.params.height}x${op.params.depth}`;
    case "contour":
      return `PROFILE-${op.shapeId.toUpperCase()}`;
    default:
      return `CNC-${op.type.toUpperCase()}-${op.shapeId}`;
  }
}

// ============================================================
// SHORTCODE REFERENCE (for UI display)
// ============================================================

/**
 * Shortcode documentation for UI help text
 */
export const SHORTCODE_REFERENCE = {
  edgeband: {
    title: "Edgebanding Codes",
    description: "Specify which edges to band",
    examples: [
      { code: "2L2W", description: "All four edges" },
      { code: "2L", description: "Both long edges" },
      { code: "2W", description: "Both width edges" },
      { code: "L2W", description: "One long + both width edges" },
      { code: "L1", description: "First long edge only" },
      { code: "0", description: "No edgebanding" },
    ],
  },
  groove: {
    title: "Groove Codes",
    description: "Specify groove operations (G[edge]-[width]-[offset])",
    examples: [
      { code: "G-ALL-4-12", description: "All edges, 4mm wide, 12mm from edge" },
      { code: "GL-4-10", description: "Long edges, 4mm wide, 10mm from edge" },
      { code: "GW-4-12", description: "Width edges, 4mm wide, 12mm from edge" },
      { code: "GW2-4-10", description: "W2 edge only (back panel)" },
    ],
  },
  holes: {
    title: "Hole Pattern Codes",
    description: "Specify drilling patterns",
    examples: [
      { code: "H2-110", description: "2 hinges, 110mm from corners" },
      { code: "H3-90", description: "3 hinges, 90mm from corners" },
      { code: "SP-32", description: "System 32 shelf pins" },
      { code: "HD-CC96", description: "Handle, 96mm centers" },
      { code: "KN-CTR", description: "Knob, centered" },
    ],
  },
  cnc: {
    title: "CNC Operation Codes",
    description: "Specify CNC machining operations",
    examples: [
      { code: "CUTOUT-SINK-600x500", description: "Sink cutout 600x500mm" },
      { code: "RADIUS-25-FRONT", description: "25mm radius, front corners" },
      { code: "POCKET-100x50x10", description: "Pocket 100x50mm, 10mm deep" },
      { code: "REBATE-10x10", description: "10mm x 10mm edge rebate" },
    ],
  },
  overrides: {
    title: "Override Syntax",
    description: "Add @[overrides] to any code to customize parameters",
    examples: [
      { code: "2L2W@10", description: "All edges with 10mm thickness" },
      { code: "GL-4-10@d6", description: "Groove with 6mm depth override" },
      { code: "GL-4-10@d6w5", description: "Groove with 6mm depth, 5mm width" },
      { code: "H2-100@dia35", description: "2 hinges with 35mm diameter" },
      { code: "SP-32@c4", description: "Shelf pins with 4 count" },
      { code: "HD-CC96@cc128", description: "Handle with 128mm centers" },
    ],
  },
} as const;

