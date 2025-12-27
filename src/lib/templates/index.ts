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

// Org-branded template generator
export {
  generateOrgTemplate,
  generateOrgExcelTemplate,
  generateOrgExcelTemplateXLSX,
  generateOrgCSVTemplate,
  buildTemplateConfigWithShortcodes,
  parseTemplateId,
  isValidCAITemplateId,
  downloadTemplate,
  calculateTemplateVersion,
  type OrgTemplateConfig,
  type OrganizationBranding,
  type OpsShortcode,
  type MaterialDef,
  type EdgebandDef,
  type GeneratedTemplate,
  type ParsedTemplateId,
  type TemplateQRData,
} from "./org-template-generator";

// Template parsing service (multi-page, auto-accept, audit)
export {
  registerTemplatePage,
  getSessionStatus,
  getSessionByProjectCode,
  mergeSessionPages,
  cleanupExpiredSessions,
  checkAutoAccept,
  logTemplateParseAudit,
  logHumanCorrections,
  validateTemplateVersion,
  AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
  MULTI_PAGE_WAIT_TIMEOUT_MS,
  type TemplateParseSession,
  type TemplatePageResult,
  type TemplateParseAudit,
  type MultiPageMergeResult,
  type AutoAcceptResult,
} from "./template-parsing-service";
