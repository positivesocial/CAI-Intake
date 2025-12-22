/**
 * CAI Intake - Auth Store
 * 
 * Zustand store for managing authentication state.
 * Integrates with Supabase for authentication.
 */

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, SessionUser, UserPreferences, NotificationSettings } from "./types";
import type { RoleType, PermissionType } from "./roles";
import { hasPermission, hasAnyPermission } from "./roles";
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

  // Permission checks
  can: (permission: PermissionType) => boolean;
  canAny: (permissions: PermissionType[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrgAdmin: () => boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
