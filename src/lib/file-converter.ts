/**
 * CAI Intake - File Conversion Utility
 * 
 * Automatically converts unsupported file formats to supported ones.
 * Falls back to helpful error messages if conversion fails.
 * 
 * Supported conversions:
 * - HEIC/HEIF → JPEG (iPhone photos)
 * - TIFF → JPEG
 * - BMP → JPEG/PNG
 * - DOCX → Text extraction (for text parsing)
 * - TXT → Direct text (for text parsing)
 * - HTML → Text extraction (for text parsing)
 * 
 * Supported target formats for AI vision APIs:
 * - JPEG, PNG, GIF, WebP (for images)
 * - PDF (for documents)
 */

import { logger } from "@/lib/logger";

// ============================================================
// TYPES
// ============================================================

export interface ConversionResult {
  success: boolean;
  buffer: Buffer;
  mimeType: string;
  originalFormat: string;
  convertedFrom?: string;
  error?: string;
  tip?: string;
}

export interface TextExtractionResult {
  success: boolean;
  text: string;
  originalFormat: string;
  error?: string;
  tip?: string;
  /** If true, the extracted text should be sent to text parsing instead of image parsing */
  useTextParsing: boolean;
}

export interface FileFormatInfo {
  mime: string;
  name: string;
  extensions: string[];
  convertible: boolean;
  /** For image conversion */
  targetFormat?: "jpeg" | "png";
  /** For document text extraction */
  extractText?: boolean;
  tip: string;
}

// ============================================================
// FORMAT DEFINITIONS
// ============================================================

/** Image formats supported by AI vision APIs */
export const SUPPORTED_IMAGE_FORMATS = [
  "image/jpeg",
  "image/png", 
  "image/gif",
  "image/webp",
];

/** Document formats supported */
export const SUPPORTED_DOCUMENT_FORMATS = [
  "application/pdf",
];

/** Spreadsheet formats supported */
export const SUPPORTED_SPREADSHEET_FORMATS = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "text/csv",
];

/** All supported formats */
export const ALL_SUPPORTED_FORMATS = [
  ...SUPPORTED_IMAGE_FORMATS,
  ...SUPPORTED_DOCUMENT_FORMATS,
  ...SUPPORTED_SPREADSHEET_FORMATS,
];

/** Unsupported formats with conversion info */
export const CONVERTIBLE_FORMATS: FileFormatInfo[] = [
  {
    mime: "image/heic",
    name: "HEIC",
    extensions: ["heic"],
    convertible: true,
    targetFormat: "jpeg",
    tip: "On iPhone: Settings > Camera > Formats > Most Compatible",
  },
  {
    mime: "image/heif",
    name: "HEIF",
    extensions: ["heif", "hif"],
    convertible: true,
    targetFormat: "jpeg",
    tip: "On iPhone: Settings > Camera > Formats > Most Compatible",
  },
  {
    mime: "image/tiff",
    name: "TIFF",
    extensions: ["tiff", "tif"],
    convertible: true,
    targetFormat: "jpeg",
    tip: "TIFF files can be large - consider using JPEG for faster uploads",
  },
  {
    mime: "image/bmp",
    name: "BMP",
    extensions: ["bmp"],
    convertible: true,
    targetFormat: "png",
    tip: "BMP files are uncompressed - JPEG/PNG are more efficient",
  },
  {
    mime: "image/x-icon",
    name: "ICO",
    extensions: ["ico"],
    convertible: true,
    targetFormat: "png",
    tip: "Icon files are not suitable for cutlist images",
  },
  {
    mime: "image/svg+xml",
    name: "SVG",
    extensions: ["svg"],
    convertible: false,
    tip: "SVG vector graphics cannot be processed. Please export as PNG or JPEG",
  },
  
  // Document formats with text extraction
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    name: "DOCX",
    extensions: ["docx"],
    convertible: true,
    extractText: true,
    tip: "Text will be extracted from your Word document",
  },
  {
    mime: "text/plain",
    name: "TXT",
    extensions: ["txt"],
    convertible: true,
    extractText: true,
    tip: "Text file will be processed directly",
  },
  {
    mime: "text/html",
    name: "HTML",
    extensions: ["html", "htm"],
    convertible: true,
    extractText: true,
    tip: "Text will be extracted from your HTML file",
  },
  {
    mime: "application/rtf",
    name: "RTF",
    extensions: ["rtf"],
    convertible: true,
    extractText: true,
    tip: "Text will be extracted from your RTF document",
  },
];

