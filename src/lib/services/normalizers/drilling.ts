/**
 * CAI Intake - Drilling/Holes Normalizer
 * 
 * Converts raw drilling data to canonical HolePatternSpec[].
 */

import type { EdgeSide, HolePatternSpec, HolePatternKind } from "../compat-types";
import type { OrgServiceDialect } from "../dialect-types";
import type { RawDrillingFields } from "../raw-fields";
import { isYesValue } from "../dialect-types";

// Compat: HOLE_PRESETS
const HOLE_PRESETS: Record<string, { kind: HolePatternKind; count?: number; spacingMm?: number }> = {
  "H2": { kind: "hinge", count: 2 },
  "H3": { kind: "hinge", count: 3 },
  "SP": { kind: "shelf_pins" },
  "S32": { kind: "system32", spacingMm: 32 },
  "HD-96": { kind: "handle", spacingMm: 96 },
  "HD-128": { kind: "handle", spacingMm: 128 },
  "KB": { kind: "knob" },
};

// Compat: parseHoleCode stub
function parseHoleCode(code: string): HolePatternSpec | null {
  const upper = code.toUpperCase().trim();
  
  // Check presets first
  const preset = HOLE_PRESETS[upper];
  if (preset) {
    return {
      kind: preset.kind,
      count: preset.count,
      distanceFromEdgeMm: 21.5, // Default hinge distance
      spacingMm: preset.spacingMm,
    };
  }
  
  // H2-110 format: 2 hinges at 110mm offset
  const hingeMatch = upper.match(/^H(\d+)(?:[-_](\d+))?$/);
  if (hingeMatch) {
    return {
      kind: "hinge",
      count: parseInt(hingeMatch[1], 10),
      distanceFromEdgeMm: 21.5,
      offsetsMm: hingeMatch[2] ? [parseInt(hingeMatch[2], 10)] : undefined,
    };
  }
  
  // HD-128 format: handle at 128mm spacing
  const handleMatch = upper.match(/^HD[-_]?(\d+)$/);
  if (handleMatch) {
    return {
      kind: "handle",
      spacingMm: parseInt(handleMatch[1], 10),
      distanceFromEdgeMm: 0,
    };
  }
  
  return null;
}

/**
 * Normalize raw drilling data to canonical HolePatternSpec[]
 */
export function normalizeHoles(
  raw: RawDrillingFields | undefined,
  dialect: OrgServiceDialect
): HolePatternSpec[] | undefined {
  if (!raw) return undefined;
  
  const holes: HolePatternSpec[] = [];
  
  // Strategy 1: Check for text-based input
  if (raw.text) {
    const textHoles = normalizeHolesText(raw.text, dialect);
    if (textHoles) {
      holes.push(...textHoles);
    }
  }
  
  // Strategy 2: Check structured hole type indicators
  if (raw.hinge?.apply) {
    holes.push(createHingePattern(raw.hinge, dialect));
  }
  if (raw.shelf?.apply) {
    holes.push(createShelfPattern(raw.shelf, dialect));
  }
  if (raw.handle?.apply) {
    holes.push(createHandlePattern(raw.handle, dialect));
  }
  if (raw.knob?.apply) {
    holes.push(createKnobPattern(raw.knob, dialect));
  }
  
  // Strategy 3: Check column-based input
  if (raw.columns) {
    const columnHoles = normalizeHolesColumns(raw.columns, dialect);
    holes.push(...columnHoles);
  }
  
  return holes.length > 0 ? holes : undefined;
}

/**
 * Normalize text-based hole notation
 */
