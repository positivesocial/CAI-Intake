"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Building2,
  Settings,
  Bell,
  Shield,
  Palette,
  Users,
  Key,
  ChevronRight,
  Camera,
  Mail,
  Phone,
  Briefcase,
  LogOut,
  Sparkles,
  Cpu,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Check,
  Wrench,
  Code2,
  CreditCard,
} from "lucide-react";
import { useTheme } from "next-themes";
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
import { useIntakeStore } from "@/lib/store";
import { ROLE_DISPLAY_NAMES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const SETTINGS_SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
    description: "Manage your personal information",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    description: "Subscription and payment settings",
    adminOnly: true,
    href: "/settings/billing",
  },
  {
    id: "ai",
    label: "AI Parsing",
    icon: Sparkles,
    description: "AI provider and parsing settings",
  },
  {
    id: "operations",
    label: "Operations Library",
    icon: Wrench,
    description: "Hole patterns, grooves, and routing profiles",
    adminOnly: true,
    href: "/settings/operations",
  },
  {
    id: "shortcodes",
    label: "Shortcodes",
    icon: Code2,
    description: "Configure shortcode mappings for parsing",
    adminOnly: true,
    href: "/settings/shortcodes",
  },
  {
    id: "organization",
    label: "Organization",
    icon: Building2,
    description: "Organization settings and branding",
    adminOnly: true,
  },
  {
    id: "team",
    label: "Team Members",
    icon: Users,
    description: "Manage users and roles",
    adminOnly: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Email and push notification preferences",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme and display settings",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Password and authentication",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateUser, updatePreferences, updateNotifications, logout, setUser, isOrgAdmin } =
    useAuthStore();
  const { aiSettings, setAISettings, setAIProvider } = useIntakeStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeSection, setActiveSection] = React.useState("profile");
  const [isSaving, setIsSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Avoid hydration mismatch for theme
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Form states
  const [profileForm, setProfileForm] = React.useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    jobTitle: user?.jobTitle || "",
  });

  const handleProfileSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    updateUser(profileForm);
    setIsSaving(false);
  };

  const visibleSections = SETTINGS_SECTIONS.filter(
    (s) => !s.adminOnly || isOrgAdmin()
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-[var(--muted-foreground)]">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {visibleSections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                          activeSection === section.id
                            ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                            : "hover:bg-[var(--muted)]"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{section.label}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* User Info Card */}
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[var(--cai-teal)]/20 mx-auto flex items-center justify-center mb-3">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || ""}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-[var(--cai-teal)]">
                        {user?.name?.charAt(0) || "U"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{user?.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {user?.email}
                  </p>
                  {user?.role && (
                    <Badge variant="secondary" className="mt-2">
                      {ROLE_DISPLAY_NAMES[user.role.name as keyof typeof ROLE_DISPLAY_NAMES] ||
                        user.role.displayName}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Profile Section */}
            {activeSection === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-[var(--muted)] flex items-center justify-center relative group cursor-pointer">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-[var(--muted-foreground)]">
                          {user?.name?.charAt(0) || "U"}
                        </span>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" size="sm">
                        Change Photo
                      </Button>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        JPG, PNG or GIF. Max 2MB.
                      </p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                        <Input
                          value={profileForm.name}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, name: e.target.value })
                          }
                          className="pl-10"
                          placeholder="Your name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                        <Input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, email: e.target.value })
                          }
                          className="pl-10"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                        <Input
                          value={profileForm.phone}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, phone: e.target.value })
                          }
                          className="pl-10"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Job Title
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                        <Input
                          value={profileForm.jobTitle}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              jobTitle: e.target.value,
                            })
                          }
                          className="pl-10"
                          placeholder="e.g., Workshop Manager"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      variant="primary"
                      onClick={handleProfileSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications Section */}
            {activeSection === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {[
                      {
                        id: "email",
                        label: "Email Notifications",
                        description: "Receive updates via email",
                      },
                      {
                        id: "push",
                        label: "Push Notifications",
                        description: "Receive browser push notifications",
                      },
                      {
                        id: "cutlistComplete",
                        label: "Cutlist Complete",
                        description: "When optimization finishes",
                      },
                      {
                        id: "parseJobComplete",
                        label: "Parse Job Complete",
                        description: "When file parsing finishes",
                      },
                      {
                        id: "weeklyDigest",
                        label: "Weekly Digest",
                        description: "Summary of weekly activity",
                      },
                    ].map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]"
                      >
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {item.description}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={
                              user?.notifications?.[
                                item.id as keyof typeof user.notifications
                              ] ?? false
                            }
                            onChange={(e) =>
                              updateNotifications({
                                [item.id]: e.target.checked,
                              })
                            }
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Appearance Section */}
            {activeSection === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "light", label: "Light", icon: Sun, preview: "bg-white border border-gray-200" },
                        { value: "dark", label: "Dark", icon: Moon, preview: "bg-gray-900" },
                        { value: "system", label: "System", icon: Monitor, preview: "bg-gradient-to-br from-white to-gray-900" },
                      ].map((themeOption) => {
                        const Icon = themeOption.icon;
                        const isActive = mounted && theme === themeOption.value;
                        return (
                          <button
                            key={themeOption.value}
                            onClick={() => setTheme(themeOption.value)}
                            className={cn(
                              "p-4 rounded-lg border-2 text-center transition-all relative",
                              isActive
                                ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/10"
                                : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                            )}
                          >
                            {isActive && (
                              <div className="absolute top-2 right-2">
                                <Check className="h-4 w-4 text-[var(--cai-teal)]" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center",
                                themeOption.preview
                              )}
                            >
                              <Icon className={cn(
                                "h-6 w-6",
                                themeOption.value === "light" ? "text-yellow-500" :
                                themeOption.value === "dark" ? "text-blue-200" :
                                "text-gray-500"
                              )} />
                            </div>
                            <span className="capitalize font-medium">{themeOption.label}</span>
                            {themeOption.value === "system" && mounted && (
                              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                Currently: {resolvedTheme}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Default Units
                      </label>
                      <Select
                        value={user?.preferences?.defaultUnits || "mm"}
                        onValueChange={(v) =>
                          updatePreferences({
                            defaultUnits: v as "mm" | "inches",
                          })
                        }
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

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Date Format
                      </label>
                      <Select
                        value={user?.preferences?.dateFormat || "YYYY-MM-DD"}
                        onValueChange={(v) => updatePreferences({ dateFormat: v })}
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
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                    <div>
                      <p className="font-medium">Advanced Mode</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Show all features and detailed options
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={user?.preferences?.advancedMode ?? false}
                        onChange={(e) =>
                          updatePreferences({ advancedMode: e.target.checked })
                        }
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Section */}
            {activeSection === "security" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-[var(--muted)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium">Change Password</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          Update your account password
                        </p>
                      </div>
                      <Button variant="outline">
                        <Key className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-[var(--muted)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          Add an extra layer of security
                        </p>
                      </div>
                      <Badge variant="secondary">Not Enabled</Badge>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>

                  <div className="p-4 rounded-lg bg-[var(--muted)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Active Sessions</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          Manage devices where you're logged in
                        </p>
                      </div>
                      <Button variant="outline">View Sessions</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Parsing Section */}
            {activeSection === "ai" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[var(--cai-gold)]" />
                    AI Parsing Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      AI Provider
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "openai", name: "OpenAI", model: "GPT-4o" },
                        { id: "anthropic", name: "Anthropic", model: "Claude 3.5 Sonnet" },
                      ].map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setAIProvider(provider.id as "openai" | "anthropic")}
                          className={cn(
                            "p-4 rounded-lg border-2 text-left transition-colors",
                            aiSettings.provider === provider.id
                              ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/10"
                              : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                          )}
                        >
                          <p className="font-semibold">{provider.name}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {provider.model}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key Input */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      API Key
                    </label>
                    <p className="text-xs text-[var(--muted-foreground)] mb-2">
                      Your API key is stored locally in your browser and sent directly to the AI provider.
                    </p>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="pl-10 pr-10 font-mono"
                        placeholder={aiSettings.provider === "openai" ? "sk-..." : "sk-ant-..."}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">
                      Get your API key from{" "}
                      {aiSettings.provider === "openai" ? (
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--cai-teal)] hover:underline"
                        >
                          OpenAI Platform
                        </a>
                      ) : (
                        <a
                          href="https://console.anthropic.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--cai-teal)] hover:underline"
                        >
                          Anthropic Console
                        </a>
                      )}
                    </p>
                  </div>

                  {/* Default Parser Mode */}
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Default Parser Mode
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setAISettings({ defaultParserMode: "simple" })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors",
                          aiSettings.defaultParserMode === "simple"
                            ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/10"
                            : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                        )}
                      >
                        <Cpu className="h-4 w-4" />
                        <span className="font-medium">Simple (Regex)</span>
                      </button>
                      <button
                        onClick={() => setAISettings({ defaultParserMode: "ai" })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors",
                          aiSettings.defaultParserMode === "ai"
                            ? "border-[var(--cai-gold)] bg-[var(--cai-gold)]/10"
                            : "border-[var(--border)] hover:border-[var(--cai-gold)]/50"
                        )}
                      >
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">AI Mode</span>
                      </button>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">
                      Simple mode uses fast regex parsing. AI mode uses LLM for complex/messy data.
                    </p>
                  </div>

                  {/* Extract Metadata Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--muted)]">
                    <div>
                      <p className="font-medium">Extract Manufacturing Metadata</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Automatically detect edge banding, grooving, and CNC operations
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={aiSettings.extractMetadata}
                        onChange={(e) =>
                          setAISettings({ extractMetadata: e.target.checked })
                        }
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--cai-teal)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cai-teal)]"></div>
                    </label>
                  </div>

                  {/* Confidence Threshold */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Confidence Threshold
                    </label>
                    <p className="text-xs text-[var(--muted-foreground)] mb-2">
                      Parts below this confidence level will be flagged for review
                    </p>
                    <Select
                      value={aiSettings.confidenceThreshold.toString()}
                      onValueChange={(v) =>
                        setAISettings({ confidenceThreshold: parseFloat(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">50% - Permissive (more parts auto-accepted)</SelectItem>
                        <SelectItem value="0.75">75% - Balanced (recommended)</SelectItem>
                        <SelectItem value="0.9">90% - Strict (most parts need review)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--cai-teal)]/10 to-[var(--cai-gold)]/10 border border-[var(--cai-teal)]/20">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[var(--cai-gold)] mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">AI Mode Capabilities</p>
                        <ul className="text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
                          <li>Parse messy, unstructured cutlist data</li>
                          <li>Extract edge banding, grooving, and CNC operations</li>
                          <li>Recognize handwritten notes and scanned documents</li>
                          <li>99%+ accuracy with QR-coded templates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Billing Section (Admin Only) */}
            {activeSection === "billing" && isOrgAdmin() && (
              <Link href="/settings/billing">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CreditCard className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          Billing & Subscription
                        </h3>
                        <p className="text-[var(--muted-foreground)]">
                          Manage your subscription plan, view usage, and update payment methods
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Operations Library Section (Admin Only) */}
            {activeSection === "operations" && isOrgAdmin() && (
              <Link href="/settings/operations">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Wrench className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          Operations Library
                        </h3>
                        <p className="text-[var(--muted-foreground)]">
                          Manage hole patterns, groove profiles, and routing profiles
                          for CNC operations
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Shortcodes Section (Admin Only) */}
            {activeSection === "shortcodes" && isOrgAdmin() && (
              <Link href="/settings/shortcodes">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Code2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          Shortcode Configuration
                        </h3>
                        <p className="text-[var(--muted-foreground)]">
                          Configure shortcode mappings for edge banding, grooves,
                          holes, and CNC operations
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Organization Section (Admin Only) */}
            {activeSection === "organization" && isOrgAdmin() && (
              <Link href="/settings/organization">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-[var(--cai-teal)]/20 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-[var(--cai-teal)]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          Organization Settings
                        </h3>
                        <p className="text-[var(--muted-foreground)]">
                          Configure {user?.organization?.name || "your organization"}{" "}
                          settings, branding, and capabilities
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Team Section (Admin Only) */}
            {activeSection === "team" && isOrgAdmin() && (
              <Link href="/settings/team">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Users className="h-8 w-8 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">Team Management</h3>
                        <p className="text-[var(--muted-foreground)]">
                          Invite users, manage roles, and control access
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

