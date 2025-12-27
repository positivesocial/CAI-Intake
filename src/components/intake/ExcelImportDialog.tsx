"use client";

/**
 * Excel/CSV Import Dialog
 * 
 * A dialog wrapper for the Excel import wizard.
 * Used when Excel/CSV files are dropped on the smart file uploader.
 * Supports multi-sheet Excel workbooks with sheet selection.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Layers, Sparkles } from "lucide-react";
import {
  parseCSV,
  parseExcelData,
  autoDetectMapping,
  isExcelFile,
  parseWorkbook,
  getSheetData,
  detectPartsSheet,
  type ColumnMapping,
  type ExcelParseResult,
  type WorkbookInfo,
  type SheetInfo,
} from "@/lib/parsers/excel-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStep = "sheets" | "mapping" | "preview" | "complete";

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["L", "W"];
const OPTIONAL_FIELDS: (keyof ColumnMapping)[] = [
  "label",
  "qty",
  "thickness_mm",
  "material",
  "grain",
  "group_id",
  "notes",
  "edging_L1",
  "edging_L2",
  "edging_W1",
  "edging_W2",
];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  label: "Label/Name",
  qty: "Quantity",
  L: "Length (L)",
  W: "Width (W)",
  thickness_mm: "Thickness",
  material: "Material",
  grain: "Grain Direction",
  group_id: "Group ID",
  notes: "Notes",
  edging_L1: "Edge L1",
  edging_L2: "Edge L2",
  edging_W1: "Edge W1",
  edging_W2: "Edge W2",
};

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onComplete?: (partsCount: number) => void;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  file,
  onComplete,
}: ExcelImportDialogProps) {
  const addToInbox = useIntakeStore((state) => state.addToInbox);
  const isAdvancedMode = useIntakeStore((state) => state.isAdvancedMode);

  const [step, setStep] = React.useState<WizardStep>("mapping");
  const [rawData, setRawData] = React.useState<string[][]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [headerRowIndex, setHeaderRowIndex] = React.useState(0);
  const [dataRowStart, setDataRowStart] = React.useState(1);
  const [parseResult, setParseResult] = React.useState<ExcelParseResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Multi-sheet support
  const [workbookInfo, setWorkbookInfo] = React.useState<WorkbookInfo | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = React.useState<number>(0);
  const [suggestedSheetIndex, setSuggestedSheetIndex] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Load file when opened
  React.useEffect(() => {
    if (open && file) {
      loadFile(file);
    }
    // Reset when dialog closes
    if (!open) {
      setStep("mapping");
      setRawData([]);
      setHeaders([]);
      setMapping({});
      setHeaderRowIndex(0);
      setDataRowStart(1);
      setParseResult(null);
      setWorkbookInfo(null);
      setSelectedSheetIndex(0);
      setSuggestedSheetIndex(null);
      setError(null);
    }
  }, [open, file]);

  const loadFile = async (f: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if it's an Excel workbook (not CSV)
      if (isExcelFile(f)) {
        console.log("[ExcelImport] Parsing Excel workbook:", f.name);
        
        // Parse workbook to get sheet info
        const workbook = await parseWorkbook(f);
        console.log("[ExcelImport] Workbook parsed:", {
          sheetCount: workbook.sheetCount,
          sheets: workbook.sheets.map(s => s.name),
        });
        
        setWorkbookInfo(workbook);
        
        if (workbook.sheetCount > 1) {
          // Multiple sheets - show sheet selection
          const suggested = detectPartsSheet(workbook.sheets);
          console.log("[ExcelImport] Multiple sheets detected, suggested:", suggested);
          setSuggestedSheetIndex(suggested);
          setSelectedSheetIndex(suggested);
          setStep("sheets");
        } else {
          // Single sheet - go straight to mapping
          console.log("[ExcelImport] Single sheet, loading data...");
          const data = await getSheetData(f, 0);
          setRawData(data);
          if (data.length > 0) {
            setHeaders(data[0].map(String));
            const detectedMapping = autoDetectMapping(data[0].map(String));
            setMapping(detectedMapping);
          }
          setStep("mapping");
        }
      } else {
        // CSV/TSV file - parse as text
        console.log("[ExcelImport] Parsing CSV/TSV file:", f.name);
        const text = await f.text();

        // Detect delimiter
        const firstLine = text.split("\n")[0];
        const delimiter = firstLine.includes("\t")
          ? "\t"
          : firstLine.includes(";")
          ? ";"
          : ",";

        const rows = parseCSV(text, delimiter);
        setRawData(rows);

        if (rows.length > 0) {
          setHeaders(rows[0]);
          const detectedMapping = autoDetectMapping(rows[0]);
          setMapping(detectedMapping);
        }
        setStep("mapping");
      }
    } catch (err) {
      console.error("[ExcelImport] Failed to load file:", err);
      setError(err instanceof Error ? err.message : "Failed to load spreadsheet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load selected sheet data
  const loadSheet = async (sheetIndex: number) => {
    if (!file) return;
    
    setIsLoading(true);
    try {
      const data = await getSheetData(file, sheetIndex);
      setRawData(data);
      if (data.length > 0) {
        setHeaders(data[0].map(String));
        const detectedMapping = autoDetectMapping(data[0].map(String));
        setMapping(detectedMapping);
      }
      setHeaderRowIndex(0);
      setDataRowStart(1);
      setStep("mapping");
    } catch (error) {
      console.error("Failed to load sheet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update headers when header row changes
  React.useEffect(() => {
    if (rawData.length > headerRowIndex) {
      setHeaders(rawData[headerRowIndex]);
      const detectedMapping = autoDetectMapping(rawData[headerRowIndex]);
      setMapping(detectedMapping);
      setDataRowStart(headerRowIndex + 1);
    }
  }, [headerRowIndex, rawData]);

  // Handle mapping change
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === "" ? undefined : parseInt(value),
    }));
  };

  // Parse data with current mapping
  const handlePreview = () => {
    const result = parseExcelData(rawData, {
      headerRowIndex,
      dataRowStart,
      mapping,
      defaultMaterialId: "MAT-WHITE-18",
      defaultThicknessMm: 18,
    });
    setParseResult(result);
    setStep("preview");
  };

  // Add parts to inbox
  const handleImport = () => {
    if (!parseResult) return;

    const parts: ParsedPartWithStatus[] = parseResult.rows
      .filter((r) => r.part !== null)
      .map((r) => ({
        ...r.part!,
        _status: "pending" as const,
        _originalText: JSON.stringify(r.rawData),
      }));

    addToInbox(parts);
    setStep("complete");
  };

  // Close and report
  const handleClose = () => {
    if (step === "complete" && parseResult) {
      onComplete?.(parseResult.successCount);
    }
    onOpenChange(false);
  };

  // Column options for select
  const columnOptions = [
    { value: "", label: "-- Not mapped --" },
    ...headers.map((h, i) => ({
      value: i.toString(),
      label: `${i + 1}: ${h || "(empty)"}`,
    })),
  ];

  // Check if required fields are mapped
  const isValidMapping = REQUIRED_FIELDS.every(
    (f) => mapping[f] !== undefined
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[var(--cai-teal)]" />
            Import Spreadsheet
            {file && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {file.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {(workbookInfo && workbookInfo.sheetCount > 1 
            ? ["sheets", "mapping", "preview", "complete"] as WizardStep[]
            : ["mapping", "preview", "complete"] as WizardStep[]
          ).map((s, i, arr) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                  step === s
                    ? "bg-[var(--cai-teal)] text-[var(--cai-navy)]"
                    : arr.indexOf(step) > i
                    ? "bg-[var(--cai-teal)]/20 text-[var(--cai-teal)]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                )}
              >
                {i + 1}
              </div>
              {i < arr.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    arr.indexOf(step) > i
                      ? "bg-[var(--cai-teal)]"
                      : "bg-[var(--muted)]"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--cai-teal)] border-t-transparent" />
            <span className="ml-3 text-[var(--muted-foreground)]">Loading spreadsheet...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              Failed to Load Spreadsheet
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md">
              {error}
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : !rawData.length && !workbookInfo ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              No Data Found
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              The spreadsheet appears to be empty or couldn't be read.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Sheet Selection (for multi-sheet Excel files) */}
            {step === "sheets" && workbookInfo && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Layers className="h-4 w-4" />
                  <span>This workbook has {workbookInfo.sheetCount} sheets. Select the one containing your parts list:</span>
                </div>
                
                <div className="grid gap-3">
                  {workbookInfo.sheets.map((sheet, index) => {
                    const isSuggested = index === suggestedSheetIndex;
                    const isSelected = index === selectedSheetIndex;
                    
                    return (
                      <button
                        key={sheet.name}
                        onClick={() => setSelectedSheetIndex(index)}
                        className={cn(
                          "text-left p-4 rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                            : "border-[var(--border)] hover:border-[var(--cai-teal)]/50",
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{sheet.name}</span>
                            {isSuggested && (
                              <Badge variant="teal" className="text-xs gap-1">
                                <Sparkles className="h-3 w-3" />
                                Suggested
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-[var(--muted-foreground)]">
                            {sheet.rowCount} rows × {sheet.colCount} cols
                          </span>
                        </div>
                        
                        {/* Preview of first row (headers) */}
                        {sheet.preview[0] && (
                          <div className="flex flex-wrap gap-1 text-xs">
                            {sheet.preview[0].slice(0, 8).map((cell, i) => (
                              <Badge key={i} variant="outline" className="font-mono">
                                {String(cell).substring(0, 15) || "(empty)"}
                              </Badge>
                            ))}
                            {sheet.preview[0].length > 8 && (
                              <Badge variant="outline" className="text-[var(--muted-foreground)]">
                                +{sheet.preview[0].length - 8} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => loadSheet(selectedSheetIndex)}
                  >
                    Use "{workbookInfo.sheets[selectedSheetIndex]?.name}"
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Column Mapping */}
            {step === "mapping" && rawData.length > 0 && (
              <div className="space-y-6">
                {/* Row configuration */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--muted)] rounded-lg">
                  <Input
                    label="Header Row"
                    type="number"
                    min="0"
                    max={rawData.length - 1}
                    value={headerRowIndex}
                    onChange={(e) => setHeaderRowIndex(parseInt(e.target.value))}
                    hint="Row containing column headers (0-indexed)"
                  />
                  <Input
                    label="Data Starts at Row"
                    type="number"
                    min={headerRowIndex + 1}
                    max={rawData.length - 1}
                    value={dataRowStart}
                    onChange={(e) => setDataRowStart(parseInt(e.target.value))}
                    hint="First row of data (0-indexed)"
                  />
                </div>

                {/* Required mappings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[var(--cai-warning)]" />
                    Required Fields
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {REQUIRED_FIELDS.map((field) => (
                      <SimpleSelect
                        key={field}
                        label={FIELD_LABELS[field]}
                        options={columnOptions}
                        value={mapping[field]?.toString() ?? ""}
                        onChange={(e) => handleMappingChange(field, e.target.value)}
                        error={mapping[field] === undefined ? "Required" : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* Optional mappings */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Optional Fields</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {OPTIONAL_FIELDS.filter(
                      (f) => isAdvancedMode || !f.startsWith("edging")
                    ).map((field) => (
                      <SimpleSelect
                        key={field}
                        label={FIELD_LABELS[field]}
                        options={columnOptions}
                        value={mapping[field]?.toString() ?? ""}
                        onChange={(e) => handleMappingChange(field, e.target.value)}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview of first few rows */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Data Preview</h4>
                  <div className="rounded-lg border border-[var(--border)] overflow-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">#</TableHead>
                          {headers.map((h, i) => (
                            <TableHead key={i} className="min-w-[100px]">
                              {h || `Col ${i + 1}`}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawData.slice(dataRowStart, dataRowStart + 5).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              {dataRowStart + i}
                            </TableCell>
                            {row.map((cell, j) => (
                              <TableCell key={j} className="text-sm">
                                {cell || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                  {workbookInfo && workbookInfo.sheetCount > 1 ? (
                    <Button variant="ghost" onClick={() => setStep("sheets")}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Change Sheet
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={handlePreview}
                    disabled={!isValidMapping}
                  >
                    Preview Import
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Preview */}
            {step === "preview" && parseResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4 p-4 bg-[var(--muted)] rounded-lg">
                  <div>
                    <p className="text-2xl font-bold">{parseResult.successCount}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">parts parsed</p>
                  </div>
                  {parseResult.errorCount > 0 && (
                    <div className="text-[var(--cai-error)]">
                      <p className="text-2xl font-bold">{parseResult.errorCount}</p>
                      <p className="text-sm">errors</p>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-[var(--muted-foreground)] mb-1">
                      Average confidence
                    </p>
                    <Progress
                      value={parseResult.averageConfidence * 100}
                      variant={
                        parseResult.averageConfidence > 0.9
                          ? "success"
                          : parseResult.averageConfidence > 0.7
                          ? "warning"
                          : "error"
                      }
                    />
                  </div>
                </div>

                {/* Parsed parts preview */}
                <div className="rounded-lg border border-[var(--border)] overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">L × W</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.rows.map((row) => (
                        <TableRow
                          key={row.rowIndex}
                          className={cn(!row.part && "bg-red-50/50 text-red-600")}
                        >
                          <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                          <TableCell>{row.part?.label || row.part?.part_id || "-"}</TableCell>
                          <TableCell className="text-right font-mono">{row.part?.qty || "-"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {row.part ? `${row.part.size.L} × ${row.part.size.W}` : "-"}
                          </TableCell>
                          <TableCell>
                            {row.part ? (
                              <Badge variant="success">OK</Badge>
                            ) : (
                              <Badge variant="error">{row.errors[0]}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                  <Button variant="ghost" onClick={() => setStep("mapping")}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Mapping
                  </Button>
                  <Button variant="primary" onClick={handleImport}>
                    <Check className="h-4 w-4 mr-1" />
                    Import {parseResult.successCount} Parts
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {step === "complete" && parseResult && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[var(--cai-teal)]/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-[var(--cai-teal)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
                <p className="text-[var(--muted-foreground)] mb-6">
                  {parseResult.successCount} parts have been added to your intake inbox for review.
                </p>
                <Button variant="primary" onClick={handleClose}>
                  Done
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

