/**
 * CAI Intake - PDF Export Utility
 * 
 * Generates a professional PDF report of the cutlist including:
 * - Summary statistics
 * - Parts list with dimensions and operations
 * - Edgebanding breakdown by material with lengths
 * - Groove breakdown by type/profile with lengths
 * - Hole/drilling breakdown by pattern with counts
 * - CNC operations breakdown
 * - Material breakdown
 * - Source methods and audit trail
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CutPart, MaterialDef, EdgebandDef, CutlistCapabilities } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

/**
 * Simplified cutlist type matching the store's currentCutlist
 */
interface SimpleCutlist {
  doc_id: string;
  name: string;
  parts: CutPart[];
  materials: MaterialDef[];
  edgebands: EdgebandDef[];
  capabilities: CutlistCapabilities;
}

interface OrgBranding {
  logo_url?: string;
  logo_dark_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  company_name?: string;
  company_tagline?: string;
  contact_info?: {
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
  template_settings?: {
    header_text?: string;
    footer_text?: string;
    include_logo?: boolean;
    include_qr_code?: boolean;
    qr_style?: "standard" | "rounded" | "dots";
    page_size?: "A4" | "Letter" | "A3";
    orientation?: "portrait" | "landscape";
  };
  pdf_theme?: {
    font_family?: string;
    heading_size?: number;
    body_size?: number;
    table_style?: "bordered" | "striped" | "minimal";
  };
}

interface PDFExportOptions {
  includeOperations?: boolean;
  includeSourceMethod?: boolean;
  includeNotes?: boolean;
  includeDetailedMetrics?: boolean;
  companyLogo?: string;
  companyName?: string;
  branding?: OrgBranding;
}

interface PartStats {
  totalParts: number;
  totalPieces: number;
  totalAreaMm2: number;
  withEdging: number;
  withGrooves: number;
  withHoles: number;
  withCnc: number;
  bySourceMethod: Record<string, number>;
}

// ============================================================
// DETAILED METRICS TYPES
// ============================================================

interface EdgebandMetrics {
  byMaterial: Map<string, {
    name: string;
    thicknessMm: number;
    lengthMm: number;
    partsCount: number;
    edgesCount: number;
  }>;
  totalLengthMm: number;
  totalParts: number;
}

interface GrooveMetrics {
  byProfile: Map<string, {
    name: string;
    widthMm: number;
    depthMm: number;
    lengthMm: number;
    partsCount: number;
    grooveCount: number;
  }>;
  totalLengthMm: number;
  totalParts: number;
}

interface HoleMetrics {
  byPattern: Map<string, {
    name: string;
    diameterMm: number | null;
    holeCount: number;
    partsCount: number;
  }>;
  totalHoles: number;
  totalParts: number;
}

interface CncMetrics {
  byType: Map<string, {
    name: string;
    count: number;
    areaMm2: number;
    lengthMm: number;
    partsCount: number;
  }>;
  totalOperations: number;
  totalParts: number;
}

// ============================================================
// METRIC CALCULATION FUNCTIONS
// ============================================================

function calculateEdgebandMetrics(parts: CutPart[], edgebands: EdgebandDef[]): EdgebandMetrics {
  const metrics: EdgebandMetrics = {
    byMaterial: new Map(),
    totalLengthMm: 0,
    totalParts: 0,
  };

  const partsWithEdging = new Set<string>();

  for (const part of parts) {
    const edges = part.ops?.edging?.edges;
    if (!edges) continue;

    for (const [edgeId, config] of Object.entries(edges)) {
      if (!config?.apply) continue;

      // Calculate edge length based on edge ID
      const isLongEdge = edgeId.startsWith('L');
      const edgeLength = isLongEdge ? part.size.L : part.size.W;
      const totalLength = edgeLength * part.qty;

      // Get edgeband material info
      const ebandId = config.edgeband_id || 'default';
      const eband = edgebands.find(e => e.edgeband_id === ebandId);
      
      // Create profile key
      const profileKey = ebandId;
      
      if (!metrics.byMaterial.has(profileKey)) {
        metrics.byMaterial.set(profileKey, {
          name: eband?.name || ebandId,
          thicknessMm: config.thickness_mm || eband?.thickness_mm || 1,
          lengthMm: 0,
          partsCount: 0,
          edgesCount: 0,
        });
      }

      const profile = metrics.byMaterial.get(profileKey)!;
      profile.lengthMm += totalLength;
      profile.edgesCount += part.qty;
      metrics.totalLengthMm += totalLength;

      partsWithEdging.add(part.part_id);
    }
  }

  // Count unique parts for each material
  for (const part of parts) {
    const edges = part.ops?.edging?.edges;
    if (!edges) continue;

    const materialsUsed = new Set<string>();
    for (const [, config] of Object.entries(edges)) {
      if (config?.apply) {
        materialsUsed.add(config.edgeband_id || 'default');
      }
    }

    for (const matId of materialsUsed) {
      const profile = metrics.byMaterial.get(matId);
      if (profile) profile.partsCount++;
    }
  }

  metrics.totalParts = partsWithEdging.size;

  return metrics;
}

function calculateGrooveMetrics(parts: CutPart[]): GrooveMetrics {
  const metrics: GrooveMetrics = {
    byProfile: new Map(),
    totalLengthMm: 0,
    totalParts: 0,
  };

  const partsWithGrooves = new Set<string>();

  for (const part of parts) {
    const grooves = part.ops?.grooves;
    if (!grooves || grooves.length === 0) continue;

    partsWithGrooves.add(part.part_id);

    for (const groove of grooves) {
      // Calculate groove length based on side
      const isLongEdge = groove.side.startsWith('L');
      let grooveLength = isLongEdge ? part.size.L : part.size.W;

      // Account for stopped grooves
      if (groove.stopped) {
        grooveLength -= (groove.start_offset_mm || 0) + (groove.end_offset_mm || 0);
      }

      const totalLength = Math.max(0, grooveLength) * part.qty;

      // Create profile key based on dimensions
      const widthMm = groove.width_mm || 4;
      const depthMm = groove.depth_mm || 10;
      const profileKey = `${widthMm}x${depthMm}`;

      // Determine profile name
      let profileName = groove.profile_id || 'Custom';
      if (!groove.profile_id) {
        if (widthMm === 4 && depthMm === 10) {
          profileName = 'Back Panel';
        } else if (widthMm === 4 && depthMm === 8) {
          profileName = 'Drawer Bottom';
        } else if (widthMm >= 15) {
          profileName = 'Light Profile';
        } else {
          profileName = `${widthMm}×${depthMm}mm`;
        }
      }

      if (!metrics.byProfile.has(profileKey)) {
        metrics.byProfile.set(profileKey, {
          name: profileName,
          widthMm,
          depthMm,
          lengthMm: 0,
          partsCount: 0,
          grooveCount: 0,
        });
      }

      const profile = metrics.byProfile.get(profileKey)!;
      profile.lengthMm += totalLength;
      profile.grooveCount += part.qty;
      metrics.totalLengthMm += totalLength;
    }
  }

  // Count parts per profile
  for (const part of parts) {
    const grooves = part.ops?.grooves;
    if (!grooves || grooves.length === 0) continue;

    const profilesUsed = new Set<string>();
    for (const groove of grooves) {
      const widthMm = groove.width_mm || 4;
      const depthMm = groove.depth_mm || 10;
      profilesUsed.add(`${widthMm}x${depthMm}`);
    }

    for (const profileKey of profilesUsed) {
      const profile = metrics.byProfile.get(profileKey);
      if (profile) profile.partsCount++;
    }
  }

  metrics.totalParts = partsWithGrooves.size;

  return metrics;
}

function calculateHoleMetrics(parts: CutPart[]): HoleMetrics {
  const metrics: HoleMetrics = {
    byPattern: new Map(),
    totalHoles: 0,
    totalParts: 0,
  };

  const partsWithHoles = new Set<string>();

  for (const part of parts) {
    const holes = part.ops?.holes;
    if (!holes || holes.length === 0) continue;

    partsWithHoles.add(part.part_id);

    for (const holeOp of holes) {
      // Count holes from inline definitions
      if (holeOp.holes && holeOp.holes.length > 0) {
        const holeCount = holeOp.holes.length * part.qty;
        const avgDiameter = holeOp.holes.reduce((sum, h) => sum + h.dia_mm, 0) / holeOp.holes.length;

        // Determine pattern name from diameter
        let patternName = 'Custom Holes';
        let patternKey = 'custom';

        if (avgDiameter >= 30 && avgDiameter <= 40) {
          patternName = 'Hinge Cups (35mm)';
          patternKey = 'hinge-35';
        } else if (avgDiameter >= 4 && avgDiameter <= 6) {
          patternName = 'Shelf Pins / Handle (5mm)';
          patternKey = 'pin-5';
        } else if (avgDiameter >= 7 && avgDiameter <= 9) {
          patternName = 'Dowels (8mm)';
          patternKey = 'dowel-8';
        } else if (avgDiameter >= 14 && avgDiameter <= 16) {
          patternName = 'Cam Locks (15mm)';
          patternKey = 'cam-15';
        } else {
          patternKey = `dia-${Math.round(avgDiameter)}`;
          patternName = `${Math.round(avgDiameter)}mm Holes`;
        }

        if (!metrics.byPattern.has(patternKey)) {
          metrics.byPattern.set(patternKey, {
            name: patternName,
            diameterMm: avgDiameter,
            holeCount: 0,
            partsCount: 0,
          });
        }

        const pattern = metrics.byPattern.get(patternKey)!;
        pattern.holeCount += holeCount;
        metrics.totalHoles += holeCount;
      }

      // Count holes from pattern reference
      if (holeOp.pattern_id) {
        const patternId = holeOp.pattern_id;
        
        // Estimate hole count from pattern ID
        let estimatedCount = part.qty;
        let patternName = patternId;
        
        if (patternId.match(/^H\d+-/i)) {
          const match = patternId.match(/^H(\d+)-/i);
          if (match) {
            estimatedCount = parseInt(match[1], 10) * part.qty;
            patternName = `${match[1]} Hinge Holes`;
          }
        } else if (patternId.toUpperCase().startsWith('SP-')) {
          estimatedCount = 20 * part.qty; // Estimate for shelf pin column
          patternName = 'Shelf Pin Column';
        } else if (patternId.toUpperCase().startsWith('HD-')) {
          estimatedCount = 2 * part.qty;
          patternName = 'Handle Holes';
        }

        if (!metrics.byPattern.has(patternId)) {
          metrics.byPattern.set(patternId, {
            name: patternName,
            diameterMm: null,
            holeCount: 0,
            partsCount: 0,
          });
        }

        const pattern = metrics.byPattern.get(patternId)!;
        pattern.holeCount += estimatedCount;
        metrics.totalHoles += estimatedCount;
      }
    }
  }

  // Count parts per pattern
  for (const part of parts) {
    const holes = part.ops?.holes;
    if (!holes || holes.length === 0) continue;

    const patternsUsed = new Set<string>();
    for (const holeOp of holes) {
      if (holeOp.pattern_id) {
        patternsUsed.add(holeOp.pattern_id);
      }
      if (holeOp.holes && holeOp.holes.length > 0) {
        const avgDia = holeOp.holes.reduce((sum, h) => sum + h.dia_mm, 0) / holeOp.holes.length;
        if (avgDia >= 30) patternsUsed.add('hinge-35');
        else if (avgDia >= 4 && avgDia <= 6) patternsUsed.add('pin-5');
        else if (avgDia >= 7 && avgDia <= 9) patternsUsed.add('dowel-8');
        else if (avgDia >= 14 && avgDia <= 16) patternsUsed.add('cam-15');
        else patternsUsed.add(`dia-${Math.round(avgDia)}`);
      }
    }

    for (const patternKey of patternsUsed) {
      const pattern = metrics.byPattern.get(patternKey);
      if (pattern) pattern.partsCount++;
    }
  }

  metrics.totalParts = partsWithHoles.size;

  return metrics;
}

function calculateCncMetrics(parts: CutPart[]): CncMetrics {
  const metrics: CncMetrics = {
    byType: new Map(),
    totalOperations: 0,
    totalParts: 0,
  };

  const partsWithCnc = new Set<string>();

  for (const part of parts) {
    const routing = part.ops?.routing || [];
    const customOps = part.ops?.custom_cnc_ops || [];

    if (routing.length === 0 && customOps.length === 0) continue;

    partsWithCnc.add(part.part_id);

    // Process routing operations
    for (const route of routing) {
      const typeKey = route.through ? 'cutout' : 'pocket';
      const typeName = route.through ? 'Cutouts' : 'Pockets';
      
      if (!metrics.byType.has(typeKey)) {
        metrics.byType.set(typeKey, {
          name: typeName,
          count: 0,
          areaMm2: 0,
          lengthMm: 0,
          partsCount: 0,
        });
      }

      const typeData = metrics.byType.get(typeKey)!;
      typeData.count += part.qty;
      typeData.areaMm2 += route.region.L * route.region.W * part.qty;
      metrics.totalOperations += part.qty;
    }

    // Process custom CNC operations
    for (const cnc of customOps) {
      const typeKey = cnc.op_type.toLowerCase();
      
      if (!metrics.byType.has(typeKey)) {
        metrics.byType.set(typeKey, {
          name: formatCncTypeName(cnc.op_type),
          count: 0,
          areaMm2: 0,
          lengthMm: 0,
          partsCount: 0,
        });
      }

      const typeData = metrics.byType.get(typeKey)!;
      typeData.count += part.qty;

      // Extract area/length from payload if available
      const payload = cnc.payload as Record<string, unknown> | undefined;
      if (payload) {
        if (typeof payload.width === 'number' && typeof payload.height === 'number') {
          typeData.areaMm2 += (payload.width as number) * (payload.height as number) * part.qty;
        }
        if (typeof payload.length === 'number') {
          typeData.lengthMm += (payload.length as number) * part.qty;
        }
      }

      metrics.totalOperations += part.qty;
    }
  }

  // Count parts per type
  for (const part of parts) {
    const routing = part.ops?.routing || [];
    const customOps = part.ops?.custom_cnc_ops || [];

    const typesUsed = new Set<string>();
    for (const route of routing) {
      typesUsed.add(route.through ? 'cutout' : 'pocket');
    }
    for (const cnc of customOps) {
      typesUsed.add(cnc.op_type.toLowerCase());
    }

    for (const typeKey of typesUsed) {
      const typeData = metrics.byType.get(typeKey);
      if (typeData) typeData.partsCount++;
    }
  }

  metrics.totalParts = partsWithCnc.size;

  return metrics;
}

function formatCncTypeName(opType: string): string {
  const names: Record<string, string> = {
    cutout: 'Cutouts',
    pocket: 'Pockets',
    radius: 'Corner Radius',
    chamfer: 'Chamfers',
    rebate: 'Rebates',
    profile: 'Edge Profiles',
    contour: 'Contours',
    drill: 'Drill Arrays',
    text: 'Text Engraving',
  };
  return names[opType.toLowerCase()] || opType.charAt(0).toUpperCase() + opType.slice(1);
}

// ============================================================
// BASIC HELPERS
// ============================================================

function calculateStats(parts: CutPart[]): PartStats {
  const stats: PartStats = {
    totalParts: parts.length,
    totalPieces: 0,
    totalAreaMm2: 0,
    withEdging: 0,
    withGrooves: 0,
    withHoles: 0,
    withCnc: 0,
    bySourceMethod: {},
  };

  for (const part of parts) {
    stats.totalPieces += part.qty;
    stats.totalAreaMm2 += part.qty * part.size.L * part.size.W;

    if (part.ops?.edging?.edges && Object.values(part.ops.edging.edges).some(e => e.apply)) {
      stats.withEdging++;
    }
    if (part.ops?.grooves && part.ops.grooves.length > 0) {
      stats.withGrooves++;
    }
    if (part.ops?.holes && part.ops.holes.length > 0) {
      stats.withHoles++;
    }
    if ((part.ops?.routing && part.ops.routing.length > 0) || 
        (part.ops?.custom_cnc_ops && part.ops.custom_cnc_ops.length > 0)) {
      stats.withCnc++;
    }

    const source = part.audit?.source_method || "unknown";
    stats.bySourceMethod[source] = (stats.bySourceMethod[source] || 0) + 1;
  }

  return stats;
}

function formatSourceMethod(method: string): string {
  const labels: Record<string, string> = {
    manual: "Manual Entry",
    paste_parser: "Paste & Parse",
    excel_table: "Excel Import",
    file_upload: "File Upload",
    ocr_template: "OCR Template",
    ocr_generic: "OCR Generic",
    voice: "Voice Input",
    api: "API Import",
    unknown: "Unknown",
  };
  return labels[method] || method;
}

function formatLength(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`;
  }
  return `${mm.toFixed(0)} mm`;
}

function formatArea(mm2: number): string {
  if (mm2 >= 1000000) {
    return `${(mm2 / 1000000).toFixed(2)} m²`;
  }
  return `${(mm2 / 100).toFixed(0)} cm²`;
}

function getEdgingString(part: CutPart): string {
  if (!part.ops?.edging?.edges) return "-";
  const edges = Object.entries(part.ops.edging.edges)
    .filter(([, e]) => e.apply)
    .map(([side]) => side);
  if (edges.length === 0) return "-";
  if (edges.length === 4) return "2L2W";
  if (edges.includes("L1") && edges.includes("L2") && edges.length === 2) return "2L";
  if (edges.includes("W1") && edges.includes("W2") && edges.length === 2) return "2W";
  return edges.join(",");
}

function getGroovesString(part: CutPart): string {
  if (!part.ops?.grooves || part.ops.grooves.length === 0) return "-";
  if (part.ops.grooves.length === 1) {
    const g = part.ops.grooves[0];
    return `G${g.side}-${g.width_mm || 4}`;
  }
  return `${part.ops.grooves.length}G`;
}

function getHolesString(part: CutPart): string {
  if (!part.ops?.holes || part.ops.holes.length === 0) return "-";
  const patterns = part.ops.holes.map(h => h.pattern_id || "H").filter(Boolean);
  return patterns.length > 0 ? patterns.join(",") : "H";
}

function getCncString(part: CutPart): string {
  const routing = part.ops?.routing || [];
  const custom = part.ops?.custom_cnc_ops || [];
  const total = routing.length + custom.length;
  if (total === 0) return "-";
  return `${total}CNC`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ============================================================
// PDF GENERATION
// ============================================================

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [0, 128, 128]; // Default teal
}

export function generateCutlistPDF(
  cutlist: SimpleCutlist,
  options: PDFExportOptions = {}
): jsPDF {
  const {
    includeOperations = true,
    includeSourceMethod = true,
    includeNotes = true,
    includeDetailedMetrics = true,
    companyName = "CAI Intake",
    branding,
  } = options;

  // Get branding settings with fallbacks
  const brandCompanyName = branding?.company_name || companyName;
  const brandPrimaryColor = branding?.primary_color || "#008080";
  const brandSecondaryColor = branding?.secondary_color || "#F0F0F0";
  const brandFooterText = branding?.template_settings?.footer_text || "All dimensions in mm. Verify before cutting.";
  const brandHeaderText = branding?.template_settings?.header_text;
  const brandContactInfo = branding?.contact_info;
  const brandTagline = branding?.company_tagline;
  const pageSize = branding?.template_settings?.page_size || "a4";
  const orientation = branding?.template_settings?.orientation || "landscape";

  const doc = new jsPDF({
    orientation: orientation as "portrait" | "landscape",
    unit: "mm",
    format: pageSize.toLowerCase() as "a4" | "letter" | "a3",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Colors from branding
  const primaryColor: [number, number, number] = hexToRgb(brandPrimaryColor);
  const headerBg: [number, number, number] = hexToRgb(brandSecondaryColor);
  const textColor: [number, number, number] = [50, 50, 50];
  const blueColor: [number, number, number] = [59, 130, 246];
  const amberColor: [number, number, number] = [217, 119, 6];
  const purpleColor: [number, number, number] = [147, 51, 234];
  const greenColor: [number, number, number] = [16, 185, 129];

  // Calculate statistics
  const stats = calculateStats(cutlist.parts);
  const edgebandMetrics = calculateEdgebandMetrics(cutlist.parts, cutlist.edgebands);
  const grooveMetrics = calculateGrooveMetrics(cutlist.parts);
  const holeMetrics = calculateHoleMetrics(cutlist.parts);
  const cncMetrics = calculateCncMetrics(cutlist.parts);

  // ============================================================
  // HEADER (with branding)
  // ============================================================

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(brandCompanyName, margin, 12);

  // Add tagline if present
  if (brandTagline) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(brandTagline, margin, 18);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cutlist Report", pageWidth - margin, 12, { align: "right" });

  // Add contact info in header if available
  if (brandContactInfo?.phone || brandContactInfo?.email) {
    doc.setFontSize(8);
    const contactText = [brandContactInfo.phone, brandContactInfo.email].filter(Boolean).join(" | ");
    doc.text(contactText, pageWidth - margin, 18, { align: "right" });
  }

  yPos = 32;

  // Cutlist Name
  doc.setTextColor(...textColor);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(cutlist.name || "Untitled Cutlist", margin, yPos);
  yPos += 8;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${formatDate(new Date())}`, margin, yPos);
  doc.text(`Document ID: ${cutlist.doc_id}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 12;

  // ============================================================
  // SUMMARY CARDS
  // ============================================================

  doc.setFillColor(...headerBg);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, "F");

  const cardWidth = (pageWidth - 2 * margin - 30) / 4;
  const cardX = [margin + 10, margin + 10 + cardWidth, margin + 10 + cardWidth * 2, margin + 10 + cardWidth * 3];

  // Card 1: Parts
  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(stats.totalParts.toString(), cardX[0], yPos + 14);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Unique Parts", cardX[0], yPos + 20);

  // Card 2: Pieces
  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(stats.totalPieces.toString(), cardX[1], yPos + 14);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Total Pieces", cardX[1], yPos + 20);

  // Card 3: Area
  const areaM2 = (stats.totalAreaMm2 / 1_000_000).toFixed(2);
  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${areaM2} m²`, cardX[2], yPos + 14);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Total Area", cardX[2], yPos + 20);

