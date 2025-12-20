/**
 * CAI Intake - Auth Store
 * 
 * Zustand store for managing authentication state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, SessionUser, UserPreferences, NotificationSettings } from "./types";
import type { RoleType, PermissionType } from "./roles";
import { hasPermission, hasAnyPermission, ROLE_PERMISSIONS } from "./roles";

interface AuthState {
  // User state
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: SessionUser | null) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  updateNotifications: (notifs: Partial<NotificationSettings>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Demo login
  loginAsDemo: (userType: "super_admin" | "org_admin" | "operator") => void;

  // Permission checks
  can: (permission: PermissionType) => boolean;
  canAny: (permissions: PermissionType[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrgAdmin: () => boolean;
}

// =============================================================================
// TEST CREDENTIALS
// =============================================================================
// 
// Super Admin (Platform-wide access):
//   Email: super@caiintake.com
//   Password: SuperAdmin123!
//
// Organization Admin (Acme Cabinets):
//   Email: admin@acmecabinets.com  
//   Password: OrgAdmin123!
//
// Operator (Basic user):
//   Email: operator@acmecabinets.com
//   Password: Operator123!
//
// =============================================================================

// Super Admin - Platform-wide access
export const SUPER_ADMIN_USER: SessionUser = {
  id: "super-admin-001",
  email: "super@caiintake.com",
  name: "Platform Super Admin",
  avatar: null,
  phone: "+1 (555) 000-0001",
  jobTitle: "Platform Administrator",
  emailVerified: new Date(),
  isActive: true,
  isSuperAdmin: true,
  createdAt: new Date("2024-01-01"),
  lastLoginAt: new Date(),
  organizationId: null,
  organization: null,
  roleId: "role-super-admin",
  role: {
    id: "role-super-admin",
    name: "super_admin",
    displayName: "Super Admin",
    permissions: ROLE_PERMISSIONS.super_admin.reduce(
      (acc, p) => ({ ...acc, [p]: true }),
      {}
    ),
  },
  preferences: {
    theme: "dark",
    language: "en",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",
    defaultUnits: "mm",
    advancedMode: true,
  },
  notifications: {
    email: true,
    push: true,
    cutlistComplete: true,
    parseJobComplete: true,
    weeklyDigest: true,
  },
  sessionId: "session-super-001",
  sessionToken: "super-token",
};

// Organization Admin - Acme Cabinets
export const ORG_ADMIN_USER: SessionUser = {
  id: "org-admin-001",
  email: "admin@acmecabinets.com",
  name: "John Smith",
  avatar: null,
  phone: "+1 (555) 123-4567",
  jobTitle: "Workshop Manager",
  emailVerified: new Date(),
  isActive: true,
  isSuperAdmin: false,
  createdAt: new Date("2024-03-15"),
  lastLoginAt: new Date(),
  organizationId: "org-acme-001",
  organization: {
    id: "org-acme-001",
    name: "Acme Cabinets & Millwork",
    slug: "acme-cabinets",
    logo: null,
    plan: "professional",
  },
  roleId: "role-org-admin",
  role: {
    id: "role-org-admin",
    name: "org_admin",
    displayName: "Organization Admin",
    permissions: ROLE_PERMISSIONS.org_admin.reduce(
      (acc, p) => ({ ...acc, [p]: true }),
      {}
    ),
  },
  preferences: {
    theme: "light",
    language: "en",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    defaultUnits: "mm",
    advancedMode: true,
  },
  notifications: {
    email: true,
    push: true,
    cutlistComplete: true,
    parseJobComplete: true,
    weeklyDigest: true,
  },
  sessionId: "session-org-admin-001",
  sessionToken: "org-admin-token",
};

// Operator - Basic user at Acme Cabinets
export const OPERATOR_USER: SessionUser = {
  id: "operator-001",
  email: "operator@acmecabinets.com",
  name: "Mike Johnson",
  avatar: null,
  phone: "+1 (555) 987-6543",
  jobTitle: "CNC Operator",
  emailVerified: new Date(),
  isActive: true,
  isSuperAdmin: false,
  createdAt: new Date("2024-06-01"),
  lastLoginAt: new Date(),
  organizationId: "org-acme-001",
  organization: {
    id: "org-acme-001",
    name: "Acme Cabinets & Millwork",
    slug: "acme-cabinets",
    logo: null,
    plan: "professional",
  },
  roleId: "role-operator",
  role: {
    id: "role-operator",
    name: "operator",
    displayName: "Operator",
    permissions: ROLE_PERMISSIONS.operator.reduce(
      (acc, p) => ({ ...acc, [p]: true }),
      {}
    ),
  },
  preferences: {
    theme: "system",
    language: "en",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    defaultUnits: "mm",
    advancedMode: false,
  },
  notifications: {
    email: true,
    push: false,
    cutlistComplete: true,
    parseJobComplete: true,
    weeklyDigest: false,
  },
  sessionId: "session-operator-001",
  sessionToken: "operator-token",
};

// Legacy export for backwards compatibility
export const DEMO_USER = ORG_ADMIN_USER;

// Test credentials map for easy lookup
export const TEST_CREDENTIALS = {
  "super@caiintake.com": { password: "SuperAdmin123!", user: SUPER_ADMIN_USER },
  "admin@acmecabinets.com": { password: "OrgAdmin123!", user: ORG_ADMIN_USER },
  "operator@acmecabinets.com": { password: "Operator123!", user: OPERATOR_USER },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - not authenticated by default
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
          error: null,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      updatePreferences: (prefs) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                preferences: { ...state.user.preferences, ...prefs },
              }
            : null,
        })),

      updateNotifications: (notifs) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                notifications: { ...state.user.notifications, ...notifs },
              }
            : null,
        })),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),
      
      loginAsDemo: (userType) => {
        let user: SessionUser;
        switch (userType) {
          case "super_admin":
            user = SUPER_ADMIN_USER;
            break;
          case "org_admin":
            user = ORG_ADMIN_USER;
            break;
          case "operator":
            user = OPERATOR_USER;
            break;
          default:
            user = ORG_ADMIN_USER;
        }
        set({
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      can: (permission) => {
        const { user } = get();
        if (!user) return false;
        return hasPermission(
          user.role?.name as RoleType | undefined,
          permission,
          user.isSuperAdmin
        );
      },

      canAny: (permissions) => {
        const { user } = get();
        if (!user) return false;
        return hasAnyPermission(
          user.role?.name as RoleType | undefined,
          permissions,
          user.isSuperAdmin
        );
      },

      isSuperAdmin: () => {
        const { user } = get();
        return user?.isSuperAdmin ?? false;
      },

      isOrgAdmin: () => {
        const { user } = get();
        return user?.role?.name === "org_admin" || user?.isSuperAdmin === true;
      },
    }),
    {
      name: "cai-auth-storage",
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
