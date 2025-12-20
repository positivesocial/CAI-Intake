"use client";

import * as React from "react";
import {
  QrCode,
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";

type TemplateType = "pdf" | "excel";

interface TemplateConfig {
  name: string;
  type: TemplateType;
  columns: string[];
  includeEdging: boolean;
  includeGrooves: boolean;
  includeNotes: boolean;
  rows: number;
}

const DEFAULT_COLUMNS = ["Label", "Qty", "Length (L)", "Width (W)", "Material", "Grain"];
const ADVANCED_COLUMNS = ["Group", "Notes", "EB L1", "EB L2", "EB W1", "EB W2"];

export function TemplateGenerator() {
  const { currentCutlist, isAdvancedMode } = useIntakeStore();

  const [config, setConfig] = React.useState<TemplateConfig>({
    name: "Cutlist Template",
    type: "excel",
    columns: [...DEFAULT_COLUMNS],
    includeEdging: false,
    includeGrooves: false,
    includeNotes: false,
    rows: 20,
  });

  const [templateId] = React.useState(() => generateId("TPL"));
  const [copied, setCopied] = React.useState(false);

  // Generate QR code data URL (using a simple SVG pattern for demo)
  const qrCodeUrl = React.useMemo(() => {
    // In production, use a proper QR code library like qrcode.react
    // This is a simplified placeholder
    const data = JSON.stringify({
      template_id: templateId,
      org_id: "demo",
      version: 1,
      schema: "cai-cutlist/v1",
    });

    // Create a simple pattern based on the data
    const hash = data.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="white"/>
        <rect x="10" y="10" width="25" height="25" fill="black"/>
        <rect x="65" y="10" width="25" height="25" fill="black"/>
        <rect x="10" y="65" width="25" height="25" fill="black"/>
        <rect x="15" y="15" width="15" height="15" fill="white"/>
        <rect x="70" y="15" width="15" height="15" fill="white"/>
        <rect x="15" y="70" width="15" height="15" fill="white"/>
        <rect x="18" y="18" width="9" height="9" fill="black"/>
        <rect x="73" y="18" width="9" height="9" fill="black"/>
        <rect x="18" y="73" width="9" height="9" fill="black"/>
        <rect x="40" y="40" width="20" height="20" fill="black"/>
        <rect x="45" y="45" width="10" height="10" fill="white"/>
        <rect x="48" y="48" width="4" height="4" fill="black"/>
        ${Array.from({ length: 10 }, (_, i) => {
          const x = 40 + (hash >> (i * 2)) % 20;
          const y = 15 + (hash >> (i * 3)) % 70;
          return `<rect x="${x}" y="${y}" width="3" height="3" fill="black"/>`;
        }).join("")}
      </svg>
    `)}`;
  }, [templateId]);

  const handleCopyTemplateId = () => {
    navigator.clipboard.writeText(templateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // In production, this would generate an actual Excel/PDF file
    // For demo, we'll create a CSV that can be opened in Excel
    
    const headers = [...config.columns];
    if (config.includeEdging) {
      headers.push("EB L1", "EB L2", "EB W1", "EB W2");
    }
    if (config.includeNotes) {
      headers.push("Notes");
    }

    const rows = Array.from({ length: config.rows }, () =>
      headers.map(() => "")
    );

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, "_")}_${templateId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const materialOptions = currentCutlist.materials.map((m) => ({
    value: m.material_id,
    label: m.name,
  }));

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Template Generator</CardTitle>
            <Badge variant="teal">QR-Enabled</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="space-y-4">
            <Input
              label="Template Name"
              value={config.name}
              onChange={(e) =>
                setConfig((c) => ({ ...c, name: e.target.value }))
              }
              placeholder="e.g., Kitchen Cabinet Cutlist"
            />

            <SimpleSelect
              label="Template Format"
              options={[
                { value: "excel", label: "Excel/CSV (fillable)" },
                { value: "pdf", label: "PDF (printable)" },
              ]}
              value={config.type}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  type: e.target.value as TemplateType,
                }))
              }
            />

            <Input
              label="Number of Rows"
              type="number"
              min="5"
              max="100"
              value={config.rows}
              onChange={(e) =>
                setConfig((c) => ({ ...c, rows: parseInt(e.target.value) || 20 }))
              }
            />

            {/* Optional columns */}
            <div>
              <p className="text-sm font-medium mb-2">Include Columns</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)]"
                    checked={config.includeEdging}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        includeEdging: e.target.checked,
                      }))
                    }
                  />
                  Edge banding columns (L1, L2, W1, W2)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)]"
                    checked={config.includeNotes}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        includeNotes: e.target.checked,
                      }))
                    }
                  />
                  Notes column
                </label>
              </div>
            </div>

            {/* Template ID */}
            <div className="p-3 bg-[var(--muted)] rounded-lg">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">
                Template ID (encoded in QR)
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-[var(--card)] px-2 py-1 rounded">
                  {templateId}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyTemplateId}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Template Preview</div>
            <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
              {/* QR Code */}
              <div className="flex items-start gap-4 mb-4">
                <img
                  src={qrCodeUrl}
                  alt="Template QR Code"
                  className="w-20 h-20 border border-[var(--border)] rounded"
                />
                <div>
                  <p className="font-semibold text-[var(--cai-navy)]">
                    {config.name || "Cutlist Template"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    CAI Intake Template v1
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    ID: {templateId.slice(0, 12)}...
                  </p>
                </div>
              </div>

              {/* Table preview */}
              <div className="overflow-auto max-h-[200px]">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 px-2 py-1 bg-gray-100">
                        #
                      </th>
                      {config.columns.map((col) => (
                        <th
                          key={col}
                          className="border border-gray-300 px-2 py-1 bg-gray-100"
                        >
                          {col}
                        </th>
                      ))}
                      {config.includeEdging && (
                        <>
                          <th className="border border-gray-300 px-2 py-1 bg-gray-100">
                            L1
                          </th>
                          <th className="border border-gray-300 px-2 py-1 bg-gray-100">
                            L2
                          </th>
                          <th className="border border-gray-300 px-2 py-1 bg-gray-100">
                            W1
                          </th>
                          <th className="border border-gray-300 px-2 py-1 bg-gray-100">
                            W2
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-400">
                          {i + 1}
                        </td>
                        {config.columns.map((col) => (
                          <td
                            key={col}
                            className="border border-gray-300 px-2 py-1"
                          >
                            &nbsp;
                          </td>
                        ))}
                        {config.includeEdging && (
                          <>
                            <td className="border border-gray-300 px-2 py-1 w-8">
                              □
                            </td>
                            <td className="border border-gray-300 px-2 py-1 w-8">
                              □
                            </td>
                            <td className="border border-gray-300 px-2 py-1 w-8">
                              □
                            </td>
                            <td className="border border-gray-300 px-2 py-1 w-8">
                              □
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={100}
                        className="border border-gray-300 px-2 py-1 text-center text-gray-400"
                      >
                        ... {config.rows - 5} more rows ...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download buttons */}
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download {config.type === "excel" ? "CSV" : "PDF"}
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3">
          <p className="font-medium mb-1">How QR Templates work:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Download and print the template or fill it in Excel</li>
            <li>
              Write/enter your parts data in the table
            </li>
            <li>
              Upload the filled template - the QR code tells CAI Intake exactly
              how to parse it
            </li>
            <li>
              AI-powered recognition extracts your data with 99%+ accuracy
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

