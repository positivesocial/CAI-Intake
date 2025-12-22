/**
 * CAI Intake - Auth Callback Route
 * 
 * Handles OAuth callbacks and email confirmation links.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    }
  }

  // Return to login with error
  return NextResponse.redirect(
    new URL("/login?error=Unable to verify authentication", requestUrl.origin)
  );
}




