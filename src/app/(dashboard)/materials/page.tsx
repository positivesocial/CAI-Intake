"use client";

import * as React from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Mock data - in production this would come from the API
const MOCK_MATERIALS = [
  {
    id: "1",
    material_id: "MAT-WHITE-18",
    name: "White Melamine 18mm",
    thickness_mm: 18,
    core_type: "PB",
    grain: "none",
    finish: "Melamine",
    color_code: "#FFFFFF",
    default_sheet: { L: 2800, W: 2070 },
    cost_per_sqm: 25.50,
    supplier: "Supplier A",
  },
  {
    id: "2",
    material_id: "MAT-OAK-18",
    name: "Oak Veneer 18mm",
    thickness_mm: 18,
    core_type: "MDF",
    grain: "length",
    finish: "Veneer",
    color_code: "#C4A35A",
    default_sheet: { L: 2800, W: 2070 },
    cost_per_sqm: 85.00,
    supplier: "Supplier B",
  },
  {
    id: "3",
    material_id: "MAT-BLACK-16",
    name: "Black Melamine 16mm",
    thickness_mm: 16,
    core_type: "PB",
    grain: "none",
    finish: "Melamine",
    color_code: "#1A1A1A",
    default_sheet: { L: 2800, W: 2070 },
    cost_per_sqm: 28.00,
    supplier: "Supplier A",
  },
  {
    id: "4",
    material_id: "MAT-WALNUT-19",
    name: "Walnut Veneer 19mm",
    thickness_mm: 19,
    core_type: "MDF",
    grain: "length",
    finish: "Veneer",
    color_code: "#5D4037",
    default_sheet: { L: 2440, W: 1220 },
    cost_per_sqm: 120.00,
    supplier: "Supplier C",
  },
];

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
}

export default function MaterialsPage() {
  const [materials, setMaterials] = React.useState<Material[]>(MOCK_MATERIALS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedThickness, setSelectedThickness] = React.useState<number | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingMaterial, setEditingMaterial] = React.useState<Material | null>(null);
  const [formData, setFormData] = React.useState({
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

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.material_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesThickness = selectedThickness === null || m.thickness_mm === selectedThickness;
    return matchesSearch && matchesThickness;
  });

  // Get unique thicknesses
  const thicknesses = [...new Set(materials.map(m => m.thickness_mm))].sort((a, b) => a - b);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newMaterial: Material = {
      id: editingMaterial?.id ?? Date.now().toString(),
      material_id: formData.material_id,
      name: formData.name,
      thickness_mm: formData.thickness_mm,
      core_type: formData.core_type,
      grain: formData.grain,
      finish: formData.finish,
      color_code: formData.color_code,
      default_sheet: { L: formData.default_sheet_l, W: formData.default_sheet_w },
      cost_per_sqm: formData.cost_per_sqm,
      supplier: formData.supplier,
    };

    if (editingMaterial) {
      setMaterials(materials.map(m => m.id === editingMaterial.id ? newMaterial : m));
    } else {
      setMaterials([...materials, newMaterial]);
    }

    resetForm();
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

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this material?")) {
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Material Library</h1>
          <p className="text-[var(--muted-foreground)]">
            Manage your board materials and stock sheets
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
          <Button variant="primary" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Material
          </Button>
        </div>
      </div>

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
                <p className="text-sm text-[var(--muted-foreground)]">Total Materials</p>
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
                <p className="text-sm text-[var(--muted-foreground)]">Thicknesses</p>
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
                  {materials.filter(m => m.grain && m.grain !== "none").length}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Grained</p>
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
                  {[...new Set(materials.map(m => m.supplier))].filter(Boolean).length}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
              <div className="flex gap-1">
                <Button
                  variant={selectedThickness === null ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedThickness(null)}
                >
                  All
                </Button>
                {thicknesses.map(t => (
                  <Button
                    key={t}
                    variant={selectedThickness === t ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setSelectedThickness(t)}
                  >
                    {t}mm
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Materials ({filteredMaterials.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
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
                      <Package className="h-8 w-8 mx-auto mb-2 text-[var(--muted-foreground)]" />
                      <p className="text-[var(--muted-foreground)]">No materials found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map(material => (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div
                          className="h-8 w-8 rounded border border-[var(--border)]"
                          style={{ backgroundColor: material.color_code }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-[var(--muted)] px-2 py-1 rounded">
                          {material.material_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {material.thickness_mm}mm
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.core_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {material.grain && material.grain !== "none" ? (
                          <Badge variant="secondary">{material.grain}</Badge>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {material.default_sheet ? (
                          `${material.default_sheet.L} × ${material.default_sheet.W}`
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {material.cost_per_sqm ? `$${material.cost_per_sqm.toFixed(2)}` : "-"}
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
                            onClick={() => handleDelete(material.id)}
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
              {editingMaterial ? "Edit Material" : "Add Material"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Material ID</label>
                <Input
                  value={formData.material_id}
                  onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                  placeholder="MAT-WHITE-18"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="White Melamine 18mm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Thickness (mm)</label>
                <Input
                  type="number"
                  value={formData.thickness_mm}
                  onChange={(e) => setFormData({ ...formData, thickness_mm: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Core Type</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-[var(--border)] bg-[var(--background)]"
                  value={formData.core_type}
                  onChange={(e) => setFormData({ ...formData, core_type: e.target.value })}
                >
                  <option value="PB">Particle Board</option>
                  <option value="MDF">MDF</option>
                  <option value="PLY">Plywood</option>
                  <option value="HDF">HDF</option>
                  <option value="SOLID">Solid Wood</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Grain Direction</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-[var(--border)] bg-[var(--background)]"
                  value={formData.grain}
                  onChange={(e) => setFormData({ ...formData, grain: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="length">Along Length</option>
                  <option value="width">Along Width</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Finish</label>
                <Input
                  value={formData.finish}
                  onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                  placeholder="Melamine"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.color_code}
                    onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.color_code}
                    onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost per m²</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_per_sqm}
                  onChange={(e) => setFormData({ ...formData, cost_per_sqm: parseFloat(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sheet Length (mm)</label>
                <Input
                  type="number"
                  value={formData.default_sheet_l}
                  onChange={(e) => setFormData({ ...formData, default_sheet_l: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sheet Width (mm)</label>
                <Input
                  type="number"
                  value={formData.default_sheet_w}
                  onChange={(e) => setFormData({ ...formData, default_sheet_w: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supplier</label>
                <Input
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Supplier name"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingMaterial ? "Save Changes" : "Add Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

