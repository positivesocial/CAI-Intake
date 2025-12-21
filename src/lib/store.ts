/**
 * CAI Intake - Global State Store
 * 
 * Using Zustand for lightweight state management.
 * Manages the current cutlist, parts in the intake inbox, and UI state.
 * Includes undo/redo functionality for part operations.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CutPart, MaterialDef, EdgebandDef, CutlistCapabilities } from "./schema";
import { generateId } from "./utils";
import { SCHEMA_VERSION, DEFAULTS } from "./constants";

// ============================================================
// TYPES
// ============================================================

export type IntakeMode = 
  | "manual" 
  | "excel" 
  | "voice" 
  | "file" 
  | "template" 
  | "paste";

export type StepId = "setup" | "intake" | "review" | "export";

export type ParserMode = "simple" | "ai";
export type AIProviderType = "openai" | "anthropic";

export interface AISettings {
  /** Selected AI provider */
  provider: AIProviderType;
  /** Default parser mode */
  defaultParserMode: ParserMode;
  /** Whether to extract metadata (grooving, CNC, edgebanding) */
  extractMetadata: boolean;
  /** Confidence threshold for auto-accepting parts */
  confidenceThreshold: number;
}

export interface ParsedPartWithStatus extends CutPart {
  _status: "pending" | "accepted" | "rejected" | "editing";
  _originalText?: string;
}

// Undo/Redo action types
export type UndoableAction = 
  | { type: "ADD_PART"; part: CutPart }
  | { type: "ADD_PARTS"; parts: CutPart[] }
  | { type: "UPDATE_PART"; partId: string; oldPart: CutPart; newPart: CutPart }
  | { type: "REMOVE_PART"; part: CutPart }
  | { type: "REMOVE_PARTS"; parts: CutPart[] }
  | { type: "CLEAR_PARTS"; parts: CutPart[] }
  | { type: "DUPLICATE_PARTS"; originalIds: string[]; newParts: CutPart[] };

// Limit undo stack to prevent memory issues with large part operations
// Each action stores minimal data (IDs and diffs where possible)
const MAX_UNDO_STACK = 30;

/** Project tracking for multi-page/multi-file uploads */
export interface ProjectTracking {
  /** Unique project code for grouping related cutlists */
  project_code?: string;
  /** Current page number (for multi-page documents) */
  page_number?: number;
  /** Total pages in this document/batch */
  total_pages?: number;
  /** Client reference */
  client_ref?: string;
  /** Job reference */
  job_ref?: string;
  /** Prepared by (user name) */
  prepared_by?: string;
  /** Date of the cutlist */
  date?: string;
}

export interface IntakeState {
  // Current cutlist being edited
  currentCutlist: {
    doc_id: string;
    name: string;
    parts: CutPart[];
    materials: MaterialDef[];
    edgebands: EdgebandDef[];
    capabilities: CutlistCapabilities;
    /** Project tracking info */
    project?: ProjectTracking;
  };

  // Intake inbox - parts waiting for review
  inboxParts: ParsedPartWithStatus[];

  // Active intake mode
  activeMode: IntakeMode;

  // Workflow step (stepper)
  currentStep: StepId;

  // UI state
  isAdvancedMode: boolean;
  selectedPartIds: string[];
  
  // AI settings
  aiSettings: AISettings;
  
