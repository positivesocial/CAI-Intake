/**
 * CAI Intake - Services Module
 * 
 * Canonical service types and normalization for:
 * - Edgebanding
 * - Grooves
 * - Drilling/Holes
 * - CNC Operations
 * 
 * This module provides:
 * 1. Canonical types (the "internal truth")
 * 2. Canonical shortcodes (CabinetAI's official notation)
 * 3. Organization dialect configuration (external format translation)
 * 4. Normalizers (external → canonical)
 * 5. Formatters (canonical → display)
 * 
 * @example
 * ```typescript
 * import {
 *   // Types
 *   EdgeBandSpec,
 *   GrooveSpec,
 *   PartServices,
 *   
 *   // Normalization
 *   normalizeServices,
 *   extractRawFieldsFromText,
 *   
 *   // Formatting
 *   formatEdgebandCode,
 *   formatServicesSummary,
 *   
 *   // Dialect
 *   getDefaultDialect,
 * } from "@/lib/services";
 * 
 * // Parse raw input
 * const raw = extractRawFieldsFromText("Side panel 720x560 2L2W G-ALL-4-10");
 * 
 * // Normalize to canonical
 * const services = normalizeServices(raw, orgDialect);
 * 
 * // Format for display
 * const summary = formatServicesSummary(services);
 * ```
 */

// ============================================================
// CANONICAL TYPES (Internal Truth)
// ============================================================

export type {
  EdgeSide,
  PartFace,
  HolePatternKind,
  CncOpType,
  EdgeBandSpec,
  GrooveSpec,
  HolePatternSpec,
  CncOperation,
  PartServices,
} from "./canonical-types";

export {
  ALL_EDGE_SIDES,
  LONG_EDGES,
  WIDTH_EDGES,
  hasAnyServices,
  countServices,
  createEmptyServices,
  createEdgeBandSpec,
  createBackPanelGroove,
  createDrawerBottomGroove,
  mergeServices,
} from "./canonical-types";

// ============================================================
// CANONICAL SHORTCODES
// ============================================================

export {
  EDGE_CODES,
  edgesToCode,
  parseEdgeCode,
  GROOVE_PRESETS,
  parseGrooveCode,
  grooveToCode,
  HOLE_PRESETS,
  parseHoleCode,
  holePatternToCode,
  CNC_PRESETS,
  parseCncCode,
  cncOperationToCode,
  SHORTCODE_REFERENCE,
} from "./canonical-shortcodes";

// ============================================================
// DIALECT TYPES
// ============================================================

export type {
  DialectPattern,
  EdgebandDialect,
  GrooveDialect,
  DrillingDialect,
  CncDialect,
  OrgServiceDialect,
  OrgServiceDialectJson,
} from "./dialect-types";

export {
  isYesValue,
  isNoValue,
} from "./dialect-types";

// ============================================================
// DEFAULT DIALECT
// ============================================================

export {
  DEFAULT_DIALECT,
  getDefaultDialect,
  mergeWithDefaults,
} from "./default-dialect";

// ============================================================
// RAW FIELDS
// ============================================================

export type {
  RawEdgebandFields,
  RawGrooveFields,
  RawDrillingFields,
  RawCncFields,
  RawServiceFields,
} from "./raw-fields";

export {
  createEmptyRawFields,
  hasRawData,
  extractRawFieldsFromText,
  extractRawFieldsFromColumns,
} from "./raw-fields";

// ============================================================
// NORMALIZERS
// ============================================================

export {
  normalizeServices,
  normalizeFromText,
  validateServices,
  mergePartServices,
  normalizeEdgeband,
  normalizeGrooves,
  normalizeHoles,
  normalizeCnc,
} from "./normalizers";

export type { QuickNormalizeOptions } from "./normalizers";

// ============================================================
// FORMATTERS
// ============================================================

export {
  formatEdgebandCode,
  formatEdgebandDescription,
  formatEdgesVisual,
  formatGrooveCode,
  formatGroovesCode,
  formatGrooveDescription,
  formatHoleCode,
  formatHolesCode,
  formatHoleDescription,
  formatCncCode,
  formatCncCodes,
  formatCncDescription,
  formatServicesSummary,
  formatServicesDetailed,
  formatServicesTooltip,
} from "./formatters";

// ============================================================
// PREVIEW TYPES (for 2D visualization)
// ============================================================

export type {
  PreviewEdge,
  PartPreviewData,
  PreviewEdgeband,
  PreviewGroove,
  PreviewHole,
  PreviewPocket,
  PreviewCornerRound,
  PreviewSize,
  PreviewSizeConfig,
  ServiceBadge,
} from "./preview-types";

export {
  EDGE_SIDE_TO_PREVIEW,
  PREVIEW_TO_EDGE_SIDE,
  PREVIEW_SIZE_CONFIGS,
  SERVICE_COLORS,
  createEmptyPreviewData,
  hasPreviewServices,
  countPreviewServices,
  generateServiceBadges,
} from "./preview-types";

// ============================================================
// PREVIEW CONVERTER
// ============================================================

export {
  convertOpsToPreview,
  convertEdgingToPreview,
  createPreviewFromPart,
} from "./preview-converter";

