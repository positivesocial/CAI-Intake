/**
 * CAI Intake - Next.js Middleware
 * 
 * In demo mode (NEXT_PUBLIC_DEMO_MODE=true), all routes are allowed.
 * Auth is handled client-side via Zustand store (localStorage).
 * 
 * In production mode, Supabase session is checked server-side.
 */

import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // In demo mode, skip server-side auth checks
  // Client-side will handle auth via Zustand store
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (demoMode) {
    return NextResponse.next();
  }

  // Production mode: Use Supabase session auth
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("Middleware error:", error);
    // If middleware fails, allow the request to proceed
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes (let them handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
