/**
 * CAI Intake - Supabase Database Types
 * 
 * Generated types for the Supabase database schema.
 * These types provide type safety for database operations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          settings?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          organization_id: string | null;
          role: "super_admin" | "org_admin" | "manager" | "operator" | "viewer";
          preferences: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          organization_id?: string | null;
          role?: "super_admin" | "org_admin" | "manager" | "operator" | "viewer";
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          organization_id?: string | null;
          role?: "super_admin" | "org_admin" | "manager" | "operator" | "viewer";
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          organization_id: string;
          material_id: string;
          name: string;
          thickness_mm: number;
          core_type: string | null;
          grain: string | null;
          finish: string | null;
          color_code: string | null;
          default_sheet_l: number | null;
          default_sheet_w: number | null;
          cost_per_sqm: number | null;
          supplier: string | null;
          sku: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          material_id: string;
          name: string;
          thickness_mm: number;
          core_type?: string | null;
          grain?: string | null;
          finish?: string | null;
          color_code?: string | null;
          default_sheet_l?: number | null;
          default_sheet_w?: number | null;
          cost_per_sqm?: number | null;
          supplier?: string | null;
          sku?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          material_id?: string;
          name?: string;
          thickness_mm?: number;
          core_type?: string | null;
          grain?: string | null;
          finish?: string | null;
          color_code?: string | null;
          default_sheet_l?: number | null;
          default_sheet_w?: number | null;
          cost_per_sqm?: number | null;
          supplier?: string | null;
          sku?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      edgebands: {
        Row: {
          id: string;
          organization_id: string;
          edgeband_id: string;
          name: string;
          thickness_mm: number;
          width_mm: number;
          material: string | null;
          color_code: string | null;
          cost_per_meter: number | null;
          supplier: string | null;
          sku: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          edgeband_id: string;
          name: string;
          thickness_mm: number;
          width_mm: number;
          material?: string | null;
          color_code?: string | null;
          cost_per_meter?: number | null;
          supplier?: string | null;
          sku?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          edgeband_id?: string;
          name?: string;
          thickness_mm?: number;
          width_mm?: number;
          material?: string | null;
          color_code?: string | null;
          cost_per_meter?: number | null;
          supplier?: string | null;
          sku?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cutlists: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          doc_id: string;
          name: string;
          description: string | null;
          job_ref: string | null;
          client_ref: string | null;
          status: "draft" | "pending" | "processing" | "completed" | "archived";
          capabilities: Json;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          doc_id: string;
          name: string;
          description?: string | null;
          job_ref?: string | null;
          client_ref?: string | null;
          status?: "draft" | "pending" | "processing" | "completed" | "archived";
          capabilities?: Json;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          doc_id?: string;
          name?: string;
          description?: string | null;
          job_ref?: string | null;
          client_ref?: string | null;
          status?: "draft" | "pending" | "processing" | "completed" | "archived";
          capabilities?: Json;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      parts: {
        Row: {
          id: string;
          cutlist_id: string;
          part_id: string;
          label: string | null;
          qty: number;
          length_mm: number;
          width_mm: number;
          thickness_mm: number;
          material_id: string;
          grain: string;
          allow_rotation: boolean;
          group_id: string | null;
          priority: number | null;
          ops: Json | null;
          notes: Json | null;
          audit: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cutlist_id: string;
          part_id: string;
          label?: string | null;
          qty: number;
          length_mm: number;
          width_mm: number;
          thickness_mm: number;
          material_id: string;
          grain?: string;
          allow_rotation?: boolean;
          group_id?: string | null;
          priority?: number | null;
          ops?: Json | null;
          notes?: Json | null;
          audit?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cutlist_id?: string;
          part_id?: string;
          label?: string | null;
          qty?: number;
          length_mm?: number;
          width_mm?: number;
          thickness_mm?: number;
          material_id?: string;
          grain?: string;
          allow_rotation?: boolean;
          group_id?: string | null;
          priority?: number | null;
          ops?: Json | null;
          notes?: Json | null;
          audit?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      parse_jobs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          cutlist_id: string | null;
          source_type: "text" | "file" | "voice" | "api";
          source_data: Json;
          status: "pending" | "processing" | "completed" | "failed";
          result: Json | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          cutlist_id?: string | null;
          source_type: "text" | "file" | "voice" | "api";
          source_data: Json;
          status?: "pending" | "processing" | "completed" | "failed";
          result?: Json | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          cutlist_id?: string | null;
          source_type?: "text" | "file" | "voice" | "api";
          source_data?: Json;
          status?: "pending" | "processing" | "completed" | "failed";
          result?: Json | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      files: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          filename: string;
          content_type: string;
          size_bytes: number;
          storage_path: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          filename: string;
          content_type: string;
          size_bytes: number;
          storage_path: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          filename?: string;
          content_type?: string;
          size_bytes?: number;
          storage_path?: string;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          type: "intake_form" | "export" | "label";
          config: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          type: "intake_form" | "export" | "label";
          config: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          type?: "intake_form" | "export" | "label";
          config?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "super_admin" | "org_admin" | "manager" | "operator" | "viewer";
      cutlist_status: "draft" | "pending" | "processing" | "completed" | "archived";
      parse_job_status: "pending" | "processing" | "completed" | "failed";
      template_type: "intake_form" | "export" | "label";
    };
  };
}

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience types
export type Organization = Tables<"organizations">;
export type User = Tables<"users">;
export type Material = Tables<"materials">;
export type Edgeband = Tables<"edgebands">;
export type Cutlist = Tables<"cutlists">;
export type Part = Tables<"parts">;
export type ParseJob = Tables<"parse_jobs">;
export type File = Tables<"files">;
export type Template = Tables<"templates">;





