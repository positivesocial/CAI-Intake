/**
 * CAI Intake - PDF Export Utility
 * 
 * Generates a professional PDF report of the cutlist including:
 * - Summary statistics
 * - Parts list with dimensions and operations
 * - Source methods and audit trail
 * - Material breakdown
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

interface PDFExportOptions {
  includeOperations?: boolean;
  includeSourceMethod?: boolean;
  includeNotes?: boolean;
  companyLogo?: string;
  companyName?: string;
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
// HELPERS
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

    // Count operations
    if (part.ops?.edging?.edges && Object.values(part.ops.edging.edges).some(e => e.apply)) {
      stats.withEdging++;
    }
    if (part.ops?.grooves && part.ops.grooves.length > 0) {
      stats.withGrooves++;
    }
    if (part.ops?.holes && part.ops.holes.length > 0) {
      stats.withHoles++;
    }
    if (part.ops?.custom_cnc_ops && part.ops.custom_cnc_ops.length > 0) {
      stats.withCnc++;
    }

    // Count by source method
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

function getEdgingString(part: CutPart): string {
  if (!part.ops?.edging?.edges) return "-";
  const edges = Object.entries(part.ops.edging.edges)
    .filter(([, e]) => e.apply)
    .map(([side]) => side);
  return edges.length > 0 ? edges.join(", ") : "-";
}

function getGroovesString(part: CutPart): string {
  if (!part.ops?.grooves || part.ops.grooves.length === 0) return "-";
  return part.ops.grooves.map(g => g.side).join(", ");
}

function getHolesString(part: CutPart): string {
  if (!part.ops?.holes || part.ops.holes.length === 0) return "-";
  return part.ops.holes.map(h => h.pattern_id || "holes").join(", ");
}

function getCncString(part: CutPart): string {
  if (!part.ops?.custom_cnc_ops || part.ops.custom_cnc_ops.length === 0) return "-";
  return part.ops.custom_cnc_ops.map(c => c.op_type).join(", ");
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

export function generateCutlistPDF(
  cutlist: SimpleCutlist,
  options: PDFExportOptions = {}
): jsPDF {
  const {
    includeOperations = true,
    includeSourceMethod = true,
    includeNotes = true,
    companyName = "CAI Intake",
  } = options;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [0, 128, 128]; // Teal
  const headerBg: [number, number, number] = [240, 240, 240];
  const textColor: [number, number, number] = [50, 50, 50];

  // Calculate statistics
  const stats = calculateStats(cutlist.parts);

  // ============================================================
  // HEADER
  // ============================================================

  // Title bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 20, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, margin, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cutlist Report", pageWidth - margin, 13, { align: "right" });

  yPos = 30;

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
  // OPERATIONS SUMMARY (if enabled)
  // ============================================================

  if (includeOperations && (stats.withEdging > 0 || stats.withGrooves > 0 || stats.withHoles > 0 || stats.withCnc > 0)) {
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Operations Summary", margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const opsText = [];
    if (stats.withEdging > 0) opsText.push(`Edgebanding: ${stats.withEdging} parts`);
    if (stats.withGrooves > 0) opsText.push(`Grooves: ${stats.withGrooves} parts`);
    if (stats.withHoles > 0) opsText.push(`Holes: ${stats.withHoles} parts`);
    if (stats.withCnc > 0) opsText.push(`CNC: ${stats.withCnc} parts`);
    doc.text(opsText.join("  •  "), margin, yPos);
    yPos += 8;
  }

  // ============================================================
  // SOURCE METHODS (if enabled)
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

  // Build table columns based on options
  const columns: string[] = ["#", "Label", "L (mm)", "W (mm)", "T (mm)", "Qty", "Material"];
  if (includeOperations) {
    columns.push("Edging", "Grooves", "Holes", "CNC");
  }
  if (includeSourceMethod) {
    columns.push("Source");
  }
  if (includeNotes) {
    columns.push("Notes");
  }

  // Build table data
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
      row.push(notes.slice(0, 30) + (notes.length > 30 ? "..." : ""));
    }

    return row;
  });

  // Generate table
  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: textColor,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { halign: "right", cellWidth: 15 },
      3: { halign: "right", cellWidth: 15 },
      4: { halign: "right", cellWidth: 12 },
      5: { halign: "center", cellWidth: 10 },
      6: { cellWidth: 25 },
    },
    didDrawPage: (data) => {
      // Footer on each page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
      doc.text(
        `Generated by ${companyName}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" }
      );
    },
  });

  // ============================================================
  // MATERIAL BREAKDOWN (new page if needed)
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  
  if (finalY > pageHeight - 60) {
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

  // Calculate material breakdown
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

  return doc;
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Generate and download the cutlist PDF
 */
export function downloadCutlistPDF(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): void {
  const doc = generateCutlistPDF(cutlist, options);
  const fileName = `${cutlist.name || "cutlist"}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generate PDF and return as blob for preview
 */
export function getCutlistPDFBlob(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): Blob {
  const doc = generateCutlistPDF(cutlist, options);
  return doc.output("blob");
}

/**
 * Generate PDF and return as data URL for preview
 */
export function getCutlistPDFDataUrl(
  cutlist: SimpleCutlist,
  options?: PDFExportOptions
): string {
  const doc = generateCutlistPDF(cutlist, options);
  return doc.output("dataurlstring");
}

