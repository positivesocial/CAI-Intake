/**
 * CAI Intake - CNC Operations Normalizer
 * 
 * Converts raw CNC data to canonical CncOperation[].
 */

import type { CncOperation, CncOpType } from "../canonical-types";
import type { OrgServiceDialect } from "../dialect-types";
import type { RawCncFields } from "../raw-fields";
import { parseCncCode, CNC_PRESETS } from "../canonical-shortcodes";
import { isYesValue } from "../dialect-types";

/**
 * Normalize raw CNC data to canonical CncOperation[]
 */
export function normalizeCnc(
  raw: RawCncFields | undefined,
  dialect: OrgServiceDialect
): CncOperation[] | undefined {
  if (!raw) return undefined;
  
  const operations: CncOperation[] = [];
  
  // Strategy 1: Check for text-based input
  if (raw.text) {
    const textOps = normalizeCncText(raw.text, dialect);
    if (textOps) {
      operations.push(...textOps);
    }
  }
  
  // Strategy 2: Check programId reference
  if (raw.programId) {
    const programOp = normalizeProgramId(raw.programId, dialect);
    if (programOp) {
      operations.push(programOp);
    }
  }
  
  // Strategy 3: Check structured params
  if (raw.shapeType && raw.params) {
    operations.push({
      type: inferCncType(raw.shapeType),
      shapeId: raw.shapeType.toLowerCase(),
      params: raw.params,
    });
  }
  
  // Strategy 4: Check column-based input
  if (raw.columns) {
    const columnOps = normalizeCncColumns(raw.columns, dialect);
    operations.push(...columnOps);
  }
  
  return operations.length > 0 ? operations : undefined;
}

/**
 * Normalize text-based CNC notation
 */
function normalizeCncText(
  text: string,
  dialect: OrgServiceDialect
): CncOperation[] | null {
  const normalized = text.trim().toUpperCase();
  
  if (!normalized || normalized === "-" || normalized === "0" || normalized === "NONE") {
    return null;
  }
  
  const operations: CncOperation[] = [];
  
  // 1. Check aliases first
  const alias = dialect.cnc.aliases?.[normalized];
  if (alias) {
    // Check if alias maps to a macro
    const macro = dialect.cnc.macros[alias];
    if (macro) {
      operations.push({ ...macro, params: { ...macro.params } });
      return operations;
    }
    // Otherwise try parsing as code
    const parsed = parseCncCode(alias);
    if (parsed) {
      operations.push({ ...parsed, params: { ...parsed.params } });
      return operations;
    }
  }
  
  // Also check case-insensitive alias
  if (dialect.cnc.aliases) {
    for (const [key, value] of Object.entries(dialect.cnc.aliases)) {
      if (key.toUpperCase() === normalized) {
        const macro = dialect.cnc.macros[value];
        if (macro) {
          operations.push({ ...macro, params: { ...macro.params } });
          return operations;
        }
        const parsed = parseCncCode(value);
        if (parsed) {
          operations.push({ ...parsed, params: { ...parsed.params } });
          return operations;
        }
      }
    }
  }
  
  // 2. Check named macros from dialect
  const macro = dialect.cnc.macros[normalized];
  if (macro) {
    operations.push({ ...macro, params: { ...macro.params } });
    return operations;
  }
  
  // 3. Try parsing as canonical code
  const parsed = parseCncCode(normalized);
  if (parsed) {
    operations.push({ ...parsed, params: { ...parsed.params } });
    return operations;
  }
  
  // 4. Check preset codes
  const preset = CNC_PRESETS[normalized];
  if (preset) {
    operations.push({ ...preset, params: { ...preset.params } });
    return operations;
  }
  
  // 5. Try custom patterns
  if (dialect.cnc.patterns) {
    for (const pattern of dialect.cnc.patterns.sort((a, b) => b.priority - a.priority)) {
      if (!pattern.enabled) continue;
      const match = text.match(pattern.pattern);
      if (match) {
        const result = pattern.handler(match) as Partial<CncOperation>;
        if (result && result.type) {
          operations.push({
            type: result.type,
            shapeId: result.shapeId ?? "custom",
            params: result.params ?? {},
            note: result.note,
          });
          return operations;
        }
      }
    }
  }
  
  // 6. Try natural language parsing
  const nlOps = parseNaturalLanguageCnc(text, dialect);
  if (nlOps.length > 0) {
    return nlOps;
  }
  
  // 7. If it's just "CUSTOM" or similar, create a custom op
  if (normalized === "CUSTOM" || normalized === "CNC" || normalized === "YES") {
    operations.push({
      type: "custom",
      shapeId: "custom",
      params: {},
      note: "Custom CNC operation",
    });
    return operations;
  }
  
  return operations.length > 0 ? operations : null;
}

