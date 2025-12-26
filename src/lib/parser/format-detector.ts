/**
 * CAI Intake - Format Detector
 * 
 * Detects the source format of pasted/uploaded text for optimized parsing.
 * Identifies software-specific formats like Cabinet Vision, Mozaik, Polyboard, etc.
 */

// ============================================================
// TYPES
// ============================================================

/** Detected source format hint for parsers */
export type SourceFormatHint =
  | "auto"              // Auto-detect (default)
  | "excel"             // Excel / CSV copy-paste
  | "cabinet_vision"    // Cabinet Vision software
  | "mozaik"            // Mozaik software
  | "polyboard"         // Polyboard software
  | "cutrite"           // CutRite software
  | "sketchlist"        // SketchList 3D
  | "pro100"            // PRO100
  | "generic_table"     // Generic tabular data
  | "free_form"         // Free-form text/notes
  | "cai_template";     // CAI Intake template

/** Format detection result */
export interface FormatDetectionResult {
  /** Detected format */
  format: SourceFormatHint;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detection method used */
  method: "pattern" | "header" | "structure" | "heuristic";
  /** Additional metadata */
  metadata?: {
    /** Detected delimiter */
    delimiter?: string;
    /** Whether data has headers */
    hasHeaders?: boolean;
    /** Detected column count */
    columnCount?: number;
    /** Software version if detected */
    softwareVersion?: string;
  };
}

// ============================================================
// DETECTION PATTERNS
// ============================================================

/** Patterns for software-specific formats */
const FORMAT_PATTERNS: Record<string, { regex: RegExp; format: SourceFormatHint; confidence: number }[]> = {
  // Cabinet Vision patterns
  cabinet_vision: [
    { regex: /Cabinet\s*Vision/i, format: "cabinet_vision", confidence: 0.95 },
    { regex: /CV\d+\.\d+/i, format: "cabinet_vision", confidence: 0.85 },
    { regex: /\bCVTX\b/i, format: "cabinet_vision", confidence: 0.9 },
    { regex: /Part\s+List\s+Report/i, format: "cabinet_vision", confidence: 0.8 },
  ],
  
  // Mozaik patterns
  mozaik: [
    { regex: /Mozaik/i, format: "mozaik", confidence: 0.95 },
    { regex: /\bMOZ\b.*\bCUT\b/i, format: "mozaik", confidence: 0.85 },
  ],
  
  // Polyboard patterns
  polyboard: [
    { regex: /Polyboard/i, format: "polyboard", confidence: 0.95 },
    { regex: /\bPB\d+\.\d+\b/i, format: "polyboard", confidence: 0.85 },
    { regex: /Panel\s+Optimizer/i, format: "polyboard", confidence: 0.75 },
  ],
  
  // CutRite patterns
  cutrite: [
    { regex: /CutRite/i, format: "cutrite", confidence: 0.95 },
    { regex: /\bCR\b.*Cut\s*List/i, format: "cutrite", confidence: 0.85 },
  ],
  
  // SketchList 3D patterns
  sketchlist: [
    { regex: /SketchList/i, format: "sketchlist", confidence: 0.95 },
    { regex: /SketchUp.*Cut\s*List/i, format: "sketchlist", confidence: 0.8 },
  ],
  
  // PRO100 patterns
  pro100: [
    { regex: /PRO\s*100/i, format: "pro100", confidence: 0.95 },
    { regex: /\bP100\b/i, format: "pro100", confidence: 0.8 },
  ],
  
  // CAI Template patterns
  cai_template: [
    { regex: /CABINETAI_TEMPLATE/i, format: "cai_template", confidence: 0.99 },
    { regex: /CAI-\d+\.\d+-[A-Z0-9]+/i, format: "cai_template", confidence: 0.95 },
    { regex: /cai-org-template/i, format: "cai_template", confidence: 0.95 },
  ],
};