/** Completely unsupported formats (no conversion possible) */
export const UNSUPPORTED_FORMATS: FileFormatInfo[] = [
  // Document formats that need external tools (LibreOffice)
  {
    mime: "application/msword",
    name: "DOC",
    extensions: ["doc"],
    convertible: false,
    tip: "Old .doc format is not supported. Please save as .docx or PDF before uploading",
  },
  {
    mime: "application/vnd.oasis.opendocument.text",
    name: "ODT",
    extensions: ["odt"],
    convertible: false,
    tip: "OpenDocument format is not supported. Please export as PDF or DOCX before uploading",
  },
  
  // E-book formats
  {
    mime: "application/epub+zip",
    name: "EPUB",
    extensions: ["epub"],
    convertible: false,
    tip: "E-book files are not supported. Please export as PDF or take screenshots of relevant pages",
  },
  {
    mime: "application/x-mobipocket-ebook",
    name: "MOBI",
    extensions: ["mobi"],
    convertible: false,
    tip: "E-book files are not supported. Please export as PDF or take screenshots of relevant pages",
  },
  {
    mime: "application/vnd.amazon.ebook",
    name: "AZW",
    extensions: ["azw", "azw3"],
    convertible: false,
    tip: "Kindle e-book files are not supported. Please export as PDF or take screenshots",
  },
  
  // Presentation formats
  {
    mime: "application/vnd.ms-powerpoint",
    name: "PPT",
    extensions: ["ppt"],
    convertible: false,
    tip: "Please export your presentation as PDF before uploading",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    name: "PPTX",
    extensions: ["pptx"],
    convertible: false,
    tip: "Please export your presentation as PDF before uploading",
  },
  {
    mime: "application/vnd.oasis.opendocument.presentation",
    name: "ODP",
    extensions: ["odp"],
    convertible: false,
    tip: "Please export your presentation as PDF before uploading",
  },
  
  // Archive formats
  {
    mime: "application/zip",
    name: "ZIP",
    extensions: ["zip"],
    convertible: false,
    tip: "Please extract files and upload them individually",
  },
  {
    mime: "application/x-rar-compressed",
    name: "RAR",
    extensions: ["rar"],
    convertible: false,
    tip: "Please extract files and upload them individually",
  },
  {
    mime: "application/x-7z-compressed",
    name: "7Z",
    extensions: ["7z"],
    convertible: false,
    tip: "Please extract files and upload them individually",
  },
  {
    mime: "application/gzip",
    name: "GZ",
    extensions: ["gz", "tar.gz"],
    convertible: false,
    tip: "Please extract files and upload them individually",
  },
  
  // Video formats
  {
    mime: "video/mp4",
    name: "MP4",
    extensions: ["mp4"],
    convertible: false,
    tip: "Video files are not supported. Please take a screenshot or photo instead",
  },
  {
    mime: "video/quicktime",
    name: "MOV",
    extensions: ["mov"],
    convertible: false,
    tip: "Video files are not supported. Please take a screenshot or photo instead",
  },
  {
    mime: "video/x-msvideo",
    name: "AVI",
    extensions: ["avi"],
    convertible: false,
    tip: "Video files are not supported. Please take a screenshot or photo instead",
  },
  {
    mime: "video/webm",
    name: "WebM",
    extensions: ["webm"],
    convertible: false,
    tip: "Video files are not supported. Please take a screenshot or photo instead",
  },
  
  // Audio formats
  {
    mime: "audio/mpeg",
    name: "MP3",
    extensions: ["mp3"],
    convertible: false,
    tip: "Audio files are not supported for cutlist parsing",
  },
  {
    mime: "audio/wav",
    name: "WAV",
    extensions: ["wav"],
    convertible: false,
    tip: "Audio files are not supported for cutlist parsing",
  },
  {
    mime: "audio/ogg",
    name: "OGG",
    extensions: ["ogg"],
    convertible: false,
    tip: "Audio files are not supported for cutlist parsing",
  },
  
  // CAD/Design formats (common in woodworking but not parseable as cutlists)
  {
    mime: "application/acad",
    name: "DWG",
    extensions: ["dwg"],
    convertible: false,
    tip: "CAD files cannot be parsed directly. Please export a cutlist or parts list as PDF/Excel",
  },
  {
    mime: "image/vnd.dxf",
    name: "DXF",
    extensions: ["dxf"],
    convertible: false,
    tip: "CAD files cannot be parsed directly. Please export a cutlist or parts list as PDF/Excel",
  },
  {
    mime: "application/x-sketchup",
    name: "SKP",
    extensions: ["skp"],
    convertible: false,
    tip: "SketchUp files cannot be parsed directly. Please export a cutlist using a plugin like CutList Bridge or OpenCutList",
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || "";
}

/**
 * Detect format info from MIME type and/or file extension
 */
export function detectFormat(mimeType: string, filename: string): FileFormatInfo | null {
  const ext = getFileExtension(filename);
  const normalizedMime = mimeType.toLowerCase();
  
  // Check convertible formats first
  const convertible = CONVERTIBLE_FORMATS.find(
    f => f.mime === normalizedMime || f.extensions.includes(ext)
  );
  if (convertible) return convertible;
  
  // Check unsupported formats
  const unsupported = UNSUPPORTED_FORMATS.find(
    f => f.mime === normalizedMime || f.extensions.includes(ext)
  );
  if (unsupported) return unsupported;
  
  return null;
}

/**
 * Check if a format is directly supported (no conversion needed)
 */
export function isFormatSupported(mimeType: string): boolean {
  return ALL_SUPPORTED_FORMATS.includes(mimeType.toLowerCase());
}

// ============================================================
// CONVERSION FUNCTIONS
// ============================================================

/**
 * Convert HEIC/HEIF to JPEG
 */
async function convertHeicToJpeg(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    // Dynamic import to avoid bundling issues
    const heicConvert = (await import("heic-convert")).default;
    
    const outputBuffer = await heicConvert({
      buffer: buffer,
      format: "JPEG",
      quality: 0.92, // High quality for OCR
    });
    
    return {
      buffer: Buffer.from(outputBuffer),
      mimeType: "image/jpeg",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`HEIC conversion failed: ${errorMsg}`);
  }
}

