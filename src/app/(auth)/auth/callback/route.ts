/**
 * CAI Intake - Auth Callback Route
 * 
 * Handles OAuth callbacks and email confirmation links.
 * Redirects super admins to platform dashboard, regular users to org dashboard.
 */

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const explicitRedirect = requestUrl.searchParams.get("redirectTo");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user) {
      // Check if user is a super admin
      let redirectPath = explicitRedirect ?? "/dashboard";
      
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: data.user.id },
          select: { isSuperAdmin: true, organizationId: true },
        });
        
        // Super admins without an org go to platform dashboard
        if (dbUser?.isSuperAdmin && !dbUser?.organizationId && !explicitRedirect) {
          redirectPath = "/platform/dashboard";
        }
      } catch (e) {
        // If DB check fails, just use default redirect
        console.error("Failed to check user type:", e);
      }
      
      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  // Return to login with error
  return NextResponse.redirect(
    new URL("/login?error=Unable to verify authentication", requestUrl.origin)
  );
}





