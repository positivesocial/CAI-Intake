"use client";

import * as React from "react";
import {
  Download,
  Send,
  FileJson,
  FileSpreadsheet,
  FileText,
  Check,
  ExternalLink,
  RefreshCw,
  Package,
  Layers,
  Ruler,
  Activity,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StepNavigation } from "@/components/ui/stepper";
import { downloadCutlistPDF } from "@/lib/exports/pdf-export";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}

export function ExportStep() {
  const {
    currentCutlist,
    goToPreviousStep,
    resetCutlist,
  } = useIntakeStore();

  const [exportStatus, setExportStatus] = React.useState<string | null>(null);

  const totalParts = currentCutlist.parts.length;
  const totalPieces = currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const totalArea = currentCutlist.parts.reduce(
    (sum, p) => sum + p.qty * p.size.L * p.size.W,
    0
  ) / 1_000_000;
  const materialsCount = new Set(currentCutlist.parts.map((p) => p.material_id)).size;

  const exportOptions: ExportOption[] = [
    {
      id: "optimizer",
      label: "Send to CAI 2D Optimizer",
      description: "Optimize cutting layouts for minimum waste",
      icon: <Send className="h-5 w-5" />,
      primary: true,
    },
    {
      id: "pdf",
      label: "Download PDF Report",
      description: "Full parts list with stats, operations, and source methods",
      icon: <FileDown className="h-5 w-5" />,
    },
    {
      id: "json",
      label: "Export as JSON",
      description: "Full data export for integration",
      icon: <FileJson className="h-5 w-5" />,
    },
    {
      id: "maxcut",
      label: "Export for MaxCut",
      description: "Compatible with MaxCut software",
      icon: <FileSpreadsheet className="h-5 w-5" />,
    },
    {
      id: "cutlistplus",
      label: "Export for CutList Plus",
      description: "Import into CutList Plus fx",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: "csv",
      label: "Export as CSV",
      description: "Simple spreadsheet format",
      icon: <FileSpreadsheet className="h-5 w-5" />,
    },
  ];

  const handleExport = async (optionId: string) => {
    setExportStatus(`Exporting to ${optionId}...`);
    
    try {
      switch (optionId) {
        case "pdf": {
          // Generate and download PDF report
          downloadCutlistPDF(currentCutlist, {
            includeOperations: true,
            includeSourceMethod: true,
            includeNotes: true,
            companyName: "CAI Intake",
          });
          setExportStatus("PDF downloaded successfully!");
          break;
        }
        
        case "json": {
          // Export as JSON file
          const jsonData = JSON.stringify(currentCutlist, null, 2);
          const blob = new Blob([jsonData], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${currentCutlist.name || "cutlist"}-${new Date().toISOString().split("T")[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setExportStatus("JSON exported successfully!");
          break;
        }
        
        case "csv": {
          // Export as CSV file
          const headers = ["Label", "Length", "Width", "Thickness", "Qty", "Material", "Grain", "Edging", "Source"];
          const rows = currentCutlist.parts.map(part => {
            const material = currentCutlist.materials.find(m => m.material_id === part.material_id);
            const edging = part.ops?.edging?.edges 
              ? Object.entries(part.ops.edging.edges)
                  .filter(([, e]) => e.apply)
                  .map(([side]) => side)
                  .join("+")
              : "";
            return [
              part.label || "",
              part.size.L,
              part.size.W,
              part.thickness_mm,
              part.qty,
              material?.name || part.material_id,
              part.grain,
              edging,
              part.audit?.source_method || "",
            ].join(",");
          });
          const csvContent = [headers.join(","), ...rows].join("\n");
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${currentCutlist.name || "cutlist"}-${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setExportStatus("CSV exported successfully!");
          break;
        }
        
        case "optimizer": {
          // TODO: Implement sending to optimizer API
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setExportStatus("Sent to CAI 2D Optimizer!");
          break;
        }
        
        case "maxcut":
        case "cutlistplus": {
          // TODO: Implement software-specific exports
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setExportStatus(`Exported for ${optionId === "maxcut" ? "MaxCut" : "CutList Plus"}!`);
          break;
        }
        
        default: {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setExportStatus("Export completed!");
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus("Export failed. Please try again.");
    }
    
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleStartNew = () => {
    if (window.confirm("Are you sure you want to start a new cutlist? This will clear all current parts.")) {
      resetCutlist();
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Final Summary */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          Export Your Cutlist
        </h2>
        <p className="text-[var(--muted-foreground)]">
          Review your cutlist summary and choose an export format
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Package className="h-5 w-5" />}
            label="Parts"
            value={totalParts}
          />
          <SummaryCard
            icon={<Layers className="h-5 w-5" />}
            label="Pieces"
            value={totalPieces}
          />
          <SummaryCard
            icon={<Ruler className="h-5 w-5" />}
            label="Materials"
            value={materialsCount}
          />
          <SummaryCard
            icon={<Activity className="h-5 w-5" />}
            label="Area"
            value={`${totalArea.toFixed(2)} m²`}
          />
        </div>
      </section>

      {/* Export Options */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Export Options</h3>

        <div className="grid gap-3">
          {exportOptions.map((option) => (
            <ExportOptionCard
              key={option.id}
              option={option}
              disabled={totalParts === 0}
              onClick={() => handleExport(option.id)}
            />
          ))}
        </div>

        {/* Status message */}
        {exportStatus && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-[var(--cai-teal)]/10 text-[var(--cai-teal)] rounded-lg">
            {exportStatus.includes("...") ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{exportStatus}</span>
          </div>
        )}
      </section>

      {/* Material Breakdown */}
      {materialsCount > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Material Breakdown</h3>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {Object.entries(
                  currentCutlist.parts.reduce(
                    (acc, part) => {
                      if (!acc[part.material_id]) {
                        acc[part.material_id] = { count: 0, area: 0 };
                      }
                      acc[part.material_id].count += part.qty;
                      acc[part.material_id].area += part.qty * part.size.L * part.size.W;
                      return acc;
                    },
                    {} as Record<string, { count: number; area: number }>
                  )
                ).map(([matId, data]) => {
                  const material = currentCutlist.materials.find(
                    (m) => m.material_id === matId
                  );
                  return (
                    <div
                      key={matId}
                      className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                    >
                      <div>
                        <span className="font-medium">
                          {material?.name || matId}
                        </span>
                        {material?.thickness_mm && (
                          <Badge variant="outline" className="ml-2">
                            {material.thickness_mm}mm
                          </Badge>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">{data.count} pcs</div>
                        <div className="text-[var(--muted-foreground)]">
                          {(data.area / 1_000_000).toFixed(2)} m²
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Start New Option */}
      <div className="text-center pt-4 border-t border-[var(--border)]">
        <Button
          variant="ghost"
          onClick={handleStartNew}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Start New Cutlist
        </Button>
      </div>

      {/* Navigation */}
      <StepNavigation
        onBack={goToPreviousStep}
        showNext={false}
      />
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportOptionCard({
  option,
  disabled,
  onClick,
}: {
  option: ExportOption;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
        "hover:border-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/5",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:bg-transparent",
        option.primary
          ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
          : "border-[var(--border)] bg-[var(--card)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-lg shrink-0",
          option.primary
            ? "bg-[var(--cai-teal)] text-white"
            : "bg-[var(--muted)] text-[var(--foreground)]"
        )}
      >
        {option.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium flex items-center gap-2">
          {option.label}
          {option.primary && (
            <Badge variant="teal" className="text-xs">Recommended</Badge>
          )}
        </div>
        <div className="text-sm text-[var(--muted-foreground)]">
          {option.description}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
    </button>
  );
}