  // Card 4: Materials
  const matCount = cutlist.materials.length || new Set(cutlist.parts.map(p => p.material_id)).size;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(matCount.toString(), cardX[3], yPos + 14);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Materials", cardX[3], yPos + 20);

  yPos += 32;

  // ============================================================
  // OPERATIONS QUICK SUMMARY
  // ============================================================

  if (includeOperations && (stats.withEdging > 0 || stats.withGrooves > 0 || stats.withHoles > 0 || stats.withCnc > 0)) {
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Operations Overview", margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const opsText = [];
    if (edgebandMetrics.totalParts > 0) {
      opsText.push(`Edgebanding: ${formatLength(edgebandMetrics.totalLengthMm)} (${edgebandMetrics.totalParts} parts)`);
    }
    if (grooveMetrics.totalParts > 0) {
      opsText.push(`Grooves: ${formatLength(grooveMetrics.totalLengthMm)} (${grooveMetrics.totalParts} parts)`);
    }
    if (holeMetrics.totalParts > 0) {
      opsText.push(`Holes: ${holeMetrics.totalHoles} holes (${holeMetrics.totalParts} parts)`);
    }
    if (cncMetrics.totalParts > 0) {
      opsText.push(`CNC: ${cncMetrics.totalOperations} ops (${cncMetrics.totalParts} parts)`);
    }
    doc.text(opsText.join("  •  "), margin, yPos);
    yPos += 8;
  }

