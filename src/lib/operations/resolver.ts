/**
 * CAI Intake - Operation Resolver
 * 
 * Resolves shortcodes to full operation specifications.
 * Used during parsing to convert shortcode strings to structured operations.
 */

import {
  findEdgebandByCode,
  findGrooveByCode,
  findDrillingByCode,
  findCncByCode,
  incrementEdgebandUsage,
  incrementGrooveUsage,
  incrementDrillingUsage,
  incrementCncUsage,
} from "./service";
import {
  PartOperations,
  EdgeSide,
  codeToEdges,
  EdgebandOperation,
  GrooveOperation,
  DrillingOperation,
  CncOperation,
  HoleDefinition,
  RefCorner,
  ToolType,
} from "./types";

// Element types for holes and cnc arrays
type HoleSpec = NonNullable<PartOperations["holes"]>[number];
type CncSpec = NonNullable<PartOperations["cnc"]>[number];

export interface ResolvedOperations {
  edging?: PartOperations["edging"];
  grooves?: PartOperations["grooves"];
  holes?: PartOperations["holes"];
  cnc?: PartOperations["cnc"];
}

export interface OperationResolutionContext {
  organizationId?: string;
  trackUsage?: boolean;
}

/**
 * Parse and resolve all operations from shortcode strings
 */
export async function resolveOperations(
  input: {
    edgeCode?: string;
    grooveCodes?: string[];
    drillingCodes?: string[];
    cncCodes?: string[];
  },
  context: OperationResolutionContext = {}
): Promise<ResolvedOperations> {
  const result: ResolvedOperations = {};

  // Resolve edgebanding
  if (input.edgeCode) {
    result.edging = await resolveEdgebanding(input.edgeCode, context);
  }

  // Resolve grooves
  if (input.grooveCodes?.length) {
    result.grooves = [];
    for (const code of input.grooveCodes) {
      const grooves = await resolveGroove(code, context);
      if (grooves) {
        result.grooves.push(...grooves);
      }
    }
  }

  // Resolve drilling
  if (input.drillingCodes?.length) {
    result.holes = [];
    for (const code of input.drillingCodes) {
      const holes = await resolveDrilling(code, context);
      if (holes) {
        result.holes.push(holes);
      }
    }
  }

  // Resolve CNC
  if (input.cncCodes?.length) {
    result.cnc = [];
    for (const code of input.cncCodes) {
      const cnc = await resolveCnc(code, context);
      if (cnc) {
        result.cnc.push(cnc);
      }
    }
  }

  return result;
}

/**
 * Resolve edgebanding shortcode
 */
export async function resolveEdgebanding(
  code: string,
  context: OperationResolutionContext = {}
): Promise<PartOperations["edging"] | undefined> {
  // First try to find in database
  const op = await findEdgebandByCode(code, context.organizationId);

  if (op) {
    if (context.trackUsage) {
      await incrementEdgebandUsage(op.id);
    }
    return edgebandToPartOps(op);
  }

  // Fall back to parsing the code directly
  const edges = codeToEdges(code);
  if (edges.length === 0 && code.toUpperCase() !== "NONE" && code !== "0") {
    return undefined; // Invalid code
  }

  return {
    edges: {
      L1: { apply: edges.includes("L1") },
      L2: { apply: edges.includes("L2") },
      W1: { apply: edges.includes("W1") },
      W2: { apply: edges.includes("W2") },
    },
    summary: {
      code,
      edgeCount: edges.length,
    },
  };
}

/**
 * Resolve groove shortcode
 */
export async function resolveGroove(
  code: string,
  context: OperationResolutionContext = {}
): Promise<PartOperations["grooves"] | undefined> {
  const op = await findGrooveByCode(code, context.organizationId);

  if (op) {
    if (context.trackUsage) {
      await incrementGrooveUsage(op.id);
    }
    return grooveToPartOps(op);
  }

  // Try to parse inline groove spec: GL-4-10 or GW-6-8
  const parsed = parseInlineGroove(code);
  if (parsed) {
    return parsed;
  }

  return undefined;
}

/**
 * Resolve drilling shortcode
 */
