"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
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
  Cpu,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle, ThemeToggleCompact } from "@/components/ui/theme-toggle";
import { useAuthStore, SUPER_ADMIN_USER, DEMO_USER } from "@/lib/auth/store";
import { ROLE_DISPLAY_NAMES } from "@/lib/auth/roles";
import type { RoleType } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

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
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

const ADMIN_NAV_ITEMS = [
  {
    label: "Operations",
    href: "/settings/operations",
    icon: Cpu,
  },
  {
    label: "Shortcodes",
    href: "/settings/shortcodes",
    icon: Code2,
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setUser, isSuperAdmin, isOrgAdmin } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

  const handleSwitchUser = () => {
    if (user?.isSuperAdmin) {
      setUser(DEMO_USER);
    } else {
      setUser(SUPER_ADMIN_USER);
    }
    setIsUserMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
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
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                >
                  <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
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
                    <div className="p-2">
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-left"
                        onClick={handleSwitchUser}
                      >
                        <Shield className="h-4 w-4" />
                        {user?.isSuperAdmin
                          ? "Switch to Demo User"
                          : "Switch to Super Admin"}
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-left text-red-600"
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
          "fixed left-0 top-16 bottom-0 w-64 bg-[var(--card)] border-r border-[var(--border)] z-40 transition-transform lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                      : "hover:bg-[var(--muted)] text-[var(--foreground)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <Badge variant="teal" className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}

            {/* Admin Section - Only visible to org admins */}
            {user && (isOrgAdmin() || isSuperAdmin()) && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive
                          ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                          : "hover:bg-[var(--muted)] text-[var(--foreground)]"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}

            {/* Platform Admin Section - Only visible to super admins */}
            {isSuperAdmin() && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Platform
                  </p>
                </div>
                {PLATFORM_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border border-purple-200 dark:from-purple-900/30 dark:to-indigo-900/30 dark:text-purple-300 dark:border-purple-700"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                      <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
                        Admin
                      </Badge>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)]">
            {/* Theme Toggle in Sidebar */}
            <ThemeToggleCompact className="w-full mb-2" />
            
            <Link
              href="/help"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Help & Support</span>
            </Link>
            <div className="mt-2 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              <p>CAI Intake v1.0.0</p>
              <p>© 2024 CabinetAI</p>
            </div>
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
      <main className="lg:ml-64 pt-16 min-h-screen">{children}</main>
    </div>
  );
}
