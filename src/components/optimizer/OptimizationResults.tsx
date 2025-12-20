/**
 * CAI Intake - Optimization Results Component
 * 
 * Displays optimization results including:
 * - Sheet layouts with part placements
 * - Utilization metrics
 * - Statistics summary
 */

"use client";

import * as React from "react";
import {
  Layers,
  Package,
  Percent,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OptimizeResult, NestingLayout, PlacedPart } from "@/lib/optimizer/cai2d-client";

// =============================================================================
// TYPES
// =============================================================================

interface OptimizationResultsProps {
  result: OptimizeResult;
  onExport?: (format: "pdf" | "csv" | "dxf") => void;
  className?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subvalue,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subvalue?: string;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantColors = {
    default: "text-[var(--foreground)]",
    success: "text-green-600",
    warning: "text-yellow-600",
    error: "text-red-600",
  };

  return (
    <div className="bg-[var(--muted)] rounded-lg p-4">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold", variantColors[variant])}>
        {value}
      </div>
      {subvalue && (
        <div className="text-xs text-[var(--muted-foreground)]">{subvalue}</div>
      )}
    </div>
  );
}

function SheetVisualization({
  layout,
  selected,
  onSelect,
}: {
  layout: NestingLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  const scale = 0.15; // Scale factor for visualization
  const width = layout.stockLength * scale;
  const height = layout.stockWidth * scale;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative border-2 rounded-lg overflow-hidden transition-all",
        selected
          ? "border-[var(--cai-teal)] shadow-lg"
          : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
      )}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 bg-[var(--muted)]" />

      {/* Placed parts */}
      {layout.parts.map((part, i) => (
        <div
          key={`${part.partId}-${i}`}
          className="absolute bg-[var(--cai-teal)] border border-[var(--cai-teal)]/50 text-white text-[6px] flex items-center justify-center overflow-hidden"
          style={{
            left: `${part.x * scale}px`,
            top: `${part.y * scale}px`,
            width: `${part.length * scale}px`,
            height: `${part.width * scale}px`,
          }}
          title={`${part.partId}: ${part.length}x${part.width}mm`}
        >
          {part.length * scale > 30 && (
            <span className="truncate px-0.5">{part.partId}</span>
          )}
        </div>
      ))}

      {/* Sheet index label */}
      <div className="absolute top-1 left-1 bg-[var(--card)]/90 rounded px-1.5 py-0.5 text-xs font-medium">
        Sheet {layout.sheetIndex + 1}
      </div>

      {/* Efficiency badge */}
      <div
        className={cn(
          "absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-xs font-medium",
          layout.efficiency >= 0.8
            ? "bg-green-100 text-green-700"
            : layout.efficiency >= 0.6
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
        )}
      >
        {(layout.efficiency * 100).toFixed(1)}%
      </div>
    </button>
  );
}

