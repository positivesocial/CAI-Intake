"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, SUPER_ADMIN_USER } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

export default function PlatformLoginPage() {
  const router = useRouter();
  const { 
    loginWithEmail,
    loginAsDemo,
    isLoading: authLoading,
    error: authError,
    setError: setAuthError,
    user,
  } = useAuthStore();
  
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isLoading = isSubmitting || authLoading;

  // Check if already logged in as super admin
  React.useEffect(() => {
    if (user?.isSuperAdmin) {
      router.push("/platform/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    
    const result = await loginWithEmail(email, password);
    
    if (result.success) {
      // Check if user is super admin
      // In production, this would be validated server-side
      // For demo, we check the email
      if (email === "super@caiintake.com") {
        router.push("/platform/dashboard");
        router.refresh();
      } else {
        setAuthError("Access denied. Only platform administrators can log in here.");
      }
    }
    
    setIsSubmitting(false);
  };

  const handleDemoLogin = () => {
    setIsSubmitting(true);
    loginAsDemo("super_admin");
    setTimeout(() => {
      router.push("/platform/dashboard");
      router.refresh();
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--cai-navy)] via-[var(--cai-navy)] to-slate-900 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-white/95 backdrop-blur shadow-2xl border-0">
          <CardHeader className="text-center space-y-4 pb-2">
            {/* Platform Admin Logo */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-16 w-16 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-9 w-9 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-[var(--cai-teal)] rounded-full flex items-center justify-center border-2 border-white">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
            </div>
            <div>
              <Badge className="bg-purple-100 text-purple-700 mb-2">Platform Administration</Badge>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Super Admin Portal
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                CAI Intake System Administration
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Warning banner */}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Restricted Access</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  This portal is for platform administrators only. 
                  Regular users should use the <a href="/login" className="underline">standard login</a>.
                </p>
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="super@caiintake.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-slate-300"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-slate-300"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Access Platform Admin
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Access */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <Card className="border-2 border-dashed border-purple-300/50 bg-purple-900/20 backdrop-blur">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white flex items-center gap-2">
                  <span className="text-lg">🔧</span>
                  Demo Super Admin
                </span>
                <Badge variant="outline" className="border-purple-400 text-purple-300 text-xs">
                  Development
                </Badge>
              </div>
              <Button
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
                variant="outline"
              >
                <Shield className="mr-2 h-4 w-4" />
                Login as Demo Super Admin
              </Button>
              <p className="text-xs text-purple-300 mt-2 text-center">
                Credentials: super@caiintake.com / SuperAdmin123!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Back to regular login */}
        <div className="text-center">
          <a 
            href="/login" 
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            ← Back to regular login
          </a>
        </div>
      </div>
    </div>
  );
}




