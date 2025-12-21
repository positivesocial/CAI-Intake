"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft,
  Code2,
  Layers,
  CircleDot,
  Minus,
  Router,
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Loader2,
  AlertCircle,
  Info,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// TYPES
// ============================================================

type ServiceType = "edgebanding" | "grooves" | "holes" | "cnc";

interface ShortcodeConfig {
  id: string;
  org_id: string;
  service_type: ServiceType;
  shortcode: string;
  display_name: string;
  default_specs: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ShortcodeInput {
  shortcode: string;
  display_name: string;
  service_type: ServiceType;
  default_specs: Record<string, unknown>;
  is_active: boolean;
}

// System defaults for reference
const SYSTEM_DEFAULTS: Record<ServiceType, { code: string; name: string; specs: Record<string, unknown> }[]> = {
  edgebanding: [
    { code: "L", name: "Long Edges (L1, L2)", specs: { edges: ["L1", "L2"] } },
    { code: "W", name: "Short Edges (W1, W2)", specs: { edges: ["W1", "W2"] } },
    { code: "4", name: "All 4 Edges", specs: { edges: ["L1", "L2", "W1", "W2"] } },
    { code: "1", name: "Single Edge (L1)", specs: { edges: ["L1"] } },
    { code: "2", name: "Two Edges (L1, W1)", specs: { edges: ["L1", "W1"] } },
    { code: "3", name: "Three Edges (L1, L2, W1)", specs: { edges: ["L1", "L2", "W1"] } },
  ],
  grooves: [
    { code: "GL", name: "Groove Long Side", specs: { side: "L1", depth_mm: 10, width_mm: 4 } },
    { code: "GW", name: "Groove Short Side", specs: { side: "W1", depth_mm: 10, width_mm: 4 } },
    { code: "GB", name: "Back Panel Groove", specs: { side: "W2", depth_mm: 10, width_mm: 4, offset_mm: 10 } },
    { code: "GD", name: "Drawer Bottom Groove", specs: { side: "L1", depth_mm: 10, width_mm: 4, offset_mm: 15 } },
  ],
  holes: [
    { code: "H2", name: "Hinge Boring (2 holes)", specs: { pattern: "hinge", count: 2, dia_mm: 35 } },
    { code: "H3", name: "Hinge Boring (3 holes)", specs: { pattern: "hinge", count: 3, dia_mm: 35 } },
    { code: "SP", name: "Shelf Pin Holes", specs: { pattern: "shelf-pins", dia_mm: 5, depth_mm: 12 } },
    { code: "DC", name: "Dowel/Cam Holes", specs: { pattern: "dowel-cam", dia_mm: 8, depth_mm: 12 } },
  ],
  cnc: [
    { code: "PKT", name: "Pocket Cut", specs: { type: "pocket" } },
    { code: "EDGE", name: "Edge Profile", specs: { type: "edge-profile" } },
    { code: "SLOT", name: "Slot/Dado", specs: { type: "slot" } },
  ],
};

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  edgebanding: "Edge Banding",
  grooves: "Grooves",
  holes: "Holes",
  cnc: "CNC Operations",
};

const SERVICE_TYPE_ICONS: Record<ServiceType, React.ElementType> = {
  edgebanding: Layers,
  grooves: Minus,
  holes: CircleDot,
  cnc: Router,
};

// ============================================================
// SHORTCODES TAB COMPONENT
// ============================================================

