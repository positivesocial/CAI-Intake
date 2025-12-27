/**
 * CAI Intake - Organization Service Dialect Types
 * 
 * Each organization can configure how their cutlist formats
 * map to the canonical CabinetAI shortcodes.
 * 
 * This allows:
 * - Custom aliases ("All" → "2L2W", "4S" → "2L2W")
 * - Yes/No value interpretation ("X" means apply, "" means don't)
 * - Default values for blank fields
 * - Regex patterns for complex formats
 */

import type { 
  EdgeSide, 
  HolePatternSpec, 
  CncOperation,
  EdgeBandSpec,
  GrooveSpec,
} from "./compat-types";

// ============================================================
// DIALECT PATTERN TYPES
// ============================================================

/**
 * A custom pattern for parsing external formats
 */
export interface DialectPattern {
  /** Human-readable name for this pattern */
  name: string;
  
  /** Regex pattern to match input */
  pattern: RegExp;
  
  /** Handler function that converts match to output */
  handler: (match: RegExpMatchArray) => Partial<EdgeBandSpec | GrooveSpec | HolePatternSpec | CncOperation>;
  
  /** Priority (higher = checked first) */
  priority: number;
  
  /** Is this pattern enabled? */
  enabled: boolean;
  
  /** Example input that matches this pattern */
  example?: string;
}

// ============================================================
// EDGEBAND DIALECT
// ============================================================

/**
 * Configuration for interpreting edgeband notations
 */
export interface EdgebandDialect {
  /**
   * Aliases from external codes to canonical codes
   * e.g., { "ALL": "2L2W", "4S": "2L2W", "FULL": "2L2W" }
   */
  aliases: Record<string, string>;
  
  /**
   * Values that mean "yes, apply edgeband"
   * e.g., ["X", "1", "Y", "YES", "TRUE", "✓"]
   */
  yesValues: (string | number | boolean)[];
  
  /**
   * Values that mean "no, don't apply edgeband"
   * e.g., ["", "-", "0", "N", "NO", "FALSE"]
   */
  noValues: (string | number | boolean)[];
  
  /**
   * Default code when field is blank (optional)
   * e.g., "2L2W" for door parts, undefined for panels
   */
  defaultIfBlank?: string;
  
  /**
   * Custom regex patterns for complex formats
   */
  patterns?: DialectPattern[];
  
  /**
   * Column name mappings for Excel/CSV imports
   * Maps external column names to EdgeSide
   */
  columnMappings?: {
    /** Column names for L1 edge */
    L1?: string[];
    /** Column names for L2 edge */
    L2?: string[];
    /** Column names for W1 edge */
    W1?: string[];
    /** Column names for W2 edge */
    W2?: string[];
    /** Column names for "long edges" (L1+L2) */
    long?: string[];
    /** Column names for "width edges" (W1+W2) */
    width?: string[];
    /** Column names for "all edges" */
    all?: string[];
  };
}

// ============================================================
// GROOVE DIALECT
// ============================================================

/**
 * Configuration for interpreting groove notations
 */
export interface GrooveDialect {
  /**
   * Aliases from external codes to canonical codes
   * e.g., { "BACK": "GW2-4-10", "BTM": "GW1-4-12" }
   */
  aliases: Record<string, string>;
  
  /**
   * Default groove width in mm
   */
  defaultWidthMm: number;
  
  /**
   * Default groove depth in mm
   */
  defaultDepthMm: number;
  
  /**
   * Default distance from edge in mm
   */
  defaultOffsetMm: number;
  
  /**
   * Values that mean "yes, add groove"
   */
  yesValues: (string | number | boolean)[];
  
  /**
   * Values that mean "no groove"
   */
  noValues: (string | number | boolean)[];
  
  /**
   * Custom patterns for complex formats
   */
  patterns?: DialectPattern[];
  
  /**
   * Column mappings for groove columns
   */
  columnMappings?: {
    long?: string[];
    width?: string[];
    all?: string[];
    back?: string[];  // Common: back panel groove
    bottom?: string[]; // Common: drawer bottom groove
  };
}

// ============================================================
// DRILLING DIALECT
// ============================================================

/**
 * Configuration for interpreting drilling/hole notations
 */
export interface DrillingDialect {
  /**
   * Named hinge patterns for this organization
   * Maps shorthand names to full hole pattern specs
   */
  hingePatterns: Record<string, Omit<HolePatternSpec, "kind"> & { kind?: "hinge" }>;
  
  /**
   * Named shelf pin patterns
   */
  shelfPatterns: Record<string, Omit<HolePatternSpec, "kind"> & { kind?: "shelf_pins" | "system32" }>;
  
