"use client";

/**
 * CAI Intake - CSV Mapping Wizard
 * 
 * 3-step wizard for manual column mapping when auto-detection
 * doesn't achieve high confidence.
 */

import * as React from "react";
import {
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Eye,
  Columns,
  Settings2,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export interface CsvWizardProps {
  /** File to process */
  file: File;
  /** Detected headers */
  detectedHeaders: string[];
  /** Sample data rows */
  sampleRows: string[][];
  /** Suggested mapping from auto-detection */
  suggestedMapping?: Record<string, string>;
  /** Called when wizard is cancelled */
  onCancel: () => void;
  /** Called when wizard completes with parsed parts */
  onComplete: (parts: CutPart[]) => void;
  /** Default material ID */
  defaultMaterialId?: string;
  /** Default thickness */
  defaultThicknessMm?: number;
}

interface WizardState {
  currentStep: 1 | 2 | 3;
  hasHeaders: boolean;
  skipRows: number;
  columnMapping: Record<string, string>;
  previewParts: CutPart[];
  previewErrors: Array<{ row: number; error: string }>;
  isLoading: boolean;
  error: string | null;
}

/** Target fields for mapping */
const TARGET_FIELDS = [
  { id: "length", label: "Length", required: true, description: "Part length in mm" },
  { id: "width", label: "Width", required: true, description: "Part width in mm" },
  { id: "thickness", label: "Thickness", required: false, description: "Material thickness" },
  { id: "quantity", label: "Quantity", required: false, description: "Number of pieces" },
  { id: "partName", label: "Part Name", required: false, description: "Part label/name" },
  { id: "material", label: "Material", required: false, description: "Material code/name" },
  { id: "grain", label: "Grain", required: false, description: "Grain direction" },
  { id: "edgebanding", label: "Edgebanding", required: false, description: "Edge banding code" },
  { id: "notes", label: "Notes", required: false, description: "Additional notes" },
];

// ============================================================
// COMPONENT
// ============================================================

export function CsvWizard({
  file,
  detectedHeaders,
  sampleRows,
  suggestedMapping,
  onCancel,
  onComplete,
  defaultMaterialId,
  defaultThicknessMm,
}: CsvWizardProps) {
  const [state, setState] = React.useState<WizardState>({
    currentStep: 1,
    hasHeaders: true,
    skipRows: 0,
    columnMapping: suggestedMapping || {},
    previewParts: [],
    previewErrors: [],
    isLoading: false,
    error: null,
  });

  // Memoized headers based on hasHeaders setting
  const effectiveHeaders = React.useMemo(() => {
    if (state.hasHeaders) {
      return detectedHeaders;
    }
    return detectedHeaders.map((_, i) => `Column ${i + 1}`);
  }, [detectedHeaders, state.hasHeaders]);

  // Memoized sample data
  const effectiveSampleRows = React.useMemo(() => {
    if (state.hasHeaders) {
      return sampleRows;
    }
    // Include the header row as data
    return [detectedHeaders, ...sampleRows.slice(0, 4)];
  }, [detectedHeaders, sampleRows, state.hasHeaders]);

  // Validation
  const canProceedToStep2 = true; // Step 1 has no required inputs
  const canProceedToStep3 = !!(state.columnMapping.length && state.columnMapping.width);
  const canComplete = state.previewParts.length > 0;

  // Step navigation
  const goToStep = (step: 1 | 2 | 3) => {
    setState((s) => ({ ...s, currentStep: step }));
  };

  const handleNext = async () => {
    if (state.currentStep === 1) {
      goToStep(2);
    } else if (state.currentStep === 2) {
      await fetchPreview();
      goToStep(3);
    }
  };

  const handleBack = () => {
    if (state.currentStep === 2) goToStep(1);
    else if (state.currentStep === 3) goToStep(2);
  };

  // Fetch preview from API
  const fetchPreview = async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify({
        columnMapping: state.columnMapping,
        hasHeaders: state.hasHeaders,
        skipRows: state.skipRows,
        defaultMaterialId,
        defaultThicknessMm,
        maxPreviewRows: 50,
      }));

      const response = await fetch("/api/v1/csv-wizard/preview", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to preview");
      }

      setState((s) => ({
        ...s,
        previewParts: data.parts,
        previewErrors: data.errorRows || [],
        isLoading: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : "Preview failed",
      }));
    }
  };

  const handleComplete = () => {
    onComplete(state.previewParts);
  };

  const updateMapping = (field: string, column: string) => {
    setState((s) => {
      const newMapping = { ...s.columnMapping };
      if (column === "none") {
        delete newMapping[field];
      } else {
        newMapping[field] = column;
      }
      return { ...s, columnMapping: newMapping };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-[var(--cai-teal)]" />
              <div>
                <CardTitle>Column Mapping Wizard</CardTitle>
                <CardDescription>{file.name}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    state.currentStep === step
                      ? "bg-[var(--cai-teal)] text-white"
                      : state.currentStep > step
                      ? "bg-green-100 text-green-700"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  )}
                >
                  {state.currentStep > step ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                      {step}
                    </span>
                  )}
                  {step === 1 && "Headers"}
                  {step === 2 && "Mapping"}
                  {step === 3 && "Preview"}
                </div>
                {step < 3 && (
                  <div
                    className={cn(
                      "w-8 h-0.5",
                      state.currentStep > step ? "bg-green-500" : "bg-[var(--border)]"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto py-6">
          {/* Step 1: Header Detection */}
          {state.currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <Settings2 className="h-5 w-5 text-[var(--cai-teal)] mt-0.5" />
                <div>
                  <p className="font-medium">Configure Data Structure</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Tell us how your data is organized so we can parse it correctly.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="hasHeaders">First Row Contains Headers</Label>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Does the first row contain column names?
                    </p>
                  </div>
                  <Switch
                    id="hasHeaders"
                    checked={state.hasHeaders}
                    onCheckedChange={(checked) =>
                      setState((s) => ({ ...s, hasHeaders: checked }))
                    }
                  />
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <Label htmlFor="skipRows">Skip Rows</Label>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Number of title/description rows to skip before data starts
                  </p>
                  <Input
                    id="skipRows"
                    type="number"
                    min={0}
                    max={20}
                    value={state.skipRows}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        skipRows: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-24"
                  />
                </div>
              </div>

              {/* Data Preview */}
              <div className="space-y-2">
                <Label>Data Preview</Label>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">
                          Row
                        </th>
                        {effectiveHeaders.slice(0, 8).map((header, i) => (
                          <th
                            key={i}
                            className="px-3 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveSampleRows.slice(0, 5).map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={cn(
                            "border-t",
                            rowIndex < state.skipRows && "bg-yellow-50 opacity-50"
                          )}
                        >
                          <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                            {rowIndex + 1}
                            {rowIndex < state.skipRows && (
                              <span className="ml-1 text-yellow-600">(skip)</span>
                            )}
                          </td>
                          {row.slice(0, 8).map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {state.currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <Columns className="h-5 w-5 text-[var(--cai-teal)] mt-0.5" />
                <div>
                  <p className="font-medium">Map Columns to Fields</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Match your spreadsheet columns to the required data fields.
                    Length and Width are required.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {TARGET_FIELDS.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-4 p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <Label>{field.label}</Label>
                        {field.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {field.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    <Select
                      value={state.columnMapping[field.id] || "none"}
                      onValueChange={(value) => updateMapping(field.id, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not mapped —</SelectItem>
                        {effectiveHeaders.map((header, i) => (
                          <SelectItem key={i} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {state.columnMapping[field.id] && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                ))}
              </div>

              {!canProceedToStep3 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Please map both Length and Width columns</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {state.currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <Eye className="h-5 w-5 text-[var(--cai-teal)] mt-0.5" />
                <div>
                  <p className="font-medium">Preview Parsed Data</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Review the parsed parts before importing. You can go back to
                    adjust mappings if needed.
                  </p>
                </div>
              </div>

              {state.isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-[var(--cai-teal)] border-t-transparent rounded-full" />
                </div>
              )}

              {state.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{state.error}</span>
                </div>
              )}

              {!state.isLoading && !state.error && (
                <>
                  {/* Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {state.previewParts.length}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        Parts Parsed
                      </div>
                    </div>
                    {state.previewErrors.length > 0 && (
                      <div className="flex-1 p-4 border rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {state.previewErrors.length}
                        </div>
                        <div className="text-sm text-[var(--muted-foreground)]">
                          Errors
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Parts Preview Table */}
                  {state.previewParts.length > 0 && (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--muted)]">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">L × W</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">Thk</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">Qty</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">Material</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.previewParts.slice(0, 20).map((part, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2">{part.label || "—"}</td>
                              <td className="px-3 py-2">
                                {part.size.L} × {part.size.W}
                              </td>
                              <td className="px-3 py-2">{part.thickness_mm}</td>
                              <td className="px-3 py-2">{part.qty}</td>
                              <td className="px-3 py-2">{part.material_id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {state.previewParts.length > 20 && (
                        <div className="px-3 py-2 text-sm text-[var(--muted-foreground)] border-t">
                          + {state.previewParts.length - 20} more parts
                        </div>
                      )}
                    </div>
                  )}

                  {/* Errors */}
                  {state.previewErrors.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-red-600">Parse Errors</Label>
                      <div className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50">
                        {state.previewErrors.slice(0, 5).map((error, i) => (
                          <div key={i} className="text-sm text-red-700">
                            Row {error.row}: {error.error}
                          </div>
                        ))}
                        {state.previewErrors.length > 5 && (
                          <div className="text-sm text-red-600">
                            + {state.previewErrors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between bg-[var(--card)]">
          <Button variant="outline" onClick={handleBack} disabled={state.currentStep === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>

            {state.currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (state.currentStep === 2 && !canProceedToStep3) || state.isLoading
                }
              >
                {state.isLoading ? "Loading..." : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!canComplete}
                className="bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
              >
                <Check className="h-4 w-4 mr-2" />
                Import {state.previewParts.length} Parts
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

