"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Activity,
  ListOrdered,
  DollarSign,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Search,
  Bell,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/organizations", label: "Organizations", icon: Building2 },
  { href: "/platform/analytics", label: "Analytics", icon: Activity },
  { href: "/platform/training", label: "AI Training", icon: Brain },
  { href: "/platform/plans", label: "Plans", icon: ListOrdered },
  { href: "/platform/revenue", label: "Revenue", icon: DollarSign },
  { href: "/platform/settings", label: "Settings", icon: Settings },
];

interface PlatformHeaderProps {
  title?: string;
  description?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
}

export function PlatformHeader({ title, description, showSearch = true, showNotifications = true }: PlatformHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push("/platform/login");
  };

  return (
    <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <Link href="/platform/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <span className="font-bold text-lg">CAI Platform</span>
                <Badge className="ml-2 bg-purple-500/30 text-purple-200 text-xs">Super Admin</Badge>
              </div>
            </Link>
            
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-white/80 hover:text-white hover:bg-white/10",
                        isActive && "text-white bg-white/10"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {showSearch && (
              <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-white/50" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-transparent border-none text-sm text-white placeholder:text-white/50 focus:outline-none w-40"
                />
              </div>
            )}
            
            {showNotifications && (
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-sm font-medium">SA</span>
                  </div>
                  <span className="hidden md:inline text-sm">{user?.name || "Super Admin"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name || "Super Admin"}</span>
                    <span className="text-xs text-slate-500">{user?.email || "super@cai-intake.io"}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/platform/training">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Training
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/platform/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Platform Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    User Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="lg:hidden border-t border-white/10 overflow-x-auto">
        <nav className="flex items-center gap-1 px-4 py-2 min-w-max">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-white/80 hover:text-white hover:bg-white/10 whitespace-nowrap",
                    isActive && "text-white bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

