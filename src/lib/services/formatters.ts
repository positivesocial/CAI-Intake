/**
 * CAI Intake - Service Formatters
 * 
 * Convert canonical internal types back to human-readable shortcodes
 * for display in the UI and exports.
 */

import type {
  EdgeBandSpec,
  GrooveSpec,
  HolePatternSpec,
  CncOperation,
  PartServices,
  EdgeSide,
} from "./canonical-types";
import { edgesToCode } from "./canonical-shortcodes";

// ============================================================
// EDGEBAND FORMATTING
// ============================================================

/**
 * Format EdgeBandSpec to canonical shortcode
 */
export function formatEdgebandCode(spec: EdgeBandSpec | undefined): string {
  if (!spec || !spec.edges || spec.edges.length === 0) {
    return "-";
  }
  
  return edgesToCode(spec.edges);
}

/**
 * Format EdgeBandSpec to human-readable description
 */
export function formatEdgebandDescription(spec: EdgeBandSpec | undefined): string {
  if (!spec || !spec.edges || spec.edges.length === 0) {
    return "No edgebanding";
  }
  
  const code = edgesToCode(spec.edges);
  const descriptions: Record<string, string> = {
    "0": "No edgebanding",
    "L1": "Front edge only",
    "L2": "Back edge only",
    "W1": "Left edge only",
    "W2": "Right edge only",
    "2L": "Both long edges",
    "2W": "Both width edges",
    "L2W": "Front + both width edges",
    "2L1W": "Both long + left edge",
    "2L2W": "All four edges",
  };
  
  const baseDesc = descriptions[code] ?? `Edges: ${spec.edges.join(", ")}`;
  
  if (spec.tapeId) {
    return `${baseDesc} (${spec.tapeId})`;
  }
  
  return baseDesc;
}

/**
 * Format edges as a visual representation
 * Returns a simple box diagram
 */
export function formatEdgesVisual(spec: EdgeBandSpec | undefined): string {
  if (!spec || !spec.edges || spec.edges.length === 0) {
    return "○───○\n│   │\n○───○";
  }
  
  const has = (edge: EdgeSide) => spec.edges.includes(edge);
  
  const topChar = has("W1") ? "●═══●" : "○───○";
  const bottomChar = has("W2") ? "●═══●" : "○───○";
  const leftChar = has("L1") ? "║" : "│";
  const rightChar = has("L2") ? "║" : "│";
  
  return `${topChar}\n${leftChar}   ${rightChar}\n${bottomChar}`;
}

// ============================================================
// GROOVE FORMATTING
// ============================================================

/**
 * Format GrooveSpec to canonical shortcode
 */
export function formatGrooveCode(spec: GrooveSpec): string {
  const edge = spec.onEdge;
  const width = spec.widthMm;
  const offset = spec.distanceFromEdgeMm;
  
  return `G${edge}-${width}-${offset}`;
}

/**
 * Format multiple grooves to a summary code
 */
export function formatGroovesCode(specs: GrooveSpec[] | undefined): string {
  if (!specs || specs.length === 0) {
    return "-";
  }
  
  if (specs.length === 1) {
    return formatGrooveCode(specs[0]);
  }
  
  // Check if all same width/offset
  const firstWidth = specs[0].widthMm;
  const firstOffset = specs[0].distanceFromEdgeMm;
  const allSame = specs.every(s => s.widthMm === firstWidth && s.distanceFromEdgeMm === firstOffset);
  
  if (allSame) {
    const edges = specs.map(s => s.onEdge).sort();
    if (edges.length === 4) {
      return `G-ALL-${firstWidth}-${firstOffset}`;
    }
    if (edges.includes("L1") && edges.includes("L2") && edges.length === 2) {
      return `GL-${firstWidth}-${firstOffset}`;
    }
    if (edges.includes("W1") && edges.includes("W2") && edges.length === 2) {
      return `GW-${firstWidth}-${firstOffset}`;
    }
  }
  
  // Multiple different grooves
  return specs.map(formatGrooveCode).join(", ");
}

/**
 * Format GrooveSpec to human-readable description
 */
export function formatGrooveDescription(spec: GrooveSpec): string {
  const edgeNames: Record<EdgeSide, string> = {
    L1: "front edge",
    L2: "back edge",
    W1: "left edge",
    W2: "right edge",
  };
  
  let desc = `${spec.widthMm}mm groove`;
  desc += ` on ${edgeNames[spec.onEdge]}`;
  desc += `, ${spec.distanceFromEdgeMm}mm from edge`;
  desc += `, ${spec.depthMm}mm deep`;
  
  if (spec.note) {
    desc += ` (${spec.note})`;
  }
  
  return desc;
}

// ============================================================
// HOLE PATTERN FORMATTING
// ============================================================

/**
 * Format HolePatternSpec to canonical shortcode
 */
export function formatHoleCode(spec: HolePatternSpec): string {
  switch (spec.kind) {
    case "hinge":
      return `H${spec.count ?? 2}-${spec.offsetsMm[0] ?? 100}`;
    case "handle":
      if (spec.offsetsMm.length >= 2) {
        const centers = spec.offsetsMm[1] - spec.offsetsMm[0];
        return `HD-CC${centers}`;
      }
      return "HD-STD";
    case "knob":
      if (spec.distanceFromEdgeMm === 0) {
        return "KN-CTR";
      }
      return `KN-${spec.offsetsMm[0] ?? 37}`;
    case "shelf_pins":
      return "SP-STD";
    case "system32":
      return "SP-32";
    case "drawer_slide":
      return "DS-STD";
    case "cam_lock":
      return "CAM-STD";
    case "dowel":
      return `DWL-${spec.count ?? 2}`;
    default:
      return `HOLE-${spec.kind.toUpperCase()}`;
  }
}

