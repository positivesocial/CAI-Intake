/**
 * CAI Intake - Groove Normalizer
 * 
 * Converts raw groove data to canonical GrooveSpec[].
 */

import type { EdgeSide, GrooveSpec } from "../canonical-types";
import type { OrgServiceDialect } from "../dialect-types";
import type { RawGrooveFields } from "../raw-fields";
import { parseGrooveCode } from "../canonical-shortcodes";
import { isYesValue } from "../dialect-types";

/**
 * Normalize raw groove data to canonical GrooveSpec[]
 */
export function normalizeGrooves(
  raw: RawGrooveFields | undefined,
  dialect: OrgServiceDialect
): GrooveSpec[] | undefined {
  if (!raw) return undefined;
  
  const grooves: GrooveSpec[] = [];
  
  // Strategy 1: Check for text-based input
  if (raw.text) {
    const textGrooves = normalizeGrooveText(raw.text, dialect);
    if (textGrooves) {
      grooves.push(...textGrooves);
    }
  }
  
  // Strategy 2: Check column-based input
  if (raw.columns) {
    const columnGrooves = normalizeGrooveColumns(raw.columns, dialect);
    grooves.push(...columnGrooves);
  }
  
  return grooves.length > 0 ? grooves : undefined;
}

/**
 * Normalize text-based groove notation
 */
function normalizeGrooveText(
  text: string,
  dialect: OrgServiceDialect
): GrooveSpec[] | null {
  const normalized = text.trim().toUpperCase();
  
  if (!normalized || normalized === "-" || normalized === "0" || normalized === "NONE") {
    return null;
  }
  
  // 1. Check aliases first
  const alias = dialect.groove.aliases[normalized];
  if (alias) {
    const parsed = parseGrooveCode(alias);
    if (parsed) {
      return createGrooveSpecs(parsed.edges, parsed.widthMm, dialect.groove.defaultDepthMm, parsed.offsetMm);
    }
  }
  
  // Also check case-insensitive alias
  for (const [key, value] of Object.entries(dialect.groove.aliases)) {
    if (key.toUpperCase() === normalized) {
      const parsed = parseGrooveCode(value);
      if (parsed) {
        return createGrooveSpecs(parsed.edges, parsed.widthMm, dialect.groove.defaultDepthMm, parsed.offsetMm);
      }
    }
  }
  
  // 2. Try parsing as canonical code (G[edge]-[width]-[offset])
  const parsed = parseGrooveCode(normalized);
  if (parsed) {
    return createGrooveSpecs(parsed.edges, parsed.widthMm, dialect.groove.defaultDepthMm, parsed.offsetMm);
  }
  
  // 3. Try simple patterns
  // Pattern: "4mm groove" or "groove 4mm"
  const widthMatch = normalized.match(/(\d+)\s*MM(?:\s*GROOVE)?|GROOVE\s*(\d+)\s*MM/);
  if (widthMatch) {
    const width = parseInt(widthMatch[1] || widthMatch[2], 10);
    return createGrooveSpecs(
      ["W2"], // Default to W2 (back panel) if only width specified
      width,
      dialect.groove.defaultDepthMm,
      dialect.groove.defaultOffsetMm
    );
  }
  
  // 4. Try custom patterns
  if (dialect.groove.patterns) {
    for (const pattern of dialect.groove.patterns.sort((a, b) => b.priority - a.priority)) {
      if (!pattern.enabled) continue;
      const match = text.match(pattern.pattern);
      if (match) {
        const result = pattern.handler(match) as Partial<GrooveSpec>;
        if (result && result.onEdge) {
          return [{
            onEdge: result.onEdge,
            distanceFromEdgeMm: result.distanceFromEdgeMm ?? dialect.groove.defaultOffsetMm,
            widthMm: result.widthMm ?? dialect.groove.defaultWidthMm,
            depthMm: result.depthMm ?? dialect.groove.defaultDepthMm,
            face: result.face ?? "back",
            note: result.note,
          }];
        }
      }
    }
  }
  
  // 5. Try natural language parsing
  const nlGrooves = parseNaturalLanguageGrooves(text, dialect);
  if (nlGrooves.length > 0) {
    return nlGrooves;
  }
  
  // 6. If just "yes" indicator, default to W2 (back panel groove)
  if (isYesValue(normalized, dialect.groove.yesValues)) {
    return createGrooveSpecs(
      ["W2"],
      dialect.groove.defaultWidthMm,
      dialect.groove.defaultDepthMm,
      dialect.groove.defaultOffsetMm
    );
  }
  
  return null;
}

/**
 * Normalize column-based groove data
 */