/**
 * Convert image using Sharp (TIFF, BMP, etc.)
 */
async function convertWithSharp(
  buffer: Buffer, 
  targetFormat: "jpeg" | "png"
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    
    let transformer = sharp(buffer);
    
    if (targetFormat === "jpeg") {
      transformer = transformer.jpeg({ quality: 92, mozjpeg: true });
    } else {
      transformer = transformer.png({ compressionLevel: 6 });
    }
    
    const outputBuffer = await transformer.toBuffer();
    
    return {
      buffer: outputBuffer,
      mimeType: targetFormat === "jpeg" ? "image/jpeg" : "image/png",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Image conversion failed: ${errorMsg}`);
  }
}

// ============================================================
// TEXT EXTRACTION FUNCTIONS
// ============================================================

/**
 * Extract text from DOCX files using mammoth
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`DOCX text extraction failed: ${errorMsg}`);
  }
}

/**
 * Extract text from TXT files
 */
function extractTextFromTxt(buffer: Buffer): string {
  // Try UTF-8 first, fall back to latin1
  try {
    return buffer.toString("utf-8");
  } catch {
    return buffer.toString("latin1");
  }
}

/**
 * Extract text from HTML files (strips tags)
 */
function extractTextFromHtml(buffer: Buffer): string {
  const html = buffer.toString("utf-8");
  
  // Remove script and style tags with their content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Replace common block elements with newlines
  text = text
    .replace(/<\/?(p|div|br|tr|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, "\t");
  
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ");
  
  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
  
  return text;
}

/**
 * Extract text from RTF files (basic extraction)
 */
function extractTextFromRtf(buffer: Buffer): string {
  const rtf = buffer.toString("utf-8");
  
  // Basic RTF text extraction - strips RTF control words
  let text = rtf
    // Remove RTF header and document settings
    .replace(/^\{\\rtf[^}]*\}?/i, "")
    // Remove control words with arguments
    .replace(/\\[a-z]+\d*\s?/gi, "")
    // Remove escaped special characters
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    // Remove group braces
    .replace(/[{}]/g, "")
    // Clean up whitespace
    .replace(/\s+/g, " ")
    .trim();
  
  return text;
}

// ============================================================
// MAIN CONVERSION FUNCTION
// ============================================================

/**
 * Attempt to convert a file to a supported format
 * 
 * @param buffer - File buffer
 * @param mimeType - Original MIME type
 * @param filename - Original filename
 * @returns ConversionResult with converted buffer or error details
 */
export async function convertToSupportedFormat(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ConversionResult> {
  const normalizedMime = mimeType.toLowerCase();
  
  // If already supported, return as-is
  if (isFormatSupported(normalizedMime)) {
    return {
      success: true,
      buffer,
      mimeType: normalizedMime,
      originalFormat: normalizedMime,
    };
  }
  
  // Detect format
  const formatInfo = detectFormat(normalizedMime, filename);
  
  if (!formatInfo) {
    // Unknown format - try to process anyway
    logger.warn("📁 [FileConverter] Unknown format, attempting direct processing", {
      mimeType,
      filename,
    });
    return {
      success: true, // Let it try
      buffer,
      mimeType: normalizedMime || "application/octet-stream",
      originalFormat: "unknown",
    };
  }
  
  // If not convertible, return error
  if (!formatInfo.convertible) {
    return {
      success: false,
      buffer,
      mimeType: normalizedMime,
      originalFormat: formatInfo.name,
      error: `${formatInfo.name} format is not supported.`,
      tip: formatInfo.tip,
    };
  }
  
  // Attempt conversion
  logger.info("📁 [FileConverter] Converting file", {
    from: formatInfo.name,
    to: formatInfo.targetFormat,
    filename,
  });
  
  try {
    let result: { buffer: Buffer; mimeType: string };
    
    // Use appropriate converter based on format
    if (formatInfo.mime === "image/heic" || formatInfo.mime === "image/heif") {
      result = await convertHeicToJpeg(buffer);
    } else {
      result = await convertWithSharp(buffer, formatInfo.targetFormat || "jpeg");
    }
    
    logger.info("📁 [FileConverter] Conversion successful", {
      from: formatInfo.name,
      to: result.mimeType,
      originalSizeKB: (buffer.byteLength / 1024).toFixed(1),
      convertedSizeKB: (result.buffer.byteLength / 1024).toFixed(1),
    });
    
    return {
      success: true,
      buffer: result.buffer,
      mimeType: result.mimeType,
      originalFormat: formatInfo.name,
      convertedFrom: formatInfo.mime,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    logger.error("📁 [FileConverter] Conversion failed", {
      format: formatInfo.name,
      error: errorMsg,
    });
    
    return {
      success: false,
      buffer,
      mimeType: normalizedMime,
      originalFormat: formatInfo.name,
      error: `Could not convert ${formatInfo.name} file. ${errorMsg}`,
      tip: formatInfo.tip,
    };
  }
}

/**
 * Check if a file format supports text extraction
 */
export function supportsTextExtraction(mimeType: string, filename: string): boolean {
  const formatInfo = detectFormat(mimeType, filename);
  return formatInfo?.extractText === true;
}

/**
 * Extract text from document files (DOCX, TXT, HTML, RTF)
 * 
 * @param buffer - File buffer
 * @param mimeType - Original MIME type
 * @param filename - Original filename
 * @returns TextExtractionResult with extracted text or error
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<TextExtractionResult> {
  const normalizedMime = mimeType.toLowerCase();
  const ext = getFileExtension(filename);
  
  // Detect format
  const formatInfo = detectFormat(normalizedMime, filename);
  
  if (!formatInfo || !formatInfo.extractText) {
    return {
      success: false,
      text: "",
      originalFormat: formatInfo?.name || ext.toUpperCase() || "Unknown",
      error: `Text extraction is not supported for this format`,
      useTextParsing: false,
    };
  }
  
  logger.info("📁 [FileConverter] Extracting text from document", {
    format: formatInfo.name,
    filename,
    sizeKB: (buffer.byteLength / 1024).toFixed(1),
  });
  
  try {
    let extractedText: string;
    
    // Use appropriate extractor based on format
    if (formatInfo.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        ext === "docx") {
      extractedText = await extractTextFromDocx(buffer);
    } else if (formatInfo.mime === "text/plain" || ext === "txt") {
      extractedText = extractTextFromTxt(buffer);
    } else if (formatInfo.mime === "text/html" || ext === "html" || ext === "htm") {
      extractedText = extractTextFromHtml(buffer);
    } else if (formatInfo.mime === "application/rtf" || ext === "rtf") {
      extractedText = extractTextFromRtf(buffer);
    } else {
      throw new Error(`No text extractor available for ${formatInfo.name}`);
    }
    
    // Check if we got meaningful content
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        success: false,
        text: "",
        originalFormat: formatInfo.name,
        error: `The ${formatInfo.name} file appears to be empty or contains no extractable text`,
        tip: "Make sure your file contains text data (not just images)",
        useTextParsing: false,
      };
    }
    
    logger.info("📁 [FileConverter] ✅ Text extraction successful", {
      format: formatInfo.name,
      textLength: extractedText.length,
      previewChars: extractedText.slice(0, 100).replace(/\n/g, " "),
    });
    
    return {
      success: true,
      text: extractedText,
      originalFormat: formatInfo.name,
      useTextParsing: true,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    logger.error("📁 [FileConverter] Text extraction failed", {
      format: formatInfo.name,
      error: errorMsg,
    });
    
    return {
      success: false,
      text: "",
      originalFormat: formatInfo.name,
      error: `Could not extract text from ${formatInfo.name} file: ${errorMsg}`,
      tip: formatInfo.tip,
      useTextParsing: false,
    };
  }
}

/**
 * Get user-friendly error response for unsupported formats
 */
export function getUnsupportedFormatError(
  mimeType: string,
  filename: string
): {
  error: string;
  code: string;
  details: {
    format: string;
    tip: string;
    supportedFormats: string[];
  };
} {
  const formatInfo = detectFormat(mimeType, filename);
  const formatName = formatInfo?.name || getFileExtension(filename).toUpperCase() || "Unknown";
  const tip = formatInfo?.tip || "Please convert your file to a supported format before uploading";
  
  return {
    error: `${formatName} format is not supported. Please convert to a supported format before uploading.`,
    code: "UNSUPPORTED_FORMAT",
    details: {
      format: formatName,
      tip,
      supportedFormats: ["JPEG", "PNG", "GIF", "WebP", "PDF", "Excel (XLSX/CSV)"],
    },
  };
}

/**
 * Validate file type and return appropriate error if invalid
 */
export function validateFileType(
  mimeType: string,
  filename: string
): { valid: boolean; error?: ReturnType<typeof getUnsupportedFormatError> } {
  // Check if directly supported
  if (isFormatSupported(mimeType)) {
    return { valid: true };
  }
  
  // Check if convertible
  const formatInfo = detectFormat(mimeType, filename);
  if (formatInfo?.convertible) {
    return { valid: true }; // Will be converted
  }
  
  // Not supported and not convertible
  if (formatInfo && !formatInfo.convertible) {
    return {
      valid: false,
      error: getUnsupportedFormatError(mimeType, filename),
    };
  }
  
  // Unknown format - allow through for now
  return { valid: true };
}

