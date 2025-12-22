/**
 * CAI Intake - Default Service Dialect
 * 
 * Sensible defaults for interpreting service notations.
 * Organizations can override these with their own dialect configs.
 */

import type { OrgServiceDialect } from "./dialect-types";

/**
 * Default dialect configuration
 * 
 * This handles the most common formats used across industries:
 * - "X" and "XX" for edgebanding (X = one edge, XX = both)
 * - Common aliases like "All", "4S", "Full" for all edges
 * - Standard groove notation
 * - Common hardware patterns
 */
export const DEFAULT_DIALECT: OrgServiceDialect = {
  organizationId: null, // Global default
  name: "CabinetAI Default",
  description: "Standard dialect supporting common industry formats",
  
  // ============================================================
  // EDGEBANDING
  // ============================================================
  edgeband: {
    aliases: {
      // All edges
      "ALL": "2L2W",
      "4": "2L2W",
      "4S": "2L2W",
      "4SIDES": "2L2W",
      "FULL": "2L2W",
      "COMPLETE": "2L2W",
      "XXXX": "2L2W",
      
      // Long edges
      "LONG": "2L",
      "LONGS": "2L",
      "LL": "2L",
      
      // Width edges
      "SHORT": "2W",
      "SHORTS": "2W",
      "WW": "2W",
      "WIDTH": "2W",
      
      // Single edges (lowercase tolerance)
      "l": "L1",
      "w": "W1",
      
      // Common typos and variations
      "2L2W1": "2L2W", // Typo
      "LW": "L2W",     // One long, one width (ambiguous but common)
      "WL": "L2W",
    },
    
    yesValues: [
      "X", "XX", "XXX", "XXXX",
      "Y", "YES", 
      "1", 1, 
      "TRUE", true,
      "✓", "✔", "●",
      "*",
    ],
    
    noValues: [
      "", "-", "0", 0,
      "N", "NO",
      "FALSE", false,
      "NONE",
      "○", "·",
    ],
    
    defaultIfBlank: undefined, // No default - explicit is better
    
    columnMappings: {
      L1: ["L1", "LONG1", "EDGE L1", "EDGING L1", "EDGEBAND L1", "EB L1"],
      L2: ["L2", "LONG2", "EDGE L2", "EDGING L2", "EDGEBAND L2", "EB L2"],
      W1: ["W1", "WIDTH1", "SHORT1", "EDGE W1", "EDGING W1", "EDGEBAND W1", "EB W1"],
      W2: ["W2", "WIDTH2", "SHORT2", "EDGE W2", "EDGING W2", "EDGEBAND W2", "EB W2"],
      long: ["L", "LONG", "LONG EDGES", "EDGING L", "EDGEBAND L", "LENGTH"],
      width: ["W", "WIDTH", "SHORT", "SHORT EDGES", "EDGING W", "EDGEBAND W", "BREADTH"],
      all: ["ALL", "ALL EDGES", "4 SIDES", "EDGING", "EDGEBAND", "EB"],
    },
  },
  
  // ============================================================
  // GROOVES
  // ============================================================
  groove: {
    aliases: {
      // Back panel grooves
      "BACK": "GW2-4-10",
      "BACKPANEL": "GW2-4-10",
      "BACK PANEL": "GW2-4-10",
      "BP": "GW2-4-10",
      
      // Drawer bottom grooves
      "BOTTOM": "GW1-4-12",
      "BTM": "GW1-4-12",
      "DRAWER": "GW1-4-12",
      "DRAWER BTM": "GW1-4-12",
      
      // All edges
      "ALL": "G-ALL-4-10",
      "4S": "G-ALL-4-10",
      
      // Standard sizes
      "4MM": "G-4-10",
      "3MM": "G-3-10",
    },
    
    defaultWidthMm: 4,
    defaultDepthMm: 10,
    defaultOffsetMm: 10,
    
    yesValues: [
      "X", "Y", "YES", 
      "1", 1, 
      "TRUE", true,
      "✓", "G",
    ],
    
    noValues: [
      "", "-", "0", 0,
      "N", "NO",
      "FALSE", false,
      "NONE",
    ],
    
    columnMappings: {
      long: ["GROOVE L", "GRV L", "GROOVE LONG"],
      width: ["GROOVE W", "GRV W", "GROOVE WIDTH", "GROOVE SHORT"],
      all: ["GROOVE", "GRV", "GROOVES"],
      back: ["GROOVE BACK", "BACK GROOVE", "BP GROOVE", "BACK PANEL"],
      bottom: ["GROOVE BTM", "BTM GROOVE", "DRAWER GROOVE"],
    },
  },
  
  // ============================================================
  // DRILLING
  // ============================================================
  drilling: {
    hingePatterns: {
      // Standard hinge patterns (mm from top/bottom)
      "STD": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 2 },
      "110": { refEdge: "L1", offsetsMm: [110], distanceFromEdgeMm: 22, count: 2 },
      "100": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 2 },
      "90": { refEdge: "L1", offsetsMm: [90], distanceFromEdgeMm: 22, count: 2 },
      
      // 3-hinge patterns
      "3H-110": { refEdge: "L1", offsetsMm: [110], distanceFromEdgeMm: 22, count: 3 },
      "3H-100": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 3 },
      "3H-90": { refEdge: "L1", offsetsMm: [90], distanceFromEdgeMm: 22, count: 3 },
      
      // Common hinge brands
      "BLUM": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 2, hardwareId: "Blum ClipTop" },
      "HETTICH": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 2, hardwareId: "Hettich Sensys" },
      "GRASS": { refEdge: "L1", offsetsMm: [100], distanceFromEdgeMm: 22, count: 2, hardwareId: "Grass Tiomos" },
    },
    
    shelfPatterns: {
      // Shelf pin patterns
      "32MM": { refEdge: "L1", offsetsMm: [37, 69, 101], distanceFromEdgeMm: 37 },
      "32": { refEdge: "L1", offsetsMm: [37, 69, 101], distanceFromEdgeMm: 37 },
      "SYSTEM32": { refEdge: "L1", offsetsMm: [37, 69, 101], distanceFromEdgeMm: 37 },
      "STD": { refEdge: "L1", offsetsMm: [50, 100, 150], distanceFromEdgeMm: 35 },
      "FULL": { refEdge: "L1", offsetsMm: [], distanceFromEdgeMm: 37, note: "Full column" },
    },
    
    handlePatterns: {
      // Handle center-to-center distances
      "96": { refEdge: "L1", offsetsMm: [0, 96], distanceFromEdgeMm: 30 },
      "CC96": { refEdge: "L1", offsetsMm: [0, 96], distanceFromEdgeMm: 30 },
      "128": { refEdge: "L1", offsetsMm: [0, 128], distanceFromEdgeMm: 30 },
      "CC128": { refEdge: "L1", offsetsMm: [0, 128], distanceFromEdgeMm: 30 },
      "160": { refEdge: "L1", offsetsMm: [0, 160], distanceFromEdgeMm: 30 },
      "CC160": { refEdge: "L1", offsetsMm: [0, 160], distanceFromEdgeMm: 30 },
      "192": { refEdge: "L1", offsetsMm: [0, 192], distanceFromEdgeMm: 30 },
      "256": { refEdge: "L1", offsetsMm: [0, 256], distanceFromEdgeMm: 30 },
    },
    
    knobPatterns: {
      "CENTER": { refEdge: "L1", offsetsMm: [], distanceFromEdgeMm: 0, note: "Center of part" },
      "CTR": { refEdge: "L1", offsetsMm: [], distanceFromEdgeMm: 0, note: "Center of part" },
      "37": { refEdge: "W1", offsetsMm: [37], distanceFromEdgeMm: 37 },
    },
    
    aliases: {
      "HINGE": "H2-100",
      "HINGES": "H2-100",
      "2H": "H2-100",
      "3H": "H3-100",
      "SHELF": "SP-32",
      "SHELVES": "SP-32",
      "PINS": "SP-32",
      "HANDLE": "HD-CC96",
      "PULL": "HD-CC128",
      "KNOB": "KN-CTR",
    },
  },
  
  // ============================================================
  // CNC
  // ============================================================
  cnc: {
    macros: {
      // Standard cutouts
      "SINK-600x500": {
        type: "cutout",
        shapeId: "sink_rect",
        params: { width: 600, height: 500 },
        note: "Standard sink cutout",
      },
      "SINK-800x500": {
        type: "cutout",
        shapeId: "sink_rect",
        params: { width: 800, height: 500 },
        note: "Large sink cutout",
      },
      "HOB-580x510": {
        type: "cutout",
        shapeId: "hob_rect",
        params: { width: 580, height: 510 },
        note: "Standard hob cutout",
      },
      
      // Corner radii
      "R3": {
        type: "radius",
        shapeId: "corner_radius",
        params: { radius: 3, corners: "all" },
      },
      "R6": {
        type: "radius",
        shapeId: "corner_radius",
        params: { radius: 6, corners: "all" },
      },
      "R25-FRONT": {
        type: "radius",
        shapeId: "corner_radius",
        params: { radius: 25, corners: "front" },
      },
      
      // Edge profiles
      "OGEE": {
        type: "contour",
        shapeId: "ogee_profile",
        params: {},
      },
      "BEVEL-45": {
        type: "contour",
        shapeId: "bevel_profile",
        params: { angle: 45 },
      },
      "ROUNDOVER": {
        type: "contour",
        shapeId: "round_profile",
        params: { radius: 3 },
      },
    },
    
    aliases: {
      "SINK": "SINK-600x500",
      "HOB": "HOB-580x510",
      "COOKTOP": "HOB-580x510",
      "RADIUS": "R3",
      "ROUNDED": "R3",
      "CUSTOM": "CUSTOM",
    },
  },
  
  useAiFallback: true,
  autoLearn: true,
};