export async function resolveDrilling(
  code: string,
  context: OperationResolutionContext = {}
): Promise<HoleSpec | undefined> {
  const op = await findDrillingByCode(code, context.organizationId);

  if (op) {
    if (context.trackUsage) {
      await incrementDrillingUsage(op.id);
    }
    return drillingToPartOps(op);
  }

  // Try to parse inline drilling spec
  const parsed = parseInlineDrilling(code);
  if (parsed) {
    return parsed;
  }

  return undefined;
}

/**
 * Resolve CNC shortcode
 */
export async function resolveCnc(
  code: string,
  context: OperationResolutionContext = {}
): Promise<CncSpec | undefined> {
  const op = await findCncByCode(code, context.organizationId);

  if (op) {
    if (context.trackUsage) {
      await incrementCncUsage(op.id);
    }
    return cncToPartOps(op);
  }

  // Try to parse inline CNC spec
  const parsed = parseInlineCnc(code);
  if (parsed) {
    return parsed;
  }

  return undefined;
}

// ============================================================
// CONVERTERS
// ============================================================

function edgebandToPartOps(op: EdgebandOperation): PartOperations["edging"] {
  return {
    edges: {
      L1: {
        apply: op.edges.includes("L1"),
        edgebandId: op.materialId,
        thicknessMm: op.thicknessMm,
      },
      L2: {
        apply: op.edges.includes("L2"),
        edgebandId: op.materialId,
        thicknessMm: op.thicknessMm,
      },
      W1: {
        apply: op.edges.includes("W1"),
        edgebandId: op.materialId,
        thicknessMm: op.thicknessMm,
      },
      W2: {
        apply: op.edges.includes("W2"),
        edgebandId: op.materialId,
        thicknessMm: op.thicknessMm,
      },
    },
    summary: {
      code: op.code,
      edgeCount: op.edges.length,
    },
  };
}

function grooveToPartOps(op: GrooveOperation): PartOperations["grooves"] {
  // Create a groove entry for the specified edge (or undefined if not specified)
  return op.edge
    ? [
        {
          edge: op.edge,
          widthMm: op.widthMm,
          depthMm: op.depthMm,
          offsetMm: op.offsetFromEdgeMm,
          face: "back" as const,
          code: op.code,
        },
      ]
    : [];
}

function drillingToPartOps(op: DrillingOperation): HoleSpec {
  return {
    kind: op.type?.code ?? "custom",
    holes: op.holes,
    refEdge: op.refEdge,
    refCorner: op.refCorner,
    hardware: op.hardwareBrand || op.hardwareModel
      ? { brand: op.hardwareBrand, model: op.hardwareModel }
      : undefined,
    code: op.code,
  };
}

function cncToPartOps(op: CncOperation): CncSpec {
  return {
    type: op.opType ?? "custom",
    params: (op.params ?? {}) as Record<string, string | number | boolean | string[]>,
    code: op.code,
  };
}

// ============================================================
// INLINE PARSERS
// ============================================================

/**
 * Parse inline groove specification
 * Format: GL-4-10 (Long edges, 4mm wide, 10mm deep)
 *         GW-6-8  (Width edges, 6mm wide, 8mm deep)
 *         G-4-10@15 (4mm wide, 10mm deep, 15mm offset)
 */
function parseInlineGroove(code: string): PartOperations["grooves"] | undefined {
  const upper = code.toUpperCase().trim();

  // Match patterns like GL-4-10, GW-6-8, G-4-10@15
  const match = upper.match(/^G([LW])?[-_]?(\d+(?:\.\d+)?)[X-](\d+(?:\.\d+)?)(?:[@](\d+(?:\.\d+)?))?$/);
  if (!match) return undefined;

  const edgeType = match[1]; // L, W, or undefined
  const widthMm = parseFloat(match[2]);
  const depthMm = parseFloat(match[3]);
  const offsetMm = match[4] ? parseFloat(match[4]) : 10;

  let edges: EdgeSide[];
  if (edgeType === "L") {
    edges = ["L1", "L2"];
  } else if (edgeType === "W") {
    edges = ["W1", "W2"];
  } else {
    edges = ["L1", "L2"]; // Default to long edges
  }

  return edges.map((edge) => ({
    edge,
    widthMm,
    depthMm,
    offsetMm,
    face: "back" as const,
    code,
  }));
}

