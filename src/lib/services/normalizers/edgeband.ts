/**
 * CAI Intake - Edgeband Normalizer
 * 
 * Converts raw edgeband data to canonical EdgeBandSpec.
 */

import type { EdgeSide, EdgeBandSpec } from "../canonical-types";
import type { OrgServiceDialect } from "../dialect-types";
import type { RawEdgebandFields } from "../raw-fields";
import { EDGE_CODES, parseEdgeCode } from "../canonical-shortcodes";
import { isYesValue, isNoValue } from "../dialect-types";

/**
 * Normalize raw edgeband data to canonical EdgeBandSpec
 */
export function normalizeEdgeband(
  raw: RawEdgebandFields | undefined,
  dialect: OrgServiceDialect
): EdgeBandSpec | undefined {
  if (!raw) return undefined;
  
  const edges: EdgeSide[] = [];
  
  // Strategy 1: Check for text-based input
  if (raw.text) {
    const textEdges = normalizeEdgebandText(raw.text, dialect);
    if (textEdges) {
      edges.push(...textEdges);
    }
  }
  
  // Strategy 2: Check column-based input
  if (raw.columns) {
    const columnEdges = normalizeEdgebandColumns(raw.columns, dialect);
    edges.push(...columnEdges);
  }
  
  // Strategy 3: Apply default if still empty and default is set
  if (edges.length === 0 && dialect.edgeband.defaultIfBlank) {
    const defaultEdges = parseEdgeCode(dialect.edgeband.defaultIfBlank);
    edges.push(...defaultEdges);
  }
  
  // Deduplicate and return
  const uniqueEdges = [...new Set(edges)] as EdgeSide[];
  
  if (uniqueEdges.length === 0) {
    return undefined;
  }
  
  return {
    edges: uniqueEdges,
    tapeId: raw.tapeId,
    thicknessMm: raw.thicknessMm,
  };
}

/**
 * Normalize text-based edgeband notation
 */
function normalizeEdgebandText(
  text: string,
  dialect: OrgServiceDialect
): EdgeSide[] | null {
  const normalized = text.trim().toUpperCase();
  
  if (!normalized || normalized === "-" || normalized === "0") {
    return null;
  }
  
  // 1. Check aliases first
  const alias = dialect.edgeband.aliases[normalized];
  if (alias) {
    return parseEdgeCode(alias);
  }
  
  // Also check case-insensitive alias
  for (const [key, value] of Object.entries(dialect.edgeband.aliases)) {
    if (key.toUpperCase() === normalized) {
      return parseEdgeCode(value);
    }
  }
  
  // 2. Check canonical codes
  const canonical = EDGE_CODES[normalized as keyof typeof EDGE_CODES];
  if (canonical) {
    return [...canonical];
  }
  
  // 3. Try parsing as direct code
  const parsed = parseEdgeCode(normalized);
  if (parsed.length > 0) {
    return parsed;
  }
  
  // 4. Try parsing comma/plus separated edges
  const separatorMatch = normalized.match(/([LW][12])/g);
  if (separatorMatch) {
    return separatorMatch.map(e => e as EdgeSide);
  }
  
  // 5. Try custom patterns
  if (dialect.edgeband.patterns) {
    for (const pattern of dialect.edgeband.patterns.sort((a, b) => b.priority - a.priority)) {
      if (!pattern.enabled) continue;
      const match = text.match(pattern.pattern);
      if (match) {
        const result = pattern.handler(match);
        if (result && "edges" in result && Array.isArray(result.edges)) {
          return result.edges as EdgeSide[];
        }
      }
    }
  }
  
  // 6. Try natural language parsing
  const nlEdges = parseNaturalLanguageEdges(text);
  if (nlEdges.length > 0) {
    return nlEdges;
  }
  
  return null;
}

/**
 * Normalize column-based edgeband data
 */
