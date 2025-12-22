/**
 * CAI Intake - Export Module
 * 
 * Exports cutlists to various formats for different optimization software.
 * 
 * Supported formats:
 * - JSON: CAI canonical format
 * - CSV: Generic spreadsheet format with column mapping
 * - CutList Plus: Popular woodworking optimizer
 * - MaxCut: Panel cutting optimizer (.mcp)
 * - CutRite: Weinig professional optimizer (.xml)
 * - Optimik: Panel optimization software
 * - CAI 2D: Native CAI optimizer format
 * - PDF: Branded document export
 */

export {
  generateJsonExport,
  type JsonExportOptions,
} from "./json-export";

export {
  generateCsvExport,
  type CsvExportOptions,
} from "./csv-export";

export {
  generateMaxcutExport,
  type MaxcutExportOptions,
} from "./maxcut-export";

export {
  generateCutlistPlusExport,
  type CutlistPlusExportOptions,
} from "./cutlistplus-export";

export {
  generateCai2dExport,
  type Cai2dExportOptions,
} from "./cai2d-export";

export {
  generateCutRiteExport,
  type CutRiteExportOptions,
} from "./cutrite-export";

export {
  generateOptimikExport,
  generateOptimikStockExport,
  type OptimikExportOptions,
} from "./optimik-export";

export type { ExportableCutlist, ExportablePart, UnitSystem } from "./types";
export { convertUnit } from "./types";

/**
 * Export format metadata for UI selection
 */
export const EXPORT_FORMATS = {
  json: {
    id: "json",
    name: "CAI JSON",
    description: "CAI canonical cutlist format",
    extension: ".json",
    mimeType: "application/json",
  },
  csv: {
    id: "csv",
    name: "Generic CSV",
    description: "Spreadsheet-compatible CSV with customizable columns",
    extension: ".csv",
    mimeType: "text/csv",
  },
  cutlistplus: {
    id: "cutlistplus",
    name: "CutList Plus",
    description: "CutList Plus optimizer format",
    extension: ".csv",
    mimeType: "text/csv",
  },
  maxcut: {
    id: "maxcut",
    name: "MaxCut",
    description: "MaxCut panel optimizer CSV format",
    extension: ".csv",
    mimeType: "text/csv",
  },
  cutrite: {
    id: "cutrite",
    name: "CutRite (Weinig)",
    description: "CutRite professional optimizer XML format",
    extension: ".xml",
    mimeType: "application/xml",
  },
  optimik: {
    id: "optimik",
    name: "Optimik",
    description: "Optimik panel optimization software format",
    extension: ".csv",
    mimeType: "text/csv",
  },
  cai2d: {
    id: "cai2d",
    name: "CAI 2D Optimizer",
    description: "Native CAI 2D panel optimization format",
    extension: ".json",
    mimeType: "application/json",
  },
  pdf: {
    id: "pdf",
    name: "PDF Document",
    description: "Branded PDF cutlist document",
    extension: ".pdf",
    mimeType: "application/pdf",
  },
} as const;

export type ExportFormatId = keyof typeof EXPORT_FORMATS;




