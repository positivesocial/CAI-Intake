/**
 * CAI Intake - Global State Store
 * 
 * Using Zustand for lightweight state management.
 * Manages the current cutlist, parts in the intake inbox, and UI state.
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

export interface IntakeState {
  // Current cutlist being edited
  currentCutlist: {
    doc_id: string;
    name: string;
    parts: CutPart[];
    materials: MaterialDef[];
    edgebands: EdgebandDef[];
    capabilities: CutlistCapabilities;
  };

  // Intake inbox - parts waiting for review
  inboxParts: ParsedPartWithStatus[];

  // Active intake mode
  activeMode: IntakeMode;

  // UI state
  isAdvancedMode: boolean;
  selectedPartIds: string[];
  
  // AI settings
  aiSettings: AISettings;

  // Actions
  setActiveMode: (mode: IntakeMode) => void;
  toggleAdvancedMode: () => void;

  // Parts management
  addPart: (part: CutPart) => void;
  addParts: (parts: CutPart[]) => void;
  updatePart: (partId: string, updates: Partial<CutPart>) => void;
  removePart: (partId: string) => void;
  clearParts: () => void;

  // Inbox management
  addToInbox: (parts: ParsedPartWithStatus[]) => void;
  acceptInboxPart: (partId: string) => void;
  acceptAllInboxParts: () => void;
  rejectInboxPart: (partId: string) => void;
  clearInbox: () => void;
  updateInboxPart: (partId: string, updates: Partial<CutPart>) => void;

  // Materials
  addMaterial: (material: MaterialDef) => void;
  removeMaterial: (materialId: string) => void;

  // Selection
  selectPart: (partId: string) => void;
  deselectPart: (partId: string) => void;
  selectAllParts: () => void;
  clearSelection: () => void;

  // Cutlist
  setCutlistName: (name: string) => void;
  setCapabilities: (capabilities: Partial<CutlistCapabilities>) => void;
  resetCutlist: () => void;
  
  // AI settings
  setAIProvider: (provider: AIProviderType) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
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
  isAdvancedMode: false,
  selectedPartIds: [],
  aiSettings: defaultAISettings,
});

// ============================================================
// STORE
// ============================================================

export const useIntakeStore = create<IntakeState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      // Mode
      setActiveMode: (mode) => set({ activeMode: mode }),
      toggleAdvancedMode: () => set((state) => ({ isAdvancedMode: !state.isAdvancedMode })),

      // Parts management
      addPart: (part) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, part],
          },
        })),

      addParts: (parts) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...parts],
          },
        })),

      updatePart: (partId, updates) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.map((p) =>
              p.part_id === partId ? { ...p, ...updates } : p
            ),
          },
        })),

      removePart: (partId) =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: state.currentCutlist.parts.filter((p) => p.part_id !== partId),
          },
          selectedPartIds: state.selectedPartIds.filter((id) => id !== partId),
        })),

      clearParts: () =>
        set((state) => ({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [],
          },
          selectedPartIds: [],
        })),

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
          });
        }
      },

      acceptAllInboxParts: () => {
        const state = get();
        const acceptedParts = state.inboxParts
          .filter((p) => p._status !== "rejected")
          .map(({ _status, _originalText, ...part }) => part);
        set({
          currentCutlist: {
            ...state.currentCutlist,
            parts: [...state.currentCutlist.parts, ...acceptedParts],
          },
          inboxParts: [],
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
            p.part_id === partId ? { ...p, ...updates, _status: "editing" as const } : p
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

      selectAllParts: () =>
        set((state) => ({
          selectedPartIds: state.currentCutlist.parts.map((p) => p.part_id),
        })),

      clearSelection: () => set({ selectedPartIds: [] }),

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

      resetCutlist: () => set(getInitialState()),
      
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
    }),
    {
      name: "cai-intake-storage",
      partialize: (state) => ({
        currentCutlist: state.currentCutlist,
        isAdvancedMode: state.isAdvancedMode,
        aiSettings: state.aiSettings,
      }),
    }
  )
);

