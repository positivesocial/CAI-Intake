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
  type OrgTemplateConfig,
  type GeneratedTemplate,
} from "@/lib/templates/org-template-generator";

type TemplateType = "pdf" | "excel";

interface TemplateConfig {
  name: string;
  type: TemplateType;
  includeEdging: boolean;
  includeGrooves: boolean;
  includeHoles: boolean;
  includeCNC: boolean;
  includeNotes: boolean;
  rows: number;
  version: string;
}

export function TemplateGenerator() {
  const { currentCutlist } = useIntakeStore();

  const [config, setConfig] = React.useState<TemplateConfig>({
    name: "Cutlist Template",
    type: "pdf",
    includeEdging: true,
    includeGrooves: false,
    includeHoles: false,
    includeCNC: false,
    includeNotes: true,
    rows: 25,
    version: "1.0",
  });

  const [templateId] = React.useState(() => generateId("TPL"));
  const [copied, setCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedTemplate, setGeneratedTemplate] = React.useState<GeneratedTemplate | null>(null);

  // Build org template config from current cutlist
  const orgTemplateConfig: OrgTemplateConfig = React.useMemo(() => ({
    branding: {
      org_id: "org-demo", // TODO: Get from auth context
      name: "Your Organization", // TODO: Get from org settings
      primary_color: "#00838F",
      secondary_color: "#004D40",
    },
    title: config.name,
    version: config.version,
    rows: config.rows,
    includeEdgebanding: config.includeEdging,
    includeGrooves: config.includeGrooves,
    includeHoles: config.includeHoles,
    includeCNC: config.includeCNC,
    includeNotes: config.includeNotes,
    materials: currentCutlist.materials.map(m => ({
      material_id: m.material_id,
      name: m.name,
      thickness_mm: m.thickness_mm,
      // Generate a short code from material_id or SKU if available
      code: (m as { sku?: string }).sku || m.material_id.slice(0, 8).toUpperCase(),
    })),
    edgebands: currentCutlist.edgebands?.map(e => ({
      edgeband_id: e.edgeband_id,
      name: e.name,
      thickness_mm: e.thickness_mm,
      // Generate a short code from edgeband_id
      code: e.edgeband_id.slice(0, 8).toUpperCase(),
    })),
    // TODO: Load from org's libraries
    grooveProfiles: config.includeGrooves ? [
      { profile_id: "GRV-BP4", name: "Back Panel 4mm", width_mm: 4, depth_mm: 10, code: "BP4" },
      { profile_id: "GRV-LP18", name: "Light Profile 18mm", width_mm: 18, depth_mm: 8, code: "LP18" },
    ] : undefined,
    holePatterns: config.includeHoles ? [
      { pattern_id: "HP-S32", name: "System 32", code: "S32", description: "32mm spacing" },
      { pattern_id: "HP-SP", name: "Shelf Pins", code: "SP", description: "Shelf pin holes" },
      { pattern_id: "HP-H110", name: "110° Hinge Bore", code: "H110", description: "35mm cup bore" },
    ] : undefined,
    routingProfiles: config.includeCNC ? [
      { profile_id: "RT-SINK", name: "Sink Cutout", code: "CUTOUT-SINK" },
      { profile_id: "RT-POCKET", name: "Pocket Route", code: "POCKET" },
    ] : undefined,
  }), [config, currentCutlist.materials, currentCutlist.edgebands]);

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
      includeHoles: caps.cnc_holes ?? false,
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
                    checked={config.includeHoles}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeHoles: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Holes/Drilling
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

            {/* Materials Summary */}
            <div className="p-3 border border-[var(--border)] rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--cai-teal)]" />
                Materials Reference
              </p>
              <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                <p>{currentCutlist.materials.length} sheet materials available</p>
                <p>{currentCutlist.edgebands?.length || 0} edgebands available</p>
                {config.includeGrooves && <p>2 groove profiles included</p>}
                {config.includeHoles && <p>3 hole patterns included</p>}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2 italic">
                Materials addendum will be included in PDF template
              </p>
            </div>
          </div>

          {/* Preview & Actions */}
          <div className="space-y-4">
            {/* Live Preview Card */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
              <div className="bg-[var(--cai-teal)] text-white px-4 py-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{config.name || "Cutlist Template"}</p>
                  <p className="text-xs opacity-80">v{config.version}</p>
                </div>
                <div className="w-12 h-12 bg-white rounded flex items-center justify-center">
                  <QrCode className="h-8 w-8 text-gray-800" />
                </div>
              </div>
              
              <div className="p-3">
                {/* Project Fields Preview */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Project:</span>
                    <span className="flex-1 border-b border-dashed border-gray-400"></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Page:</span>
                    <span className="w-8 border-b border-dashed border-gray-400"></span>
                    <span>of</span>
                    <span className="w-8 border-b border-dashed border-gray-400"></span>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 px-1 py-0.5 bg-[var(--cai-teal)] text-white">#</th>
                        <th className="border border-gray-300 px-1 py-0.5 bg-[var(--cai-teal)] text-white">Label</th>
                        <th className="border border-gray-300 px-1 py-0.5 bg-[var(--cai-teal)] text-white">L</th>
                        <th className="border border-gray-300 px-1 py-0.5 bg-[var(--cai-teal)] text-white">W</th>
                        <th className="border border-gray-300 px-1 py-0.5 bg-[var(--cai-teal)] text-white">Qty</th>
                        {config.includeEdging && (
                          <>
                            <th className="border border-gray-300 px-1 py-0.5 bg-blue-600 text-white">L1</th>
                            <th className="border border-gray-300 px-1 py-0.5 bg-blue-600 text-white">L2</th>
                          </>
                        )}
                        {config.includeGrooves && (
                          <th className="border border-gray-300 px-1 py-0.5 bg-amber-600 text-white">Grv</th>
                        )}
                        {config.includeHoles && (
                          <th className="border border-gray-300 px-1 py-0.5 bg-purple-600 text-white">H</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map(i => (
                        <tr key={i}>
                          <td className="border border-gray-300 px-1 py-0.5 text-center text-gray-400">{i}</td>
                          <td className="border border-gray-300 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 px-1 py-0.5">&nbsp;</td>
                          <td className="border border-gray-300 px-1 py-0.5">&nbsp;</td>
                          {config.includeEdging && (
                            <>
                              <td className="border border-gray-300 px-1 py-0.5 bg-blue-50">□</td>
                              <td className="border border-gray-300 px-1 py-0.5 bg-blue-50">□</td>
                            </>
                          )}
                          {config.includeGrooves && (
                            <td className="border border-gray-300 px-1 py-0.5 bg-amber-50">&nbsp;</td>
                          )}
                          {config.includeHoles && (
                            <td className="border border-gray-300 px-1 py-0.5 bg-purple-50">&nbsp;</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[9px] text-gray-400 text-center mt-2">
                  ... {config.rows - 3} more rows | Shortcode guide included
                </p>
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
          <p className="font-medium mb-2 text-[var(--foreground)]">📋 How Templates Work</p>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">1. Download</div>
              <p>Get your org-branded PDF or CSV template with QR code and materials list</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">2. Fill In</div>
              <p>Write project code, page numbers, and parts. Use shortcodes from the guide</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">3. Upload</div>
              <p>Scan/upload filled template - QR tells AI exactly how to parse it</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-[var(--foreground)]">4. Review</div>
              <p>Multi-page uploads with same project code are merged automatically</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
