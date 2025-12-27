/**
 * CAI Intake - System Default Operations
 * 
 * These are the default operations provided by CAI that organizations
 * can use directly or override with their own configurations.
 */

import {
  OperationTypeInput,
  EdgebandOperationInput,
  GrooveOperationInput,
  DrillingOperationInput,
  CncOperationInput,
} from "./types";

// ============================================================
// OPERATION TYPES (for dropdowns)
// ============================================================

export const SYSTEM_GROOVE_TYPES: OperationTypeInput[] = [
  {
    category: "groove",
    code: "back_panel",
    name: "Back Panel",
    description: "Groove for back panel insertion",
    displayOrder: 1,
  },
  {
    category: "groove",
    code: "drawer_bottom",
    name: "Drawer Bottom",
    description: "Groove for drawer bottom insertion",
    displayOrder: 2,
  },
  {
    category: "groove",
    code: "divider",
    name: "Divider",
    description: "Groove for vertical divider",
    displayOrder: 3,
  },
  {
    category: "groove",
    code: "light_channel",
    name: "Light Channel",
    description: "Channel for LED strip lighting",
    displayOrder: 4,
  },
  {
    category: "groove",
    code: "glass_panel",
    name: "Glass Panel",
    description: "Groove for glass panel insertion",
    displayOrder: 5,
  },
  {
    category: "groove",
    code: "custom",
    name: "Custom",
    description: "Custom groove for special applications",
    displayOrder: 99,
  },
];

export const SYSTEM_DRILLING_TYPES: OperationTypeInput[] = [
  {
    category: "drilling",
    code: "hinge",
    name: "Hinge Boring",
    description: "Cup hinge boring pattern",
    displayOrder: 1,
  },
  {
    category: "drilling",
    code: "shelf_pins",
    name: "Shelf Pins",
    description: "Shelf pin hole pattern",
    displayOrder: 2,
  },
  {
    category: "drilling",
    code: "handle",
    name: "Handle",
    description: "Handle/pull mounting holes",
    displayOrder: 3,
  },
  {
    category: "drilling",
    code: "knob",
    name: "Knob",
    description: "Single hole for knob",
    displayOrder: 4,
  },
  {
    category: "drilling",
    code: "drawer_slide",
    name: "Drawer Slide",
    description: "Drawer slide mounting holes",
    displayOrder: 5,
  },
  {
    category: "drilling",
    code: "cam_lock",
    name: "Cam Lock",
    description: "Cam lock assembly holes",
    displayOrder: 6,
  },
  {
    category: "drilling",
    code: "dowel",
    name: "Dowel",
    description: "Dowel holes for assembly",
    displayOrder: 7,
  },
  {
    category: "drilling",
    code: "system32",
    name: "System 32",
    description: "System 32 hole line (32mm spacing)",
    displayOrder: 8,
  },
  {
    category: "drilling",
    code: "custom",
    name: "Custom",
    description: "Custom drilling pattern",
    displayOrder: 99,
  },
];

export const SYSTEM_CNC_TYPES: OperationTypeInput[] = [
  {
    category: "cnc",
    code: "pocket",
    name: "Pocket",
    description: "Recessed pocket milling",
    displayOrder: 1,
  },
  {
    category: "cnc",
    code: "cutout",
    name: "Cutout",
    description: "Through cutout (sink, wire, etc.)",
    displayOrder: 2,
  },
  {
    category: "cnc",
    code: "chamfer",
    name: "Chamfer",
    description: "Edge chamfer/bevel",
    displayOrder: 3,
  },
  {
    category: "cnc",
    code: "radius",
    name: "Corner Radius",
    description: "Rounded corners",
    displayOrder: 4,
  },
  {
    category: "cnc",
    code: "rebate",
    name: "Rebate",
    description: "Edge rebate/rabbet",
    displayOrder: 5,
  },
  {
    category: "cnc",
    code: "contour",
    name: "Contour",
    description: "Custom contour profile",
    displayOrder: 6,
  },
  {
    category: "cnc",
    code: "text",
    name: "Text Engraving",
    description: "Engraved text or logo",
    displayOrder: 7,
  },
  {
    category: "cnc",
    code: "custom",
    name: "Custom",
    description: "Custom CNC operation",
    displayOrder: 99,
  },
];

export const ALL_SYSTEM_TYPES: OperationTypeInput[] = [
  ...SYSTEM_GROOVE_TYPES,
  ...SYSTEM_DRILLING_TYPES,
  ...SYSTEM_CNC_TYPES,
];

// ============================================================
// EDGEBAND OPERATIONS
// ============================================================