/**
 * Get the default dialect
 */
export function getDefaultDialect(): OrgServiceDialect {
  return { ...DEFAULT_DIALECT };
}

/**
 * Merge organization dialect with defaults
 */
export function mergeWithDefaults(
  orgDialect: Partial<OrgServiceDialect>
): OrgServiceDialect {
  return {
    ...DEFAULT_DIALECT,
    ...orgDialect,
    edgeband: {
      ...DEFAULT_DIALECT.edgeband,
      ...orgDialect.edgeband,
      aliases: {
        ...DEFAULT_DIALECT.edgeband.aliases,
        ...orgDialect.edgeband?.aliases,
      },
      yesValues: orgDialect.edgeband?.yesValues ?? DEFAULT_DIALECT.edgeband.yesValues,
      noValues: orgDialect.edgeband?.noValues ?? DEFAULT_DIALECT.edgeband.noValues,
      columnMappings: {
        ...DEFAULT_DIALECT.edgeband.columnMappings,
        ...orgDialect.edgeband?.columnMappings,
      },
    },
    groove: {
      ...DEFAULT_DIALECT.groove,
      ...orgDialect.groove,
      aliases: {
        ...DEFAULT_DIALECT.groove.aliases,
        ...orgDialect.groove?.aliases,
      },
      columnMappings: {
        ...DEFAULT_DIALECT.groove.columnMappings,
        ...orgDialect.groove?.columnMappings,
      },
    },
    drilling: {
      ...DEFAULT_DIALECT.drilling,
      ...orgDialect.drilling,
      hingePatterns: {
        ...DEFAULT_DIALECT.drilling.hingePatterns,
        ...orgDialect.drilling?.hingePatterns,
      },
      shelfPatterns: {
        ...DEFAULT_DIALECT.drilling.shelfPatterns,
        ...orgDialect.drilling?.shelfPatterns,
      },
      handlePatterns: {
        ...DEFAULT_DIALECT.drilling.handlePatterns,
        ...orgDialect.drilling?.handlePatterns,
      },
      aliases: {
        ...DEFAULT_DIALECT.drilling.aliases,
        ...orgDialect.drilling?.aliases,
      },
    },
    cnc: {
      ...DEFAULT_DIALECT.cnc,
      ...orgDialect.cnc,
      macros: {
        ...DEFAULT_DIALECT.cnc.macros,
        ...orgDialect.cnc?.macros,
      },
      aliases: {
        ...DEFAULT_DIALECT.cnc.aliases,
        ...orgDialect.cnc?.aliases,
      },
    },
  };
}




