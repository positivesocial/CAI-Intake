/**
 * CAI Intake - Services Module
 * 
 * Service types and utilities for:
 * - Edgebanding
 * - Grooves
 * - Drilling/Holes
 * - CNC Operations
 * 
 * NOTE: The canonical types and shortcodes have been moved to the
 * unified operations system in @/lib/operations.
 * 
 * This module now provides:
 * 1. Organization dialect configuration (external format translation)
 * 2. Raw field extraction
 * 3. Formatters (canonical → display)
 * 4. Preview types (for 2D visualization)
 */

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
} from "./normalizers";

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