function SheetDetail({ layout }: { layout: NestingLayout }) {
  const scale = 0.4; // Larger scale for detail view
  const width = layout.stockLength * scale;
  const height = layout.stockWidth * scale;

  // Color palette for parts
  const colors = [
    "bg-[var(--cai-teal)]",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];

  return (
    <div className="space-y-4">
      {/* Large visualization */}
      <div
        className="relative border-2 border-[var(--border)] rounded-lg overflow-hidden mx-auto"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <div className="absolute inset-0 bg-[var(--muted)]" />

        {layout.parts.map((part, i) => (
          <div
            key={`${part.partId}-${i}`}
            className={cn(
              "absolute border border-white/30 text-white text-xs flex items-center justify-center",
              colors[i % colors.length]
            )}
            style={{
              left: `${part.x * scale}px`,
              top: `${part.y * scale}px`,
              width: `${part.length * scale}px`,
              height: `${part.width * scale}px`,
            }}
          >
            <div className="text-center truncate px-1">
              <div className="font-medium">{part.partId}</div>
              <div className="text-[10px] opacity-80">
                {part.length}×{part.width}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Parts list */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Part ID</th>
              <th className="px-3 py-2 text-right font-medium">Position</th>
              <th className="px-3 py-2 text-right font-medium">Size (mm)</th>
              <th className="px-3 py-2 text-center font-medium">Rotated</th>
            </tr>
          </thead>
          <tbody>
            {layout.parts.map((part, i) => (
              <tr key={`${part.partId}-${i}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{part.partId}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  ({part.x}, {part.y})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {part.length} × {part.width}
                </td>
                <td className="px-3 py-2 text-center">
                  {part.rotated ? (
                    <Badge variant="secondary">Yes</Badge>
                  ) : (
                    <span className="text-[var(--muted-foreground)]">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-[var(--muted)] rounded-lg">
          <div className="text-sm text-[var(--muted-foreground)]">Parts</div>
          <div className="text-xl font-bold">{layout.parts.length}</div>
        </div>
        <div className="text-center p-3 bg-[var(--muted)] rounded-lg">
          <div className="text-sm text-[var(--muted-foreground)]">Used Area</div>
          <div className="text-xl font-bold">
            {(layout.usedArea / 1000000).toFixed(2)} m²
          </div>
        </div>
        <div className="text-center p-3 bg-[var(--muted)] rounded-lg">
          <div className="text-sm text-[var(--muted-foreground)]">Waste</div>
          <div className="text-xl font-bold">
            {(layout.wasteArea / 1000000).toFixed(2)} m²
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OptimizationResults({
  result,
  onExport,
  className,
}: OptimizationResultsProps) {
  const [selectedSheet, setSelectedSheet] = React.useState(0);

  const { statistics, layouts, unplacedParts } = result;
  const efficiencyVariant =
    statistics.overallEfficiency >= 0.8
      ? "success"
      : statistics.overallEfficiency >= 0.6
      ? "warning"
      : "error";

  const handlePrevSheet = () => {
    setSelectedSheet((prev) => Math.max(0, prev - 1));
  };

  const handleNextSheet = () => {
    setSelectedSheet((prev) => Math.min(layouts.length - 1, prev + 1));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {result.success ? (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {result.success ? "Optimization Complete" : "Optimization Failed"}
            </h2>
            {result.computeTime && (
              <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Computed in {result.computeTime}ms
              </p>
            )}
          </div>
        </div>

        {onExport && result.success && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onExport("pdf")}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        )}
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          label="Sheets Required"
          value={statistics.totalSheets}
          subvalue={`${(statistics.totalArea / 1000000).toFixed(2)} m² total`}
        />
        <StatCard
          icon={Package}
          label="Parts Placed"
          value={statistics.totalParts}
          subvalue={
            unplacedParts.length > 0
              ? `${unplacedParts.length} unplaced`
              : "All parts placed"
          }
        />
        <StatCard
          icon={Percent}
          label="Efficiency"
          value={`${(statistics.overallEfficiency * 100).toFixed(1)}%`}
          subvalue={`${(statistics.wasteArea / 1000000).toFixed(2)} m² waste`}
          variant={efficiencyVariant}
        />
        {statistics.totalCost !== undefined && (
          <StatCard
            icon={DollarSign}
            label="Material Cost"
            value={`$${statistics.totalCost.toFixed(2)}`}
          />
        )}
      </div>

      {/* Efficiency Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Material Utilization</span>
            <span className="text-sm text-[var(--muted-foreground)]">
              {(statistics.usedArea / 1000000).toFixed(2)} m² used /{" "}
              {(statistics.totalArea / 1000000).toFixed(2)} m² total
            </span>
          </div>
          <Progress
            value={statistics.overallEfficiency * 100}
            variant={efficiencyVariant}
          />
        </CardContent>
      </Card>

      {/* Sheet Layouts */}
      {layouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Sheet Layouts</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevSheet}
                  disabled={selectedSheet === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-normal text-[var(--muted-foreground)]">
                  Sheet {selectedSheet + 1} of {layouts.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextSheet}
                  disabled={selectedSheet === layouts.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Sheet thumbnails */}
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
              {layouts.map((layout, index) => (
                <SheetVisualization
                  key={index}
                  layout={layout}
                  selected={index === selectedSheet}
                  onSelect={() => setSelectedSheet(index)}
                />
              ))}
            </div>

            {/* Selected sheet detail */}
            {layouts[selectedSheet] && (
              <SheetDetail layout={layouts[selectedSheet]} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Unplaced Parts Warning */}
      {unplacedParts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Unplaced Parts ({unplacedParts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-3">
              The following parts could not be placed on any sheet. They may be
              too large for the available stock or there was insufficient space.
            </p>
            <div className="flex flex-wrap gap-2">
              {unplacedParts.map((partId) => (
                <Badge key={partId} variant="error">
                  {partId}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {result.errors && result.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-700">Errors</h3>
                <ul className="mt-2 text-sm text-red-600 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

