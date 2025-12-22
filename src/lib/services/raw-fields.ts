/**
 * CAI Intake - Raw Service Fields
 * 
 * This structure captures what comes from external sources (OCR, CSV, templates)
 * BEFORE normalization to canonical types.
 * 
 * The parser/import layer fills this structure, then the normalizers
 * convert it to canonical PartServices using the org dialect.
 */

// ============================================================
// RAW EDGEBAND FIELDS
// ============================================================

/**
 * Raw edgeband data from various sources
 */
export interface RawEdgebandFields {
  /**
   * Text-based notation (from paste, OCR, or single column)
   * e.g., "2L2W", "All", "X on L1 L2", "long edges only"
   */
  text?: string;
  
  /**
   * Column-based flags (from templates/Excel with separate columns)
   */
  columns?: {
    /** Combined L column (both long edges) */
    L?: string | number | boolean;
    /** Combined W column (both width edges) */
    W?: string | number | boolean;
    /** Individual L1 edge */
    L1?: string | number | boolean;
    /** Individual L2 edge */
    L2?: string | number | boolean;
    /** Individual W1 edge */
    W1?: string | number | boolean;
    /** Individual W2 edge */
    W2?: string | number | boolean;
    /** "All edges" column */
    all?: string | number | boolean;
  };
  
  /**
   * Edgeband tape reference (if specified)
   */
  tapeId?: string;
  
  /**
   * Tape thickness (if specified)
   */
  thicknessMm?: number;
}

// ============================================================
// RAW GROOVE FIELDS
// ============================================================

/**
 * Raw groove data from various sources
 */
export interface RawGrooveFields {
  /**
   * Text-based notation
   * e.g., "GW2-4-10", "back panel groove", "4mm groove on W2"
   */
  text?: string;
  
  /**
   * Column-based flags
   */
  columns?: {
    /** Groove on long edges */
    long?: string | number | boolean;
    /** Groove on width edges */
    width?: string | number | boolean;
    /** Back panel groove (typically W2) */
    back?: string | number | boolean;
    /** Drawer bottom groove (typically W1) */
    bottom?: string | number | boolean;
    /** Groove width in mm */
    widthMm?: number;
    /** Groove depth in mm */
    depthMm?: number;
    /** Distance from edge in mm */
    offsetMm?: number;
  };
}

// ============================================================
// RAW DRILLING FIELDS
// ============================================================

/**
 * Raw drilling/hole data from various sources
 */
export interface RawDrillingFields {
  /**
   * Text-based notation
   * e.g., "H2-110", "hinges", "32mm system", "handle CC96"
   */
  text?: string;
  
  /**
   * Specific hole type indicators
   */
  hinge?: {
    apply?: boolean;
    count?: number;
    offsetMm?: number;
    hardwareId?: string;
  };
  
  shelf?: {
    apply?: boolean;
    pattern?: string;
    systemMm?: number; // 32mm, 25mm, etc.
  };
  
  handle?: {
    apply?: boolean;
    centersMm?: number;
    position?: "center" | "top" | "bottom";
  };
  
  knob?: {
    apply?: boolean;
    position?: "center" | string;
    offsetMm?: number;
  };
  
  /**
   * Generic column flag (from templates)
   */
  columns?: {
    holes?: string | number | boolean;
    drilling?: string | number | boolean;
    hinge?: string | number | boolean;
    shelf?: string | number | boolean;
    handle?: string | number | boolean;
  };
}

// ============================================================
// RAW CNC FIELDS
// ============================================================

/**
 * Raw CNC operation data from various sources
 */
export interface RawCncFields {
  /**
   * Text-based notation
   * e.g., "CUTOUT-SINK-600x500", "radius 25", "custom"
   */
  text?: string;
  
  /**
   * CNC program reference
   */
  programId?: string;
  
  /**
   * Shape or operation type
   */
  shapeType?: string;
  
  /**
   * Parameters (if specified)
   */
  params?: Record<string, string | number>;
  
  /**
   * Column flag (from templates)
   */
  columns?: {
    cnc?: string | number | boolean;
    routing?: string | number | boolean;
    machining?: string | number | boolean;
  };
}

