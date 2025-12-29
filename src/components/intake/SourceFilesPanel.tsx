"use client";

/**
 * CAI Intake - Source Files Panel
 * 
 * A panel for viewing source files during intake or review.
 * Used in Compare Mode to show uploaded files alongside parsed parts.
 * 
 * Features:
 * - File thumbnail/preview gallery
 * - Navigation between multiple files
 * - Zoomable image viewer
 * - PDF and spreadsheet preview support
 * - Fullscreen mode
 */

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  X,
  Maximize2,
  ExternalLink,
  Download,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ZoomableImage } from "@/components/preview/ZoomableImage";
import { PdfPreview } from "@/components/preview/PdfPreview";
import { SpreadsheetPreview } from "@/components/preview/SpreadsheetPreview";

// =============================================================================
// TYPES
// =============================================================================

export interface SourceFile {
  id: string;
  file?: File; // Local file (during intake)
  url?: string; // Remote URL (for saved cutlists)
  name: string;
  mimeType: string;
  size?: number;
}

interface SourceFilesPanelProps {
  files: SourceFile[];
  className?: string;
  /** Compact mode hides some controls */
  compact?: boolean;
  /** Show file list thumbnails */
  showThumbnails?: boolean;
  /** Called when user clicks download/open */
  onDownload?: (file: SourceFile) => void;
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

export function SourceFilesPanel({
  files,
  className,
  compact = false,
  showThumbnails = true,
  onDownload,
}: SourceFilesPanelProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [previewUrls, setPreviewUrls] = React.useState<Map<string, string>>(new Map());
  
  // Generate preview URLs for local files
  React.useEffect(() => {
    const newUrls = new Map<string, string>();
    
    files.forEach((file) => {
      if (file.file && !file.url) {
        // Create object URL for local file
        const url = URL.createObjectURL(file.file);
        newUrls.set(file.id, url);
      } else if (file.url) {
        newUrls.set(file.id, file.url);
      }
    });
    
    setPreviewUrls(newUrls);
    
    // Cleanup object URLs on unmount
    return () => {
      newUrls.forEach((url, id) => {
        const file = files.find(f => f.id === id);
        if (file?.file && !file.url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [files]);
  
  // Ensure current index is valid
  React.useEffect(() => {
    if (currentIndex >= files.length && files.length > 0) {
      setCurrentIndex(files.length - 1);
    }
  }, [files.length, currentIndex]);
  
  if (files.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] p-8",
        className
      )}>
        <File className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No Source Files</p>
        <p className="text-sm mt-1">
          Upload files to see them here
        </p>
      </div>
    );
  }
  
  const currentFile = files[currentIndex];
  const currentUrl = previewUrls.get(currentFile?.id || "");
  const FileIcon = currentFile ? getFileIcon(currentFile.mimeType) : File;
  const canPreview = currentFile && canPreviewFile(currentFile.mimeType);
  
  const goToPrevious = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goToNext = () => setCurrentIndex((i) => Math.min(files.length - 1, i + 1));
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {currentFile?.name}
          </span>
          {currentFile?.size && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {formatFileSize(currentFile.size)}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {!compact && canPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsFullscreen(true)}
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          
          {currentUrl && onDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDownload(currentFile)}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Preview Area */}
      <div className="flex-1 relative overflow-hidden bg-[var(--muted)]/30">
        {currentUrl && canPreview ? (
          currentFile.mimeType.startsWith("image/") ? (
            <ZoomableImage
              src={currentUrl}
              alt={currentFile.name}
              className="w-full h-full"
            />
          ) : currentFile.mimeType === "application/pdf" ? (
            <PdfPreview
              url={currentUrl}
              fileName={currentFile.name}
              fileId={currentFile.id}
              className="w-full h-full"
            />
          ) : isSpreadsheetFile(currentFile.mimeType) ? (
            <SpreadsheetPreview
              url={currentUrl}
              mimeType={currentFile.mimeType}
              fileName={currentFile.name}
              className="w-full h-full"
            />
          ) : null
        ) : currentUrl ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
            <FileIcon className="h-16 w-16 mb-4 opacity-50" />
            <p className="font-medium">{currentFile?.name}</p>
            <p className="text-sm mt-1">Preview not available</p>
            {onDownload && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => onDownload(currentFile)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open file
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
            <AlertCircle className="h-12 w-12 mb-3 text-amber-500 opacity-70" />
            <p className="text-sm">Unable to load preview</p>
          </div>
        )}
      </div>
      
      {/* File Navigation (multiple files) */}
      {files.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-3 py-2 border-t border-[var(--border)] bg-[var(--card)] flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Dots or thumbnails */}
          {showThumbnails && files.length <= 8 ? (
            <div className="flex items-center gap-1.5">
              {files.map((file, index) => {
                const Icon = getFileIcon(file.mimeType);
                return (
                  <button
                    key={file.id}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "h-8 w-8 rounded flex items-center justify-center transition-colors",
                      index === currentIndex
                        ? "bg-[var(--cai-teal)] text-white"
                        : "bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--muted-foreground)]"
                    )}
                    title={file.name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {files.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    index === currentIndex
                      ? "bg-[var(--cai-teal)]"
                      : "bg-[var(--muted-foreground)]/30 hover:bg-[var(--muted-foreground)]/50"
                  )}
                />
              ))}
            </div>
          )}
          
          <span className="text-xs text-[var(--muted-foreground)] min-w-[3rem] text-center">
            {currentIndex + 1} / {files.length}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goToNext}
            disabled={currentIndex === files.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Fullscreen Overlay */}
      {isFullscreen && currentUrl && canPreview && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <span className="text-white font-medium">{currentFile?.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            {currentFile.mimeType.startsWith("image/") && (
              <ZoomableImage
                src={currentUrl}
                alt={currentFile.name}
                className="w-full h-full"
                maxZoom={5}
              />
            )}
          </div>
          
          {/* Fullscreen navigation */}
          {files.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-lg bg-black/60 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={goToPrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-white text-sm">
                {currentIndex + 1} / {files.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={goToNext}
                disabled={currentIndex === files.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SourceFilesPanel;

