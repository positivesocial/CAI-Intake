"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Key,
  Zap,
  CreditCard,
  Bell,
  Lock,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Search,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Mock platform settings
const DEFAULT_SETTINGS = {
  general: {
    platformName: "CAI Intake",
    supportEmail: "support@cai-intake.io",
    maintenanceMode: false,
    allowSignups: true,
  },
  limits: {
    defaultPlan: "free",
    maxOrganizationsPerUser: 3,
    maxUsersPerOrganization: 50,
    maxCutlistsPerMonth: 100,
    maxPartsPerCutlist: 1000,
  },
  features: {
    voiceDictation: true,
    aiParsing: true,
    templates: true,
    advancedCnc: false,
    learningSystem: true,
    multiFileUpload: true,
  },
  ai: {
    primaryProvider: "anthropic",
    fallbackProvider: "openai",
    maxTokensPerRequest: 8000,
    timeoutSeconds: 30,
  },
  email: {
    provider: "sendgrid",
    host: "smtp.sendgrid.net",
    port: 587,
    fromEmail: "noreply@cai-intake.io",
    fromName: "CAI Intake",
  },
  security: {
    sessionTimeout: 24,
    requireMfa: false,
    ipWhitelist: "",
    auditLogRetention: 90,
  },
};

function ToggleSwitch({ 
  enabled, 
  onChange,
  disabled = false,
}: { 
  enabled: boolean; 
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn(
      "relative inline-flex items-center cursor-pointer",
      disabled && "opacity-50 cursor-not-allowed"
    )}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
    </label>
  );
}

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { user, logout, isSuperAdmin } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = React.useState("general");

  // Redirect if not super admin
  React.useEffect(() => {
    if (!isSuperAdmin()) {
      router.push("/platform/login");
    }
  }, [isSuperAdmin, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/platform/login");
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSaving(false);
  };

  const updateSetting = (category: string, key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...(prev as Record<string, Record<string, unknown>>)[category],
        [key]: value,
      },
    }));
  };

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <p>Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-300" />
                </div>
                <div>
                  <span className="font-bold text-lg">CAI Platform</span>
                  <Badge className="ml-2 bg-purple-500/30 text-purple-200 text-xs">Super Admin</Badge>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/platform/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/platform/organizations">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Building2 className="h-4 w-4 mr-2" />
                    Organizations
                  </Button>
                </Link>
                <Link href="/platform/users">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </Button>
                </Link>
                <Link href="/platform/settings">
                  <Button variant="ghost" size="sm" className="text-white bg-white/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white text-purple-900 hover:bg-white/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-sm font-medium">SA</span>
                    </div>
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
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
          <p className="text-slate-500">Configure system-wide settings and feature flags</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1">
            <TabsTrigger value="general" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Globe className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="limits" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Building2 className="h-4 w-4 mr-2" />
              Limits
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Zap className="h-4 w-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Brain className="h-4 w-4 mr-2" />
              AI Config
            </TabsTrigger>
            <TabsTrigger value="email" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
              <Lock className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Maintenance Mode Warning */}
            <Card className={cn(
              "border-2",
              settings.general.maintenanceMode ? "border-amber-300 bg-amber-50" : "border-slate-200"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className={cn(
                    "h-5 w-5",
                    settings.general.maintenanceMode ? "text-amber-600" : "text-slate-400"
                  )} />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>
                  When enabled, users will see a maintenance page instead of the application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={settings.general.maintenanceMode ? "text-amber-800" : "text-slate-600"}>
                      {settings.general.maintenanceMode
                        ? "⚠️ Platform is currently in maintenance mode"
                        : "Platform is operating normally"}
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.general.maintenanceMode}
                    onChange={(val) => updateSetting("general", "maintenanceMode", val)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Platform Name</label>
                    <Input
                      value={settings.general.platformName}
                      onChange={(e) => updateSetting("general", "platformName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Support Email</label>
                    <Input
                      type="email"
                      value={settings.general.supportEmail}
                      onChange={(e) => updateSetting("general", "supportEmail", e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-medium">Allow New Signups</p>
                    <p className="text-sm text-slate-500">Enable self-service registration for new users</p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.general.allowSignups}
                    onChange={(val) => updateSetting("general", "allowSignups", val)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Limits</CardTitle>
                <CardDescription>Default limits for free/starter plans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Default Plan for New Users</label>
                    <Select
                      value={settings.limits.defaultPlan}
                      onValueChange={(v) => updateSetting("limits", "defaultPlan", v)}
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
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Max Organizations per User</label>
                    <Input
                      type="number"
                      value={settings.limits.maxOrganizationsPerUser}
                      onChange={(e) => updateSetting("limits", "maxOrganizationsPerUser", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Max Users per Organization</label>
                    <Input
                      type="number"
                      value={settings.limits.maxUsersPerOrganization}
                      onChange={(e) => updateSetting("limits", "maxUsersPerOrganization", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Max Cutlists per Month</label>
                    <Input
                      type="number"
                      value={settings.limits.maxCutlistsPerMonth}
                      onChange={(e) => updateSetting("limits", "maxCutlistsPerMonth", Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>Enable or disable features platform-wide</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(settings.features).map(([key, enabled]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div>
                        <p className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={enabled}
                        onChange={(val) => updateSetting("features", key, val)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Config Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Provider Configuration</CardTitle>
                <CardDescription>Configure AI providers for OCR and parsing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Primary Provider</label>
                    <Select
                      value={settings.ai.primaryProvider}
                      onValueChange={(v) => updateSetting("ai", "primaryProvider", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                        <SelectItem value="openai">GPT (OpenAI)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fallback Provider</label>
                    <Select
                      value={settings.ai.fallbackProvider}
                      onValueChange={(v) => updateSetting("ai", "fallbackProvider", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">GPT (OpenAI)</SelectItem>
                        <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Max Tokens per Request</label>
                    <Input
                      type="number"
                      value={settings.ai.maxTokensPerRequest}
                      onChange={(e) => updateSetting("ai", "maxTokensPerRequest", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Timeout (seconds)</label>
                    <Input
                      type="number"
                      value={settings.ai.timeoutSeconds}
                      onChange={(e) => updateSetting("ai", "timeoutSeconds", Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>SMTP settings for transactional emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email Provider</label>
                    <Select
                      value={settings.email.provider}
                      onValueChange={(v) => updateSetting("email", "provider", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                        <SelectItem value="custom">Custom SMTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">SMTP Host</label>
                    <Input
                      value={settings.email.host}
                      onChange={(e) => updateSetting("email", "host", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">From Email</label>
                    <Input
                      type="email"
                      value={settings.email.fromEmail}
                      onChange={(e) => updateSetting("email", "fromEmail", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">From Name</label>
                    <Input
                      value={settings.email.fromName}
                      onChange={(e) => updateSetting("email", "fromName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Test Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Session Timeout (hours)</label>
                    <Input
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => updateSetting("security", "sessionTimeout", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Audit Log Retention (days)</label>
                    <Input
                      type="number"
                      value={settings.security.auditLogRetention}
                      onChange={(e) => updateSetting("security", "auditLogRetention", Number(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-medium">Require MFA for All Users</p>
                    <p className="text-sm text-slate-500">Enforce two-factor authentication</p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.security.requireMfa}
                    onChange={(val) => updateSetting("security", "requireMfa", val)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                    <h4 className="font-medium text-red-800">Clear All Cache</h4>
                    <p className="text-sm text-red-600 mb-3">Clear all cached data</p>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-100">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                    <h4 className="font-medium text-red-800">Reset Database</h4>
                    <p className="text-sm text-red-600 mb-3">Reset all data (dev only)</p>
                    <Button variant="outline" className="border-red-300 text-red-600" disabled>
                      <Database className="h-4 w-4 mr-2" />
                      Reset (Disabled)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

