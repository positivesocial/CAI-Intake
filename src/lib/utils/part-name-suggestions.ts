/**
 * Part Name → Operations Suggestions
 * 
 * Intelligent matching of part names to suggested operations.
 * These appear as "ghost chips" that users can accept or ignore.
 */

import type { OperationsData } from "@/components/operations";

// ============================================================
// PATTERN DEFINITIONS
// ============================================================

interface NamePattern {
  /** Patterns to match (lowercase) */
  patterns: RegExp[];
  /** Display name for the suggestion */
  name: string;
  /** Description shown to user */
  description: string;
  /** Suggested operations */
  ops: Partial<OperationsData>;
}

const NAME_PATTERNS: NamePattern[] = [
  // Doors - all edges banded
  {
    patterns: [
      /^door$/i,
      /\bdoor\b/i,
      /\bdoors\b/i,
      /cabinet\s*door/i,
      /^dr\b/i,
    ],
    name: "Door",
    description: "All 4 edges banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: true, W1: true, W2: true },
      },
    },
  },

  // Drawer fronts - all edges banded
  {
    patterns: [
      /drawer\s*front/i,
      /drawer\s*face/i,
      /df\d*/i,
      /^df$/i,
    ],
    name: "Drawer Front",
    description: "All 4 edges banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: true, W1: true, W2: true },
      },
    },
  },

  // Shelves - front edge only
  {
    patterns: [
      /^shelf$/i,
      /\bshelf\b/i,
      /\bshelves\b/i,
      /^shlf/i,
      /^sh\d/i,
      /adjustable\s*shelf/i,
    ],
    name: "Shelf",
    description: "Front edge banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
    },
  },

  // Fixed shelf - front edge + dado grooves
  {
    patterns: [
      /fixed\s*shelf/i,
      /permanent\s*shelf/i,
    ],
    name: "Fixed Shelf",
    description: "Front edge + dado grooves",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
      grooves: [
        { type_code: "DADO", side: "W1", width_mm: 4, depth_mm: 8 },
        { type_code: "DADO", side: "W2", width_mm: 4, depth_mm: 8 },
      ],
    },
  },

  // Side panels - front edge + back groove
  {
    patterns: [
      /^side$/i,
      /\bside\b.*panel/i,
      /side\s*panel/i,
      /gable/i,
      /^sp\d*/i,
      /end\s*panel/i,
      /left\s*side/i,
      /right\s*side/i,
    ],
    name: "Side Panel",
    description: "Front edge + back groove",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
      grooves: [
        { type_code: "BPG", side: "W2", width_mm: 4, depth_mm: 8 },
      ],
    },
  },

  // Top/Bottom panels - front edge + back groove
  {
    patterns: [
      /^top$/i,
      /^bottom$/i,
      /top\s*panel/i,
      /bottom\s*panel/i,
      /horizontal\s*panel/i,
      /cabinet\s*top/i,
      /cabinet\s*bottom/i,
    ],
    name: "Top/Bottom",
    description: "Front edge + back groove",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
      grooves: [
        { type_code: "BPG", side: "W2", width_mm: 4, depth_mm: 8 },
      ],
    },
  },

  // Back panels - no operations
  {
    patterns: [
      /^back$/i,
      /back\s*panel/i,
      /\bback\b/i,
      /^bp\d*/i,
    ],
    name: "Back Panel",
    description: "No edging (fits in groove)",
    ops: {
      edgebanding: {
        sides: { L1: false, L2: false, W1: false, W2: false },
      },
    },
  },

  // Kick board / Plinth - front edge
  {
    patterns: [
      /kick/i,
      /plinth/i,
      /toe\s*kick/i,
      /toe\s*board/i,
      /base\s*board/i,
      /skirting/i,
    ],
    name: "Kick Board",
    description: "Front edge banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
    },
  },

  // Drawer box sides - no edging typically
  {
    patterns: [
      /drawer\s*side/i,
      /drawer\s*box\s*side/i,
      /db\s*side/i,
    ],
    name: "Drawer Side",
    description: "No edging",
    ops: {
      edgebanding: {
        sides: { L1: false, L2: false, W1: false, W2: false },
      },
    },
  },

  // Drawer box front/back
  {
    patterns: [
      /drawer\s*box\s*front/i,
      /drawer\s*box\s*back/i,
      /drawer\s*back/i,
      /db\s*front/i,
      /db\s*back/i,
    ],
    name: "Drawer Box F/B",
    description: "No edging",
    ops: {
      edgebanding: {
        sides: { L1: false, L2: false, W1: false, W2: false },
      },
    },
  },

  // Drawer bottom
  {
    patterns: [
      /drawer\s*bottom/i,
      /drawer\s*base/i,
      /db\s*bottom/i,
    ],
    name: "Drawer Bottom",
    description: "No edging",
    ops: {
      edgebanding: {
        sides: { L1: false, L2: false, W1: false, W2: false },
      },
    },
  },

  // Partition / Divider - both long edges
  {
    patterns: [
      /partition/i,
      /divider/i,
      /vertical\s*divider/i,
    ],
    name: "Divider",
    description: "Both long edges",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: true, W1: false, W2: false },
      },
    },
  },

  // Counter top / Worktop - all visible edges
  {
    patterns: [
      /counter/i,
      /worktop/i,
      /benchtop/i,
      /work\s*surface/i,
    ],
    name: "Countertop",
    description: "Visible edges banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: true, W2: true },
      },
    },
  },

  // Rail / stretcher - front edge
  {
    patterns: [
      /\brail\b/i,
      /stretcher/i,
      /cross\s*member/i,
    ],
    name: "Rail",
    description: "Front edge banded",
    ops: {
      edgebanding: {
        sides: { L1: true, L2: false, W1: false, W2: false },
      },
    },
  },
];

