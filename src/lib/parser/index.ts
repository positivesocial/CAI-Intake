/**
 * CAI Intake - Parser Module
 * 
 * Exports all parser functionality.
 */

// Text parser
export {
  TextParser,
  parseText,
  parseLine,
  toCutPart,
  type ParsedPart,
  type ParseResult,
  type ParseError,
  type ParserOptions,
} from "./text-parser";

// Excel/CSV parser
export {
  parseExcel,
  parseCsv,
  detectColumnMapping,
  validateMapping,
  getSheetInfo,
  previewMapping,
  type ColumnMapping,
  type ExcelParseOptions,
  type ExcelParseResult,
  type SheetInfo,
} from "./excel-parser";

// Format detection
export {
  detectFormat,
  isStructuredTable,
  getParsingStrategy,
  type SourceFormatHint,
  type FormatDetectionResult,
} from "./format-detector";

// Deterministic parser (Layer 1)
export {
  parseDeterministic,
  canParseDeterministically,
  type DeterministicParseOptions,
  type DeterministicParseResult,
} from "./deterministic-parser";

// Three-layer parser (orchestrates all layers)
export {
  parseThreeLayers,
  smartParse,
  fastParse,
  type ThreeLayerParseOptions,
  type ThreeLayerParseResult,
} from "./three-layer-parser";

// Patterns (for advanced customization)
export {
  DIMENSION_PATTERNS,
  QUANTITY_PATTERNS,
  THICKNESS_PATTERNS,
  GRAIN_PATTERNS,
  MATERIAL_KEYWORDS,
  EDGEBAND_PATTERNS,
  NUMBER_WORDS,
} from "./parser-patterns";

// Utilities
export {
  normalizeText,
  splitLines,
  toMillimeters,
  parseDimensionValue,
  parseSpokenNumber,
  parseSpokenDimensions,
  cleanLabel,
  extractLabel,
  parseEdges,
  findMaterialMatch,
  calculateConfidence,
  areDimensionsReasonable,
  type EdgeId,
} from "./parser-utils";