function ShortcodesTab({ serviceType }: { serviceType: ServiceType }) {
  const [configs, setConfigs] = useState<ShortcodeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ShortcodeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ShortcodeInput>({
    shortcode: "",
    display_name: "",
    service_type: serviceType,
    default_specs: {},
    is_active: true,
  });

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/shortcodes?service_type=${serviceType}`);
      if (!response.ok) throw new Error("Failed to fetch shortcodes");
      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shortcodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [serviceType]);

  const filteredConfigs = configs.filter(
    (c) =>
      c.shortcode.toLowerCase().includes(search.toLowerCase()) ||
      c.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const systemDefaults = SYSTEM_DEFAULTS[serviceType];

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      shortcode: "",
      display_name: "",
      service_type: serviceType,
      default_specs: {},
      is_active: true,
    });
    setShowDialog(true);
  };

  const handleEdit = (config: ShortcodeConfig) => {
    setEditingConfig(config);
    setFormData({
      shortcode: config.shortcode,
      display_name: config.display_name,
      service_type: config.service_type,
      default_specs: config.default_specs,
      is_active: config.is_active,
    });
    setShowDialog(true);
  };

  const handleCopyFromDefault = (def: typeof systemDefaults[0]) => {
    setFormData({
      shortcode: def.code,
      display_name: def.name,
      service_type: serviceType,
      default_specs: def.specs,
      is_active: true,
    });
  };

  const handleSave = async () => {
    if (!formData.shortcode.trim() || !formData.display_name.trim()) {
      toast.error("Shortcode and display name are required");
      return;
    }

    setSaving(true);
    try {
      const url = editingConfig
        ? `/api/v1/shortcodes/${editingConfig.id}`
        : "/api/v1/shortcodes";
      const method = editingConfig ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save shortcode");
      }

      toast.success(editingConfig ? "Shortcode updated" : "Shortcode created");
      setShowDialog(false);
      fetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (config: ShortcodeConfig) => {
    if (!confirm(`Delete shortcode "${config.shortcode}"?`)) return;

    try {
      const response = await fetch(`/api/v1/shortcodes/${config.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Shortcode deleted");
      fetchConfigs();
    } catch {
      toast.error("Failed to delete shortcode");
    }
  };

  const handleToggleActive = async (config: ShortcodeConfig) => {
    try {
      const response = await fetch(`/api/v1/shortcodes/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !config.is_active }),
      });

      if (!response.ok) throw new Error("Failed to update");
      fetchConfigs();
    } catch {
      toast.error("Failed to update shortcode");
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const Icon = SERVICE_TYPE_ICONS[serviceType];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Defaults Reference */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">System Defaults</CardTitle>
          </div>
          <CardDescription>
            These are the built-in shortcodes. Create org-specific overrides below to customize behavior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {systemDefaults.map((def) => (
              <div
                key={def.code}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--muted)] text-sm"
              >
                <code className="font-mono font-semibold text-[var(--cai-teal)]">
                  {def.code}
                </code>
                <span className="text-[var(--muted-foreground)]">{def.name}</span>
                <button
                  onClick={() => copyToClipboard(def.code)}
                  className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {copiedCode === def.code ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Org-Specific Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <CardTitle>Organization Shortcodes</CardTitle>
            </div>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Shortcode
            </Button>
          </div>
          <CardDescription>
            Custom shortcodes for your organization. These override system defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                placeholder="Search shortcodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {filteredConfigs.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No custom shortcodes configured.</p>
              <p className="text-sm mt-1">
                Click "Add Shortcode" to create organization-specific mappings.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shortcode</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <code className="font-mono font-semibold text-[var(--cai-teal)] bg-[var(--muted)] px-2 py-1 rounded">
                        {config.shortcode}
                      </code>
                    </TableCell>
                    <TableCell>{config.display_name}</TableCell>
                    <TableCell>
                      <code className="text-xs text-[var(--muted-foreground)]">
                        {JSON.stringify(config.default_specs).slice(0, 50)}
                        {JSON.stringify(config.default_specs).length > 50 && "..."}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={() => handleToggleActive(config)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(config)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit Shortcode" : "Add Shortcode"}
            </DialogTitle>
            <DialogDescription>
              Configure a custom shortcode mapping for your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quick-fill from defaults */}
            {!editingConfig && (
              <div>
                <Label className="text-sm text-[var(--muted-foreground)]">
                  Quick-fill from system default:
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {systemDefaults.map((def) => (
                    <button
                      key={def.code}
                      onClick={() => handleCopyFromDefault(def)}
                      className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:border-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/10 transition-colors"
                    >
                      {def.code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shortcode">Shortcode</Label>
                <Input
                  id="shortcode"
                  value={formData.shortcode}
                  onChange={(e) =>
                    setFormData({ ...formData, shortcode: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., L4, GB, H2"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="e.g., All 4 Edges"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="specs">Default Specs (JSON)</Label>
              <textarea
                id="specs"
                value={JSON.stringify(formData.default_specs, null, 2)}
                onChange={(e) => {
                  try {
                    setFormData({
                      ...formData,
                      default_specs: JSON.parse(e.target.value || "{}"),
                    });
                  } catch {
                    // Invalid JSON, keep current value
                  }
                }}
                className="w-full h-32 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] font-mono text-sm resize-none"
                placeholder='{"edges": ["L1", "L2", "W1", "W2"]}'
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                JSON object with default specifications for this shortcode.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingConfig ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ShortcodesPage() {
  const [activeTab, setActiveTab] = useState<ServiceType>("edgebanding");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Code2 className="h-6 w-6 text-blue-500" />
                Shortcode Configuration
              </h1>
              <p className="text-[var(--muted-foreground)]">
                Configure custom shortcode mappings for your organization
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Info Banner */}
        <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">About Shortcodes</p>
                <p className="text-[var(--muted-foreground)]">
                  Shortcodes are compact codes used in cutlists to specify operations.
                  For example, <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">L4</code> means
                  "edge band all 4 edges", and <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">GB</code> means
                  "back panel groove". You can override the system defaults or create
                  custom shortcodes specific to your shop's workflow.
                </p>
                <p className="text-[var(--muted-foreground)] mt-2">
                  <strong>Override syntax:</strong> Use <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">@</code> to
                  override defaults, e.g., <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">GB@d8w5</code> for
                  groove with 8mm depth and 5mm width.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ServiceType)}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
            {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => {
              const Icon = SERVICE_TYPE_ICONS[type];
              return (
                <TabsTrigger key={type} value={type} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{SERVICE_TYPE_LABELS[type]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => (
            <TabsContent key={type} value={type}>
              <ShortcodesTab serviceType={type} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

