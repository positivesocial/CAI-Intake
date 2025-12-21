/**
 * CAI Intake - Organization-Branded Template Generator
 * 
 * Generates professional PDF and Excel templates for cutlist intake with:
 * - Organization branding (logo, colors, name)
 * - QR codes for AI-assisted parsing
 * - Template version tracking
 * - Project code and page number fields
 * - Materials addendum
 * - Shortcode reference guide
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

export interface GrooveProfileDef {
  profile_id: string;
  name: string;
  width_mm: number;
  depth_mm: number;
  code?: string;
}

export interface HolePatternDef {
  pattern_id: string;
  name: string;
  code?: string; // e.g., "S32", "SP", "H110"
  description?: string;
}

export interface RoutingProfileDef {
  profile_id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface OrgTemplateConfig {
  /** Organization branding */
  branding: OrganizationBranding;
  
  /** Template title */
  title?: string;
  
  /** Template version (increments with changes) */
  version?: string;
  
  /** Number of rows for parts */
  rows?: number;
  
  /** Include operations columns */
  includeEdgebanding?: boolean;
  includeGrooves?: boolean;
  includeHoles?: boolean;
  includeCNC?: boolean;
  includeNotes?: boolean;
  
  /** Organization's materials library */
  materials?: MaterialDef[];
  
  /** Organization's edgebanding library */
  edgebands?: EdgebandDef[];
  
  /** Organization's groove profiles */
  grooveProfiles?: GrooveProfileDef[];
  
  /** Organization's hole patterns */
  holePatterns?: HolePatternDef[];
  
  /** Organization's routing profiles */
  routingProfiles?: RoutingProfileDef[];
  
  /** Custom shortcode guide content */
  customShortcodeGuide?: string;
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
  /** Generated timestamp */
  generated_at: string;
}

// ============================================================
// QR CODE DATA GENERATION
// ============================================================

export interface TemplateQRData {
  type: "cai-org-template";
  template_id: string;
  org_id: string;
  version: string;
  schema: "cutlist/v2";
  capabilities: {
    edgebanding: boolean;
    grooves: boolean;
    holes: boolean;
    cnc: boolean;
    notes: boolean;
  };
  /** Field order for AI parsing */
  field_order: string[];
  /** Short codes mapping hint */
  has_shortcodes: boolean;
}

function generateQRData(config: OrgTemplateConfig, templateId: string, version: string): TemplateQRData {
  const fieldOrder = ["#", "label", "L", "W", "qty", "material", "thk", "grain"];
  
  if (config.includeEdgebanding !== false) {
    fieldOrder.push("eb_L1", "eb_L2", "eb_W1", "eb_W2");
  }
  if (config.includeGrooves) {
    fieldOrder.push("grv_side", "grv_d", "grv_w");
  }
  if (config.includeHoles) {
    fieldOrder.push("hole_pattern", "hole_dia", "hole_depth");
  }
  if (config.includeCNC) {
    fieldOrder.push("cnc_prog", "cnc_notes");
  }
  if (config.includeNotes !== false) {
    fieldOrder.push("notes");
  }
  
  return {
    type: "cai-org-template",
    template_id: templateId,
    org_id: config.branding.org_id,
    version,
    schema: "cutlist/v2",
    capabilities: {
      edgebanding: config.includeEdgebanding !== false,
      grooves: !!config.includeGrooves,
      holes: !!config.includeHoles,
      cnc: !!config.includeCNC,
      notes: config.includeNotes !== false,
    },
    field_order: fieldOrder,
    has_shortcodes: !!(config.materials?.some(m => m.code) || config.edgebands?.some(e => e.code)),
  };
}

// ============================================================
// SHORTCODE GUIDE GENERATION
// ============================================================

