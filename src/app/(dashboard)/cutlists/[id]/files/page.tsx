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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SpreadsheetPreview } from "@/components/preview/SpreadsheetPreview";
import { PdfPreview } from "@/components/preview/PdfPreview";

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
  grain: string;
  ops?: Record<string, unknown>;
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
              <div className="flex-1 relative overflow-auto">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  {currentFile?.url && canPreview ? (
                    currentFile.mime_type.startsWith("image/") ? (
                      <img
                        src={currentFile.url}
                        alt={currentFile.original_name}
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{
                          transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        }}
                        onError={(e) => {
                          // Image failed to load - show fallback
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.querySelector('.preview-error')?.classList.remove('hidden');
                        }}
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
                    <div className="flex flex-col items-center text-[var(--muted-foreground)]">
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
                    <div className="flex flex-col items-center text-[var(--muted-foreground)]">
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
                <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Label</th>
                    <th className="text-right py-2 px-3 font-medium">Qty</th>
                    <th className="text-right py-2 px-3 font-medium">L × W</th>
                    <th className="text-left py-2 px-3 font-medium">Material</th>
                    <th className="text-center py-2 px-3 font-medium">Grain</th>
                  </tr>
                </thead>
                <tbody>
                  {cutlist.parts.map((part, index) => (
                    <tr
                      key={part.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50"
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
                        {part.grain === "none" ? (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        ) : part.grain === "along_L" ? (
                          <span title="Grain along length">↔</span>
                        ) : (
                          <span title="Grain along width">↕</span>
                        )}
                      </td>
                    </tr>
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
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Zoom/Rotate controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          </div>

          {currentFile.mime_type.startsWith("image/") && (
            <img
              src={currentFile.url}
              alt={currentFile.original_name}
              className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