export const SYSTEM_EDGEBAND_OPERATIONS: EdgebandOperationInput[] = [
  // All edges
  {
    code: "2L2W",
    name: "All Edges",
    description: "Edge band all 4 edges",
    edges: ["L1", "L2", "W1", "W2"],
  },
  {
    code: "ALL",
    name: "All Edges",
    description: "Edge band all 4 edges",
    edges: ["L1", "L2", "W1", "W2"],
  },
  // Long edges only
  {
    code: "2L",
    name: "Both Long Edges",
    description: "Edge band both long edges",
    edges: ["L1", "L2"],
  },
  // Width edges only
  {
    code: "2W",
    name: "Both Width Edges",
    description: "Edge band both width edges",
    edges: ["W1", "W2"],
  },
  // Single edges
  {
    code: "L1",
    name: "Long 1",
    description: "Edge band long edge 1 only",
    edges: ["L1"],
  },
  {
    code: "L2",
    name: "Long 2",
    description: "Edge band long edge 2 only",
    edges: ["L2"],
  },
  {
    code: "W1",
    name: "Width 1",
    description: "Edge band width edge 1 only",
    edges: ["W1"],
  },
  {
    code: "W2",
    name: "Width 2",
    description: "Edge band width edge 2 only",
    edges: ["W2"],
  },
  // Combinations
  {
    code: "2LW",
    name: "2 Long + 1 Width",
    description: "Edge band both long edges and one width",
    edges: ["L1", "L2", "W1"],
  },
  {
    code: "L2W",
    name: "1 Long + 2 Width",
    description: "Edge band one long edge and both widths",
    edges: ["L1", "W1", "W2"],
  },
  {
    code: "LW",
    name: "1 Long + 1 Width",
    description: "Edge band one long and one width edge",
    edges: ["L1", "W1"],
  },
  // None
  {
    code: "NONE",
    name: "No Edgebanding",
    description: "No edge banding applied",
    edges: [],
  },
];

// ============================================================
// GROOVE OPERATIONS
// ============================================================

export const SYSTEM_GROOVE_OPERATIONS: GrooveOperationInput[] = [
  // Back panel grooves
  {
    code: "GL-4-10",
    name: "Back Panel 4mm",
    description: "4mm groove at 10mm offset for back panel",
    widthMm: 4,
    depthMm: 10,
    offsetFromEdgeMm: 10,
    edge: "L1",
  },
  {
    code: "GL-6-10",
    name: "Back Panel 6mm",
    description: "6mm groove at 10mm offset for back panel",
    widthMm: 6,
    depthMm: 10,
    offsetFromEdgeMm: 10,
    edge: "L1",
  },
  {
    code: "GW-4-10",
    name: "Drawer Bottom 4mm (Width)",
    description: "4mm groove on width edges for drawer bottom",
    widthMm: 4,
    depthMm: 10,
    offsetFromEdgeMm: 10,
    edge: "W1",
  },
  {
    code: "BP",
    name: "Back Panel Standard",
    description: "Standard back panel groove",
    widthMm: 4,
    depthMm: 10,
    offsetFromEdgeMm: 10,
  },
  {
    code: "DB",
    name: "Drawer Bottom Standard",
    description: "Standard drawer bottom groove on 3 sides",
    widthMm: 4,
    depthMm: 10,
    offsetFromEdgeMm: 12.5,
  },
];

// ============================================================
// DRILLING OPERATIONS
// ============================================================

