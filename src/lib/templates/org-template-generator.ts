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
import QRCode from "qrcode";

// ============================================================
// TYPES
// ============================================================

export interface OrganizationBranding {
  /** Organization ID (unique identifier) */
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
  
  /** Include fill-in guide (on separate page) */
  includeFillInGuide?: boolean;
  
  /** Include materials reference (on fill-in guide page) */
  includeMaterialsRef?: boolean;
  
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
  /** QR code data - MINIMAL (just template ID for robust scanning) */
  qr_data: string;
  /** Full template metadata JSON (stored server-side for lookup) */
  template_metadata: string;
  /** Shortcodes hash (for versioning) */
  shortcodes_hash: string;
  /** Generated timestamp */
  generated_at: string;
}

// ============================================================
// QR CODE DATA GENERATION
// ============================================================

/**
 * QR Code Strategy:
 * - MINIMAL data for robust scanning (works with poor photos)
 * - Just the template ID string (e.g., "CAI-1.0-a7f3b2c1")
 * - Full template config looked up server-side by ID
 * - High error correction (Level H) allows CAI logo in center
 */

export interface TemplateQRData {
  /** The minimal QR code content - just the template ID */
  qr_content: string;
  /** Full template metadata (stored server-side, not in QR) */
  full_metadata: {
    type: "cai-template";
    id: string;
    org: string;
    v: string;
    schema: "cutlist/v2";
    cols: string[];
    caps: {
      eb: boolean;
      grv: boolean;
      drill: boolean;
      cnc: boolean;
      notes: boolean;
    };
    sc_hash?: string;
  };
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
    // MINIMAL QR content - just the template ID for robust scanning
    qr_content: templateId,
    // Full metadata stored separately (looked up by ID when parsing)
    full_metadata: {
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
    },
  };
}

// ============================================================
// QR CODE SVG GENERATION
// ============================================================

/**
 * Generate a QR code SVG with CAI logo in the center
 */