function normalizeGrooveColumns(
  columns: NonNullable<RawGrooveFields["columns"]>,
  dialect: OrgServiceDialect
): GrooveSpec[] {
  const grooves: GrooveSpec[] = [];
  const { yesValues, defaultWidthMm, defaultDepthMm, defaultOffsetMm } = dialect.groove;
  
  // Get custom dimensions if specified
  const widthMm = columns.widthMm ?? defaultWidthMm;
  const depthMm = columns.depthMm ?? defaultDepthMm;
  const offsetMm = columns.offsetMm ?? defaultOffsetMm;
  
  // Check for back panel groove (most common)
  if (columns.back !== undefined && isYesValue(columns.back, yesValues)) {
    grooves.push({
      onEdge: "W2",
      distanceFromEdgeMm: offsetMm,
      widthMm,
      depthMm,
      face: "back",
      note: "Back panel groove",
    });
  }
  
  // Check for drawer bottom groove
  if (columns.bottom !== undefined && isYesValue(columns.bottom, yesValues)) {
    grooves.push({
      onEdge: "W1",
      distanceFromEdgeMm: 12, // Common drawer bottom offset
      widthMm,
      depthMm: 8, // Typically shallower for drawer bottoms
      face: "back",
      note: "Drawer bottom groove",
    });
  }
  
  // Check for long edge grooves
  if (columns.long !== undefined && isYesValue(columns.long, yesValues)) {
    grooves.push({
      onEdge: "L1",
      distanceFromEdgeMm: offsetMm,
      widthMm,
      depthMm,
      face: "back",
    });
    grooves.push({
      onEdge: "L2",
      distanceFromEdgeMm: offsetMm,
      widthMm,
      depthMm,
      face: "back",
    });
  }
  
  // Check for width edge grooves
  if (columns.width !== undefined && isYesValue(columns.width, yesValues)) {
    grooves.push({
      onEdge: "W1",
      distanceFromEdgeMm: offsetMm,
      widthMm,
      depthMm,
      face: "back",
    });
    grooves.push({
      onEdge: "W2",
      distanceFromEdgeMm: offsetMm,
      widthMm,
      depthMm,
      face: "back",
    });
  }
  
  return grooves;
}

/**
 * Create groove specs for multiple edges
 */
function createGrooveSpecs(
  edges: EdgeSide[],
  widthMm: number,
  depthMm: number,
  offsetMm: number
): GrooveSpec[] {
  return edges.map(edge => ({
    onEdge: edge,
    distanceFromEdgeMm: offsetMm,
    widthMm,
    depthMm,
    face: "back" as const,
  }));
}

/**
 * Parse natural language groove descriptions
 */
function parseNaturalLanguageGrooves(
  text: string,
  dialect: OrgServiceDialect
): GrooveSpec[] {
  const lower = text.toLowerCase();
  const grooves: GrooveSpec[] = [];
  const { defaultWidthMm, defaultDepthMm, defaultOffsetMm } = dialect.groove;
  
  // Back panel groove
  if (/\bback\s*(?:panel)?\s*groove\b/.test(lower) || /\bgroove\s*(?:for\s*)?back\s*panel\b/.test(lower)) {
    grooves.push({
      onEdge: "W2",
      distanceFromEdgeMm: defaultOffsetMm,
      widthMm: defaultWidthMm,
      depthMm: defaultDepthMm,
      face: "back",
      note: "Back panel groove",
    });
  }
  
  // Drawer bottom groove
  if (/\bdrawer\s*(?:bottom)?\s*groove\b/.test(lower) || /\bgroove\s*(?:for\s*)?drawer\b/.test(lower)) {
    grooves.push({
      onEdge: "W1",
      distanceFromEdgeMm: 12,
      widthMm: defaultWidthMm,
      depthMm: 8,
      face: "back",
      note: "Drawer bottom groove",
    });
  }
  
  // All edges groove
  if (/\bgroove\s*(?:on\s*)?all\s*(?:edges?|sides?)\b/.test(lower)) {
    const edges: EdgeSide[] = ["L1", "L2", "W1", "W2"];
    edges.forEach(edge => {
      grooves.push({
        onEdge: edge,
        distanceFromEdgeMm: defaultOffsetMm,
        widthMm: defaultWidthMm,
        depthMm: defaultDepthMm,
        face: "back",
      });
    });
  }
  
  // Long edges groove
  if (/\bgroove\s*(?:on\s*)?long\s*(?:edges?|sides?)\b/.test(lower)) {
    grooves.push(
      {
        onEdge: "L1",
        distanceFromEdgeMm: defaultOffsetMm,
        widthMm: defaultWidthMm,
        depthMm: defaultDepthMm,
        face: "back",
      },
      {
        onEdge: "L2",
        distanceFromEdgeMm: defaultOffsetMm,
        widthMm: defaultWidthMm,
        depthMm: defaultDepthMm,
        face: "back",
      }
    );
  }
  
  // Width edges groove
  if (/\bgroove\s*(?:on\s*)?(?:width|short)\s*(?:edges?|sides?)\b/.test(lower)) {
    grooves.push(
      {
        onEdge: "W1",
        distanceFromEdgeMm: defaultOffsetMm,
        widthMm: defaultWidthMm,
        depthMm: defaultDepthMm,
        face: "back",
      },
      {
        onEdge: "W2",
        distanceFromEdgeMm: defaultOffsetMm,
        widthMm: defaultWidthMm,
        depthMm: defaultDepthMm,
        face: "back",
      }
    );
  }
  
  return grooves;
}