/**
 * Parse inline drilling specification
 * Format: H2 (2 hinges), H3 (3 hinges)
 *         HD-96 (Handle 96mm)
 *         SP (Shelf pins)
 */
function parseInlineDrilling(code: string): HoleSpec | undefined {
  const upper = code.toUpperCase().trim();

  // Hinge pattern: H2, H3, etc.
  const hingeMatch = upper.match(/^H(\d+)(?:[-_](\d+))?$/);
  if (hingeMatch) {
    const count = parseInt(hingeMatch[1], 10);
    const offset = hingeMatch[2] ? parseInt(hingeMatch[2], 10) : 110;

    const holes = [];
    for (let i = 0; i < count; i++) {
      holes.push({
        x: offset + i * (count > 1 ? 352 : 0),
        y: 21.5,
        diaMm: 35,
        depthMm: 13,
      });
    }

    return {
      kind: "hinge",
      holes,
      refEdge: "L1",
      refCorner: "TL",
      code,
    };
  }

  // Handle pattern: HD-96, HD-128, etc.
  const handleMatch = upper.match(/^HD[-_]?(\d+)$/);
  if (handleMatch) {
    const spacing = parseInt(handleMatch[1], 10);
    return {
      kind: "handle",
      holes: [
        { x: 0, y: 0, diaMm: 5, through: true },
        { x: spacing, y: 0, diaMm: 5, through: true },
      ],
      refEdge: "L1",
      code,
    };
  }

  // Knob: KB
  if (upper === "KB" || upper === "KNOB") {
    return {
      kind: "knob",
      holes: [{ x: 0, y: 0, diaMm: 5, through: true }],
      refEdge: "L1",
      code,
    };
  }

  return undefined;
}

/**
 * Parse inline CNC specification
 * Format: PKT-50 (50mm pocket)
 *         RAD-10 (10mm radius)
 *         CHAM-3 (3mm chamfer)
 */
function parseInlineCnc(code: string): CncSpec | undefined {
  const upper = code.toUpperCase().trim();

  // Pocket: PKT-50, PKT-100, etc.
  const pocketMatch = upper.match(/^PKT[-_]?(\d+)$/);
  if (pocketMatch) {
    const diameter = parseInt(pocketMatch[1], 10);
    return {
      type: "pocket",
      params: { shape: "circle", diameter, depth: 10 },
      code,
    };
  }

  // Radius: RAD-5, RAD-10, etc.
  const radiusMatch = upper.match(/^RAD[-_]?(\d+)$/);
  if (radiusMatch) {
    const radius = parseInt(radiusMatch[1], 10);
    return {
      type: "radius",
      params: { corners: "all", radius },
      code,
    };
  }

  // Chamfer: CHAM-3, CHAM-5, etc.
  const chamferMatch = upper.match(/^CHAM[-_]?(\d+)$/);
  if (chamferMatch) {
    const size = parseInt(chamferMatch[1], 10);
    return {
      type: "chamfer",
      params: { edges: "all", size, angle: 45 },
      code,
    };
  }

  // Cutout: CUT-SINK, CUT-WIRE, etc.
  if (upper.startsWith("CUT-") || upper.startsWith("CUT_")) {
    const subtype = upper.slice(4);
    return {
      type: "cutout",
      params: { subtype: subtype.toLowerCase(), through: true },
      code,
    };
  }

  return undefined;
}

// ============================================================
// BATCH RESOLUTION
// ============================================================

/**
 * Resolve operations for multiple parts efficiently
 */
export async function resolveOperationsBatch(
  parts: Array<{
    edgeCode?: string;
    grooveCodes?: string[];
    drillingCodes?: string[];
    cncCodes?: string[];
  }>,
  context: OperationResolutionContext = {}
): Promise<ResolvedOperations[]> {
  // For now, just resolve sequentially
  // Future optimization: batch database queries
  const results: ResolvedOperations[] = [];

  for (const part of parts) {
    const resolved = await resolveOperations(part, context);
    results.push(resolved);
  }

  return results;
}