/** Header patterns for format detection */
const HEADER_PATTERNS: Record<SourceFormatHint, RegExp[]> = {
  excel: [
    /^(Part|Name|Label)\t(Length|L)\t(Width|W)\t/i,
    /^[A-Za-z]+\t[A-Za-z]+\t[A-Za-z]+/,  // Tab-separated
  ],
  cabinet_vision: [
    /Part\s+Name.*Length.*Width.*Qty/i,
    /Assembly.*Component.*Material/i,
  ],
  mozaik: [
    /Description.*L\s*\(mm\).*W\s*\(mm\)/i,
    /Panel.*Thickness.*Grain/i,
  ],
  polyboard: [
    /Panel.*Length.*Width.*Thickness/i,
  ],
  cutrite: [
    /Part.*Dimensions.*Material/i,
  ],
  sketchlist: [
    /Component.*Length.*Width.*Thickness/i,
  ],
  pro100: [
    /Element.*Size.*Material/i,
  ],
  cai_template: [
    /#.*Part.*L.*W.*Qty.*Material/i,
    /Part\s+Name.*Length.*Width.*Thickness.*Quantity/i,
  ],
  generic_table: [],
  auto: [],
  free_form: [],
};

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

/**
 * Detect the format of input text
 */
export function detectFormat(text: string): FormatDetectionResult {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return { format: "free_form", confidence: 0, method: "heuristic" };
  }
  
  // First, check for software-specific patterns
  for (const [, patterns] of Object.entries(FORMAT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.regex.test(trimmed)) {
        return {
          format: pattern.format,
          confidence: pattern.confidence,
          method: "pattern",
        };
      }
    }
  }
  
  // Check for header patterns
  const firstLine = trimmed.split("\n")[0];
  for (const [format, patterns] of Object.entries(HEADER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(firstLine)) {
        return {
          format: format as SourceFormatHint,
          confidence: 0.8,
          method: "header",
        };
      }
    }
  }
  
  // Analyze structure
  const structureResult = analyzeStructure(trimmed);
  if (structureResult) {
    return structureResult;
  }
  
  // Default to free-form
  return {
    format: "free_form",
    confidence: 0.5,
    method: "heuristic",
  };
}

/**
 * Analyze text structure to determine format
 */
function analyzeStructure(text: string): FormatDetectionResult | null {
  const lines = text.split("\n").filter(l => l.trim());
  
  if (lines.length < 2) {
    return null;
  }
  
  // Check for tab-separated values
  const tabCounts = lines.map(l => (l.match(/\t/g) || []).length);
  const avgTabs = tabCounts.reduce((a, b) => a + b, 0) / tabCounts.length;
  
  if (avgTabs >= 2) {
    // Consistent tab-separated format
    const consistentTabs = tabCounts.every(c => Math.abs(c - avgTabs) <= 1);
    if (consistentTabs) {
      return {
        format: "excel",
        confidence: 0.85,
        method: "structure",
        metadata: {
          delimiter: "\t",
          hasHeaders: true,
          columnCount: Math.round(avgTabs) + 1,
        },
      };
    }
  }
  
  // Check for comma-separated values
  const commaCounts = lines.map(l => (l.match(/,/g) || []).length);
  const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / commaCounts.length;
  
  if (avgCommas >= 2) {
    const consistentCommas = commaCounts.every(c => Math.abs(c - avgCommas) <= 1);
    if (consistentCommas) {
      return {
        format: "excel",
        confidence: 0.8,
        method: "structure",
        metadata: {
          delimiter: ",",
          hasHeaders: true,
          columnCount: Math.round(avgCommas) + 1,
        },
      };
    }
  }
  
  // Check for consistent spacing (generic table)
  const spacingPattern = /\s{2,}/;
  const spacedLines = lines.filter(l => spacingPattern.test(l));
  
  if (spacedLines.length >= lines.length * 0.8) {
    return {
      format: "generic_table",
      confidence: 0.7,
      method: "structure",
      metadata: {
        delimiter: "space",
        hasHeaders: true,
      },
    };
  }
  
  return null;
}

/**
 * Check if text looks like a structured table
 */
export function isStructuredTable(text: string): boolean {
  const result = detectFormat(text);
  return result.format !== "free_form" && result.confidence >= 0.6;
}

/**
 * Get recommended parsing strategy based on format
 */
export function getParsingStrategy(format: SourceFormatHint): "deterministic" | "regex" | "llm" {
  switch (format) {
    case "excel":
    case "cabinet_vision":
    case "mozaik":
    case "polyboard":
    case "cutrite":
    case "sketchlist":
    case "pro100":
    case "cai_template":
    case "generic_table":
      return "deterministic";
    case "free_form":
      return "llm";
    case "auto":
    default:
      return "regex";
  }
}



