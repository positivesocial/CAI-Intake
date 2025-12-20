"use client";

import * as React from "react";
import {
  Keyboard,
  FileSpreadsheet,
  Mic,
  Upload,
  QrCode,
  Settings,
  Download,
  Trash2,
  BarChart3,
  ChevronRight,
  Home,
  X,
  List,
  Undo2,
  Redo2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  QuickParseField,
  ManualEntryForm,
  IntakeInbox,
  ExcelImport,
  VoiceDictation,
  FileUpload,
  TemplateGenerator,
  StatsSidebar,
} from "@/components/intake";
import { PartsTable } from "@/components/parts";
import { useIntakeStore } from "@/lib/store";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { cn } from "@/lib/utils";

const INTAKE_MODES = [
  {
    id: "manual",
    label: "Manual",
    icon: Keyboard,
    description: "Type or paste parts",
  },
  {
    id: "excel",
    label: "Excel/CSV",
    icon: FileSpreadsheet,
    description: "Import spreadsheets",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    description: "Dictate parts",
  },
  {
    id: "file",
    label: "File Upload",
    icon: Upload,
    description: "PDF, images, docs",
  },
  {
    id: "template",
    label: "Template",
    icon: QrCode,
    description: "QR-coded forms",
  },
] as const;

export default function IntakePage() {
  const {
    currentCutlist,
    inboxParts,
    activeMode,
    setActiveMode,
    isAdvancedMode,
    toggleAdvancedMode,
    setCutlistName,
    resetCutlist,
    setCapabilities,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useIntakeStore();
  
  const [showStats, setShowStats] = React.useState(true);
  const [showMobileStats, setShowMobileStats] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<"intake" | "parts">("intake");

  const totalParts = currentCutlist.parts.length;
  const totalPieces = currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const inboxCount = inboxParts.filter((p) => p._status !== "rejected").length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Breadcrumb & Title */}
            <div className="flex items-center gap-3">
              {/* Breadcrumb */}
              <nav className="hidden md:flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                <Link href="/dashboard" className="hover:text-[var(--foreground)] transition-colors">
                  <Home className="h-4 w-4" />
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-[var(--foreground)]">Intake</span>
              </nav>
              
              {/* Divider */}
              <div className="hidden md:block w-px h-6 bg-[var(--border)]" />

              {/* Cutlist name */}
              <div className="flex items-center gap-2">
                <Input
                  value={currentCutlist.name}
                  onChange={(e) => setCutlistName(e.target.value)}
                  className="w-[180px] lg:w-[220px] h-8 text-sm font-medium border-transparent hover:border-[var(--border)] focus:border-[var(--cai-teal)]"
                  placeholder="Cutlist name..."
                />
              </div>
            </div>

            {/* Center: Stats */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--cai-navy)]">{totalParts}</span>
                <span className="text-xs text-[var(--muted-foreground)]">Parts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--cai-navy)]">{totalPieces}</span>
                <span className="text-xs text-[var(--muted-foreground)]">Pieces</span>
              </div>
              {inboxCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-[var(--cai-teal)]">{inboxCount}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">In Inbox</span>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStats(!showStats)}
                className={cn(
                  "hidden xl:flex",
                  showStats && "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Stats</span>
              </Button>
              <Button
                variant={isAdvancedMode ? "default" : "outline"}
                size="sm"
                onClick={toggleAdvancedMode}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">
                  {isAdvancedMode ? "Advanced" : "Simple"}
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={resetCutlist}>
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Clear</span>
              </Button>
              <Button variant="primary" size="sm">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Export</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column - Input Methods */}
              <div className={cn(
                "xl:col-span-2 space-y-6",
                mobileView === "parts" && "hidden md:block"
              )}>
                {/* Mode Tabs - Hidden on mobile (using bottom nav instead) */}
                <Tabs
                  value={activeMode}
                  onValueChange={(v) => setActiveMode(v as typeof activeMode)}
                >
                  <TabsList className="hidden md:grid w-full grid-cols-5 h-auto p-1">
                    {INTAKE_MODES.map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <TabsTrigger
                          key={mode.id}
                          value={mode.id}
                          className="flex flex-col items-center gap-1 py-2.5 px-2"
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium">{mode.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {/* Manual Entry */}
                  <TabsContent value="manual" className="space-y-6 mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <QuickParseField />
                      </CardContent>
                    </Card>
                    <ManualEntryForm />
                  </TabsContent>

                  {/* Excel Import */}
                  <TabsContent value="excel" className="mt-4">
                    <ExcelImport />
                  </TabsContent>

                  {/* Voice Dictation */}
                  <TabsContent value="voice" className="mt-4">
                    <VoiceDictation />
                  </TabsContent>

                  {/* File Upload */}
                  <TabsContent value="file" className="mt-4">
                    <FileUpload />
                  </TabsContent>

                  {/* Template */}
                  <TabsContent value="template" className="mt-4">
                    <TemplateGenerator />
                  </TabsContent>
                </Tabs>

                {/* Intake Inbox */}
                {inboxParts.length > 0 && <IntakeInbox />}

                {/* Parts Table - Hidden on mobile when in intake view */}
                <div className="hidden md:block">
                  <PartsTable />
                </div>
              </div>
              
              {/* Mobile Parts View */}
              <div className={cn(
                "xl:hidden",
                mobileView !== "parts" && "hidden"
              )}>
                {/* Mobile-specific header for parts */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Parts List</h2>
                    <Badge variant="secondary">{totalParts} parts</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={undo}
                      disabled={!canUndo()}
                      className="h-9 w-9"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={redo}
                      disabled={!canRedo()}
                      className="h-9 w-9"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <PartsTable />
              </div>

              {/* Right Column - Summary & Actions (hidden on smaller screens when stats sidebar is shown) */}
              <div className={cn(
                "space-y-6",
                showStats && "hidden xl:block"
              )}>
                {/* Quick Stats */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-4">Cutlist Summary</h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted-foreground)]">
                          Total Parts
                        </span>
                        <span className="font-semibold">{totalParts}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted-foreground)]">
                          Total Pieces
                        </span>
                        <span className="font-semibold">{totalPieces}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted-foreground)]">
                          Materials Used
                        </span>
                        <span className="font-semibold">
                          {
                            new Set(currentCutlist.parts.map((p) => p.material_id))
                              .size
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted-foreground)]">
                          Total Area
                        </span>
                        <span className="font-semibold">
                          {(
                            currentCutlist.parts.reduce(
                              (sum, p) => sum + p.qty * p.size.L * p.size.W,
                              0
                            ) / 1_000_000
                          ).toFixed(2)}{" "}
                          m²
                        </span>
                      </div>
                    </div>

                    {/* Material breakdown */}
                    {totalParts > 0 && (
                      <div className="mt-6 pt-4 border-t border-[var(--border)]">
                        <h4 className="text-sm font-medium mb-3">By Material</h4>
                        <div className="space-y-2">
                          {Object.entries(
                            currentCutlist.parts.reduce(
                              (acc, part) => {
                                acc[part.material_id] =
                                  (acc[part.material_id] || 0) + part.qty;
                                return acc;
                              },
                              {} as Record<string, number>
                            )
                          ).map(([matId, count]) => {
                            const material = currentCutlist.materials.find(
                              (m) => m.material_id === matId
                            );
                            return (
                              <div
                                key={matId}
                                className="flex justify-between items-center text-sm"
                              >
                                <span className="text-[var(--muted-foreground)] truncate">
                                  {material?.name || matId}
                                </span>
                                <Badge variant="secondary">{count} pcs</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Export Options */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-4">Export & Optimize</h3>

                    <div className="space-y-2">
                      <Button
                        variant="primary"
                        className="w-full"
                        disabled={totalParts === 0}
                      >
                        <Download className="h-4 w-4" />
                        Send to CAI 2D Optimizer
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={totalParts === 0}
                      >
                        Export as JSON
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={totalParts === 0}
                      >
                        Export for MaxCut
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={totalParts === 0}
                      >
                        Export for CutList Plus
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Capabilities */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Capabilities</h3>
                      <Badge variant={isAdvancedMode ? "teal" : "secondary"}>
                        {isAdvancedMode ? "Advanced" : "Simple"}
                      </Badge>
                    </div>

                    <div className="space-y-3 text-sm">
                      {/* Core dimensions - always on */}
                      <div className="flex items-center justify-between">
                        <span>Core dimensions</span>
                        <Badge variant="success">Always On</Badge>
                      </div>

                      {/* Edge banding */}
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="group-hover:text-[var(--foreground)]">Edge banding</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentCutlist.capabilities.edging}
                          onClick={() => setCapabilities({ edging: !currentCutlist.capabilities.edging })}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
                            currentCutlist.capabilities.edging ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                              currentCutlist.capabilities.edging ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>

                      {/* Grooves */}
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="group-hover:text-[var(--foreground)]">Grooves</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentCutlist.capabilities.grooves}
                          onClick={() => setCapabilities({ grooves: !currentCutlist.capabilities.grooves })}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
                            currentCutlist.capabilities.grooves ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                              currentCutlist.capabilities.grooves ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>

                      {/* CNC Holes */}
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="group-hover:text-[var(--foreground)]">CNC Holes</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentCutlist.capabilities.cnc_holes}
                          onClick={() => setCapabilities({ cnc_holes: !currentCutlist.capabilities.cnc_holes })}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
                            currentCutlist.capabilities.cnc_holes ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                              currentCutlist.capabilities.cnc_holes ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>

                      {/* CNC Routing */}
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="group-hover:text-[var(--foreground)]">CNC Routing</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentCutlist.capabilities.cnc_routing}
                          onClick={() => setCapabilities({ cnc_routing: !currentCutlist.capabilities.cnc_routing })}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
                            currentCutlist.capabilities.cnc_routing ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                              currentCutlist.capabilities.cnc_routing ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>

                      {/* Custom CNC */}
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="group-hover:text-[var(--foreground)]">Custom CNC Ops</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentCutlist.capabilities.custom_cnc}
                          onClick={() => setCapabilities({ custom_cnc: !currentCutlist.capabilities.custom_cnc })}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
                            currentCutlist.capabilities.custom_cnc ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                              currentCutlist.capabilities.custom_cnc ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>
                    </div>

                    {/* Quick enable all CNC */}
                    {(!currentCutlist.capabilities.grooves || 
                      !currentCutlist.capabilities.cnc_holes || 
                      !currentCutlist.capabilities.cnc_routing) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-4 text-[var(--cai-teal)]"
                        onClick={() => setCapabilities({
                          grooves: true,
                          cnc_holes: true,
                          cnc_routing: true,
                          custom_cnc: true,
                        })}
                      >
                        Enable All CNC Features
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
        
        {/* Statistics Sidebar - Right Edge (Desktop) */}
        {showStats && (
          <aside className="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">
            <StatsSidebar />
          </aside>
        )}
      </div>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--card)] border-t border-[var(--border)] z-50 safe-area-inset-bottom">
        <div className="grid grid-cols-5 h-full">
          {INTAKE_MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id && mobileView === "intake";
            return (
              <button
                key={mode.id}
                onClick={() => {
                  setActiveMode(mode.id as typeof activeMode);
                  setMobileView("intake");
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-colors",
                  isActive
                    ? "text-[var(--cai-teal)] bg-[var(--cai-teal)]/10"
                    : "text-[var(--muted-foreground)]"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      
      {/* Mobile View Toggle - Parts List */}
      <button
        onClick={() => setMobileView(mobileView === "parts" ? "intake" : "parts")}
        className={cn(
          "md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
          mobileView === "parts"
            ? "bg-[var(--cai-teal)] text-white"
            : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]"
        )}
      >
        <List className="h-6 w-6" />
        {totalParts > 0 && mobileView !== "parts" && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {totalParts > 99 ? "99+" : totalParts}
          </span>
        )}
      </button>
      
      {/* Mobile Stats Button */}
      <button
        onClick={() => setShowMobileStats(true)}
        className="md:hidden fixed bottom-20 left-4 z-50 w-14 h-14 rounded-full shadow-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center"
      >
        <BarChart3 className="h-6 w-6" />
      </button>
      
      {/* Mobile Stats Drawer */}
      {showMobileStats && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowMobileStats(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[var(--card)] rounded-t-3xl max-h-[80vh] overflow-auto safe-area-inset-bottom animate-slide-up">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
              <h2 className="font-semibold text-lg">Cutlist Statistics</h2>
              <button
                onClick={() => setShowMobileStats(false)}
                className="p-2 hover:bg-[var(--muted)] rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 pb-20">
              <StatsSidebar />
            </div>
          </div>
        </>
      )}
      
      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog />
      
      {/* Add padding for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
