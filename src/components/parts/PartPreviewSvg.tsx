"use client";

/**
 * CAI Intake - Enhanced Part Preview SVG
 * 
 * Renders a 2D schematic preview of a part showing:
 * - Part outline (with grain direction)
 * - Edgebanding (colored edge strokes)
 * - Grooves (dashed lines)
 * - Holes (circles, color-coded by type)
 * - Pockets/cutouts (filled rectangles)
 * - Corner rounds (arc paths)
 * - Service badges (when details too small to show)
 * 
 * Coordinate System:
 * - Origin (0,0) = bottom-left corner
 * - X axis: 0 → L (length in mm)
 * - Y axis: 0 → W (width in mm)
 * - SVG is rendered with Y-axis flipped (origin at top-left for SVG)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  PartPreviewData,
  PreviewEdgeband,
  PreviewGroove,
  PreviewHole,
  PreviewPocket,
  PreviewCornerRound,
  PreviewSize,
} from "@/lib/services/preview-types";
import {
  PREVIEW_SIZE_CONFIGS,
  SERVICE_COLORS,
  generateServiceBadges,
  hasPreviewServices,
} from "@/lib/services/preview-types";

// ============================================================
// TYPES
// ============================================================

export interface PartPreviewSvgProps {
  /** Preview data (use convertOpsToPreview to generate) */
  data: PartPreviewData;
  
  /** Size preset */
  size?: PreviewSize;
  
  /** Custom max pixel size (overrides preset) */
  maxPx?: number;
  
  /** Show tooltips on hover */
  showTooltips?: boolean;
  
  /** Show service badges */
  showBadges?: boolean;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Click handler */
  onClick?: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function PartPreviewSvg({
  data,
  size = "sm",
  maxPx,
  showTooltips = true,
  showBadges = true,
  className,
  onClick,
}: PartPreviewSvgProps) {
  const config = PREVIEW_SIZE_CONFIGS[size];
  const actualMaxPx = maxPx ?? config.maxPx;
  
  // Calculate scale
  const maxMm = Math.max(data.L, data.W);
  const scale = (actualMaxPx * 0.85) / maxMm; // Leave some padding
  
  // SVG dimensions
  const svgWidth = Math.ceil(data.L * scale);
  const svgHeight = Math.ceil(data.W * scale);
  
  // Pixel converter (mm to px)
  const px = (mm: number) => mm * scale;
  
  // Y-flip for SVG (SVG origin is top-left, our coords are bottom-left)
  const flipY = (y: number) => svgHeight - y * scale;
  
  // Check if we should show details or just badges
  const showDetails = config.showDetails && scale > 0.1;
  const hasServices = hasPreviewServices(data);
  
  // Generate badges for small previews
  const badges = showBadges && !showDetails && hasServices
    ? generateServiceBadges(data)
    : [];
  
  return (
    <div
      className={cn(
        "relative inline-block",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="rounded overflow-visible"
        style={{
          background: "var(--muted)",
        }}
      >
        {/* 1. Background / Part Outline */}
        <rect
          x={0}
          y={0}
          width={svgWidth}
          height={svgHeight}
          fill="var(--card)"
          stroke="var(--border)"
          strokeWidth={1.5}
        />
        
        {/* 2. Grain direction lines */}
        {data.grain === "along_L" && (
          <GrainLines
            svgWidth={svgWidth}
            svgHeight={svgHeight}
          />
        )}
        
        {/* 3. Pockets/cutouts (render before holes/grooves) */}
        {showDetails && data.pockets.map((pocket) => (
          <PocketShape
            key={pocket.id}
            pocket={pocket}
            px={px}
            flipY={flipY}
            showTooltips={config.showTooltips && showTooltips}
          />
        ))}
        
        {/* 4. Corner rounds (clip path would be better but keeping simple for now) */}
        {showDetails && data.cornerRounds.map((corner) => (
          <CornerRoundIndicator
            key={corner.corner}
            corner={corner}
            svgWidth={svgWidth}
            svgHeight={svgHeight}
            px={px}
          />
        ))}
        
        {/* 5. Grooves */}
        {showDetails && data.grooves.map((groove) => (
          <GrooveLine
            key={groove.id}
            groove={groove}
            px={px}
            flipY={flipY}
            showTooltips={config.showTooltips && showTooltips}
          />
        ))}
        
        {/* 6. Holes */}
        {showDetails && data.holes.map((hole) => (
          <HoleCircle
            key={hole.id}
            hole={hole}
            px={px}
            flipY={flipY}
            showTooltips={config.showTooltips && showTooltips}
          />
        ))}
        
        {/* 7. Edgebanding (render on top) */}
        {data.edgebands.map((edgeband) => (
          <EdgebandLine
            key={edgeband.edge}
            edgeband={edgeband}
            svgWidth={svgWidth}
            svgHeight={svgHeight}
            strokeWidth={config.edgeStrokePx}
          />
        ))}
      </svg>
      
      {/* Service badges (for small previews) */}
      {badges.length > 0 && (
        <div className="absolute bottom-0 right-0 flex gap-0.5 p-0.5">
          {badges.map((badge) => (
            <span
              key={badge.type}
              className="text-[8px] font-bold px-1 rounded"
              style={{
                backgroundColor: badge.color,
                color: "white",
              }}
              title={`${badge.count} ${badge.type}(s)`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// RENDER HELPERS
// ============================================================

/**
 * Grain direction indicator lines
 */
function GrainLines({
  svgWidth,
  svgHeight,
}: {
  svgWidth: number;
  svgHeight: number;
}) {
  const lineCount = 3;
  const lines: React.ReactNode[] = [];
  
  for (let i = 1; i <= lineCount; i++) {
    const y = (svgHeight / (lineCount + 1)) * i;
    lines.push(
      <line
        key={`grain-${i}`}
        x1={4}
        y1={y}
        x2={svgWidth - 4}
        y2={y}
        stroke="var(--muted-foreground)"
        strokeWidth={0.5}
        strokeDasharray="3 2"
        opacity={0.4}
      />
    );
  }
  
  return <>{lines}</>;
}

/**
 * Edgeband edge line
 */
function EdgebandLine({
  edgeband,
  svgWidth,
  svgHeight,
  strokeWidth,
}: {
  edgeband: PreviewEdgeband;
  svgWidth: number;
  svgHeight: number;
  strokeWidth: number;
}) {
  const color = edgeband.color ?? SERVICE_COLORS.edgeband.default;
  
  // Calculate line position based on edge
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  
  switch (edgeband.position) {
    case "front": // L1 - bottom edge in our coords, but top in SVG (y=svgHeight)
      x1 = 0; y1 = svgHeight;
      x2 = svgWidth; y2 = svgHeight;
      break;
    case "back": // L2 - top edge in our coords, but bottom in SVG (y=0)
      x1 = 0; y1 = 0;
      x2 = svgWidth; y2 = 0;
      break;
    case "left": // W1 - left edge
      x1 = 0; y1 = 0;
      x2 = 0; y2 = svgHeight;
      break;
    case "right": // W2 - right edge
      x1 = svgWidth; y1 = 0;
      x2 = svgWidth; y2 = svgHeight;
      break;
  }
  
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      {edgeband.thicknessMm && (
        <title>
          Edge {edgeband.edge}: {edgeband.thicknessMm}mm
          {edgeband.materialName && ` (${edgeband.materialName})`}
        </title>
      )}
    </line>
  );
}

/**
 * Groove line
 */
function GrooveLine({
  groove,
  px,
  flipY,
  showTooltips,
}: {
  groove: PreviewGroove;
  px: (mm: number) => number;
  flipY: (y: number) => number;
  showTooltips: boolean;
}) {
  const strokeWidth = Math.max(1, Math.min(px(groove.widthMm), 4));
  
  return (
    <line
      x1={px(groove.x1)}
      y1={flipY(groove.y1)}
      x2={px(groove.x2)}
      y2={flipY(groove.y2)}
      stroke={SERVICE_COLORS.groove.default}
      strokeWidth={strokeWidth}
      strokeDasharray="4 2"
      strokeLinecap="round"
      opacity={0.9}
    >
      {showTooltips && (
        <title>
          Groove on {groove.alongEdge}: {groove.widthMm}mm wide, {groove.depthMm}mm deep, {groove.offsetMm}mm from edge
        </title>
      )}
    </line>
  );
}

/**
 * Hole circle
 */
function HoleCircle({
  hole,
  px,
  flipY,
  showTooltips,
}: {
  hole: PreviewHole;
  px: (mm: number) => number;
  flipY: (y: number) => number;
  showTooltips: boolean;
}) {
  // Get color based on usage
  const usageKey = hole.usage as keyof typeof SERVICE_COLORS.hole;
  const fill = SERVICE_COLORS.hole[usageKey] ?? SERVICE_COLORS.hole.other;
  
  // Calculate radius with minimum visibility
  const radiusPx = Math.max(2, px(hole.diameterMm / 2));
  
  return (
    <circle
      cx={px(hole.x)}
      cy={flipY(hole.y)}
      r={radiusPx}
      fill={fill}
      opacity={0.85}
    >
      {showTooltips && (
        <title>
          {hole.description ?? `${hole.diameterMm}mm ${hole.usage} hole`}
        </title>
      )}
    </circle>
  );
}

/**
 * Pocket/cutout rectangle
 */
function PocketShape({
  pocket,
  px,
  flipY,
  showTooltips,
}: {
  pocket: PreviewPocket;
  px: (mm: number) => number;
  flipY: (y: number) => number;
  showTooltips: boolean;
}) {
  const kindKey = pocket.kind as keyof typeof SERVICE_COLORS.pocket;
  const fill = SERVICE_COLORS.pocket[kindKey] ?? SERVICE_COLORS.pocket.pocket;
  
  // Calculate position - note Y needs to account for height
  const x = px(pocket.x);
  const y = flipY(pocket.y + pocket.height); // Top of rect in SVG coords
  const width = px(pocket.width);
  const height = px(pocket.height);
  
  // Different styling based on kind
  const isCutout = pocket.kind === "cutout";
  
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={isCutout ? "var(--muted)" : fill}
      stroke={fill}
      strokeWidth={isCutout ? 2 : 1}
      strokeDasharray={isCutout ? "4 2" : undefined}
      opacity={isCutout ? 0.8 : 0.4}
      rx={2}
    >
      {showTooltips && (
        <title>
          {pocket.purpose ?? pocket.kind}: {pocket.width}x{pocket.height}mm
          {pocket.depthMm && `, ${pocket.depthMm}mm deep`}
        </title>
      )}
    </rect>
  );
}

/**
 * Corner round indicator
 * Draws a small arc to show rounded corner
 */
function CornerRoundIndicator({
  corner,
  svgWidth,
  svgHeight,
  px,
}: {
  corner: PreviewCornerRound;
  svgWidth: number;
  svgHeight: number;
  px: (mm: number) => number;
}) {
  const r = Math.min(px(corner.radiusMm), Math.min(svgWidth, svgHeight) / 3);
  
  // Calculate arc path based on corner
  let cx: number, cy: number;
  let startAngle: number;
  
  switch (corner.corner) {
    case "BL": // Bottom-left (origin in our coords, but top-left in SVG after flip)
      cx = 0; cy = svgHeight;
      startAngle = 90;
      break;
    case "BR": // Bottom-right
      cx = svgWidth; cy = svgHeight;
      startAngle = 180;
      break;
    case "TL": // Top-left (our coords) = bottom-left in SVG
      cx = 0; cy = 0;
      startAngle = 0;
      break;
    case "TR": // Top-right
      cx = svgWidth; cy = 0;
      startAngle = 270;
      break;
    default:
      return null;
  }
  
  // Arc path for quarter circle
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + 90) * Math.PI) / 180;
  
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  
  const path = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  
  return (
    <path
      d={path}
      fill="none"
      stroke={SERVICE_COLORS.cornerRound.default}
      strokeWidth={2}
      opacity={0.8}
    >
      <title>
        {corner.corner} corner: R{corner.radiusMm}mm
      </title>
    </path>
  );
}

// ============================================================
// SIMPLIFIED PREVIEW (for backward compatibility)
// ============================================================

export interface SimplePartPreviewProps {
  L: number;
  W: number;
  /** Whether rotation is allowed (if false, shows grain lines) */
  allow_rotation?: boolean;
  edging?: Record<string, { apply?: boolean }>;
  className?: string;
}

/**
 * Simple part preview
 */
export function SimplePartPreview({
  L,
  W,
  allow_rotation = true,
  edging,
  className,
}: SimplePartPreviewProps) {
  // Convert edging to preview format
  const edgebands: PreviewEdgeband[] = [];
  
  if (edging) {
    for (const [edge, config] of Object.entries(edging)) {
      if (config?.apply && ["L1", "L2", "W1", "W2"].includes(edge)) {
        const previewEdge = {
          L1: "front",
          L2: "back",
          W1: "left",
          W2: "right",
        }[edge] as "front" | "back" | "left" | "right";
        
        edgebands.push({
          edge: edge as "L1" | "L2" | "W1" | "W2",
          position: previewEdge,
        });
      }
    }
  }
  
  const data: PartPreviewData = {
    L,
    W,
    // Show grain lines if part cannot rotate (respects material grain)
    grain: allow_rotation === false ? "along_L" : "none",
    edgebands,
    grooves: [],
    holes: [],
    pockets: [],
    cornerRounds: [],
  };
  
  return (
    <PartPreviewSvg
      data={data}
      size="sm"
      showBadges={false}
      className={className}
    />
  );
}

export default PartPreviewSvg;





