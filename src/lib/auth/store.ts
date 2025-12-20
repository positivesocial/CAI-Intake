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

  // Permission checks
  can: (permission: PermissionType) => boolean;
  canAny: (permissions: PermissionType[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrgAdmin: () => boolean;
}

// Demo user for development
const DEMO_USER: SessionUser = {
  id: "demo-user-001",
  email: "demo@caiintake.com",
  name: "Demo User",
  avatar: null,
  phone: null,
  jobTitle: "Workshop Manager",
  emailVerified: new Date(),
  isActive: true,
  isSuperAdmin: false,
  createdAt: new Date(),
  lastLoginAt: new Date(),
  organizationId: "demo-org-001",
  organization: {
    id: "demo-org-001",
    name: "Demo Workshop",
    slug: "demo-workshop",
    logo: null,
    plan: "professional",
  },
  roleId: "role-manager",
  role: {
    id: "role-manager",
    name: "manager",
    displayName: "Manager",
    permissions: ROLE_PERMISSIONS.manager.reduce(
      (acc, p) => ({ ...acc, [p]: true }),
      {}
    ),
  },
  preferences: {
    theme: "system",
    language: "en",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",
    defaultUnits: "mm",
    advancedMode: false,
  },
  notifications: {
    email: true,
    push: true,
    cutlistComplete: true,
    parseJobComplete: true,
    weeklyDigest: false,
  },
  sessionId: "session-demo-001",
  sessionToken: "demo-token",
};

// Super admin demo user
const SUPER_ADMIN_USER: SessionUser = {
  id: "super-admin-001",
  email: "admin@caiintake.com",
  name: "Platform Admin",
  avatar: null,
  phone: null,
  jobTitle: "Platform Administrator",
  emailVerified: new Date(),
  isActive: true,
  isSuperAdmin: true,
  createdAt: new Date(),
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
  },
  sessionId: "session-super-001",
  sessionToken: "super-token",
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - start with demo user for development
      user: DEMO_USER,
      isAuthenticated: true,
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

// Export demo users for switching in development
export { DEMO_USER, SUPER_ADMIN_USER };

