/**
 * CAI Intake - Optimization Results Component
 * 
 * Displays optimization results including:
 * - Sheet layouts with part placements
 * - Utilization metrics
 * - Statistics summary
 * 
 * Supports the new CAI 2D API format.
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
import type { OptimizeResult, Sheet, Placement } from "@/lib/optimizer/cai2d-client";

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
  sheet,
  selected,
  onSelect,
}: {
  sheet: Sheet;
  selected: boolean;
  onSelect: () => void;
}) {
  const scale = 0.15; // Scale factor for visualization
  const width = sheet.size.L * scale;
  const height = sheet.size.W * scale;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative border-2 rounded-lg overflow-hidden transition-all",
        selected
          ? "border-[var(--cai-teal)] ring-2 ring-[var(--cai-teal)] ring-opacity-30"
          : "border-[var(--border)] hover:border-[var(--cai-teal)]"
      )}
      style={{ width: `${width}px`, height: `${height}px`, minWidth: `${width}px` }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--muted)]" />

      {/* Placements */}
      {sheet.placements.map((placement, idx) => {
        const x = placement.x * scale;
        const y = placement.y * scale;
        const w = placement.w * scale;
        const h = placement.h * scale;

        return (
          <div
            key={idx}
            className="absolute bg-[var(--cai-teal)] opacity-80 border border-white/50"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
            }}
          />
        );
      })}

      {/* Sheet number */}
      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
        #{sheet.sheet_no}
      </div>

      {/* Efficiency badge */}
      <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
        {sheet.efficiency.toFixed(0)}%
      </div>
    </button>
  );
}

