/**
 * CAI Intake - Template Generator
 * 
 * Generates branded intake forms and templates.
 */

export interface TemplateConfig {
  /** Template name */
  name: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL */
  logoUrl?: string;
  /** Primary brand color */
  primaryColor?: string;
  /** Include fields */
  fields: TemplateFieldConfig[];
  /** Custom instructions */
  instructions?: string;
  /** Submission callback URL */
  callbackUrl?: string;
}

export interface TemplateFieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
}

// Default fields for cutlist intake
export const DEFAULT_FIELDS: TemplateFieldConfig[] = [
  { name: "label", label: "Part Name", type: "text", placeholder: "e.g., Side Panel" },
  { name: "length", label: "Length (mm)", type: "number", required: true, placeholder: "720" },
  { name: "width", label: "Width (mm)", type: "number", required: true, placeholder: "560" },
  { name: "quantity", label: "Quantity", type: "number", required: true, defaultValue: 1 },
  { name: "material", label: "Material", type: "select", options: ["White Melamine", "Black Melamine", "Oak", "Walnut", "MDF", "Plywood"] },
  { name: "thickness", label: "Thickness", type: "select", options: ["16mm", "18mm", "19mm", "25mm"], defaultValue: "18mm" },
  { name: "grain", label: "Grain Direction", type: "select", options: ["None", "Along Length", "Along Width"] },
  { name: "edging", label: "Edge Banding", type: "checkbox" },
  { name: "notes", label: "Notes", type: "text", placeholder: "Additional instructions" },
];

/**
 * Generate HTML template for a cutlist intake form
 */
