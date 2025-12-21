/**
 * CAI Intake - Auth Store
 * 
 * Zustand store for managing authentication state.
 * Integrates with Supabase for real authentication.
 */

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, SessionUser, UserPreferences, NotificationSettings } from "./types";
import type { RoleType, PermissionType } from "./roles";
import { hasPermission, hasAnyPermission, ROLE_PERMISSIONS } from "./roles";
import { getClient } from "@/lib/supabase/client";

// =============================================================================
// TYPES
// =============================================================================

interface AuthState {
  // User state
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Core actions
  setUser: (user: SessionUser | null) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  updateNotifications: (notifs: Partial<NotificationSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Supabase auth actions
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Demo login (for development)
  loginAsDemo: (userType: "super_admin" | "org_admin" | "operator") => void;

  // Permission checks
  can: (permission: PermissionType) => boolean;
  canAny: (permissions: PermissionType[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrgAdmin: () => boolean;
}

// =============================================================================
// DEMO/TEST USERS (Development Only)
// =============================================================================
// These credentials are ONLY available when NEXT_PUBLIC_DEMO_MODE=true
// In production, these should NEVER be exposed
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

// Test credentials map - ONLY available in demo mode
// In production, this returns an empty object for security
export const TEST_CREDENTIALS: Record<string, { password: string; user: SessionUser }> = 
  process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ? {
        "super@caiintake.com": { password: "SuperAdmin123!", user: SUPER_ADMIN_USER },
        "admin@acmecabinets.com": { password: "OrgAdmin123!", user: ORG_ADMIN_USER },
        "operator@acmecabinets.com": { password: "Operator123!", user: OPERATOR_USER },
      }
    : {};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if demo mode is enabled
 */
function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/**
 * Fetch user profile from database and construct SessionUser
 */
async function fetchUserProfile(supabaseUserId: string): Promise<SessionUser | null> {
  try {
    const response = await fetch(`/api/v1/auth/profile?userId=${supabaseUserId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.user;
  } catch {
    return null;
  }
}

// =============================================================================
// STORE
// =============================================================================

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

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),
      
      // =========================================================================
      // SUPABASE AUTH ACTIONS
      // =========================================================================

      loginWithEmail: async (email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          // Check for demo mode credentials first
          if (isDemoMode()) {
            const testCred = TEST_CREDENTIALS[email as keyof typeof TEST_CREDENTIALS];
            if (testCred && testCred.password === password) {
              set({
                user: testCred.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return { success: true };
            }
          }

          // Real Supabase auth
          const supabase = getClient();
          if (!supabase) {
            set({ isLoading: false, error: "Supabase client not available" });
            return { success: false, error: "Auth service unavailable" };
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (!data.user) {
            set({ isLoading: false, error: "No user returned" });
            return { success: false, error: "Login failed" };
          }

          // Fetch full user profile from our database
          const userProfile = await fetchUserProfile(data.user.id);
          
          if (userProfile) {
            set({
              user: userProfile,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Create a basic user profile from Supabase data
            const basicUser: SessionUser = {
              id: data.user.id,
              email: data.user.email || "",
              name: data.user.user_metadata?.name || email.split("@")[0],
              avatar: data.user.user_metadata?.avatar_url || null,
              phone: null,
              jobTitle: null,
              emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
              isActive: true,
              isSuperAdmin: false,
              createdAt: new Date(data.user.created_at),
              lastLoginAt: new Date(),
              organizationId: null,
              organization: null,
              roleId: null,
              role: null,
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
              },
              sessionId: data.session?.access_token || "",
              sessionToken: data.session?.access_token || "",
            };

            set({
              user: basicUser,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }

          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Login failed";
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const supabase = getClient();
          if (!supabase) {
            set({ isLoading: false, error: "Supabase client not available" });
            return { success: false, error: "Auth service unavailable" };
          }

          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          // OAuth redirect will happen, so we don't set loading to false
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Google login failed";
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      signUpWithEmail: async (email, password, name) => {
        set({ isLoading: true, error: null });
        
        try {
          const supabase = getClient();
          if (!supabase) {
            set({ isLoading: false, error: "Supabase client not available" });
            return { success: false, error: "Auth service unavailable" };
          }

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set({ isLoading: false });
          
          // If email confirmation is required, user won't be logged in yet
          if (!data.session) {
            return { success: true }; // Return success but user needs to confirm email
          }

          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Sign up failed";
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      resetPassword: async (email) => {
        set({ isLoading: true, error: null });
        
        try {
          const supabase = getClient();
          if (!supabase) {
            set({ isLoading: false, error: "Supabase client not available" });
            return { success: false, error: "Auth service unavailable" };
          }

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Password reset failed";
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      updatePassword: async (password) => {
        set({ isLoading: true, error: null });
        
        try {
          const supabase = getClient();
          if (!supabase) {
            set({ isLoading: false, error: "Supabase client not available" });
            return { success: false, error: "Auth service unavailable" };
          }

          const { error } = await supabase.auth.updateUser({ password });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Password update failed";
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          const supabase = getClient();
          if (supabase) {
            await supabase.auth.signOut();
          }
        } catch {
          // Ignore errors during logout
        }

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },
      
      // =========================================================================
      // DEMO LOGIN
      // =========================================================================
      
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

      // =========================================================================
      // PERMISSION CHECKS
      // =========================================================================

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

// Helper hook to check if store has been hydrated from localStorage
export const useAuthHydrated = () => {
  const [hydrated, setHydrated] = React.useState(false);
  
  React.useEffect(() => {
    // Check if persist has finished hydrating
    const unsubFinishHydration = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    
    // If already hydrated (e.g., on client-side navigation)
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    
    return () => {
      unsubFinishHydration();
    };
  }, []);
  
  return hydrated;
};

