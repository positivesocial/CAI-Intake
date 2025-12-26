/**
 * CAI Intake - Organization-Branded Template Generator (v2.0)
 * 
 * Generates professional PDF and Excel templates for cutlist intake with:
 * - Organization branding (logo, colors, name)
 * - QR codes with visible template ID for AI-assisted parsing
 * - Corner alignment markers for OCR accuracy
 * - Template version tracking (auto-versioned when shortcodes change)
 * - Project code, page numbering, and section/area fields
 * - Org-specific shortcodes from ops tables (Edge, Groove, Drill, CNC)
 * - Fill-in guide with "Best OCR" tips
 * - Materials and edgebands reference
 * 
 * Templates are deterministic - OCR should be 100% accurate
 */

import { generateId } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

export interface OrganizationBranding {
  /** Organization ID */
  org_id: string;
  /** Organization name */
  name: string;
  /** Logo URL (optional) */
  logo_url?: string;
  /** Primary brand color (hex) */
  primary_color?: string;
  /** Secondary brand color (hex) */
  secondary_color?: string;
  /** Contact info to show on template */
  contact_info?: string;
  /** Template title override */
  template_title?: string;
}

export interface MaterialDef {
  material_id: string;
  name: string;
  thickness_mm: number;
  code?: string; // Short code for quick entry
}

export interface EdgebandDef {
  edgeband_id: string;
  name: string;
  thickness_mm: number;
  code?: string; // Short code
}

/** Org-defined shortcode for operations */
export interface OpsShortcode {
  id: string;
  code: string;           // e.g., "L", "2L", "BP", "H2"
  name: string;           // Human-readable name
  description?: string;   // Full description
  category: "edgebanding" | "grooving" | "drilling" | "cnc" | "general";
}

export interface OrgTemplateConfig {
  /** Organization branding */
  branding: OrganizationBranding;
  
  /** Template title */
  title?: string;
  
  /** Template version (increments with shortcode changes) */
  version?: string;
  
  /** Number of rows for parts */
  rows?: number;
  
  /** Include operations columns */
  includeEdgebanding?: boolean;
  includeGrooves?: boolean;
  includeDrilling?: boolean;
  includeCNC?: boolean;
  includeNotes?: boolean;
  
  /** Organization's materials library */
  materials?: MaterialDef[];
  
  /** Organization's edgebanding library */
  edgebands?: EdgebandDef[];
  
  /** Organization's operation shortcodes (from ops tables) */
  shortcodes?: OpsShortcode[];
  
  /** Hash of shortcodes for version tracking */
  shortcodesHash?: string;
}

export interface GeneratedTemplate {
  /** Template ID for tracking */
  template_id: string;
  /** Template version */
  version: string;
  /** Organization ID */
  org_id: string;
  /** Generated HTML content */
  html: string;
  /** QR code data (JSON string) */
  qr_data: string;
  /** Shortcodes hash (for versioning) */
  shortcodes_hash: string;
  /** Generated timestamp */
  generated_at: string;
}

// ============================================================
// QR CODE DATA GENERATION
// ============================================================

export interface TemplateQRData {
  type: "cai-template";
  id: string;              // Template ID (displayed under QR)
  org: string;             // Organization ID
  v: string;               // Version
  schema: "cutlist/v2";
  cols: string[];          // Column order for deterministic parsing
  caps: {
    eb: boolean;           // Edgebanding
    grv: boolean;          // Grooving
    drill: boolean;        // Drilling
    cnc: boolean;          // CNC operations
    notes: boolean;        // Notes
  };
  sc_hash?: string;        // Shortcodes hash for validation
}

function generateQRData(config: OrgTemplateConfig, templateId: string, version: string, shortcodesHash: string): TemplateQRData {
  const cols = ["#", "label", "L", "W", "thk", "qty", "material"];
  
  if (config.includeEdgebanding !== false) {
    cols.push("edge");
  }
  if (config.includeGrooves) {
    cols.push("groove");
  }
  if (config.includeDrilling) {
    cols.push("drill");
  }
  if (config.includeCNC) {
    cols.push("cnc");
  }
  if (config.includeNotes !== false) {
    cols.push("notes");
  }
  
  return {
    type: "cai-template",
    id: templateId,
    org: config.branding.org_id,
    v: version,
    schema: "cutlist/v2",
    cols,
    caps: {
      eb: config.includeEdgebanding !== false,
      grv: !!config.includeGrooves,
      drill: !!config.includeDrilling,
      cnc: !!config.includeCNC,
      notes: config.includeNotes !== false,
    },
    sc_hash: shortcodesHash || undefined,
  };
}