export function generateIntakeFormHTML(config: TemplateConfig): string {
  const primaryColor = config.primaryColor ?? "#00838F";
  
  const fieldsHTML = config.fields.map(field => {
    let inputHTML = "";
    
    switch (field.type) {
      case "text":
        inputHTML = `<input type="text" name="${field.name}" ${field.required ? "required" : ""} placeholder="${field.placeholder ?? ""}" class="form-input">`;
        break;
      case "number":
        inputHTML = `<input type="number" name="${field.name}" ${field.required ? "required" : ""} placeholder="${field.placeholder ?? ""}" value="${field.defaultValue ?? ""}" class="form-input">`;
        break;
      case "select":
        inputHTML = `
          <select name="${field.name}" ${field.required ? "required" : ""} class="form-input">
            <option value="">Select...</option>
            ${field.options?.map(opt => `<option value="${opt}" ${field.defaultValue === opt ? "selected" : ""}>${opt}</option>`).join("")}
          </select>
        `;
        break;
      case "checkbox":
        inputHTML = `<input type="checkbox" name="${field.name}" ${field.defaultValue ? "checked" : ""} class="form-checkbox">`;
        break;
    }
    
    return `
      <div class="form-group${field.type === "checkbox" ? " checkbox-group" : ""}">
        <label class="form-label">${field.label}${field.required ? " *" : ""}</label>
        ${inputHTML}
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name} - ${config.organizationName}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: ${primaryColor};
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header img {
      max-height: 60px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      opacity: 0.9;
      margin-top: 8px;
    }
    .form-content {
      padding: 24px;
    }
    .instructions {
      background: #f0f9ff;
      border-left: 4px solid ${primaryColor};
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #0369a1;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }
    .checkbox-group .form-label {
      margin-bottom: 0;
    }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      font-size: 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      transition: border-color 0.15s;
    }
    .form-input:focus {
      outline: none;
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}20;
    }
    .form-checkbox {
      width: 20px;
      height: 20px;
      accent-color: ${primaryColor};
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .btn {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      color: white;
      background: ${primaryColor};
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .parts-list {
      margin-top: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .parts-list-header {
      background: #f9fafb;
      padding: 12px 16px;
      font-weight: 600;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .parts-list-body {
      max-height: 300px;
      overflow-y: auto;
    }
    .part-item {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .part-item:last-child {
      border-bottom: none;
    }
    .part-info {
      flex: 1;
    }
    .part-name {
      font-weight: 500;
    }
    .part-dims {
      font-size: 14px;
      color: #6b7280;
    }
    .part-remove {
      color: #ef4444;
      cursor: pointer;
      padding: 4px 8px;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${config.organizationName}">` : ""}
      <h1>${config.name}</h1>
      <p>${config.organizationName}</p>
    </div>
    
    <div class="form-content">
      ${config.instructions ? `<div class="instructions">${config.instructions}</div>` : ""}
      
      <form id="partForm">
        ${fieldsHTML}
        
        <button type="submit" class="btn">Add Part</button>
      </form>
      
      <div class="parts-list" id="partsList" style="display: none;">
        <div class="parts-list-header">
          <span>Parts Added</span>
          <span id="partsCount">0</span>
        </div>
        <div class="parts-list-body" id="partsListBody"></div>
      </div>
      
      <div style="margin-top: 16px;">
        <button type="button" class="btn" id="submitAll" style="display: none;">
          Submit All Parts
        </button>
      </div>
      
      <div class="footer">
        Powered by CAI Intake
      </div>
    </div>
  </div>
  
  <script>
    const parts = [];
    const form = document.getElementById('partForm');
    const partsList = document.getElementById('partsList');
    const partsListBody = document.getElementById('partsListBody');
    const partsCount = document.getElementById('partsCount');
    const submitAllBtn = document.getElementById('submitAll');
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const part = {};
      formData.forEach((value, key) => {
        part[key] = value;
      });
      
      parts.push(part);
      updatePartsList();
      form.reset();
    });
    
    submitAllBtn.addEventListener('click', async () => {
      if (parts.length === 0) return;
      
      submitAllBtn.disabled = true;
      submitAllBtn.textContent = 'Submitting...';
      
      try {
        ${config.callbackUrl ? `
        const response = await fetch('${config.callbackUrl}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parts }),
        });
        
        if (response.ok) {
          alert('Parts submitted successfully!');
          parts.length = 0;
          updatePartsList();
        } else {
          throw new Error('Submission failed');
        }
        ` : `
        console.log('Parts to submit:', parts);
        alert('Parts submitted successfully! (Demo mode)');
        parts.length = 0;
        updatePartsList();
        `}
      } catch (error) {
        alert('Failed to submit: ' + error.message);
      } finally {
        submitAllBtn.disabled = false;
        submitAllBtn.textContent = 'Submit All Parts';
      }
    });
    
    function updatePartsList() {
      partsCount.textContent = parts.length;
      partsList.style.display = parts.length > 0 ? 'block' : 'none';
      submitAllBtn.style.display = parts.length > 0 ? 'block' : 'none';
      
      partsListBody.innerHTML = parts.map((part, index) => \`
        <div class="part-item">
          <div class="part-info">
            <div class="part-name">\${part.label || 'Part ' + (index + 1)}</div>
            <div class="part-dims">\${part.length} × \${part.width} × \${part.quantity || 1}</div>
          </div>
          <span class="part-remove" onclick="removePart(\${index})">Remove</span>
        </div>
      \`).join('');
    }
    
    function removePart(index) {
      parts.splice(index, 1);
      updatePartsList();
    }
  </script>
</body>
</html>
`;
}

/**
 * Generate a simple data collection template (CSV format)
 */
export function generateCSVTemplate(fields: TemplateFieldConfig[]): string {
  const headers = fields.map(f => f.label);
  const example = fields.map(f => f.placeholder ?? f.defaultValue ?? "");
  
  return [
    headers.join(","),
    example.join(","),
    "", // Empty row for user data
  ].join("\n");
}

/**
 * Generate printable cutlist template with QR code for AI recognition
 */
export function generatePrintableTemplate(config: {
  title: string;
  organizationName: string;
  columns?: string[];
  rows?: number;
  templateId?: string;
  includeQRCode?: boolean;
}): string {
  const columns = config.columns ?? ["#", "Part Name", "L (mm)", "W (mm)", "Qty", "Material", "Thk", "Grain", "EB", "Notes"];
  const rows = config.rows ?? 20;
  const templateId = config.templateId ?? "cai-standard-v1";
  const includeQR = config.includeQRCode !== false;
  
  // Generate QR code data
  const qrData = JSON.stringify({
    type: "cai-template",
    id: templateId,
    version: "1.0",
  });
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${config.title}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
    .header-left { flex: 1; }
    .header-right { display: flex; gap: 20px; align-items: flex-start; }
    .title { font-size: 18px; font-weight: bold; }
    .org { color: #666; margin-top: 4px; }
    .info-fields { margin-top: 10px; }
    .info-field { margin-bottom: 6px; }
    .qr-section { text-align: center; }
    .qr-code { width: 80px; height: 80px; border: 1px solid #ccc; }
    .qr-label { font-size: 8px; color: #999; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 6px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; font-size: 10px; }
    td { height: 22px; }
    .footer { margin-top: 15px; display: flex; justify-content: space-between; color: #666; font-size: 9px; }
    .instructions { background: #f9f9f9; border: 1px solid #ddd; padding: 8px; margin-bottom: 15px; font-size: 9px; }
    .instructions strong { color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="title">${config.title}</div>
      <div class="org">${config.organizationName}</div>
      <div class="info-fields">
        <div class="info-field">Job Reference: _________________________</div>
        <div class="info-field">Date: _____________ Client: _____________</div>
      </div>
    </div>
    <div class="header-right">
      ${includeQR ? `
      <div class="qr-section">
        <div class="qr-code" id="qr-placeholder" data-qr="${encodeURIComponent(qrData)}">
          <!-- QR code will be rendered here -->
          <svg viewBox="0 0 80 80" style="width:100%;height:100%">
            <text x="40" y="45" text-anchor="middle" font-size="8" fill="#999">QR Code</text>
          </svg>
        </div>
        <div class="qr-label">Scan for AI parsing</div>
      </div>
      ` : ""}
    </div>
  </div>
  
  <div class="instructions">
    <strong>Instructions:</strong> Fill in each row clearly. Write dimensions in mm. 
    Grain: GL=grain along length, GW=grain along width, blank=can rotate.
    EB (Edge Banding): L1, L2 for long edges; W1, W2 for short edges; "4" for all sides.
  </div>
  
  <table>
    <thead>
      <tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${Array(rows).fill("").map((_, i) => `
        <tr>${columns.map((_, j) => `<td>${j === 0 ? i + 1 : ""}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <span>Template ID: ${templateId}</span>
    <span>Generated by CAI Intake | ${new Date().toLocaleDateString()}</span>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <script>
    // Generate QR code on page load
    document.addEventListener('DOMContentLoaded', function() {
      const qrPlaceholder = document.getElementById('qr-placeholder');
      if (qrPlaceholder && typeof QRCode !== 'undefined') {
        const qrData = decodeURIComponent(qrPlaceholder.dataset.qr);
        qrPlaceholder.innerHTML = '';
        new QRCode(qrPlaceholder, {
          text: qrData,
          width: 80,
          height: 80,
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
}

/**
 * Generate QR code data string for a template
 */
export function generateTemplateQRCodeData(templateId: string, version: string = "1.0"): string {
  return JSON.stringify({
    type: "cai-template",
    id: templateId,
    version,
  });
}

