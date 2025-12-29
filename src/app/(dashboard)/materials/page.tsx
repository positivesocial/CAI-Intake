"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  Download,
  Layers,
  Package,
  Filter,
  Loader2,
  AlertCircle,
  SquareStack,
  Ruler,
  Info,
  Percent,
  ArrowLeftRight,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ============================================================
// TYPES
// ============================================================

interface Material {
  id: string;
  material_id: string;
  name: string;
  thickness_mm: number;
  core_type?: string;
  grain?: string;
  finish?: string;
  color_code?: string;
  default_sheet?: { L: number; W: number };
  supplier?: string;
  sku?: string;
  created_at?: string;
}

interface Edgeband {
  id: string;
  edgeband_id: string;
  name: string;
  thickness_mm: number;
  width_mm: number;
  material?: string;
  color_code?: string;
  color_match_material_id?: string;
  waste_factor_pct: number; // Default 1%
  overhang_mm: number; // Default 0mm
  supplier?: string;
  sku?: string;
  created_at?: string;
}

// ============================================================
// SHEET GOODS TAB
// ============================================================

function SheetGoodsTab() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThickness, setSelectedThickness] = useState<number | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    material_id: "",
    name: "",
    thickness_mm: 18,
    core_type: "PB",
    grain: "none",
    finish: "",
    color_code: "#FFFFFF",
    default_sheet_l: 2800,
    default_sheet_w: 2070,
    supplier: "",
  });

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all in current filtered view
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMaterials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMaterials.map((m) => m.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} material(s)?`)) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/v1/materials/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      toast.success(`Deleted ${selectedIds.size} material(s)`);
      setSelectedIds(new Set());
      fetchMaterials();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error("Error", { description: message });
    } finally {
      setDeleting(false);
    }
  };

  // Fetch materials
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/materials");
      if (!res.ok) throw new Error("Failed to fetch materials");
      const data = await res.json();
      setMaterials(data.materials || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load materials";
      setError(message);
      toast.error("Error loading materials", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.material_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesThickness =
      selectedThickness === null || m.thickness_mm === selectedThickness;
    return matchesSearch && matchesThickness;
  });

  // Get unique thicknesses
  const thicknesses = [...new Set(materials.map((m) => m.thickness_mm))].sort(
    (a, b) => a - b
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Send all columns that exist in the database
      const payload = {
        material_id: formData.material_id,
        name: formData.name,
        thickness_mm: formData.thickness_mm,
        core_type: formData.core_type,
        grain: formData.grain,
        finish: formData.finish || undefined,
        color_code: formData.color_code,
        default_sheet: {
          L: formData.default_sheet_l,
          W: formData.default_sheet_w,
        },
        supplier: formData.supplier || undefined,
      };

      if (editingMaterial) {
        const res = await fetch(`/api/v1/materials/${editingMaterial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update material");
        }
        toast.success("Material updated successfully");
      } else {
        const res = await fetch("/api/v1/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create material");
        }
        toast.success("Material created successfully");
      }

      resetForm();
      fetchMaterials();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save material";
      toast.error("Error", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      material_id: "",
      name: "",
      thickness_mm: 18,
      core_type: "PB",
      grain: "none",
      finish: "",
      color_code: "#FFFFFF",
      default_sheet_l: 2800,
      default_sheet_w: 2070,
      supplier: "",
    });
    setEditingMaterial(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      material_id: material.material_id,
      name: material.name,
      thickness_mm: material.thickness_mm,
      core_type: material.core_type ?? "PB",
      grain: material.grain ?? "none",
      finish: material.finish ?? "",
      color_code: material.color_code ?? "#FFFFFF",
      default_sheet_l: material.default_sheet?.L ?? 2800,
      default_sheet_w: material.default_sheet?.W ?? 2070,
      supplier: material.supplier ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/materials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete material");
      toast.success("Material deleted");
      fetchMaterials();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error("Error", { description: message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchMaterials}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-[var(--cai-teal)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{materials.length}</p>
                <p className="text-sm text-muted-foreground">Total Sheets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thicknesses.length}</p>
                <p className="text-sm text-muted-foreground">Thicknesses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {materials.filter((m) => m.grain && m.grain !== "none").length}
                </p>
                <p className="text-sm text-muted-foreground">Grained</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {[...new Set(materials.map((m) => m.supplier))].filter(Boolean).length}
                </p>
                <p className="text-sm text-muted-foreground">Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sheet materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={selectedThickness === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedThickness(null)}
                >
                  All
                </Button>
                {thicknesses.slice(0, 6).map((t) => (
                  <Button
                    key={t}
                    variant={selectedThickness === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedThickness(t)}
                  >
                    {t}mm
                  </Button>
                ))}
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Sheet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-[var(--cai-teal)] bg-[var(--cai-teal)]/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} material{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete {selectedIds.size} Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sheet Materials ({filteredMaterials.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <label className="inline-flex p-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredMaterials.length > 0 && selectedIds.size === filteredMaterials.length}
                        onChange={toggleSelectAll}
                      />
                    </label>
                  </TableHead>
                  <TableHead className="w-[50px]">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Thickness</TableHead>
                  <TableHead>Core</TableHead>
                  <TableHead>Sheet Size</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No sheet materials found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow
                      key={material.id}
                      className={selectedIds.has(material.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <label className="inline-flex p-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(material.id)}
                            onChange={() => toggleSelect(material.id)}
                          />
                        </label>
                      </TableCell>
                      <TableCell>
                        <div
                          className="h-8 w-8 rounded border"
                          style={{ backgroundColor: material.color_code || "#f5f5f5" }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {material.material_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {material.thickness_mm}mm
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.core_type || "-"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {material.default_sheet
                          ? `${material.default_sheet.L} × ${material.default_sheet.W}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(material)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(material.id, material.name)}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? "Edit Sheet Material" : "Add Sheet Material"}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? "Update the sheet material details."
                : "Add a new sheet material to your library."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Material ID</Label>
                <Input
                  value={formData.material_id}
                  onChange={(e) =>
                    setFormData({ ...formData, material_id: e.target.value })
                  }
                  placeholder="MAT-WHITE-18"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="White Melamine 18mm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Thickness (mm)</Label>
                <Input
                  type="number"
                  value={formData.thickness_mm}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thickness_mm: parseFloat(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Core Type</Label>
                <Select
                  value={formData.core_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, core_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PB">Particle Board</SelectItem>
                    <SelectItem value="MDF">MDF</SelectItem>
                    <SelectItem value="PLY">Plywood</SelectItem>
                    <SelectItem value="HDF">HDF</SelectItem>
                    <SelectItem value="SOLID">Solid Wood</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grain Direction</Label>
                <Select
                  value={formData.grain}
                  onValueChange={(value) =>
                    setFormData({ ...formData, grain: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="length">Along Length</SelectItem>
                    <SelectItem value="width">Along Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Finish</Label>
                <Input
                  value={formData.finish}
                  onChange={(e) =>
                    setFormData({ ...formData, finish: e.target.value })
                  }
                  placeholder="Melamine"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.color_code}
                    onChange={(e) =>
                      setFormData({ ...formData, color_code: e.target.value })
                    }
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.color_code}
                    onChange={(e) =>
                      setFormData({ ...formData, color_code: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sheet Length (mm)</Label>
                <Input
                  type="number"
                  value={formData.default_sheet_l}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_sheet_l: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sheet Width (mm)</Label>
                <Input
                  type="number"
                  value={formData.default_sheet_w}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_sheet_w: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                  placeholder="Supplier name"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMaterial ? "Save Changes" : "Add Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// EDGEBANDING TAB
// ============================================================

function EdgebandingTab() {
  const [edgebands, setEdgebands] = useState<Edgeband[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThickness, setSelectedThickness] = useState<number | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEdgeband, setEditingEdgeband] = useState<Edgeband | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    edgeband_id: "",
    name: "",
    thickness_mm: 0.4,
    width_mm: 22,
    material: "PVC",
    color_code: "#FFFFFF",
    color_match_material_id: "",
    waste_factor_pct: 1,
    overhang_mm: 0,
    supplier: "",
  });

  // Fetch edgebands
  const fetchEdgebands = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/edgebands");
      if (!res.ok) throw new Error("Failed to fetch edgebands");
      const data = await res.json();
      setEdgebands(data.edgebands || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load edgebands";
      setError(message);
      toast.error("Error loading edgebands", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEdgebands();
  }, [fetchEdgebands]);

  // Filter edgebands
  const filteredEdgebands = edgebands.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.edgeband_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesThickness =
      selectedThickness === null || e.thickness_mm === selectedThickness;
    return matchesSearch && matchesThickness;
  });

  // Get unique thicknesses
  const thicknesses = [...new Set(edgebands.map((e) => e.thickness_mm))].sort(
    (a, b) => a - b
  );

  // Get unique materials for stats
  const edgebandMaterials = [...new Set(edgebands.map((e) => e.material))].filter(Boolean);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all in current filtered view
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEdgebands.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEdgebands.map((e) => e.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} edgeband(s)?`)) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/v1/edgebands/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      toast.success(`Deleted ${selectedIds.size} edgeband(s)`);
      setSelectedIds(new Set());
      fetchEdgebands();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error("Error", { description: message });
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        edgeband_id: formData.edgeband_id,
        name: formData.name,
        thickness_mm: formData.thickness_mm,
        width_mm: formData.width_mm,
        material: formData.material || undefined,
        color_code: formData.color_code,
        color_match_material_id: formData.color_match_material_id || undefined,
        waste_factor_pct: formData.waste_factor_pct,
        overhang_mm: formData.overhang_mm,
        supplier: formData.supplier || undefined,
      };

      if (editingEdgeband) {
        const res = await fetch(`/api/v1/edgebands/${editingEdgeband.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update edgeband");
        }
        toast.success("Edgeband updated successfully");
      } else {
        const res = await fetch("/api/v1/edgebands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create edgeband");
        }
        toast.success("Edgeband created successfully");
      }

      resetForm();
      fetchEdgebands();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save edgeband";
      toast.error("Error", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      edgeband_id: "",
      name: "",
      thickness_mm: 0.4,
      width_mm: 22,
      material: "PVC",
      color_code: "#FFFFFF",
      color_match_material_id: "",
      waste_factor_pct: 1,
      overhang_mm: 0,
      supplier: "",
    });
    setEditingEdgeband(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (edgeband: Edgeband) => {
    setEditingEdgeband(edgeband);
    setFormData({
      edgeband_id: edgeband.edgeband_id ?? "",
      name: edgeband.name ?? "",
      thickness_mm: edgeband.thickness_mm ?? 0.4,
      width_mm: edgeband.width_mm ?? 22,
      material: edgeband.material ?? "PVC",
      color_code: edgeband.color_code ?? "#FFFFFF",
      color_match_material_id: edgeband.color_match_material_id ?? "",
      waste_factor_pct: edgeband.waste_factor_pct ?? 1,
      overhang_mm: edgeband.overhang_mm ?? 0,
      supplier: edgeband.supplier ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/edgebands/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete edgeband");
      toast.success("Edgeband deleted");
      fetchEdgebands();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error("Error", { description: message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchEdgebands}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Ruler className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edgebands.length}</p>
                <p className="text-sm text-muted-foreground">Total Edgebands</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thicknesses.length}</p>
                <p className="text-sm text-muted-foreground">Thicknesses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <SquareStack className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edgebandMaterials.length}</p>
                <p className="text-sm text-muted-foreground">Material Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {[...new Set(edgebands.map((e) => e.supplier))].filter(Boolean).length}
                </p>
                <p className="text-sm text-muted-foreground">Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search edgebands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={selectedThickness === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedThickness(null)}
                >
                  All
                </Button>
                {thicknesses.slice(0, 6).map((t) => (
                  <Button
                    key={t}
                    variant={selectedThickness === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedThickness(t)}
                  >
                    {t}mm
                  </Button>
                ))}
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Edgeband
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-[var(--cai-teal)] bg-[var(--cai-teal)]/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} edgeband{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete {selectedIds.size} Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edgebands Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Edgebands ({filteredEdgebands.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <label className="inline-flex p-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredEdgebands.length > 0 && selectedIds.size === filteredEdgebands.length}
                        onChange={toggleSelectAll}
                      />
                    </label>
                  </TableHead>
                  <TableHead className="w-[50px]">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Thickness</TableHead>
                  <TableHead className="text-right">Width</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Overhang</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEdgebands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Ruler className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No edgebands found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEdgebands.map((edgeband) => (
                    <TableRow
                      key={edgeband.id}
                      className={selectedIds.has(edgeband.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <label className="inline-flex p-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(edgeband.id)}
                            onChange={() => toggleSelect(edgeband.id)}
                          />
                        </label>
                      </TableCell>
                      <TableCell>
                        <div
                          className="h-8 w-8 rounded border"
                          style={{ backgroundColor: edgeband.color_code || "#f5f5f5" }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{edgeband.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {edgeband.edgeband_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {edgeband.thickness_mm}mm
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {edgeband.width_mm}mm
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{edgeband.material || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {edgeband.overhang_mm > 0 ? (
                          <span className="text-blue-600">+{edgeband.overhang_mm}mm</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(edgeband)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(edgeband.id, edgeband.name)}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingEdgeband ? "Edit Edgeband" : "Add Edgeband"}
            </DialogTitle>
            <DialogDescription>
              {editingEdgeband
                ? "Update the edgeband details."
                : "Add a new edgeband to your library."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Edgeband ID</Label>
                <Input
                  value={formData.edgeband_id}
                  onChange={(e) =>
                    setFormData({ ...formData, edgeband_id: e.target.value })
                  }
                  placeholder="EB-WHITE-04"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="White PVC 0.4mm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Thickness (mm)</Label>
                <Select
                  value={(formData.thickness_mm ?? 0.4).toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, thickness_mm: parseFloat(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.4">0.4mm</SelectItem>
                    <SelectItem value="0.5">0.5mm</SelectItem>
                    <SelectItem value="1">1mm</SelectItem>
                    <SelectItem value="2">2mm</SelectItem>
                    <SelectItem value="3">3mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Select
                  value={(formData.width_mm ?? 22).toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, width_mm: parseFloat(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18mm</SelectItem>
                    <SelectItem value="19">19mm</SelectItem>
                    <SelectItem value="22">22mm</SelectItem>
                    <SelectItem value="23">23mm</SelectItem>
                    <SelectItem value="25">25mm</SelectItem>
                    <SelectItem value="28">28mm</SelectItem>
                    <SelectItem value="42">42mm</SelectItem>
                    <SelectItem value="43">43mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select
                  value={formData.material}
                  onValueChange={(value) =>
                    setFormData({ ...formData, material: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PVC">PVC</SelectItem>
                    <SelectItem value="ABS">ABS</SelectItem>
                    <SelectItem value="Acrylic">Acrylic</SelectItem>
                    <SelectItem value="Melamine">Melamine</SelectItem>
                    <SelectItem value="Veneer">Veneer</SelectItem>
                    <SelectItem value="Aluminum">Aluminum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.color_code}
                    onChange={(e) =>
                      setFormData({ ...formData, color_code: e.target.value })
                    }
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.color_code}
                    onChange={(e) =>
                      setFormData({ ...formData, color_code: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Matching Material ID</Label>
                <Input
                  value={formData.color_match_material_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      color_match_material_id: e.target.value,
                    })
                  }
                  placeholder="MAT-WHITE-18"
                />
              </div>
            </div>

            {/* Material Length Adjustments */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowLeftRight className="h-4 w-4" />
                Material Length Adjustments
              </div>
              <p className="text-xs text-muted-foreground">
                These values adjust the edgeband length calculation when generating material requirements.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-3 w-3" />
                    Waste Factor (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.waste_factor_pct}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        waste_factor_pct: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage added for waste/trim (default: 1%)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Overhang (mm)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.overhang_mm}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        overhang_mm: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Extra length on each end for flush trimming (adds 2× to total)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                placeholder="Supplier name"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEdgeband ? "Save Changes" : "Add Edgeband"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// IMPORT/EXPORT TYPES
// ============================================================

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: { index: number; id: string; error: string }[];
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function MaterialsLibraryPage() {
  const [activeTab, setActiveTab] = useState("sheets");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"materials" | "edgebands">("materials");
  const [importMode, setImportMode] = useState<"add" | "replace" | "upsert">("upsert");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs to trigger refresh in child tabs
  const [refreshKey, setRefreshKey] = useState(0);

  // Export materials or edgebands
  const handleExport = async (type: "materials" | "edgebands", format: "json" | "csv") => {
    try {
      const endpoint = type === "materials" ? "/api/v1/materials" : "/api/v1/edgebands";
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      
      const items = type === "materials" ? data.materials : data.edgebands;
      
      if (!items || items.length === 0) {
        toast.error("No data to export");
        return;
      }

      let content: string;
      let mimeType: string;
      let filename: string;

      if (format === "json") {
        // Clean export data (remove internal IDs)
        const cleanedItems = items.map((item: Record<string, unknown>) => {
          const { id, created_at, updated_at, ...rest } = item;
          return rest;
        });
        content = JSON.stringify(cleanedItems, null, 2);
        mimeType = "application/json";
        filename = `${type}-export-${new Date().toISOString().split("T")[0]}.json`;
      } else {
        // CSV format
        const headers = type === "materials" 
          ? ["material_id", "name", "thickness_mm", "core_type", "grain", "finish", "color_code", "default_sheet_L", "default_sheet_W", "sku", "supplier"]
          : ["edgeband_id", "name", "thickness_mm", "width_mm", "material", "color_code", "color_match_material_id", "finish", "waste_factor_pct", "overhang_mm", "supplier"];
        
        const rows = items.map((item: Record<string, unknown>) => {
          if (type === "materials") {
            const ds = item.default_sheet as { L?: number; W?: number } | null;
            return [
              item.material_id,
              item.name,
              item.thickness_mm,
              item.core_type || "",
              item.grain || "none",
              item.finish || "",
              item.color_code || "",
              ds?.L || "",
              ds?.W || "",
              item.sku || "",
              item.supplier || "",
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
          } else {
            return [
              item.edgeband_id,
              item.name,
              item.thickness_mm,
              item.width_mm,
              item.material || "",
              item.color_code || "",
              item.color_match_material_id || "",
              item.finish || "",
              item.waste_factor_pct,
              item.overhang_mm,
              item.supplier || "",
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
          }
        });
        
        content = [headers.join(","), ...rows].join("\n");
        mimeType = "text/csv";
        filename = `${type}-export-${new Date().toISOString().split("T")[0]}.csv`;
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${items.length} ${type}`, {
        description: `Downloaded as ${filename}`,
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  // Parse imported file
  const parseImportFile = async (file: File): Promise<unknown[]> => {
    const text = await file.text();
    
    if (file.name.endsWith(".json")) {
      return JSON.parse(text);
    } else if (file.name.endsWith(".csv")) {
      // Parse CSV
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return [];
      
      const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
      const items: unknown[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/("([^"]*("")*)*"|[^,]*)/g) || [];
        const cleanValues = values.map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
        
        const item: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          let value: unknown = cleanValues[idx] || "";
          // Convert numeric fields
          if (["thickness_mm", "width_mm", "waste_factor_pct", "overhang_mm", "default_sheet_L", "default_sheet_W"].includes(h)) {
            value = value ? parseFloat(value as string) : undefined;
          }
          item[h] = value;
        });
        
        // Handle default_sheet for materials CSV
        if (item.default_sheet_L && item.default_sheet_W) {
          item.default_sheet = { L: item.default_sheet_L, W: item.default_sheet_W };
          delete item.default_sheet_L;
          delete item.default_sheet_W;
        }
        
        items.push(item);
      }
      
      return items;
    }
    
    throw new Error("Unsupported file format. Use .json or .csv");
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) return;
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const data = await parseImportFile(importFile);
      
      const res = await fetch("/api/v1/materials/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          mode: importMode,
          data,
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || "Import failed");
      }
      
      setImportResult(result.results);
      toast.success(result.message);
      
      // Trigger refresh of the tabs
      setRefreshKey(prev => prev + 1);
      
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  };

  // Reset import dialog
  const resetImportDialog = () => {
    setImportFile(null);
    setImportResult(null);
    setImportMode("upsert");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials Library</h1>
          <p className="text-muted-foreground">
            Manage your sheet materials and edgebanding inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setImportType(activeTab === "sheets" ? "materials" : "edgebands");
              resetImportDialog();
              setIsImportDialogOpen(true);
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport(activeTab === "sheets" ? "materials" : "edgebands", "json")}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(activeTab === "sheets" ? "materials" : "edgebands", "csv")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
        setIsImportDialogOpen(open);
        if (!open) resetImportDialog();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {importType === "materials" ? "Sheet Materials" : "Edgebands"}</DialogTitle>
            <DialogDescription>
              Upload a JSON or CSV file to import {importType}. 
              You can export existing data first to use as a template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Import Type Selection */}
            <div className="space-y-2">
              <Label>Import Type</Label>
              <Select 
                value={importType} 
                onValueChange={(v) => setImportType(v as "materials" | "edgebands")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materials">Sheet Materials</SelectItem>
                  <SelectItem value="edgebands">Edgebands</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Import Mode */}
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as "add" | "replace" | "upsert")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upsert" id="upsert" />
                  <Label htmlFor="upsert" className="font-normal cursor-pointer">
                    <span className="font-medium">Update or Add</span> - Update existing, add new
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" />
                  <Label htmlFor="add" className="font-normal cursor-pointer">
                    <span className="font-medium">Add Only</span> - Skip existing items
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="font-normal cursor-pointer text-destructive">
                    <span className="font-medium">Replace All</span> - Delete all, then import
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* File Input */}
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {importFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <Card className={importResult.failed > 0 ? "border-yellow-500" : "border-green-500"}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{importResult.success} imported</span>
                    </div>
                    {importResult.skipped > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>{importResult.skipped} skipped</span>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>{importResult.failed} failed</span>
                      </div>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-red-600 max-h-24 overflow-y-auto">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i}>Row {err.index + 1} ({err.id}): {err.error}</div>
                      ))}
                      {importResult.errors.length > 5 && (
                        <div>...and {importResult.errors.length - 5} more errors</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!importFile || importing}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Organization Library:</strong> These materials are specific to your organization
            and are used for cutlist creation and optimization planning.
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sheets" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Sheet Goods
          </TabsTrigger>
          <TabsTrigger value="edgebands" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Edgebanding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sheets" className="mt-6">
          <SheetGoodsTab key={`sheets-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="edgebands" className="mt-6">
          <EdgebandingTab key={`edgebands-${refreshKey}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
