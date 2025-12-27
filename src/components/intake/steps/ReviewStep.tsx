"use client";

import * as React from "react";
import {
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StreamlinedPartsTable } from "@/components/parts";
import { StatsSidebar, ProjectMergePanel } from "@/components/intake";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import { StepNavigation } from "@/components/ui/stepper";
import type { CutPart } from "@/lib/schema";

export function ReviewStep() {
  const {
    currentCutlist,
    goToPreviousStep,
    goToNextStep,
    canProceedToExport,
    clearParts,
    addPart,
  } = useIntakeStore();

  const [showStats, setShowStats] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newPartForm, setNewPartForm] = React.useState({
    label: "",
    L: "",
    W: "",
    qty: "1",
    thickness_mm: "18",
  });

  const totalParts = currentCutlist.parts.length;
  const totalPieces = currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const canProceed = canProceedToExport();

  // Handle quick add part
  const handleAddPart = () => {
    const L = parseFloat(newPartForm.L);
    const W = parseFloat(newPartForm.W);
    const qty = parseInt(newPartForm.qty) || 1;
    const thickness = parseFloat(newPartForm.thickness_mm) || 18;

    if (!L || !W || L <= 0 || W <= 0) {
      return;
    }

    const newPart: CutPart = {
      part_id: generateId("P"),
      label: newPartForm.label || undefined,
      qty,
      size: { L, W },
      thickness_mm: thickness,
      material_id: currentCutlist.materials[0]?.material_id || "MAT-WHITE-18",
      allow_rotation: true, // Default: parts can rotate
      audit: {
        source_method: "manual",
        confidence: 1,
        human_verified: true,
      },
    };

    addPart(newPart);
    setShowAddModal(false);
    setNewPartForm({
      label: "",
      L: "",
      W: "",
      qty: "1",
      thickness_mm: "18",
    });
  };

  return (
    <div className="space-y-6">
      {/* Project Merge Panel - shows when there are unmerged multi-page uploads */}
      <ProjectMergePanel />

      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Review Parts</h2>
          <Badge variant="secondary">
            {totalParts} part{totalParts !== 1 ? "s" : ""} • {totalPieces} pieces
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Add part */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="text-[var(--cai-teal)] border-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/10"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Add Part</span>
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
          <StreamlinedPartsTable />
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

      {/* Add Part Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[var(--cai-teal)]" />
              Add New Part
            </DialogTitle>
            <DialogDescription>
              Quickly add a part to the cutlist. Use the table for more details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="part-label">Part Name / Label</Label>
              <Input
                id="part-label"
                placeholder="e.g., Side Panel"
                value={newPartForm.label}
                onChange={(e) => setNewPartForm(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="part-length">Length (mm) *</Label>
                <Input
                  id="part-length"
                  type="number"
                  placeholder="800"
                  min={0}
                  value={newPartForm.L}
                  onChange={(e) => setNewPartForm(prev => ({ ...prev, L: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="part-width">Width (mm) *</Label>
                <Input
                  id="part-width"
                  type="number"
                  placeholder="600"
                  min={0}
                  value={newPartForm.W}
                  onChange={(e) => setNewPartForm(prev => ({ ...prev, W: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="part-qty">Quantity</Label>
                <Input
                  id="part-qty"
                  type="number"
                  min={1}
                  value={newPartForm.qty}
                  onChange={(e) => setNewPartForm(prev => ({ ...prev, qty: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="part-thickness">Thickness (mm)</Label>
                <Input
                  id="part-thickness"
                  type="number"
                  min={1}
                  value={newPartForm.thickness_mm}
                  onChange={(e) => setNewPartForm(prev => ({ ...prev, thickness_mm: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddPart}
              disabled={!newPartForm.L || !newPartForm.W || parseFloat(newPartForm.L) <= 0 || parseFloat(newPartForm.W) <= 0}
              className="bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

