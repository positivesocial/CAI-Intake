"use client";

import * as React from "react";
import { RefreshCw, FileText, ExternalLink, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PdfPreviewProps {
  url: string;
  fileName: string;
  fileId?: string; // If provided, uses proxy URL for iframe embedding
  className?: string;
}

export function PdfPreview({ url, fileName, fileId, className }: PdfPreviewProps) {
  const [loading, setLoading] = React.useState(true);
  const [showFallback, setShowFallback] = React.useState(false);
  
  // Use proxy URL if fileId is provided (bypasses X-Frame-Options)
  const proxyUrl = fileId ? `/api/v1/files/proxy/${fileId}` : null;
  const embedUrl = proxyUrl || url;

  // Handle iframe load error
  const handleIframeError = () => {
    setLoading(false);
    setShowFallback(true);
  };

  // Handle successful load
  const handleIframeLoad = () => {
    setLoading(false);
  };

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