function normalizeHolesText(
  text: string,
  dialect: OrgServiceDialect
): HolePatternSpec[] | null {
  const normalized = text.trim().toUpperCase();
  
  if (!normalized || normalized === "-" || normalized === "0" || normalized === "NONE") {
    return null;
  }
  
  const holes: HolePatternSpec[] = [];
  
  // 1. Check aliases first
  const alias = dialect.drilling.aliases?.[normalized];
  if (alias) {
    const parsed = parseHoleCode(alias);
    if (parsed) {
      holes.push(createHoleSpecFromParsed(parsed, dialect));
      return holes;
    }
  }
  
  // Also check case-insensitive alias
  if (dialect.drilling.aliases) {
    for (const [key, value] of Object.entries(dialect.drilling.aliases)) {
      if (key.toUpperCase() === normalized) {
        const parsed = parseHoleCode(value);
        if (parsed) {
          holes.push(createHoleSpecFromParsed(parsed, dialect));
          return holes;
        }
      }
    }
  }
  
  // 2. Check named patterns from dialect
  // Hinges
  const hingePattern = dialect.drilling.hingePatterns[normalized];
  if (hingePattern) {
    holes.push({
      kind: "hinge",
      ...hingePattern,
    });
    return holes;
  }
  
  // Shelf pins
  const shelfPattern = dialect.drilling.shelfPatterns[normalized];
  if (shelfPattern) {
    holes.push({
      kind: shelfPattern.kind ?? "shelf_pins",
      ...shelfPattern,
    });
    return holes;
  }
  
  // Handles
  const handlePattern = dialect.drilling.handlePatterns[normalized];
  if (handlePattern) {
    holes.push({
      kind: "handle",
      ...handlePattern,
    });
    return holes;
  }
  
  // Knobs
  if (dialect.drilling.knobPatterns) {
    const knobPattern = dialect.drilling.knobPatterns[normalized];
    if (knobPattern) {
      holes.push({
        kind: "knob",
        ...knobPattern,
      });
      return holes;
    }
  }
  
  // 3. Try parsing as canonical code
  const parsed = parseHoleCode(normalized);
  if (parsed) {
    holes.push(createHoleSpecFromParsed(parsed, dialect));
    return holes;
  }
  
  // 4. Try preset codes
  const preset = HOLE_PRESETS[normalized];
  if (preset) {
    holes.push(createHoleSpecFromParsed(preset, dialect));
    return holes;
  }
  
  // 5. Try custom patterns
  if (dialect.drilling.patterns) {
    for (const pattern of dialect.drilling.patterns.sort((a, b) => b.priority - a.priority)) {
      if (!pattern.enabled) continue;
      const match = text.match(pattern.pattern);
      if (match) {
        const result = pattern.handler(match) as Partial<HolePatternSpec>;
        if (result && result.kind) {
          holes.push({
            kind: result.kind,
            refEdge: result.refEdge ?? "L1",
            offsetsMm: result.offsetsMm ?? [],
            distanceFromEdgeMm: result.distanceFromEdgeMm ?? 22,
            count: result.count,
            hardwareId: result.hardwareId,
            note: result.note,
          });
          return holes;
        }
      }
    }
  }
  
  // 6. Try natural language parsing
  const nlHoles = parseNaturalLanguageHoles(text, dialect);
  if (nlHoles.length > 0) {
    return nlHoles;
  }
  
  // 7. Try parsing dimensions pattern (e.g., "32mm" for system 32)
  const systemMatch = normalized.match(/^(\d+)\s*MM$/);
  if (systemMatch) {
    const system = parseInt(systemMatch[1], 10);
    if (system === 32) {
      holes.push({
        kind: "system32",
        refEdge: "L1",
        offsetsMm: [37],
        distanceFromEdgeMm: 37,
        note: "System 32",
      });
      return holes;
    }
  }
  
  return holes.length > 0 ? holes : null;
}

/**
 * Normalize column-based hole data
 */