// ============================================================
// SHORTCODES HASH GENERATION
// ============================================================

function generateShortcodesHash(shortcodes?: OpsShortcode[]): string {
  if (!shortcodes || shortcodes.length === 0) {
    return "default";
  }
  // Create deterministic hash from shortcodes
  const str = shortcodes
    .map(s => `${s.category}:${s.code}`)
    .sort()
    .join("|");
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

// ============================================================
// FILL-IN GUIDE GENERATION (From Org Shortcodes)
// ============================================================

function generateFillInGuide(config: OrgTemplateConfig, primaryColor: string): string {
  const shortcodes = config.shortcodes || [];
  
  // Group shortcodes by category
  const byCategory: Record<string, OpsShortcode[]> = {
    edgebanding: [],
    grooving: [],
    drilling: [],
    cnc: [],
    general: [],
  };
  
  shortcodes.forEach(sc => {
    if (byCategory[sc.category]) {
      byCategory[sc.category].push(sc);
    }
  });
  
  // Build sections
  const sections: string[] = [];
  
  // Edgebanding section
  if (config.includeEdgebanding !== false) {
    const ebCodes = byCategory.edgebanding.length > 0 
      ? byCategory.edgebanding 
      : getDefaultEdgebandingCodes();
    
    sections.push(`
      <div class="guide-section">
        <div class="guide-title">Edgebanding:</div>
        <div class="guide-codes">
          ${ebCodes.map(sc => `<div class="guide-item">• <code>${sc.code}</code> = ${sc.name}</div>`).join("")}
        </div>
      </div>
    `);
  }
  
  // Grooving section
  if (config.includeGrooves) {
    const grvCodes = byCategory.grooving.length > 0 
      ? byCategory.grooving 
      : getDefaultGroovingCodes();
    
    sections.push(`
      <div class="guide-section">
        <div class="guide-title">Grooving:</div>
        <div class="guide-codes">
          ${grvCodes.map(sc => `<div class="guide-item">• <code>${sc.code}</code> = ${sc.name}</div>`).join("")}
        </div>
      </div>
    `);
  }
  
  // Drilling section
  if (config.includeDrilling) {
    const drillCodes = byCategory.drilling.length > 0 
      ? byCategory.drilling 
      : getDefaultDrillingCodes();
    
    sections.push(`
      <div class="guide-section">
        <div class="guide-title">Drilling:</div>
        <div class="guide-codes">
          ${drillCodes.map(sc => `<div class="guide-item">• <code>${sc.code}</code> = ${sc.name}</div>`).join("")}
        </div>
      </div>
    `);
  }
  
  // CNC section
  if (config.includeCNC) {
    const cncCodes = byCategory.cnc.length > 0 
      ? byCategory.cnc 
      : getDefaultCNCCodes();
    
    sections.push(`
      <div class="guide-section">
        <div class="guide-title">CNC:</div>
        <div class="guide-codes">
          ${cncCodes.map(sc => `<div class="guide-item">• <code>${sc.code}</code> = ${sc.name}</div>`).join("")}
        </div>
      </div>
    `);
  }
  
  // OCR Tips section (always show)
  sections.push(`
    <div class="guide-section ocr-tips">
      <div class="guide-title">Best OCR:</div>
      <div class="guide-codes">
        <div class="guide-item">BLOCK LETTERS</div>
        <div class="guide-item">Clear photo</div>
      </div>
    </div>
  `);
  
  return `
    <div class="fill-in-guide" style="border-color: ${primaryColor}20;">
      <div class="guide-header" style="background: ${primaryColor};">FILL-IN GUIDE</div>
      <div class="guide-content">
        ${sections.join("")}
      </div>
    </div>
  `;
}

// Default shortcodes when org hasn't defined custom ones
function getDefaultEdgebandingCodes(): OpsShortcode[] {
  return [
    { id: "eb1", code: "L", name: "Length only", category: "edgebanding" },
    { id: "eb2", code: "W", name: "Width only", category: "edgebanding" },
    { id: "eb3", code: "2L", name: "Both lengths", category: "edgebanding" },
    { id: "eb4", code: "2W", name: "Both widths", category: "edgebanding" },
    { id: "eb5", code: "LW", name: "Length + Width", category: "edgebanding" },
    { id: "eb6", code: "2L2W", name: "All 4 sides", category: "edgebanding" },
    { id: "eb7", code: "None", name: "no banding", category: "edgebanding" },
  ];
}

function getDefaultGroovingCodes(): OpsShortcode[] {
  return [
    { id: "grv1", code: "L", name: "Along length", category: "grooving" },
    { id: "grv2", code: "W", name: "Along width", category: "grooving" },
    { id: "grv3", code: "2L", name: "Both length sides", category: "grooving" },
    { id: "grv4", code: "2W", name: "Both width sides", category: "grooving" },
    { id: "grv5", code: "blank", name: "no groove", category: "grooving" },
  ];
}

function getDefaultDrillingCodes(): OpsShortcode[] {
  return [
    { id: "dr1", code: "H2", name: "2 hinge holes", category: "drilling" },
    { id: "dr2", code: "SP4", name: "4 shelf pins", category: "drilling" },
    { id: "dr3", code: "HD", name: "Handle drill", category: "drilling" },
  ];
}

function getDefaultCNCCodes(): OpsShortcode[] {
  return [
    { id: "cnc1", code: "RADIUS", name: "Radius corners", category: "cnc" },
    { id: "cnc2", code: "PROFILE", name: "Profile edge", category: "cnc" },
    { id: "cnc3", code: "CUTOUT", name: "Sink/hob cutout", category: "cnc" },
  ];
}

// ============================================================
// MATERIALS REFERENCE GENERATION
// ============================================================

function generateMaterialsReference(config: OrgTemplateConfig): string {
  if ((!config.materials || config.materials.length === 0) && 
      (!config.edgebands || config.edgebands.length === 0)) {
    return "";
  }
  
  let html = "";
  
  if (config.materials && config.materials.length > 0) {
    html += `
      <div class="materials-ref">
        <div class="ref-title">Materials:</div>
        <div class="ref-items">
          ${config.materials.map(m => 
            `<span class="ref-item"><code>${m.code || m.material_id.slice(0, 6)}</code> ${m.name} (${m.thickness_mm}mm)</span>`
          ).join("")}
        </div>
      </div>
    `;
  }
  
  if (config.edgebands && config.edgebands.length > 0) {
    html += `
      <div class="materials-ref">
        <div class="ref-title">Edgebands:</div>
        <div class="ref-items">
          ${config.edgebands.map(e => 
            `<span class="ref-item"><code>${e.code || e.edgeband_id.slice(0, 6)}</code> ${e.name}</span>`
          ).join("")}
        </div>
      </div>
    `;
  }
  
  return html;
}

// ============================================================
// MAIN TEMPLATE GENERATOR
// ============================================================

export function generateOrgTemplate(config: OrgTemplateConfig): GeneratedTemplate {
  // Generate deterministic template ID from org + hash
  const shortcodesHash = config.shortcodesHash || generateShortcodesHash(config.shortcodes);
  const templateId = `CAI-${config.version || "1.0"}-${shortcodesHash}`;
  const version = config.version || "1.0";
  const primaryColor = config.branding.primary_color || "#6B21A8"; // Purple default (like Cabinet AI)
  const secondaryColor = config.branding.secondary_color || "#4C1D95";
  const title = config.title || config.branding.template_title || "Smart Cutlist Template";
  const rows = config.rows || 25;
  
  // Build column headers based on enabled operations
  interface ColumnDef {
    key: string;
    label: string;
    width: string;
    isOps?: boolean;
    subLabel?: string;
  }
  
  const columns: ColumnDef[] = [
    { key: "#", label: "#", width: "24px" },
    { key: "label", label: "Part Name", width: "auto" },
    { key: "L", label: "L(mm)", width: "50px" },
    { key: "W", label: "W(mm)", width: "50px" },
    { key: "Thk", label: "Thk", width: "36px" },
    { key: "qty", label: "Qty", width: "36px" },
    { key: "material", label: "Material", width: "80px" },
  ];
  
  if (config.includeEdgebanding !== false) {
    columns.push({ key: "edge", label: "Edge", subLabel: "(code)", width: "50px", isOps: true });
  }
  if (config.includeGrooves) {
    columns.push({ key: "groove", label: "Groove", subLabel: "(GL/GW)", width: "55px", isOps: true });
  }
  if (config.includeDrilling) {
    columns.push({ key: "drill", label: "Drill", subLabel: "(code)", width: "50px", isOps: true });
  }
  if (config.includeCNC) {
    columns.push({ key: "cnc", label: "CNC", subLabel: "(code)", width: "55px", isOps: true });
  }
  if (config.includeNotes !== false) {
    columns.push({ key: "notes", label: "Notes", width: "auto" });
  }
  
  // Generate QR data
  const qrDataObj = generateQRData(config, templateId, version, shortcodesHash);
  const qrDataStr = JSON.stringify(qrDataObj);
  
  // Generate fill-in guide
  const fillInGuide = generateFillInGuide(config, primaryColor);
  
  // Generate materials reference
  const materialsRef = generateMaterialsReference(config);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${config.branding.name}</title>
  <style>
    @page { 
      size: A4 landscape; 
      margin: 10mm; 
    }
    @media print {
      .no-print { display: none !important; }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Segoe UI', -apple-system, Arial, sans-serif; 
      font-size: 9px; 
      color: #1a1a1a;
      line-height: 1.3;
      padding: 0;
      position: relative;
    }
    
    /* Corner Alignment Markers */
    .corner-marker {
      position: absolute;
      width: 20px;
      height: 20px;
      border: 2px solid #000;
    }
    .corner-tl { top: 5mm; left: 5mm; border-right: none; border-bottom: none; }
    .corner-tr { top: 5mm; right: 5mm; border-left: none; border-bottom: none; }
    .corner-bl { bottom: 5mm; left: 5mm; border-right: none; border-top: none; }
    .corner-br { bottom: 5mm; right: 5mm; border-left: none; border-top: none; }
    
    /* Header Area */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 8px;
    }
    
    /* Left: Logo & Branding */
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .qr-section {
      text-align: center;
    }
    
    .qr-code-container {
      width: 60px;
      height: 60px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
    }
    
    .template-id {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 7px;
      color: #666;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }
    
    .branding-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .org-name {
      font-size: 16px;
      font-weight: 700;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .template-title {
      font-size: 11px;
      color: #666;
    }
    
    .logo {
      max-height: 50px;
      max-width: 100px;
    }
    
    /* Center: Project Information */
    .header-center {
      flex: 1;
      max-width: 400px;
      margin: 0 16px;
    }
    
    .project-info-box {
      border: 1.5px solid #333;
      padding: 6px 10px;
    }
    
    .project-info-title {
      font-size: 9px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #333;
    }
    
    .project-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
    }
    
    .field-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .field-label {
      font-size: 8px;
      font-weight: 600;
      white-space: nowrap;
      min-width: 70px;
    }
    
    .field-input {
      flex: 1;
      border-bottom: 1px solid #333;
      min-width: 60px;
      height: 14px;
    }
    
    .field-input.small {
      width: 30px;
      min-width: 30px;
      flex: none;
    }
    
    .page-fields {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    
    /* Right: Page indicator box */
    .header-right {
      text-align: right;
    }
    
    .page-box {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
    }
    
    .page-num-box {
      width: 24px;
      height: 20px;
      border: 1.5px solid #333;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Main Table */
    .main-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      table-layout: fixed;
    }
    
    .main-table th,
    .main-table td {
      border: 1px solid #333;
      padding: 2px 3px;
      text-align: center;
      vertical-align: middle;
    }
    
    .main-table th {
      background: ${primaryColor};
      color: white;
      font-weight: 600;
      font-size: 8px;
      padding: 4px 2px;
    }
    
    .main-table th.ops-header {
      background: #E9D5FF; /* Light purple for ops columns */
      color: ${primaryColor};
    }
    
    .main-table th .sub-label {
      font-weight: 400;
      font-size: 7px;
      opacity: 0.9;
      display: block;
    }
    
    .main-table td {
      height: 18px;
      font-size: 9px;
    }
    
    .main-table td:first-child {
      color: #666;
      font-size: 8px;
      background: #fafafa;
    }
    
    .main-table td.part-name {
      text-align: left;
      padding-left: 6px;
    }
    
    /* Fill-in Guide */
    .fill-in-guide {
      margin-top: 10px;
      border: 1px solid #ddd;
      font-size: 8px;
    }
    
    .guide-header {
      color: white;
      font-weight: 700;
      font-size: 9px;
      padding: 4px 10px;
      letter-spacing: 1px;
    }
    
    .guide-content {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      padding: 6px 10px;
      background: #fafafa;
    }
    
    .guide-section {
      flex: 1;
      min-width: 120px;
      padding: 4px 8px;
      border-right: 1px solid #e0e0e0;
    }
    
    .guide-section:last-child {
      border-right: none;
    }
    
    .guide-section.ocr-tips {
      background: #FEF3C7;
      border-radius: 4px;
      margin-left: 8px;
      border-right: none;
    }
    
    .guide-title {
      font-weight: 700;
      font-size: 8px;
      margin-bottom: 3px;
      color: #333;
    }
    
    .guide-codes {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    
    .guide-item {
      font-size: 7px;
      color: #555;
    }
    
    .guide-item code {
      background: ${primaryColor}15;
      color: ${primaryColor};
      padding: 0 3px;
      border-radius: 2px;
      font-family: 'Consolas', monospace;
      font-weight: 600;
      font-size: 7px;
    }
    
    .ocr-tips .guide-item {
      font-weight: 700;
      color: #92400E;
    }
    
    /* Materials Reference */
    .materials-ref {
      display: inline-flex;
      align-items: flex-start;
      gap: 6px;
      margin-right: 16px;
      margin-top: 4px;
    }
    
    .ref-title {
      font-weight: 600;
      font-size: 7px;
      color: #666;
    }
    
    .ref-items {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    
    .ref-item {
      font-size: 7px;
      background: #f0f0f0;
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    .ref-item code {
      color: ${primaryColor};
      font-weight: 600;
      margin-right: 2px;
    }
    
    /* Footer */
    .footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7px;
      color: #888;
      padding-top: 4px;
      border-top: 1px solid #e0e0e0;
    }
    
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .powered-by {
      color: #aaa;
    }
    
    /* Print Button */
    .print-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .print-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <!-- Corner Alignment Markers for OCR -->
  <div class="corner-marker corner-tl"></div>
  <div class="corner-marker corner-tr"></div>
  <div class="corner-marker corner-bl"></div>
  <div class="corner-marker corner-br"></div>
  
  <!-- Header -->
  <div class="header-container">
    <!-- Left: QR + Branding -->
    <div class="header-left">
      <div class="qr-section">
        <div class="qr-code-container" id="qr-placeholder" data-qr="${encodeURIComponent(qrDataStr)}">
          <svg viewBox="0 0 60 60" style="width:100%;height:100%">
            <rect fill="#f5f5f5" width="60" height="60"/>
            <text x="30" y="30" text-anchor="middle" dominant-baseline="middle" font-size="6" fill="#999">QR</text>
          </svg>
        </div>
        <div class="template-id">${templateId}</div>
      </div>
      
      <div class="branding-info">
        ${config.branding.logo_url ? `<img src="${config.branding.logo_url}" alt="" class="logo">` : ""}
        <div class="org-name">${config.branding.name}</div>
        <div class="template-title">${title} v${version}</div>
      </div>
    </div>
    
    <!-- Center: Project Information -->
    <div class="header-center">
      <div class="project-info-box">
        <div class="project-info-title">PROJECT INFORMATION (Must fill for multi-page)</div>
        <div class="project-fields">
          <div class="field-row">
            <span class="field-label">Project Name:</span>
            <span class="field-input"></span>
          </div>
          <div class="field-row">
            <span class="field-label">Project Code:</span>
            <span class="field-input"></span>
          </div>
          <div class="field-row">
            <span class="field-label">Customer Name:</span>
            <span class="field-input"></span>
          </div>
          <div class="field-row">
            <span class="field-label">Phone:</span>
            <span class="field-input"></span>
          </div>
          <div class="field-row">
            <span class="field-label">Customer Email:</span>
            <span class="field-input"></span>
          </div>
          <div class="field-row">
            <span class="field-label">Section/Area:</span>
            <span class="field-input"></span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Right: Page indicator -->
    <div class="header-right">
      <div class="page-box">
        Page: <span class="page-num-box"></span> of <span class="page-num-box"></span>
      </div>
    </div>
  </div>
  
  <!-- Main Parts Table -->
  <table class="main-table">
    <thead>
      <tr>
        ${columns.map(col => `
          <th ${col.isOps ? 'class="ops-header"' : ''} style="width: ${col.width};">
            ${col.label}
            ${col.subLabel ? `<span class="sub-label">${col.subLabel}</span>` : ""}
          </th>
        `).join("")}
      </tr>
    </thead>
    <tbody>
      ${Array(rows).fill("").map((_, i) => `
        <tr>
          ${columns.map((col, j) => {
            if (j === 0) return `<td>${i + 1}</td>`;
            if (col.key === "label") return `<td class="part-name"></td>`;
            return `<td></td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <!-- Fill-in Guide -->
  ${fillInGuide}
  
  <!-- Materials Reference (inline below guide) -->
  <div style="margin-top: 6px;">
    ${materialsRef}
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">
      <span>${config.branding.name} | ${config.branding.contact_info || ""}</span>
      <span>•</span>
      <span>CabinetAI™ Smart Template v${version} | Page</span>
    </div>
    <div class="powered-by">
      Powered by CAI Intake
    </div>
  </div>
  
  <!-- Print Button (hidden when printing) -->
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  
  <!-- QR Code Generation -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const qrPlaceholder = document.getElementById('qr-placeholder');
      if (qrPlaceholder && typeof QRCode !== 'undefined') {
        const qrData = decodeURIComponent(qrPlaceholder.dataset.qr);
        qrPlaceholder.innerHTML = '';
        new QRCode(qrPlaceholder, {
          text: qrData,
          width: 60,
          height: 60,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    });
  </script>
</body>
</html>
`;

  return {
    template_id: templateId,
    version,
    org_id: config.branding.org_id,
    html,
    qr_data: qrDataStr,
    shortcodes_hash: shortcodesHash,
    generated_at: new Date().toISOString(),
  };
}

// ============================================================
// EXCEL/CSV TEMPLATE GENERATOR
// ============================================================

export function generateOrgExcelTemplate(config: OrgTemplateConfig): string {
  const shortcodesHash = config.shortcodesHash || generateShortcodesHash(config.shortcodes);
  const templateId = `CAI-${config.version || "1.0"}-${shortcodesHash}`;
  const version = config.version || "1.0";
  const rows = config.rows || 50;
  
  // Build headers
  const headers: string[] = [
    "#",
    "Part Name",
    "L(mm)",
    "W(mm)",
    "Thk",
    "Qty",
    "Material",
  ];
  
  if (config.includeEdgebanding !== false) {
    headers.push("Edge (code)");
  }
  if (config.includeGrooves) {
    headers.push("Groove (GL/GW)");
  }
  if (config.includeDrilling) {
    headers.push("Drill (code)");
  }
  if (config.includeCNC) {
    headers.push("CNC (code)");
  }
  if (config.includeNotes !== false) {
    headers.push("Notes");
  }
  
  // Build CSV
  const csvRows: string[] = [];
  
  // Template metadata row
  csvRows.push(`"${config.branding.name}","${templateId}","Smart Cutlist Template v${version}"`);
  csvRows.push("");
  
  // Project info rows
  csvRows.push(`"PROJECT INFORMATION (Must fill for multi-page)"`);
  csvRows.push(`"Project Name:","","Project Code:","","Page:","of"`);
  csvRows.push(`"Customer Name:","","Phone:","","Section/Area:",""`);
  csvRows.push("");
  
  // Headers
  csvRows.push(headers.map(h => `"${h}"`).join(","));
  
  // Data rows (numbered)
  for (let i = 1; i <= rows; i++) {
    const row = [i.toString(), ...Array(headers.length - 1).fill("")];
    csvRows.push(row.join(","));
  }
  
  // Fill-in guide
  csvRows.push("");
  csvRows.push(`"FILL-IN GUIDE"`);
  
  if (config.includeEdgebanding !== false) {
    const ebCodes = (config.shortcodes?.filter(s => s.category === "edgebanding") || getDefaultEdgebandingCodes())
      .map(s => `${s.code}=${s.name}`).join("; ");
    csvRows.push(`"Edgebanding:","${ebCodes}"`);
  }
  
  if (config.includeGrooves) {
    const grvCodes = (config.shortcodes?.filter(s => s.category === "grooving") || getDefaultGroovingCodes())
      .map(s => `${s.code}=${s.name}`).join("; ");
    csvRows.push(`"Grooving:","${grvCodes}"`);
  }
  
  if (config.includeDrilling) {
    const drillCodes = (config.shortcodes?.filter(s => s.category === "drilling") || getDefaultDrillingCodes())
      .map(s => `${s.code}=${s.name}`).join("; ");
    csvRows.push(`"Drilling:","${drillCodes}"`);
  }
  
  if (config.includeCNC) {
    const cncCodes = (config.shortcodes?.filter(s => s.category === "cnc") || getDefaultCNCCodes())
      .map(s => `${s.code}=${s.name}`).join("; ");
    csvRows.push(`"CNC:","${cncCodes}"`);
  }
  
  csvRows.push(`"Best OCR:","BLOCK LETTERS, Clear photo"`);
  
  // Materials reference
  if (config.materials && config.materials.length > 0) {
    csvRows.push("");
    csvRows.push(`"MATERIALS REFERENCE"`);
    csvRows.push(`"Code","Name","Thickness (mm)"`);
    config.materials.forEach(m => {
      csvRows.push(`"${m.code || m.material_id.slice(0, 6)}","${m.name}","${m.thickness_mm}"`);
    });
  }
  
  if (config.edgebands && config.edgebands.length > 0) {
    csvRows.push("");
    csvRows.push(`"EDGEBANDS REFERENCE"`);
    csvRows.push(`"Code","Name","Thickness (mm)"`);
    config.edgebands.forEach(e => {
      csvRows.push(`"${e.code || e.edgeband_id.slice(0, 6)}","${e.name}","${e.thickness_mm}"`);
    });
  }
  
  return csvRows.join("\n");
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate a downloadable template (triggers browser download)
 */
export function downloadTemplate(
  config: OrgTemplateConfig, 
  format: "pdf" | "excel" = "pdf"
): void {
  const filename = `${config.branding.name.replace(/\s+/g, "_")}_Template_v${config.version || "1.0"}`;
  
  if (format === "pdf") {
    const template = generateOrgTemplate(config);
    const blob = new Blob([template.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab for printing to PDF
    const win = window.open(url, "_blank");
    if (win) {
      win.document.title = `${filename}.pdf`;
    }
    
    // Cleanup after delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const csv = generateOrgExcelTemplate(config);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

/**
 * Calculate new version when shortcodes change
 */
export function calculateTemplateVersion(
  currentVersion: string,
  oldShortcodesHash: string,
  newShortcodesHash: string
): string {
  if (oldShortcodesHash === newShortcodesHash) {
    return currentVersion;
  }
  
  // Increment minor version
  const parts = currentVersion.split(".");
  const major = parseInt(parts[0] || "1", 10);
  const minor = parseInt(parts[1] || "0", 10);
  
  return `${major}.${minor + 1}`;
}

/**
 * Re-export utility for external use
 */
export { generateShortcodesHash };

