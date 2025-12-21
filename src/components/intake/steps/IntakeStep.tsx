"use client";

import * as React from "react";
import {
  Keyboard,
  ClipboardPaste,
  FileSpreadsheet,
  Mic,
  Upload,
  QrCode,
  Inbox,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  QuickAddField,
  PasteParsePanel,
  ManualEntryForm,
  IntakeInbox,
  ExcelImport,
  VoiceDictation,
  FileUpload,
  TemplateGenerator,
} from "@/components/intake";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StepNavigation } from "@/components/ui/stepper";

const INTAKE_MODES = [
  {
    id: "manual",
    label: "Manual",
    icon: Keyboard,
    description: "Spreadsheet entry",
  },
  {
    id: "paste",
    label: "Paste",
    icon: ClipboardPaste,
    description: "Parse text data",
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

export function IntakeStep() {
  const {
    activeMode,
    setActiveMode,
    inboxParts,
    currentCutlist,
    goToPreviousStep,
    goToNextStep,
    canProceedToReview,
  } = useIntakeStore();

  const totalParts = currentCutlist.parts.length;
  const inboxCount = inboxParts.filter((p) => p._status !== "rejected").length;
  const canProceed = canProceedToReview();

  return (
    <div className="space-y-6">
      {/* Mode Tabs */}
      <Tabs
        value={activeMode}
        onValueChange={(v) => setActiveMode(v as typeof activeMode)}
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto p-1">
          {INTAKE_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <TabsTrigger
                key={mode.id}
                value={mode.id}
                className="flex flex-col items-center gap-1 py-2.5 px-2"
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium hidden sm:inline">{mode.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Manual Entry with Quick Add */}
        <TabsContent value="manual" className="space-y-6 mt-4">
          <Card>
            <CardContent className="pt-6">
              <QuickAddField />
            </CardContent>
          </Card>
          <ManualEntryForm />
        </TabsContent>
        
        {/* Paste & Parse */}
        <TabsContent value="paste" className="mt-4">
          <PasteParsePanel />
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

      {/* Parts Summary */}
      {(totalParts > 0 || inboxCount > 0) && (
        <Card className="border-[var(--cai-teal)]/30 bg-[var(--cai-teal)]/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--cai-teal)]/10">
                  <Inbox className="h-5 w-5 text-[var(--cai-teal)]" />
                </div>
                <div>
                  <div className="font-medium">
                    {totalParts > 0 ? (
                      <>{totalParts} part{totalParts !== 1 ? "s" : ""} added</>
                    ) : (
                      <>No parts yet</>
                    )}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {inboxCount > 0 && (
                      <span className="text-[var(--cai-gold)]">{inboxCount} pending in inbox</span>
                    )}
                    {inboxCount > 0 && totalParts > 0 && " • "}
                    {totalParts > 0 && (
                      <span>{currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0)} total pieces</span>
                    )}
                  </div>
                </div>
              </div>
              {canProceed && (
                <Button variant="primary" onClick={goToNextStep}>
                  Review Parts
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <StepNavigation
        onBack={goToPreviousStep}
        onNext={goToNextStep}
        nextLabel={canProceed ? "Review Parts" : "Add Parts First"}
        nextDisabled={!canProceed}
      />
    </div>
  );
}