export const SYSTEM_DRILLING_OPERATIONS: DrillingOperationInput[] = [
  // Hinge patterns
  {
    code: "H2",
    name: "2 Hinges",
    description: "2 hinge boring cups at standard positions",
    holes: [
      { x: 110, y: 21.5, diaMm: 35, depthMm: 13 },
      { x: 462, y: 21.5, diaMm: 35, depthMm: 13 },
    ],
    refEdge: "L1",
    refCorner: "TL",
  },
  {
    code: "H3",
    name: "3 Hinges",
    description: "3 hinge boring cups for tall doors",
    holes: [
      { x: 110, y: 21.5, diaMm: 35, depthMm: 13 },
      { x: 286, y: 21.5, diaMm: 35, depthMm: 13 },
      { x: 462, y: 21.5, diaMm: 35, depthMm: 13 },
    ],
    refEdge: "L1",
    refCorner: "TL",
  },
  {
    code: "H2-110",
    name: "2 Hinges @ 110mm",
    description: "2 hinge boring cups at 110mm from edges",
    holes: [
      { x: 110, y: 21.5, diaMm: 35, depthMm: 13 },
      { x: -110, y: 21.5, diaMm: 35, depthMm: 13 }, // negative = from opposite end
    ],
    refEdge: "L1",
    refCorner: "TL",
  },
  // Handle patterns
  {
    code: "HD-96",
    name: "Handle 96mm",
    description: "96mm center-to-center handle holes",
    holes: [
      { x: 0, y: 0, diaMm: 5, through: true },
      { x: 96, y: 0, diaMm: 5, through: true },
    ],
    refEdge: "L1",
  },
  {
    code: "HD-128",
    name: "Handle 128mm",
    description: "128mm center-to-center handle holes",
    holes: [
      { x: 0, y: 0, diaMm: 5, through: true },
      { x: 128, y: 0, diaMm: 5, through: true },
    ],
    refEdge: "L1",
  },
  {
    code: "HD-160",
    name: "Handle 160mm",
    description: "160mm center-to-center handle holes",
    holes: [
      { x: 0, y: 0, diaMm: 5, through: true },
      { x: 160, y: 0, diaMm: 5, through: true },
    ],
    refEdge: "L1",
  },
  // Knob
  {
    code: "KB",
    name: "Knob",
    description: "Single knob hole",
    holes: [{ x: 0, y: 0, diaMm: 5, through: true }],
    refEdge: "L1",
  },
  // System 32
  {
    code: "S32",
    name: "System 32 Line",
    description: "System 32 shelf pin holes (32mm spacing)",
    holes: [],
    refEdge: "L1",
  },
  {
    code: "SP32",
    name: "Shelf Pins 32mm",
    description: "System 32 shelf pin line",
    holes: [],
    refEdge: "L1",
  },
  // Cam lock
  {
    code: "CAM",
    name: "Cam Lock",
    description: "Cam lock assembly holes",
    holes: [
      { x: 8, y: 34, diaMm: 15, depthMm: 12.5 }, // cam hole
      { x: 8, y: 0, diaMm: 8, depthMm: 34 },      // dowel
    ],
    refEdge: "W1",
    refCorner: "TL",
  },
];

// ============================================================
// CNC OPERATIONS
// ============================================================

export const SYSTEM_CNC_OPERATIONS: CncOperationInput[] = [
  // Pockets
  {
    code: "PKT-50",
    name: "50mm Pocket",
    description: "50mm diameter pocket",
    opType: "pocket",
    params: {
      shape: "circle",
      diameter: 50,
      depth: 10,
    },
  },
  {
    code: "PKT-REC",
    name: "Rectangular Pocket",
    description: "Rectangular pocket (specify dimensions)",
    opType: "pocket",
    params: {
      shape: "rectangle",
      width: 100,
      length: 50,
      depth: 10,
      cornerRadius: 5,
    },
  },
  // Cutouts
  {
    code: "CUT-SINK",
    name: "Sink Cutout",
    description: "Rectangular cutout for undermount sink",
    opType: "cutout",
    params: {
      shape: "rectangle",
      width: 600,
      length: 400,
      cornerRadius: 20,
      through: true,
    },
  },
  {
    code: "CUT-WIRE",
    name: "Wire Grommet",
    description: "60mm diameter wire grommet hole",
    opType: "cutout",
    params: {
      shape: "circle",
      diameter: 60,
      through: true,
    },
  },
  // Corner radius
  {
    code: "RAD-5",
    name: "5mm Corner Radius",
    description: "5mm radius on all corners",
    opType: "radius",
    params: {
      corners: "all",
      radius: 5,
    },
  },
  {
    code: "RAD-10",
    name: "10mm Corner Radius",
    description: "10mm radius on all corners",
    opType: "radius",
    params: {
      corners: "all",
      radius: 10,
    },
  },
  // Chamfer
  {
    code: "CHAM-3",
    name: "3mm Chamfer",
    description: "3mm chamfer on all edges",
    opType: "chamfer",
    params: {
      edges: "all",
      size: 3,
      angle: 45,
    },
  },
  // Rebate
  {
    code: "RBT-10",
    name: "10mm Rebate",
    description: "10mm x 10mm rebate",
    opType: "rebate",
    params: {
      edges: ["L1", "L2"],
      width: 10,
      depth: 10,
    },
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

/**
 * Get all system default operations for seeding the database
 */
export function getSystemDefaults() {
  return {
    operationTypes: ALL_SYSTEM_TYPES,
    edgebandOperations: SYSTEM_EDGEBAND_OPERATIONS,
    grooveOperations: SYSTEM_GROOVE_OPERATIONS,
    drillingOperations: SYSTEM_DRILLING_OPERATIONS,
    cncOperations: SYSTEM_CNC_OPERATIONS,
  };
}