// ============================================================
// MATCHING FUNCTION
// ============================================================

export interface NameSuggestion {
  name: string;
  description: string;
  ops: Partial<OperationsData>;
  confidence: number;
}

/**
 * Get operation suggestions based on part name
 */
export function getNameSuggestions(partName: string): NameSuggestion | null {
  if (!partName || partName.trim().length < 2) {
    return null;
  }

  const normalizedName = partName.trim().toLowerCase();

  for (const pattern of NAME_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(normalizedName)) {
        return {
          name: pattern.name,
          description: pattern.description,
          ops: pattern.ops,
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Check if current operations already match suggestion
 */
export function operationsMatchSuggestion(
  currentOps: OperationsData,
  suggestionOps: Partial<OperationsData>
): boolean {
  // Check edgebanding
  if (suggestionOps.edgebanding) {
    const suggestedSides = suggestionOps.edgebanding.sides || {};
    const currentSides = currentOps.edgebanding?.sides || {};
    
    for (const [side, value] of Object.entries(suggestedSides)) {
      if (currentSides[side as keyof typeof currentSides] !== value) {
        return false;
      }
    }
  }

  // Check grooves
  if (suggestionOps.grooves && suggestionOps.grooves.length > 0) {
    if (!currentOps.grooves || currentOps.grooves.length < suggestionOps.grooves.length) {
      return false;
    }
  }

  return true;
}

/**
 * Apply suggestion to operations
 */
export function applySuggestionToOps(
  currentOps: OperationsData,
  suggestionOps: Partial<OperationsData>,
  defaultEdgebandId?: string
): OperationsData {
  const result = { ...currentOps };

  // Apply edgebanding
  if (suggestionOps.edgebanding) {
    result.edgebanding = {
      edgeband_id: defaultEdgebandId || currentOps.edgebanding?.edgeband_id,
      sides: {
        ...(currentOps.edgebanding?.sides || { L1: false, L2: false, W1: false, W2: false }),
        ...suggestionOps.edgebanding.sides,
      },
    };
  }

  // Apply grooves
  if (suggestionOps.grooves && suggestionOps.grooves.length > 0) {
    result.grooves = [
      ...(currentOps.grooves || []),
      ...suggestionOps.grooves,
    ];
  }

  // Apply holes
  if (suggestionOps.holes && suggestionOps.holes.length > 0) {
    result.holes = [
      ...(currentOps.holes || []),
      ...suggestionOps.holes,
    ];
  }

  // Apply CNC
  if (suggestionOps.cnc && suggestionOps.cnc.length > 0) {
    result.cnc = [
      ...(currentOps.cnc || []),
      ...suggestionOps.cnc,
    ];
  }

  return result;
}

/**
 * Format suggestion as shortcode text
 */
export function formatSuggestionAsShortcode(ops: Partial<OperationsData>): string {
  const parts: string[] = [];

  if (ops.edgebanding?.sides) {
    const sides = Object.entries(ops.edgebanding.sides)
      .filter(([, v]) => v)
      .map(([k]) => k);
    
    if (sides.length === 4) {
      parts.push("EB:4");
    } else if (sides.length > 0) {
      parts.push(`EB:${sides.join("+")}`);
    }
  }

  if (ops.grooves && ops.grooves.length > 0) {
    const sides = ops.grooves.map(g => g.side).join("+");
    parts.push(`GR:${sides}`);
  }

  return parts.join(" ");
}


