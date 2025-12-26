/**
 * CAI Intake - Roles & Permissions System
 * 
 * Defines the role hierarchy and permission system for the application.
 */

// ============================================================
// ROLE DEFINITIONS
// ============================================================

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ORG_ADMIN: "org_admin",
  MANAGER: "manager",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<RoleType, number> = {
  super_admin: 100,
  org_admin: 80,
  manager: 60,
  operator: 40,
  viewer: 20,
};

export const ROLE_DISPLAY_NAMES: Record<RoleType, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  manager: "Manager",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  super_admin: "Platform-wide access to all organizations and settings",
  org_admin: "Full access to organization settings and all features",
  manager: "Can manage cutlists, users, and view reports",
  operator: "Can create and edit cutlists",
  viewer: "Read-only access to cutlists",
};

// ============================================================
// PERMISSION DEFINITIONS
// ============================================================

export const PERMISSIONS = {
  // Cutlist permissions
  CUTLIST_CREATE: "cutlist:create",
  CUTLIST_READ: "cutlist:read",
  CUTLIST_UPDATE: "cutlist:update",
  CUTLIST_DELETE: "cutlist:delete",
  CUTLIST_EXPORT: "cutlist:export",
  CUTLIST_OPTIMIZE: "cutlist:optimize",

  // User management
  USER_INVITE: "user:invite",
  USER_MANAGE: "user:manage",
  USER_VIEW: "user:view",

  // Organization management
  ORG_SETTINGS: "org:settings",
  ORG_BILLING: "org:billing",
  ORG_MEMBERS: "org:members",

  // Material/Edgeband management
  MATERIAL_CREATE: "material:create",
  MATERIAL_UPDATE: "material:update",
  MATERIAL_DELETE: "material:delete",

  // Template management
  TEMPLATE_CREATE: "template:create",
  TEMPLATE_UPDATE: "template:update",
  TEMPLATE_DELETE: "template:delete",

  // Reports & Analytics
  REPORTS_VIEW: "reports:view",
  ANALYTICS_VIEW: "analytics:view",

  // Platform (Super Admin only)
  PLATFORM_ADMIN: "platform:admin",
  PLATFORM_SETTINGS: "platform:settings",
  PLATFORM_USERS: "platform:users",
  PLATFORM_ORGS: "platform:orgs",
} as const;

export type PermissionType = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================
// ROLE PERMISSIONS MAPPING
// ============================================================

export const ROLE_PERMISSIONS: Record<RoleType, PermissionType[]> = {
  super_admin: Object.values(PERMISSIONS), // All permissions

  org_admin: [
    PERMISSIONS.CUTLIST_CREATE,
    PERMISSIONS.CUTLIST_READ,
    PERMISSIONS.CUTLIST_UPDATE,
    PERMISSIONS.CUTLIST_DELETE,
    PERMISSIONS.CUTLIST_EXPORT,
    PERMISSIONS.CUTLIST_OPTIMIZE,
    PERMISSIONS.USER_INVITE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.ORG_BILLING,
    PERMISSIONS.ORG_MEMBERS,
    PERMISSIONS.MATERIAL_CREATE,
    PERMISSIONS.MATERIAL_UPDATE,
    PERMISSIONS.MATERIAL_DELETE,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_UPDATE,
    PERMISSIONS.TEMPLATE_DELETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],

  manager: [
    PERMISSIONS.CUTLIST_CREATE,
    PERMISSIONS.CUTLIST_READ,
    PERMISSIONS.CUTLIST_UPDATE,
    PERMISSIONS.CUTLIST_DELETE,
    PERMISSIONS.CUTLIST_EXPORT,
    PERMISSIONS.CUTLIST_OPTIMIZE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.ORG_MEMBERS,
    PERMISSIONS.MATERIAL_CREATE,
    PERMISSIONS.MATERIAL_UPDATE,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
  ],

  operator: [
    PERMISSIONS.CUTLIST_CREATE,
    PERMISSIONS.CUTLIST_READ,
    PERMISSIONS.CUTLIST_UPDATE,
    PERMISSIONS.CUTLIST_EXPORT,
    PERMISSIONS.CUTLIST_OPTIMIZE,
    PERMISSIONS.USER_VIEW,
  ],

  viewer: [
    PERMISSIONS.CUTLIST_READ,
    PERMISSIONS.USER_VIEW,
  ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: RoleType | undefined,
  permission: PermissionType,
  isSuperAdmin?: boolean
): boolean {
  // Super admins have all permissions
  if (isSuperAdmin) return true;
  if (!role) return false;

  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: RoleType | undefined,
  permissions: PermissionType[],
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  return permissions.some((p) => hasPermission(role, p, isSuperAdmin));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: RoleType | undefined,
  permissions: PermissionType[],
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  return permissions.every((p) => hasPermission(role, p, isSuperAdmin));
}

/**
 * Check if one role can manage another role (based on hierarchy)
 */
export function canManageRole(
  managerRole: RoleType | undefined,
  targetRole: RoleType,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  if (!managerRole) return false;

  const managerLevel = ROLE_HIERARCHY[managerRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  return managerLevel > targetLevel;
}

/**
 * Get all roles that a role can assign
 */
export function getAssignableRoles(
  role: RoleType | undefined,
  isSuperAdmin?: boolean
): RoleType[] {
  if (isSuperAdmin) {
    return Object.values(ROLES);
  }

  if (!role) return [];

  const roleLevel = ROLE_HIERARCHY[role];
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level < roleLevel)
    .map(([roleName]) => roleName as RoleType);
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: RoleType): PermissionType[] {
  return ROLE_PERMISSIONS[role] ?? [];
}





