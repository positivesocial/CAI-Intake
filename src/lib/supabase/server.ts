/**
 * CAI Intake - Supabase Server Client
 * 
 * Creates a Supabase client for use in Server Components and API routes.
 * Handles cookie-based auth for server-side rendering.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client for server-side operations
 * Must be called within a Server Component or Route Handler
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Demo mode user for development/testing
 */
const DEMO_USER = {
  id: "demo-user-id",
  email: "admin@acmecabinets.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {
    name: "John Smith",
    organization_id: "demo-org-id",
  },
  created_at: new Date().toISOString(),
};

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 * In demo mode, returns a mock user
 */
export async function getUser() {
  // In demo mode, return a mock user for API routes
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (isDemoMode) {
    return DEMO_USER as unknown as ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>["data"]["user"];
  }
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session
 * Returns null if not authenticated
 */
export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Require authentication - throws redirect to login if not authenticated
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

