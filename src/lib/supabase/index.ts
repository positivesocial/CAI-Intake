/**
 * CAI Intake - Supabase Module
 * 
 * Exports all Supabase utilities.
 */

export { createClient, getClient } from "./client";
export { createClient as createServerClient, getUser, getSession, requireAuth } from "./server";
export { updateSession } from "./middleware";
export type * from "./types";



