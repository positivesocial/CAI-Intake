"use client";

import * as React from "react";
import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  HolePattern,
  HolePatternInput,
  HolePatternKind,
  GrooveProfile,
  GrooveProfileInput,
  GroovePurpose,
  RoutingProfile,
  RoutingProfileInput,
  RoutingProfileType,
} from "@/lib/operations/types";
import {
  HOLE_PATTERN_KIND_LABELS,
  GROOVE_PURPOSE_LABELS,
  ROUTING_TYPE_LABELS,
} from "@/lib/operations/types";
import type { GrooveType, HoleType, CncOperationType } from "@/lib/schema";

// ============================================================
// HOLE PATTERNS TAB
// ============================================================

function HolePatternsTab() {
  const [patterns, setPatterns] = useState<HolePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPattern, setEditingPattern] = useState<HolePattern | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<HolePatternInput>({
    pattern_id: "",
    name: "",
    kind: "custom",
    holes: [],
    description: "",
  });

  const fetchPatterns = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/hole-patterns?active=all");
      if (!response.ok) throw new Error("Failed to fetch patterns");
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patterns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  const handleCreate = () => {
    setEditingPattern(null);
    setFormData({
      pattern_id: "",
      name: "",
      kind: "custom",
      holes: [],
      description: "",
    });
    setShowDialog(true);
  };

  const handleEdit = (pattern: HolePattern) => {
    setEditingPattern(pattern);
    setFormData({
      pattern_id: pattern.pattern_id,
      name: pattern.name,
      kind: pattern.kind,
      holes: pattern.holes,
      description: pattern.description,
      ref_edge: pattern.ref_edge,
      hardware_brand: pattern.hardware_brand,
      hardware_model: pattern.hardware_model,
      is_active: pattern.is_active,
    });
    setShowDialog(true);
  };

  const handleDelete = async (pattern: HolePattern) => {
    if (pattern.is_system) {
      alert("Cannot delete system patterns");
      return;
    }
    if (!confirm(`Delete pattern "${pattern.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/v1/hole-patterns/${pattern.pattern_id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      fetchPatterns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete pattern");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = editingPattern 
        ? `/api/v1/hole-patterns/${editingPattern.pattern_id}`
        : "/api/v1/hole-patterns";
      const method = editingPattern ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      
      setShowDialog(false);
      fetchPatterns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save pattern");
    } finally {
      setSaving(false);
    }
  };

  const filteredPatterns = patterns.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.pattern_id.toLowerCase().includes(search.toLowerCase());
    const matchesKind = kindFilter === "all" || p.kind === kindFilter;
    return matchesSearch && matchesKind;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patterns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(HOLE_PATTERN_KIND_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Pattern
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Holes</TableHead>
                <TableHead>Hardware</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatterns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No patterns found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatterns.map((pattern) => (
                  <TableRow key={pattern.pattern_id}>
                    <TableCell className="font-mono text-xs">{pattern.pattern_id}</TableCell>
                    <TableCell className="font-medium">{pattern.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{HOLE_PATTERN_KIND_LABELS[pattern.kind]}</Badge>
                    </TableCell>
                    <TableCell>{pattern.holes.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pattern.hardware_brand || "-"}
                    </TableCell>
                    <TableCell>{pattern.usage_count}</TableCell>
                    <TableCell>
                      <Badge variant={pattern.is_active ? "default" : "secondary"}>
                        {pattern.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(pattern)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(pattern)}
                          disabled={pattern.is_system}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPattern ? "Edit Pattern" : "Add Pattern"}</DialogTitle>
            <DialogDescription>
              Configure a reusable hole drilling pattern
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pattern ID</Label>
                <Input
                  value={formData.pattern_id}
                  onChange={(e) => setFormData({ ...formData, pattern_id: e.target.value })}
                  placeholder="e.g., H2-110"
                  disabled={!!editingPattern}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={formData.kind} 
                  onValueChange={(v) => setFormData({ ...formData, kind: v as HolePatternKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(HOLE_PATTERN_KIND_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 2 Hinges @ 110mm"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hardware Brand</Label>
                <Input
                  value={formData.hardware_brand || ""}
                  onChange={(e) => setFormData({ ...formData, hardware_brand: e.target.value })}
                  placeholder="e.g., Blum"
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Edge</Label>
                <Select 
                  value={formData.ref_edge || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, ref_edge: v === "none" ? undefined : v as "L1" | "L2" | "W1" | "W2" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="L1">L1 (First Long)</SelectItem>
                    <SelectItem value="L2">L2 (Second Long)</SelectItem>
                    <SelectItem value="W1">W1 (First Width)</SelectItem>
                    <SelectItem value="W2">W2 (Second Width)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.pattern_id || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPattern ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// GROOVE PROFILES TAB
// ============================================================

function GrooveProfilesTab() {
  const [profiles, setProfiles] = useState<GrooveProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<GrooveProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<GrooveProfileInput>({
    profile_id: "",
    name: "",
    width_mm: 4,
    depth_mm: 10,
    purpose: "custom",
  });

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/groove-profiles?active=all");
      if (!response.ok) throw new Error("Failed to fetch profiles");
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreate = () => {
    setEditingProfile(null);
    setFormData({
      profile_id: "",
      name: "",
      width_mm: 4,
      depth_mm: 10,
      purpose: "custom",
      default_offset_mm: 10,
      default_face: "back",
    });
    setShowDialog(true);
  };

  const handleEdit = (profile: GrooveProfile) => {
    setEditingProfile(profile);
    setFormData({
      profile_id: profile.profile_id,
      name: profile.name,
      width_mm: profile.width_mm,
      depth_mm: profile.depth_mm,
      purpose: profile.purpose as GroovePurpose,
      description: profile.description,
      default_offset_mm: profile.default_offset_mm,
      default_face: profile.default_face as "front" | "back",
      tool_dia_mm: profile.tool_dia_mm,
      is_active: profile.is_active,
    });
    setShowDialog(true);
  };

  const handleDelete = async (profile: GrooveProfile) => {
    if (profile.is_system) {
      alert("Cannot delete system profiles");
      return;
    }
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/v1/groove-profiles/${profile.profile_id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      fetchProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete profile");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = editingProfile 
        ? `/api/v1/groove-profiles/${editingProfile.profile_id}`
        : "/api/v1/groove-profiles";
      const method = editingProfile ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      
      setShowDialog(false);
      fetchProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.profile_id.toLowerCase().includes(search.toLowerCase());
    const matchesPurpose = purposeFilter === "all" || p.purpose === purposeFilter;
    return matchesSearch && matchesPurpose;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={purposeFilter} onValueChange={setPurposeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All purposes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All purposes</SelectItem>
                {Object.entries(GROOVE_PURPOSE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Width</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Offset</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No profiles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.profile_id}>
                    <TableCell className="font-mono text-xs">{profile.profile_id}</TableCell>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {profile.purpose ? GROOVE_PURPOSE_LABELS[profile.purpose as GroovePurpose] : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>{profile.width_mm}mm</TableCell>
                    <TableCell>{profile.depth_mm}mm</TableCell>
                    <TableCell>{profile.default_offset_mm}mm</TableCell>
                    <TableCell>{profile.usage_count}</TableCell>
                    <TableCell>
                      <Badge variant={profile.is_active ? "default" : "secondary"}>
                        {profile.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(profile)}
                          disabled={profile.is_system}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "Add Profile"}</DialogTitle>
            <DialogDescription>
              Configure a reusable groove profile
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profile ID</Label>
                <Input
                  value={formData.profile_id}
                  onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
                  placeholder="e.g., BACK-4x10"
                  disabled={!!editingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select 
                  value={formData.purpose || "custom"} 
                  onValueChange={(v) => setFormData({ ...formData, purpose: v as GroovePurpose })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GROOVE_PURPOSE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Back Panel Groove"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input
                  type="number"
                  value={formData.width_mm}
                  onChange={(e) => setFormData({ ...formData, width_mm: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Depth (mm)</Label>
                <Input
                  type="number"
                  value={formData.depth_mm}
                  onChange={(e) => setFormData({ ...formData, depth_mm: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Offset (mm)</Label>
                <Input
                  type="number"
                  value={formData.default_offset_mm || 10}
                  onChange={(e) => setFormData({ ...formData, default_offset_mm: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Face</Label>
                <Select 
                  value={formData.default_face || "back"} 
                  onValueChange={(v) => setFormData({ ...formData, default_face: v as "front" | "back" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front</SelectItem>
                    <SelectItem value="back">Back</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tool Diameter (mm)</Label>
                <Input
                  type="number"
                  value={formData.tool_dia_mm || ""}
                  onChange={(e) => setFormData({ ...formData, tool_dia_mm: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g., 4"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.profile_id || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProfile ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// ROUTING PROFILES TAB
// ============================================================

function RoutingProfilesTab() {
  const [profiles, setProfiles] = useState<RoutingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RoutingProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<RoutingProfileInput>({
    profile_id: "",
    name: "",
    profile_type: "custom",
    specifications: {},
  });

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/routing-profiles?active=all");
      if (!response.ok) throw new Error("Failed to fetch profiles");
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreate = () => {
    setEditingProfile(null);
    setFormData({
      profile_id: "",
      name: "",
      profile_type: "custom",
      specifications: {},
    });
    setShowDialog(true);
  };

  const handleEdit = (profile: RoutingProfile) => {
    setEditingProfile(profile);
    setFormData({
      profile_id: profile.profile_id,
      name: profile.name,
      profile_type: profile.profile_type,
      specifications: profile.specifications,
      description: profile.description,
      tool_dia_mm: profile.tool_dia_mm,
      tool_type: profile.tool_type,
      is_active: profile.is_active,
    });
    setShowDialog(true);
  };

  const handleDelete = async (profile: RoutingProfile) => {
    if (profile.is_system) {
      alert("Cannot delete system profiles");
      return;
    }
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/v1/routing-profiles/${profile.profile_id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      fetchProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete profile");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = editingProfile 
        ? `/api/v1/routing-profiles/${editingProfile.profile_id}`
        : "/api/v1/routing-profiles";
      const method = editingProfile ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      
      setShowDialog(false);
      fetchProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.profile_id.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || p.profile_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getSpecsSummary = (profile: RoutingProfile): string => {
    const specs = profile.specifications as Record<string, unknown>;
    if (profile.profile_type === "radius" && specs.radius_mm) {
      return `R${specs.radius_mm}mm`;
    }
    if (profile.profile_type === "cutout" && specs.shape) {
      return String(specs.shape);
    }
    if (profile.profile_type === "pocket" && specs.default_depth_mm) {
      return `${specs.default_depth_mm}mm deep`;
    }
    return "-";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(ROUTING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Specs</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No profiles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.profile_id}>
                    <TableCell className="font-mono text-xs">{profile.profile_id}</TableCell>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROUTING_TYPE_LABELS[profile.profile_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getSpecsSummary(profile)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profile.tool_dia_mm ? `Ø${profile.tool_dia_mm}mm` : "-"}
                    </TableCell>
                    <TableCell>{profile.usage_count}</TableCell>
                    <TableCell>
                      <Badge variant={profile.is_active ? "default" : "secondary"}>
                        {profile.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(profile)}
                          disabled={profile.is_system}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "Add Profile"}</DialogTitle>
            <DialogDescription>
              Configure a reusable CNC routing profile
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profile ID</Label>
                <Input
                  value={formData.profile_id}
                  onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
                  placeholder="e.g., CUTOUT-SINK"
                  disabled={!!editingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={formData.profile_type} 
                  onValueChange={(v) => setFormData({ ...formData, profile_type: v as RoutingProfileType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROUTING_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sink Cutout"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tool Diameter (mm)</Label>
                <Input
                  type="number"
                  value={formData.tool_dia_mm || ""}
                  onChange={(e) => setFormData({ ...formData, tool_dia_mm: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g., 6"
                />
              </div>
              <div className="space-y-2">
                <Label>Tool Type</Label>
                <Select 
                  value={formData.tool_type || "straight"} 
                  onValueChange={(v) => setFormData({ ...formData, tool_type: v as RoutingProfileInput["tool_type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight">Straight</SelectItem>
                    <SelectItem value="spiral_up">Spiral Up-cut</SelectItem>
                    <SelectItem value="spiral_down">Spiral Down-cut</SelectItem>
                    <SelectItem value="compression">Compression</SelectItem>
                    <SelectItem value="ballnose">Ball Nose</SelectItem>
                    <SelectItem value="vbit">V-Bit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.profile_id || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProfile ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// GROOVE TYPES TAB (Shortcodes)
// ============================================================

function GrooveTypesTab() {
  const [types, setTypes] = useState<GrooveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState<GrooveType | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    default_width_mm: 4,
    default_depth_mm: 8,
    description: "",
    is_active: true,
  });

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/groove-types?active=false");
      if (!response.ok) throw new Error("Failed to fetch groove types");
      const data = await response.json();
      setTypes(data.types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleCreate = () => {
    setEditingType(null);
    setFormData({ code: "", name: "", default_width_mm: 4, default_depth_mm: 8, description: "", is_active: true });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/v1/groove-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      setShowDialog(false);
      fetchTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save type");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center py-12 text-destructive"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Define shortcodes for groove operations</p>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Groove Type</Button>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Width (mm)</TableHead>
                <TableHead>Depth (mm)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No groove types defined</TableCell></TableRow>
              ) : (
                types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold">{t.code}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.default_width_mm || "-"}</TableCell>
                    <TableCell>{t.default_depth_mm || "-"}</TableCell>
                    <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Groove Type</DialogTitle>
            <DialogDescription>Create a shortcode for groove operations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code (shortcode)</Label>
                <Input value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g., D, R, BP" />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Dado, Rabbet" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Width (mm)</Label>
                <Input type="number" value={formData.default_width_mm} onChange={(e) => setFormData({...formData, default_width_mm: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Default Depth (mm)</Label>
                <Input type="number" value={formData.default_depth_mm} onChange={(e) => setFormData({...formData, default_depth_mm: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.code || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// HOLE TYPES TAB (Shortcodes)
// ============================================================

function HoleTypesTab() {
  const [types, setTypes] = useState<HoleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    diameter_mm: 5,
    depth_mm: 12,
    spacing_mm: 32,
    description: "",
    is_active: true,
  });

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/hole-types?active=false");
      if (!response.ok) throw new Error("Failed to fetch hole types");
      const data = await response.json();
      setTypes(data.types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleCreate = () => {
    setFormData({ code: "", name: "", diameter_mm: 5, depth_mm: 12, spacing_mm: 32, description: "", is_active: true });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/v1/hole-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      setShowDialog(false);
      fetchTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save type");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center py-12 text-destructive"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Define shortcodes for hole patterns</p>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Hole Type</Button>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Diameter (mm)</TableHead>
                <TableHead>Depth (mm)</TableHead>
                <TableHead>Spacing (mm)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hole types defined</TableCell></TableRow>
              ) : (
                types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold">{t.code}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.diameter_mm || "-"}</TableCell>
                    <TableCell>{t.depth_mm || "-"}</TableCell>
                    <TableCell>{t.spacing_mm || "-"}</TableCell>
                    <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Hole Type</DialogTitle>
            <DialogDescription>Create a shortcode for hole patterns</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code (shortcode)</Label>
                <Input value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g., S32, HG35" />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., System 32" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Diameter (mm)</Label>
                <Input type="number" value={formData.diameter_mm} onChange={(e) => setFormData({...formData, diameter_mm: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Depth (mm)</Label>
                <Input type="number" value={formData.depth_mm} onChange={(e) => setFormData({...formData, depth_mm: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Spacing (mm)</Label>
                <Input type="number" value={formData.spacing_mm} onChange={(e) => setFormData({...formData, spacing_mm: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.code || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// CNC TYPES TAB (Shortcodes)
// ============================================================

function CncTypesTab() {
  const [types, setTypes] = useState<CncOperationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    op_type: "custom" as const,
    description: "",
    is_active: true,
  });

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/cnc-types?active=false");
      if (!response.ok) throw new Error("Failed to fetch CNC types");
      const data = await response.json();
      setTypes(data.types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleCreate = () => {
    setFormData({ code: "", name: "", op_type: "custom", description: "", is_active: true });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/v1/cnc-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      setShowDialog(false);
      fetchTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save type");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center py-12 text-destructive"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Define shortcodes for CNC operations</p>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add CNC Type</Button>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Operation Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No CNC types defined</TableCell></TableRow>
              ) : (
                types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold">{t.code}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.op_type || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.description || "-"}</TableCell>
                    <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add CNC Type</DialogTitle>
            <DialogDescription>Create a shortcode for CNC operations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code (shortcode)</Label>
                <Input value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g., HINGE, PKT" />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Hinge Bore" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Operation Type</Label>
              <Select value={formData.op_type} onValueChange={(v) => setFormData({...formData, op_type: v as typeof formData.op_type})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pocket">Pocket</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                  <SelectItem value="drill">Drill</SelectItem>
                  <SelectItem value="engrave">Engrave</SelectItem>
                  <SelectItem value="cutout">Cutout</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.code || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function OperationsLibraryPage() {
  const [activeTab, setActiveTab] = useState("holes");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Library</h1>
        <p className="text-muted-foreground">
          Manage reusable drilling patterns, groove profiles, and CNC routing operations
        </p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Organization Library:</strong> These patterns are specific to your organization. 
            When you use operations in cutlists, the system tracks usage to show your most popular patterns first.
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="holes" className="gap-2">
            <CircleDot className="h-4 w-4" />
            <span className="hidden sm:inline">Hole Patterns</span>
            <span className="sm:hidden">Holes</span>
          </TabsTrigger>
          <TabsTrigger value="grooves" className="gap-2">
            <Minus className="h-4 w-4" />
            <span className="hidden sm:inline">Groove Profiles</span>
            <span className="sm:hidden">Grooves</span>
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-2">
            <Router className="h-4 w-4" />
            <span className="hidden sm:inline">Routing Profiles</span>
            <span className="sm:hidden">CNC</span>
          </TabsTrigger>
          <TabsTrigger value="groove-types" className="gap-2 border-l">
            <span className="font-mono text-xs">GR:</span>
            <span className="hidden sm:inline">Groove Codes</span>
          </TabsTrigger>
          <TabsTrigger value="hole-types" className="gap-2">
            <span className="font-mono text-xs">H:</span>
            <span className="hidden sm:inline">Hole Codes</span>
          </TabsTrigger>
          <TabsTrigger value="cnc-types" className="gap-2">
            <span className="font-mono text-xs">CNC:</span>
            <span className="hidden sm:inline">CNC Codes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-purple-600" />
                Hole Patterns
              </CardTitle>
              <CardDescription>
                Define drilling patterns for hinges, shelf pins, handles, cam locks, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HolePatternsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grooves" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Minus className="h-5 w-5 text-amber-600" />
                Groove Profiles
              </CardTitle>
              <CardDescription>
                Define groove specifications for back panels, drawer bottoms, light profiles, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GrooveProfilesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Router className="h-5 w-5 text-emerald-600" />
                Routing Profiles
              </CardTitle>
              <CardDescription>
                Define CNC routing operations for cutouts, pockets, edge profiles, radii, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoutingProfilesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groove-types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="font-mono text-amber-600 bg-amber-100 px-2 py-0.5 rounded">GR:</span>
                Groove Type Shortcodes
              </CardTitle>
              <CardDescription>
                Define quick shortcodes like D (Dado), R (Rabbet), BP (Back Panel) for fast data entry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GrooveTypesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hole-types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="font-mono text-purple-600 bg-purple-100 px-2 py-0.5 rounded">H:</span>
                Hole Type Shortcodes
              </CardTitle>
              <CardDescription>
                Define quick shortcodes like S32 (System 32), HG35 (Hinge 35mm) for fast data entry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoleTypesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cnc-types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="font-mono text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">CNC:</span>
                CNC Operation Shortcodes
              </CardTitle>
              <CardDescription>
                Define quick shortcodes like HINGE, PKT (Pocket), SINK for fast data entry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CncTypesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



