"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  ArrowLeft,
  Shield,
  Globe,
  Users,
  Building2,
  ToggleLeft,
  AlertTriangle,
  Save,
  RefreshCw,
  Database,
  Server,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore, DEMO_USER } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Mock platform settings
const DEFAULT_PLATFORM_SETTINGS = {
  maintenanceMode: false,
  allowSignups: true,
  defaultPlan: "free",
  maxOrganizationsPerUser: 3,
  maxUsersPerOrganization: 50,
  featureFlags: {
    voiceDictation: true,
    aiParsing: true,
    templates: true,
    advancedCnc: false,
  },
  smtp: {
    host: "smtp.sendgrid.net",
    port: 587,
    fromEmail: "noreply@caiintake.com",
  },
};

export default function PlatformSettingsPage() {
  const { user, setUser, isSuperAdmin } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [settings, setSettings] = React.useState(DEFAULT_PLATFORM_SETTINGS);

  // Check permissions
  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-16 w-16 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Super Admin Required</h2>
            <p className="text-[var(--muted-foreground)] mb-6">
              Only platform administrators can access these settings.
            </p>
            <Link href="/admin">
              <Button variant="primary">Back to Admin Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSaving(false);
  };

  const updateSetting = (path: string, value: unknown) => {
    setSettings((prev) => {
      const keys = path.split(".");
      const newSettings = { ...prev };
      let current: Record<string, unknown> = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const handleSwitchToDemo = () => {
    setUser(DEMO_USER);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--cai-navy)] text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Platform Settings</h1>
                <p className="text-white/70">
                  Configure system-wide settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={handleSwitchToDemo}
              >
                Exit Admin Mode
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white text-[var(--cai-navy)] hover:bg-white/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                Maintenance Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-800">
                    {settings.maintenanceMode
                      ? "Platform is in maintenance mode"
                      : "Platform is operating normally"}
                  </p>
                  <p className="text-sm text-amber-600">
                    When enabled, users will see a maintenance page
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.maintenanceMode}
                    onChange={(e) =>
                      updateSetting("maintenanceMode", e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-amber-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Signup Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div>
                  <p className="font-medium">Allow New Signups</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Enable self-service registration
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.allowSignups}
                    onChange={(e) =>
                      updateSetting("allowSignups", e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Default Plan for New Users
                </label>
                <Select
                  value={settings.defaultPlan}
                  onValueChange={(v) => updateSetting("defaultPlan", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Resource Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Max Organizations per User
                </label>
                <Input
                  type="number"
                  value={settings.maxOrganizationsPerUser}
                  onChange={(e) =>
                    updateSetting(
                      "maxOrganizationsPerUser",
                      Number(e.target.value)
                    )
                  }
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  How many organizations a single user can create
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Max Users per Organization
                </label>
                <Input
                  type="number"
                  value={settings.maxUsersPerOrganization}
                  onChange={(e) =>
                    updateSetting(
                      "maxUsersPerOrganization",
                      Number(e.target.value)
                    )
                  }
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Default limit for free/starter plans
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ToggleLeft className="h-5 w-5" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(settings.featureFlags).map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={enabled}
                      onChange={(e) =>
                        updateSetting(`featureFlags.${key}`, e.target.checked)
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    SMTP Host
                  </label>
                  <Input
                    value={settings.smtp.host}
                    onChange={(e) => updateSetting("smtp.host", e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    SMTP Port
                  </label>
                  <Input
                    type="number"
                    value={settings.smtp.port}
                    onChange={(e) =>
                      updateSetting("smtp.port", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    From Email
                  </label>
                  <Input
                    type="email"
                    value={settings.smtp.fromEmail}
                    onChange={(e) =>
                      updateSetting("smtp.fromEmail", e.target.value)
                    }
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="lg:col-span-2 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                  <h4 className="font-medium text-red-800">Clear All Cache</h4>
                  <p className="text-sm text-red-600 mb-3">
                    Clear all cached data across the platform
                  </p>
                  <Button variant="outline" className="border-red-300 text-red-600">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear Cache
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                  <h4 className="font-medium text-red-800">Reset Database</h4>
                  <p className="text-sm text-red-600 mb-3">
                    Reset all data (development only)
                  </p>
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-600"
                    disabled
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Reset (Disabled)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

