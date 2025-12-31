"use client";

import * as React from "react";
import { 
  RefreshCw, 
  FileText, 
  ExternalLink, 
  Download, 
  Eye,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PdfPreviewProps {
  url: string;
  fileName: string;
  fileId?: string; // If provided, uses proxy URL for iframe embedding
  className?: string;
}

// We'll use canvas-based rendering for blob: URLs and iframe for http(s): URLs
function isBlobUrl(url: string): boolean {
  return url.startsWith("blob:");
}

export function PdfPreview({ url, fileName, fileId, className }: PdfPreviewProps) {
  const [loading, setLoading] = React.useState(true);
  const [showFallback, setShowFallback] = React.useState(false);
  const [pageImages, setPageImages] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [useNativeEmbed, setUseNativeEmbed] = React.useState(false);
  
  // Compute these regardless of whether url is defined (for hook consistency)
  const proxyUrl = url && fileId && !isBlobUrl(url) ? `/api/v1/files/proxy/${fileId}` : null;
  const embedUrl = proxyUrl || url || "";
  const useBlobRendering = url ? isBlobUrl(url) : false;

  // For blob URLs, try server-side conversion first, fall back to native embed
  React.useEffect(() => {
    if (!url || !useBlobRendering) {
      setLoading(false);
      return;
    }
    
    async function renderBlobPdf() {
      try {
        setLoading(true);
        
        // Fetch the blob and convert to base64
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Create FormData to send to our PDF conversion endpoint
        const formData = new FormData();
        formData.append("file", blob, fileName);
        formData.append("action", "preview");
        
        // Use our existing PDF-to-images conversion
        const convertResponse = await fetch("/api/v1/pdf-preview", {
          method: "POST",
          body: formData,
        });
        
        if (!convertResponse.ok) {
          console.warn("PDF-to-images conversion failed, using native embed");
          // Fall back to native browser PDF rendering
          setUseNativeEmbed(true);
          setLoading(false);
          return;
        }
        
        const data = await convertResponse.json();
        
        if (data.success && data.images && data.images.length > 0) {
          // Images are base64 encoded PNG
          setPageImages(data.images.map((img: string) => 
            img.startsWith("data:") ? img : `data:image/png;base64,${img}`
          ));
          setCurrentPage(0);
        } else {
          console.warn("PDF conversion returned no images, using native embed");
          setUseNativeEmbed(true);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("PDF preview error:", error);
        // Fall back to native browser embed
        setUseNativeEmbed(true);
        setLoading(false);
      }
    }
    
    renderBlobPdf();
  }, [url, fileName, useBlobRendering]);

  // Handle iframe load error (for non-blob URLs)
  const handleIframeError = () => {
    setLoading(false);
    setShowFallback(true);
  };

  // Handle successful iframe load
  const handleIframeLoad = () => {
    setLoading(false);
  };

  // Navigation and zoom controls for blob rendering
  const goToPrevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(pageImages.length - 1, p + 1));
  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  // Handle missing URL - show loading/unavailable state
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800", className)}>
        <div className="flex flex-col items-center text-center p-8 max-w-md">
          <div className="w-20 h-24 bg-white dark:bg-slate-700 rounded-lg shadow-lg flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-600">
            <FileText className="h-10 w-10 text-orange-500" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-[var(--foreground)]">{fileName}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            PDF preview is loading...
          </p>
        </div>
      </div>
    );
  }

  // Show nice fallback with action buttons
  if (showFallback) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800", className)}>
        <div className="flex flex-col items-center text-center p-8 max-w-md">
          <div className="w-20 h-24 bg-white dark:bg-slate-700 rounded-lg shadow-lg flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-600">
            <FileText className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-[var(--foreground)]">{fileName}</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            PDF preview is not available. Use the buttons below to view the document.
          </p>
          <div className="flex gap-3">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="default" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                Open PDF
              </Button>
            </a>
            <a href={url} download={fileName}>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Blob URL rendering - either converted images or native embed
  if (useBlobRendering) {
    // If we're using native embed (conversion failed), use object element
    if (useNativeEmbed && !loading) {
      return (
        <div className={cn("relative w-full h-full flex flex-col", className)}>
          {/* Native PDF embed using object tag */}
          <object
            data={url}
            type="application/pdf"
            className="w-full flex-1"
            title={fileName}
          >
            {/* Fallback if object doesn't work */}
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] p-8">
              <FileText className="h-12 w-12 mb-4 text-red-500" />
              <p className="text-sm mb-4">Your browser cannot display this PDF inline.</p>
              <div className="flex gap-3">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Button variant="default" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Open PDF
                  </Button>
                </a>
                <a href={url} download={fileName}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>
            </div>
          </object>
          
          {/* Controls bar */}
          <div className="flex items-center justify-end px-3 py-2 border-t border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center gap-1">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">Open in new tab</span>
                </Button>
              </a>
              <a href={url} download={fileName}>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">Download</span>
                </Button>
              </a>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={cn("relative w-full h-full flex flex-col", className)}>
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--muted)]/50 z-10">
            <div className="flex flex-col items-center text-[var(--muted-foreground)]">
              <RefreshCw className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">Converting PDF for preview...</p>
            </div>
          </div>
        )}
        
        {/* Image display area */}
        {!loading && pageImages.length > 0 && (
          <>
            <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-800 flex items-center justify-center p-4">
              <img
                src={pageImages[currentPage]}
                alt={`${fileName} - Page ${currentPage + 1}`}
                className="max-w-full max-h-full object-contain shadow-lg bg-white"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
            
            {/* Controls bar */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border)] bg-[var(--card)]">
              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-[var(--muted-foreground)]">
                  Page {currentPage + 1} of {pageImages.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToNextPage}
                  disabled={currentPage === pageImages.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Zoom and rotate controls */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-[var(--muted-foreground)] w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={rotate}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Open/Download buttons */}
              <div className="flex items-center gap-1">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="text-xs hidden sm:inline">Open</span>
                  </Button>
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Non-blob URL: For http(s) URLs with valid server URLs, try iframe
  // But check if the URL looks valid first
  const isValidHttpUrl = embedUrl.startsWith("http://") || embedUrl.startsWith("https://");
  
  if (!isValidHttpUrl) {
    // Invalid URL (not blob, not http/https) - show fallback
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800", className)}>
        <div className="flex flex-col items-center text-center p-8 max-w-md">
          <div className="w-20 h-24 bg-white dark:bg-slate-700 rounded-lg shadow-lg flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-600">
            <FileText className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-[var(--foreground)]">{fileName}</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            PDF preview unavailable. The file may still be uploading.
          </p>
          {url && (
            <div className="flex gap-3">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="default" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Open PDF
                </Button>
              </a>
              <a href={url} download={fileName}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Valid HTTP(S) URL: use iframe
  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--muted)]/50 z-10 rounded-lg">
          <div className="flex flex-col items-center text-[var(--muted-foreground)]">
            <RefreshCw className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading PDF...</p>
          </div>
        </div>
      )}
      
      {/* PDF iframe */}
      <iframe
        src={`${embedUrl}#view=FitH&toolbar=1`}
        className="w-full h-full border-0 rounded-lg bg-white"
        title={fileName}
        onError={handleIframeError}
        onLoad={handleIframeLoad}
      />
      
      {/* Open in new tab button */}
      <div className="absolute top-2 right-2 flex gap-1">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm" className="h-8 gap-1.5 shadow-md">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="text-xs">Open</span>
          </Button>
        </a>
      </div>
    </div>
  );
}