/**
 * Format multiple hole patterns to a summary code
 */
export function formatHolesCode(specs: HolePatternSpec[] | undefined): string {
  if (!specs || specs.length === 0) {
    return "-";
  }
  
  return specs.map(formatHoleCode).join(", ");
}

/**
 * Format HolePatternSpec to human-readable description
 */
export function formatHoleDescription(spec: HolePatternSpec): string {
  const kindNames: Record<string, string> = {
    hinge: "Hinge holes",
    shelf_pins: "Shelf pin holes",
    system32: "System 32 holes",
    handle: "Handle holes",
    knob: "Knob hole",
    drawer_slide: "Drawer slide holes",
    cam_lock: "Cam lock holes",
    dowel: "Dowel holes",
    custom: "Custom holes",
  };
  
  let desc = kindNames[spec.kind] ?? spec.kind;
  
  if (spec.kind === "hinge") {
    desc += ` (${spec.count ?? 2}x, ${spec.offsetsMm[0] ?? 100}mm from edge)`;
  } else if (spec.kind === "handle" && spec.offsetsMm.length >= 2) {
    desc += ` (${spec.offsetsMm[1] - spec.offsetsMm[0]}mm centers)`;
  } else if (spec.kind === "knob") {
    desc += spec.distanceFromEdgeMm === 0 ? " (centered)" : ` (${spec.offsetsMm[0]}mm from edge)`;
  }
  
  if (spec.hardwareId) {
    desc += ` - ${spec.hardwareId}`;
  }
  
  return desc;
}

// ============================================================
// CNC OPERATION FORMATTING
// ============================================================

/**
 * Format CncOperation to canonical shortcode
 */
export function formatCncCode(op: CncOperation): string {
  switch (op.type) {
    case "cutout":
      return `CUTOUT-${op.shapeId.toUpperCase()}-${op.params.width}x${op.params.height}`;
    case "radius":
      return `RADIUS-${op.params.radius}-${String(op.params.corners ?? "ALL").toUpperCase()}`;
    case "pocket":
      return `POCKET-${op.params.width}x${op.params.height}x${op.params.depth}`;
    case "contour":
      return `PROFILE-${op.shapeId.toUpperCase()}`;
    case "rebate":
      return `REBATE-${op.params.width}x${op.params.depth}`;
    case "chamfer":
      return `CHAMFER-${op.params.size ?? 3}`;
    case "text":
      return "TEXT";
    default:
      return `CNC-${op.shapeId.toUpperCase()}`;
  }
}

/**
 * Format multiple CNC operations to a summary code
 */
export function formatCncCodes(ops: CncOperation[] | undefined): string {
  if (!ops || ops.length === 0) {
    return "-";
  }
  
  return ops.map(formatCncCode).join(", ");
}

/**
 * Format CncOperation to human-readable description
 */
export function formatCncDescription(op: CncOperation): string {
  switch (op.type) {
    case "cutout":
      return `${op.shapeId} cutout (${op.params.width}x${op.params.height}mm)`;
    case "radius":
      return `${op.params.radius}mm corner radius (${op.params.corners ?? "all"} corners)`;
    case "pocket":
      return `Pocket ${op.params.width}x${op.params.height}mm, ${op.params.depth}mm deep`;
    case "contour":
      return `Edge profile: ${op.shapeId.replace(/_/g, " ")}`;
    case "rebate":
      return `Rebate ${op.params.width}x${op.params.depth}mm`;
    case "chamfer":
      return `${op.params.size ?? 3}mm chamfer`;
    case "text":
      return "Text engraving";
    default:
      return op.note ?? `CNC: ${op.shapeId}`;
  }
}

// ============================================================
// COMBINED SERVICES FORMATTING
// ============================================================

/**
 * Format all services to a compact summary string
 */
export function formatServicesSummary(services: PartServices | undefined): string {
  if (!services) {
    return "-";
  }
  
  const parts: string[] = [];
  
  if (services.edgeband?.edges && services.edgeband.edges.length > 0) {
    parts.push(`EB:${formatEdgebandCode(services.edgeband)}`);
  }
  
  if (services.grooves && services.grooves.length > 0) {
    parts.push(`GRV:${services.grooves.length}`);
  }
  
  if (services.holes && services.holes.length > 0) {
    parts.push(`HOLE:${services.holes.length}`);
  }
  
  if (services.cnc && services.cnc.length > 0) {
    parts.push(`CNC:${services.cnc.length}`);
  }
  
  return parts.length > 0 ? parts.join(" | ") : "-";
}

/**
 * Format all services to detailed lines
 */
export function formatServicesDetailed(services: PartServices | undefined): string[] {
  if (!services) {
    return ["No services"];
  }
  
  const lines: string[] = [];
  
  if (services.edgeband) {
    lines.push(`Edgeband: ${formatEdgebandDescription(services.edgeband)}`);
  }
  
  if (services.grooves) {
    for (const groove of services.grooves) {
      lines.push(`Groove: ${formatGrooveDescription(groove)}`);
    }
  }
  
  if (services.holes) {
    for (const hole of services.holes) {
      lines.push(`Holes: ${formatHoleDescription(hole)}`);
    }
  }
  
  if (services.cnc) {
    for (const op of services.cnc) {
      lines.push(`CNC: ${formatCncDescription(op)}`);
    }
  }
  
  return lines.length > 0 ? lines : ["No services"];
}

/**
 * Format services for tooltip display
 */
export function formatServicesTooltip(services: PartServices | undefined): string {
  return formatServicesDetailed(services).join("\n");
}



