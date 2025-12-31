"use client";

/**
 * Silent Auto Training Module
 * 
 * Automatically saves user corrections as training examples in the background.
 * No user prompts - just silent learning to improve accuracy over time.
 * 
 * Features:
 * - Zero friction: corrections are saved automatically
 * - Debounced: waits for user to finish editing before saving
 * - Non-blocking: all saves happen in background
 * - Smart deduplication: won't save duplicate training examples
 */

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Brain } from "lucide-react";
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

interface SilentTrainingConfig {
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
  /** Show subtle toast on save (default: false for fully silent) */
  showToast?: boolean;
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
        score += 15;
        break;
      case "quantity":
        score += 20;
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
// SILENT TRAINING SAVER
// ============================================================

/**
 * Save training example in background (fire-and-forget)
 */
async function saveTrainingExampleSilently(
  correctedParts: CutPart[],
  corrections: CorrectionSummary[],
  config: Omit<SilentTrainingConfig, "originalParts" | "correctedParts">
): Promise<boolean> {
  try {
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
        sourceType: config.sourceType || "image",
        sourceText: `[Auto-learned from user corrections]\nFile: ${config.sourceFileName || "Unknown"}\nTemplate: ${config.detectedTemplate || "Unknown"}\nCorrections: ${corrections.length}`,
        sourceFileName: config.sourceFileName,
        correctParts: formattedParts,
        difficulty: "medium", // Auto-infer
        category: config.detectedTemplate || undefined,
        features: {
          hasHeaders: true,
          rowCount: correctedParts.length,
          hasEdgeNotation: correctedParts.some(p => p.ops?.edging),
          hasGrooveNotation: correctedParts.some(p => p.ops?.grooves?.length),
          templateType: config.detectedTemplate,
          autoCreated: true,
          silentLearning: true,
          correctionCount: corrections.length,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[SilentTraining] Failed to save:", error);
    return false;
  }
}

// ============================================================
// MAIN HOOK: useSilentTraining
// ============================================================

/**
 * Hook for silent background training.
 * 
 * Usage:
 * ```tsx
 * const { trackOriginalParts, trackCorrection } = useSilentTraining({
 *   sourceFileName: "cutlist.jpg",
 *   sourceType: "image",
 *   detectedTemplate: "SketchCut PRO",
 * });
 * 
 * // When parts are first parsed:
 * trackOriginalParts(parsedParts);
 * 
 * // When user makes a correction:
 * trackCorrection(partId, { size: { L: 500, W: 300 } });
 * 
 * // Training example is auto-saved after debounce period
 * ```
 */
export function useSilentTraining(config: Partial<Omit<SilentTrainingConfig, "originalParts" | "correctedParts">> = {}) {
  const [originalParts, setOriginalParts] = useState<CutPart[]>([]);
  const [correctedParts, setCorrectedParts] = useState<CutPart[]>([]);
  const [sourceInfo, setSourceInfo] = useState<{
    fileName?: string;
    fileType?: "pdf" | "image" | "excel" | "text";
    template?: string;
  }>({});
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSavedRef = useRef(false);
  const lastCorrectionHashRef = useRef<string>("");

  // Debounce period before auto-saving (wait for user to finish editing)
  const SAVE_DEBOUNCE_MS = 5000; // 5 seconds of inactivity
  const MIN_SIGNIFICANCE = 15; // Minimum significance to trigger save

  /**
   * Track original parts when first parsed
   */
  const trackOriginalParts = useCallback((parts: CutPart[], info?: typeof sourceInfo) => {
    setOriginalParts(JSON.parse(JSON.stringify(parts))); // Deep clone
    setCorrectedParts(JSON.parse(JSON.stringify(parts)));
    if (info) setSourceInfo(info);
    hasSavedRef.current = false;
    lastCorrectionHashRef.current = "";
  }, []);

  /**
   * Track a correction (call this when user edits a part)
   */
  const trackCorrection = useCallback((partId: string, updates: Partial<CutPart>) => {
    setCorrectedParts(prev => 
      prev.map(p => p.part_id === partId ? { ...p, ...updates } : p)
    );
  }, []);

  /**
   * Auto-save training example after debounce
   */
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Don't save if no original parts or already saved
    if (originalParts.length === 0) return;

    const corrections = detectCorrections(originalParts, correctedParts);
    const significance = calculateSignificance(corrections);

    // Don't save if significance too low
    if (significance < MIN_SIGNIFICANCE) return;

    // Create hash to detect duplicate saves
    const correctionHash = JSON.stringify(corrections);
    if (correctionHash === lastCorrectionHashRef.current) return;

    // Debounce: wait for user to stop making corrections
    saveTimeoutRef.current = setTimeout(async () => {
      // Double-check we haven't saved this exact set of corrections
      if (correctionHash === lastCorrectionHashRef.current) return;
      
      lastCorrectionHashRef.current = correctionHash;
      
      const success = await saveTrainingExampleSilently(
        correctedParts,
        corrections,
        {
          sourceFileName: sourceInfo.fileName || config.sourceFileName,
          sourceType: sourceInfo.fileType || config.sourceType,
          detectedTemplate: sourceInfo.template || config.detectedTemplate,
        }
      );

      if (success) {
        // Subtle console log for debugging (no toast to avoid disruption)
        console.log(`[SilentTraining] ✓ Saved ${corrections.length} corrections as training example`);
        
        // Optional: very subtle toast (disabled by default)
        if (config.showToast) {
          toast.success("AI learning from your edits", {
            icon: <Brain className="h-3 w-3" />,
            duration: 2000,
            className: "text-xs",
          });
        }
        
        config.onTrainingSaved?.();
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [originalParts, correctedParts, sourceInfo, config]);

  /**
   * Force save now (e.g., when user navigates away)
   */
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const corrections = detectCorrections(originalParts, correctedParts);
    if (corrections.length === 0) return false;

    const correctionHash = JSON.stringify(corrections);
    if (correctionHash === lastCorrectionHashRef.current) return false;

    lastCorrectionHashRef.current = correctionHash;
    
    return saveTrainingExampleSilently(
      correctedParts,
      corrections,
      {
        sourceFileName: sourceInfo.fileName || config.sourceFileName,
        sourceType: sourceInfo.fileType || config.sourceType,
        detectedTemplate: sourceInfo.template || config.detectedTemplate,
      }
    );
  }, [originalParts, correctedParts, sourceInfo, config]);

  /**
   * Get current correction stats (for UI display if needed)
   */
  const getCorrectionStats = useCallback(() => {
    const corrections = detectCorrections(originalParts, correctedParts);
    return {
      correctionCount: corrections.length,
      significance: calculateSignificance(corrections),
      corrections,
    };
  }, [originalParts, correctedParts]);

  return {
    trackOriginalParts,
    trackCorrection,
    forceSave,
    getCorrectionStats,
    hasCorrections: originalParts.length > 0 && 
      detectCorrections(originalParts, correctedParts).length > 0,
  };
}

// ============================================================
// LEGACY EXPORTS (for backwards compatibility)
// ============================================================

/**
 * @deprecated Use useSilentTraining instead
 */
export function useAutoTraining() {
  const { trackOriginalParts, trackCorrection, hasCorrections, getCorrectionStats } = useSilentTraining();
  
  return {
    trackOriginalParts,
    trackCorrection,
    getPromptProps: () => ({}), // No longer needed
    hasCorrections,
  };
}

/**
 * @deprecated Silent training replaces this - component renders nothing
 */
export function AutoTrainingPrompt() {
  // This component is now a no-op - training happens silently
  return null;
}
