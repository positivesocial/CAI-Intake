"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  ArrowLeft,
  Camera,
  Save,
  Palette,
  Globe,
  Ruler,
  Calendar,
  ToggleLeft,
  Layers,
  Webhook,
  Key,
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
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Default organization settings
const DEFAULT_ORG_SETTINGS = {
  // General
  timezone: "America/New_York",
  date_format: "YYYY-MM-DD",
  default_units: "mm" as const,

  // Cutlist defaults
  default_thickness_mm: 18,
  default_grain: "none" as const,
  auto_optimize: false,

  // Capabilities
  enable_edging: true,
  enable_grooves: false,
  enable_cnc_holes: false,
  enable_cnc_routing: false,

  // Branding
  primary_color: "#0D9488",

  // Integrations
  webhook_url: "",
};

export default function OrganizationSettingsPage() {
  const { user, isOrgAdmin } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState(DEFAULT_ORG_SETTINGS);
  const [orgName, setOrgName] = React.useState(user?.organization?.name || "");
  const [orgSlug, setOrgSlug] = React.useState(user?.organization?.slug || "");

  // Fetch settings on mount
  React.useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/v1/organizations/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings(prev => ({ ...prev, ...data.settings }));
            setOrgName(data.settings.name || user?.organization?.name || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [user?.organization?.name]);

  // Check permissions
  if (!isOrgAdmin()) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-16 w-16 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-[var(--muted-foreground)] mb-6">
              You don&apos;t have permission to access organization settings.
            </p>
            <Link href="/settings">
              <Button variant="primary">Back to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch("/api/v1/organizations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          ...settings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Organization Settings</h1>
                <p className="text-[var(--muted-foreground)]">
                  Configure {user?.organization?.name} settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="teal">{user?.organization?.plan}</Badge>
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg bg-[var(--muted)] flex items-center justify-center relative group cursor-pointer">
                  {user?.organization?.logo ? (
                    <img
                      src={user.organization.logo}
                      alt=""
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-[var(--muted-foreground)]" />
                  )}
                  <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <Button variant="outline" size="sm">
                    Upload Logo
                  </Button>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    PNG, JPG or SVG. Max 1MB.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Organization Name
                </label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your organization name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Organization Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)]">cai-intake.io/</span>
                  <Input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="your-org"
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Timezone</label>
                <Select
                  value={settings.timezone}
                  onValueChange={(v) => updateSetting("timezone", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">
                      Eastern Time (ET)
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      Central Time (CT)
                    </SelectItem>
                    <SelectItem value="America/Denver">
                      Mountain Time (MT)
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      Pacific Time (PT)
                    </SelectItem>
                    <SelectItem value="Europe/London">
                      London (GMT)
                    </SelectItem>
                    <SelectItem value="Europe/Paris">
                      Paris (CET)
                    </SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Date Format
                </label>
                <Select
                  value={settings.date_format}
                  onValueChange={(v) => updateSetting("date_format", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">2024-01-15</SelectItem>
                    <SelectItem value="DD/MM/YYYY">15/01/2024</SelectItem>
                    <SelectItem value="MM/DD/YYYY">01/15/2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Default Units
                </label>
                <Select
                  value={settings.default_units}
                  onValueChange={(v) => updateSetting("default_units", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">Millimeters (mm)</SelectItem>
                    <SelectItem value="inches">Inches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cutlist Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Cutlist Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Default Thickness (mm)
                </label>
                <Input
                  type="number"
                  value={settings.default_thickness_mm}
                  onChange={(e) =>
                    updateSetting("default_thickness_mm", Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Default Grain Direction
                </label>
                <Select
                  value={settings.default_grain}
                  onValueChange={(v) => updateSetting("default_grain", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grain</SelectItem>
                    <SelectItem value="along_L">Along Length</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                <div>
                  <p className="font-medium">Auto-Optimize</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Automatically optimize after cutlist creation
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.auto_optimize}
                    onChange={(e) =>
                      updateSetting("auto_optimize", e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  id: "enable_edging",
                  label: "Edge Banding",
                  description: "Track edge banding requirements",
                },
                {
                  id: "enable_grooves",
                  label: "Grooves & Dados",
                  description: "Define groove operations",
                },
                {
                  id: "enable_cnc_holes",
                  label: "CNC Hole Patterns",
                  description: "Specify hole locations and patterns",
                },
                {
                  id: "enable_cnc_routing",
                  label: "CNC Routing",
                  description: "Define routing profiles and paths",
                },
              ].map((cap) => (
                <div
                  key={cap.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]"
                >
                  <div>
                    <p className="font-medium">{cap.label}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {cap.description}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings[cap.id as keyof typeof settings] as boolean}
                      onChange={(e) => updateSetting(cap.id, e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting("primary_color", e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => updateSetting("primary_color", e.target.value)}
                    placeholder="#0D9488"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Used in exported PDFs and templates
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Webhook URL
                </label>
                <Input
                  value={settings.webhook_url}
                  onChange={(e) => updateSetting("webhook_url", e.target.value)}
                  placeholder="https://your-server.com/webhook"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Receive notifications when cutlists are completed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={settings.apiKey}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Use this key to authenticate API requests
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

