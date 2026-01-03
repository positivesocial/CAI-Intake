/**
 * CAI Intake - Text to PDF Converter
 * 
 * Converts extracted text from documents (DOCX, TXT, HTML, RTF) into
 * a simple PDF for storage and viewing in compare mode/gallery.
 */

import { jsPDF } from "jspdf";
import { logger } from "@/lib/logger";

export interface TextToPdfOptions {
  /** Document title (shown in header) */
  title?: string;
  /** Original filename */
  originalFilename?: string;
  /** Original format (DOCX, TXT, etc.) */
  originalFormat?: string;
  /** Font size in points */
  fontSize?: number;
  /** Page margins in mm */
  margin?: number;
}

export interface TextToPdfResult {
  success: boolean;
  buffer: Buffer;
  mimeType: string;
  pageCount: number;
  error?: string;
}

/**
 * Convert plain text to a PDF document
 * 
 * Creates a simple, readable PDF with:
 * - Header showing original filename and format
 * - Word-wrapped text content
 * - Page numbers
 */
export function convertTextToPdf(
  text: string,
  options: TextToPdfOptions = {}
): TextToPdfResult {
  const {
    title,
    originalFilename = "document",
    originalFormat = "TXT",
    fontSize = 10,
    margin = 15,
  } = options;

  try {
    // Create PDF in A4 format
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2 - 15; // Reserve space for header/footer

    // Set font
    doc.setFont("helvetica", "normal");
    
    // Add header on first page
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    const headerText = `Extracted from: ${originalFilename} (${originalFormat})`;
    doc.text(headerText, margin, margin - 5);
    
    if (title) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, margin + 5);
      doc.setFont("helvetica", "normal");
    }

    // Set content font size
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);

    // Calculate line height
    const lineHeight = fontSize * 0.4; // Approximate mm per line

    // Split text into lines that fit the page width
    const lines = doc.splitTextToSize(text, contentWidth);
    
    // Calculate how many lines fit per page
    const linesPerPage = Math.floor(contentHeight / lineHeight);
    
    let currentPage = 1;
    let startY = title ? margin + 12 : margin + 2;
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      // Calculate how many lines can fit on this page
      const remainingHeight = pageHeight - margin - startY - 10; // Leave space for footer
      const linesOnThisPage = Math.floor(remainingHeight / lineHeight);
      
      // Get lines for this page
      const pageLines = lines.slice(lineIndex, lineIndex + linesOnThisPage);
      
      // Add text to page
      doc.text(pageLines, margin, startY);
      
      lineIndex += linesOnThisPage;
      
      // Add page number footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${currentPage}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
      
      // If more content, add new page
      if (lineIndex < lines.length) {
        doc.addPage();
        currentPage++;
        startY = margin;
        doc.setFontSize(fontSize);
        doc.setTextColor(0, 0, 0);
      }
    }

    // Convert to buffer
    const pdfOutput = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfOutput);

    logger.info("📄 [TextToPdf] PDF created successfully", {
      originalFilename,
      originalFormat,
      textLength: text.length,
      pageCount: currentPage,
      pdfSizeKB: (buffer.byteLength / 1024).toFixed(1),
    });

    return {
      success: true,
      buffer,
      mimeType: "application/pdf",
      pageCount: currentPage,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    logger.error("📄 [TextToPdf] PDF creation failed", {
      originalFilename,
      error: errorMsg,
    });

    return {
      success: false,
      buffer: Buffer.alloc(0),
      mimeType: "application/pdf",
      pageCount: 0,
      error: `Failed to create PDF: ${errorMsg}`,
    };
  }
}

/**
 * Create a minimal PDF for empty or very short text
 */
export function createEmptyDocumentPdf(
  originalFilename: string,
  originalFormat: string,
  message: string = "No text content was extracted from this document."
): TextToPdfResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Original file: ${originalFilename} (${originalFormat})`, margin, margin);

  // Message
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(message, pageWidth / 2, 50, { align: "center" });

  const pdfOutput = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfOutput);

  return {
    success: true,
    buffer,
    mimeType: "application/pdf",
    pageCount: 1,
  };
}