function normalizeHolesColumns(
  columns: NonNullable<RawDrillingFields["columns"]>,
  dialect: OrgServiceDialect
): HolePatternSpec[] {
  const holes: HolePatternSpec[] = [];
  
  // These are typically yes/no columns, so we use default patterns
  const yesValues = ["X", "Y", "YES", "1", 1, true, "TRUE", "✓"];
  
  // Check hinge column
  if (columns.hinge !== undefined && isYesValue(columns.hinge, yesValues)) {
    const defaultHinge = dialect.drilling.hingePatterns["STD"] ?? dialect.drilling.hingePatterns["110"];
    if (defaultHinge) {
      holes.push({
        kind: "hinge",
        ...defaultHinge,
      });
    } else {
      holes.push({
        kind: "hinge",
        refEdge: "L1",
        offsetsMm: [100],
        distanceFromEdgeMm: 22,
        count: 2,
      });
    }
  }
  
  // Check shelf column
  if (columns.shelf !== undefined && isYesValue(columns.shelf, yesValues)) {
    const defaultShelf = dialect.drilling.shelfPatterns["32MM"] ?? dialect.drilling.shelfPatterns["STD"];
    if (defaultShelf) {
      holes.push({
        kind: defaultShelf.kind ?? "shelf_pins",
        ...defaultShelf,
      });
    } else {
      holes.push({
        kind: "system32",
        refEdge: "L1",
        offsetsMm: [37, 69, 101],
        distanceFromEdgeMm: 37,
      });
    }
  }
  
  // Check handle column
  if (columns.handle !== undefined && isYesValue(columns.handle, yesValues)) {
    const defaultHandle = dialect.drilling.handlePatterns["96"] ?? dialect.drilling.handlePatterns["CC96"];
    if (defaultHandle) {
      holes.push({
        kind: "handle",
        ...defaultHandle,
      });
    } else {
      holes.push({
        kind: "handle",
        refEdge: "L1",
        offsetsMm: [0, 96],
        distanceFromEdgeMm: 30,
      });
    }
  }
  
  // Check generic holes/drilling column
  if (columns.holes !== undefined || columns.drilling !== undefined) {
    const value = columns.holes ?? columns.drilling;
    
    // If it's a string with content (not just yes/no), try to parse it
    if (typeof value === "string" && value.trim().length > 1) {
      const textHoles = normalizeHolesText(value, dialect);
      if (textHoles) {
        holes.push(...textHoles);
      }
    } else if (isYesValue(value, yesValues)) {
      // Generic "yes" means system 32 by default
      holes.push({
        kind: "system32",
        refEdge: "L1",
        offsetsMm: [37, 69, 101],
        distanceFromEdgeMm: 37,
        note: "Default drilling",
      });
    }
  }
  
  return holes;
}

/**
 * Create hole spec from parsed code
 */
function createHoleSpecFromParsed(
  parsed: {
    kind: HolePatternKind;
    count?: number;
    offsetMm?: number;
    centersMm?: number;
    position?: string;
    pattern?: string;
  },
  dialect: OrgServiceDialect
): HolePatternSpec {
  const base: HolePatternSpec = {
    kind: parsed.kind,
    refEdge: "L1",
    offsetsMm: [],
    distanceFromEdgeMm: 22,
  };
  
  switch (parsed.kind) {
    case "hinge":
      return {
        ...base,
        offsetsMm: parsed.offsetMm ? [parsed.offsetMm] : [100],
        distanceFromEdgeMm: 22,
        count: parsed.count ?? 2,
      };
      
    case "handle":
      return {
        ...base,
        offsetsMm: parsed.centersMm ? [0, parsed.centersMm] : [0, 96],
        distanceFromEdgeMm: 30,
      };
      
    case "knob":
      return {
        ...base,
        offsetsMm: parsed.offsetMm ? [parsed.offsetMm] : [],
        distanceFromEdgeMm: parsed.position === "center" ? 0 : 37,
        note: parsed.position === "center" ? "Centered" : undefined,
      };
      
    case "shelf_pins":
    case "system32":
      return {
        ...base,
        kind: parsed.pattern === "32mm_system" ? "system32" : "shelf_pins",
        offsetsMm: [37, 69, 101],
        distanceFromEdgeMm: 37,
      };
      
    default:
      return base;
  }
}

/**
 * Create hinge pattern from raw data
 */
function createHingePattern(
  hinge: NonNullable<RawDrillingFields["hinge"]>,
  dialect: OrgServiceDialect
): HolePatternSpec {
  // Try to match a named pattern first
  if (hinge.hardwareId) {
    const named = dialect.drilling.hingePatterns[hinge.hardwareId.toUpperCase()];
    if (named) {
      return { kind: "hinge", ...named };
    }
  }
  
  return {
    kind: "hinge",
    refEdge: "L1",
    offsetsMm: hinge.offsetMm ? [hinge.offsetMm] : [100],
    distanceFromEdgeMm: 22,
    count: hinge.count ?? 2,
    hardwareId: hinge.hardwareId,
  };
}

/**
 * Create shelf pin pattern from raw data
 */
function createShelfPattern(
  shelf: NonNullable<RawDrillingFields["shelf"]>,
  dialect: OrgServiceDialect
): HolePatternSpec {
  // Try to match a named pattern
  if (shelf.pattern) {
    const named = dialect.drilling.shelfPatterns[shelf.pattern.toUpperCase()];
    if (named) {
      return { kind: named.kind ?? "shelf_pins", ...named };
    }
  }
  
  // Check system size
  const isSystem32 = shelf.systemMm === 32;
  
  return {
    kind: isSystem32 ? "system32" : "shelf_pins",
    refEdge: "L1",
    offsetsMm: isSystem32 ? [37, 69, 101] : [50, 100, 150],
    distanceFromEdgeMm: isSystem32 ? 37 : 35,
  };
}

