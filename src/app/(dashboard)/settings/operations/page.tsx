"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Layers,
  Circle,
  Grid3X3,
  Cpu,
  Loader2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  OperationType,
  EdgebandOperation,
  GrooveOperation,
  DrillingOperation,
  CncOperation,
  EdgeSide,
  GROOVE_TYPE_LABELS,
  DRILLING_TYPE_LABELS,
  CNC_TYPE_LABELS,
  TOOL_TYPE_LABELS,
  ToolType,
} from "@/lib/operations/types";

type OperationCategory = "edgeband" | "groove" | "drilling" | "cnc" | "types";

export default function OperationsSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<OperationCategory>("edgeband");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [edgebandOps, setEdgebandOps] = useState<EdgebandOperation[]>([]);
  const [grooveOps, setGrooveOps] = useState<GrooveOperation[]>([]);
  const [drillingOps, setDrillingOps] = useState<DrillingOperation[]>([]);
  const [cncOps, setCncOps] = useState<CncOperation[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  // Helper to fetch with retry
  const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
    const options = { credentials: "include" as const };
    for (let i = 0; i <= retries; i++) {
      const res = await fetch(url, options);
      if (res.ok || i === retries) return res;
      // Wait a bit before retry (100ms, 200ms)
      await new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
    return fetch(url, options); // This shouldn't happen but TypeScript needs it
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [typesRes, edgeRes, grooveRes, drillRes, cncRes] = await Promise.all([
        fetchWithRetry("/api/v1/operations/types"),
        fetchWithRetry("/api/v1/operations/edgeband"),
        fetchWithRetry("/api/v1/operations/groove"),
        fetchWithRetry("/api/v1/operations/drilling"),
        fetchWithRetry("/api/v1/operations/cnc"),
      ]);

      // Check if all requests succeeded
      const allOk = [typesRes, edgeRes, grooveRes, drillRes, cncRes].every((r) => r.ok);

      if (!allOk) {
        const hasAuthError = [typesRes, edgeRes, grooveRes, drillRes, cncRes].some(
          (r) => r.status === 401
        );
        if (hasAuthError) {
          throw new Error("Please log in to view operations");
        }
        throw new Error("Failed to fetch some operations");
      }

      const [typesData, edgeData, grooveData, drillData, cncData] = await Promise.all([
        typesRes.json(),
        edgeRes.json(),
        grooveRes.json(),
        drillRes.json(),
        cncRes.json(),
      ]);

      setOperationTypes(typesData.types || []);
      setEdgebandOps(edgeData.operations || []);
      setGrooveOps(grooveData.operations || []);
      setDrillingOps(drillData.operations || []);
      setCncOps(cncData.operations || []);
    } catch (err) {
      console.error("Error fetching operations:", err);
      setError(err instanceof Error ? err.message : "Failed to load operations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle create/edit
  const handleCreate = () => {
    setSelectedItem(null);
    setModalMode("create");
    setShowModal(true);
  };

  const handleEdit = (item: unknown) => {
    setSelectedItem(item);
    setModalMode("edit");
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this operation?")) return;

    try {
      const endpoint = getEndpointForTab(activeTab);
      const res = await fetch(`${endpoint}/${id}`, { 
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const getEndpointForTab = (tab: OperationCategory): string => {
    switch (tab) {
      case "edgeband":
        return "/api/v1/operations/edgeband";
      case "groove":
        return "/api/v1/operations/groove";
      case "drilling":
        return "/api/v1/operations/drilling";
      case "cnc":
        return "/api/v1/operations/cnc";
      case "types":
        return "/api/v1/operations/types";
      default:
        return "";
    }
  };

  const getTypesForCategory = (category: string) => {
    return operationTypes.filter((t) => t.category === category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/settings")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-muted-foreground">
            Configure shortcodes and operation specifications
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Edgeband</span>
            </div>
            <p className="text-2xl font-bold mt-1">{edgebandOps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Groove</span>
            </div>
            <p className="text-2xl font-bold mt-1">{grooveOps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Drilling</span>
            </div>
            <p className="text-2xl font-bold mt-1">{drillingOps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">CNC</span>
            </div>
            <p className="text-2xl font-bold mt-1">{cncOps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-muted-foreground">Types</span>
            </div>
            <p className="text-2xl font-bold mt-1">{operationTypes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OperationCategory)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="edgeband" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Edgeband</span>
          </TabsTrigger>
          <TabsTrigger value="groove" className="flex items-center gap-2">
            <Circle className="h-4 w-4" />
            <span className="hidden sm:inline">Groove</span>
          </TabsTrigger>
          <TabsTrigger value="drilling" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Drilling</span>
          </TabsTrigger>
          <TabsTrigger value="cnc" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">CNC</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Types</span>
          </TabsTrigger>
        </TabsList>

        {/* Edgeband Tab */}
        <TabsContent value="edgeband">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edgeband Operations</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Edges</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {edgebandOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {op.code}
                        </code>
                      </TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {op.edges.map((e) => (
                            <Badge key={e} variant="outline" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{op.usageCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(op)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(op.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {edgebandOps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No edgeband operations defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groove Tab */}
        <TabsContent value="groove">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Groove Operations</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size (WxD)</TableHead>
                    <TableHead>Edges</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grooveOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {op.code}
                        </code>
                      </TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>
                        {op.type?.name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {op.widthMm}×{op.depthMm}mm
                      </TableCell>
                      <TableCell>
                        {op.edge && (
                          <Badge variant="outline" className="text-xs">
                            {op.edge}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(op)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(op.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {grooveOps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No groove operations defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drilling Tab */}
        <TabsContent value="drilling">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Drilling Operations</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Holes</TableHead>
                    <TableHead>Hardware</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillingOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {op.code}
                        </code>
                      </TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>
                        {op.type?.name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{op.holes.length} holes</TableCell>
                      <TableCell>
                        {op.hardwareBrand || op.hardwareModel ? (
                          <span className="text-sm">
                            {op.hardwareBrand} {op.hardwareModel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(op)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(op.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drillingOps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No drilling operations defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CNC Tab */}
        <TabsContent value="cnc">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>CNC Operations</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cncOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {op.code}
                        </code>
                      </TableCell>
                      <TableCell>{op.name}</TableCell>
                      <TableCell>
                        {op.type?.name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {op.opType && (
                          <Badge variant="outline" className="text-xs">
                            {op.opType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(op)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(op.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cncOps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No CNC operations defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Operation Types</CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Groove Types */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Circle className="h-4 w-4 text-green-500" />
                    Groove Types
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {getTypesForCategory("groove").map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleEdit(t)}
                      >
                        {t.name}
                        {t.isSystem && " (System)"}
                      </Badge>
                    ))}
                    {getTypesForCategory("groove").length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        No groove types defined
                      </span>
                    )}
                  </div>
                </div>

                {/* Drilling Types */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-orange-500" />
                    Drilling Types
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {getTypesForCategory("drilling").map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleEdit(t)}
                      >
                        {t.name}
                        {t.isSystem && " (System)"}
                      </Badge>
                    ))}
                    {getTypesForCategory("drilling").length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        No drilling types defined
                      </span>
                    )}
                  </div>
                </div>

                {/* CNC Types */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-purple-500" />
                    CNC Types
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {getTypesForCategory("cnc").map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleEdit(t)}
                      >
                        {t.name}
                        {t.isSystem && " (System)"}
                      </Badge>
                    ))}
                    {getTypesForCategory("cnc").length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        No CNC types defined
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal - placeholder, will be implemented based on active tab */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create" ? "Create" : "Edit"} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Operation
            </DialogTitle>
            <DialogDescription>
              {activeTab === "types"
                ? "Configure operation types that will appear in dropdown menus"
                : `Configure the ${activeTab} operation shortcode and specification`}
            </DialogDescription>
          </DialogHeader>

          {/* Form content based on active tab */}
          <OperationForm
            category={activeTab}
            mode={modalMode}
            initialData={selectedItem}
            types={operationTypes}
            onSave={async (data) => {
              setSaving(true);
              try {
                const endpoint = getEndpointForTab(activeTab);
                const method = modalMode === "create" ? "POST" : "PATCH";
                const url = modalMode === "edit" && selectedItem
                  ? `${endpoint}/${(selectedItem as { id: string }).id}`
                  : endpoint;

                const res = await fetch(url, {
                  method,
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify(data),
                });

                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error(errorData.error || "Failed to save");
                }

                await fetchData();
                setShowModal(false);
              } catch (err) {
                alert(err instanceof Error ? err.message : "Failed to save");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setShowModal(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// OPERATION FORM COMPONENT
// ============================================================

interface OperationFormProps {
  category: OperationCategory;
  mode: "create" | "edit";
  initialData: unknown;
  types: OperationType[];
  onSave: (data: unknown) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function OperationForm({
  category,
  mode,
  initialData,
  types,
  onSave,
  onCancel,
  saving,
}: OperationFormProps) {
  // Common fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");

  // Edgeband fields
  const [edges, setEdges] = useState<EdgeSide[]>([]);

  // Groove fields
  const [widthMm, setWidthMm] = useState(4);
  const [depthMm, setDepthMm] = useState(10);
  const [offsetMm, setOffsetMm] = useState(10);
  const [face, setFace] = useState<"front" | "back">("back");

  // Drilling fields
  const [hardwareBrand, setHardwareBrand] = useState("");
  const [hardwareModel, setHardwareModel] = useState("");

  // CNC fields
  const [toolType, setToolType] = useState<ToolType>("straight");
  const [toolDiaMm, setToolDiaMm] = useState(8);

  // Type form fields
  const [typeCategory, setTypeCategory] = useState<"groove" | "drilling" | "cnc">("groove");

  // Initialize form
  useEffect(() => {
    if (initialData && mode === "edit") {
      const data = initialData as Record<string, unknown>;
      setCode((data.code as string) || "");
      setName((data.name as string) || "");
      setDescription((data.description as string) || "");
      setTypeId((data.typeId as string) || "");

      if (category === "edgeband") {
        setEdges((data.edges as EdgeSide[]) || []);
      } else if (category === "groove") {
        setWidthMm((data.widthMm as number) || 4);
        setDepthMm((data.depthMm as number) || 10);
        setOffsetMm((data.offsetMm as number) || 10);
        setFace((data.face as "front" | "back") || "back");
        setEdges((data.edges as EdgeSide[]) || []);
      } else if (category === "drilling") {
        setHardwareBrand((data.hardwareBrand as string) || "");
        setHardwareModel((data.hardwareModel as string) || "");
      } else if (category === "cnc") {
        setToolType((data.toolType as ToolType) || "straight");
        setToolDiaMm((data.toolDiaMm as number) || 8);
      } else if (category === "types") {
        setTypeCategory((data.category as "groove" | "drilling" | "cnc") || "groove");
      }
    } else {
      // Reset form
      setCode("");
      setName("");
      setDescription("");
      setTypeId("");
      setEdges([]);
      setWidthMm(4);
      setDepthMm(10);
      setOffsetMm(10);
      setFace("back");
      setHardwareBrand("");
      setHardwareModel("");
      setToolType("straight");
      setToolDiaMm(8);
      setTypeCategory("groove");
    }
  }, [initialData, mode, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let data: Record<string, unknown> = {
      code,
      name,
      description: description || undefined,
    };

    if (category === "edgeband") {
      data.edges = edges;
    } else if (category === "groove") {
      data = {
        ...data,
        typeId: typeId || undefined,
        edges,
        widthMm,
        depthMm,
        offsetMm,
        face,
      };
    } else if (category === "drilling") {
      data = {
        ...data,
        typeId: typeId || undefined,
        holes: [], // Would need a hole editor for real implementation
        hardwareBrand: hardwareBrand || undefined,
        hardwareModel: hardwareModel || undefined,
      };
    } else if (category === "cnc") {
      data = {
        ...data,
        typeId: typeId || undefined,
        params: {},
        toolType,
        toolDiaMm,
      };
    } else if (category === "types") {
      data = {
        category: typeCategory,
        code,
        name,
        description: description || undefined,
      };
    }

    await onSave(data);
  };

  const toggleEdge = (edge: EdgeSide) => {
    setEdges((prev) =>
      prev.includes(edge) ? prev.filter((e) => e !== edge) : [...prev, edge]
    );
  };

  const categoryTypes = types.filter((t) => t.category === category);

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        {/* Type category selector (for types tab) */}
        {category === "types" && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={typeCategory} onValueChange={(v) => setTypeCategory(v as "groove" | "drilling" | "cnc")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groove">Groove</SelectItem>
                <SelectItem value="drilling">Drilling</SelectItem>
                <SelectItem value="cnc">CNC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Code */}
        <div className="space-y-2">
          <Label>Code (Shortcode)</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={category === "edgeband" ? "2L2W" : category === "groove" ? "GL-4-10" : category === "drilling" ? "H2" : "PKT-50"}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use any code you prefer. This will be used as the shortcode.
          </p>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Operation name"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this operation"
            rows={2}
          />
        </div>

        {/* Type selector (for groove, drilling, cnc) */}
        {(category === "groove" || category === "drilling" || category === "cnc") && (
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {categoryTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Edge selector (for edgeband and groove) */}
        {(category === "edgeband" || category === "groove") && (
          <div className="space-y-2">
            <Label>Edges</Label>
            <div className="flex gap-4">
              {(["L1", "L2", "W1", "W2"] as EdgeSide[]).map((edge) => (
                <label key={edge} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={edges.includes(edge)}
                    onCheckedChange={() => toggleEdge(edge)}
                  />
                  <span>{edge}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Groove-specific fields */}
        {category === "groove" && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Width (mm)</Label>
              <Input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(parseFloat(e.target.value))}
                step="0.5"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Depth (mm)</Label>
              <Input
                type="number"
                value={depthMm}
                onChange={(e) => setDepthMm(parseFloat(e.target.value))}
                step="0.5"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Offset (mm)</Label>
              <Input
                type="number"
                value={offsetMm}
                onChange={(e) => setOffsetMm(parseFloat(e.target.value))}
                step="0.5"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Face</Label>
              <Select value={face} onValueChange={(v) => setFace(v as "front" | "back")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Front</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Drilling-specific fields */}
        {category === "drilling" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hardware Brand</Label>
              <Input
                value={hardwareBrand}
                onChange={(e) => setHardwareBrand(e.target.value)}
                placeholder="e.g., Blum, Hettich"
              />
            </div>
            <div className="space-y-2">
              <Label>Hardware Model</Label>
              <Input
                value={hardwareModel}
                onChange={(e) => setHardwareModel(e.target.value)}
                placeholder="e.g., Clip Top, Sensys"
              />
            </div>
          </div>
        )}

        {/* CNC-specific fields */}
        {category === "cnc" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <Select value={toolType} onValueChange={(v) => setToolType(v as ToolType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TOOL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tool Diameter (mm)</Label>
              <Input
                type="number"
                value={toolDiaMm}
                onChange={(e) => setToolDiaMm(parseFloat(e.target.value))}
                step="0.5"
                min="0"
              />
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create" : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
