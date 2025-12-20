/**
 * CAI Intake - Core TypeScript Types
 * 
 * This file re-exports all types from the canonical schema
 * and provides additional utility types for the application.
 */

// Re-export all schema types
export * from "@/lib/schema";

// Additional application-level types

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
  total_count?: number;
}

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Column visibility configuration for parts table
 */
export interface ColumnVisibility {
  qty: boolean;
  label: boolean;
  L: boolean;
  W: boolean;
  thickness: boolean;
  material: boolean;
  grain: boolean;
  edging_summary: boolean;
  grooves_summary: boolean;
  holes_summary: boolean;
  routing_summary: boolean;
  group_id: boolean;
  notes_operator: boolean;
  notes_cnc: boolean;
  priority: boolean;
  tags: boolean;
}

/**
 * User preferences for the UI
 */
export interface UserPreferences {
  default_units: "mm" | "cm" | "inch";
  default_thickness_mm: number;
  column_visibility: Partial<ColumnVisibility>;
  theme: "light" | "dark" | "system";
  advanced_mode: boolean;
}

/**
 * Organization settings
 */
export interface OrgSettings {
  org_id: string;
  name: string;
  capabilities: import("@/lib/schema").CutlistCapabilities;
  default_materials: string[];
  default_edgebands: string[];
  naming_conventions?: Record<string, string>;
  dimension_presets?: Array<{ name: string; L: number; W: number }>;
}

