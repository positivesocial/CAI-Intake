"use client";

/**
 * CAI Intake - Invalid Parts Correction Modal
 * 
 * Shown after parsing when some parts were skipped due to invalid dimensions.
 * Allows users to:
 * - See which parts failed and why
 * - Correct dimensions inline
 * - Add corrected parts to the inbox
 * - Skip parts they don't need
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Check, 
  X, 
  Plus, 
  Trash2,
  AlertCircle,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface SkippedPartInfo {
  row: number;
  reason: string;
  originalData: {
    l?: number;
    w?: number;
    m?: string;
    n?: string;
    t?: number;
    q?: number;
  };
}

interface CorrectedPart extends SkippedPartInfo {
  correctedL: number;
  correctedW: number;
  isValid: boolean;
  isSkipped: boolean;
}

interface InvalidPartsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skippedParts: SkippedPartInfo[];
  onAddParts: (parts: Array<{
    label: string;
    size: { L: number; W: number };
    thickness_mm: number;
    qty: number;
    material: string;
    notes?: string;
  }>) => void;
  fileName?: string;
}

export function InvalidPartsModal({
  open,
  onOpenChange,
  skippedParts,
  onAddParts,
  fileName,
}: InvalidPartsModalProps) {
  // Initialize corrected parts from skipped parts
  const [correctedParts, setCorrectedParts] = React.useState<CorrectedPart[]>([]);

  // Reset state when modal opens with new parts
  React.useEffect(() => {
    if (open && skippedParts.length > 0) {
      setCorrectedParts(
        skippedParts.map((sp) => ({
          ...sp,
          correctedL: sp.originalData.l || 0,
          correctedW: sp.originalData.w || 0,
          isValid: false,
          isSkipped: false,
        }))
      );
    }
  }, [open, skippedParts]);

  // Update dimension and check validity
  const updateDimension = (
    index: number,
    field: "correctedL" | "correctedW",
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setCorrectedParts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const updated = { ...p, [field]: numValue };
        // Check if both dimensions are now valid
        updated.isValid = updated.correctedL > 0 && updated.correctedW > 0;
        return updated;
      })
    );
  };

  // Toggle skip for a part
  const toggleSkip = (index: number) => {
    setCorrectedParts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, isSkipped: !p.isSkipped } : p
      )
    );
  };

  // Add single corrected part
  const addSinglePart = (index: number) => {
    const part = correctedParts[index];
    if (!part.isValid) {
      toast.error("Invalid dimensions", {
        description: "Both Length and Width must be greater than 0",
      });
      return;
    }

    onAddParts([{
      label: part.originalData.n || `Part (Row ${part.row})`,
      size: { L: part.correctedL, W: part.correctedW },
      thickness_mm: part.originalData.t || 18,
      qty: part.originalData.q || 1,
      material: part.originalData.m || "",
      notes: `Originally skipped: ${part.reason}`,
    }]);

    // Mark as skipped (handled)
    setCorrectedParts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, isSkipped: true } : p
      )
    );

    toast.success("Part added to inbox", {
      description: `Row ${part.row} added with dimensions ${part.correctedL} × ${part.correctedW}`,
    });
  };

  // Add all valid parts at once
  const addAllValidParts = () => {
    const validParts = correctedParts.filter((p) => p.isValid && !p.isSkipped);
    
    if (validParts.length === 0) {
      toast.error("No valid parts to add", {
        description: "Please correct the dimensions first",
      });
      return;
    }

    onAddParts(
      validParts.map((part) => ({
        label: part.originalData.n || `Part (Row ${part.row})`,
        size: { L: part.correctedL, W: part.correctedW },
        thickness_mm: part.originalData.t || 18,
        qty: part.originalData.q || 1,
        material: part.originalData.m || "",
        notes: `Originally skipped: ${part.reason}`,
      }))
    );

    // Mark all added as skipped
    setCorrectedParts((prev) =>
      prev.map((p) =>
        p.isValid && !p.isSkipped ? { ...p, isSkipped: true } : p
      )
    );

    toast.success(`${validParts.length} parts added to inbox`);
  };

  // Count stats
  const validCount = correctedParts.filter((p) => p.isValid && !p.isSkipped).length;
  const skippedCount = correctedParts.filter((p) => p.isSkipped).length;
  const pendingCount = correctedParts.filter((p) => !p.isValid && !p.isSkipped).length;
  const allHandled = skippedCount === correctedParts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <FileWarning className="h-5 w-5" />
            {skippedParts.length} Part{skippedParts.length !== 1 ? "s" : ""} Need Attention
          </DialogTitle>
          <DialogDescription>
            Some parts from {fileName ? `"${fileName}"` : "the file"} had missing or invalid dimensions.
            Correct them below to add to your inbox, or skip parts you don&apos;t need.
          </DialogDescription>
        </DialogHeader>

        {/* Status badges */}
        <div className="flex gap-2 px-1">
          {validCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" />
              {validCount} ready to add
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {pendingCount} need correction
            </Badge>
          )}
          {skippedCount > 0 && (
            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
              <X className="h-3 w-3 mr-1" />
              {skippedCount} skipped
            </Badge>
          )}
        </div>

        {/* Parts list */}
        <div className="flex-1 overflow-auto space-y-2 py-2">
          {correctedParts.map((part, index) => (
            <div
              key={`${part.row}-${index}`}
              className={cn(
                "border rounded-lg p-3 transition-all",
                part.isSkipped
                  ? "bg-gray-50 border-gray-200 opacity-50"
                  : part.isValid
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Row info */}
                <div className="flex-shrink-0">
                  <Badge variant="outline" className="font-mono">
                    Row {part.row}
                  </Badge>
                </div>

                {/* Part details */}
                <div className="flex-1 min-w-0">
                  {/* Name/Notes */}
                  {part.originalData.n && (
                    <p className="text-sm font-medium text-gray-700 truncate mb-1">
                      {part.originalData.n}
                    </p>
                  )}
                  
                  {/* Error reason */}
                  <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                    <AlertCircle className="h-3 w-3" />
                    {part.reason}
                  </div>

                  {/* Dimension inputs */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-6">L:</span>
                      <Input
                        type="number"
                        value={part.correctedL || ""}
                        onChange={(e) => updateDimension(index, "correctedL", e.target.value)}
                        placeholder="Length"
                        className={cn(
                          "w-20 h-8 text-sm",
                          part.correctedL <= 0 && "border-red-300 focus:border-red-500"
                        )}
                        disabled={part.isSkipped}
                      />
                    </div>
                    <span className="text-gray-400">×</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-6">W:</span>
                      <Input
                        type="number"
                        value={part.correctedW || ""}
                        onChange={(e) => updateDimension(index, "correctedW", e.target.value)}
                        placeholder="Width"
                        className={cn(
                          "w-20 h-8 text-sm",
                          part.correctedW <= 0 && "border-red-300 focus:border-red-500"
                        )}
                        disabled={part.isSkipped}
                      />
                    </div>
                    
                    {/* Additional info */}
                    {part.originalData.m && (
                      <Badge variant="secondary" className="text-xs">
                        {part.originalData.m}
                      </Badge>
                    )}
                    {part.originalData.q && part.originalData.q > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        ×{part.originalData.q}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!part.isSkipped && (
                    <Button
                      size="sm"
                      variant={part.isValid ? "default" : "outline"}
                      onClick={() => addSinglePart(index)}
                      disabled={!part.isValid}
                      className="h-8"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSkip(index)}
                    className={cn(
                      "h-8",
                      part.isSkipped && "text-gray-400"
                    )}
                  >
                    {part.isSkipped ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Restore
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Skip
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {allHandled ? "Done" : "Skip All & Close"}
          </Button>
          
          {validCount > 0 && (
            <Button
              onClick={addAllValidParts}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {validCount} Valid Part{validCount !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Also export a hook for managing the modal state
import { RefreshCw } from "lucide-react";

export function useInvalidPartsModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [skippedParts, setSkippedParts] = React.useState<SkippedPartInfo[]>([]);
  const [fileName, setFileName] = React.useState<string>();

  const showModal = React.useCallback(
    (parts: SkippedPartInfo[], file?: string) => {
      if (parts.length > 0) {
        setSkippedParts(parts);
        setFileName(file);
        setIsOpen(true);
      }
    },
    []
  );

  const hideModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    setIsOpen,
    skippedParts,
    fileName,
    showModal,
    hideModal,
  };
}

