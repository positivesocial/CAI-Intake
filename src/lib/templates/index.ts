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

