/**
 * CAI Intake - Supabase Session Handler
 * 
 * Updates Supabase auth session on every request.
 * This ensures the session cookie stays fresh.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Update the Supabase auth session
 * Call this in your proxy.ts (Next.js 16+)
 */
export async function updateSession(request: NextRequest) {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // If Supabase is not configured, skip auth checks and allow the request
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase not configured - skipping auth middleware");
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect to login if accessing protected routes without auth
    const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard") ||
                            request.nextUrl.pathname.startsWith("/intake") ||
                            request.nextUrl.pathname.startsWith("/settings") ||
                            request.nextUrl.pathname.startsWith("/admin") ||
                            request.nextUrl.pathname.startsWith("/materials") ||
                            request.nextUrl.pathname.startsWith("/reports");
    
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
                        request.nextUrl.pathname.startsWith("/signup");

    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Redirect to dashboard if accessing auth routes while logged in
    if (isAuthRoute && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Middleware auth error:", error);
    // On error, allow the request to proceed
    return NextResponse.next({ request });
  }
}