  // Undo/Redo stacks
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];
  
  // Clipboard for copy/paste
  clipboard: CutPart[];

  // Actions
  setActiveMode: (mode: IntakeMode) => void;
  toggleAdvancedMode: () => void;
  
  // Step navigation
  setCurrentStep: (step: StepId) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canProceedToIntake: () => boolean;
  canProceedToReview: () => boolean;
  canProceedToExport: () => boolean;

  // Parts management
  addPart: (part: CutPart) => void;
  addParts: (parts: CutPart[]) => void;
  updatePart: (partId: string, updates: Partial<CutPart>) => void;
  removePart: (partId: string) => void;
  clearParts: () => void;
  
  // Bulk operations
  removeSelectedParts: () => void;
  duplicateSelectedParts: () => void;
  copySelectedParts: () => void;
  pasteParts: () => void;
  updateSelectedParts: (updates: Partial<CutPart>) => void;

  // Inbox management
  addToInbox: (parts: ParsedPartWithStatus[]) => void;
  acceptInboxPart: (partId: string) => void;
  acceptAllInboxParts: () => void;
  rejectInboxPart: (partId: string) => void;
  clearInbox: () => void;
  updateInboxPart: (partId: string, updates: Partial<ParsedPartWithStatus>) => void;

  // Materials
  addMaterial: (material: MaterialDef) => void;
  removeMaterial: (materialId: string) => void;
  setMaterials: (materials: MaterialDef[]) => void;
  setEdgebands: (edgebands: EdgebandDef[]) => void;
  loadOrganizationMaterials: () => Promise<void>;
  loadOrganizationEdgebands: () => Promise<void>;

  // Selection
  selectPart: (partId: string) => void;
  deselectPart: (partId: string) => void;
  togglePartSelection: (partId: string) => void;
  selectAllParts: () => void;
  clearSelection: () => void;
  selectRange: (fromId: string, toId: string) => void;

  // Cutlist
  setCutlistName: (name: string) => void;
  setCapabilities: (capabilities: Partial<CutlistCapabilities>) => void;
  setProjectTracking: (project: Partial<ProjectTracking>) => void;
  resetCutlist: () => void;
  
  // Save/Load
  saveCutlist: () => Promise<{ success: boolean; cutlistId?: string; error?: string }>;
  saveCutlistAsDraft: () => Promise<{ success: boolean; cutlistId?: string; error?: string }>;
  loadCutlist: (cutlistId: string) => Promise<{ success: boolean; error?: string }>;
  isSaving: boolean;
  lastSavedAt: string | null;
  savedCutlistId: string | null;
  
  // AI settings
  setAIProvider: (provider: AIProviderType) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// ============================================================
// DEFAULT STATE
// ============================================================

const defaultMaterials: MaterialDef[] = [
  {
    material_id: "MAT-WHITE-18",
    name: "18mm White Melamine PB",
    thickness_mm: 18,
    core_type: "PB",
    finish: "White Melamine",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: false },
  },
  {
    material_id: "MAT-WHITE-16",
    name: "16mm White Melamine PB",
    thickness_mm: 16,
    core_type: "PB",
    finish: "White Melamine",
    default_sheet: { size: { L: 2440, W: 1220 }, grained: false },
  },
];

const defaultEdgebands: EdgebandDef[] = [
  {
    edgeband_id: "EB-WHITE-0.8",
    name: "0.8mm White ABS",
    thickness_mm: 0.8,
    color_match_material_id: "MAT-WHITE-18",
  },
  {
    edgeband_id: "EB-WHITE-2",
    name: "2mm White ABS",
    thickness_mm: 2,
    color_match_material_id: "MAT-WHITE-18",
  },
];

const defaultCapabilities: CutlistCapabilities = {
  core_parts: true,
  edging: true,
  grooves: false,
  cnc_holes: false,
  cnc_routing: false,
  custom_cnc: false,
  advanced_grouping: false,
  part_notes: true,
};

const defaultAISettings: AISettings = {
  provider: "openai",
  defaultParserMode: "simple",
  extractMetadata: true,
  confidenceThreshold: 0.75,
};

// Step order for navigation
const STEP_ORDER: StepId[] = ["setup", "intake", "review", "export"];

const getInitialState = () => ({
  currentCutlist: {
    doc_id: generateId("DOC"),
    name: "New Cutlist",
    parts: [],
    materials: defaultMaterials,
    edgebands: defaultEdgebands,
    capabilities: defaultCapabilities,
  },
  inboxParts: [],
  activeMode: "manual" as IntakeMode,
  currentStep: "setup" as StepId,
  isAdvancedMode: false,
  selectedPartIds: [],
  aiSettings: defaultAISettings,
  undoStack: [] as UndoableAction[],
  redoStack: [] as UndoableAction[],
  clipboard: [] as CutPart[],
  isSaving: false,
  lastSavedAt: null as string | null,
  savedCutlistId: null as string | null,
});

