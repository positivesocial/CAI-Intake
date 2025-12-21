/**
 * CAI Intake - Next.js Proxy
 * 
 * Next.js 16+ uses proxy.ts instead of middleware.ts
 * 
 * Handles:
 * - Supabase session refresh
 * - Protected route access control
 * - Super admin route protection
 * - Demo mode bypass
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/intake",
  "/settings",
  "/materials",
  "/reports",
  "/cutlists",
];

// Routes that require super admin
const SUPER_ADMIN_ROUTES = [
  "/admin",
];

// Auth routes (login, signup, etc.)
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
];

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  "/",
  "/api/health",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes to handle their own auth
  if (pathname.startsWith("/api/")) {
    // Webhooks bypass auth
    if (pathname.startsWith("/api/webhooks/")) {
      return NextResponse.next();
    }
    
    // Auth API routes bypass session check
    if (pathname.startsWith("/api/v1/auth/")) {
      return NextResponse.next();
    }
    
    // Other API routes - let them handle auth themselves
    return NextResponse.next();
  }

  // Static files and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".") // files with extensions
  ) {
    return NextResponse.next();
  }

  // Check for demo mode via cookie or query param
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const hasDemoCookie = request.cookies.get("cai-auth-storage")?.value?.includes('"isAuthenticated":true');
  
  // In demo mode with valid auth cookie, skip Supabase check for protected routes
  if (demoMode && hasDemoCookie) {
    const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
    const isSuperAdminRoute = SUPER_ADMIN_ROUTES.some((route) => pathname.startsWith(route));
    
    if (isProtectedRoute || isSuperAdminRoute) {
      // Allow access - demo mode with valid session
      return NextResponse.next();
    }
    
    // Redirect authenticated users away from auth pages
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Run Supabase session update
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