function SheetDetail({ sheet }: { sheet: Sheet }) {
  const scale = 0.2;
  const width = sheet.size.L * scale;
  const height = sheet.size.W * scale;

  return (
    <div className="space-y-4">
      {/* Large visualization */}
      <div
        className="relative bg-[var(--muted)] border border-[var(--border)] rounded-lg overflow-hidden mx-auto"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* Usable area indicator */}
        <div
          className="absolute border border-dashed border-gray-400"
          style={{
            left: `${sheet.usable_rect.x * scale}px`,
            top: `${sheet.usable_rect.y * scale}px`,
            width: `${sheet.usable_rect.w * scale}px`,
            height: `${sheet.usable_rect.h * scale}px`,
          }}
        />
        
        {/* Placements */}
        {sheet.placements.map((placement, idx) => {
          const x = placement.x * scale;
          const y = placement.y * scale;
          const w = placement.w * scale;
          const h = placement.h * scale;

          return (
            <div
              key={idx}
              className="absolute bg-[var(--cai-teal)] opacity-80 border border-white flex items-center justify-center"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${w}px`,
                height: `${h}px`,
              }}
              title={`${placement.part_id}: ${placement.w}×${placement.h}mm${placement.rotated ? " (rotated)" : ""}`}
            >
              <span
                className="text-white font-medium truncate px-1"
                style={{ fontSize: `${Math.max(8, Math.min(w, h) * 0.12)}px` }}
              >
                {placement.part_id.split("-")[0]}
              </span>
            </div>
          );
        })}

        {/* Dimension labels */}
        <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-[var(--muted-foreground)]">
          {sheet.size.L}mm
        </div>
        <div
          className="absolute -left-10 top-0 bottom-0 flex items-center text-xs text-[var(--muted-foreground)]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {sheet.size.W}mm
        </div>
      </div>

      {/* Sheet info */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-[var(--muted-foreground)]">Sheet Size:</span>
          <span className="ml-2 font-medium">
            {sheet.size.L} × {sheet.size.W}mm
          </span>
        </div>
        <div>
          <span className="text-[var(--muted-foreground)]">Parts:</span>
          <span className="ml-2 font-medium">{sheet.placements.length}</span>
        </div>
        <div>
          <span className="text-[var(--muted-foreground)]">Efficiency:</span>
          <span className="ml-2 font-medium">{sheet.efficiency.toFixed(1)}%</span>
        </div>
      </div>

      {/* Parts list */}
      <div>
        <h4 className="text-sm font-medium mb-2">Parts on this sheet:</h4>
        <div className="flex flex-wrap gap-2">
          {sheet.placements.map((placement, idx) => (
            <Badge
              key={idx}
              variant={placement.rotated ? "warning" : "secondary"}
              title={placement.rotated ? "Rotated 90°" : undefined}
            >
              {placement.instance_id || placement.part_id}
              {placement.rotated && " ↻"}
            </Badge>
          ))}
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

  // Extract data from new API format
  const isSuccess = result.ok && result.result?.status === "ok";
  const sheets = result.result?.sheets ?? [];
  const summary = result.result?.summary;
  
  // Calculate statistics
  const totalSheets = summary?.sheets_used ?? sheets.length;
  const totalPieces = sheets.reduce((sum, s) => sum + s.placements.length, 0);
  const utilization = summary?.utilization_pct ?? 0;
  const wasteArea = summary?.waste_area ?? 0;
  const totalStockArea = sheets.reduce((sum, s) => sum + s.size.L * s.size.W, 0);
  const usedArea = totalStockArea - wasteArea;
  
  const efficiencyVariant =
    utilization >= 80
      ? "success"
      : utilization >= 60
      ? "warning"
      : "error";

  const handlePrevSheet = () => {
    setSelectedSheet((prev) => Math.max(0, prev - 1));
  };

  const handleNextSheet = () => {
    setSelectedSheet((prev) => Math.min(sheets.length - 1, prev + 1));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuccess ? (
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
              {isSuccess ? "Optimization Complete" : "Optimization Failed"}
            </h2>
            {result.timing_ms && (
              <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Computed in {result.timing_ms.toFixed(0)}ms
                {result.mode && ` (${result.mode})`}
              </p>
            )}
          </div>
        </div>

        {onExport && isSuccess && (
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
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Layers}
            label="Sheets Required"
            value={totalSheets}
            subvalue={`${(totalStockArea / 1000000).toFixed(2)} m² total`}
          />
          <StatCard
            icon={Package}
            label="Parts Placed"
            value={totalPieces}
            subvalue="All parts placed"
          />
          <StatCard
            icon={Percent}
            label="Efficiency"
            value={`${utilization.toFixed(1)}%`}
            subvalue={`${(wasteArea / 1000000).toFixed(2)} m² waste`}
            variant={efficiencyVariant}
          />
          {summary.total_edgeband_length_mm !== undefined && summary.total_edgeband_length_mm > 0 && (
            <StatCard
              icon={Package}
              label="Edgebanding"
              value={`${(summary.total_edgeband_length_mm / 1000).toFixed(1)}m`}
              subvalue="Total length"
            />
          )}
        </div>
      )}

      {/* Efficiency Progress */}
      {summary && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Material Utilization</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {(usedArea / 1000000).toFixed(2)} m² used /{" "}
                {(totalStockArea / 1000000).toFixed(2)} m² total
              </span>
            </div>
            <Progress
              value={utilization}
              variant={efficiencyVariant}
            />
          </CardContent>
        </Card>
      )}

      {/* Sheet Layouts */}
      {sheets.length > 0 && (
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
                  Sheet {selectedSheet + 1} of {sheets.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextSheet}
                  disabled={selectedSheet === sheets.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Sheet thumbnails */}
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
              {sheets.map((sheet, index) => (
                <SheetVisualization
                  key={index}
                  sheet={sheet}
                  selected={index === selectedSheet}
                  onSelect={() => setSelectedSheet(index)}
                />
              ))}
            </div>

            {/* Selected sheet detail */}
            {sheets[selectedSheet] && (
              <SheetDetail sheet={sheets[selectedSheet]} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {result.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-700">Error</h3>
                <p className="mt-1 text-sm text-red-600">{result.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {result.errors && result.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-700">Validation Errors</h3>
                <ul className="mt-2 text-sm text-red-600 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>
                      <span className="font-mono text-xs">{error.path}:</span> {error.message}
                    </li>
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
