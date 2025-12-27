"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Package,
  Layers,
  Calendar,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileIcon,
  File,
  FileImage,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface SourceFile {
  id: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  kind: string;
  created_at: string;
  url?: string;
}

interface CutlistPart {
  id: string;
  part_id: string;
  label?: string;
  qty: number;
  size: { L: number; W: number };
  thickness_mm: number;
  material_id: string;
  allow_rotation?: boolean;
  group_id?: string;
  ops?: Record<string, unknown>;
  notes?: Record<string, string>;
}

interface Cutlist {
  id: string;
  doc_id: string;
  name: string;
  description?: string;
  status: string;
  source_method: string;
  capabilities: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  parts: CutlistPart[];
  parts_count: number;
  source_files: SourceFile[];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function getStatusConfig(status: string) {
  const configs: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    draft: { icon: Edit2, label: "Draft", color: "bg-gray-100 text-gray-700" },
    processing: { icon: Clock, label: "Processing", color: "bg-blue-100 text-blue-700" },
    pending: { icon: Clock, label: "Pending", color: "bg-yellow-100 text-yellow-700" },
    optimized: { icon: CheckCircle2, label: "Optimized", color: "bg-green-100 text-green-700" },
    completed: { icon: CheckCircle2, label: "Completed", color: "bg-green-100 text-green-700" },
    archived: { icon: FileText, label: "Archived", color: "bg-gray-100 text-gray-500" },
  };
  return configs[status] || configs.draft;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CutlistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [cutlist, setCutlist] = React.useState<Cutlist | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);

  // Fetch cutlist data
  React.useEffect(() => {
    async function fetchCutlist() {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/cutlists/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Cutlist not found");
          } else {
            setError("Failed to load cutlist");
          }
          return;
        }
        const data = await response.json();
        setCutlist(data.cutlist);
      } catch (err) {
        setError("Failed to load cutlist");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchCutlist();
    }
  }, [id]);

  // Handle export
  const handleExport = async (format: string) => {
    try {
      const response = await fetch("/api/v1/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cutlist_id: id,
          format,
          options: { units: "mm" },
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || `cutlist.${format}`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export cutlist");
    }
    setExportMenuOpen(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this cutlist? This will also delete all linked files.")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/cutlists/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      router.push("/cutlists");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete cutlist");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
      </div>
    );
  }

  if (error || !cutlist) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{error || "Cutlist not found"}</h2>
        <Button variant="outline" onClick={() => router.push("/cutlists")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cutlists
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(cutlist.status);
  const StatusIcon = statusConfig.icon;

  // Calculate stats
  const totalPieces = cutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const uniqueMaterials = new Set(cutlist.parts.map(p => p.material_id)).size;
  const totalArea = cutlist.parts.reduce((sum, p) => sum + (p.size.L * p.size.W * p.qty) / 1000000, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/cutlists")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{cutlist.name}</h1>
              <Badge className={statusConfig.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            {cutlist.description && (
              <p className="text-[var(--muted-foreground)] mt-1">{cutlist.description}</p>
            )}
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Created {formatDate(cutlist.created_at)} · Updated {formatDate(cutlist.updated_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Button - Load cutlist in intake flow */}
          <Button onClick={() => router.push(`/intake?edit=${id}`)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Cutlist
          </Button>

          {/* Export dropdown */}
          <div className="relative">
            <Button variant="outline" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[var(--border)] rounded-lg shadow-lg py-1 z-10">
                <button onClick={() => handleExport("csv")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  Generic CSV
                </button>
                <button onClick={() => handleExport("cutlistplus")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  CutList Plus
                </button>
                <button onClick={() => handleExport("maxcut")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  MaxCut (.mcp)
                </button>
                <button onClick={() => handleExport("cutrite")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  CutRite (.xml)
                </button>
                <button onClick={() => handleExport("optimik")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  Optimik
                </button>
                <button onClick={() => handleExport("cai2d")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  CAI 2D
                </button>
                <button onClick={() => handleExport("json")} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)]">
                  JSON
                </button>
              </div>
            )}
          </div>
          
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-[var(--cai-teal)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cutlist.parts_count}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Unique Parts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPieces}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Total Pieces</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueMaterials}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Materials</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalArea.toFixed(2)}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Total m²</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parts Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Parts ({cutlist.parts_count})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 font-medium">Label</th>
                      <th className="text-left py-2 px-3 font-medium">Qty</th>
                      <th className="text-left py-2 px-3 font-medium">L × W × T (mm)</th>
                      <th className="text-left py-2 px-3 font-medium">Material</th>
                      <th className="text-left py-2 px-3 font-medium">Grain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cutlist.parts.slice(0, 20).map((part) => (
                      <tr key={part.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
                        <td className="py-2 px-3 font-medium">{part.label || part.part_id}</td>
                        <td className="py-2 px-3">{part.qty}</td>
                        <td className="py-2 px-3">
                          {part.size.L} × {part.size.W} × {part.thickness_mm}
                        </td>
                        <td className="py-2 px-3">{part.material_id}</td>
                        <td className="py-2 px-3">
                          {part.allow_rotation !== false ? "✓" : "⊘"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cutlist.parts.length > 20 && (
                  <p className="text-center text-sm text-[var(--muted-foreground)] py-3">
                    Showing 20 of {cutlist.parts.length} parts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Source Files */}
        <div id="files">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5" />
                  Source Files
                </CardTitle>
                {cutlist.source_files && cutlist.source_files.length > 0 && (
                  <a href={`/cutlists/${id}/files`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Gallery View
                    </Button>
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(!cutlist.source_files || cutlist.source_files.length === 0) ? (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <FileIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No source files linked</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cutlist.source_files.map((file) => {
                    const IconComponent = getFileIcon(file.mime_type);
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/50"
                      >
                        <div className="h-10 w-10 rounded bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-5 w-5 text-[var(--muted-foreground)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.original_name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {formatFileSize(file.size_bytes)} · {formatDate(file.created_at)}
                          </p>
                        </div>
                        {file.url && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded hover:bg-[var(--muted)] transition-colors"
                            title="Download file"
                          >
                            <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)]" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capabilities */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(cutlist.capabilities || {}).map(([key, enabled]) => (
                  <Badge
                    key={key}
                    variant={enabled ? "default" : "secondary"}
                    className={cn(!enabled && "opacity-50")}
                  >
                    {key.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

