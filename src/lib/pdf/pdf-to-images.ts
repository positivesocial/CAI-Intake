/**
 * Local PDF to Images Conversion
 * 
 * Uses pdf-to-img (pdfjs-dist wrapper) to convert PDF pages to images
 * locally without requiring external services.
 */

import { logger } from "@/lib/logger";

// Dynamic import to avoid bundling issues
async function getPdfModule() {
  const { pdf } = await import("pdf-to-img");
  return pdf;
}

export interface PdfToImagesResult {
  success: boolean;
  images: string[]; // base64 encoded PNG images
  pageCount: number;
  error?: string;
}

/**
 * Convert PDF buffer to array of base64 PNG images
 * @param pdfBuffer - The PDF file as a Buffer
 * @param options - Conversion options
 * @returns Promise with images array or error
 */
export async function convertPdfToImages(
  pdfBuffer: Buffer,
  options: {
    scale?: number; // DPI scale (default 2.0 for good quality)
    maxPages?: number; // Limit number of pages to process
  } = {}
): Promise<PdfToImagesResult> {
  const { scale = 2.0, maxPages = 20 } = options;
  const startTime = Date.now();
  
  try {
    logger.info("🖼️ [PdfToImages] Starting local PDF to images conversion", {
      pdfSizeKB: (pdfBuffer.length / 1024).toFixed(1),
      scale,
      maxPages,
    });
    
    const pdf = await getPdfModule();
    const images: string[] = [];
    let pageNum = 0;
    
    // Convert PDF pages to images
    // pdf-to-img returns an async iterator of page images
    const document = await pdf(pdfBuffer, { scale });
    
    for await (const page of document) {
      pageNum++;
      
      if (pageNum > maxPages) {
        logger.warn("🖼️ [PdfToImages] Max pages limit reached", {
          maxPages,
          totalPages: pageNum,
        });
        break;
      }
      
      // page is a Buffer containing PNG data
      const base64Image = page.toString("base64");
      images.push(base64Image);
      
      logger.debug("🖼️ [PdfToImages] Converted page", {
        pageNum,
        imageSizeKB: (page.length / 1024).toFixed(1),
      });
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    logger.info("🖼️ [PdfToImages] Conversion complete", {
      pageCount: images.length,
      processingTimeMs,
      totalImageSizeKB: (images.reduce((sum, img) => sum + Buffer.from(img, "base64").length, 0) / 1024).toFixed(1),
    });
    
    return {
      success: true,
      images,
      pageCount: images.length,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error("🖼️ [PdfToImages] Conversion failed", {
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    });
    
    return {
      success: false,
      images: [],
      pageCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Check if the local PDF-to-images capability is available
 * This is always true when the module is loaded
 */
export function isLocalPdfConversionAvailable(): boolean {
  return true;
}