/**
 * Normalize CNC program ID
 */
function normalizeProgramId(
  programId: string,
  dialect: OrgServiceDialect
): CncOperation | null {
  const normalized = programId.trim().toUpperCase();
  
  // Check if it's a known macro
  const macro = dialect.cnc.macros[normalized];
  if (macro) {
    return { ...macro, params: { ...macro.params } };
  }
  
  // Check aliases
  if (dialect.cnc.aliases) {
    const alias = dialect.cnc.aliases[normalized];
    if (alias) {
      const aliasedMacro = dialect.cnc.macros[alias];
      if (aliasedMacro) {
        return { ...aliasedMacro, params: { ...aliasedMacro.params } };
      }
    }
  }
  
  // Create a custom reference
  return {
    type: "custom",
    shapeId: programId,
    params: { program_id: programId },
    note: `CNC Program: ${programId}`,
  };
}

/**
 * Normalize column-based CNC data
 */
function normalizeCncColumns(
  columns: NonNullable<RawCncFields["columns"]>,
  dialect: OrgServiceDialect
): CncOperation[] {
  const operations: CncOperation[] = [];
  const yesValues = ["X", "Y", "YES", "1", 1, true, "TRUE", "✓"];
  
  // Check CNC column
  if (columns.cnc !== undefined) {
    // If it's a string with content (not just yes/no), try to parse it
    if (typeof columns.cnc === "string" && columns.cnc.trim().length > 1) {
      const textOps = normalizeCncText(columns.cnc, dialect);
      if (textOps) {
        operations.push(...textOps);
      }
    } else if (isYesValue(columns.cnc, yesValues)) {
      // Generic "yes" means custom operation
      operations.push({
        type: "custom",
        shapeId: "custom",
        params: {},
        note: "CNC operation required",
      });
    }
  }
  
  // Check routing column
  if (columns.routing !== undefined) {
    if (typeof columns.routing === "string" && columns.routing.trim().length > 1) {
      const textOps = normalizeCncText(columns.routing, dialect);
      if (textOps) {
        operations.push(...textOps);
      }
    } else if (isYesValue(columns.routing, yesValues)) {
      operations.push({
        type: "contour",
        shapeId: "edge_profile",
        params: {},
        note: "Edge routing required",
      });
    }
  }
  
  // Check machining column
  if (columns.machining !== undefined) {
    if (typeof columns.machining === "string" && columns.machining.trim().length > 1) {
      const textOps = normalizeCncText(columns.machining, dialect);
      if (textOps) {
        operations.push(...textOps);
      }
    } else if (isYesValue(columns.machining, yesValues)) {
      operations.push({
        type: "custom",
        shapeId: "machining",
        params: {},
        note: "Machining required",
      });
    }
  }
  
  return operations;
}

/**
 * Infer CNC operation type from shape type string
 */
function inferCncType(shapeType: string): CncOpType {
  const lower = shapeType.toLowerCase();
  
  if (lower.includes("cutout") || lower.includes("sink") || lower.includes("hob")) {
    return "cutout";
  }
  if (lower.includes("pocket")) {
    return "pocket";
  }
  if (lower.includes("radius") || lower.includes("corner")) {
    return "radius";
  }
  if (lower.includes("profile") || lower.includes("contour") || lower.includes("route")) {
    return "contour";
  }
  if (lower.includes("drill") || lower.includes("hole")) {
    return "drill_array";
  }
  if (lower.includes("text") || lower.includes("engrav")) {
    return "text";
  }
  if (lower.includes("chamfer") || lower.includes("bevel")) {
    return "chamfer";
  }
  if (lower.includes("rebate") || lower.includes("rabbet")) {
    return "rebate";
  }
  
  return "custom";
}

