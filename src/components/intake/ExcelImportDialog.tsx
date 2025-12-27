"use client";

/**
 * Excel/CSV Import Dialog
 * 
 * A dialog wrapper for the Excel import wizard.
 * Used when Excel/CSV files are dropped on the smart file uploader.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSpreadsheet } from "lucide-react";
import {
  parseCSV,
  parseExcelData,
  autoDetectMapping,
  type ColumnMapping,
  type ExcelParseResult,
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

type WizardStep = "mapping" | "preview" | "complete";

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
    }
  }, [open, file]);

  const loadFile = async (f: File) => {
    setIsLoading(true);
    try {
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
    } catch (error) {
      console.error("Failed to load file:", error);
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
          {(["mapping", "preview", "complete"] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                  step === s
                    ? "bg-[var(--cai-teal)] text-[var(--cai-navy)]"
                    : i < ["mapping", "preview", "complete"].indexOf(step)
                    ? "bg-[var(--cai-teal)]/20 text-[var(--cai-teal)]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                )}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    i < ["mapping", "preview", "complete"].indexOf(step)
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
        ) : (
          <>
            {/* Step 1: Column Mapping */}
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
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
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

            {/* Step 2: Preview */}
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

