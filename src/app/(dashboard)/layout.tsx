"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Shield,
  Menu,
  X,
  Plus,
  Bell,
  Layers,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle, ThemeToggleCompact } from "@/components/ui/theme-toggle";
import { useAuthStore } from "@/lib/auth/store";
import { ROLE_DISPLAY_NAMES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { SubscriptionProvider, useSubscription } from "@/lib/subscriptions/hooks";
import { CommandPalette } from "@/components/ui/command-palette";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Intake",
    href: "/intake",
    icon: Plus,
    badge: "New",
  },
  {
    label: "Cutlists",
    href: "/cutlists",
    icon: FolderOpen,
  },
  {
    label: "Materials",
    href: "/materials",
    icon: Layers,
  },
];

const PLATFORM_NAV_ITEMS = [
  {
    label: "Platform Admin",
    href: "/platform/dashboard",
    icon: Shield,
    external: true, // Opens in new context
  },
];

// Subscription badge component
function SubscriptionBadge() {
  const { planName, isLoading, isTrial, trialDaysRemaining, isPaid } = useSubscription();
  
  if (isLoading) return null;
  
  return (
    <div className="px-4 py-3 border-t border-[var(--border)]">
      <Link 
        href="/settings/billing"
        className="block p-3 rounded-lg bg-gradient-to-r from-[var(--cai-teal)]/5 to-[var(--cai-teal)]/10 hover:from-[var(--cai-teal)]/10 hover:to-[var(--cai-teal)]/20 transition-colors"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Plan</span>
          {isTrial && (
            <Badge variant="warning" className="text-xs">
              Trial: {trialDaysRemaining}d
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{planName}</span>
          {!isPaid && (
            <Badge variant="teal" className="text-xs">Upgrade</Badge>
          )}
        </div>
      </Link>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, isSuperAdmin } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Load collapsed state from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  // Wait for client-side mount to avoid SSR/hydration issues
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Toggle sidebar collapsed state
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!mounted) return;
    
    // Give persist middleware time to hydrate (500ms is safer)
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.push(`/login?redirectTo=${encodeURIComponent(pathname)}`);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [mounted, isAuthenticated, router, pathname]);

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    router.push("/login");
  };

  // Show loading state while hydrating (only briefly needed)
  if (!mounted) {
    return null; // Render nothing during SSR
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Command Palette (⌘K) */}
      <CommandPalette />

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-[var(--card)] border-b border-[var(--border)] z-50">
        <div className="h-full flex items-center justify-between px-4">
          {/* Left: Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 hover:bg-[var(--muted)] rounded-lg"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--cai-teal)] flex items-center justify-center">
                {/* Document/Grid icon - distinct from hamburger menu */}
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                >
                  <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                </svg>
              </div>
              <span className="font-bold text-lg hidden sm:block">
                CAI Intake
              </span>
            </Link>
          </div>

          {/* Right: Actions & User */}
          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            <Link href="/intake" className="hidden sm:block">
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Cutlist
              </Button>
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <button className="p-2 hover:bg-[var(--muted)] rounded-lg relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-1.5 hover:bg-[var(--muted)] rounded-lg"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-[var(--cai-teal)]">
                    {user?.name?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-none">
                    {user?.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {user?.organization?.name || "Super Admin"}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 hidden md:block" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card)] rounded-lg shadow-lg border border-[var(--border)] z-50">
                    <div className="p-3 border-b border-[var(--border)]">
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {user?.email}
                      </p>
                      {user?.role && (
                        <Badge variant="secondary" className="mt-2">
                          {ROLE_DISPLAY_NAMES[
                            user.role.name as keyof typeof ROLE_DISPLAY_NAMES
                          ] || user.role.displayName}
                        </Badge>
                      )}
                      {user?.isSuperAdmin && (
                        <Badge variant="teal" className="mt-2">
                          Super Admin
                        </Badge>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Account Settings
                      </Link>
                      <Link
                        href="/help"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <HelpCircle className="h-4 w-4" />
                        Help & Support
                      </Link>
                    </div>
                    <div className="p-2 border-t border-[var(--border)]">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left text-red-600"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 bottom-0 bg-[var(--card)] border-r border-[var(--border)] z-40 transition-all duration-300 ease-in-out lg:translate-x-0",
          isCollapsed ? "lg:w-16" : "lg:w-64",
          "w-64", // Always full width on mobile
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Collapse Toggle - Desktop Only */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 items-center justify-center bg-[var(--card)] border border-[var(--border)] rounded-full shadow-sm hover:bg-[var(--muted)] transition-colors z-10"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Nav Items */}
          <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-4")}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg transition-colors relative group",
                    isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                      : "hover:bg-[var(--muted)] text-[var(--foreground)]"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <Badge variant="teal" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--popover)] text-[var(--popover-foreground)] text-sm rounded-md shadow-lg border border-[var(--border)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                      {item.label}
                      {item.badge && (
                        <Badge variant="teal" className="ml-2 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Platform Admin Section - Only visible to super admins */}
            {isSuperAdmin() && (
              <>
                {!isCollapsed && (
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Platform
                    </p>
                  </div>
                )}
                {isCollapsed && <div className="pt-2 border-t border-[var(--border)] mt-2" />}
                {PLATFORM_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center rounded-lg transition-colors bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border border-purple-200 dark:from-purple-900/30 dark:to-indigo-900/30 dark:text-purple-300 dark:border-purple-700 relative group",
                        isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="font-medium">{item.label}</span>
                          <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
                            Admin
                          </Badge>
                        </>
                      )}
                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--popover)] text-[var(--popover-foreground)] text-sm rounded-md shadow-lg border border-[var(--border)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.label}
                          <Badge className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
                            Admin
                          </Badge>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Subscription Info - Hidden when collapsed */}
          {!isCollapsed && <SubscriptionBadge />}

          {/* Footer */}
          <div className={cn(
            "border-t border-[var(--border)]",
            isCollapsed ? "p-2" : "p-4"
          )}>
            {/* Theme Toggle in Sidebar - Hidden when collapsed */}
            {!isCollapsed && <ThemeToggleCompact className="w-full mb-2" />}
            
            <Link
              href="/help"
              title={isCollapsed ? "Help & Support" : undefined}
              className={cn(
                "flex items-center rounded-lg hover:bg-[var(--muted)] transition-colors relative group",
                isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              )}
            >
              <HelpCircle className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">Help & Support</span>}
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--popover)] text-[var(--popover-foreground)] text-sm rounded-md shadow-lg border border-[var(--border)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  Help & Support
                </div>
              )}
            </Link>
            {!isCollapsed && (
              <div className="mt-2 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                <p>CAI Intake v1.0.0</p>
                <p>© 2024 CabinetAI</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "pt-16 min-h-screen transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </main>
    </div>
  );
}