function generateShortcodeGuide(config: OrgTemplateConfig): string {
  const sections: string[] = [];
  
  // Standard shortcodes
  sections.push(`
    <div class="shortcode-section">
      <h4>📐 Dimensions & Quantity</h4>
      <div class="shortcode-grid">
        <div class="shortcode"><code>L</code> Length in mm</div>
        <div class="shortcode"><code>W</code> Width in mm</div>
        <div class="shortcode"><code>x2</code> or <code>qty:2</code> Quantity</div>
        <div class="shortcode"><code>T:18</code> Thickness (mm)</div>
      </div>
    </div>
  `);
  
  sections.push(`
    <div class="shortcode-section">
      <h4>🌾 Grain Direction</h4>
      <div class="shortcode-grid">
        <div class="shortcode"><code>GL</code> Grain along Length</div>
        <div class="shortcode"><code>GW</code> Grain along Width</div>
        <div class="shortcode"><code>—</code> or blank = can rotate</div>
      </div>
    </div>
  `);
  
  // Edgebanding
  if (config.includeEdgebanding !== false) {
    let ebSection = `
      <div class="shortcode-section">
        <h4>📏 Edgebanding</h4>
        <div class="shortcode-grid">
          <div class="shortcode"><code>L1</code> Long edge 1</div>
          <div class="shortcode"><code>L2</code> Long edge 2</div>
          <div class="shortcode"><code>W1</code> Short edge 1</div>
          <div class="shortcode"><code>W2</code> Short edge 2</div>
          <div class="shortcode"><code>2L</code> Both long edges</div>
          <div class="shortcode"><code>2W</code> Both short edges</div>
          <div class="shortcode"><code>2L2W</code> All edges</div>
          <div class="shortcode"><code>✓</code> or <code>X</code> per cell</div>
        </div>
    `;
    
    if (config.edgebands && config.edgebands.length > 0) {
      ebSection += `
        <div class="materials-list">
          <strong>Available Edgebands:</strong>
          ${config.edgebands.map(e => 
            `<span class="material-item">${e.code ? `<code>${e.code}</code>` : ""} ${e.name} (${e.thickness_mm}mm)</span>`
          ).join("")}
        </div>
      `;
    }
    
    ebSection += `</div>`;
    sections.push(ebSection);
  }
  
  // Grooves
  if (config.includeGrooves) {
    let grvSection = `
      <div class="shortcode-section">
        <h4>📐 Grooves</h4>
        <div class="shortcode-grid">
          <div class="shortcode"><code>GR:L1</code> Groove on long edge 1</div>
          <div class="shortcode"><code>GR:W2</code> Groove on short edge 2</div>
          <div class="shortcode"><code>GR:F</code> Groove on face</div>
          <div class="shortcode"><code>GR:B</code> Groove on back</div>
          <div class="shortcode"><code>D:4</code> Depth 4mm</div>
          <div class="shortcode"><code>W:8</code> Width 8mm</div>
        </div>
    `;
    
    if (config.grooveProfiles && config.grooveProfiles.length > 0) {
      grvSection += `
        <div class="materials-list">
          <strong>Groove Profiles:</strong>
          ${config.grooveProfiles.map(g => 
            `<span class="material-item">${g.code ? `<code>${g.code}</code>` : ""} ${g.name} (${g.width_mm}×${g.depth_mm}mm)</span>`
          ).join("")}
        </div>
      `;
    }
    
    grvSection += `</div>`;
    sections.push(grvSection);
  }
  
  // Holes
  if (config.includeHoles) {
    let holeSection = `
      <div class="shortcode-section">
        <h4>🔘 Hole Patterns</h4>
        <div class="shortcode-grid">
          <div class="shortcode"><code>H:S32</code> System 32 holes</div>
          <div class="shortcode"><code>H:SP</code> Shelf pin holes</div>
          <div class="shortcode"><code>H:H110</code> 110° hinge bore</div>
          <div class="shortcode"><code>Ø5</code> Diameter 5mm</div>
          <div class="shortcode"><code>Dp:12</code> Depth 12mm</div>
        </div>
    `;
    
    if (config.holePatterns && config.holePatterns.length > 0) {
      holeSection += `
        <div class="materials-list">
          <strong>Hole Patterns:</strong>
          ${config.holePatterns.map(h => 
            `<span class="material-item"><code>${h.code}</code> ${h.name}</span>`
          ).join("")}
        </div>
      `;
    }
    
    holeSection += `</div>`;
    sections.push(holeSection);
  }
  
  // CNC
  if (config.includeCNC) {
    let cncSection = `
      <div class="shortcode-section">
        <h4>🔧 CNC Operations</h4>
        <div class="shortcode-grid">
          <div class="shortcode"><code>CNC:PROG_ID</code> Program reference</div>
          <div class="shortcode"><code>CUTOUT</code> Cutout operation</div>
          <div class="shortcode"><code>POCKET</code> Pocket routing</div>
          <div class="shortcode"><code>PROFILE</code> Profile edge routing</div>
        </div>
    `;
    
    if (config.routingProfiles && config.routingProfiles.length > 0) {
      cncSection += `
        <div class="materials-list">
          <strong>Routing Profiles:</strong>
          ${config.routingProfiles.map(r => 
            `<span class="material-item">${r.code ? `<code>${r.code}</code>` : ""} ${r.name}</span>`
          ).join("")}
        </div>
      `;
    }
    
    cncSection += `</div>`;
    sections.push(cncSection);
  }
  
  // Custom guide content
  if (config.customShortcodeGuide) {
    sections.push(`
      <div class="shortcode-section custom-guide">
        ${config.customShortcodeGuide}
      </div>
    `);
  }
  
  return sections.join("");
}