  // ============================================================
  // SOURCE METHODS
  // ============================================================

  if (includeSourceMethod && Object.keys(stats.bySourceMethod).length > 0) {
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Source Methods", margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const sourceText = Object.entries(stats.bySourceMethod)
      .map(([method, count]) => `${formatSourceMethod(method)}: ${count}`)
      .join("  •  ");
    doc.text(sourceText, margin, yPos);
    yPos += 10;
  }

  // ============================================================
  // PARTS TABLE
  // ============================================================

  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Parts List", margin, yPos);
  yPos += 5;

  const columns: string[] = ["#", "Label", "L", "W", "T", "Qty", "Mat", "Rot"];
  if (includeOperations) {
    columns.push("Edge", "Groove", "Holes", "CNC");
  }
  if (includeSourceMethod) {
    columns.push("Source");
  }
  if (includeNotes) {
    columns.push("Notes");
  }

  const tableData = cutlist.parts.map((part, index) => {
    const material = cutlist.materials.find(m => m.material_id === part.material_id);
    const row: (string | number)[] = [
      index + 1,
      part.label || "-",
      part.size.L,
      part.size.W,
      part.thickness_mm,
      part.qty,
      material?.name || part.material_id,
      part.allow_rotation !== false ? "Y" : "N", // Can rotate
    ];

    if (includeOperations) {
      row.push(
        getEdgingString(part),
        getGroovesString(part),
        getHolesString(part),
        getCncString(part)
      );
    }

    if (includeSourceMethod) {
      row.push(formatSourceMethod(part.audit?.source_method || "unknown"));
    }

    if (includeNotes) {
      const notes = typeof part.notes === "string" 
        ? part.notes 
        : part.notes?.operator || part.notes?.design || "-";
      row.push(notes.slice(0, 25) + (notes.length > 25 ? "..." : ""));
    }

    return row;
  });

  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: textColor,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },  // Part #
      1: { cellWidth: 22 },                     // Label
      2: { halign: "right", cellWidth: 12 },   // L
      3: { halign: "right", cellWidth: 12 },   // W
      4: { halign: "right", cellWidth: 8 },    // T
      5: { halign: "center", cellWidth: 8 },   // Qty
      6: { cellWidth: 20 },                     // Material
      7: { halign: "center", cellWidth: 8 },   // Rot (Y/N)
    },
    didDrawPage: (data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      
      // Footer with branding
      doc.text(
        brandFooterText,
        margin,
        pageHeight - 10
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
      doc.text(
        `Generated by ${brandCompanyName}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" }
      );
    },
  });

  // ============================================================
  // DETAILED OPERATIONS METRICS (NEW PAGE)
  // ============================================================

  if (includeDetailedMetrics && (edgebandMetrics.totalParts > 0 || grooveMetrics.totalParts > 0 || 
      holeMetrics.totalParts > 0 || cncMetrics.totalParts > 0)) {
    
    doc.addPage();
    yPos = margin;

    // Page header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Operations Detail", margin, 10);

    yPos = 25;

    const halfWidth = (pageWidth - 2 * margin - 10) / 2;
    
    // Track row positions for two-column layout
    let leftColumnY = yPos;
    let rightColumnY = yPos;
    let leftColumnEndY = yPos;
    let rightColumnEndY = yPos;

    // ============================================================
    // ROW 1: EDGEBANDING (left) + CNC (right)
    // ============================================================

    // EDGEBANDING BREAKDOWN (left column)
    if (edgebandMetrics.totalParts > 0) {
      doc.setTextColor(...blueColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Edgebanding Breakdown", margin, leftColumnY);
      leftColumnY += 2;

      const ebandData: (string | number)[][] = [];
      edgebandMetrics.byMaterial.forEach((data) => {
        ebandData.push([
          data.name,
          `${data.thicknessMm}mm`,
          formatLength(data.lengthMm),
          data.partsCount.toString(),
        ]);
      });

      // Add total row
      ebandData.push([
        "TOTAL",
        "",
        formatLength(edgebandMetrics.totalLengthMm),
        edgebandMetrics.totalParts.toString(),
      ]);

      autoTable(doc, {
        head: [["Material", "Thick", "Length", "Parts"]],
        body: ebandData,
        startY: leftColumnY,
        margin: { left: margin, right: margin + halfWidth + 10 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: blueColor, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        tableWidth: halfWidth,
        didParseCell: (data) => {
          if (data.row.index === ebandData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [219, 234, 254];
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leftColumnEndY = (doc as any).lastAutoTable?.finalY || leftColumnY;
    }

    // CNC OPERATIONS BREAKDOWN (right column, same row as edgebanding)
    if (cncMetrics.totalParts > 0) {
      const cncStartX = margin + halfWidth + 10;

      doc.setTextColor(...greenColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("CNC Operations Breakdown", cncStartX, rightColumnY);
      rightColumnY += 2;

      const cncData: (string | number)[][] = [];
      cncMetrics.byType.forEach((data) => {
        const areaOrLength = data.areaMm2 > 0 ? formatArea(data.areaMm2) : 
                            data.lengthMm > 0 ? formatLength(data.lengthMm) : "-";
        cncData.push([
          data.name,
          data.count.toString(),
          areaOrLength,
          data.partsCount.toString(),
        ]);
      });

      cncData.push([
        "TOTAL",
        cncMetrics.totalOperations.toString(),
        "",
        cncMetrics.totalParts.toString(),
      ]);

      autoTable(doc, {
        head: [["Operation", "Count", "Area/Length", "Parts"]],
        body: cncData,
        startY: rightColumnY,
        margin: { left: cncStartX, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: greenColor, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        tableWidth: halfWidth,
        didParseCell: (data) => {
          if (data.row.index === cncData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [209, 250, 229];
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rightColumnEndY = (doc as any).lastAutoTable?.finalY || rightColumnY;
    }

    // Move yPos to after the first row (max of both columns)
    yPos = Math.max(leftColumnEndY, rightColumnEndY) + 15;

    // ============================================================
    // ROW 2: MATERIAL BREAKDOWN (left) + DRILLING BREAKDOWN (right)
    // ============================================================

    // Check for page break
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin + 10;
    }

    // Reset column trackers for row 2
    leftColumnY = yPos;
    rightColumnY = yPos;
    leftColumnEndY = yPos;
    rightColumnEndY = yPos;

    // MATERIAL BREAKDOWN (left column)
    const materialBreakdown: Record<string, { count: number; area: number }> = {};
    for (const part of cutlist.parts) {
      if (!materialBreakdown[part.material_id]) {
        materialBreakdown[part.material_id] = { count: 0, area: 0 };
      }
      materialBreakdown[part.material_id].count += part.qty;
      materialBreakdown[part.material_id].area += part.qty * part.size.L * part.size.W;
    }

    if (Object.keys(materialBreakdown).length > 0) {
      doc.setTextColor(...textColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Material Breakdown", margin, leftColumnY);
      leftColumnY += 2;

      const materialTableData = Object.entries(materialBreakdown).map(([matId, data]) => {
        const material = cutlist.materials.find(m => m.material_id === matId);
        return [
          material?.name || matId,
          material?.thickness_mm ? `${material.thickness_mm}mm` : "-",
          data.count.toString(),
          `${(data.area / 1_000_000).toFixed(2)} m²`,
        ];
      });

      autoTable(doc, {
        head: [["Material", "Thickness", "Pieces", "Area"]],
        body: materialTableData,
        startY: leftColumnY,
        margin: { left: margin, right: margin + halfWidth + 10 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        tableWidth: halfWidth,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leftColumnEndY = (doc as any).lastAutoTable?.finalY || leftColumnY;
    }

    // DRILLING BREAKDOWN (right column, same row as material)
    if (holeMetrics.totalParts > 0) {
      const holeStartX = margin + halfWidth + 10;

      doc.setTextColor(...purpleColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Drilling Breakdown", holeStartX, rightColumnY);
      rightColumnY += 2;

      const holeData: (string | number)[][] = [];
      holeMetrics.byPattern.forEach((data) => {
        holeData.push([
          data.name,
          data.diameterMm ? `${data.diameterMm.toFixed(1)}mm` : "-",
          data.holeCount.toString(),
          data.partsCount.toString(),
        ]);
      });

      holeData.push([
        "TOTAL",
        "",
        holeMetrics.totalHoles.toString(),
        holeMetrics.totalParts.toString(),
      ]);

      autoTable(doc, {
        head: [["Pattern", "Diameter", "Holes", "Parts"]],
        body: holeData,
        startY: rightColumnY,
        margin: { left: holeStartX, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: purpleColor, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [250, 245, 255] },
        tableWidth: halfWidth,
        didParseCell: (data) => {
          if (data.row.index === holeData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 232, 255];
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rightColumnEndY = (doc as any).lastAutoTable?.finalY || rightColumnY;
    }

    // Move yPos to after row 2
    yPos = Math.max(leftColumnEndY, rightColumnEndY) + 15;

    // ============================================================
    // ROW 3: GROOVE BREAKDOWN (full width if present)
    // ============================================================

    if (grooveMetrics.totalParts > 0) {
      // Check for page break
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin + 10;
      }

      doc.setTextColor(...amberColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Groove Breakdown", margin, yPos);
      yPos += 2;

      const grooveData: (string | number)[][] = [];
      grooveMetrics.byProfile.forEach((data) => {
        grooveData.push([
          data.name,
          `${data.widthMm}mm`,
          `${data.depthMm}mm`,
          formatLength(data.lengthMm),
          data.partsCount.toString(),
        ]);
      });

      grooveData.push([
        "TOTAL",
        "",
        "",
        formatLength(grooveMetrics.totalLengthMm),
        grooveMetrics.totalParts.toString(),
      ]);

      autoTable(doc, {
        head: [["Profile", "Width", "Depth", "Length", "Parts"]],
        body: grooveData,
        startY: yPos,
        margin: { left: margin, right: margin + halfWidth + 10 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: amberColor, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        tableWidth: halfWidth,
        didParseCell: (data) => {
          if (data.row.index === grooveData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199];
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable?.finalY + 10;
    }
  }

  // ============================================================
  // MATERIAL BREAKDOWN (standalone page if no detailed metrics)
  // ============================================================

  if (!includeDetailedMetrics) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let finalY = (doc as any).lastAutoTable?.finalY || yPos;
    
    if (finalY > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    } else {
      yPos = finalY + 15;
    }

    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Material Breakdown", margin, yPos);
    yPos += 5;

    const materialBreakdown: Record<string, { count: number; area: number }> = {};
    for (const part of cutlist.parts) {
      if (!materialBreakdown[part.material_id]) {
        materialBreakdown[part.material_id] = { count: 0, area: 0 };
      }
      materialBreakdown[part.material_id].count += part.qty;
      materialBreakdown[part.material_id].area += part.qty * part.size.L * part.size.W;
    }

    const materialTableData = Object.entries(materialBreakdown).map(([matId, data]) => {
      const material = cutlist.materials.find(m => m.material_id === matId);
      return [
        material?.name || matId,
        material?.thickness_mm ? `${material.thickness_mm}mm` : "-",
        data.count.toString(),
        `${(data.area / 1_000_000).toFixed(2)} m²`,
      ];
    });

    autoTable(doc, {
      head: [["Material", "Thickness", "Pieces", "Area"]],
      body: materialTableData,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: textColor,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      tableWidth: 150,
    });
  }

  return doc;
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

export function downloadCutlistPDF(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): void {
  const doc = generateCutlistPDF(cutlist, options);
  const fileName = `${cutlist.name || "cutlist"}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

export function getCutlistPDFBlob(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): Blob {
  const doc = generateCutlistPDF(cutlist, options);
  return doc.output("blob");
}

export function getCutlistPDFDataUrl(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): string {
  const doc = generateCutlistPDF(cutlist, options);
  return doc.output("dataurlstring");
}
