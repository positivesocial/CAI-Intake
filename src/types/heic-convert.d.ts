declare module "heic-convert" {
  interface ConvertOptions {
    /** Input HEIC/HEIF buffer */
    buffer: Buffer;
    /** Output format */
    format: "JPEG" | "PNG";
    /** Quality for JPEG (0-1) */
    quality?: number;
  }
  
  /**
   * Convert HEIC/HEIF image to JPEG or PNG
   */
  function convert(options: ConvertOptions): Promise<ArrayBuffer>;
  
  export default convert;
}

