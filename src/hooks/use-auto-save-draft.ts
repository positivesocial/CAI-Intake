"use client";

/**
 * CAI Intake - Auto-save Draft Hook
 * 
 * Automatically saves a draft cutlist when:
 * 1. User navigates away from the intake workflow
 * 2. Browser tab is closed/refreshed
 * 3. Parts exist in the inbox or cutlist
 */

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIntakeStore } from "@/lib/store";
import { toast } from "sonner";

interface UseAutoSaveDraftOptions {
  /** Whether auto-save is enabled */
  enabled?: boolean;
  /** Minimum number of parts to trigger auto-save */
  minParts?: number;
}

export function useAutoSaveDraft(options: UseAutoSaveDraftOptions = {}) {
  const { enabled = true, minParts = 1 } = options;
  
  const router = useRouter();
  const {
    inboxParts,
    currentCutlist,
    savedCutlistId,
    saveDraft,
    isSaving,
  } = useIntakeStore();
  
  const savingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  
  // Calculate if we have parts to save
  const totalParts = inboxParts.length + currentCutlist.parts.length;
  const shouldAutoSave = enabled && totalParts >= minParts && !savedCutlistId;
  
  // Track unsaved changes
  useEffect(() => {
    hasUnsavedChangesRef.current = shouldAutoSave;
  }, [shouldAutoSave]);
  
  // Save draft function
  const performAutoSave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || isSaving) return false;
    if (totalParts < minParts) return false;
    
    savingRef.current = true;
    
    try {
      const result = await saveDraft();
      
      if (result.success) {
        console.log("[AutoSave] Draft saved successfully:", result.cutlistId);
        return true;
      } else {
        console.warn("[AutoSave] Failed to save draft:", result.error);
        return false;
      }
    } catch (error) {
      console.error("[AutoSave] Error saving draft:", error);
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [saveDraft, isSaving, totalParts, minParts]);
  
  // Handle beforeunload (browser close/refresh)
  useEffect(() => {
    if (!enabled) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current && totalParts >= minParts && !savedCutlistId) {
        // Try to save synchronously - won't work for async operations
        // but will trigger the confirmation dialog
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        
        // Attempt async save (may not complete)
        performAutoSave();
        
        return e.returnValue;
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, totalParts, minParts, savedCutlistId, performAutoSave]);
  
  // Handle visibility change (tab switch/minimize)
  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && hasUnsavedChangesRef.current) {
        // Save when tab loses focus (async, best-effort)
        performAutoSave().then(saved => {
          if (saved) {
            hasUnsavedChangesRef.current = false;
          }
        });
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, performAutoSave]);
  
  // Manual save with notification
  const saveNow = useCallback(async () => {
    if (totalParts < minParts) {
      toast.info("Nothing to save", { description: "Add parts before saving a draft." });
      return false;
    }
    
    const toastId = toast.loading("Saving draft...");
    const success = await performAutoSave();
    
    if (success) {
      toast.success("Draft saved!", { id: toastId });
    } else {
      toast.error("Failed to save draft", { id: toastId });
    }
    
    return success;
  }, [performAutoSave, totalParts, minParts]);
  
  // Navigate away with auto-save
  const navigateWithSave = useCallback(async (path: string) => {
    if (shouldAutoSave) {
      const toastId = toast.loading("Saving draft before leaving...");
      const saved = await performAutoSave();
      
      if (saved) {
        toast.success("Draft saved!", { id: toastId, duration: 2000 });
      } else {
        toast.dismiss(toastId);
      }
    }
    
    router.push(path);
  }, [shouldAutoSave, performAutoSave, router]);
  
  return {
    hasUnsavedChanges: shouldAutoSave,
    totalParts,
    saveNow,
    navigateWithSave,
    isSaving: isSaving || savingRef.current,
  };
}

