"use client";

import * as React from "react";
import {
  Loader2,
  Settings2,
  LayoutGrid,
  FileText,
  Scissors,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CutPart, MaterialDef } from "@/lib/schema";
import type {
  OptimizeResult,
  MachineSettings,
  RunConfig,
  RenderOptions,
  CustomerInfo,
} from "@/lib/optimizer/cai2d-client";

// ============================================================
// TYPES
// ============================================================

/** Minimal cutlist data needed for optimization */
interface CutlistData {
  doc_id: string;
  name?: string;
  parts: CutPart[];
  materials: MaterialDef[];
}

interface OptimizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cutlist: CutlistData;
}

type OptimizationStatus = "idle" | "running" | "success" | "error";

interface OptimizationState {
  status: OptimizationStatus;
  result: OptimizeResult | null;
  error: string | null;
  startTime: number | null;
  endTime: number | null;
}

// ============================================================
// COMPONENT
// ============================================================

export function OptimizerModal({
  open,
  onOpenChange,
  cutlist,
}: OptimizerModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = React.useState<"settings" | "results">("settings");
  
  // Settings state
  const [machineSettings, setMachineSettings] = React.useState<MachineSettings>({
    type: "panel_saw",
    profile_id: "default",
    kerf: 4,
    trim_margin: { L1: 10, L2: 10, W1: 10, W2: 10 },
    min_offcut_L: 200,
    min_offcut_W: 100,
    panel_saw: {
      workflow: "auto",
      guillotine_mode: "strip_shelf",
    },
  });
  
  const [runConfig, setRunConfig] = React.useState<RunConfig>({
    mode: "guillotine",
    search: "beam",
    runs: 30,
  });
  
  const [renderOptions, setRenderOptions] = React.useState<RenderOptions>({
    svg: true,
    showLabels: true,
    showCutNumbers: true,
    showFreeRects: false,
    showEdgeDimensions: true,
  });
  
  const [customerInfo, setCustomerInfo] = React.useState<CustomerInfo>({
    customer_name: "",
    project_name: cutlist.name || "",
    notes: "",
  });

  // Optimization state
  const [optState, setOptState] = React.useState<OptimizationState>({
    status: "idle",
    result: null,
    error: null,
    startTime: null,
    endTime: null,
  });

  // Calculate preview stats
  const totalParts = cutlist.parts.length;
  const totalPieces = cutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const totalArea = cutlist.parts.reduce(
    (sum, p) => sum + p.qty * p.size.L * p.size.W,
    0
  ) / 1_000_000; // m²
  const materialsCount = new Set(cutlist.parts.map((p) => p.material_id)).size;

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setActiveTab("settings");
      setOptState({
        status: "idle",
        result: null,
        error: null,
        startTime: null,
        endTime: null,
      });
      setCustomerInfo(prev => ({
        ...prev,
        project_name: cutlist.name || "",
      }));
    }
  }, [open, cutlist.name]);

  // Run optimization
  const handleOptimize = async () => {
    setOptState({
      status: "running",
      result: null,
      error: null,
      startTime: Date.now(),
      endTime: null,
    });

    try {
      const response = await fetch("/api/v1/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cutlistId: cutlist.doc_id,
          parts: cutlist.parts,
          materials: cutlist.materials,
          jobName: cutlist.name,
          customer: customerInfo.customer_name ? customerInfo : undefined,
          machineSettings,
          runConfig,
          renderOptions,
        }),
      });

      const result: OptimizeResult = await response.json();

      if (result.ok && result.result) {
        setOptState({
          status: "success",
          result,
          error: null,
          startTime: optState.startTime,
          endTime: Date.now(),
        });
        setActiveTab("results");
      } else {
        const errorMsg = result.error || 
          (result.errors?.map(e => `${e.path}: ${e.message}`).join(", ")) ||
          "Unknown error";
        setOptState({
          status: "error",
          result: null,
          error: errorMsg,
          startTime: optState.startTime,
          endTime: Date.now(),
        });
      }
    } catch (error) {
      setOptState({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : "Network error",
        startTime: optState.startTime,
        endTime: Date.now(),
      });
    }
  };

  // Download PDF report
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch("/api/v1/optimize/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          cutlistId: cutlist.doc_id,
          parts: cutlist.parts,
          materials: cutlist.materials,
          jobName: cutlist.name,
          customer: customerInfo,
          machineSettings,
          runConfig,
          renderOptions,
          result: optState.result,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `PDF export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cutlist.name || "cutlist"}-optimization.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert(`PDF download failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] sm:h-auto sm:max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* Header - Fixed */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center flex-shrink-0">
              <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--cai-teal)]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg">CAI 2D Panel Optimizer</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Configure settings and generate cutting layouts
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs - Fixed */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "settings" | "results")} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 sm:px-6 py-2 border-b border-[var(--border)] flex-shrink-0">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="settings" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger 
                value="results" 
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
                disabled={optState.status !== "success"}
              >
                <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Results
                {optState.status === "success" && (
                  <Badge variant="teal" className="ml-1 text-[10px] sm:text-xs">
                    {optState.result?.result?.summary.sheets_used} sheets
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Settings Tab - Scrollable */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto m-0">
            <div className="space-y-5 sm:space-y-6 p-4 sm:p-6">
              {/* Summary Card */}
              <Card className="bg-[var(--muted)]/30">
                <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                    <div>
                      <p className="text-xl sm:text-2xl font-bold text-[var(--cai-teal)]">{totalParts}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">Part Types</p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{totalPieces}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">Total Pieces</p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{totalArea.toFixed(2)}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">Area (m²)</p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{materialsCount}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">Materials</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Machine Settings */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Machine Settings
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="kerf" className="text-[10px] sm:text-xs">Blade Kerf (mm)</Label>
                    <Input
                      id="kerf"
                      type="number"
                      value={machineSettings.kerf}
                      onChange={(e) => setMachineSettings(prev => ({
                        ...prev,
                        kerf: parseFloat(e.target.value) || 4,
                      }))}
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="trimL1" className="text-[10px] sm:text-xs">Trim Margin (mm)</Label>
                    <Input
                      id="trimL1"
                      type="number"
                      value={machineSettings.trim_margin?.L1 ?? 10}
                      onChange={(e) => setMachineSettings(prev => ({
                        ...prev,
                        trim_margin: {
                          L1: parseFloat(e.target.value) || 0,
                          L2: parseFloat(e.target.value) || 0,
                          W1: parseFloat(e.target.value) || 0,
                          W2: parseFloat(e.target.value) || 0,
                        },
                      }))}
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="minOffcutL" className="text-[10px] sm:text-xs">Min Offcut L (mm)</Label>
                    <Input
                      id="minOffcutL"
                      type="number"
                      value={machineSettings.min_offcut_L}
                      onChange={(e) => setMachineSettings(prev => ({
                        ...prev,
                        min_offcut_L: parseFloat(e.target.value) || 200,
                      }))}
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="minOffcutW" className="text-[10px] sm:text-xs">Min Offcut W (mm)</Label>
                    <Input
                      id="minOffcutW"
                      type="number"
                      value={machineSettings.min_offcut_W}
                      onChange={(e) => setMachineSettings(prev => ({
                        ...prev,
                        min_offcut_W: parseFloat(e.target.value) || 100,
                      }))}
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Optimization Mode */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Optimization Mode
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setRunConfig(prev => ({ ...prev, mode: "guillotine" }))}
                    className={cn(
                      "p-3 sm:p-4 rounded-lg border-2 text-left transition-all",
                      runConfig.mode === "guillotine"
                        ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                        : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                    )}
                  >
                    <div className="font-medium text-sm sm:text-base">Guillotine</div>
                    <div className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
                      Panel saw compatible cuts (edge-to-edge)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunConfig(prev => ({ ...prev, mode: "maxrects" }))}
                    className={cn(
                      "p-3 sm:p-4 rounded-lg border-2 text-left transition-all",
                      runConfig.mode === "maxrects"
                        ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                        : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                    )}
                  >
                    <div className="font-medium text-sm sm:text-base">MaxRects</div>
                    <div className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
                      CNC router optimized (free placement)
                    </div>
                  </button>
                </div>
                
                {/* Panel Saw Workflow - Only shown for Guillotine mode */}
                {runConfig.mode === "guillotine" && (
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                    <Label className="text-[10px] sm:text-xs font-medium">Panel Saw Workflow</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "rip_first", label: "Rip First", desc: "Long cuts first" },
                        { value: "crosscut_first", label: "Crosscut First", desc: "Short cuts first" },
                        { value: "auto", label: "Auto (Best)", desc: "Optimizer chooses" },
                      ].map(({ value, label, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setMachineSettings(prev => ({
                            ...prev,
                            panel_saw: {
                              ...prev.panel_saw,
                              workflow: value as "rip_first" | "crosscut_first" | "auto",
                            },
                          }))}
                          className={cn(
                            "p-2 sm:p-3 rounded-lg border text-center transition-all",
                            machineSettings.panel_saw?.workflow === value
                              ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                              : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                          )}
                        >
                          <div className="font-medium text-xs sm:text-sm">{label}</div>
                          <div className="text-[9px] sm:text-[10px] text-[var(--muted-foreground)] mt-0.5 hidden sm:block">
                            {desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="runs" className="text-[10px] sm:text-xs">Search Iterations</Label>
                    <Input
                      id="runs"
                      type="number"
                      min={1}
                      max={100}
                      value={runConfig.runs}
                      onChange={(e) => setRunConfig(prev => ({
                        ...prev,
                        runs: parseInt(e.target.value) || 30,
                      }))}
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Search Strategy</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={runConfig.search === "beam" ? "primary" : "ghost"}
                        size="sm"
                        className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                        onClick={() => setRunConfig(prev => ({ ...prev, search: "beam" }))}
                      >
                        Beam Search
                      </Button>
                      <Button
                        type="button"
                        variant={runConfig.search === "none" ? "primary" : "ghost"}
                        size="sm"
                        className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                        onClick={() => setRunConfig(prev => ({ ...prev, search: "none" }))}
                      >
                        Quick
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Options */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Display Options
                </h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {[
                    { key: "showLabels", label: "Part Labels" },
                    { key: "showCutNumbers", label: "Cut Numbers" },
                    { key: "showFreeRects", label: "Free Areas" },
                    { key: "showEdgeDimensions", label: "Edge Dims" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRenderOptions(prev => ({
                        ...prev,
                        [key]: !prev[key as keyof RenderOptions],
                      }))}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm border transition-all",
                        renderOptions[key as keyof RenderOptions]
                          ? "bg-[var(--cai-teal)] text-white border-[var(--cai-teal)]"
                          : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Info (Optional) */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Customer Info (Optional)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="customerName" className="text-[10px] sm:text-xs">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerInfo.customer_name}
                      onChange={(e) => setCustomerInfo(prev => ({
                        ...prev,
                        customer_name: e.target.value,
                      }))}
                      placeholder="Optional"
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="projectName" className="text-[10px] sm:text-xs">Project Name</Label>
                    <Input
                      id="projectName"
                      value={customerInfo.project_name}
                      onChange={(e) => setCustomerInfo(prev => ({
                        ...prev,
                        project_name: e.target.value,
                      }))}
                      placeholder="Optional"
                      className="h-8 sm:h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {optState.status === "error" && (
                <div className="p-3 sm:p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-red-700 dark:text-red-400">Optimization Failed</p>
                      <p className="text-xs sm:text-sm text-red-600 dark:text-red-500 mt-1 break-words">{optState.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--card)] pb-1">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full h-10 sm:h-11 text-sm sm:text-base"
                  onClick={handleOptimize}
                  disabled={optState.status === "running" || totalParts === 0}
                >
                  {optState.status === "running" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Run Optimization
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab - Scrollable */}
          <TabsContent value="results" className="flex-1 overflow-y-auto m-0">
            {optState.result?.result && (
              <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {/* Success Banner */}
                <div className="p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-green-700 dark:text-green-400">
                        Optimization Complete
                      </p>
                      <p className="text-xs sm:text-sm text-green-600 dark:text-green-500">
                        Completed in {optState.result.timing_ms?.toFixed(0) || "—"}ms 
                        using {optState.result.workflow || optState.result.mode} algorithm
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <StatCard
                    label="Sheets Used"
                    value={optState.result.result.summary.sheets_used}
                    icon={<LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    highlight
                  />
                  <StatCard
                    label="Utilization"
                    value={`${optState.result.result.summary.utilization_pct?.toFixed(1) || 0}%`}
                    icon={<BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    highlight
                  />
                  <StatCard
                    label="Waste Area"
                    value={`${((optState.result.result.summary.waste_area || 0) / 1_000_000).toFixed(2)} m²`}
                    icon={<Scissors className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  />
                  <StatCard
                    label="Total Cuts"
                    value={optState.result.result.summary.total_cut_length_mm 
                      ? `${(optState.result.result.summary.total_cut_length_mm / 1000).toFixed(1)}m`
                      : "—"}
                    icon={<Scissors className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  />
                </div>

                {/* Sheet Layouts */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-xs sm:text-sm font-semibold">Sheet Layouts</h3>
                  <div className="grid gap-3 sm:gap-4">
                    {optState.result.result.sheets.map((sheet, idx) => (
                      <Card key={idx} className="overflow-hidden">
                        <CardHeader className="py-2 sm:py-3 px-3 sm:px-4 bg-[var(--muted)]/30">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-xs sm:text-sm truncate">
                              Sheet {sheet.sheet_no} — {sheet.material_id}
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">
                              {sheet.efficiency?.toFixed(1) || 0}%
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-4">
                          {/* SVG Layout - Responsive container with aspect ratio preservation */}
                          {optState.result?.svgs?.[idx] && (
                            <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 sm:p-4 overflow-auto">
                              <div 
                                className="svg-container flex items-center justify-center"
                                dangerouslySetInnerHTML={{ 
                                  __html: optState.result.svgs[idx].svg
                                    // Make SVG responsive while preserving aspect ratio
                                    .replace(
                                      /<svg([^>]*)>/,
                                      '<svg$1 style="max-width:100%;max-height:400px;width:auto;height:auto;display:block;margin:0 auto" preserveAspectRatio="xMidYMid meet">'
                                    )
                                }}
                              />
                            </div>
                          )}
                          
                          {/* Parts List */}
                          <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-[var(--muted-foreground)]">
                            <span className="font-medium">{sheet.placements.length}</span> pieces placed
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Export Actions */}
                <div className="pt-3 sm:pt-4 border-t border-[var(--border)] space-y-3">
                  <h3 className="text-xs sm:text-sm font-semibold">Export Results</h3>
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                    <Button variant="primary" onClick={handleDownloadPDF} className="h-9 sm:h-10 text-xs sm:text-sm">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Download PDF Report
                    </Button>
                    <Button 
                      variant="ghost"
                      className="h-9 sm:h-10 text-xs sm:text-sm"
                      onClick={() => {
                        // Build simple JSON format for CAI 2D import
                        // See: docs/USER_GUIDE.md - "Importing from External Apps"
                        const simpleJobData = {
                          name: cutlist.name || "Imported from CAI Intake",
                          parts: cutlist.parts.map((p, idx) => ({
                            label: p.label || `Part ${idx + 1}`,
                            length: p.size.L,
                            width: p.size.W,
                            quantity: p.qty,
                          })),
                        };
                        
                        try {
                          // URL-encode the JSON data
                          const encodedData = encodeURIComponent(JSON.stringify(simpleJobData));
                          
                          // Check URL length - if too long, need session-based import
                          const url = `https://cai-2d.app/?data=${encodedData}&format=simple_json`;
                          
                          if (url.length > 4000) {
                            // For large cutlists, download JSON instead
                            alert("Cutlist is too large for URL import. Use the 'Export Job File' button to download the job file, then import it manually into CAI 2D.");
                            return;
                          }
                          
                          window.open(url, "_blank");
                        } catch (error) {
                          console.error("Failed to open CAI 2D:", error);
                          // Fallback: just open CAI 2D
                          window.open("https://cai-2d.app", "_blank");
                        }
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Open in CAI 2D (Labels & More)
                    </Button>
                  </div>
                </div>

                {/* Re-run Button */}
                <Button
                  variant="secondary"
                  className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                  onClick={() => setActiveTab("settings")}
                >
                  <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Modify Settings & Re-run
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "p-2.5 sm:p-4 rounded-lg border",
      highlight 
        ? "border-[var(--cai-teal)]/30 bg-[var(--cai-teal)]/5"
        : "border-[var(--border)] bg-[var(--muted)]/30"
    )}>
      <div className="flex items-center gap-1.5 sm:gap-2 text-[var(--muted-foreground)] mb-0.5 sm:mb-1">
        {icon}
        <span className="text-[10px] sm:text-xs">{label}</span>
      </div>
      <p className={cn(
        "text-lg sm:text-xl font-bold",
        highlight && "text-[var(--cai-teal)]"
      )}>
        {value}
      </p>
    </div>
  );
}

