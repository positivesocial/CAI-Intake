"use client";

/**
 * CAI Intake - Zoomable & Draggable Image Component
 * 
 * Features:
 * - Zoom in/out with buttons or scroll wheel
 * - Pan/drag when zoomed in
 * - Rotation support
 * - Touch gesture support for mobile
 * - Fullscreen toggle
 */

import * as React from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
  /** Minimum zoom level (default: 0.25) */
  minZoom?: number;
  /** Maximum zoom level (default: 4) */
  maxZoom?: number;
  /** Show controls overlay (default: true) */
  showControls?: boolean;
  /** External zoom state (for syncing with parent) */
  zoom?: number;
  /** External rotation state (for syncing with parent) */
  rotation?: number;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when rotation changes */
  onRotationChange?: (rotation: number) => void;
}

export function ZoomableImage({
  src,
  alt,
  className,
  initialZoom = 1,
  minZoom = 0.25,
  maxZoom = 4,
  showControls = true,
  zoom: externalZoom,
  rotation: externalRotation,
  onZoomChange,
  onRotationChange,
}: ZoomableImageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  
  // Internal state (used when no external control)
  const [internalZoom, setInternalZoom] = React.useState(initialZoom);
  const [internalRotation, setInternalRotation] = React.useState(0);
  
  // Pan state
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  const [startOffset, setStartOffset] = React.useState({ x: 0, y: 0 });
  
  // Use external or internal state
  const zoom = externalZoom ?? internalZoom;
  const rotation = externalRotation ?? internalRotation;
  
  const setZoom = React.useCallback((value: number | ((prev: number) => number)) => {
    const newValue = typeof value === "function" ? value(zoom) : value;
    const clampedValue = Math.min(maxZoom, Math.max(minZoom, newValue));
    if (onZoomChange) {
      onZoomChange(clampedValue);
    } else {
      setInternalZoom(clampedValue);
    }
  }, [zoom, minZoom, maxZoom, onZoomChange]);
  
  const setRotation = React.useCallback((value: number | ((prev: number) => number)) => {
    const newValue = typeof value === "function" ? value(rotation) : value;
    if (onRotationChange) {
      onRotationChange(newValue % 360);
    } else {
      setInternalRotation(newValue % 360);
    }
  }, [rotation, onRotationChange]);
  
  // Reset pan when zoom changes to 1 or below
  React.useEffect(() => {
    if (zoom <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoom]);
  
  // Handle mouse wheel zoom
  const handleWheel = React.useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => prev + delta);
    }
  }, [setZoom]);
  
  React.useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);
  
  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setStartOffset({ ...panOffset });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setPanOffset({
      x: startOffset.x + dx,
      y: startOffset.y + dy,
    });
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
  };
  
  // Touch pan handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsPanning(true);
    setPanStart({ x: touch.clientX, y: touch.clientY });
    setStartOffset({ ...panOffset });
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - panStart.x;
    const dy = touch.clientY - panStart.y;
    setPanOffset({
      x: startOffset.x + dx,
      y: startOffset.y + dy,
    });
  };
  
  const handleTouchEnd = () => {
    setIsPanning(false);
  };
  
  // Reset view
  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };
  
  const isPannable = zoom > 1;
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-[var(--muted)]/30 rounded-lg select-none",
        isPannable && "cursor-grab",
        isPanning && "cursor-grabbing",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image Container */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transition-transform duration-150"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>
      
      {/* Pan indicator */}
      {isPannable && !isPanning && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 text-white text-xs">
          <Move className="h-3 w-3" />
          <span>Drag to pan</span>
        </div>
      )}
      
      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => setZoom((z) => z - 0.25)}
            disabled={zoom <= minZoom}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-white text-xs w-12 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => setZoom((z) => z + 0.25)}
            disabled={zoom >= maxZoom}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-5 bg-white/20 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => setRotation((r) => r + 90)}
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={resetView}
            title="Reset view"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default ZoomableImage;

