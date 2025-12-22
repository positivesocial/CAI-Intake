/**
 * Helper utilities for role extraction from Supabase queries
 */

// Type for Supabase joined role relation
export type RoleJoin = { name?: string } | { name?: string }[] | null | undefined;

/**
 * Extract role name from Supabase joined relation
 * Handles both single object and array formats
 */
export function getRoleName(role: RoleJoin): string | undefined {
  if (!role) return undefined;
  if (Array.isArray(role)) return role[0]?.name;
  return role.name;
}

/**
 * Check if user has required role for admin actions
 */
export function hasAdminRole(roleName: string | undefined, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || ["org_admin", "manager"].includes(roleName || "");
}

