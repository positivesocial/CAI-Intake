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
  Eye,
  Printer,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import {
  generateOrgTemplate,
  generateOrgExcelTemplate,
  generateShortcodesHash,
  type OrgTemplateConfig,
  type OpsShortcode,
  type GeneratedTemplate,
} from "@/lib/templates/org-template-generator";

type TemplateType = "pdf" | "excel";

interface TemplateConfig {
  name: string;
  type: TemplateType;
  includeEdging: boolean;
  includeGrooves: boolean;
  includeDrilling: boolean;
  includeCNC: boolean;
  includeNotes: boolean;
  rows: number;
  version: string;
}

export function TemplateGenerator() {
  const { currentCutlist } = useIntakeStore();

  const [config, setConfig] = React.useState<TemplateConfig>({
    name: "Smart Cutlist Template",
    type: "pdf",
    includeEdging: true,
    includeGrooves: false,
    includeDrilling: false,
    includeCNC: false,
    includeNotes: true,
    rows: 25,
    version: "1.0",
  });

  const [copied, setCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedTemplate, setGeneratedTemplate] = React.useState<GeneratedTemplate | null>(null);

  // TODO: Load org shortcodes from API/database
  const orgShortcodes: OpsShortcode[] = React.useMemo(() => {
    // These would come from the org's ops/shortcodes tables
    const shortcodes: OpsShortcode[] = [];
    
    // Default shortcodes - in production, load from org settings
    if (config.includeEdging) {
      shortcodes.push(
        { id: "eb1", code: "L", name: "Length only", category: "edgebanding" },
        { id: "eb2", code: "W", name: "Width only", category: "edgebanding" },
        { id: "eb3", code: "2L", name: "Both lengths", category: "edgebanding" },
        { id: "eb4", code: "2W", name: "Both widths", category: "edgebanding" },
        { id: "eb5", code: "LW", name: "Length + Width", category: "edgebanding" },
        { id: "eb6", code: "2L2W", name: "All 4 sides", category: "edgebanding" },
        { id: "eb7", code: "None", name: "no banding", category: "edgebanding" },
      );
    }
    
    if (config.includeGrooves) {
      shortcodes.push(
        { id: "grv1", code: "L", name: "Along length", category: "grooving" },
        { id: "grv2", code: "W", name: "Along width", category: "grooving" },
        { id: "grv3", code: "2L", name: "Both length sides", category: "grooving" },
        { id: "grv4", code: "2W", name: "Both width sides", category: "grooving" },
        { id: "grv5", code: "blank", name: "no groove", category: "grooving" },
      );
    }
    
    if (config.includeDrilling) {
      shortcodes.push(
        { id: "dr1", code: "H2", name: "2 hinge holes", category: "drilling" },
        { id: "dr2", code: "SP4", name: "4 shelf pins", category: "drilling" },
        { id: "dr3", code: "HD", name: "Handle drill", category: "drilling" },
      );
    }
    
    if (config.includeCNC) {
      shortcodes.push(
        { id: "cnc1", code: "RADIUS", name: "Radius corners", category: "cnc" },
        { id: "cnc2", code: "PROFILE", name: "Profile edge", category: "cnc" },
        { id: "cnc3", code: "CUTOUT", name: "Sink/hob cutout", category: "cnc" },
      );
    }
    
    return shortcodes;
  }, [config.includeEdging, config.includeGrooves, config.includeDrilling, config.includeCNC]);

  // Generate shortcodes hash for versioning
  const shortcodesHash = React.useMemo(() => 
    generateShortcodesHash(orgShortcodes), 
    [orgShortcodes]
  );

  // Template ID format: CAI-{org_id}-v{version}
  // Identifies: 1) CAI template, 2) Which org, 3) Version (tracks shortcode changes)
  const orgId = "org-demo"; // TODO: Get from auth context
  const templateId = `CAI-${orgId}-v${config.version}`;

  // Build org template config from current cutlist
  const orgTemplateConfig: OrgTemplateConfig = React.useMemo(() => ({
    branding: {
      org_id: orgId, // From auth context
      name: "Your Organization", // TODO: Get from org settings
      primary_color: "#6B21A8", // Purple (Cabinet AI style)
      secondary_color: "#4C1D95",
    },
    title: config.name,
    version: config.version,
    rows: config.rows,
    includeEdgebanding: config.includeEdging,
    includeGrooves: config.includeGrooves,
    includeDrilling: config.includeDrilling,
    includeCNC: config.includeCNC,
    includeNotes: config.includeNotes,
    materials: currentCutlist.materials.map(m => ({
      material_id: m.material_id,
      name: m.name,
      thickness_mm: m.thickness_mm,
      code: (m as { sku?: string }).sku || m.material_id.slice(0, 6).toUpperCase(),
    })),
    edgebands: currentCutlist.edgebands?.map(e => ({
      edgeband_id: e.edgeband_id,
      name: e.name,
      thickness_mm: e.thickness_mm,
      code: e.edgeband_id.slice(0, 6).toUpperCase(),
    })),
    shortcodes: orgShortcodes,
    shortcodesHash,
  }), [config, currentCutlist.materials, currentCutlist.edgebands, orgShortcodes, shortcodesHash]);

  const handleCopyTemplateId = () => {
    navigator.clipboard.writeText(templateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateTemplate = () => {
    setIsGenerating(true);
    // Simulate async generation
    setTimeout(() => {
      const template = generateOrgTemplate(orgTemplateConfig);
      setGeneratedTemplate(template);
      setIsGenerating(false);
    }, 300);
  };

  const handleDownloadPDF = () => {
    if (!generatedTemplate) {
      handleGenerateTemplate();
      return;
    }

    // Open HTML in new window for printing to PDF
    const blob = new Blob([generatedTemplate.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.document.title = `${config.name}_v${config.version}.pdf`;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDownloadCSV = () => {
    const csv = generateOrgExcelTemplate(orgTemplateConfig);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.name.replace(/\s+/g, "_")}_v${config.version}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreview = () => {
    const template = generateOrgTemplate(orgTemplateConfig);
    const blob = new Blob([template.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Sync capabilities with cutlist capabilities
  React.useEffect(() => {
    const caps = currentCutlist.capabilities;
    setConfig(c => ({
      ...c,
      includeEdging: caps.edging ?? true,
      includeGrooves: caps.grooves ?? false,
      includeDrilling: caps.cnc_holes ?? false,
      includeCNC: caps.cnc_routing || caps.custom_cnc || false,
    }));
  }, [currentCutlist.capabilities]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Template Generator</CardTitle>
            <Badge variant="teal">Org Branded</Badge>
          </div>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Generate branded templates with QR codes for AI-powered parsing
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Input
                label="Template Name"
                value={config.name}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, name: e.target.value }))
                }
                placeholder="e.g., Kitchen Cabinet Cutlist"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Version"
                  value={config.version}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, version: e.target.value }))
                  }
                  placeholder="1.0"
                />
                <Input
                  label="Rows"
                  type="number"
                  min="5"
                  max="100"
                  value={config.rows}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, rows: parseInt(e.target.value) || 25 }))
                  }
                />
              </div>
            </div>

            {/* Operation Columns */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Include Operations</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)] accent-[var(--cai-teal)] h-4 w-4"
                    checked={config.includeEdging}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeEdging: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Edge banding
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)] accent-[var(--cai-teal)] h-4 w-4"
                    checked={config.includeGrooves}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeGrooves: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Grooves
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)] accent-[var(--cai-teal)] h-4 w-4"
                    checked={config.includeDrilling}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeDrilling: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Drilling
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)] accent-[var(--cai-teal)] h-4 w-4"
                    checked={config.includeCNC}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeCNC: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    CNC Operations
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--muted)] transition-colors col-span-2">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--border)] accent-[var(--cai-teal)] h-4 w-4"
                    checked={config.includeNotes}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeNotes: e.target.checked }))
                    }
                  />
                  <span>Notes column</span>
                </label>
              </div>
            </div>

            {/* Template ID */}
            <div className="p-3 bg-[var(--muted)] rounded-lg">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">
                Template ID (encoded in QR)
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-[var(--card)] px-2 py-1 rounded truncate">
                  {templateId}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
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

            {/* Materials & Shortcodes Summary */}
            <div className="p-3 border border-[var(--border)] rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--cai-teal)]" />
                Template Contents
              </p>
              <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                <p><strong>{currentCutlist.materials.length}</strong> sheet materials</p>
                <p><strong>{currentCutlist.edgebands?.length || 0}</strong> edgebands</p>
                <p><strong>{orgShortcodes.length}</strong> operation shortcodes</p>
              </div>
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-200">Best OCR Tips:</p>
                <p className="text-amber-700 dark:text-amber-300">• Use BLOCK LETTERS</p>
                <p className="text-amber-700 dark:text-amber-300">• Take clear photos</p>
              </div>
            </div>
          </div>

          {/* Preview & Actions */}
          <div className="space-y-4">
            {/* Live Preview Card */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white dark:bg-gray-900">
              {/* Header with QR and branding */}
              <div className="bg-purple-800 text-white px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
                    <QrCode className="h-7 w-7 text-gray-800" />
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase tracking-wide">Your Organization</p>
                    <p className="text-xs opacity-80">{config.name} v{config.version}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="font-mono text-purple-200">{templateId}</p>
                </div>
              </div>
              
              <div className="p-3">
                {/* Project Info Box */}
                <div className="border border-gray-300 dark:border-gray-600 p-2 mb-3 text-xs">
                  <p className="font-bold text-[10px] mb-2">PROJECT INFORMATION (Must fill for multi-page)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 dark:text-gray-400">Project Name:</span>
                      <span className="flex-1 border-b border-gray-400 dark:border-gray-500"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 dark:text-gray-400">Project Code:</span>
                      <span className="flex-1 border-b border-gray-400 dark:border-gray-500"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                      <span className="flex-1 border-b border-gray-400 dark:border-gray-500"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 dark:text-gray-400">Section/Area:</span>
                      <span className="flex-1 border-b border-gray-400 dark:border-gray-500"></span>
                    </div>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">#</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">Part Name</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">L</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">W</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">Qty</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-800 text-white">Mat</th>
                        {config.includeEdging && (
                          <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-200 text-purple-800">Edge</th>
                        )}
                        {config.includeGrooves && (
                          <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-200 text-purple-800">Grv</th>
                        )}
                        {config.includeDrilling && (
                          <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-200 text-purple-800">Drill</th>
                        )}
                        {config.includeCNC && (
                          <th className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-200 text-purple-800">CNC</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map(i => (
                        <tr key={i}>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 text-center text-gray-400 bg-gray-50 dark:bg-gray-800">{i}</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5">&nbsp;</td>
                          {config.includeEdging && (
                            <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-50 dark:bg-purple-950">&nbsp;</td>
                          )}
                          {config.includeGrooves && (
                            <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-50 dark:bg-purple-950">&nbsp;</td>
                          )}
                          {config.includeDrilling && (
                            <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-50 dark:bg-purple-950">&nbsp;</td>
                          )}
                          {config.includeCNC && (
                            <td className="border border-gray-300 dark:border-gray-600 px-1 py-0.5 bg-purple-50 dark:bg-purple-950">&nbsp;</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center mt-2">
                  ... {config.rows - 3} more rows | Fill-in guide + materials ref included
                </p>
                
                {/* Page indicator */}
                <div className="flex items-center justify-end gap-1 mt-2 text-xs">
                  <span className="text-gray-500">Page:</span>
                  <span className="w-6 h-5 border border-gray-400 inline-block"></span>
                  <span className="text-gray-500">of</span>
                  <span className="w-6 h-5 border border-gray-400 inline-block"></span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handlePreview}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadCSV}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
            <Button
              variant="primary"
              onClick={handleDownloadPDF}
              className="w-full gap-2"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Download PDF Template
            </Button>
          </div>
        </div>

        {/* How It Works */}
        <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-4">
          <p className="font-medium mb-2 text-[var(--foreground)]">📋 How Smart Templates Work</p>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">1. Download</div>
              <p>Get org-branded PDF with QR code, template ID, and your shortcodes</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">2. Fill In</div>
              <p>Write project code + page number. Use BLOCK LETTERS and org shortcodes</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">3. Upload</div>
              <p>QR + corner markers enable 100% accurate OCR with deterministic columns</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">4. Auto-Merge</div>
              <p>Pages with same project code are merged by page number automatically</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">
            💡 When org shortcodes change, templates are auto-versioned. Older templates remain compatible.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
