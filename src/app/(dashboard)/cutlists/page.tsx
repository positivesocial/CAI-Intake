"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Copy,
  Edit2,
  Download,
  Calendar,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface Cutlist {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "processing" | "optimized" | "completed";
  partsCount: number;
  totalPieces: number;
  totalArea: number;
  materialsCount: number;
  createdAt: string;
  updatedAt: string;
  efficiency?: number;
}

type ViewMode = "grid" | "list";
type SortField = "name" | "createdAt" | "updatedAt" | "partsCount";
type SortDirection = "asc" | "desc";

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchCutlists(params: {
  search?: string;
  status?: string;
  sort?: string;
  order?: string;
}): Promise<Cutlist[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.status) searchParams.set("status", params.status);
    if (params.sort) searchParams.set("sort", params.sort);
    if (params.order) searchParams.set("order", params.order);

    const response = await fetch(`/api/v1/cutlists?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch cutlists");
    }
    const data = await response.json();
    return data.cutlists || [];
  } catch (error) {
    console.error("Failed to fetch cutlists:", error);
    return [];
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CutlistsPage() {
  const [cutlists, setCutlists] = React.useState<Cutlist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [sortField, setSortField] = React.useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  // Fetch cutlists
  React.useEffect(() => {
    setLoading(true);
    fetchCutlists({
      search,
      status: statusFilter,
      sort: sortField,
      order: sortDirection,
    })
      .then(setCutlists)
      .finally(() => setLoading(false));
  }, [search, statusFilter, sortField, sortDirection]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  // Status badge
  const StatusBadge = ({ status }: { status: Cutlist["status"] }) => {
    const config = {
      draft: { icon: Edit2, label: "Draft", variant: "secondary" as const },
      processing: { icon: Clock, label: "Processing", variant: "default" as const },
      optimized: { icon: CheckCircle2, label: "Optimized", variant: "success" as const },
      completed: { icon: CheckCircle2, label: "Completed", variant: "success" as const },
    };
    
    const { icon: Icon, label, variant } = config[status];
    
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Handle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === cutlists.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cutlists.map(c => c.id));
    }
  };

  // Handle actions
  const handleDuplicate = async (id: string) => {
    console.log("Duplicate:", id);
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this cutlist?")) {
      setCutlists(prev => prev.filter(c => c.id !== id));
    }
    setMenuOpen(null);
  };

  const handleExport = async (id: string) => {
    console.log("Export:", id);
    setMenuOpen(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cutlists</h1>
          <p className="text-[var(--muted-foreground)]">
            Manage your cutlist projects
          </p>
        </div>
        <a href="/intake">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Cutlist
          </Button>
        </a>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search cutlists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="processing">Processing</option>
            <option value="optimized">Optimized</option>
            <option value="completed">Completed</option>
          </select>

          <Button 
            variant="outline" 
            size="icon"
            onClick={() => toggleSort(sortField)}
            title={`Sort by ${sortField} (${sortDirection})`}
          >
            {sortDirection === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center bg-[var(--muted)] rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === "grid" ? "bg-white shadow" : "hover:bg-white/50"
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === "list" ? "bg-white shadow" : "hover:bg-white/50"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-[var(--muted)] rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-1" />
            Duplicate
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
        </div>
      )}

      {/* Empty State */}
      {!loading && cutlists.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No cutlists yet</h3>
            <p className="text-[var(--muted-foreground)] mb-4 text-center max-w-md">
              Create your first cutlist to start managing your projects. You can import from Excel, paste text, or use voice input.
            </p>
            <a href="/intake">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Cutlist
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {!loading && cutlists.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cutlists.map((cutlist) => (
            <Card 
              key={cutlist.id}
              className={cn(
                "group hover:shadow-md transition-shadow cursor-pointer relative",
                selectedIds.includes(cutlist.id) && "ring-2 ring-[var(--cai-teal)]"
              )}
            >
              <CardContent className="p-4">
                {/* Selection Checkbox */}
                <div className="absolute top-3 left-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cutlist.id)}
                    onChange={() => toggleSelect(cutlist.id)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Menu Button */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === cutlist.id ? null : cutlist.id);
                    }}
                    className="p-1 rounded hover:bg-[var(--muted)]"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {menuOpen === cutlist.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-[var(--border)] rounded-lg shadow-lg py-1 z-10">
                      <a
                        href={`/cutlists/${cutlist.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)]"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </a>
                      <button
                        onClick={() => handleDuplicate(cutlist.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] w-full text-left"
                      >
                        <Copy className="h-4 w-4" /> Duplicate
                      </button>
                      <button
                        onClick={() => handleExport(cutlist.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] w-full text-left"
                      >
                        <Download className="h-4 w-4" /> Export
                      </button>
                      <hr className="my-1 border-[var(--border)]" />
                      <button
                        onClick={() => handleDelete(cutlist.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <a href={`/cutlists/${cutlist.id}`} className="block pt-6">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-[var(--cai-teal)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{cutlist.name}</h3>
                      {cutlist.description && (
                        <p className="text-sm text-[var(--muted-foreground)] line-clamp-1">
                          {cutlist.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-[var(--muted)] rounded">
                      <Package className="h-4 w-4 mx-auto mb-1 text-[var(--muted-foreground)]" />
                      <span className="text-sm font-medium">{cutlist.partsCount}</span>
                      <span className="text-xs text-[var(--muted-foreground)] block">parts</span>
                    </div>
                    <div className="text-center p-2 bg-[var(--muted)] rounded">
                      <Layers className="h-4 w-4 mx-auto mb-1 text-[var(--muted-foreground)]" />
                      <span className="text-sm font-medium">{cutlist.materialsCount}</span>
                      <span className="text-xs text-[var(--muted-foreground)] block">materials</span>
                    </div>
                    <div className="text-center p-2 bg-[var(--muted)] rounded">
                      <Calendar className="h-4 w-4 mx-auto mb-1 text-[var(--muted-foreground)]" />
                      <span className="text-sm font-medium">{formatDate(cutlist.updatedAt)}</span>
                      <span className="text-xs text-[var(--muted-foreground)] block">updated</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <StatusBadge status={cutlist.status} />
                    {cutlist.efficiency && (
                      <span className="text-sm text-green-600 font-medium">
                        {(cutlist.efficiency * 100).toFixed(0)}% efficient
                      </span>
                    )}
                  </div>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && cutlists.length > 0 && viewMode === "list" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === cutlists.length}
                      onChange={selectAll}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-medium">
                    <button 
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 hover:text-[var(--cai-teal)]"
                    >
                      Name
                      {sortField === "name" && (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">Status</th>
                  <th className="p-3 text-left text-sm font-medium">
                    <button 
                      onClick={() => toggleSort("partsCount")}
                      className="flex items-center gap-1 hover:text-[var(--cai-teal)]"
                    >
                      Parts
                      {sortField === "partsCount" && (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">Materials</th>
                  <th className="p-3 text-left text-sm font-medium">
                    <button 
                      onClick={() => toggleSort("updatedAt")}
                      className="flex items-center gap-1 hover:text-[var(--cai-teal)]"
                    >
                      Updated
                      {sortField === "updatedAt" && (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">Efficiency</th>
                  <th className="p-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cutlists.map((cutlist) => (
                  <tr 
                    key={cutlist.id} 
                    className={cn(
                      "border-b border-[var(--border)] hover:bg-[var(--muted)]/50",
                      selectedIds.includes(cutlist.id) && "bg-[var(--cai-teal)]/5"
                    )}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cutlist.id)}
                        onChange={() => toggleSelect(cutlist.id)}
                        className="h-4 w-4 rounded border-[var(--border)]"
                      />
                    </td>
                    <td className="p-3">
                      <a href={`/cutlists/${cutlist.id}`} className="hover:text-[var(--cai-teal)]">
                        <div className="font-medium">{cutlist.name}</div>
                        {cutlist.description && (
                          <div className="text-sm text-[var(--muted-foreground)] truncate max-w-xs">
                            {cutlist.description}
                          </div>
                        )}
                      </a>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={cutlist.status} />
                    </td>
                    <td className="p-3 font-medium">{cutlist.partsCount}</td>
                    <td className="p-3">{cutlist.materialsCount}</td>
                    <td className="p-3 text-[var(--muted-foreground)]">
                      {formatDate(cutlist.updatedAt)}
                    </td>
                    <td className="p-3">
                      {cutlist.efficiency ? (
                        <span className="text-green-600 font-medium">
                          {(cutlist.efficiency * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`/cutlists/${cutlist.id}`}>
                          <Button variant="ghost" size="icon">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(cutlist.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExport(cutlist.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cutlist.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

