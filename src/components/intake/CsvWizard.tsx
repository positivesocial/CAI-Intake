"use client";

/**
 * CAI Intake - CSV Mapping Wizard
 * 
 * Enhanced 3-step wizard for CSV/Excel column mapping with:
 * - Auto-detection with fuzzy matching
 * - Sample data preview in mapping step
 * - Delimiter auto-detection
 * - Improved visual feedback
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
  Wand2,
  Sparkles,
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
import { toast } from "sonner";

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
  /** Detection confidence (0-100) */
  detectionConfidence?: number;
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
  { id: "length", label: "Length", required: true, description: "Part length in mm", keywords: ["length", "len", "l", "long", "dimension"] },
  { id: "width", label: "Width", required: true, description: "Part width in mm", keywords: ["width", "wid", "w", "wide", "breadth"] },
  { id: "thickness", label: "Thickness", required: false, description: "Material thickness", keywords: ["thick", "thk", "t", "depth", "height"] },
  { id: "quantity", label: "Quantity", required: false, description: "Number of pieces", keywords: ["qty", "quantity", "count", "pcs", "pieces", "no", "#"] },
  { id: "partName", label: "Part Name", required: false, description: "Part label/name", keywords: ["name", "label", "part", "description", "component", "desc"] },
  { id: "material", label: "Material", required: false, description: "Material code/name", keywords: ["material", "mat", "board", "stock", "substrate", "panel"] },
  { id: "grain", label: "Grain", required: false, description: "Grain direction", keywords: ["grain", "direction", "dir", "gl", "gw", "orientation"] },
  { id: "edgebanding", label: "Edgebanding", required: false, description: "Edge banding code", keywords: ["edge", "band", "eb", "tape", "banding", "lipping"] },
  { id: "notes", label: "Notes", required: false, description: "Additional notes", keywords: ["notes", "comment", "remark", "info", "memo", "remarks"] },
];

// ============================================================
// FUZZY MATCHING
// ============================================================

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  
  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(a.length, b.length);
  return maxLen > 0 ? 1 - matrix[a.length][b.length] / maxLen : 0;
}

/**
 * Auto-map columns using fuzzy matching
 */
function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  
  // For each target field, find the best matching header
  for (const field of TARGET_FIELDS) {
    let bestMatch: { header: string; score: number } | null = null;
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      // Check each keyword for this field
      for (const keyword of field.keywords) {
        const score = stringSimilarity(header, keyword);
        if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { header, score };
        }
      }
      
      // Also check direct similarity to field id
      const idScore = stringSimilarity(header, field.id);
      if (idScore >= 0.5 && (!bestMatch || idScore > bestMatch.score)) {
        bestMatch = { header, score: idScore };
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.5) {
      mapping[field.id] = bestMatch.header;
      usedHeaders.add(bestMatch.header);
    }
  }
  
  return mapping;
}

// ============================================================
// COMPONENT
// ============================================================

