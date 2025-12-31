"use client";

/**
 * Auto Training Prompt Component
 * 
 * Detects when users make significant corrections and offers to save
 * the corrected data as a training example for future AI improvement.
 */

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Brain,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { CutPart } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

interface CorrectionSummary {
  field: string;
  originalValue: string | number;
  correctedValue: string | number;
  type: "dimension" | "quantity" | "material" | "edge" | "groove" | "other";
}

interface AutoTrainingPromptProps {
  /** Original parts from AI parsing */
  originalParts: CutPart[];
  /** Corrected parts after user edits */
  correctedParts: CutPart[];
  /** Source file name for reference */
  sourceFileName?: string;
  /** Source file type */
  sourceType?: "pdf" | "image" | "excel" | "text";
  /** Template detected (e.g., "SketchCut PRO", "MaxCut") */
  detectedTemplate?: string;
  /** Callback when training example is saved */
  onTrainingSaved?: () => void;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
}

// ============================================================
// CORRECTION DETECTION
// ============================================================

/**
 * Detect corrections made between original and corrected parts
 */
function detectCorrections(
  originalParts: CutPart[],
  correctedParts: CutPart[]
): CorrectionSummary[] {
  const corrections: CorrectionSummary[] = [];

  // Match parts by part_id
  for (const corrected of correctedParts) {
    const original = originalParts.find(p => p.part_id === corrected.part_id);
    if (!original) continue;

    // Check dimensions
    if (original.size.L !== corrected.size.L) {
      corrections.push({
        field: "Length",
        originalValue: original.size.L,
        correctedValue: corrected.size.L,
        type: "dimension",
      });
    }
    if (original.size.W !== corrected.size.W) {
      corrections.push({
        field: "Width",
        originalValue: original.size.W,
        correctedValue: corrected.size.W,
        type: "dimension",
      });
    }

    // Check quantity
    if (original.qty !== corrected.qty) {
      corrections.push({
        field: "Quantity",
        originalValue: original.qty,
        correctedValue: corrected.qty,
        type: "quantity",
      });
    }

    // Check material
    if (original.material_id !== corrected.material_id) {
      corrections.push({
        field: "Material",
        originalValue: original.material_id,
        correctedValue: corrected.material_id,
        type: "material",
      });
    }

    // Check edge banding
    const originalEdges = JSON.stringify(original.ops?.edging || {});
    const correctedEdges = JSON.stringify(corrected.ops?.edging || {});
    if (originalEdges !== correctedEdges) {
      corrections.push({
        field: "Edge Banding",
        originalValue: originalEdges === "{}" ? "none" : "present",
        correctedValue: correctedEdges === "{}" ? "none" : "present",
        type: "edge",
      });
    }

    // Check grooves
    const originalGrooves = original.ops?.grooves?.length || 0;
    const correctedGrooves = corrected.ops?.grooves?.length || 0;
    if (originalGrooves !== correctedGrooves) {
      corrections.push({
        field: "Grooves",
        originalValue: originalGrooves,
        correctedValue: correctedGrooves,
        type: "groove",
      });
    }
  }

  return corrections;
}

/**
 * Calculate significance score for corrections (0-100)
 */
function calculateSignificance(corrections: CorrectionSummary[]): number {
  if (corrections.length === 0) return 0;

  let score = 0;
  for (const c of corrections) {
    switch (c.type) {
      case "dimension":
        score += 15; // Dimension errors are significant
        break;
      case "quantity":
        score += 20; // Quantity errors are very significant
        break;
      case "material":
        score += 10;
        break;
      case "edge":
        score += 8;
        break;
      case "groove":
        score += 8;
        break;
      default:
        score += 5;
    }
  }

  return Math.min(100, score);
}

// ============================================================
// COMPONENT
// ============================================================

