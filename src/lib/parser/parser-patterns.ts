/**
 * CAI Intake - Parser Patterns
 * 
 * Configurable regex patterns for parsing cutlist text input.
 * These patterns support various formats used in woodworking shops.
 */

// ============================================================
// DIMENSION PATTERNS
// ============================================================

/**
 * Matches dimensions in various formats:
 * - 720x560, 720X560, 720×560
 * - 720 x 560, 720 X 560
 * - 720mm x 560mm, 720 mm x 560 mm
 * - 720mmx560mm (no spaces)
 * 
 * Captures: [full match, length, width]
 */
export const DIMENSION_PATTERNS = [
  // Format: 720x560, 720X560, 720×560 (with optional mm/cm/in units)
  /(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?/i,
  
  // Format: 720 by 560
  /(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?\s*by\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?/i,
  
  // Format: L720 W560 or L:720 W:560
  /L[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?\s*W[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?/i,
  
  // Format: length 720 width 560
  /length[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?\s*width[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|in)?/i,
];

// ============================================================
// QUANTITY PATTERNS
// ============================================================

/**
 * Matches quantities in various formats:
 * - qty 2, qty:2, qty=2
 * - x2, X2, ×2
 * - 2pcs, 2 pcs, 2 pieces
 * - q2, Q2
 * - (2), [2]
 * 
 * Captures: [full match, quantity]
 */
export const QUANTITY_PATTERNS = [
  // Format: qty 2, qty:2, qty=2, quantity 2
  /(?:qty|quantity)[:\s=]*(\d+)/i,
  
  // Format: x2, X2, ×2, *2
  /[x×\*]\s*(\d+)/i,
  
  // Format: 2pcs, 2 pcs, 2 pieces, 2 pc
  /(\d+)\s*(?:pcs?|pieces?)/i,
  
  // Format: q2, Q2
  /\bq(\d+)\b/i,
  
  // Format: (2), [2] at end of line
  /[(\[]\s*(\d+)\s*[)\]]$/,
  
  // Format: times 2, "times two"
  /times\s*(\d+)/i,
];

// ============================================================
// THICKNESS PATTERNS
// ============================================================

/**
 * Matches thickness in various formats:
 * - 18mm, 18 mm
 * - t18, T18, t:18
 * - thk 18, thk:18, thickness 18
 * 
 * Captures: [full match, thickness]
 */
export const THICKNESS_PATTERNS = [
  // Format: t18, T18, t:18, t=18
  /\bt[:\s=]*(\d+(?:\.\d+)?)\s*(?:mm)?\b/i,
  
  // Format: thk 18, thk:18, thickness 18
  /(?:thk|thickness)[:\s=]*(\d+(?:\.\d+)?)\s*(?:mm)?/i,
  
  // Standalone mm value that's likely thickness (12-50mm range)
  /\b(1[2-9]|[2-4]\d|50)\s*mm\b/,
];

// ============================================================
// GRAIN/ROTATION PATTERNS
// ============================================================

/**
 * Matches grain direction or rotation settings:
 * - GL, GW (grain length, grain width)
 * - grain length, grain width
 * - no rotate, fixed, locked
 * - rotate ok, can rotate
 * 
 * Returns: { allowRotation: boolean, grainDirection?: 'length' | 'width' }
 */
export const GRAIN_PATTERNS = {
  // Grain along length (no rotation)
  grainLength: [
    /\bGL\b/i,
    /grain\s*(?:along\s*)?length/i,
    /length\s*grain/i,
    /\|\|/,  // Common symbol for grain direction
  ],
  
  // Grain along width (no rotation)
  grainWidth: [
    /\bGW\b/i,
    /grain\s*(?:along\s*)?width/i,
    /width\s*grain/i,
    /=/,  // Common symbol for cross-grain
  ],
  
  // No rotation allowed
  noRotation: [
    /no\s*rotat(?:e|ion)/i,
    /\bfixed\b/i,
    /\blocked\b/i,
    /don'?t\s*rotate/i,
    /rotation\s*(?:off|no|false)/i,
  ],
  
  // Rotation allowed
  allowRotation: [
    /rotat(?:e|ion)\s*(?:ok|yes|true|allowed)/i,
    /can\s*rotate/i,
    /\bfree\b/i,
  ],
};

// ============================================================
// MATERIAL PATTERNS
// ============================================================

/**
 * Common material keywords and their mappings
 */
export const MATERIAL_KEYWORDS: Record<string, string[]> = {
  // Melamine
  "white-melamine": ["white melamine", "white mel", "wht mel", "white board"],
  "black-melamine": ["black melamine", "black mel", "blk mel"],
  "grey-melamine": ["grey melamine", "gray melamine", "grey mel"],
  
  // Wood types
  "oak": ["oak", "white oak", "red oak"],
  "walnut": ["walnut", "american walnut"],
  "maple": ["maple", "hard maple"],
  "cherry": ["cherry", "american cherry"],
  "birch": ["birch", "baltic birch"],
  "beech": ["beech"],
  "ash": ["ash"],
  "pine": ["pine"],
  
  // Engineered boards
  "mdf": ["mdf", "medium density"],
  "hdf": ["hdf", "high density"],
  "pb": ["pb", "particle board", "particleboard", "chipboard"],
  "plywood": ["plywood", "ply", "marine ply"],
  "osb": ["osb", "oriented strand"],
  
  // Laminates
  "hpl": ["hpl", "high pressure laminate", "formica"],
  "melamine": ["melamine", "mel"],
};

// ============================================================
// EDGE BANDING PATTERNS
// ============================================================

/**
 * Matches edge banding specifications:
 * - EB: L1L2 or edge: L1,L2
 * - all edges, 4 sides
 * - long edges, short edges
 * 
 * Captures: Array of edges to band
 */
export const EDGEBAND_PATTERNS = {
  // Specific edges: L1, L2, W1, W2
  specificEdges: /(?:EB|edge|edging)[:\s]*([LW][12](?:\s*,?\s*[LW][12])*)/i,
  
  // All edges
  allEdges: /(?:all\s*(?:edges?|sides?)|4\s*(?:edges?|sides?))/i,
  
  // Long edges only (L1 + L2)
  longEdges: /long\s*(?:edges?|sides?)/i,
  
  // Short edges only (W1 + W2)
  shortEdges: /short\s*(?:edges?|sides?)/i,
  
  // Two long one short etc.
  twoLongOneShort: /2\s*long\s*1\s*short|2L1W/i,
};

// ============================================================
// LABEL EXTRACTION
// ============================================================

/**
 * Characters/patterns to remove when extracting labels
 */
export const LABEL_CLEANUP_PATTERNS = [
  // Remove dimension patterns
  /\d+(?:\.\d+)?\s*(?:mm|cm|in)?\s*[x×X]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in)?/gi,
  
  // Remove quantity patterns
  /(?:qty|quantity)[:\s=]*\d+/gi,
  /[x×\*]\s*\d+/gi,
  /\d+\s*(?:pcs?|pieces?)/gi,
  /\bq\d+\b/gi,
  
  // Remove thickness patterns
  /\bt[:\s=]*\d+(?:\.\d+)?\s*(?:mm)?\b/gi,
  /(?:thk|thickness)[:\s=]*\d+(?:\.\d+)?\s*(?:mm)?/gi,
  
  // Remove grain patterns
  /\b(?:GL|GW)\b/gi,
  /grain\s*(?:along\s*)?(?:length|width)/gi,
  /no\s*rotat(?:e|ion)/gi,
  
  // Remove edge patterns
  /(?:EB|edge|edging)[:\s]*[LW][12](?:\s*,?\s*[LW][12])*/gi,
  /(?:all|long|short)\s*(?:edges?|sides?)/gi,
  
  // Clean up extra whitespace and punctuation
  /^\s*[-–—:,;]+\s*/,
  /\s*[-–—:,;]+\s*$/,
  /\s+/g,
];

// ============================================================
// NUMBER WORD MAPPINGS (for voice input)
// ============================================================

export const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};