function generateQRCodeSVG(content: string, primaryColor: string, size: number = 55): string {
  try {
    // Create QR code with high error correction (allows logo in center)
    const qr = QRCode.create(content, {
      errorCorrectionLevel: "H", // High - 30% error correction
    });
    
    const modules = qr.modules;
    const moduleCount = modules.size;
    const cellSize = size / moduleCount;
    
    let svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect fill="white" width="${size}" height="${size}"/>`;
    
    // Draw QR code modules
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (modules.get(row, col)) {
          svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
    
    // Add CAI funnel logo in center
    const logoSize = size * 0.2;
    const cx = size / 2;
    const cy = size / 2;
    
    // White circle background
    svg += `<circle cx="${cx}" cy="${cy}" r="${logoSize / 2 + 1}" fill="white"/>`;
    
    // Purple funnel
    const w = logoSize * 0.65;
    const h = logoSize * 0.75;
    svg += `<path d="M${cx - w / 2} ${cy - h / 2} L${cx + w / 2} ${cy - h / 2} L${cx + w / 6} ${cy + h / 4} L${cx + w / 6} ${cy + h / 2} L${cx - w / 6} ${cy + h / 2} L${cx - w / 6} ${cy + h / 4} Z" fill="${primaryColor}"/>`;
    svg += `<circle cx="${cx}" cy="${cy + h / 2 + 2}" r="1.5" fill="${primaryColor}"/>`;
    
    svg += "</svg>";
    
    return svg;
  } catch (error) {
    console.error("QR code generation failed:", error);
    // Return a fallback with just the text
    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect fill="white" width="${size}" height="${size}" stroke="#ccc" stroke-width="1"/>
      <text x="${size / 2}" y="${size / 2}" font-size="6" text-anchor="middle" fill="#666">${content}</text>
    </svg>`;
  }
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
// NOTE: Database fetching is done via API routes
// See /api/v1/template-shortcodes for server-side fetching
// ============================================================

/**
 * Build template config with provided shortcodes.
 * Use the /api/v1/template-shortcodes API to fetch org shortcodes first.
 */
export function buildTemplateConfigWithShortcodes(
  branding: OrganizationBranding,
  shortcodes: OpsShortcode[],
  baseConfig: Partial<OrgTemplateConfig> = {}
): OrgTemplateConfig {
  // Generate hash for versioning
  const shortcodesHash = generateShortcodesHash(shortcodes);
  
  return {
    branding,
    ...baseConfig,
    shortcodes: shortcodes.length > 0 ? shortcodes : undefined,
    shortcodesHash,
  };
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
  // Template ID: CAI-{short_org_id}-v{version}
  // - CAI prefix = CAI Intake template
  // - short_org_id = First 8 chars of org ID (for compact QR)
  // - version = Template version (increments when shortcodes change)
  const version = config.version || "1.0";
  const shortOrgId = config.branding.org_id.slice(0, 8); // Use first 8 chars for compact ID
  const templateId = `CAI-${shortOrgId}-v${version}`;
  const shortcodesHash = config.shortcodesHash || generateShortcodesHash(config.shortcodes);
  const primaryColor = config.branding.primary_color || "#6B21A8"; // Purple default (like Cabinet AI)
  const secondaryColor = config.branding.secondary_color || "#4C1D95";
  const title = config.title || config.branding.template_title || "Smart Cutlist Template";
  const rows = config.rows || 35; // 35 rows default (more since guide is on separate page)
  const orgName = config.branding.name || "Organization";
  const includeFillInGuide = config.includeFillInGuide !== false; // Default true
  const includeMaterialsRef = config.includeMaterialsRef !== false; // Default true
  
  // Build column headers based on enabled operations
  interface ColumnDef {
    key: string;
    label: string;
    width: string;
    isOps?: boolean;
    subLabel?: string;
  }
  
  // Portrait layout - wider Part Name and Notes columns
  const columns: ColumnDef[] = [
    { key: "#", label: "#", width: "20px" },
    { key: "label", label: "Part Name", width: "120px" }, // Wider for part names
    { key: "L", label: "L(mm)", width: "38px" },
    { key: "W", label: "W(mm)", width: "38px" },
    { key: "Thk", label: "Thk", width: "26px" },
    { key: "qty", label: "Qty", width: "24px" },
    { key: "material", label: "Material", width: "55px" },
  ];
  
  if (config.includeEdgebanding !== false) {
    columns.push({ key: "edge", label: "Edge", subLabel: "(code)", width: "42px", isOps: true });
  }
  if (config.includeGrooves) {
    columns.push({ key: "groove", label: "Groove", subLabel: "(GL/GW)", width: "48px", isOps: true });
  }
  if (config.includeDrilling) {
    columns.push({ key: "drill", label: "Drill", subLabel: "(code)", width: "42px", isOps: true });
  }
  if (config.includeCNC) {
    columns.push({ key: "cnc", label: "CNC", subLabel: "(code)", width: "48px", isOps: true });
  }
  if (config.includeNotes !== false) {
    columns.push({ key: "notes", label: "Notes", width: "90px" }); // Wider notes column
  }
  
  // Generate QR data - MINIMAL content for robust scanning
  const qrDataObj = generateQRData(config, templateId, version, shortcodesHash);
  const qrContent = qrDataObj.qr_content; // Just the template ID string
  const fullMetadata = JSON.stringify(qrDataObj.full_metadata); // Stored separately
  
  // Generate QR code SVG directly (no CDN dependency) - LARGER 70px
  const qrCodeSVG = generateQRCodeSVG(qrContent, primaryColor, 70);
  
  // Generate fill-in guide (for separate page)
  const fillInGuide = includeFillInGuide ? generateFillInGuide(config, primaryColor) : "";
  
  // Generate materials reference (for fill-in guide page)
  const materialsRef = includeMaterialsRef ? generateMaterialsReference(config) : "";
  
  // Generate Fill-in Guide Page HTML (separate page)
  const fillInGuidePage = includeFillInGuide ? `
    <div class="page-break"></div>
    <div class="guide-page">
      <div class="guide-page-header">
        <div class="guide-page-title">
          <span class="org-name-small">${orgName}</span>
          <span class="guide-title-text">FILL-IN GUIDE & REFERENCE</span>
        </div>
        <div class="template-ref">${templateId}</div>
      </div>
      
      ${fillInGuide}
      
      ${materialsRef ? `
        <div class="materials-ref-section">
          <h3>Materials & Edgebands Reference</h3>
          ${materialsRef}
        </div>
      ` : ""}
      
      <div class="guide-page-footer">
        <span>${orgName}</span>
        <span>CabinetAI™ Smart Template v${version}</span>
      </div>
    </div>
  ` : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${orgName}</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 8mm 8mm 8mm 8mm; 
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      .page-break { page-break-before: always; }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Segoe UI', -apple-system, Arial, sans-serif; 
      font-size: 9px; 
      color: #1a1a1a;
      line-height: 1.3;
      padding: 10mm;
      position: relative;
    }
    
    /* Page Break */
    .page-break {
      page-break-before: always;
      height: 0;
    }
    
    /* Corner Alignment Markers - LARGER for better OCR detection */
    .corner-marker {
      position: fixed;
      width: 20px;
      height: 20px;
      border: 3px solid #000;
      z-index: 1000;
    }
    .corner-tl { top: 2mm; left: 2mm; border-right: none; border-bottom: none; }
    .corner-tr { top: 2mm; right: 2mm; border-left: none; border-bottom: none; }
    .corner-bl { bottom: 2mm; left: 2mm; border-right: none; border-top: none; }
    .corner-br { bottom: 2mm; right: 2mm; border-left: none; border-top: none; }
    
    /* Page Number - inline with header, not fixed */
    .page-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #333;
      margin-left: auto;
      padding: 4px 8px;
      border: 1.5px solid ${primaryColor};
      border-radius: 4px;
      background: white;
    }
    
    .page-num-box {
      width: 20px;
      height: 18px;
      border: 1.5px solid ${primaryColor};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: white;
      border-radius: 2px;
    }
    
    /* Hide page indicator on guide page */
    .guide-page .page-indicator {
      display: none;
    }
    
    /* Header Area - 3 Column Layout */
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${primaryColor};
    }
    
    /* Left: QR + Template ID */
    .qr-section {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    
    .qr-code-container {
      width: 70px;
      height: 70px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .qr-code-container svg {
      width: 100%;
      height: 100%;
    }
    
    .template-id {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 8px;
      color: ${primaryColor};
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    
    /* Center: Org Branding */
    .branding-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
    }
    
    .org-name {
      font-size: 18px;
      font-weight: 700;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .template-title {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    
    .logo {
      max-height: 40px;
      max-width: 100px;
      margin-bottom: 4px;
    }
    
    /* PROJECT INFORMATION - Full Width Before Table */
    .project-info-section {
      margin-bottom: 10px;
      border: 2px solid ${primaryColor};
      border-radius: 4px;
      overflow: hidden;
    }
    
    .project-info-header {
      background: ${primaryColor};
      color: white;
      font-weight: 700;
      font-size: 10px;
      padding: 5px 10px;
      letter-spacing: 0.5px;
    }
    
    .project-info-content {
      padding: 10px 12px;
      background: ${primaryColor}08; /* Very light tint of brand color */
    }
    
    .project-fields {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 16px;
    }
    
    .field-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    
    .field-row.full-width {
      grid-column: span 2;
    }
    
    .field-label {
      font-size: 9px;
      font-weight: 600;
      white-space: nowrap;
      color: #333;
    }
    
    .field-input {
      flex: 1;
      border-bottom: 1.5px solid #333;
      min-width: 60px;
      height: 18px;
    }
    
    /* Main Table */
    .main-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    
    .main-table th,
    .main-table td {
      border: 1px solid #333;
      padding: 1px 2px;
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
      background: ${primaryColor}30; /* Light tint of brand color - better for printing */
      color: ${primaryColor};
      font-weight: 700;
    }
    
    .main-table th .sub-label {
      font-weight: 400;
      font-size: 6px;
      opacity: 0.9;
      display: block;
    }
    
    .main-table td {
      height: 15px;
      font-size: 8px;
    }
    
    .main-table td:first-child {
      color: ${primaryColor};
      font-size: 7px;
      font-weight: 600;
      background: ${primaryColor}10; /* Very light tint of brand color */
    }
    
    .main-table td.part-name {
      text-align: left;
      padding-left: 3px;
    }
    
    /* Footer */
    .footer {
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7px;
      color: #888;
      padding-top: 3px;
      border-top: 1px solid #e0e0e0;
    }
    
    /* ========================================= */
    /* FILL-IN GUIDE PAGE STYLES */
    /* ========================================= */
    
    .guide-page {
      padding: 10mm;
    }
    
    .guide-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${primaryColor};
    }
    
    .guide-page-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .org-name-small {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      text-transform: uppercase;
    }
    
    .guide-title-text {
      font-size: 16px;
      font-weight: 700;
      color: ${primaryColor};
    }
    
    .template-ref {
      font-family: 'Consolas', monospace;
      font-size: 9px;
      color: #666;
    }
    
    /* Fill-in Guide - Larger on dedicated page */
    .guide-page .fill-in-guide {
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .fill-in-guide {
      border: 1px solid #ddd;
      font-size: 8px;
    }
    
    .guide-header {
      background: ${primaryColor};
      color: white;
      font-weight: 700;
      font-size: 10px;
      padding: 6px 12px;
      letter-spacing: 0.5px;
    }
    
    .guide-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      padding: 12px;
      background: #fafafa;
    }
    
    .guide-section {
      padding: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    
    .guide-section.ocr-tips {
      background: #FEF3C7;
      border-color: #F59E0B;
    }
    
    .guide-title {
      font-weight: 700;
      font-size: 9px;
      margin-bottom: 6px;
      color: ${primaryColor};
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 4px;
    }
    
    .guide-codes {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    
    .guide-item {
      font-size: 8px;
      color: #333;
      display: flex;
      gap: 4px;
    }
    
    .guide-item code {
      background: ${primaryColor}20;
      color: ${primaryColor};
      padding: 1px 4px;
      border-radius: 2px;
      font-family: 'Consolas', monospace;
      font-weight: 700;
      font-size: 8px;
      min-width: 35px;
      text-align: center;
    }
    
    .ocr-tips .guide-title {
      color: #92400E;
    }
    
    .ocr-tips .guide-item {
      font-weight: 600;
      color: #92400E;
      font-size: 9px;
    }
    
    /* Materials Reference Section */
    .materials-ref-section {
      margin-top: 20px;
      padding: 12px;
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .materials-ref-section h3 {
      font-size: 11px;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }
    
    .materials-ref {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    
    .ref-title {
      font-weight: 700;
      font-size: 9px;
      color: #333;
      margin-right: 8px;
    }
    
    .ref-items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .ref-item {
      font-size: 8px;
      background: white;
      padding: 3px 6px;
      border-radius: 3px;
      border: 1px solid #ddd;
    }
    
    .ref-item code {
      color: ${primaryColor};
      font-weight: 700;
      margin-right: 4px;
    }
    
    .guide-page-footer {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #888;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
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
  
  <!-- Header - QR | Org Details | Page Number -->
  <div class="header-container">
    <!-- Left: QR Code + Template ID (beside) -->
    <div class="qr-section">
      <div class="qr-code-container">
        ${qrCodeSVG}
      </div>
      <div class="template-id">${templateId}</div>
    </div>
    
    <!-- Center: Organization Branding -->
    <div class="branding-info">
      ${config.branding.logo_url ? `<img src="${config.branding.logo_url}" alt="" class="logo" onerror="this.style.display='none'">` : ""}
      <div class="org-name">${orgName}</div>
      <div class="template-title">${title} v${version}</div>
    </div>
    
    <!-- Right: Page Indicator -->
    <div class="page-indicator">
      Page <span class="page-num-box"></span> of <span class="page-num-box"></span>
    </div>
  </div>
  
  <!-- PROJECT INFORMATION - Full Width, Before Table -->
  <div class="project-info-section">
    <div class="project-info-header">📋 PROJECT INFORMATION (Required for multi-page cutlists)</div>
    <div class="project-info-content">
      <div class="project-fields">
        <div class="field-row full-width">
          <span class="field-label">Project Name:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Code:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row full-width">
          <span class="field-label">Customer:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Phone:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Section/Area:</span>
          <span class="field-input"></span>
        </div>
        <div class="field-row">
          <span class="field-label">Date:</span>
          <span class="field-input"></span>
        </div>
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
  
  <!-- Footer -->
  <div class="footer">
    <span>${orgName}${config.branding.contact_info ? ` | ${config.branding.contact_info}` : ""}</span>
    <span>CabinetAI™ Smart Template v${version}</span>
  </div>
  
  <!-- Fill-in Guide Page (Optional - Separate Page) -->
  ${fillInGuidePage}
  
  <!-- Print Button -->
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
</body>
</html>
`;

  return {
    template_id: templateId,
    version,
    org_id: config.branding.org_id,
    html,
    qr_data: qrContent,           // Minimal - just template ID for robust scanning
    template_metadata: fullMetadata, // Full config for server-side lookup
    shortcodes_hash: shortcodesHash,
    generated_at: new Date().toISOString(),
  };
}

// ============================================================
// EXCEL TEMPLATE GENERATOR (XML Spreadsheet with Multiple Sheets)
// ============================================================

export function generateOrgExcelTemplate(config: OrgTemplateConfig): string {
  const version = config.version || "1.0";
  const shortOrgId = config.branding.org_id.slice(0, 8);
  const templateId = `CAI-${shortOrgId}-v${version}`;
  const orgName = config.branding.name || "Organization";
  const rows = config.rows || 35;
  const primaryColor = config.branding.primary_color || "#6B21A8";
  const includeFillInGuide = config.includeFillInGuide !== false;
  const includeMaterialsRef = config.includeMaterialsRef !== false;
  
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
    headers.push("Edge");
  }
  if (config.includeGrooves) {
    headers.push("Groove");
  }
  if (config.includeDrilling) {
    headers.push("Drill");
  }
  if (config.includeCNC) {
    headers.push("CNC");
  }
  if (config.includeNotes !== false) {
    headers.push("Notes");
  }
  
  // Helper to escape XML
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  
  // Helper to create a cell
  const cell = (value: string | number, type: "String" | "Number" = "String", styleId?: string) => {
    const style = styleId ? ` ss:StyleID="${styleId}"` : "";
    if (type === "Number") {
      return `<Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
    }
    return `<Cell${style}><Data ss:Type="String">${escXml(String(value))}</Data></Cell>`;
  };
  
  // Helper to create a row
  const row = (cells: string[], height?: number) => {
    const h = height ? ` ss:Height="${height}"` : "";
    return `<Row${h}>${cells.join("")}</Row>`;
  };
  
  // ============================================
  // SHEET 1: Project Info
  // ============================================
  const projectInfoRows: string[] = [];
  
  // Header with org name and template ID
  projectInfoRows.push(row([
    cell(orgName, "String", "OrgName"),
    cell("", "String"),
    cell(templateId, "String", "TemplateId"),
  ]));
  projectInfoRows.push(row([
    cell(`Smart Cutlist Template v${version}`, "String", "SubTitle"),
  ]));
  projectInfoRows.push(row([cell("")]));
  
  // Project Info Section
  projectInfoRows.push(row([
    cell("📋 PROJECT INFORMATION", "String", "SectionHeader"),
  ]));
  projectInfoRows.push(row([cell("Fill in the details below. This info helps track multi-page cutlists.")]));
  projectInfoRows.push(row([cell("")]));
  
  // Project fields
  projectInfoRows.push(row([
    cell("Project Name:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([
    cell("Project Code:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([cell("")]));
  
  // Customer fields
  projectInfoRows.push(row([
    cell("Customer Name:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([
    cell("Phone:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([
    cell("Email:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([cell("")]));
  
  // Page tracking
  projectInfoRows.push(row([
    cell("📄 PAGE TRACKING", "String", "SectionHeader"),
  ]));
  projectInfoRows.push(row([
    cell("Page:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
    cell("of", "String"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([
    cell("Section/Area:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([
    cell("Date:", "String", "FieldLabel"),
    cell("", "String", "FieldInput"),
  ]));
  projectInfoRows.push(row([cell("")]));
  
  // Instructions
  projectInfoRows.push(row([cell("")]));
  projectInfoRows.push(row([
    cell("📝 HOW TO USE", "String", "SectionHeader"),
  ]));
  projectInfoRows.push(row([cell("1. Fill in the project information above")]));
  projectInfoRows.push(row([cell("2. Go to the 'Parts List' sheet and enter your parts")]));
  projectInfoRows.push(row([cell("3. Use shortcodes from 'Fill-In Guide' for operations")]));
  projectInfoRows.push(row([cell("4. Print, fill by hand, photograph, and upload to CAI Intake")]));
  projectInfoRows.push(row([cell("")]));
  projectInfoRows.push(row([
    cell("💡 Tip: Use BLOCK LETTERS when filling by hand for best OCR accuracy!", "String", "TipCell"),
  ]));
  
  // Footer
  projectInfoRows.push(row([cell("")]));
  projectInfoRows.push(row([cell("")]));
  projectInfoRows.push(row([
    cell(`CabinetAI™ Smart Template v${version}`, "String", "Footer"),
  ]));
  
  const projectInfoSheet = `
    <Worksheet ss:Name="Project Info">
      <Table>
        <Column ss:Width="120"/>
        <Column ss:Width="180"/>
        <Column ss:Width="30"/>
        <Column ss:Width="80"/>
        ${projectInfoRows.join("\n        ")}
      </Table>
    </Worksheet>`;
  
  // ============================================
  // SHEET 2: Parts List (Cutlist)
  // ============================================
  const partsSheetRows: string[] = [];
  
  // Row 1: Simple header referencing Project Info sheet
  partsSheetRows.push(row([
    cell("PARTS LIST", "String", "SectionHeader"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell(templateId, "String", "TemplateId"),
  ]));
  partsSheetRows.push(row([
    cell("(See 'Project Info' sheet for project details)", "String", "SubTitle"),
  ]));
  
  // Empty row before headers
  partsSheetRows.push(row([cell("")]));
  
  // Column headers
  partsSheetRows.push(row(headers.map(h => cell(h, "String", "ColumnHeader"))));
  
  // Data rows
  for (let i = 1; i <= rows; i++) {
    const rowCells = [cell(i, "Number", "RowNum")];
    for (let j = 1; j < headers.length; j++) {
      rowCells.push(cell("", "String", "DataCell"));
    }
    partsSheetRows.push(row(rowCells, 18));
  }
  
  // Footer row
  partsSheetRows.push(row([cell("")]));
  partsSheetRows.push(row([
    cell(orgName, "String", "Footer"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell(`Page __ of __`, "String", "Footer"),
  ]));
  
  // Column widths for Parts sheet
  const colWidths = [30, 120, 50, 50, 35, 35, 70];
  if (config.includeEdgebanding !== false) colWidths.push(50);
  if (config.includeGrooves) colWidths.push(55);
  if (config.includeDrilling) colWidths.push(50);
  if (config.includeCNC) colWidths.push(55);
  if (config.includeNotes !== false) colWidths.push(100);
  
  const partsSheet = `
    <Worksheet ss:Name="Parts List">
      <Table>
        ${colWidths.map(w => `<Column ss:Width="${w}"/>`).join("\n        ")}
        ${partsSheetRows.join("\n        ")}
      </Table>
    </Worksheet>`;
  
  // ============================================
  // SHEET 2: Fill-In Guide (Optional)
  // ============================================
  let guideSheet = "";
  if (includeFillInGuide) {
    const guideRows: string[] = [];
    
    // Title
    guideRows.push(row([
      cell(`${orgName} - FILL-IN GUIDE`, "String", "SheetTitle"),
    ]));
    guideRows.push(row([
      cell(templateId, "String", "TemplateId"),
    ]));
    guideRows.push(row([cell("")]));
    
    // OCR Tips
    guideRows.push(row([
      cell("📝 BEST OCR TIPS", "String", "SectionHeader"),
    ]));
    guideRows.push(row([cell("• Use BLOCK LETTERS for best accuracy")]));
    guideRows.push(row([cell("• Take a clear, well-lit photo")]));
    guideRows.push(row([cell("• Ensure QR code is visible")]));
    guideRows.push(row([cell("")]));
    
    // Edgebanding codes
    if (config.includeEdgebanding !== false) {
      const ebCodes = (config.shortcodes?.filter(s => s.category === "edgebanding") || getDefaultEdgebandingCodes());
      guideRows.push(row([cell("EDGEBANDING CODES", "String", "CategoryHeader")]));
      guideRows.push(row([cell("Code", "String", "TableHeader"), cell("Description", "String", "TableHeader")]));
      ebCodes.forEach(sc => {
        guideRows.push(row([cell(sc.code, "String", "CodeCell"), cell(sc.name)]));
      });
      guideRows.push(row([cell("")]));
    }
    
    // Grooving codes
    if (config.includeGrooves) {
      const grvCodes = (config.shortcodes?.filter(s => s.category === "grooving") || getDefaultGroovingCodes());
      guideRows.push(row([cell("GROOVING CODES", "String", "CategoryHeader")]));
      guideRows.push(row([cell("Code", "String", "TableHeader"), cell("Description", "String", "TableHeader")]));
      grvCodes.forEach(sc => {
        guideRows.push(row([cell(sc.code, "String", "CodeCell"), cell(sc.name)]));
      });
      guideRows.push(row([cell("")]));
    }
    
    // Drilling codes
    if (config.includeDrilling) {
      const drillCodes = (config.shortcodes?.filter(s => s.category === "drilling") || getDefaultDrillingCodes());
      guideRows.push(row([cell("DRILLING CODES", "String", "CategoryHeader")]));
      guideRows.push(row([cell("Code", "String", "TableHeader"), cell("Description", "String", "TableHeader")]));
      drillCodes.forEach(sc => {
        guideRows.push(row([cell(sc.code, "String", "CodeCell"), cell(sc.name)]));
      });
      guideRows.push(row([cell("")]));
    }
    
    // CNC codes
    if (config.includeCNC) {
      const cncCodes = (config.shortcodes?.filter(s => s.category === "cnc") || getDefaultCNCCodes());
      guideRows.push(row([cell("CNC CODES", "String", "CategoryHeader")]));
      guideRows.push(row([cell("Code", "String", "TableHeader"), cell("Description", "String", "TableHeader")]));
      cncCodes.forEach(sc => {
        guideRows.push(row([cell(sc.code, "String", "CodeCell"), cell(sc.name)]));
      });
    }
    
    guideSheet = `
    <Worksheet ss:Name="Fill-In Guide">
      <Table>
        <Column ss:Width="80"/>
        <Column ss:Width="250"/>
        ${guideRows.join("\n        ")}
      </Table>
    </Worksheet>`;
  }
  
  // ============================================
  // SHEET 3: Materials Reference (Optional)
  // ============================================
  let materialsSheet = "";
  if (includeMaterialsRef && ((config.materials && config.materials.length > 0) || (config.edgebands && config.edgebands.length > 0))) {
    const matRows: string[] = [];
    
    // Title
    matRows.push(row([
      cell(`${orgName} - MATERIALS & EDGEBANDS REFERENCE`, "String", "SheetTitle"),
    ]));
    matRows.push(row([cell("")]));
    
    // Sheet Materials
    if (config.materials && config.materials.length > 0) {
      matRows.push(row([cell("SHEET MATERIALS", "String", "CategoryHeader")]));
      matRows.push(row([
        cell("Code", "String", "TableHeader"),
        cell("Name", "String", "TableHeader"),
        cell("Thickness (mm)", "String", "TableHeader"),
      ]));
      config.materials.forEach(m => {
        matRows.push(row([
          cell(m.code || m.material_id.slice(0, 6), "String", "CodeCell"),
          cell(m.name),
          cell(m.thickness_mm, "Number"),
        ]));
      });
      matRows.push(row([cell("")]));
    }
    
    // Edgebands
    if (config.edgebands && config.edgebands.length > 0) {
      matRows.push(row([cell("EDGEBANDS", "String", "CategoryHeader")]));
      matRows.push(row([
        cell("Code", "String", "TableHeader"),
        cell("Name", "String", "TableHeader"),
        cell("Thickness (mm)", "String", "TableHeader"),
      ]));
      config.edgebands.forEach(e => {
        matRows.push(row([
          cell(e.code || e.edgeband_id.slice(0, 6), "String", "CodeCell"),
          cell(e.name),
          cell(e.thickness_mm, "Number"),
        ]));
      });
    }
    
    materialsSheet = `
    <Worksheet ss:Name="Materials Reference">
      <Table>
        <Column ss:Width="80"/>
        <Column ss:Width="200"/>
        <Column ss:Width="100"/>
        ${matRows.join("\n        ")}
      </Table>
    </Worksheet>`;
  }
  
  // ============================================
  // ASSEMBLE FULL XML SPREADSHEET
  // ============================================
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default">
      <Font ss:FontName="Segoe UI" ss:Size="9"/>
    </Style>
    <Style ss:ID="OrgName">
      <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1"/>
    </Style>
    <Style ss:ID="TemplateId">
      <Font ss:FontName="Consolas" ss:Size="9" ss:Color="${primaryColor}"/>
    </Style>
    <Style ss:ID="SubTitle">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#666666"/>
    </Style>
    <Style ss:ID="SectionHeader">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="${primaryColor}"/>
      <Interior ss:Color="${primaryColor}20" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="FieldLabel">
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1"/>
    </Style>
    <Style ss:ID="FieldInput">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="ColumnHeader">
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="${primaryColor}" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="RowNum">
      <Font ss:FontName="Segoe UI" ss:Size="8" ss:Color="${primaryColor}"/>
      <Interior ss:Color="${primaryColor}10" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DataCell">
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Footer">
      <Font ss:FontName="Segoe UI" ss:Size="8" ss:Color="#888888"/>
    </Style>
    <Style ss:ID="SheetTitle">
      <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="${primaryColor}"/>
    </Style>
    <Style ss:ID="CategoryHeader">
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="${primaryColor}"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${primaryColor}"/>
      </Borders>
    </Style>
    <Style ss:ID="TableHeader">
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1"/>
      <Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="CodeCell">
      <Font ss:FontName="Consolas" ss:Size="9" ss:Bold="1" ss:Color="${primaryColor}"/>
    </Style>
    <Style ss:ID="TipCell">
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Italic="1" ss:Color="${primaryColor}"/>
      <Interior ss:Color="${primaryColor}10" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${projectInfoSheet}
  ${partsSheet}
  ${guideSheet}
  ${materialsSheet}
</Workbook>`;

  return xml;
}

// ============================================================
// CSV TEMPLATE GENERATOR (Simple fallback)
// ============================================================

export function generateOrgCSVTemplate(config: OrgTemplateConfig): string {
  const version = config.version || "1.0";
  const shortOrgId = config.branding.org_id.slice(0, 8);
  const templateId = `CAI-${shortOrgId}-v${version}`;
  const orgName = config.branding.name || "Organization";
  const rows = config.rows || 35;
  
  // Build headers
  const headers: string[] = ["#", "Part Name", "L(mm)", "W(mm)", "Thk", "Qty", "Material"];
  if (config.includeEdgebanding !== false) headers.push("Edge");
  if (config.includeGrooves) headers.push("Groove");
  if (config.includeDrilling) headers.push("Drill");
  if (config.includeCNC) headers.push("CNC");
  if (config.includeNotes !== false) headers.push("Notes");
  
  const csvRows: string[] = [];
  
  // Header
  csvRows.push(`"${orgName}","","","${templateId}","","","Smart Cutlist Template v${version}"`);
  csvRows.push("");
  csvRows.push(`"Project:","","","Code:","","","Page:","","of",""`);
  csvRows.push(`"Customer:","","","Phone:","","","Section:",""`);
  csvRows.push("");
  csvRows.push(headers.map(h => `"${h}"`).join(","));
  
  // Data rows
  for (let i = 1; i <= rows; i++) {
    csvRows.push([`"${i}"`, ...Array(headers.length - 1).fill('""')].join(","));
  }
  
  csvRows.push("");
  csvRows.push(`"${orgName}","","","","","","CabinetAI™ Smart Template v${version}"`);
  
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
  format: "pdf" | "excel" | "csv" = "pdf"
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
  } else if (format === "excel") {
    // Excel XML format with multiple sheets
    const excelXml = generateOrgExcelTemplate(config);
    const blob = new Blob([excelXml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    // Simple CSV format (single sheet only)
    const csv = generateOrgCSVTemplate(config);
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
 * Parse a template ID into its components
 * Format: CAI-{org_id}-v{version}
 * Example: CAI-org_abc123-v1.0
 */
export interface ParsedTemplateId {
  isCAI: boolean;           // Whether it's a CAI Intake template
  orgId: string | null;     // Organization ID
  version: string | null;   // Template version (e.g., "1.0")
  raw: string;              // Original ID string
}

export function parseTemplateId(templateId: string): ParsedTemplateId {
  const raw = templateId.trim();
  
  // Pattern: CAI-{org_id}-v{VERSION}
  // org_id can contain letters, numbers, underscores, hyphens
  const match = raw.match(/^CAI-(.+)-v(\d+\.\d+)$/);
  
  if (!match) {
    return {
      isCAI: raw.startsWith("CAI-"),
      orgId: null,
      version: null,
      raw,
    };
  }
  
  return {
    isCAI: true,
    orgId: match[1],
    version: match[2],
    raw,
  };
}

/**
 * Check if a string is a valid CAI template ID
 */
export function isValidCAITemplateId(templateId: string): boolean {
  const parsed = parseTemplateId(templateId);
  return parsed.isCAI && parsed.orgId !== null && parsed.version !== null;
}

/**
 * Re-export utility for external use
 */
export { generateShortcodesHash };

