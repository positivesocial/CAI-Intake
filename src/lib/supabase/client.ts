/**
 * CAI Intake - Supabase Browser Client
 * 
 * Creates a Supabase client for use in client components.
 * This client handles authentication state and real-time subscriptions.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Create a Supabase client for browser-side operations
 * Uses environment variables for configuration
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n" +
      "Check your Supabase project's API settings to find these values\n\n" +
      "https://supabase.com/dashboard/project/_/settings/api"
    );
  }
  
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Singleton client for use in React components
 * Reuses the same client instance across the app
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getClient() {
  // Only create client in browser environment
  if (typeof window === "undefined") {
    // Return a mock during server-side rendering/prerendering
    // The actual client will be created on the client side
    return null as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }
  
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

