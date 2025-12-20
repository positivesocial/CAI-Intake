"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, Shield, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore, TEST_CREDENTIALS } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const { loginAsDemo, setUser } = useAuthStore();
  
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showDemoOptions, setShowDemoOptions] = React.useState(true);
  
  // Lazy initialize supabase client
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Check for test credentials first
    const testCred = TEST_CREDENTIALS[email as keyof typeof TEST_CREDENTIALS];
    if (testCred && testCred.password === password) {
      setUser(testCred.user);
      router.push(redirectTo);
      router.refresh();
      setIsLoading(false);
      return;
    }
    
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Try demo login below.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (userType: "super_admin" | "org_admin" | "operator") => {
    setIsLoading(true);
    loginAsDemo(userType);
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 100);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${redirectTo}`,
        },
      });
      
      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    } catch {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for a password reset link");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (emailValue: string, passwordValue: string) => {
    setEmail(emailValue);
    setPassword(passwordValue);
    setShowDemoOptions(false);
  };

  return (
    <div className="w-full max-w-md space-y-4">
      <Card>
        <CardHeader className="text-center space-y-4">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-gradient-to-br from-[var(--cai-teal)] to-[var(--cai-navy)] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">CAI</span>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Sign in to your CAI Intake account
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[var(--cai-teal)] hover:underline"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--card)] px-2 text-[var(--muted-foreground)]">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>

          <p className="text-center text-sm text-[var(--muted-foreground)]">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="text-[var(--cai-teal)] font-medium hover:underline"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Demo Login Options */}
      <Card className="border-dashed border-2 border-[var(--cai-teal)]/30 bg-[var(--cai-teal)]/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🧪</span>
              Test Accounts
            </CardTitle>
            <Badge variant="outline" className="text-xs">Demo Mode</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Click to log in instantly or use the credentials in the form above:
          </p>
          
          <div className="grid gap-2">
            {/* Super Admin */}
            <button
              type="button"
              onClick={() => handleDemoLogin("super_admin")}
              disabled={isLoading}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors text-left",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Super Admin</span>
                  <Badge className="text-xs bg-purple-100 text-purple-700">Platform</Badge>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  super@caiintake.com
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fillCredentials("super@caiintake.com", "SuperAdmin123!");
                }}
                className="text-xs text-[var(--cai-teal)] hover:underline shrink-0"
              >
                Copy creds
              </button>
            </button>

            {/* Org Admin */}
            <button
              type="button"
              onClick={() => handleDemoLogin("org_admin")}
              disabled={isLoading}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors text-left",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Org Admin</span>
                  <Badge className="text-xs bg-blue-100 text-blue-700">Acme Cabinets</Badge>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  admin@acmecabinets.com
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fillCredentials("admin@acmecabinets.com", "OrgAdmin123!");
                }}
                className="text-xs text-[var(--cai-teal)] hover:underline shrink-0"
              >
                Copy creds
              </button>
            </button>

            {/* Operator */}
            <button
              type="button"
              onClick={() => handleDemoLogin("operator")}
              disabled={isLoading}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors text-left",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Operator</span>
                  <Badge className="text-xs bg-green-100 text-green-700">Acme Cabinets</Badge>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  operator@acmecabinets.com
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fillCredentials("operator@acmecabinets.com", "Operator123!");
                }}
                className="text-xs text-[var(--cai-teal)] hover:underline shrink-0"
              >
                Copy creds
              </button>
            </button>
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)]">
              <strong>Test Passwords:</strong><br />
              Super Admin: <code className="bg-[var(--muted)] px-1 rounded">SuperAdmin123!</code><br />
              Org Admin: <code className="bg-[var(--muted)] px-1 rounded">OrgAdmin123!</code><br />
              Operator: <code className="bg-[var(--muted)] px-1 rounded">Operator123!</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md animate-pulse">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-32 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background)] to-[var(--muted)] p-4">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
