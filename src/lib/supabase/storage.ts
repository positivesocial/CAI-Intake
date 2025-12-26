/**
 * CAI Intake - Supabase Storage Utilities
 * 
 * Helper functions for working with Supabase Storage.
 * Handles file uploads, downloads, and URL generation.
 */

import { getClient } from "./client";

// =============================================================================
// TYPES
// =============================================================================

export interface UploadOptions {
  bucket?: string;
  folder?: string;
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const BUCKETS = {
  CUTLIST_FILES: "cutlist-files",
  TEMPLATES: "templates",
  EXPORTS: "exports",
  AVATARS: "avatars",
} as const;

export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  cutlist: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  template: [
    "application/pdf",
    "image/png",
    "image/jpeg",
  ],
  avatar: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ],
};

export const MAX_FILE_SIZES: Record<string, number> = {
  cutlist: 50 * 1024 * 1024, // 50MB
  template: 10 * 1024 * 1024, // 10MB
  avatar: 5 * 1024 * 1024, // 5MB
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a file for upload
 */
export function validateFile(
  file: File,
  type: "cutlist" | "template" | "avatar"
): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ALLOWED_FILE_TYPES[type];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  // Check file size
  const maxSize = MAX_FILE_SIZES[type];
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Get a safe filename for storage
 */
export function getSafeFilename(originalName: string): string {
  const timestamp = Date.now();
  const ext = originalName.split(".").pop()?.toLowerCase() || "";
  const baseName = originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, "_") // Replace special chars
    .substring(0, 50); // Limit length
  
  return `${timestamp}-${baseName}.${ext}`;
}

// =============================================================================
// UPLOAD FUNCTIONS
// =============================================================================

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not available" };
  }

  const {
    bucket = BUCKETS.CUTLIST_FILES,
    folder = "",
    upsert = false,
    cacheControl = "3600",
    contentType,
  } = options;

  const filename = getSafeFilename(file.name);
  const path = folder ? `${folder}/${filename}` : filename;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl,
        upsert,
        contentType: contentType || file.type,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload a file from a Blob/ArrayBuffer
 */
export async function uploadBlob(
  blob: Blob,
  filename: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const file = new File([blob], filename, { type: blob.type });
  return uploadFile(file, options);
}

/**
 * Upload multiple files
 */
export async function uploadMultipleFiles(
  files: File[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  const results = await Promise.all(
    files.map((file) => uploadFile(file, options))
  );
  return results;
}

// =============================================================================
// DOWNLOAD FUNCTIONS
// =============================================================================

/**
 * Download a file from Supabase Storage
 */
export async function downloadFile(
  path: string,
  bucket: string = BUCKETS.CUTLIST_FILES
): Promise<{ success: boolean; data?: Blob; error?: string }> {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not available" };
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// URL FUNCTIONS
// =============================================================================

/**
 * Get a public URL for a file
 */
export function getPublicUrl(
  path: string,
  bucket: string = BUCKETS.CUTLIST_FILES
): string | null {
  const supabase = getClient();
  if (!supabase) return null;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get a signed URL for a file (time-limited access)
 */
export async function getSignedUrl(
  path: string,
  bucket: string = BUCKETS.CUTLIST_FILES,
  expiresInSeconds: number = 3600
): Promise<{ url?: string; error?: string }> {
  const supabase = getClient();
  if (!supabase) {
    return { error: "Supabase client not available" };
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      return { error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create signed URL",
    };
  }
}

/**
 * Get signed URLs for multiple files
 */
export async function getSignedUrls(
  paths: string[],
  bucket: string = BUCKETS.CUTLIST_FILES,
  expiresInSeconds: number = 3600
): Promise<{ urls: Record<string, string>; errors: Record<string, string> }> {
  const supabase = getClient();
  if (!supabase) {
    const errors: Record<string, string> = {};
    paths.forEach((p) => (errors[p] = "Supabase client not available"));
    return { urls: {}, errors };
  }

  const urls: Record<string, string> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    paths.map(async (path) => {
      const result = await getSignedUrl(path, bucket, expiresInSeconds);
      if (result.url) {
        urls[path] = result.url;
      } else if (result.error) {
        errors[path] = result.error;
      }
    })
  );

  return { urls, errors };
}

// =============================================================================
// DELETE FUNCTIONS
// =============================================================================

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  path: string,
  bucket: string = BUCKETS.CUTLIST_FILES
): Promise<{ success: boolean; error?: string }> {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not available" };
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Delete multiple files from Supabase Storage
 */
export async function deleteFiles(
  paths: string[],
  bucket: string = BUCKETS.CUTLIST_FILES
): Promise<{ success: boolean; deleted: string[]; errors: Record<string, string> }> {
  const supabase = getClient();
  if (!supabase) {
    const errors: Record<string, string> = {};
    paths.forEach((p) => (errors[p] = "Supabase client not available"));
    return { success: false, deleted: [], errors };
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) {
      const errors: Record<string, string> = {};
      paths.forEach((p) => (errors[p] = error.message));
      return { success: false, deleted: [], errors };
    }

    return { success: true, deleted: paths, errors: {} };
  } catch (error) {
    const errors: Record<string, string> = {};
    const message = error instanceof Error ? error.message : "Delete failed";
    paths.forEach((p) => (errors[p] = message));
    return { success: false, deleted: [], errors };
  }
}

// =============================================================================
// LIST FUNCTIONS
// =============================================================================

/**
 * List files in a folder
 */
export async function listFiles(
  folder: string = "",
  bucket: string = BUCKETS.CUTLIST_FILES,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  files: Array<{
    name: string;
    id: string;
    size: number;
    created_at: string;
    updated_at: string;
  }>;
  error?: string;
}> {
  const supabase = getClient();
  if (!supabase) {
    return { files: [], error: "Supabase client not available" };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: options.limit || 100,
      offset: options.offset || 0,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      return { files: [], error: error.message };
    }

    const files = (data || [])
      .filter((item) => item.id) // Filter out folders
      .map((item) => ({
        name: item.name,
        id: item.id || "",
        size: item.metadata?.size || 0,
        created_at: item.created_at || "",
        updated_at: item.updated_at || "",
      }));

    return { files };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error.message : "List failed",
    };
  }
}