function normalizeEdgebandColumns(
  columns: NonNullable<RawEdgebandFields["columns"]>,
  dialect: OrgServiceDialect
): EdgeSide[] {
  const edges: EdgeSide[] = [];
  const { yesValues, noValues } = dialect.edgeband;
  
  // Check "all" column first
  if (columns.all !== undefined && isYesValue(columns.all, yesValues)) {
    return ["L1", "L2", "W1", "W2"];
  }
  
  // Check combined L/W columns
  if (columns.L !== undefined && isYesValue(columns.L, yesValues)) {
    edges.push("L1", "L2");
  }
  if (columns.W !== undefined && isYesValue(columns.W, yesValues)) {
    edges.push("W1", "W2");
  }
  
  // Check individual edge columns (take precedence over combined)
  if (columns.L1 !== undefined) {
    if (isYesValue(columns.L1, yesValues)) {
      if (!edges.includes("L1")) edges.push("L1");
    } else if (isNoValue(columns.L1, noValues)) {
      const idx = edges.indexOf("L1");
      if (idx > -1) edges.splice(idx, 1);
    }
  }
  
  if (columns.L2 !== undefined) {
    if (isYesValue(columns.L2, yesValues)) {
      if (!edges.includes("L2")) edges.push("L2");
    } else if (isNoValue(columns.L2, noValues)) {
      const idx = edges.indexOf("L2");
      if (idx > -1) edges.splice(idx, 1);
    }
  }
  
  if (columns.W1 !== undefined) {
    if (isYesValue(columns.W1, yesValues)) {
      if (!edges.includes("W1")) edges.push("W1");
    } else if (isNoValue(columns.W1, noValues)) {
      const idx = edges.indexOf("W1");
      if (idx > -1) edges.splice(idx, 1);
    }
  }
  
  if (columns.W2 !== undefined) {
    if (isYesValue(columns.W2, yesValues)) {
      if (!edges.includes("W2")) edges.push("W2");
    } else if (isNoValue(columns.W2, noValues)) {
      const idx = edges.indexOf("W2");
      if (idx > -1) edges.splice(idx, 1);
    }
  }
  
  return edges;
}

/**
 * Parse natural language edge descriptions
 */
function parseNaturalLanguageEdges(text: string): EdgeSide[] {
  const lower = text.toLowerCase();
  const edges: EdgeSide[] = [];
  
  // All edges
  if (/\ball\s*(?:edges?|sides?)\b/.test(lower) || /\b4\s*(?:edges?|sides?)\b/.test(lower)) {
    return ["L1", "L2", "W1", "W2"];
  }
  
  // Long edges
  if (/\blong\s*(?:edges?|sides?)\b/.test(lower) || /\blength\s*(?:edges?|sides?)\b/.test(lower)) {
    edges.push("L1", "L2");
  }
  
  // Short/width edges
  if (/\b(?:short|width)\s*(?:edges?|sides?)\b/.test(lower)) {
    edges.push("W1", "W2");
  }
  
  // Front/visible edge
  if (/\bfront\s*(?:edge)?\b/.test(lower) || /\bvisible\s*(?:edge)?\b/.test(lower)) {
    edges.push("L1");
  }
  
  // Back edge
  if (/\bback\s*(?:edge)?\b/.test(lower)) {
    edges.push("L2");
  }
  
  // Left edge
  if (/\bleft\s*(?:edge)?\b/.test(lower)) {
    edges.push("W1");
  }
  
  // Right edge
  if (/\bright\s*(?:edge)?\b/.test(lower)) {
    edges.push("W2");
  }
  
  // "One long edge" / "one L"
  if (/\bone\s*(?:long|L)\b/.test(lower)) {
    edges.push("L1");
  }
  
  // "Both long edges" / "two L"
  if (/\b(?:both|two|2)\s*(?:long|L)\b/.test(lower)) {
    edges.push("L1", "L2");
  }
  
  // "One width edge" / "one W"
  if (/\bone\s*(?:short|width|W)\b/.test(lower)) {
    edges.push("W1");
  }
  
  // "Both width edges" / "two W"
  if (/\b(?:both|two|2)\s*(?:short|width|W)\b/.test(lower)) {
    edges.push("W1", "W2");
  }
  
  return [...new Set(edges)] as EdgeSide[];
}

/**
 * Normalize legacy X/XX notation from spreadsheets
 * 
 * Common pattern:
 * - Columns for L and W
 * - X = one edge, XX = both edges
 */
export function normalizeXXNotation(
  lColumn: string | undefined,
  wColumn: string | undefined
): EdgeSide[] {
  const edges: EdgeSide[] = [];
  
  if (lColumn) {
    const l = lColumn.toUpperCase().trim();
    if (l === "XX") {
      edges.push("L1", "L2");
    } else if (l === "X") {
      edges.push("L1");
    }
  }
  
  if (wColumn) {
    const w = wColumn.toUpperCase().trim();
    if (w === "XX") {
      edges.push("W1", "W2");
    } else if (w === "X") {
      edges.push("W1");
    }
  }
  
  return edges;
}



