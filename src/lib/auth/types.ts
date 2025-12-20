/**
 * CAI Intake - Auth Types
 * 
 * Type definitions for authentication and user sessions.
 */

import type { RoleType, PermissionType } from "./roles";

// ============================================================
// USER TYPES
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  phone: string | null;
  jobTitle: string | null;
  emailVerified: Date | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;

  // Organization
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    plan: string;
  } | null;

  // Role
  roleId: string | null;
  role: {
    id: string;
    name: RoleType;
    displayName: string;
    permissions: Record<string, boolean>;
  } | null;

  // User preferences
  preferences: UserPreferences;
  notifications: NotificationSettings;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
  dateFormat?: string;
  defaultUnits?: "mm" | "inches";
  defaultMaterialId?: string;
  advancedMode?: boolean;
}

export interface NotificationSettings {
  email?: boolean;
  push?: boolean;
  cutlistComplete?: boolean;
  parseJobComplete?: boolean;
  weeklyDigest?: boolean;
}

// ============================================================
// SESSION TYPES
// ============================================================

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  lastActiveAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface SessionUser extends AuthUser {
  sessionId: string;
  sessionToken: string;
}

// ============================================================
// ORGANIZATION TYPES
// ============================================================

export interface OrganizationSettings {
  // General
  timezone?: string;
  dateFormat?: string;
  defaultUnits?: "mm" | "inches";

  // Cutlist defaults
  defaultThicknessMm?: number;
  defaultGrain?: "none" | "along_L";
  autoOptimize?: boolean;

  // Capabilities
  enableEdging?: boolean;
  enableGrooves?: boolean;
  enableCncHoles?: boolean;
  enableCncRouting?: boolean;

  // Branding
  primaryColor?: string;
  logoUrl?: string;

  // Integrations
  webhookUrl?: string;
  apiKey?: string;
}

export interface OrganizationMember {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: {
    id: string;
    name: RoleType;
    displayName: string;
  } | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// ============================================================
// INVITATION TYPES
// ============================================================

export interface Invitation {
  id: string;
  email: string;
  roleId: string;
  roleName: RoleType;
  organizationId: string;
  organizationName: string;
  invitedById: string;
  invitedByName: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ============================================================
// AUDIT LOG TYPES
// ============================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  userName: string | null;
  organizationId: string | null;
  createdAt: Date;
}

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.signup"
  | "user.invite"
  | "user.update"
  | "user.delete"
  | "user.role_change"
  | "org.create"
  | "org.update"
  | "org.settings_update"
  | "cutlist.create"
  | "cutlist.update"
  | "cutlist.delete"
  | "cutlist.export"
  | "cutlist.optimize"
  | "material.create"
  | "material.update"
  | "material.delete"
  | "template.create"
  | "template.update"
  | "template.delete";

// ============================================================
// PLATFORM (SUPER ADMIN) TYPES
// ============================================================

export interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalCutlists: number;
  totalPartsProcessed: number;
  activeOrganizations: number;
  newUsersThisMonth: number;
  parseJobsToday: number;
  averageConfidence: number;
}

export interface PlatformSettings {
  maintenanceMode?: boolean;
  allowSignups?: boolean;
  defaultPlan?: string;
  maxOrganizationsPerUser?: number;
  maxUsersPerOrganization?: number;
  featureFlags?: Record<string, boolean>;
}