// ============================================================
// MATERIALS ADDENDUM GENERATION
// ============================================================

function generateMaterialsAddendum(config: OrgTemplateConfig): string {
  if (!config.materials || config.materials.length === 0) {
    return "";
  }
  
  return `
    <div class="materials-addendum page-break-before">
      <h3>📋 Materials Reference</h3>
      <table class="materials-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Material Name</th>
            <th>Thickness</th>
          </tr>
        </thead>
        <tbody>
          ${config.materials.map(m => `
            <tr>
              <td class="code-cell"><code>${m.code || m.material_id.slice(0, 8)}</code></td>
              <td>${m.name}</td>
              <td>${m.thickness_mm}mm</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      
      ${config.edgebands && config.edgebands.length > 0 ? `
        <h4 style="margin-top: 16px;">Edgebands</h4>
        <table class="materials-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Edgeband Name</th>
              <th>Thickness</th>
            </tr>
          </thead>
          <tbody>
            ${config.edgebands.map(e => `
              <tr>
                <td class="code-cell"><code>${e.code || e.edgeband_id.slice(0, 8)}</code></td>
                <td>${e.name}</td>
                <td>${e.thickness_mm}mm</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
    </div>
  `;
}

// ============================================================
// MAIN TEMPLATE GENERATOR
// ============================================================

export function generateOrgTemplate(config: OrgTemplateConfig): GeneratedTemplate {
  const templateId = generateId("TPL");
  const version = config.version || "1.0";
  const primaryColor = config.branding.primary_color || "#00838F";
  const secondaryColor = config.branding.secondary_color || "#004D40";
  const title = config.title || "Cutlist Entry Form";
  const rows = config.rows || 25;
  
  // Build column headers
  const columns: string[] = ["#", "Part Name / Label", "L (mm)", "W (mm)", "Qty", "Material", "Thk", "Grain"];
  
  if (config.includeEdgebanding !== false) {
    columns.push("L1", "L2", "W1", "W2");
  }
  if (config.includeGrooves) {
    columns.push("Grv", "D", "W");
  }
  if (config.includeHoles) {
    columns.push("Holes", "Ø", "Dp");
  }
  if (config.includeCNC) {
    columns.push("CNC Prog", "CNC Notes");
  }
  if (config.includeNotes !== false) {
    columns.push("Notes");
  }
  
  // Generate QR data
  const qrDataObj = generateQRData(config, templateId, version);
  const qrDataStr = JSON.stringify(qrDataObj);
  
  // Generate shortcode guide
  const shortcodeGuide = generateShortcodeGuide(config);
  
  // Generate materials addendum
  const materialsAddendum = generateMaterialsAddendum(config);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${config.branding.name}</title>
  <style>
    @page { 
      size: A4 landscape; 
      margin: 12mm; 
    }
    @media print {
      .page-break-before { page-break-before: always; }
      .no-print { display: none; }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      font-size: 10px; 
      color: #1a1a1a;
      line-height: 1.4;
    }
    
    /* Header */
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid ${primaryColor};
    }
    
    .header-left { flex: 1; }
    
    .branding {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      max-height: 40px;
      max-width: 120px;
    }
    
    .org-name {
      font-size: 14px;
      font-weight: 700;
      color: ${primaryColor};
    }
    
    .title { 
      font-size: 16px; 
      font-weight: 700;
      color: #333;
      margin-top: 6px;
    }
    
    .template-info {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      font-size: 9px;
      color: #666;
    }
    
    .template-info code {
      background: #f0f0f0;
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    .header-center {
      flex: 1.5;
      padding: 0 16px;
    }
    
    .project-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    
    .field-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .field-label {
      font-weight: 600;
      font-size: 9px;
      white-space: nowrap;
    }
    
    .field-input {
      flex: 1;
      border-bottom: 1px solid #999;
      min-width: 80px;
      height: 16px;
    }
    
    .field-input.large {
      min-width: 120px;
    }
    
    .header-right { 
      display: flex; 
      gap: 12px; 
      align-items: flex-start; 
    }
    
    .qr-section { 
      text-align: center; 
    }
    
    .qr-code { 
      width: 70px; 
      height: 70px; 
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .qr-label { 
      font-size: 7px; 
      color: #666; 
      margin-top: 2px; 
    }
    
    /* Main Table */
    .main-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 8px;
    }
    
    .main-table th, 
    .main-table td { 
      border: 1px solid #333; 
      padding: 4px 3px; 
      text-align: left;
      vertical-align: middle;
    }
    
    .main-table th { 
      background: ${primaryColor}; 
      color: white;
      font-weight: 600; 
      font-size: 8px;
      text-align: center;
    }
    
    .main-table th.ops-col {
      background: ${secondaryColor};
    }
    
    .main-table td { 
      height: 18px; 
    }
    
    .main-table td:first-child {
      text-align: center;
      width: 20px;
      color: #666;
      font-size: 9px;
    }
    
    /* Checkbox cells */
    .main-table td.checkbox-cell {
      width: 24px;
      text-align: center;
    }
    
    /* Footer */
    .footer { 
      margin-top: 10px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      font-size: 8px;
      color: #666;
      padding-top: 8px;
      border-top: 1px solid #ddd;
    }
    
    .footer-left {
      display: flex;
      gap: 16px;
    }
    
    .page-indicator {
      font-weight: 600;
    }
    
    /* Shortcode Guide */
    .shortcode-guide {
      margin-top: 12px;
      padding: 8px;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    
    .shortcode-guide h3 {
      font-size: 10px;
      color: ${primaryColor};
      margin-bottom: 8px;
    }
    
    .shortcode-section {
      margin-bottom: 8px;
    }
    
    .shortcode-section h4 {
      font-size: 9px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .shortcode-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 4px;
      font-size: 8px;
    }
    
    .shortcode {
      background: white;
      padding: 2px 4px;
      border-radius: 2px;
    }
    
    .shortcode code {
      background: #e8f4f8;
      color: ${primaryColor};
      padding: 1px 3px;
      border-radius: 2px;
      font-family: 'Consolas', monospace;
      font-weight: 600;
    }
    
    .materials-list {
      margin-top: 6px;
      padding: 4px;
      background: #f8f8f8;
      border-radius: 4px;
      font-size: 8px;
    }
    
    .materials-list strong {
      display: block;
      margin-bottom: 4px;
    }
    
    .material-item {
      display: inline-block;
      margin: 2px 6px 2px 0;
      padding: 1px 4px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 2px;
    }
    
    .material-item code {
      background: ${primaryColor}15;
      color: ${primaryColor};
      padding: 0 2px;
      border-radius: 2px;
      margin-right: 3px;
    }
    
    /* Materials Addendum */
    .materials-addendum {
      margin-top: 20px;
    }
    
    .materials-addendum h3 {
      font-size: 12px;
      color: ${primaryColor};
      margin-bottom: 10px;
    }
    
    .materials-addendum h4 {
      font-size: 10px;
      color: #333;
      margin-bottom: 6px;
    }
    
    .materials-table {
      width: 100%;
      max-width: 500px;
      border-collapse: collapse;
      font-size: 9px;
    }
    
    .materials-table th,
    .materials-table td {
      border: 1px solid #ddd;
      padding: 4px 8px;
      text-align: left;
    }
    
    .materials-table th {
      background: #f0f0f0;
      font-weight: 600;
    }
    
    .materials-table .code-cell code {
      background: ${primaryColor}15;
      color: ${primaryColor};
      padding: 2px 4px;
      border-radius: 2px;
      font-family: 'Consolas', monospace;
    }
    
    /* Print button */
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
    }
    
    .print-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="branding">
        ${config.branding.logo_url ? `<img src="${config.branding.logo_url}" alt="${config.branding.name}" class="logo">` : ""}
        <span class="org-name">${config.branding.name}</span>
      </div>
      <div class="title">${title}</div>
      <div class="template-info">
        <span>Template: <code>${templateId}</code></span>
        <span>Version: <code>v${version}</code></span>
        <span>Generated: ${new Date().toLocaleDateString()}</span>
      </div>
    </div>
    
    <div class="header-center">
      <div class="project-fields">
        <div class="field-row">
          <span class="field-label">Project Code:</span>
          <span class="field-input large"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Page:</span>
          <span class="field-input" style="width: 30px;"></span>
          <span class="field-label">of</span>
          <span class="field-input" style="width: 30px;"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Job Ref:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Date:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Client:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Prepared By:</span>
          <span class="field-input"></span>
        </div>
      </div>
    </div>
    
    <div class="header-right">
      <div class="qr-section">
        <div class="qr-code" id="qr-placeholder" data-qr="${encodeURIComponent(qrDataStr)}">
          <svg viewBox="0 0 70 70" style="width:100%;height:100%">
            <rect fill="#f0f0f0" width="70" height="70"/>
            <text x="35" y="35" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="#999">QR Code</text>
          </svg>
        </div>
        <div class="qr-label">Scan for AI parsing</div>
      </div>
    </div>
  </div>
  
  <!-- Main Parts Table -->
  <table class="main-table">
    <thead>
      <tr>
        ${columns.map((col, i) => {
          const isOpsCol = i >= 8; // After grain column
          return `<th class="${isOpsCol ? 'ops-col' : ''}">${col}</th>`;
        }).join("")}
      </tr>
    </thead>
    <tbody>
      ${Array(rows).fill("").map((_, i) => `
        <tr>
          ${columns.map((col, j) => {
            if (j === 0) return `<td>${i + 1}</td>`;
            // Checkbox columns for edgebanding
            if (config.includeEdgebanding !== false && ["L1", "L2", "W1", "W2"].includes(col)) {
              return `<td class="checkbox-cell"></td>`;
            }
            return `<td></td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span>Template ID: ${templateId}</span>
      <span>•</span>
      <span>Version: v${version}</span>
      <span>•</span>
      <span>${config.branding.contact_info || ""}</span>
    </div>
    <div class="footer-right">
      <span class="page-indicator">Page ___ of ___</span>
      <span style="margin-left: 16px;">Powered by CAI Intake</span>
    </div>
  </div>
  
  <!-- Shortcode Guide -->
  <div class="shortcode-guide">
    <h3>📖 Quick Reference Guide</h3>
    ${shortcodeGuide}
  </div>
  
  ${materialsAddendum}
  
  <!-- Print Button (hidden when printing) -->
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  
  <!-- QR Code Library -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const qrPlaceholder = document.getElementById('qr-placeholder');
      if (qrPlaceholder && typeof QRCode !== 'undefined') {
        const qrData = decodeURIComponent(qrPlaceholder.dataset.qr);
        qrPlaceholder.innerHTML = '';
        new QRCode(qrPlaceholder, {
          text: qrData,
          width: 70,
          height: 70,
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
    generated_at: new Date().toISOString(),
  };
}

// ============================================================
// EXCEL/CSV TEMPLATE GENERATOR
// ============================================================

export function generateOrgExcelTemplate(config: OrgTemplateConfig): string {
  const version = config.version || "1.0";
  const rows = config.rows || 50;
  
  // Build headers
  const headers: string[] = [
    "#",
    "Part Name / Label",
    "Length (mm)",
    "Width (mm)",
    "Qty",
    "Material Code",
    "Thickness (mm)",
    "Grain (GL/GW/-)",
  ];
  
  if (config.includeEdgebanding !== false) {
    headers.push("EB L1", "EB L2", "EB W1", "EB W2", "Edgeband Code");
  }
  if (config.includeGrooves) {
    headers.push("Groove Side", "Groove Depth", "Groove Width");
  }
  if (config.includeHoles) {
    headers.push("Hole Pattern", "Hole Ø", "Hole Depth");
  }
  if (config.includeCNC) {
    headers.push("CNC Program", "CNC Notes");
  }
  if (config.includeNotes !== false) {
    headers.push("Notes");
  }
  
  // Add metadata row
  const metaRow = [
    `Template: ${config.branding.name}`,
    `Version: v${version}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    "",
    "Project Code:",
    "",
    "Page:",
    "of",
  ];
  
  // Build CSV
  const csvRows: string[] = [];
  
  // Meta info as comment-like row
  csvRows.push(metaRow.join(","));
  csvRows.push(""); // Empty row
  
  // Headers
  csvRows.push(headers.join(","));
  
  // Data rows (numbered)
  for (let i = 1; i <= rows; i++) {
    const row = [i.toString(), ...Array(headers.length - 1).fill("")];
    csvRows.push(row.join(","));
  }
  
  // Add materials reference at the bottom
  if (config.materials && config.materials.length > 0) {
    csvRows.push("");
    csvRows.push("--- MATERIALS REFERENCE ---");
    csvRows.push("Code,Name,Thickness (mm)");
    config.materials.forEach(m => {
      csvRows.push(`${m.code || m.material_id},${m.name},${m.thickness_mm}`);
    });
  }
  
  if (config.edgebands && config.edgebands.length > 0) {
    csvRows.push("");
    csvRows.push("--- EDGEBANDS REFERENCE ---");
    csvRows.push("Code,Name,Thickness (mm)");
    config.edgebands.forEach(e => {
      csvRows.push(`${e.code || e.edgeband_id},${e.name},${e.thickness_mm}`);
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