/**
 * Create handle pattern from raw data
 */
function createHandlePattern(
  handle: NonNullable<RawDrillingFields["handle"]>,
  dialect: OrgServiceDialect
): HolePatternSpec {
  // Try to match a named pattern
  if (handle.centersMm) {
    const named = dialect.drilling.handlePatterns[`CC${handle.centersMm}`] ?? 
                  dialect.drilling.handlePatterns[String(handle.centersMm)];
    if (named) {
      return { kind: "handle", ...named };
    }
  }
  
  return {
    kind: "handle",
    refEdge: "L1",
    offsetsMm: handle.centersMm ? [0, handle.centersMm] : [0, 96],
    distanceFromEdgeMm: 30,
    note: handle.position ? `Position: ${handle.position}` : undefined,
  };
}

/**
 * Create knob pattern from raw data
 */
function createKnobPattern(
  knob: NonNullable<RawDrillingFields["knob"]>,
  dialect: OrgServiceDialect
): HolePatternSpec {
  // Try to match a named pattern
  if (knob.position && dialect.drilling.knobPatterns) {
    const named = dialect.drilling.knobPatterns[knob.position.toUpperCase()];
    if (named) {
      return { kind: "knob", ...named };
    }
  }
  
  const isCentered = knob.position === "center";
  
  return {
    kind: "knob",
    refEdge: "L1",
    offsetsMm: knob.offsetMm && !isCentered ? [knob.offsetMm] : [],
    distanceFromEdgeMm: isCentered ? 0 : (knob.offsetMm ?? 37),
    note: isCentered ? "Centered" : undefined,
  };
}

/**
 * Parse natural language hole descriptions
 */
function parseNaturalLanguageHoles(
  text: string,
  dialect: OrgServiceDialect
): HolePatternSpec[] {
  const lower = text.toLowerCase();
  const holes: HolePatternSpec[] = [];
  
  // Hinge patterns
  if (/\b(?:hinge|hinges)\b/.test(lower)) {
    const countMatch = lower.match(/(\d+)\s*(?:hinge|hinges)/);
    const offsetMatch = lower.match(/(\d+)\s*mm/);
    
    holes.push({
      kind: "hinge",
      refEdge: "L1",
      offsetsMm: offsetMatch ? [parseInt(offsetMatch[1], 10)] : [100],
      distanceFromEdgeMm: 22,
      count: countMatch ? parseInt(countMatch[1], 10) : 2,
    });
  }
  
  // Shelf pin patterns
  if (/\bshelf\s*(?:pins?|holes?|pegs?)?\b/.test(lower) || /\b32\s*mm\s*system\b/.test(lower)) {
    holes.push({
      kind: "system32",
      refEdge: "L1",
      offsetsMm: [37, 69, 101],
      distanceFromEdgeMm: 37,
    });
  }
  
  // Handle patterns
  if (/\b(?:handle|pull)\b/.test(lower)) {
    const ccMatch = lower.match(/(\d+)\s*(?:mm\s*)?(?:cc|centers?|centre)/);
    const centersMm = ccMatch ? parseInt(ccMatch[1], 10) : 96;
    
    holes.push({
      kind: "handle",
      refEdge: "L1",
      offsetsMm: [0, centersMm],
      distanceFromEdgeMm: 30,
    });
  }
  
  // Knob patterns
  if (/\bknob\b/.test(lower)) {
    const isCentered = /\bcenter(?:ed)?\b/.test(lower) || /\bcentre(?:d)?\b/.test(lower);
    
    holes.push({
      kind: "knob",
      refEdge: "L1",
      offsetsMm: isCentered ? [] : [37],
      distanceFromEdgeMm: isCentered ? 0 : 37,
      note: isCentered ? "Centered" : undefined,
    });
  }
  
  // Drawer slide patterns
  if (/\bdrawer\s*slide\b/.test(lower)) {
    holes.push({
      kind: "drawer_slide",
      refEdge: "W1",
      offsetsMm: [37, 100],
      distanceFromEdgeMm: 37,
      note: "Drawer slide mounting",
    });
  }
  
  return holes;
}





