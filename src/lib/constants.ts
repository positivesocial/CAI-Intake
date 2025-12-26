/**
 * CAI Intake - Application Constants
 */

// Schema version - update when making breaking changes
export const SCHEMA_VERSION = "cai-cutlist/v1" as const;

// API version
export const API_VERSION = "v1" as const;

// Default values
export const DEFAULTS = {
  THICKNESS_MM: 18,
  SHEET_LENGTH_MM: 2440,
  SHEET_WIDTH_MM: 1220,
  EDGEBAND_THICKNESS_MM: 0.8,
  UNITS: "mm" as const,
  GRAIN_MODE: "none" as const,
} as const;

// Common material thicknesses (mm)
export const COMMON_THICKNESSES = [3, 6, 9, 12, 15, 16, 18, 19, 22, 25] as const;

// Common edgeband thicknesses (mm)
export const COMMON_EDGEBAND_THICKNESSES = [0.4, 0.5, 0.8, 1, 1.5, 2] as const;

// Core types
export const CORE_TYPES = ["PB", "MDF", "PLY", "HDF", "OTHER"] as const;

// Part families
export const PART_FAMILIES = [
  "panel",
  "door",
  "drawer_box",
  "face_frame",
  "filler",
  "misc",
] as const;

// Grain modes
export const GRAIN_MODES = ["none", "along_L"] as const;

// Edge identifiers
export const EDGE_IDS = ["L1", "L2", "W1", "W2"] as const;

// Ingestion methods
export const INGESTION_METHODS = [
  "manual",
  "paste_parser",
  "excel_table",
  "file_upload",
  "ocr_template",
  "ocr_generic",
  "voice",
  "api",
] as const;

// Parse modes
export const PARSE_MODES = [
  "auto",
  "strict_canonical",
  "loose",
  "template_first",
] as const;

// Export formats
export const EXPORT_FORMATS = [
  "json:cai_cutlist_v1",
  "csv:generic",
  "csv:maxcut",
  "csv:cutlist_plus",
  "xlsx",
] as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_SIZE_MB: 50,
  MAX_SIZE_BYTES: 50 * 1024 * 1024,
  ALLOWED_TYPES: [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
  ],
} as const;

// Confidence thresholds
export const CONFIDENCE = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  MIN_AUTO_ACCEPT: 0.85,
} as const;

// Brand colors
export const BRAND_COLORS = {
  primary: {
    navy: "#1e3a5f",
    teal: "#00d4aa",
    white: "#ffffff",
  },
  semantic: {
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
  },
} as const;





