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

// ============================================================
// AUTO PARSER MODE DETECTION
// ============================================================

export type ParserModeRecommendation = "pattern" | "ai";

export interface ParserModeAnalysis {
  /** Recommended parser mode */
  recommended: ParserModeRecommendation;
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  /** Reasons for the recommendation */
  reasons: string[];
  /** Detected format hint */
  formatHint: SourceFormatHint;
  /** Metrics used for decision */
  metrics: {
    structuralScore: number;      // How structured the text is (0-1)
    dimensionPatternScore: number; // How many dimension patterns found (0-1)
    naturalLanguageScore: number;  // How much natural language prose (0-1)
    consistencyScore: number;      // Line-to-line consistency (0-1)
    lineCount: number;
    avgTokensPerLine: number;
  };
}

// Patterns that indicate natural language / AI-needed text
const NATURAL_LANGUAGE_PATTERNS = [
  /\b(i need|please|pls|also|and then|make sure|don't forget|confirm)\b/i,
  /\b(with|including|except|but not|however|where needed|where not)\b/i,
  /\b(edge\s*band|edging|groove|drill|hole|cnc)\s+(on|for|at|along)\b/i,
  /\b(same|similar|like the|as before)\b/i,
  /\b(white|oak|maple|cherry|walnut|melamine|plywood|mdf)\s+(board|panel|sheet|material)/i,
  /[.!?]\s+[A-Z]/,  // Sentence endings followed by new sentences
  /\b(cabinet|drawer|shelf|door|panel|side|top|bottom|back)\s+(for|of|in)\b/i,
  /\b(all\s*(round|sides|edges)|front\s+edge\s+only|no\s+edge)\b/i, // Prose edge descriptions
  /\bnotes?:\s*\w+/i, // Notes field with content
  /^-{2,}.*-{2,}$/m, // Section dividers like --- extras ---
  /\b(mostly|exposed|inset|pocket|radius)\b/i, // Descriptive terms
  /\b(front\s*\+\s*back|both\s+sides)\b/i, // Compound descriptions
];

// Patterns that indicate structured/tabular data
const STRUCTURED_PATTERNS = [
  /^\s*\d+\s*[.,]\s*\d+/m,           // Decimal numbers at line start
  /^\s*[A-Z]+-?\d+/m,                 // Part IDs like "P-001"
  /\t.*\t.*\t/,                       // Multiple tabs
  /,.*,.*,/,                          // Multiple commas
  /\|\s*.*\s*\|/,                     // Pipe delimiters
  /^\s*[-|+]+\s*$/m,                  // Table borders
];

// Dimension patterns (good for regex parsing)
const DIMENSION_PATTERNS = [
  /\d+\s*[x×X]\s*\d+/g,               // 720x560
  /\d+\s*mm?\s*[x×X]\s*\d+\s*mm?/gi,  // 720mm x 560mm
  /\d+\s*['"]?\s*[x×X]\s*\d+\s*['"]?/g, // With inches
  /[LW]\s*[:=]?\s*\d+/gi,             // L:720 or L=720
  /\b\d{2,4}\s+\d{2,4}\s+\d{1,2}\b/g, // Space-separated: 720 560 18
];

/**
 * Analyze text and recommend the best parser mode
 */
export function analyzeTextForParserMode(text: string): ParserModeAnalysis {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").filter(l => l.trim());
  const reasons: string[] = [];
  
  if (!trimmed || lines.length === 0) {
    return {
      recommended: "pattern",
      confidence: 0.5,
      reasons: ["Empty or minimal text"],
      formatHint: "free_form",
      metrics: {
        structuralScore: 0,
        dimensionPatternScore: 0,
        naturalLanguageScore: 0,
        consistencyScore: 0,
        lineCount: 0,
        avgTokensPerLine: 0,
      },
    };
  }

  // Get format detection result
  const formatResult = detectFormat(trimmed);
  
  // Calculate metrics
  const metrics = calculateMetrics(trimmed, lines);
  
  // Check for format variation (key indicator that AI is needed)
  const formatVariation = detectFormatVariation(trimmed);
  
  // Decision logic
  let patternScore = 0;
  let aiScore = 0;
  
  // 1. Format detection score
  if (formatResult.format !== "free_form" && formatResult.confidence >= 0.7) {
    patternScore += 30;
    reasons.push(`Detected ${formatResult.format} format`);
  } else if (formatResult.format === "free_form") {
    aiScore += 20;
    reasons.push("Free-form text detected");
  }
  
  // 2. Format variation - CRITICAL for AI decision
  if (formatVariation.hasHighVariation) {
    aiScore += 35;
    reasons.push(`Mixed formats: ${formatVariation.details.join(", ")}`);
  } else if (formatVariation.variationScore > 0.3) {
    aiScore += 20;
    reasons.push("Some format variations detected");
  }
  
  // 3. Structural consistency
  if (metrics.consistencyScore >= 0.8) {
    patternScore += 25;
    reasons.push("Highly consistent structure");
  } else if (metrics.consistencyScore >= 0.6) {
    patternScore += 15;
  } else if (metrics.consistencyScore < 0.4) {
    aiScore += 15;
    reasons.push("Inconsistent structure");
  }
  
  // 4. Dimension patterns
  // High dimension score + consistency (even without delimiters) = pattern-parseable
  if (metrics.dimensionPatternScore >= 0.7 && metrics.consistencyScore >= 0.7 && !formatVariation.hasHighVariation) {
    patternScore += 20;
    reasons.push("Consistent dimension patterns detected");
  } else if (metrics.dimensionPatternScore >= 0.7 && metrics.structuralScore >= 0.5) {
    patternScore += 15;
    reasons.push("Clear dimension patterns with structure");
  } else if (metrics.dimensionPatternScore >= 0.4) {
    patternScore += 5;
  }
  
  // 5. Natural language indicators
  if (metrics.naturalLanguageScore >= 0.4) {
    aiScore += 35;
    reasons.push("Contains natural language descriptions");
  } else if (metrics.naturalLanguageScore >= 0.2) {
    aiScore += 20;
    reasons.push("Some natural language detected");
  }
  
  // 6. Structural score (delimiters, consistency)
  if (metrics.structuralScore >= 0.7) {
    patternScore += 25;
    reasons.push("Tabular/structured data detected");
  } else if (metrics.structuralScore < 0.3) {
    aiScore += 20;
    reasons.push("Unstructured format");
  }
  
  // 7. Line count and complexity
  if (lines.length >= 10 && metrics.consistencyScore >= 0.7 && !formatVariation.hasHighVariation) {
    patternScore += 10;
    reasons.push("Large consistent dataset");
  }
  
  // 8. Token density - high tokens per line often means prose
  if (metrics.avgTokensPerLine > 15) {
    aiScore += 15;
    reasons.push("Complex lines suggest prose");
  } else if (metrics.avgTokensPerLine < 6 && lines.length > 2 && metrics.structuralScore >= 0.5) {
    patternScore += 10;
    reasons.push("Concise structured lines");
  }
  
  // 9. Section headers/context indicators
  if (/^[A-Z][A-Z\s]+:$/m.test(trimmed) || /^-{2,}.*-{2,}$/m.test(trimmed)) {
    aiScore += 15;
    reasons.push("Contains section headers/context");
  }
  
  // Determine recommendation
  const totalScore = patternScore + aiScore;
  const recommended: ParserModeRecommendation = patternScore >= aiScore ? "pattern" : "ai";
  const confidence = totalScore > 0 
    ? Math.min(0.95, Math.abs(patternScore - aiScore) / totalScore + 0.5)
    : 0.5;
  
  // Add final reason
  if (recommended === "pattern") {
    reasons.push("Pattern-based parsing recommended for structured data");
  } else {
    reasons.push("AI parsing recommended for better interpretation");
  }
  
  return {
    recommended,
    confidence,
    reasons,
    formatHint: formatResult.format,
    metrics,
  };
}

/**
 * Detect format variation that indicates AI should be used
 */
function detectFormatVariation(text: string): { 
  hasHighVariation: boolean; 
  variationScore: number;
  details: string[];
} {
  const details: string[] = [];
  let variationCount = 0;
  
  // Check quantity format variations
  const qtyFormats = {
    "qty N": /\bqty\s*[:\s]?\s*\d+/gi,
    "xN": /\bx\s*\d+\b/gi,
    "(N)": /\(\s*\d+\s*\)/g,
    "Npcs": /\b\d+\s*pcs\b/gi,
    "pcs N": /\bpcs\s*\d+\b/gi,
    "QTY=N": /\bqty\s*=\s*\d+/gi,
  };
  
  const foundQtyFormats: string[] = [];
  for (const [name, pattern] of Object.entries(qtyFormats)) {
    if (pattern.test(text)) {
      foundQtyFormats.push(name);
    }
  }
  if (foundQtyFormats.length >= 2) {
    variationCount++;
    details.push(`${foundQtyFormats.length} qty formats`);
  }
  
  // Check dimension separator variations
  const dimSeparators = {
    "x": /\d+\s*x\s*\d+/gi,
    "×": /\d+\s*×\s*\d+/g,
    "*": /\d+\s*\*\s*\d+/g,
    "by": /\d+\s+by\s+\d+/gi,
    "X": /\d+\s*X\s*\d+/g,
  };
  
  const foundDimFormats: string[] = [];
  for (const [name, pattern] of Object.entries(dimSeparators)) {
    if (pattern.test(text)) {
      foundDimFormats.push(name);
    }
  }
  if (foundDimFormats.length >= 2) {
    variationCount++;
    details.push(`${foundDimFormats.length} dim separators`);
  }
  
  // Check edge notation variations
  const edgeFormats = {
    "coded": /\b[1-4]?[LW][1-4]?[LW]?\b/g, // 2L2W, 1L, etc.
    "prose": /\b(all\s*(round|sides|edges)|front\s+edge|no\s+edge|edge\s+all)\b/gi,
    "edge:": /\bedge\s*:\s*\w+/gi,
    "edging": /\bedging\s+\w+/gi,
  };
  
  const foundEdgeFormats: string[] = [];
  for (const [name, pattern] of Object.entries(edgeFormats)) {
    if (pattern.test(text)) {
      foundEdgeFormats.push(name);
    }
  }
  if (foundEdgeFormats.length >= 2) {
    variationCount++;
    details.push("mixed edge notation");
  }
  
  // Check for prose operations vs coded operations
  const hasProseOps = /\b(groove\s+depth|drill\s+\w+\s+holes?|radius\s+R?\d|pocket\s+for)\b/i.test(text);
  const hasCodedOps = /\b(H\d|GL|GW|R\d)\b/.test(text);
  if (hasProseOps && hasCodedOps) {
    variationCount++;
    details.push("mixed operation notation");
  }
  
  const variationScore = variationCount / 4; // Normalize to 0-1
  
  return {
    hasHighVariation: variationCount >= 2,
    variationScore,
    details,
  };
}

/**
 * Calculate text metrics for parser mode decision
 */
function calculateMetrics(text: string, lines: string[]): ParserModeAnalysis["metrics"] {
  // Structural score - based on delimiters and consistency
  let structuralScore = 0;
  
  // Check for structured patterns
  const structuredMatches = STRUCTURED_PATTERNS.filter(p => p.test(text)).length;
  structuralScore += Math.min(0.4, structuredMatches * 0.1);
  
  // Check delimiter consistency
  const tabCounts = lines.map(l => (l.match(/\t/g) || []).length);
  const commaCounts = lines.map(l => (l.match(/,/g) || []).length);
  const avgTabs = tabCounts.reduce((a, b) => a + b, 0) / lines.length;
  const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / lines.length;
  
  if (avgTabs >= 2 || avgCommas >= 2) {
    const tabVariance = tabCounts.reduce((sum, c) => sum + Math.abs(c - avgTabs), 0) / lines.length;
    const commaVariance = commaCounts.reduce((sum, c) => sum + Math.abs(c - avgCommas), 0) / lines.length;
    const bestVariance = Math.min(tabVariance, commaVariance);
    structuralScore += Math.max(0, 0.6 - bestVariance * 0.2);
  }
  
  // Dimension pattern score
  let dimensionMatches = 0;
  for (const pattern of DIMENSION_PATTERNS) {
    const matches = text.match(pattern) || [];
    dimensionMatches += matches.length;
  }
  const dimensionPatternScore = Math.min(1, dimensionMatches / Math.max(1, lines.length));
  
  // Natural language score
  let naturalLanguageMatches = 0;
  for (const pattern of NATURAL_LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      naturalLanguageMatches++;
    }
  }
  const naturalLanguageScore = Math.min(1, naturalLanguageMatches / 4);
  
  // Consistency score - how similar are the lines?
  let consistencyScore = 0;
  if (lines.length >= 2) {
    const lineLengths = lines.map(l => l.length);
    const avgLength = lineLengths.reduce((a, b) => a + b, 0) / lines.length;
    const lengthVariance = lineLengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lines.length;
    const cv = Math.sqrt(lengthVariance) / avgLength; // Coefficient of variation
    consistencyScore = Math.max(0, 1 - cv * 0.5);
    
    // Also check for similar structure (word/token count)
    const tokenCounts = lines.map(l => l.split(/\s+/).length);
    const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / lines.length;
    const tokenVariance = tokenCounts.reduce((sum, c) => sum + Math.abs(c - avgTokens), 0) / lines.length;
    if (tokenVariance < 2) {
      consistencyScore += 0.2;
    }
    consistencyScore = Math.min(1, consistencyScore);
  }
  
  // Average tokens per line
  const totalTokens = lines.reduce((sum, l) => sum + l.split(/\s+/).length, 0);
  const avgTokensPerLine = totalTokens / Math.max(1, lines.length);
  
  return {
    structuralScore: Math.min(1, structuralScore),
    dimensionPatternScore,
    naturalLanguageScore,
    consistencyScore,
    lineCount: lines.length,
    avgTokensPerLine,
  };
}

/**
 * Quick check if text should definitely use AI (for complex cases)
 */
export function shouldForceAI(text: string): boolean {
  // Very short text with no clear structure
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length === 1 && lines[0].length > 50) {
    // Single long line - likely prose
    return true;
  }
  
  // Contains clear natural language requests
  if (/\b(please|i need|can you|make me)\b/i.test(text)) {
    return true;
  }
  
  // Contains complex operation descriptions in prose
  if (/\b(with|including)\s+.*(edge|groove|drill|hole|cnc)\b/i.test(text)) {
    return true;
  }
  
  return false;
}

/**
 * Quick check if text should definitely use pattern parser
 */
export function shouldForcePattern(text: string): boolean {
  const formatResult = detectFormat(text);
  
  // Known software format with high confidence
  if (formatResult.confidence >= 0.9 && formatResult.format !== "free_form") {
    return true;
  }
  
  // Clear tabular structure
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length >= 5) {
    const tabCounts = lines.map(l => (l.match(/\t/g) || []).length);
    const allSameTabs = tabCounts.every(c => c === tabCounts[0] && c >= 3);
    if (allSameTabs) {
      return true;
    }
  }
  
  return false;
}



