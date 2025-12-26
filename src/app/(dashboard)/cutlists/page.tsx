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
  Paperclip,
  ExternalLink,
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
  docId?: string;
  name: string;
  description?: string;
  projectName?: string;
  customerName?: string;
  jobRef?: string;
  clientRef?: string;
  status: "draft" | "processing" | "optimized" | "completed";
  partsCount: number;
  totalPieces: number;
  totalArea: number;
  materialsCount: number;
  createdAt: string;
  updatedAt: string;
  efficiency?: number;
  filesCount?: number;
  sourceMethod?: string;
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

    const response = await fetch(`/api/v1/cutlists?${searchParams.toString()}`, {
      credentials: "include", // Ensure cookies are sent
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Cutlists API error:", response.status, errorData);
      throw new Error(errorData.error || "Failed to fetch cutlists");
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

  // Format date - handles both ISO strings and timestamps correctly
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    
    // Parse the date - handle ISO strings correctly
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return "—";
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // For future dates or very recent (handles timezone issues)
    if (diff < 0 || diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    // For older dates, show full date with local timezone
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };
  
  // Format full timestamp for tooltip
  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
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

  // Handle single actions
  const handleDuplicate = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/cutlists/${id}/duplicate`, {
        method: "POST",
      });
      if (response.ok) {
        // Refresh the list
        fetchCutlists({ search, status: statusFilter, sort: sortField, order: sortDirection })
          .then(setCutlists);
      }
    } catch (error) {
      console.error("Failed to duplicate:", error);
    }
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this cutlist?")) {
      try {
        const response = await fetch(`/api/v1/cutlists/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setCutlists(prev => prev.filter(c => c.id !== id));
        }
      } catch (error) {
        console.error("Failed to delete:", error);
      }
    }
    setMenuOpen(null);
  };

  const handleExport = async (id: string) => {
    // Navigate to the cutlist detail page with export mode
    window.location.href = `/cutlists/${id}?export=true`;
    setMenuOpen(null);
  };

  // Handle bulk actions
  const handleBulkExport = async () => {
    if (selectedIds.length === 0) return;
    // For single selection, go to export page
    if (selectedIds.length === 1) {
      window.location.href = `/cutlists/${selectedIds[0]}?export=true`;
      return;
    }
    // For multiple, show message
    alert(`Export ${selectedIds.length} cutlists: This feature will export all selected cutlists.`);
  };

  const handleBulkDuplicate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Duplicate ${selectedIds.length} cutlist(s)?`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/v1/cutlists/${id}/duplicate`, { method: "POST" })
        )
      );
      setSelectedIds([]);
      fetchCutlists({ search, status: statusFilter, sort: sortField, order: sortDirection })
        .then(setCutlists);
    } catch (error) {
      console.error("Failed to duplicate:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} cutlist(s)? This cannot be undone.`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/v1/cutlists/${id}`, { method: "DELETE" })
        )
      );
      setCutlists(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleBulkOptimize = () => {
    if (selectedIds.length === 0) return;
    // Open CAI 2D optimizer with selected cutlist IDs
    const ids = selectedIds.join(",");
    window.open(`https://cai-2d.app/optimize?cutlists=${ids}`, "_blank");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 bg-[var(--muted)] rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkDuplicate}>
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleBulkOptimize}
              className="bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Optimize in CAI 2D
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
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
                <label 
                  className="absolute top-2 left-2 p-2 cursor-pointer checkbox-touch-target"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cutlist.id)}
                    onChange={() => toggleSelect(cutlist.id)}
                    className="rounded border-[var(--border)]"
                  />
                </label>

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
                      {/* Project & Customer */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--muted-foreground)] mt-0.5">
                        {cutlist.projectName && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Project:</span> {cutlist.projectName}
                          </span>
                        )}
                        {cutlist.customerName && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Customer:</span> {cutlist.customerName}
                          </span>
                        )}
                      </div>
                      {cutlist.description && (
                        <p className="text-sm text-[var(--muted-foreground)] line-clamp-1 mt-1">
                          {cutlist.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Cutlist ID */}
                  <div className="text-[10px] text-[var(--muted-foreground)] font-mono mb-2 truncate" title={`ID: ${cutlist.id}`}>
                    ID: {cutlist.id.substring(0, 8)}...
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
                    <div 
                      className="text-center p-2 bg-[var(--muted)] rounded cursor-help"
                      title={formatFullDate(cutlist.updatedAt)}
                    >
                      <Calendar className="h-4 w-4 mx-auto mb-1 text-[var(--muted-foreground)]" />
                      <span className="text-sm font-medium">{formatDate(cutlist.updatedAt)}</span>
                      <span className="text-xs text-[var(--muted-foreground)] block">updated</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={cutlist.status} />
                      {cutlist.filesCount && cutlist.filesCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = `/cutlists/${cutlist.id}/files`;
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                          title={`View ${cutlist.filesCount} source file${cutlist.filesCount > 1 ? 's' : ''} with parsed parts`}
                        >
                          <Paperclip className="h-3 w-3" />
                          {cutlist.filesCount}
                        </button>
                      )}
                    </div>
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
                    <label className="inline-flex p-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === cutlists.length}
                        onChange={selectAll}
                        className="rounded border-[var(--border)]"
                      />
                    </label>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">ID</th>
                  <th className="p-3 text-left text-sm font-medium">
                    <button 
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 hover:text-[var(--cai-teal)]"
                    >
                      Name
                      {sortField === "name" && (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium">Project / Customer</th>
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
                  <th className="p-3 text-center text-sm font-medium">Files</th>
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
                      <label className="inline-flex p-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cutlist.id)}
                          onChange={() => toggleSelect(cutlist.id)}
                          className="rounded border-[var(--border)]"
                        />
                      </label>
                    </td>
                    <td className="p-3">
                      <span 
                        className="text-xs font-mono text-[var(--muted-foreground)] cursor-help"
                        title={cutlist.id}
                      >
                        {cutlist.id.substring(0, 8)}
                      </span>
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
                      <div className="text-sm">
                        {cutlist.projectName && (
                          <div className="truncate max-w-[150px]" title={cutlist.projectName}>
                            {cutlist.projectName}
                          </div>
                        )}
                        {cutlist.customerName && (
                          <div className="text-[var(--muted-foreground)] text-xs truncate max-w-[150px]" title={cutlist.customerName}>
                            {cutlist.customerName}
                          </div>
                        )}
                        {!cutlist.projectName && !cutlist.customerName && (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={cutlist.status} />
                    </td>
                    <td className="p-3 font-medium">{cutlist.partsCount}</td>
                    <td className="p-3">{cutlist.materialsCount}</td>
                    <td 
                      className="p-3 text-[var(--muted-foreground)] cursor-help"
                      title={formatFullDate(cutlist.updatedAt)}
                    >
                      {formatDate(cutlist.updatedAt)}
                    </td>
                    <td className="p-3 text-center">
                      {cutlist.filesCount && cutlist.filesCount > 0 ? (
                        <a
                          href={`/cutlists/${cutlist.id}/files`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                          title={`View ${cutlist.filesCount} source file${cutlist.filesCount > 1 ? 's' : ''} with parsed parts`}
                        >
                          <Paperclip className="h-3 w-3" />
                          {cutlist.filesCount}
                        </a>
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