/**
 * Parse natural language CNC descriptions
 */
function parseNaturalLanguageCnc(
  text: string,
  dialect: OrgServiceDialect
): CncOperation[] {
  const lower = text.toLowerCase();
  const operations: CncOperation[] = [];
  
  // Sink cutout
  if (/\bsink\s*(?:cut(?:out)?|hole)?\b/.test(lower)) {
    const sizeMatch = lower.match(/(\d+)\s*(?:x|by)\s*(\d+)/);
    operations.push({
      type: "cutout",
      shapeId: "sink_rect",
      params: {
        width: sizeMatch ? parseInt(sizeMatch[1], 10) : 600,
        height: sizeMatch ? parseInt(sizeMatch[2], 10) : 500,
      },
      note: "Sink cutout",
    });
  }
  
  // Hob/cooktop cutout
  if (/\b(?:hob|cooktop|stove)\s*(?:cut(?:out)?|hole)?\b/.test(lower)) {
    const sizeMatch = lower.match(/(\d+)\s*(?:x|by)\s*(\d+)/);
    operations.push({
      type: "cutout",
      shapeId: "hob_rect",
      params: {
        width: sizeMatch ? parseInt(sizeMatch[1], 10) : 580,
        height: sizeMatch ? parseInt(sizeMatch[2], 10) : 510,
      },
      note: "Hob cutout",
    });
  }
  
  // Corner radius
  if (/\b(?:corner\s*)?radius\b/.test(lower) || /\brounded\s*corners?\b/.test(lower)) {
    const radiusMatch = lower.match(/(\d+)\s*(?:mm)?\s*radius/);
    const radius = radiusMatch ? parseInt(radiusMatch[1], 10) : 3;
    
    let corners = "all";
    if (/\bfront\b/.test(lower)) corners = "front";
    else if (/\bback\b/.test(lower)) corners = "back";
    else if (/\bleft\b/.test(lower)) corners = "left";
    else if (/\bright\b/.test(lower)) corners = "right";
    
    operations.push({
      type: "radius",
      shapeId: "corner_radius",
      params: { radius, corners },
    });
  }
  
  // Edge profile
  if (/\bedge\s*profile\b/.test(lower) || /\b(?:ogee|bevel|round(?:over)?)\b/.test(lower)) {
    let profileType = "round_profile";
    if (/\bogee\b/.test(lower)) profileType = "ogee_profile";
    else if (/\bbevel\b/.test(lower)) profileType = "bevel_profile";
    
    operations.push({
      type: "contour",
      shapeId: profileType,
      params: {},
    });
  }
  
  // Pocket
  if (/\bpocket\b/.test(lower)) {
    const sizeMatch = lower.match(/(\d+)\s*(?:x|by)\s*(\d+)(?:\s*(?:x|by)\s*(\d+))?/);
    operations.push({
      type: "pocket",
      shapeId: "rect_pocket",
      params: {
        width: sizeMatch ? parseInt(sizeMatch[1], 10) : 100,
        height: sizeMatch ? parseInt(sizeMatch[2], 10) : 50,
        depth: sizeMatch && sizeMatch[3] ? parseInt(sizeMatch[3], 10) : 10,
      },
    });
  }
  
  // Rebate/rabbet
  if (/\b(?:rebate|rabbet)\b/.test(lower)) {
    const sizeMatch = lower.match(/(\d+)\s*(?:x|by)\s*(\d+)/);
    operations.push({
      type: "rebate",
      shapeId: "rebate",
      params: {
        width: sizeMatch ? parseInt(sizeMatch[1], 10) : 10,
        depth: sizeMatch ? parseInt(sizeMatch[2], 10) : 10,
      },
    });
  }
  
  // Text/engraving
  if (/\b(?:text|engrav|label)\b/.test(lower)) {
    operations.push({
      type: "text",
      shapeId: "text_engrave",
      params: {},
      note: "Text engraving",
    });
  }
  
  return operations;
}



