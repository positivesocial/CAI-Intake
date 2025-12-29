"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Package,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  X,
  Maximize2,
  Edit2,
  Check,
  RotateCcw,
  Save,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SpreadsheetPreview } from "@/components/preview/SpreadsheetPreview";
import { PdfPreview } from "@/components/preview/PdfPreview";
import { ZoomableImage } from "@/components/preview/ZoomableImage";

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
  ops?: Record<string, unknown>;
  notes?: Record<string, string>;
}

// Editable part row component
function EditablePartRow({
  part,
  index,
  isEditing,
  editedPart,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
}: {
  part: CutlistPart;
  index: number;
  isEditing: boolean;
  editedPart: Partial<CutlistPart> | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (updates: Partial<CutlistPart>) => void;
}) {
  if (isEditing && editedPart) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--cai-teal)]/5">
        <td className="py-2 px-3 text-[var(--muted-foreground)]">{index + 1}</td>
        <td className="py-2 px-3">
          <Input
            value={editedPart.label || ""}
            onChange={(e) => onEditChange({ label: e.target.value })}
            className="h-7 text-sm"
            placeholder="Label"
          />
        </td>
        <td className="py-2 px-3">
          <Input
            type="number"
            value={editedPart.qty || 1}
            onChange={(e) => onEditChange({ qty: parseInt(e.target.value) || 1 })}
            className="h-7 text-sm w-16 text-right"
            min={1}
          />
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={editedPart.size?.L || 0}
              onChange={(e) => onEditChange({ size: { ...editedPart.size!, L: parseFloat(e.target.value) || 0 } })}
              className="h-7 text-sm w-20 text-right font-mono"
            />
            <span className="text-xs text-[var(--muted-foreground)]">×</span>
            <Input
              type="number"
              value={editedPart.size?.W || 0}
              onChange={(e) => onEditChange({ size: { ...editedPart.size!, W: parseFloat(e.target.value) || 0 } })}
              className="h-7 text-sm w-20 text-right font-mono"
            />
          </div>
        </td>
        <td className="py-2 px-3">
          <Input
            value={editedPart.material_id || ""}
            onChange={(e) => onEditChange({ material_id: e.target.value })}
            className="h-7 text-sm"
            placeholder="Material"
          />
        </td>
        <td className="py-2 px-3 text-center">
          <button
            onClick={() => onEditChange({ allow_rotation: !editedPart.allow_rotation })}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center",
              editedPart.allow_rotation !== false ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
            )}
          >
            {editedPart.allow_rotation !== false ? "✓" : "⊘"}
          </button>
        </td>
        <td className="py-2 px-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancelEdit} title="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={onSaveEdit} title="Save">
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 group cursor-pointer"
      onClick={onStartEdit}
    >
      <td className="py-2 px-3 text-[var(--muted-foreground)]">{index + 1}</td>
      <td className="py-2 px-3 font-medium">{part.label || part.part_id}</td>
      <td className="py-2 px-3 text-right">{part.qty}</td>
      <td className="py-2 px-3 text-right font-mono text-xs">
        {part.size.L} × {part.size.W}
      </td>
      <td className="py-2 px-3 truncate max-w-[120px]" title={part.material_id}>
        {part.material_id}
      </td>
      <td className="py-2 px-3 text-center">
        {part.allow_rotation !== false ? (
          <span className="text-green-600" title="Can rotate">✓</span>
        ) : (
          <span className="text-amber-600" title="Cannot rotate (respects grain)">⊘</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          title="Edit part"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

interface Cutlist {
  id: string;
  name: string;
  status: string;
  source_method: string;
  parts: CutlistPart[];
  parts_count: number;
  source_files: SourceFile[];
}

// =============================================================================
// HELPERS
// =============================================================================

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

function canPreviewFile(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    isSpreadsheetFile(mimeType)
  );
}

function isSpreadsheetFile(mimeType: string): boolean {
  return (
    mimeType === "text/csv" ||
    mimeType === "text/plain" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CutlistFilesGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [cutlist, setCutlist] = React.useState<Cutlist | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // File navigation
  const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  
  // Part editing
  const [editingPartId, setEditingPartId] = React.useState<string | null>(null);
  const [editedPart, setEditedPart] = React.useState<Partial<CutlistPart> | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

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

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cutlist?.source_files?.length) return;
      
      switch (e.key) {
        case "ArrowLeft":
          setCurrentFileIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowRight":
          setCurrentFileIndex((prev) => Math.min(cutlist.source_files.length - 1, prev + 1));
          break;
        case "Escape":
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            router.push("/cutlists");
          }
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(3, z + 0.25));
          break;
        case "-":
          setZoom((z) => Math.max(0.25, z - 0.25));
          break;
        case "r":
          setRotation((r) => (r + 90) % 360);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cutlist, isFullscreen, router]);

  // Reset zoom/rotation when file changes
  React.useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentFileIndex]);

  // Part editing handlers
  const startEditingPart = (part: CutlistPart) => {
    setEditingPartId(part.id);
    setEditedPart({ ...part });
  };

  const cancelEditing = () => {
    setEditingPartId(null);
    setEditedPart(null);
  };

  const saveEditedPart = async () => {
    if (!editedPart || !editingPartId || !cutlist) return;
    
    setIsSaving(true);
    try {
      // Update part in the API
      const response = await fetch(`/api/v1/cutlists/${id}/parts/${editingPartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editedPart.label,
          qty: editedPart.qty,
          size: editedPart.size,
          material_id: editedPart.material_id,
          allow_rotation: editedPart.allow_rotation,
        }),
      });

      if (response.ok) {
        // Update local state
        setCutlist((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            parts: prev.parts.map((p) =>
              p.id === editingPartId ? { ...p, ...editedPart } : p
            ),
          };
        });
        setEditingPartId(null);
        setEditedPart(null);
      } else {
        console.error("Failed to save part");
      }
    } catch (err) {
      console.error("Failed to save part:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditedPart = (updates: Partial<CutlistPart>) => {
    setEditedPart((prev) => prev ? { ...prev, ...updates } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
      </div>
    );
  }

  if (error || !cutlist) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{error || "Cutlist not found"}</h2>
        <Button variant="outline" onClick={() => router.push("/cutlists")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cutlists
        </Button>
      </div>
    );
  }

  const hasFiles = cutlist.source_files && cutlist.source_files.length > 0;
  const currentFile = hasFiles ? cutlist.source_files[currentFileIndex] : null;
  const FileIcon = currentFile ? getFileIcon(currentFile.mime_type) : File;
  const canPreview = currentFile && canPreviewFile(currentFile.mime_type);
  const totalPieces = cutlist.parts.reduce((sum, p) => sum + p.qty, 0);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/cutlists")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{cutlist.name}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {cutlist.parts_count} parts · {totalPieces} pieces
              {hasFiles && ` · ${cutlist.source_files.length} source file${cutlist.source_files.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/cutlists/${id}`)}>
            View Details
          </Button>
          <Button size="sm" onClick={() => router.push(`/intake?edit=${id}`)}>
            Edit Cutlist
          </Button>
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - File Preview */}
        <div className="lg:w-1/2 h-1/2 lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--muted)]/30">
          {!hasFiles ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
              <File className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No Source Files</p>
              <p className="text-sm mt-1">
                This cutlist was created via {cutlist.source_method || "manual entry"}
              </p>
            </div>
          ) : (
            <>
              {/* File Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {currentFile?.original_name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(currentFile?.size_bytes || 0)}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  {/* Zoom controls */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                    disabled={!canPreview}
                    title="Zoom out (-)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-[var(--muted-foreground)] w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    disabled={!canPreview}
                    title="Zoom in (+)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>

                  <div className="w-px h-6 bg-[var(--border)] mx-1" />

                  {/* Rotate */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    disabled={!canPreview}
                    title="Rotate (R)"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(true)}
                    disabled={!canPreview}
                    title="Fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>

                  <div className="w-px h-6 bg-[var(--border)] mx-1" />

                  {/* Download */}
                  {currentFile?.url && (
                    <a href={currentFile.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* File Preview Area */}
              <div className="flex-1 relative overflow-hidden">
                {currentFile?.url && canPreview ? (
                  currentFile.mime_type.startsWith("image/") ? (
                    <ZoomableImage
                      src={currentFile.url}
                      alt={currentFile.original_name}
                      className="w-full h-full"
                      zoom={zoom}
                      rotation={rotation}
                      onZoomChange={setZoom}
                      onRotationChange={setRotation}
                      showControls={false} // We have our own controls in toolbar
                    />
                  ) : currentFile.mime_type === "application/pdf" ? (
                    <PdfPreview
                      url={currentFile.url}
                      fileName={currentFile.original_name}
                      fileId={currentFile.id}
                      className="w-full h-full"
                    />
                  ) : isSpreadsheetFile(currentFile.mime_type) ? (
                    <SpreadsheetPreview
                      url={currentFile.url}
                      mimeType={currentFile.mime_type}
                      fileName={currentFile.original_name}
                      className="w-full h-full"
                    />
                  ) : null
                ) : currentFile?.url ? (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
                    <FileIcon className="h-20 w-20 mb-4 opacity-50" />
                    <p className="font-medium">{currentFile?.original_name}</p>
                    <p className="text-sm mt-1">Preview not available for this file type</p>
                    <a
                      href={currentFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in new tab
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
                    <AlertCircle className="h-16 w-16 mb-4 text-amber-500 opacity-70" />
                    <p className="font-medium">{currentFile?.original_name}</p>
                    <p className="text-sm mt-1 text-amber-600">Unable to load file preview</p>
                    <p className="text-xs mt-2 text-center max-w-xs">
                      The file may have been moved or the link has expired. 
                      Try refreshing the page.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                )}
              </div>

              {/* File Navigation (if multiple files) */}
              {cutlist.source_files.length > 1 && (
                <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFileIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentFileIndex === 0}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="flex items-center gap-2">
                    {cutlist.source_files.map((file, index) => (
                      <button
                        key={file.id}
                        onClick={() => setCurrentFileIndex(index)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-colors",
                          index === currentFileIndex
                            ? "bg-[var(--cai-teal)]"
                            : "bg-[var(--muted-foreground)]/30 hover:bg-[var(--muted-foreground)]/50"
                        )}
                        title={file.original_name}
                      />
                    ))}
                  </div>

                  <span className="text-sm text-[var(--muted-foreground)]">
                    {currentFileIndex + 1} / {cutlist.source_files.length}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFileIndex((prev) => Math.min(cutlist.source_files.length - 1, prev + 1))}
                    disabled={currentFileIndex === cutlist.source_files.length - 1}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel - Parts List */}
        <div className="lg:w-1/2 h-1/2 lg:h-full flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--cai-teal)]" />
              <span className="font-medium">Parsed Parts</span>
              <Badge variant="secondary">{cutlist.parts_count}</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {cutlist.parts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
                <Package className="h-12 w-12 mb-3 opacity-50" />
                <p>No parts in this cutlist</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] z-10">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Label</th>
                    <th className="text-right py-2 px-3 font-medium">Qty</th>
                    <th className="text-right py-2 px-3 font-medium">L × W</th>
                    <th className="text-left py-2 px-3 font-medium">Material</th>
                    <th className="text-center py-2 px-3 font-medium">Rot</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {cutlist.parts.map((part, index) => (
                    <EditablePartRow
                      key={part.id}
                      part={part}
                      index={index}
                      isEditing={editingPartId === part.id}
                      editedPart={editingPartId === part.id ? editedPart : null}
                      onStartEdit={() => startEditingPart(part)}
                      onCancelEdit={cancelEditing}
                      onSaveEdit={saveEditedPart}
                      onEditChange={updateEditedPart}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Parts Summary Footer */}
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                {cutlist.parts_count} unique parts
              </span>
              <span className="font-medium">
                {totalPieces} total pieces
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && currentFile?.url && canPreview && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <span className="text-white font-medium">{currentFile?.original_name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1">
            {currentFile.mime_type.startsWith("image/") && (
              <ZoomableImage
                src={currentFile.url}
                alt={currentFile.original_name}
                className="w-full h-full"
                zoom={zoom}
                rotation={rotation}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                maxZoom={5}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

