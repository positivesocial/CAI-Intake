/**
 * CAI Intake - Templates Module
 * 
 * Exports all template generation functionality.
 */

export {
  generateIntakeFormHTML,
  generateCSVTemplate,
  generatePrintableTemplate,
  DEFAULT_FIELDS,
  type TemplateConfig,
  type TemplateFieldConfig,
} from "./template-generator";

export {
  generateQRCodeURL,
  generateQRCodeDataURL,
  generateQRCodeCard,
  generatePortalURL,
  type QRCodeOptions,
} from "./qr-generator";

// Template detection
export {
  classifyDocument,
  detectExcelTemplate,
  detectPDFTemplate,
  detectTemplateFromQR,
  isValidTemplate,
  getProcessingRecommendation,
  isBlankTemplate,
  DocType,
  type TemplateMetadata,
  type TemplateDetectionResult,
} from "./template-detector";

// Template Excel parser
export {
  parseTemplateExcel,
  type TemplateParseOptions,
  type TemplateParseResult,
} from "./template-excel-parser";



