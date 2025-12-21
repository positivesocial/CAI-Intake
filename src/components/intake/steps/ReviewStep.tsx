"use client";

import * as React from "react";
import {
  ChevronRight,
  Undo2,
  Redo2,
  Trash2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartsTable } from "@/components/parts";
import { StatsSidebar } from "@/components/intake";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StepNavigation } from "@/components/ui/stepper";

export function ReviewStep() {
  const {
    currentCutlist,
    goToPreviousStep,
    goToNextStep,
    canProceedToExport,
    undo,
    redo,
    canUndo,
    canRedo,
    isAdvancedMode,
    toggleAdvancedMode,
    clearParts,
  } = useIntakeStore();

  const [showStats, setShowStats] = React.useState(true);

  const totalParts = currentCutlist.parts.length;
  const totalPieces = currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const canProceed = canProceedToExport();

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Review Parts</h2>
          <Badge variant="secondary">
            {totalParts} part{totalParts !== 1 ? "s" : ""} • {totalPieces} pieces
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 mr-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo()}
              className="h-8 px-2"
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo()}
              className="h-8 px-2"
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Toggle advanced mode */}
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

          {/* Clear parts */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearParts}
            disabled={totalParts === 0}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Clear</span>
          </Button>

          {/* Toggle stats sidebar - desktop */}
          <Button
            variant={showStats ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="hidden xl:flex"
          >
            Stats
          </Button>
        </div>
      </div>

      {/* Main content with table and optional stats */}
      <div className="flex gap-6">
        {/* Parts Table - Main area */}
        <div className={cn("flex-1 min-w-0", showStats && "xl:mr-0")}>
          <PartsTable />
        </div>

        {/* Stats Sidebar - Desktop only */}
        {showStats && (
          <aside className="hidden xl:block w-80 shrink-0 sticky top-6 h-[calc(100vh-12rem)]">
            <StatsSidebar />
          </aside>
        )}
      </div>

      {/* Navigation */}
      <StepNavigation
        onBack={goToPreviousStep}
        onNext={goToNextStep}
        nextLabel={canProceed ? "Continue to Export" : "Add Parts First"}
        nextDisabled={!canProceed}
      />
    </div>
  );
}