  /**
   * Named handle patterns
   */
  handlePatterns: Record<string, Omit<HolePatternSpec, "kind"> & { kind?: "handle" }>;
  
  /**
   * Named knob patterns
   */
  knobPatterns?: Record<string, Omit<HolePatternSpec, "kind"> & { kind?: "knob" }>;
  
  /**
   * Custom patterns for complex formats
   */
  patterns?: DialectPattern[];
  
  /**
   * General aliases
   */
  aliases?: Record<string, string>;
}

// ============================================================
// CNC DIALECT
// ============================================================

/**
 * Configuration for interpreting CNC operation notations
 */
export interface CncDialect {
  /**
   * Named CNC macros/programs
   * Maps shorthand names to full CNC operation specs
   */
  macros: Record<string, CncOperation>;
  
  /**
   * Aliases from external codes to canonical codes
   */
  aliases?: Record<string, string>;
  
  /**
   * Custom patterns for complex formats
   */
  patterns?: DialectPattern[];
}

// ============================================================
// COMBINED ORGANIZATION DIALECT
// ============================================================

/**
 * Complete service dialect configuration for an organization
 * 
 * This is stored per-organization and used during parsing
 * to translate external formats to canonical CabinetAI codes.
 */
export interface OrgServiceDialect {
  /** Organization ID (null for global/default) */
  organizationId: string | null;
  
  /** Human-readable name for this dialect */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Edgeband interpretation rules */
  edgeband: EdgebandDialect;
  
  /** Groove interpretation rules */
  groove: GrooveDialect;
  
  /** Drilling interpretation rules */
  drilling: DrillingDialect;
  
  /** CNC interpretation rules */
  cnc: CncDialect;
  
  /** Whether to use AI fallback for unrecognized formats */
  useAiFallback: boolean;
  
  /** Whether to auto-learn new patterns from corrections */
  autoLearn: boolean;
  
  /** Created timestamp */
  createdAt?: Date;
  
  /** Updated timestamp */
  updatedAt?: Date;
  
  /** Version for optimistic locking */
  version?: number;
}

// ============================================================
// SERIALIZATION TYPES
// ============================================================

/**
 * JSON-serializable version of OrgServiceDialect
 * (patterns stored as strings for database storage)
 */
export interface OrgServiceDialectJson {
  organizationId: string | null;
  name: string;
  description?: string;
  edgeband: Omit<EdgebandDialect, "patterns"> & {
    patterns?: Array<{
      name: string;
      pattern: string; // RegExp source
      handlerCode: string; // Serialized function
      priority: number;
      enabled: boolean;
      example?: string;
    }>;
  };
  groove: Omit<GrooveDialect, "patterns"> & {
    patterns?: Array<{
      name: string;
      pattern: string;
      handlerCode: string;
      priority: number;
      enabled: boolean;
      example?: string;
    }>;
  };
  drilling: Omit<DrillingDialect, "patterns"> & {
    patterns?: Array<{
      name: string;
      pattern: string;
      handlerCode: string;
      priority: number;
      enabled: boolean;
      example?: string;
    }>;
  };
  cnc: Omit<CncDialect, "patterns"> & {
    patterns?: Array<{
      name: string;
      pattern: string;
      handlerCode: string;
      priority: number;
      enabled: boolean;
      example?: string;
    }>;
  };
  useAiFallback: boolean;
  autoLearn: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

// ============================================================
// TYPE GUARDS
// ============================================================

/**
 * Check if a value is a "yes" value for a dialect
 */
export function isYesValue(
  value: unknown,
  yesValues: (string | number | boolean)[]
): boolean {
  if (value === undefined || value === null) return false;
  
  // Normalize the value
  const normalized = typeof value === "string" 
    ? value.trim().toUpperCase()
    : value;
  
  return yesValues.some(yes => {
    const normalizedYes = typeof yes === "string" 
      ? yes.trim().toUpperCase()
      : yes;
    return normalized === normalizedYes;
  });
}

/**
 * Check if a value is a "no" value for a dialect
 */
export function isNoValue(
  value: unknown,
  noValues: (string | number | boolean)[]
): boolean {
  if (value === undefined || value === null) return true; // Undefined/null is "no"
  
  const normalized = typeof value === "string" 
    ? value.trim().toUpperCase()
    : value;
  
  // Empty string is also "no"
  if (normalized === "") return true;
  
  return noValues.some(no => {
    const normalizedNo = typeof no === "string" 
      ? no.trim().toUpperCase()
      : no;
    return normalized === normalizedNo;
  });
}





