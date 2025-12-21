/**
 * CAI Intake - Next.js Middleware
 * 
 * Handles:
 * - Supabase session refresh
 * - Protected route access control
 * - Super admin route protection
 * - Demo mode bypass
 * 
 * Note: The deprecation warning for middleware.ts in Next.js 16 dev mode
 * can be ignored - Vercel's production build still requires middleware.ts
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication (organization members)
const PROTECTED_ROUTES = [
  "/dashboard",
  "/intake",
  "/settings",
  "/materials",
  "/reports",
  "/cutlists",
];

// Platform admin routes (super admin only)
const PLATFORM_ADMIN_ROUTES = [
  "/platform/dashboard",
  "/platform/settings",
  "/platform/organizations",
  "/platform/users",
];

// Platform auth routes
const PLATFORM_AUTH_ROUTES = [
  "/platform/login",
];

// Auth routes (login, signup, etc.)
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
];

// Legacy admin routes - redirect to platform
const LEGACY_ADMIN_ROUTES = [
  "/admin",
];

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  "/",
  "/api/health",
];

export async function middleware(request: NextRequest) {
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

  // Redirect legacy admin routes to platform
  const isLegacyAdminRoute = LEGACY_ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  if (isLegacyAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/admin", "/platform/dashboard");
    return NextResponse.redirect(url);
  }

  // Check for demo mode via cookie or query param
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const hasDemoCookie = request.cookies.get("cai-auth-storage")?.value?.includes('"isAuthenticated":true');
  const isSuperAdminCookie = request.cookies.get("cai-auth-storage")?.value?.includes('"isSuperAdmin":true');
  
  // Check route types
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isPlatformAdminRoute = PLATFORM_ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isPlatformAuthRoute = PLATFORM_AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // In demo mode with valid auth cookie
  if (demoMode && hasDemoCookie) {
    // Platform admin routes require super admin
    if (isPlatformAdminRoute) {
      if (isSuperAdminCookie) {
        return NextResponse.next();
      }
      // Not super admin, redirect to platform login
      const url = request.nextUrl.clone();
      url.pathname = "/platform/login";
      return NextResponse.redirect(url);
    }

    // Regular protected routes
    if (isProtectedRoute) {
      return NextResponse.next();
    }
    
    // Redirect authenticated super admins away from platform auth
    if (isPlatformAuthRoute && isSuperAdminCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/platform/dashboard";
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from regular auth pages
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

