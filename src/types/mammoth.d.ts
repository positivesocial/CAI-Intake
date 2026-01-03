declare module "mammoth" {
  interface ExtractionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  interface ConversionOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  /**
   * Extract raw text from a DOCX file
   */
  export function extractRawText(options: ConversionOptions): Promise<ExtractionResult>;

  /**
   * Convert DOCX to HTML
   */
  export function convertToHtml(options: ConversionOptions): Promise<ExtractionResult>;

  /**
   * Convert DOCX to Markdown
   */
  export function convertToMarkdown(options: ConversionOptions): Promise<ExtractionResult>;
}