export function AutoTrainingPrompt({
  originalParts,
  correctedParts,
  sourceFileName,
  sourceType = "image",
  detectedTemplate,
  onTrainingSaved,
  onDismiss,
}: AutoTrainingPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [notes, setNotes] = useState("");
  const [corrections, setCorrections] = useState<CorrectionSummary[]>([]);
  const [significance, setSignificance] = useState(0);

  // Detect corrections when parts change
  useEffect(() => {
    const detected = detectCorrections(originalParts, correctedParts);
    setCorrections(detected);
    setSignificance(calculateSignificance(detected));

    // Auto-show prompt if corrections are significant (>= 20 points)
    if (detected.length > 0 && calculateSignificance(detected) >= 20) {
      // Delay to not interrupt user flow
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [originalParts, correctedParts]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      // Format parts for training
      const formattedParts = correctedParts.map(p => ({
        label: p.label,
        length: p.size.L,
        width: p.size.W,
        quantity: p.qty,
        thickness: p.thickness_mm,
        material: p.material_id,
        edge: p.ops?.edging ? summarizeEdging(p.ops.edging) : undefined,
        groove: p.ops?.grooves?.length ? "GL" : undefined,
      }));

      const response = await fetch("/api/v1/training/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceText: `[Auto-saved from corrections: ${sourceFileName || "Unknown file"}]\nTemplate: ${detectedTemplate || "Unknown"}\nCorrections: ${corrections.length}`,
          sourceFileName,
          correctParts: formattedParts,
          difficulty,
          category: detectedTemplate || undefined,
          features: {
            hasHeaders: true,
            rowCount: correctedParts.length,
            hasEdgeNotation: correctedParts.some(p => p.ops?.edging),
            hasGrooveNotation: correctedParts.some(p => p.ops?.grooves?.length),
            templateType: detectedTemplate,
            autoCreated: true,
            correctionCount: corrections.length,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save training example");
      }

      toast.success("Training example saved! AI will learn from your corrections.", {
        icon: <Brain className="h-4 w-4" />,
      });

      setIsOpen(false);
      onTrainingSaved?.();
    } catch (error) {
      toast.error("Failed to save training example");
      console.error("Training save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [correctedParts, corrections, difficulty, sourceFileName, sourceType, detectedTemplate, onTrainingSaved]);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    onDismiss?.();
  }, [onDismiss]);

  // Don't render if no significant corrections
  if (corrections.length === 0 || significance < 20) {
    return null;
  }

  return (
    <>
      {/* Floating prompt badge (non-modal) */}
      {!isOpen && corrections.length > 0 && significance >= 20 && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Improve AI Accuracy</h4>
                <p className="text-xs text-white/80 mt-1">
                  You made {corrections.length} corrections. Save them to help the AI learn!
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white text-purple-700 hover:bg-white/90"
                    onClick={() => setIsOpen(true)}
                  >
                    <Brain className="h-3 w-3 mr-1" />
                    Save for Training
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/80 hover:text-white hover:bg-white/10"
                    onClick={handleDismiss}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full dialog for saving */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Save as Training Example
            </DialogTitle>
            <DialogDescription>
              Your corrections help the AI learn to parse similar documents better.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Correction summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Corrections Made</span>
                <Badge variant={significance >= 50 ? "error" : "warning"}>
                  {corrections.length} changes
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {corrections.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-1 text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span>{c.field}:</span>
                    <span className="line-through opacity-50">{String(c.originalValue).slice(0, 10)}</span>
                    <span>→</span>
                    <span className="font-medium text-foreground">{String(c.correctedValue).slice(0, 10)}</span>
                  </div>
                ))}
                {corrections.length > 6 && (
                  <div className="text-muted-foreground">+{corrections.length - 6} more...</div>
                )}
              </div>
            </div>

            {/* Template info */}
            {detectedTemplate && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Detected Template:</span>
                <Badge variant="outline">{detectedTemplate}</Badge>
              </div>
            )}

            {/* Difficulty selector */}
            <div className="space-y-2">
              <Label>Document Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy - Clear, standard format</SelectItem>
                  <SelectItem value="medium">Medium - Some variations</SelectItem>
                  <SelectItem value="hard">Hard - Complex or unusual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes about this document format..."
                className="h-20 resize-none"
              />
            </div>

            {/* Impact indicator */}
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-700 dark:text-green-300">
                Training on corrections improves accuracy by ~15% for similar documents
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDismiss}>
              Skip
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                "Saving..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Training Example
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function summarizeEdging(edging: CutPart["ops"]["edging"]): string {
  if (!edging?.edges) return "";
  const edges = edging.edges;
  const L = (edges.L1?.apply ? 1 : 0) + (edges.L2?.apply ? 1 : 0);
  const W = (edges.W1?.apply ? 1 : 0) + (edges.W2?.apply ? 1 : 0);
  if (L === 0 && W === 0) return "";
  return (L > 0 ? `${L}L` : "") + (W > 0 ? `${W}W` : "");
}

// ============================================================
// HOOK FOR EASY INTEGRATION
// ============================================================

/**
 * Hook to track corrections and prompt for training
 */
export function useAutoTraining() {
  const [originalParts, setOriginalParts] = useState<CutPart[]>([]);
  const [correctedParts, setCorrectedParts] = useState<CutPart[]>([]);
  const [sourceInfo, setSourceInfo] = useState<{
    fileName?: string;
    fileType?: "pdf" | "image" | "excel" | "text";
    template?: string;
  }>({});

  const trackOriginalParts = useCallback((parts: CutPart[], info?: typeof sourceInfo) => {
    setOriginalParts([...parts]);
    setCorrectedParts([...parts]);
    if (info) setSourceInfo(info);
  }, []);

  const trackCorrection = useCallback((partId: string, updates: Partial<CutPart>) => {
    setCorrectedParts(prev => 
      prev.map(p => p.part_id === partId ? { ...p, ...updates } : p)
    );
  }, []);

  const getPromptProps = useCallback(() => ({
    originalParts,
    correctedParts,
    sourceFileName: sourceInfo.fileName,
    sourceType: sourceInfo.fileType,
    detectedTemplate: sourceInfo.template,
  }), [originalParts, correctedParts, sourceInfo]);

  return {
    trackOriginalParts,
    trackCorrection,
    getPromptProps,
    hasCorrections: originalParts.length > 0 && 
      detectCorrections(originalParts, correctedParts).length > 0,
  };
}

