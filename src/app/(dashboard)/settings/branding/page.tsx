"use client";

/**
 * CAI Intake - Organization Branding Settings
 * 
 * Allows org admins to configure:
 * - Logo (light/dark)
 * - Brand colors
 * - Company info
 * - Template settings (header, footer, QR style)
 */

import * as React from "react";
import {
  Palette,
  Image as ImageIcon,
  Building2,
  FileText,
  QrCode,
  Save,
  Loader2,
  Upload,
  Trash2,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

interface BrandingConfig {
  // Logo
  logo_url?: string;
  logo_dark_url?: string;
  
  // Colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  
  // Company info
  company_name: string;
  company_tagline?: string;
  contact_info: {
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
  
  // Template settings
  template_settings: {
    header_text?: string;
    footer_text: string;
    include_logo: boolean;
    include_qr_code: boolean;
    qr_style: "standard" | "rounded" | "dots";
    page_size: "A4" | "Letter" | "A3";
    orientation: "portrait" | "landscape";
  };
  
  // PDF theme
  pdf_theme: {
    font_family: string;
    heading_size: number;
    body_size: number;
    table_style: "bordered" | "striped" | "minimal";
  };
}

const DEFAULT_BRANDING: BrandingConfig = {
  primary_color: "#0EA5E9",
  secondary_color: "#38BDF8",
  accent_color: "#06B6D4",
  company_name: "",
  contact_info: {},
  template_settings: {
    footer_text: "All dimensions in mm. Verify before cutting.",
    include_logo: true,
    include_qr_code: true,
    qr_style: "standard",
    page_size: "A4",
    orientation: "portrait",
  },
  pdf_theme: {
    font_family: "Helvetica",
    heading_size: 14,
    body_size: 10,
    table_style: "bordered",
  },
};

// ============================================================
// COMPONENT
// ============================================================

export default function BrandingPage() {
  const [branding, setBranding] = React.useState<BrandingConfig>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load branding settings
  React.useEffect(() => {
    async function loadBranding() {
      try {
        const response = await fetch("/api/v1/organizations/branding");
        const data = await response.json();
        
        if (data.success && data.branding) {
          setBranding({ ...DEFAULT_BRANDING, ...data.branding });
        }
      } catch (err) {
        console.error("Failed to load branding:", err);
        setError("Failed to load branding settings");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadBranding();
  }, []);

  // Update handler
  const updateBranding = <K extends keyof BrandingConfig>(
    key: K,
    value: BrandingConfig[K]
  ) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Nested update handler
  const updateNestedBranding = <
    K extends keyof BrandingConfig,
    NK extends keyof BrandingConfig[K]
  >(
    key: K,
    nestedKey: NK,
    value: BrandingConfig[K][NK]
  ) => {
    setBranding((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] as object),
        [nestedKey]: value,
      },
    }));
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch("/api/v1/organizations/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to save");
      }
      
      toast.success("Branding settings saved");
      setHasChanges(false);
    } catch (err) {
      toast.error("Failed to save branding settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Logo upload handler (placeholder)
  const handleLogoUpload = async (variant: "light" | "dark") => {
    // In production, this would open a file picker and upload to storage
    toast.info("Logo upload", {
      description: `${variant === "light" ? "Light" : "Dark"} logo upload coming soon!`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6 text-[var(--cai-teal)]" />
            Organization Branding
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Customize your templates, PDFs, and exports with your brand identity
          </p>
        </div>
        
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            "gap-2",
            hasChanges && "bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="identity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity" className="gap-2">
            <Building2 className="h-4 w-4" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Logo
              </CardTitle>
              <CardDescription>
                Upload your company logo for templates and exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Light Logo */}
                <div className="space-y-3">
                  <Label>Light Mode Logo</Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer",
                      "hover:border-[var(--cai-teal)] transition-colors"
                    )}
                    onClick={() => handleLogoUpload("light")}
                  >
                    {branding.logo_url ? (
                      <div className="relative group">
                        <img
                          src={branding.logo_url}
                          alt="Logo"
                          className="max-h-20 mx-auto"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBranding("logo_url", undefined);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-[var(--muted-foreground)] mb-2" />
                        <p className="text-sm text-[var(--muted-foreground)]">
                          Click to upload
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          PNG, SVG, JPG (max 2MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Dark Logo */}
                <div className="space-y-3">
                  <Label>Dark Mode Logo (Optional)</Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer bg-gray-900",
                      "hover:border-[var(--cai-teal)] transition-colors"
                    )}
                    onClick={() => handleLogoUpload("dark")}
                  >
                    {branding.logo_dark_url ? (
                      <div className="relative group">
                        <img
                          src={branding.logo_dark_url}
                          alt="Logo (Dark)"
                          className="max-h-20 mx-auto"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBranding("logo_dark_url", undefined);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-400">
                          Click to upload
                        </p>
                        <p className="text-xs text-gray-500">
                          For dark backgrounds
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                This information appears on generated templates and exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={branding.company_name}
                    onChange={(e) => updateBranding("company_name", e.target.value)}
                    placeholder="Acme Cabinets Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_tagline">Tagline</Label>
                  <Input
                    id="company_tagline"
                    value={branding.company_tagline || ""}
                    onChange={(e) => updateBranding("company_tagline", e.target.value)}
                    placeholder="Quality Craftsmanship Since 1990"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={branding.contact_info.phone || ""}
                    onChange={(e) =>
                      updateNestedBranding("contact_info", "phone", e.target.value)
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={branding.contact_info.email || ""}
                    onChange={(e) =>
                      updateNestedBranding("contact_info", "email", e.target.value)
                    }
                    placeholder="orders@acmecabinets.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={branding.contact_info.address || ""}
                  onChange={(e) =>
                    updateNestedBranding("contact_info", "address", e.target.value)
                  }
                  placeholder="123 Workshop Lane, Suite 100, City, State 12345"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={branding.contact_info.website || ""}
                  onChange={(e) =>
                    updateNestedBranding("contact_info", "website", e.target.value)
                  }
                  placeholder="https://www.acmecabinets.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Colors
              </CardTitle>
              <CardDescription>
                Define your brand colors for templates and exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Primary Color */}
                <div className="space-y-3">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="primary_color"
                      value={branding.primary_color}
                      onChange={(e) => updateBranding("primary_color", e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={branding.primary_color}
                      onChange={(e) => updateBranding("primary_color", e.target.value)}
                      className="font-mono uppercase"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Used for headers and accents
                  </p>
                </div>

                {/* Secondary Color */}
                <div className="space-y-3">
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="secondary_color"
                      value={branding.secondary_color}
                      onChange={(e) => updateBranding("secondary_color", e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={branding.secondary_color}
                      onChange={(e) => updateBranding("secondary_color", e.target.value)}
                      className="font-mono uppercase"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Used for backgrounds
                  </p>
                </div>

                {/* Accent Color */}
                <div className="space-y-3">
                  <Label htmlFor="accent_color">Accent Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="accent_color"
                      value={branding.accent_color}
                      onChange={(e) => updateBranding("accent_color", e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={branding.accent_color}
                      onChange={(e) => updateBranding("accent_color", e.target.value)}
                      className="font-mono uppercase"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Used for highlights
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg border bg-[var(--muted)]">
                <p className="text-sm font-medium mb-3">Color Preview</p>
                <div className="flex gap-4">
                  <div
                    className="w-24 h-24 rounded-lg shadow-sm flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Primary
                  </div>
                  <div
                    className="w-24 h-24 rounded-lg shadow-sm flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: branding.secondary_color }}
                  >
                    Secondary
                  </div>
                  <div
                    className="w-24 h-24 rounded-lg shadow-sm flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: branding.accent_color }}
                  >
                    Accent
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Template Settings
              </CardTitle>
              <CardDescription>
                Configure how your templates and PDFs are generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header/Footer */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="header_text">Header Text</Label>
                  <Input
                    id="header_text"
                    value={branding.template_settings.header_text || ""}
                    onChange={(e) =>
                      updateNestedBranding("template_settings", "header_text", e.target.value)
                    }
                    placeholder="Custom header text for templates"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer_text">Footer Text</Label>
                  <Textarea
                    id="footer_text"
                    value={branding.template_settings.footer_text}
                    onChange={(e) =>
                      updateNestedBranding("template_settings", "footer_text", e.target.value)
                    }
                    placeholder="All dimensions in mm. Verify before cutting."
                    rows={2}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Include Logo</Label>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Show logo on templates
                    </p>
                  </div>
                  <Switch
                    checked={branding.template_settings.include_logo}
                    onCheckedChange={(checked) =>
                      updateNestedBranding("template_settings", "include_logo", checked)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Include QR Code</Label>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Add QR code for easy scanning
                    </p>
                  </div>
                  <Switch
                    checked={branding.template_settings.include_qr_code}
                    onCheckedChange={(checked) =>
                      updateNestedBranding("template_settings", "include_qr_code", checked)
                    }
                  />
                </div>
              </div>

              {/* QR Style */}
              {branding.template_settings.include_qr_code && (
                <div className="space-y-2">
                  <Label>QR Code Style</Label>
                  <div className="flex gap-3">
                    {(["standard", "rounded", "dots"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() =>
                          updateNestedBranding("template_settings", "qr_style", style)
                        }
                        className={cn(
                          "flex-1 p-4 rounded-lg border-2 text-center transition-colors",
                          branding.template_settings.qr_style === style
                            ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                            : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                        )}
                      >
                        <QrCode className="h-8 w-8 mx-auto mb-2" />
                        <span className="text-sm font-medium capitalize">{style}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page Size</Label>
                  <Select
                    value={branding.template_settings.page_size}
                    onValueChange={(value) =>
                      updateNestedBranding(
                        "template_settings",
                        "page_size",
                        value as "A4" | "Letter" | "A3"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                      <SelectItem value="A3">A3 (297 × 420 mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select
                    value={branding.template_settings.orientation}
                    onValueChange={(value) =>
                      updateNestedBranding(
                        "template_settings",
                        "orientation",
                        value as "portrait" | "landscape"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF Theme</CardTitle>
              <CardDescription>
                Typography and table styling for PDF exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={branding.pdf_theme.font_family}
                    onValueChange={(value) =>
                      updateNestedBranding("pdf_theme", "font_family", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times-Roman">Times Roman</SelectItem>
                      <SelectItem value="Courier">Courier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Heading Size</Label>
                  <Input
                    type="number"
                    min={10}
                    max={24}
                    value={branding.pdf_theme.heading_size}
                    onChange={(e) =>
                      updateNestedBranding(
                        "pdf_theme",
                        "heading_size",
                        parseInt(e.target.value) || 14
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Body Size</Label>
                  <Input
                    type="number"
                    min={8}
                    max={16}
                    value={branding.pdf_theme.body_size}
                    onChange={(e) =>
                      updateNestedBranding(
                        "pdf_theme",
                        "body_size",
                        parseInt(e.target.value) || 10
                      )
                    }
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Table Style</Label>
                <div className="flex gap-3">
                  {(["bordered", "striped", "minimal"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() =>
                        updateNestedBranding("pdf_theme", "table_style", style)
                      }
                      className={cn(
                        "flex-1 p-4 rounded-lg border-2 text-center transition-colors",
                        branding.pdf_theme.table_style === style
                          ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                          : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                      )}
                    >
                      <span className="text-sm font-medium capitalize">{style}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Template Preview
              </CardTitle>
              <CardDescription>
                Preview how your templates will look with current settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border rounded-lg p-6 bg-white"
                style={{
                  fontFamily: branding.pdf_theme.font_family,
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between pb-4 border-b"
                  style={{ borderColor: branding.primary_color }}
                >
                  <div className="flex items-center gap-4">
                    {branding.template_settings.include_logo && (
                      <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center">
                        {branding.logo_url ? (
                          <img src={branding.logo_url} alt="Logo" className="max-h-12" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        )}
                      </div>
                    )}
                    <div>
                      <h2
                        className="font-bold"
                        style={{
                          color: branding.primary_color,
                          fontSize: `${branding.pdf_theme.heading_size}px`,
                        }}
                      >
                        {branding.company_name || "Your Company Name"}
                      </h2>
                      {branding.company_tagline && (
                        <p className="text-gray-500 text-sm">{branding.company_tagline}</p>
                      )}
                    </div>
                  </div>
                  
                  {branding.template_settings.include_qr_code && (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                      <QrCode className="h-12 w-12" />
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="py-6">
                  {branding.template_settings.header_text && (
                    <p
                      className="text-center mb-4"
                      style={{ fontSize: `${branding.pdf_theme.body_size + 2}px` }}
                    >
                      {branding.template_settings.header_text}
                    </p>
                  )}
                  
                  {/* Sample Table */}
                  <table
                    className={cn(
                      "w-full",
                      branding.pdf_theme.table_style === "bordered" && "border",
                      branding.pdf_theme.table_style === "striped" && "[&_tr:nth-child(even)]:bg-gray-50"
                    )}
                    style={{ fontSize: `${branding.pdf_theme.body_size}px` }}
                  >
                    <thead
                      style={{
                        backgroundColor:
                          branding.pdf_theme.table_style !== "minimal"
                            ? branding.secondary_color + "20"
                            : undefined,
                      }}
                    >
                      <tr>
                        <th className="p-2 text-left border-b">Part</th>
                        <th className="p-2 text-left border-b">L × W</th>
                        <th className="p-2 text-left border-b">Qty</th>
                        <th className="p-2 text-left border-b">Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={branding.pdf_theme.table_style === "bordered" ? "border-b" : ""}>
                        <td className="p-2">Side Panel</td>
                        <td className="p-2">800 × 600</td>
                        <td className="p-2">2</td>
                        <td className="p-2">White MDF 18mm</td>
                      </tr>
                      <tr className={branding.pdf_theme.table_style === "bordered" ? "border-b" : ""}>
                        <td className="p-2">Base</td>
                        <td className="p-2">750 × 450</td>
                        <td className="p-2">1</td>
                        <td className="p-2">White MDF 18mm</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Footer */}
                <div className="pt-4 border-t text-center text-gray-500 text-sm">
                  {branding.template_settings.footer_text}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 bg-amber-100 border border-amber-300 rounded-lg shadow-lg">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-800">You have unsaved changes</span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? "Saving..." : "Save Now"}
          </Button>
        </div>
      )}
    </div>
  );
}

