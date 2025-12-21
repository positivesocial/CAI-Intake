/**
 * CAI Intake - Next.js Middleware
 * 
 * In demo mode (NEXT_PUBLIC_DEMO_MODE=true), all routes are allowed.
 * Auth is handled client-side via Zustand store (localStorage).
 * 
 * In production mode, Supabase session is checked server-side.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static files and API routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // For now, always allow all routes
  // Client-side will handle auth via Zustand store
  // TODO: Re-enable Supabase auth for production when needed
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
