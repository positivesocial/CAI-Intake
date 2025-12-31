/**
 * CAI Intake - Accuracy Tracking Hook
 * 
 * Tracks parsing accuracy by comparing original parsed parts with final saved parts.
 * Integrates with the intake store to automatically log accuracy when cutlists are saved.
 */

"use client";

import * as React from "react";
import {
  startAccuracySession,
  recordOriginalParts,
  recordCorrectedParts,
  finalizeAccuracySession,
  discardSession,
} from "@/lib/learning/accuracy-session";
import type { CutPart } from "@/lib/schema";
import { generateId } from "@/lib/utils";

interface AccuracyTrackingOptions {
  organizationId?: string;
  provider?: "claude" | "gpt" | "python_ocr" | "pdf-parse";
  sourceType?: "pdf" | "image" | "text";
  clientName?: string;
  enabled?: boolean;
}

interface AccuracyTracker {
  /** Start a new tracking session when parsing begins */
  startSession: (metadata?: {
    parseJobId?: string;
    sourceFileName?: string;
    fewShotExamplesUsed?: number;
    patternsApplied?: number;
    clientTemplateUsed?: boolean;
  }) => string;
  
  /** Record the original parts from AI parsing */
  trackOriginalParts: (parts: CutPart[]) => void;
  
  /** Record the final parts after user corrections */
  trackCorrectedParts: (parts: CutPart[]) => void;
  
  /** Finalize and log accuracy (call on save) */
  finalize: () => Promise<{ success: boolean; accuracy?: number }>;
  
  /** Discard session without logging */
  discard: () => void;
  
  /** Current session ID */
  sessionId: string | null;
  
  /** Whether tracking is active */
  isActive: boolean;
}

/**
 * Hook for tracking parsing accuracy
 */
export function useAccuracyTracking(options: AccuracyTrackingOptions = {}): AccuracyTracker {
  const {
    organizationId,
    provider = "claude",
    sourceType = "image",
    clientName,
    enabled = true,
  } = options;

  const [sessionId, setSessionId] = React.useState<string | null>(null);

  const startSession = React.useCallback((metadata?: {
    parseJobId?: string;
    sourceFileName?: string;
    fewShotExamplesUsed?: number;
    patternsApplied?: number;
    clientTemplateUsed?: boolean;
  }): string => {
    if (!enabled) return "";

    // Discard any previous session
    if (sessionId) {
      discardSession(sessionId);
    }

    const newSessionId = `acc_${generateId("SES")}`;
    
    startAccuracySession(newSessionId, {
      organizationId,
      provider,
      sourceType,
      clientName,
      ...metadata,
    });

    setSessionId(newSessionId);
    return newSessionId;
  }, [enabled, organizationId, provider, sourceType, clientName, sessionId]);

  const trackOriginalParts = React.useCallback((parts: CutPart[]) => {
    if (!enabled || !sessionId) return;
    recordOriginalParts(sessionId, parts);
  }, [enabled, sessionId]);

  const trackCorrectedParts = React.useCallback((parts: CutPart[]) => {
    if (!enabled || !sessionId) return;
    recordCorrectedParts(sessionId, parts);
  }, [enabled, sessionId]);

  const finalize = React.useCallback(async (): Promise<{ success: boolean; accuracy?: number }> => {
    if (!enabled || !sessionId) {
      return { success: false };
    }

    const result = await finalizeAccuracySession(sessionId);
    setSessionId(null);
    return result;
  }, [enabled, sessionId]);

  const discard = React.useCallback(() => {
    if (sessionId) {
      discardSession(sessionId);
      setSessionId(null);
    }
  }, [sessionId]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (sessionId) {
        // Don't log accuracy if component unmounts unexpectedly
        discardSession(sessionId);
      }
    };
  }, [sessionId]);

  return {
    startSession,
    trackOriginalParts,
    trackCorrectedParts,
    finalize,
    discard,
    sessionId,
    isActive: !!sessionId,
  };
}

/**
 * Context for sharing accuracy tracking across components
 */
interface AccuracyTrackingContextValue extends AccuracyTracker {
  isEnabled: boolean;
}

const AccuracyTrackingContext = React.createContext<AccuracyTrackingContextValue | null>(null);

interface AccuracyTrackingProviderProps {
  children: React.ReactNode;
  organizationId?: string;
  provider?: "claude" | "gpt" | "python_ocr" | "pdf-parse";
  sourceType?: "pdf" | "image" | "text";
  clientName?: string;
  enabled?: boolean;
}

export function AccuracyTrackingProvider({
  children,
  organizationId,
  provider,
  sourceType,
  clientName,
  enabled = true,
}: AccuracyTrackingProviderProps): React.ReactElement {
  const tracker = useAccuracyTracking({
    organizationId,
    provider,
    sourceType,
    clientName,
    enabled,
  });

  const value = React.useMemo<AccuracyTrackingContextValue>(
    () => ({
      ...tracker,
      isEnabled: enabled,
    }),
    [tracker, enabled]
  );

  const Provider = AccuracyTrackingContext.Provider;
  return React.createElement(Provider, { value }, children);
}

export function useAccuracyTrackingContext(): AccuracyTrackingContextValue {
  const context = React.useContext(AccuracyTrackingContext);
  if (!context) {
    // Return a no-op tracker if not in context
    return {
      startSession: () => "",
      trackOriginalParts: () => {},
      trackCorrectedParts: () => {},
      finalize: async () => ({ success: false }),
      discard: () => {},
      sessionId: null,
      isActive: false,
      isEnabled: false,
    };
  }
  return context;
}