// ============================================================
// COMBINED RAW SERVICE FIELDS
// ============================================================

/**
 * All raw service fields from an external source
 * 
 * This is the intermediate structure between:
 * - Raw text/columns from OCR, CSV, Excel, templates
 * - Canonical PartServices after normalization
 */
export interface RawServiceFields {
  /** Raw edgeband data */
  edgeband?: RawEdgebandFields;
  
  /** Raw groove data */
  groove?: RawGrooveFields;
  
  /** Raw drilling data */
  drilling?: RawDrillingFields;
  
  /** Raw CNC data */
  cnc?: RawCncFields;
  
  /** Original source text (for debugging/learning) */
  sourceText?: string;
  
  /** Column headers detected (for learning) */
  detectedColumns?: string[];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create empty raw fields
 */
export function createEmptyRawFields(): RawServiceFields {
  return {};
}

/**
 * Check if raw fields have any data
 */
export function hasRawData(raw: RawServiceFields): boolean {
  return !!(
    raw.edgeband?.text ||
    raw.edgeband?.columns ||
    raw.groove?.text ||
    raw.groove?.columns ||
    raw.drilling?.text ||
    raw.drilling?.columns ||
    raw.drilling?.hinge?.apply ||
    raw.drilling?.shelf?.apply ||
    raw.drilling?.handle?.apply ||
    raw.drilling?.knob?.apply ||
    raw.cnc?.text ||
    raw.cnc?.columns ||
    raw.cnc?.programId
  );
}

/**
 * Extract raw fields from a text line
 * 
 * This is a simple extraction that looks for common patterns.
 * The normalizers will do the actual interpretation.
 */
export function extractRawFieldsFromText(
  text: string,
  columnHeaders?: string[]
): RawServiceFields {
  const raw: RawServiceFields = {
    sourceText: text,
    detectedColumns: columnHeaders,
  };
  
  const upperText = text.toUpperCase();
  
  // Look for edgeband patterns
  const edgePatterns = [
    /\b(2L2W|2L|2W|L2W|2L1W|ALL|4S)\b/i,
    /\bEB[:=\s]*([A-Z0-9,+]+)\b/i,
    /\bEDG(?:E|ING)?[:=\s]*([A-Z0-9,+]+)\b/i,
  ];
  
  for (const pattern of edgePatterns) {
    const match = text.match(pattern);
    if (match) {
      raw.edgeband = { text: match[1] || match[0] };
      break;
    }
  }
  
  // Look for groove patterns
  const groovePatterns = [
    /\bG([LW]?\d?)-(\d+)-(\d+)\b/i,
    /\bGROOVE[:=\s]*([A-Z0-9-]+)\b/i,
    /\bGRV[:=\s]*([A-Z0-9-]+)\b/i,
  ];
  
  for (const pattern of groovePatterns) {
    const match = text.match(pattern);
    if (match) {
      raw.groove = { text: match[0] };
      break;
    }
  }
  
  // Look for drilling patterns
  const drillingPatterns = [
    /\bH(\d)-(\d+)\b/i,
    /\bSP-(\w+)\b/i,
    /\bHD-CC(\d+)\b/i,
    /\bKN-(\w+)\b/i,
    /\b(\d+)MM\s*(?:SYSTEM|HOLES)\b/i,
    /\bHINGE[:=\s]*(\w+)\b/i,
    /\bHOLES[:=\s]*(\w+)\b/i,
  ];
  
  for (const pattern of drillingPatterns) {
    const match = text.match(pattern);
    if (match) {
      raw.drilling = { text: match[0] };
      break;
    }
  }
  
  // Look for CNC patterns
  const cncPatterns = [
    /\bCUTOUT-([A-Z]+)-(\d+)x(\d+)\b/i,
    /\bRADIUS-(\d+)(?:-(\w+))?\b/i,
    /\bPOCKET-(\d+)x(\d+)x(\d+)\b/i,
    /\bCNC[:=\s]*(\w+)\b/i,
    /\bROUTING[:=\s]*(\w+)\b/i,
  ];
  
  for (const pattern of cncPatterns) {
    const match = text.match(pattern);
    if (match) {
      raw.cnc = { text: match[0] };
      break;
    }
  }
  
  return raw;
}

/**
 * Extract raw fields from column data
 */
export function extractRawFieldsFromColumns(
  columns: Record<string, unknown>,
  columnMappings?: {
    edgeband?: string[];
    groove?: string[];
    drilling?: string[];
    cnc?: string[];
  }
): RawServiceFields {
  const raw: RawServiceFields = {
    detectedColumns: Object.keys(columns),
  };
  
  // Helper to find column value by possible names
  const findColumn = (possibleNames: string[]): unknown => {
    for (const name of possibleNames) {
      const upperName = name.toUpperCase();
      for (const [key, value] of Object.entries(columns)) {
        if (key.toUpperCase() === upperName || key.toUpperCase().includes(upperName)) {
          return value;
        }
      }
    }
    return undefined;
  };
  
  // Extract edgeband columns
  const ebL1 = findColumn(["L1", "EDGE L1", "EB L1", "EDGING L1"]);
  const ebL2 = findColumn(["L2", "EDGE L2", "EB L2", "EDGING L2"]);
  const ebW1 = findColumn(["W1", "EDGE W1", "EB W1", "EDGING W1"]);
  const ebW2 = findColumn(["W2", "EDGE W2", "EB W2", "EDGING W2"]);
  const ebL = findColumn(["L", "LONG", "EDGE L", "EDGING L", "EDGING LONG"]);
  const ebW = findColumn(["W", "WIDTH", "SHORT", "EDGE W", "EDGING W", "EDGING WIDTH"]);
  const ebAll = findColumn(["EDGE", "EDGING", "EDGEBAND", "EB", "ALL EDGES"]);
  
  if (ebL1 !== undefined || ebL2 !== undefined || ebW1 !== undefined || ebW2 !== undefined || 
      ebL !== undefined || ebW !== undefined || ebAll !== undefined) {
    raw.edgeband = {
      columns: {
        L1: ebL1 as string | number | boolean | undefined,
        L2: ebL2 as string | number | boolean | undefined,
        W1: ebW1 as string | number | boolean | undefined,
        W2: ebW2 as string | number | boolean | undefined,
        L: ebL as string | number | boolean | undefined,
        W: ebW as string | number | boolean | undefined,
        all: ebAll as string | number | boolean | undefined,
      },
    };
  }
  
  // Extract groove columns
  const grvL = findColumn(["GROOVE L", "GRV L", "GROOVE LONG"]);
  const grvW = findColumn(["GROOVE W", "GRV W", "GROOVE WIDTH", "GROOVE SHORT"]);
  const grvBack = findColumn(["GROOVE BACK", "BACK GROOVE", "BP GROOVE"]);
  const grvAll = findColumn(["GROOVE", "GRV", "GROOVES"]);
  
  if (grvL !== undefined || grvW !== undefined || grvBack !== undefined || grvAll !== undefined) {
    raw.groove = {
      columns: {
        long: grvL as string | number | boolean | undefined,
        width: grvW as string | number | boolean | undefined,
        back: grvBack as string | number | boolean | undefined,
      },
    };
  }
  
  // Extract drilling columns
  const holes = findColumn(["HOLES", "DRILLING", "DRILL"]);
  const hinge = findColumn(["HINGE", "HINGES"]);
  const shelf = findColumn(["SHELF", "SHELF PINS", "SP"]);
  const handle = findColumn(["HANDLE", "PULL"]);
  
  if (holes !== undefined || hinge !== undefined || shelf !== undefined || handle !== undefined) {
    raw.drilling = {
      columns: {
        holes: holes as string | number | boolean | undefined,
        hinge: hinge as string | number | boolean | undefined,
        shelf: shelf as string | number | boolean | undefined,
        handle: handle as string | number | boolean | undefined,
      },
    };
  }
  
  // Extract CNC columns
  const cnc = findColumn(["CNC", "ROUTING", "MACHINING", "CNC PROGRAM"]);
  
  if (cnc !== undefined) {
    raw.cnc = {
      columns: {
        cnc: cnc as string | number | boolean | undefined,
      },
    };
  }
  
  return raw;
}




