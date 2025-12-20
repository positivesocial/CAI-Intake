/**
 * CAI Intake - QR Code Generator
 * 
 * Generates QR codes linking to intake forms.
 */

/**
 * Generate a QR code SVG
 * Uses a simple QR code library approach - for production,
 * consider using a library like 'qrcode' npm package
 */
export interface QRCodeOptions {
  /** Content to encode */
  content: string;
  /** Size in pixels */
  size?: number;
  /** Error correction level */
  errorCorrection?: "L" | "M" | "Q" | "H";
  /** Foreground color */
  foregroundColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Include logo in center */
  logoUrl?: string;
  /** Logo size as percentage of QR code */
  logoSize?: number;
}

/**
 * Generate QR code using external API (for simplicity)
 * In production, use a proper QR code library
 */
export function generateQRCodeURL(options: QRCodeOptions): string {
  const size = options.size ?? 200;
  const content = encodeURIComponent(options.content);
  const color = (options.foregroundColor ?? "#000000").replace("#", "");
  const bgColor = (options.backgroundColor ?? "#FFFFFF").replace("#", "");
  
  // Using Google Charts API for QR code generation
  // Note: For production, use a proper library like 'qrcode' package
  return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${content}&chco=${color}&chf=bg,s,${bgColor}`;
}

/**
 * Generate QR code data URL using canvas
 * This is a placeholder - for actual implementation, use 'qrcode' package
 */
export async function generateQRCodeDataURL(options: QRCodeOptions): Promise<string> {
  try {
    // Dynamic import of qrcode library
    const QRCode = await import("qrcode");
    
    return QRCode.toDataURL(options.content, {
      width: options.size ?? 200,
      margin: 2,
      color: {
        dark: options.foregroundColor ?? "#000000",
        light: options.backgroundColor ?? "#FFFFFF",
      },
      errorCorrectionLevel: options.errorCorrection ?? "M",
    });
  } catch {
    // Fallback to external API
    return generateQRCodeURL(options);
  }
}

/**
 * Generate a branded QR code card (HTML)
 */
export function generateQRCodeCard(config: {
  title: string;
  description?: string;
  url: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
}): string {
  const qrUrl = generateQRCodeURL({ content: config.url, size: 200 });
  const primaryColor = config.primaryColor ?? "#00838F";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${config.title} - QR Code</title>
  <style>
    @page { size: 4in 6in; margin: 0.25in; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 32px;
      text-align: center;
      max-width: 320px;
    }
    .logo {
      max-height: 40px;
      margin-bottom: 16px;
    }
    .org-name {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
    }
    .qr-container {
      background: white;
      padding: 16px;
      border-radius: 12px;
      border: 2px solid ${primaryColor};
      display: inline-block;
    }
    .qr-code {
      width: 200px;
      height: 200px;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      margin-top: 24px;
      color: #1a1a1a;
    }
    .description {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .url {
      font-size: 12px;
      color: ${primaryColor};
      margin-top: 16px;
      word-break: break-all;
    }
    .scan-text {
      font-size: 14px;
      color: #666;
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .scan-icon {
      width: 20px;
      height: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    ${config.logoUrl ? `<img src="${config.logoUrl}" alt="Logo" class="logo">` : ""}
    <div class="org-name">${config.organizationName}</div>
    
    <div class="qr-container">
      <img src="${qrUrl}" alt="QR Code" class="qr-code">
    </div>
    
    <div class="title">${config.title}</div>
    ${config.description ? `<div class="description">${config.description}</div>` : ""}
    
    <div class="scan-text">
      <svg class="scan-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
      Scan to submit parts
    </div>
    
    <div class="url">${config.url}</div>
  </div>
</body>
</html>
`;
}

/**
 * Generate intake portal URL with parameters
 */
export function generatePortalURL(config: {
  baseUrl: string;
  organizationId: string;
  templateId?: string;
  jobReference?: string;
  callbackUrl?: string;
}): string {
  const url = new URL(`${config.baseUrl}/portal/${config.organizationId}`);
  
  if (config.templateId) {
    url.searchParams.set("template", config.templateId);
  }
  if (config.jobReference) {
    url.searchParams.set("job", config.jobReference);
  }
  if (config.callbackUrl) {
    url.searchParams.set("callback", config.callbackUrl);
  }
  
  return url.toString();
}