// ============================================================
// STORE
// ============================================================

// Helper to push action to undo stack
const pushUndoAction = (
  state: IntakeState,
  action: UndoableAction
): Pick<IntakeState, "undoStack" | "redoStack"> => ({
  undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), action],
  redoStack: [], // Clear redo stack on new action
});

export const useIntakeStore = create<IntakeState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      // Mode
      setActiveMode: (mode) => set({ activeMode: mode }),
      toggleAdvancedMode: () => set((state) => ({ isAdvancedMode: !state.isAdvancedMode })),
      
      // Step navigation
      setCurrentStep: (step) => set({ currentStep: step }),
      
      goToNextStep: () => {
        const state = get();
        const currentIndex = STEP_ORDER.indexOf(state.currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          set({ currentStep: STEP_ORDER[currentIndex + 1] });
        }
      },
      
      goToPreviousStep: () => {
        const state = get();
        const currentIndex = STEP_ORDER.indexOf(state.currentStep);
        if (currentIndex > 0) {
          set({ currentStep: STEP_ORDER[currentIndex - 1] });
        }
      },
      
      canProceedToIntake: () => {
        const state = get();
        // Can proceed if cutlist has a name (not empty)
        return state.currentCutlist.name.trim().length > 0;
      },
      
      canProceedToReview: () => {
        const state = get();
        // Can proceed if there are parts
        return state.currentCutlist.parts.length > 0 || state.inboxParts.length > 0;
      },
      
      canProceedToExport: () => {
        const state = get();
        // Can proceed if there are parts to export
        return state.currentCutlist.parts.length > 0;
      },

      // Parts management
      addPart: (part) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, part],
          },
          ...pushUndoAction(state, { type: "ADD_PART", part }),
        })),

      addParts: (parts) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...parts],
          },
          ...pushUndoAction(state, { type: "ADD_PARTS", parts }),
        })),

      updatePart: (partId, updates) => {
        const state = get();
        const oldPart = state.currentCutlist.parts.find((p) => p.part_id === partId);
        if (!oldPart) return;
        
        const newPart = { ...oldPart, ...updates };
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.map((p) =>
              p.part_id === partId ? newPart : p
            ),
          },
          ...pushUndoAction(state, { type: "UPDATE_PART", partId, oldPart, newPart }),
        });
      },

      removePart: (partId) => {
        const state = get();
        const part = state.currentCutlist.parts.find((p) => p.part_id === partId);
        if (!part) return;
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.filter((p) => p.part_id !== partId),
          },
          selectedPartIds: state.selectedPartIds.filter((id) => id !== partId),
          ...pushUndoAction(state, { type: "REMOVE_PART", part }),
        });
      },

      clearParts: () => {
        const state = get();
        if (state.currentCutlist.parts.length === 0) return;
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [],
          },
          selectedPartIds: [],
          ...pushUndoAction(state, { type: "CLEAR_PARTS", parts: state.currentCutlist.parts }),
        });
      },
      
      // Bulk operations
      removeSelectedParts: () => {
        const state = get();
        const partsToRemove = state.currentCutlist.parts.filter(
          (p) => state.selectedPartIds.includes(p.part_id)
        );
        
        if (partsToRemove.length === 0) return;
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.filter(
              (p) => !state.selectedPartIds.includes(p.part_id)
            ),
          },
          selectedPartIds: [],
          ...pushUndoAction(state, { type: "REMOVE_PARTS", parts: partsToRemove }),
        });
      },
      
      duplicateSelectedParts: () => {
        const state = get();
        const selectedParts = state.currentCutlist.parts.filter(
          (p) => state.selectedPartIds.includes(p.part_id)
        );
        
        if (selectedParts.length === 0) return;
        
        const newParts = selectedParts.map((p) => ({
          ...p,
          part_id: generateId("P"),
          label: p.label ? `${p.label} (copy)` : undefined,
        }));
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...newParts],
          },
          selectedPartIds: newParts.map((p) => p.part_id),
          ...pushUndoAction(state, {
            type: "DUPLICATE_PARTS",
            originalIds: state.selectedPartIds,
            newParts,
          }),
        });
      },
      
      copySelectedParts: () => {
        const state = get();
        const selectedParts = state.currentCutlist.parts.filter(
          (p) => state.selectedPartIds.includes(p.part_id)
        );
        set({ clipboard: selectedParts });
      },
      
      pasteParts: () => {
        const state = get();
        if (state.clipboard.length === 0) return;
        
        const newParts = state.clipboard.map((p) => ({
          ...p,
          part_id: generateId("P"),
          label: p.label ? `${p.label} (pasted)` : undefined,
        }));
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...newParts],
          },
          selectedPartIds: newParts.map((p) => p.part_id),
          ...pushUndoAction(state, { type: "ADD_PARTS", parts: newParts }),
        });
      },
      
      updateSelectedParts: (updates) => {
        const state = get();
        if (state.selectedPartIds.length === 0) return;
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.map((p) =>
              state.selectedPartIds.includes(p.part_id) ? { ...p, ...updates } : p
            ),
          },
        });
      },

      // Inbox management
      addToInbox: (parts) =>
        set((state) => ({
          inboxParts: [...state.inboxParts, ...parts],
        })),

      acceptInboxPart: (partId) => {
        const state = get();
        const part = state.inboxParts.find((p) => p.part_id === partId);
        if (part) {
          const { _status, _originalText, ...cleanPart } = part;
          set({
            currentCutlist: {
              ...state.currentCutlist,
              parts: [...state.currentCutlist.parts, cleanPart],
            },
            inboxParts: state.inboxParts.filter((p) => p.part_id !== partId),
            ...pushUndoAction(state, { type: "ADD_PART", part: cleanPart }),
          });
        }
      },

      acceptAllInboxParts: () => {
        const state = get();
        const acceptedParts = state.inboxParts
          .filter((p) => p._status !== "rejected")
          .map(({ _status, _originalText, ...part }) => part);
          
        if (acceptedParts.length === 0) return;
        
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...acceptedParts],
          },
          inboxParts: [],
          ...pushUndoAction(state, { type: "ADD_PARTS", parts: acceptedParts }),
        });
      },

      rejectInboxPart: (partId) =>
        set((state) => ({
          inboxParts: state.inboxParts.map((p) =>
            p.part_id === partId ? { ...p, _status: "rejected" as const } : p
          ),
        })),

      clearInbox: () => set({ inboxParts: [] }),

      updateInboxPart: (partId, updates) =>
        set((state) => ({
          inboxParts: state.inboxParts.map((p) =>
            p.part_id === partId ? { ...p, ...updates } : p
          ),
        })),

      // Materials
      addMaterial: (material) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            materials: [...state.currentCutlist.materials, material],
          },
        })),

      removeMaterial: (materialId) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            materials: state.currentCutlist.materials.filter(
              (m) => m.material_id !== materialId
            ),
          },
        })),

      setMaterials: (materials) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            materials,
          },
        })),

      setEdgebands: (edgebands) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            edgebands,
          },
        })),

      loadOrganizationMaterials: async () => {
        try {
          const response = await fetch("/api/v1/materials");
          if (response.ok) {
            const data = await response.json();
            const materials: MaterialDef[] = (data.materials || []).map((m: {
              material_id: string;
              name: string;
              thickness_mm: number;
              core_type?: string;
              finish?: string;
              grain?: string;
              default_sheet?: { L: number; W: number };
            }) => ({
              material_id: m.material_id,
              name: m.name,
              thickness_mm: m.thickness_mm,
              core_type: m.core_type,
              finish: m.finish,
              grain: m.grain,
              default_sheet: m.default_sheet ? {
                size: { L: m.default_sheet.L, W: m.default_sheet.W },
                grained: m.grain === "length" || m.grain === "width",
              } : undefined,
            }));
            if (materials.length > 0) {
              set((state) => ({
                currentCutlist: {
                  ...state.currentCutlist,
                  materials,
                },
              }));
            }
          }
        } catch (error) {
          console.error("Failed to load organization materials:", error);
          // Keep default materials on error
        }
      },

      loadOrganizationEdgebands: async () => {
        try {
          const response = await fetch("/api/v1/edgebands");
          if (response.ok) {
            const data = await response.json();
            const edgebands: EdgebandDef[] = (data.edgebands || []).map((e: {
              edgeband_id: string;
              name: string;
              thickness_mm: number;
              width_mm?: number;
              color_match_material_id?: string;
            }) => ({
              edgeband_id: e.edgeband_id,
              name: e.name,
              thickness_mm: e.thickness_mm,
              width_mm: e.width_mm,
              color_match_material_id: e.color_match_material_id,
            }));
            if (edgebands.length > 0) {
              set((state) => ({
                currentCutlist: {
                  ...state.currentCutlist,
                  edgebands,
                },
              }));
            }
          }
        } catch (error) {
          console.error("Failed to load organization edgebands:", error);
          // Keep default edgebands on error
        }
      },

      // Selection
      selectPart: (partId) =>
        set((state) => ({
          selectedPartIds: state.selectedPartIds.includes(partId)
            ? state.selectedPartIds
            : [...state.selectedPartIds, partId],
        })),

      deselectPart: (partId) =>
        set((state) => ({
          selectedPartIds: state.selectedPartIds.filter((id) => id !== partId),
        })),
        
      togglePartSelection: (partId) =>
        set((state) => ({
          selectedPartIds: state.selectedPartIds.includes(partId)
            ? state.selectedPartIds.filter((id) => id !== partId)
            : [...state.selectedPartIds, partId],
        })),

      selectAllParts: () =>
        set((state) => ({
          selectedPartIds: state.currentCutlist.parts.map((p) => p.part_id),
        })),

      clearSelection: () => set({ selectedPartIds: [] }),
      
      selectRange: (fromId, toId) => {
        const state = get();
        const parts = state.currentCutlist.parts;
        const fromIndex = parts.findIndex((p) => p.part_id === fromId);
        const toIndex = parts.findIndex((p) => p.part_id === toId);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        
        const rangeIds = parts.slice(start, end + 1).map((p) => p.part_id);
        
        set({
          selectedPartIds: [...new Set([...state.selectedPartIds, ...rangeIds])],
        });
      },

      // Cutlist
      setCutlistName: (name) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            name,
          },
        })),

      setCapabilities: (capabilities) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            capabilities: {
              ...state.currentCutlist.capabilities,
              ...capabilities,
            },
          },
        })),

      setProjectTracking: (project) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            project: {
              ...state.currentCutlist.project,
              ...project,
            },
          },
        })),

      resetCutlist: () => {
        set({
          ...getInitialState(),
          savedCutlistId: null,
          lastSavedAt: null,
        });
      },

      // Save/Load cutlist to database
      saveCutlist: async () => {
        const state = get();
        if (state.isSaving) {
          return { success: false, error: "Already saving" };
        }

        set({ isSaving: true });

        try {
          const { currentCutlist, savedCutlistId } = state;

          // If already saved, update existing
          if (savedCutlistId) {
            const response = await fetch(`/api/v1/cutlists/${savedCutlistId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: currentCutlist.name,
                capabilities: currentCutlist.capabilities,
                status: "completed",
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              set({ isSaving: false });
              return { success: false, error: data.error || "Failed to update cutlist" };
            }

            // Update parts
            if (currentCutlist.parts.length > 0) {
              await fetch(`/api/v1/cutlists/${savedCutlistId}/parts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  parts: currentCutlist.parts.map(p => ({
                    part_id: p.part_id,
                    label: p.label,
                    qty: p.qty,
                    size: p.size,
                    thickness_mm: p.thickness_mm,
                    material_id: p.material_id,
                    grain: p.grain,
                    allow_rotation: p.allow_rotation,
                    group_id: p.group_id,
                    ops: p.ops,
                    notes: p.notes,
                    audit: p.audit,
                  })),
                }),
              });
            }

            set({ 
              isSaving: false, 
              lastSavedAt: new Date().toISOString() 
            });
            return { success: true, cutlistId: savedCutlistId };
          }

          // Create new cutlist
          const response = await fetch("/api/v1/cutlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentCutlist.name,
              capabilities: currentCutlist.capabilities,
              parts: currentCutlist.parts.map(p => ({
                part_id: p.part_id,
                label: p.label,
                qty: p.qty,
                size: p.size,
                thickness_mm: p.thickness_mm,
                material_id: p.material_id,
                grain: p.grain,
                allow_rotation: p.allow_rotation,
                group_id: p.group_id,
                ops: p.ops,
                notes: p.notes,
              })),
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            set({ isSaving: false });
            return { success: false, error: data.error || "Failed to save cutlist" };
          }

          const data = await response.json();
          set({ 
            isSaving: false, 
            savedCutlistId: data.cutlist.id,
            lastSavedAt: new Date().toISOString(),
          });
          return { success: true, cutlistId: data.cutlist.id };
        } catch (error) {
          console.error("Save cutlist error:", error);
          set({ isSaving: false });
          return { success: false, error: "Network error" };
        }
      },

      saveCutlistAsDraft: async () => {
        const state = get();
        if (state.isSaving) {
          return { success: false, error: "Already saving" };
        }

        set({ isSaving: true });

        try {
          const { currentCutlist, savedCutlistId } = state;

          // If already saved, update existing as draft
          if (savedCutlistId) {
            const response = await fetch(`/api/v1/cutlists/${savedCutlistId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: currentCutlist.name,
                capabilities: currentCutlist.capabilities,
                status: "draft",
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              set({ isSaving: false });
              return { success: false, error: data.error || "Failed to save draft" };
            }

            set({ 
              isSaving: false, 
              lastSavedAt: new Date().toISOString() 
            });
            return { success: true, cutlistId: savedCutlistId };
          }

          // Create new draft cutlist
          const response = await fetch("/api/v1/cutlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentCutlist.name || "Untitled Draft",
              capabilities: currentCutlist.capabilities,
              parts: currentCutlist.parts.map(p => ({
                part_id: p.part_id,
                label: p.label,
                qty: p.qty,
                size: p.size,
                thickness_mm: p.thickness_mm,
                material_id: p.material_id,
                grain: p.grain,
                allow_rotation: p.allow_rotation,
                group_id: p.group_id,
                ops: p.ops,
                notes: p.notes,
              })),
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            set({ isSaving: false });
            return { success: false, error: data.error || "Failed to save draft" };
          }

          const data = await response.json();
          set({ 
            isSaving: false, 
            savedCutlistId: data.cutlist.id,
            lastSavedAt: new Date().toISOString(),
          });
          return { success: true, cutlistId: data.cutlist.id };
        } catch (error) {
          console.error("Save draft error:", error);
          set({ isSaving: false });
          return { success: false, error: "Network error" };
        }
      },

      loadCutlist: async (cutlistId: string) => {
        try {
          const response = await fetch(`/api/v1/cutlists/${cutlistId}`);
          
          if (!response.ok) {
            const data = await response.json();
            return { success: false, error: data.error || "Failed to load cutlist" };
          }

          const data = await response.json();
          const cutlist = data.cutlist;

          set((state) => ({
            currentCutlist: {
              doc_id: cutlist.doc_id || cutlist.id,
              name: cutlist.name,
              parts: cutlist.parts || [],
              materials: state.currentCutlist.materials, // Keep loaded materials
              edgebands: state.currentCutlist.edgebands,
              capabilities: cutlist.capabilities || defaultCapabilities,
            },
            savedCutlistId: cutlist.id,
            lastSavedAt: cutlist.updated_at,
            currentStep: cutlist.parts?.length > 0 ? "review" : "intake",
            inboxParts: [],
          }));

          return { success: true };
        } catch (error) {
          console.error("Load cutlist error:", error);
          return { success: false, error: "Network error" };
        }
      },
      
      // AI settings
      setAIProvider: (provider) =>
        set((state) => ({
          aiSettings: {
            ...state.aiSettings,
            provider,
          },
        })),

      setAISettings: (settings) =>
        set((state) => ({
          aiSettings: {
            ...state.aiSettings,
            ...settings,
          },
        })),
        
      // Undo/Redo
      undo: () => {
        const state = get();
        if (state.undoStack.length === 0) return;
        
        const action = state.undoStack[state.undoStack.length - 1];
        const newUndoStack = state.undoStack.slice(0, -1);
        
        switch (action.type) {
          case "ADD_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.filter((p) => p.part_id !== action.part.part_id),
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "ADD_PARTS":
            const addedIds = new Set(action.parts.map((p) => p.part_id));
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.filter((p) => !addedIds.has(p.part_id)),
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "UPDATE_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.map((p) =>
                  p.part_id === action.partId ? action.oldPart : p
                ),
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "REMOVE_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [...state.currentCutlist.parts, action.part],
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "REMOVE_PARTS":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [...state.currentCutlist.parts, ...action.parts],
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "CLEAR_PARTS":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: action.parts,
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
            
          case "DUPLICATE_PARTS":
            const dupIds = new Set(action.newParts.map((p) => p.part_id));
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.filter((p) => !dupIds.has(p.part_id)),
              },
              undoStack: newUndoStack,
              redoStack: [...state.redoStack, action],
            });
            break;
        }
      },
      
      redo: () => {
        const state = get();
        if (state.redoStack.length === 0) return;
        
        const action = state.redoStack[state.redoStack.length - 1];
        const newRedoStack = state.redoStack.slice(0, -1);
        
        switch (action.type) {
          case "ADD_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [...state.currentCutlist.parts, action.part],
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "ADD_PARTS":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [...state.currentCutlist.parts, ...action.parts],
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "UPDATE_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.map((p) =>
                  p.part_id === action.partId ? action.newPart : p
                ),
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "REMOVE_PART":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.filter((p) => p.part_id !== action.part.part_id),
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "REMOVE_PARTS":
            const removeIds = new Set(action.parts.map((p) => p.part_id));
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: state.currentCutlist.parts.filter((p) => !removeIds.has(p.part_id)),
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "CLEAR_PARTS":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [],
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
            
          case "DUPLICATE_PARTS":
            set({
              currentCutlist: {
                ...state.currentCutlist,
                parts: [...state.currentCutlist.parts, ...action.newParts],
              },
              undoStack: [...state.undoStack, action],
              redoStack: newRedoStack,
            });
            break;
        }
      },
      
      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,
    }),
    {
      name: "cai-intake-storage",
      // Only persist essential data - NOT full parts list (can be large)
      // Parts are persisted separately or fetched from server
      partialize: (state) => ({
        currentCutlist: {
          doc_id: state.currentCutlist.doc_id,
          name: state.currentCutlist.name,
          // Only persist first 100 parts locally for quick restore
          // Full list should be persisted server-side
          parts: state.currentCutlist.parts.slice(0, 100),
          materials: state.currentCutlist.materials,
          edgebands: state.currentCutlist.edgebands,
          capabilities: state.currentCutlist.capabilities,
        },
        currentStep: state.currentStep,
        isAdvancedMode: state.isAdvancedMode,
        aiSettings: state.aiSettings,
        // Don't persist undo/redo stacks or clipboard
      }),
    }
  )
);

