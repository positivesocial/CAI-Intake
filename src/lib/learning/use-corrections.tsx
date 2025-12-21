"use client";

/**
 * CAI Intake - Corrections Hook
 * 
 * Hook for recording user corrections when parts are edited.
 * Tracks original values and detects corrections.
 */

import * as React from "react";
import { recordCorrection, detectCorrections } from "./corrections";
import type { CutPart } from "@/lib/schema";
import type { ParsedPartWithStatus } from "@/lib/store";
import { toast } from "sonner";

interface UseCorrectionOptions {
  /** Organization ID */
  organizationId?: string;
  /** User ID */
  userId?: string;
  /** Show toast when learning from correction */
  showLearningToast?: boolean;
  /** Enable/disable correction tracking */
  enabled?: boolean;
}

interface CorrectionTracker {
  /** Track a part's original state before editing */
  trackOriginal: (partId: string, part: CutPart | ParsedPartWithStatus) => void;
  /** Record any corrections when editing is complete */
  recordChanges: (partId: string, updatedPart: CutPart | ParsedPartWithStatus) => Promise<void>;
  /** Clear tracking for a part */
  clearTracking: (partId: string) => void;
  /** Get the original state of a tracked part */
  getOriginal: (partId: string) => CutPart | undefined;
}

/**
 * Hook for tracking and recording user corrections
 */
export function useCorrections(options: UseCorrectionOptions = {}): CorrectionTracker {
  const { 
    organizationId, 
    userId, 
    showLearningToast = true,
    enabled = true,
  } = options;

  // Store original part states before editing
  const originalPartsRef = React.useRef<Map<string, CutPart>>(new Map());
  // Store source text if available
  const sourceTextRef = React.useRef<Map<string, string>>(new Map());

  const trackOriginal = React.useCallback((
    partId: string, 
    part: CutPart | ParsedPartWithStatus
  ) => {
    if (!enabled) return;

    // Extract the base CutPart from ParsedPartWithStatus if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _status, _originalText, ...basePart } = part as ParsedPartWithStatus;
    
    // Store the original part
    originalPartsRef.current.set(partId, basePart as CutPart);
    
    // Store source text if available
    if (_originalText) {
      sourceTextRef.current.set(partId, _originalText);
    }
  }, [enabled]);

  const recordChanges = React.useCallback(async (
    partId: string, 
    updatedPart: CutPart | ParsedPartWithStatus
  ) => {
    if (!enabled) return;

    const originalPart = originalPartsRef.current.get(partId);
    if (!originalPart) return;

    const sourceText = sourceTextRef.current.get(partId);

    // Extract the base CutPart from ParsedPartWithStatus if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _status, _originalText, ...basePart } = updatedPart as ParsedPartWithStatus;
    const correctedPart = basePart as CutPart;

    // Detect what corrections were made
    const corrections = detectCorrections(originalPart, correctedPart, sourceText);

    if (corrections.length === 0) {
      // No corrections detected
      originalPartsRef.current.delete(partId);
      sourceTextRef.current.delete(partId);
      return;
    }

    // Record each correction
    let patternsLearned = 0;

    for (const correction of corrections) {
      const result = await recordCorrection({
        ...correction,
        organizationId,
        userId,
      });

      if (result?.patternExtracted) {
        patternsLearned++;
      }
    }

    // Show toast if patterns were learned
    if (showLearningToast && patternsLearned > 0) {
      toast.success("Learning from your edit", {
        description: `${patternsLearned} pattern${patternsLearned > 1 ? "s" : ""} saved for future parsing.`,
        duration: 3000,
      });
    }

    // Clear tracking
    originalPartsRef.current.delete(partId);
    sourceTextRef.current.delete(partId);
  }, [enabled, organizationId, userId, showLearningToast]);

  const clearTracking = React.useCallback((partId: string) => {
    originalPartsRef.current.delete(partId);
    sourceTextRef.current.delete(partId);
  }, []);

  const getOriginal = React.useCallback((partId: string): CutPart | undefined => {
    return originalPartsRef.current.get(partId);
  }, []);

  return {
    trackOriginal,
    recordChanges,
    clearTracking,
    getOriginal,
  };
}

/**
 * Context for sharing correction tracking across components
 */
interface CorrectionContextValue extends CorrectionTracker {
  isEnabled: boolean;
}

const CorrectionContext = React.createContext<CorrectionContextValue | null>(null);

interface CorrectionProviderProps {
  children: React.ReactNode;
  organizationId?: string;
  userId?: string;
  enabled?: boolean;
}

export function CorrectionProvider({
  children,
  organizationId,
  userId,
  enabled = true,
}: CorrectionProviderProps) {
  const tracker = useCorrections({
    organizationId,
    userId,
    enabled,
  });

  const value = React.useMemo<CorrectionContextValue>(
    () => ({
      ...tracker,
      isEnabled: enabled,
    }),
    [tracker, enabled]
  );

  return (
    <CorrectionContext.Provider value={value}>
      {children}
    </CorrectionContext.Provider>
  );
}

export function useCorrectionContext(): CorrectionContextValue {
  const context = React.useContext(CorrectionContext);
  if (!context) {
    // Return a no-op tracker if not in context
    return {
      trackOriginal: () => {},
      recordChanges: async () => {},
      clearTracking: () => {},
      getOriginal: () => undefined,
      isEnabled: false,
    };
  }
  return context;
}

