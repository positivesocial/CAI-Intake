"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  cost_per_sqm?: number;
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
  cost_per_meter?: number;
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
    cost_per_sqm: 0,
    supplier: "",
  });

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
        cost_per_sqm: formData.cost_per_sqm || undefined,
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
      cost_per_sqm: 0,
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
      cost_per_sqm: material.cost_per_sqm ?? 0,
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
                  <TableHead className="w-[50px]">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Thickness</TableHead>
                  <TableHead>Core</TableHead>
                  <TableHead>Grain</TableHead>
                  <TableHead>Sheet Size</TableHead>
                  <TableHead className="text-right">Cost/m²</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No sheet materials found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
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
                      <TableCell>
                        {material.grain && material.grain !== "none" ? (
                          <Badge variant="secondary">{material.grain}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {material.default_sheet
                          ? `${material.default_sheet.L} × ${material.default_sheet.W}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {material.cost_per_sqm
                          ? `$${material.cost_per_sqm.toFixed(2)}`
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

            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label>Cost per m²</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_per_sqm}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost_per_sqm: parseFloat(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
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
  const [formData, setFormData] = useState({
    edgeband_id: "",
    name: "",
    thickness_mm: 0.4,
    width_mm: 22,
    material: "PVC",
    color_code: "#FFFFFF",
    color_match_material_id: "",
    cost_per_meter: 0,
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
        cost_per_meter: formData.cost_per_meter || undefined,
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
      cost_per_meter: 0,
      supplier: "",
    });
    setEditingEdgeband(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (edgeband: Edgeband) => {
    setEditingEdgeband(edgeband);
    setFormData({
      edgeband_id: edgeband.edgeband_id,
      name: edgeband.name,
      thickness_mm: edgeband.thickness_mm,
      width_mm: edgeband.width_mm,
      material: edgeband.material ?? "PVC",
      color_code: edgeband.color_code ?? "#FFFFFF",
      color_match_material_id: edgeband.color_match_material_id ?? "",
      cost_per_meter: edgeband.cost_per_meter ?? 0,
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
                  <TableHead className="w-[50px]">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Thickness</TableHead>
                  <TableHead className="text-right">Width</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Cost/m</TableHead>
                  <TableHead>Supplier</TableHead>
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
                    <TableRow key={edgeband.id}>
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
                        {edgeband.cost_per_meter
                          ? `$${edgeband.cost_per_meter.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {edgeband.supplier || "-"}
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
                  value={formData.thickness_mm.toString()}
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
                  value={formData.width_mm.toString()}
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
                <Label>Cost per Meter</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_per_meter}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost_per_meter: parseFloat(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <p className="text-xs text-muted-foreground">
                  Link to a sheet material for color matching
                </p>
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
// MAIN PAGE
// ============================================================

export default function MaterialsLibraryPage() {
  const [activeTab, setActiveTab] = useState("sheets");

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
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Organization Library:</strong> These materials are specific to your organization.
            They are used for cutlist creation, cost estimation, and optimization planning.
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
          <SheetGoodsTab />
        </TabsContent>

        <TabsContent value="edgebands" className="mt-6">
          <EdgebandingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
