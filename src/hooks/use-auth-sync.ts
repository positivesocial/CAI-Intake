/**
 * CAI Intake - Auth Sync Hook
 * 
 * Synchronizes Supabase auth state with the Zustand auth store.
 * Handles:
 * - Initial session check
 * - Auth state change events
 * - User profile fetching
 * - Token refresh
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { getClient } from "@/lib/supabase/client";
import { useAuthStore, TEST_CREDENTIALS } from "@/lib/auth/store";
import type { SessionUser, UserPreferences, NotificationSettings } from "@/lib/auth/types";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface UseAuthSyncOptions {
  /** Whether to automatically sync on mount */
  autoSync?: boolean;
  /** Callback when auth state changes */
  onAuthChange?: (event: AuthChangeEvent, session: Session | null) => void;
}

/**
 * Hook to sync Supabase auth with Zustand store
 */
export function useAuthSync(options: UseAuthSyncOptions = {}) {
  const { autoSync = true, onAuthChange } = options;
  
  const { setUser, setLoading, setError, isAuthenticated } = useAuthStore();
  const hasInitialized = useRef(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  /**
   * Fetch full user profile from API
   */
  const fetchUserProfile = useCallback(async (supabaseUserId: string): Promise<SessionUser | null> => {
    try {
      const response = await fetch(`/api/v1/auth/profile?userId=${supabaseUserId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.user;
    } catch {
      return null;
    }
  }, []);

  /**
   * Build a SessionUser from Supabase user data
   */
  const buildUserFromSupabase = useCallback((supabaseUser: {
    id: string;
    email?: string;
    created_at: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  }, session: Session | null): SessionUser => {
    const defaultPreferences: UserPreferences = {
      theme: "system",
      language: "en",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      defaultUnits: "mm",
      advancedMode: false,
    };

    const defaultNotifications: NotificationSettings = {
      email: true,
      push: true,
    };

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name: (supabaseUser.user_metadata?.name as string) || supabaseUser.email?.split("@")[0] || "User",
      avatar: (supabaseUser.user_metadata?.avatar_url as string) || null,
      phone: null,
      jobTitle: null,
      emailVerified: supabaseUser.email_confirmed_at ? new Date(supabaseUser.email_confirmed_at) : null,
      isActive: true,
      isSuperAdmin: false,
      createdAt: new Date(supabaseUser.created_at),
      lastLoginAt: new Date(),
      organizationId: null,
      organization: null,
      roleId: null,
      role: null,
      preferences: defaultPreferences,
      notifications: defaultNotifications,
      sessionId: session?.access_token || "",
      sessionToken: session?.access_token || "",
    };
  }, []);

  /**
   * Handle auth state changes
   */
  const handleAuthChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
    // Call user callback if provided
    onAuthChange?.(event, session);

    switch (event) {
      case "SIGNED_IN":
      case "TOKEN_REFRESHED":
        if (session?.user) {
          setLoading(true);
          
          // First try to fetch full profile from our database
          const profile = await fetchUserProfile(session.user.id);
          
          if (profile) {
            setUser(profile);
          } else {
            // Fall back to basic user from Supabase
            const basicUser = buildUserFromSupabase(session.user, session);
            setUser(basicUser);
          }
          
          setLoading(false);
        }
        break;

      case "SIGNED_OUT":
        setUser(null);
        break;

      case "USER_UPDATED":
        if (session?.user) {
          // Refresh the profile
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
          }
        }
        break;

      case "PASSWORD_RECOVERY":
        // User clicked password recovery link
        // They should be redirected to password reset page
        break;

      default:
        break;
    }
  }, [setUser, setLoading, fetchUserProfile, buildUserFromSupabase, onAuthChange]);

  /**
   * Initialize auth state from Supabase session
   */
  const initializeAuth = useCallback(async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const supabase = getClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      if (session?.user) {
        // Try to fetch full profile
        const profile = await fetchUserProfile(session.user.id);
        
        if (profile) {
          setUser(profile);
        } else {
          const basicUser = buildUserFromSupabase(session.user, session);
          setUser(basicUser);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Auth init error:", err);
      setError(err instanceof Error ? err.message : "Auth initialization failed");
      setLoading(false);
    }
  }, [setUser, setLoading, setError, fetchUserProfile, buildUserFromSupabase]);

  /**
   * Subscribe to auth state changes
   */
  const subscribeToAuth = useCallback(() => {
    const supabase = getClient();
    if (!supabase) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  /**
   * Force refresh the user profile
   */
  const refreshProfile = useCallback(async () => {
    const supabase = getClient();
    if (!supabase) return;

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const profile = await fetchUserProfile(user.id);
        if (profile) {
          setUser(profile);
        }
      }
    } catch (err) {
      console.error("Profile refresh error:", err);
    }
    
    setLoading(false);
  }, [setUser, setLoading, fetchUserProfile]);

  // Auto-sync on mount
  useEffect(() => {
    if (!autoSync) return;

    initializeAuth();
    const unsubscribe = subscribeToAuth();

    return () => {
      unsubscribe?.();
    };
  }, [autoSync, initializeAuth, subscribeToAuth]);

  return {
    isAuthenticated,
    initializeAuth,
    subscribeToAuth,
    refreshProfile,
  };
}

/**
 * Simple hook to check if user is authenticated
 * Useful for components that just need auth status
 */
export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated);
}

/**
 * Hook to get current user
 */
export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}

/**
 * Hook to check if user is loading
 */
export function useAuthLoading() {
  return useAuthStore((state) => state.isLoading);
}

/**
 * Hook for permission checks
 */
export function usePermissions() {
  const can = useAuthStore((state) => state.can);
  const canAny = useAuthStore((state) => state.canAny);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isOrgAdmin = useAuthStore((state) => state.isOrgAdmin);

  return { can, canAny, isSuperAdmin, isOrgAdmin };
}