export function CsvWizard({
  file,
  detectedHeaders,
  sampleRows,
  suggestedMapping,
  detectionConfidence = 0,
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

  // Get sample value for a column
  const getSampleValue = React.useCallback((headerName: string): string => {
    const colIndex = effectiveHeaders.indexOf(headerName);
    if (colIndex < 0) return "—";
    
    // Find first non-empty value
    for (const row of effectiveSampleRows) {
      const val = row[colIndex]?.trim();
      if (val) return val.length > 25 ? val.slice(0, 25) + "..." : val;
    }
    return "—";
  }, [effectiveHeaders, effectiveSampleRows]);

  // Count mapped fields
  const mappedCount = Object.keys(state.columnMapping).filter(k => state.columnMapping[k]).length;
  const requiredMapped = !!(state.columnMapping.length && state.columnMapping.width);

  // Validation
  const canProceedToStep2 = true;
  const canProceedToStep3 = requiredMapped;
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

  // Auto-map handler
  const handleAutoMap = () => {
    const newMapping = autoMapColumns(effectiveHeaders);
    setState((s) => ({ ...s, columnMapping: newMapping }));
    
    const count = Object.keys(newMapping).length;
    if (count > 0) {
      toast.success(`Auto-mapped ${count} columns`);
    } else {
      toast.info("Could not find matching columns", {
        description: "Try mapping columns manually",
      });
    }
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

          {/* Detection confidence indicator */}
          {detectionConfidence > 0 && state.currentStep === 1 && (
            <div className="flex items-center gap-2 mt-3">
              <Sparkles className="h-4 w-4 text-[var(--cai-teal)]" />
              <span className="text-sm text-[var(--muted-foreground)]">
                Auto-detection confidence: {detectionConfidence}%
              </span>
              {detectionConfidence >= 80 && (
                <Badge variant="teal" className="text-xs">High</Badge>
              )}
              {detectionConfidence >= 50 && detectionConfidence < 80 && (
                <Badge variant="outline" className="text-xs">Medium</Badge>
              )}
              {detectionConfidence < 50 && (
                <Badge variant="destructive" className="text-xs">Low</Badge>
              )}
            </div>
          )}

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
                        {effectiveHeaders.length > 8 && (
                          <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">
                            +{effectiveHeaders.length - 8} more
                          </th>
                        )}
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
                              {cell || <span className="text-gray-300">—</span>}
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
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <div className="flex items-start gap-4">
                  <Columns className="h-5 w-5 text-[var(--cai-teal)] mt-0.5" />
                  <div>
                    <p className="font-medium">Map Columns to Fields</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Match your spreadsheet columns to the required data fields.
                      <span className="text-[var(--cai-teal)] font-medium"> Length and Width are required.</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoMap}
                  className="gap-2 shrink-0"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-Map
                </Button>
              </div>

              {/* Mapping stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[var(--muted-foreground)]">
                  Mapped: <span className="font-medium text-[var(--foreground)]">{mappedCount}/{TARGET_FIELDS.length}</span>
                </span>
                {requiredMapped ? (
                  <Badge variant="teal" className="gap-1">
                    <Check className="h-3 w-3" />
                    Required fields mapped
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Missing required fields
                  </Badge>
                )}
              </div>

              <div className="grid gap-3">
                {TARGET_FIELDS.map((field) => {
                  const currentValue = state.columnMapping[field.id];
                  const sampleVal = currentValue ? getSampleValue(currentValue) : null;
                  
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        "flex items-center gap-4 p-3 border rounded-lg transition-colors",
                        currentValue && "border-green-200 bg-green-50/50",
                        field.required && !currentValue && "border-red-200 bg-red-50/30"
                      )}
                    >
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Label className={field.required ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
                            {field.label}
                          </Label>
                          {field.required && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {field.description}
                        </p>
                      </div>
                      
                      <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                      
                      <div className="flex items-center gap-3">
                        <Select
                          value={currentValue || "none"}
                          onValueChange={(value) => updateMapping(field.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
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
                        
                        {/* Sample value preview */}
                        {sampleVal && (
                          <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1 rounded min-w-[80px]">
                            e.g., <span className="font-mono">{sampleVal}</span>
                          </div>
                        )}
                        
                        {currentValue && (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!canProceedToStep3 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Please map both Length and Width columns to continue</span>
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
                    <div className="flex-1 p-4 border rounded-lg text-center bg-green-50 border-green-200">
                      <div className="text-2xl font-bold text-green-600">
                        {state.previewParts.length}
                      </div>
                      <div className="text-sm text-green-700">
                        Parts Parsed
                      </div>
                    </div>
                    {state.previewErrors.length > 0 && (
                      <div className="flex-1 p-4 border rounded-lg text-center bg-red-50 border-red-200">
                        <div className="text-2xl font-bold text-red-600">
                          {state.previewErrors.length}
                        </div>
                        <div className="text-sm text-red-700">
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
                            <th className="px-3 py-2 text-left text-xs font-medium">Grain</th>
                            <th className="px-3 py-2 text-left text-xs font-medium">Edges</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.previewParts.slice(0, 20).map((part, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2">{part.label || "—"}</td>
                              <td className="px-3 py-2 font-mono">
                                {part.size.L} × {part.size.W}
                              </td>
                              <td className="px-3 py-2">{part.thickness_mm}</td>
                              <td className="px-3 py-2">{part.qty}</td>
                              <td className="px-3 py-2 text-xs">{part.material_id}</td>
                              <td className="px-3 py-2 text-xs">{part.grain || "—"}</td>
                              <td className="px-3 py-2 text-xs">
                                {part.ops?.edging?.edges 
                                  ? Object.keys(part.ops.edging.edges).join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {state.previewParts.length > 20 && (
                        <div className="px-3 py-2 text-sm text-[var(--muted-foreground)] border-t bg-[var(--muted)]">
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
                className="bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
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
