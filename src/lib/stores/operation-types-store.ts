/**
 * CAI Intake - Operation Types Store
 * 
 * Zustand store for managing operation type libraries:
 * - Groove operations (from /api/v1/operations/groove)
 * - Drilling operations (from /api/v1/operations/drilling)
 * - CNC operations (from /api/v1/operations/cnc)
 * - Edgeband operations (from /api/v1/operations/edgeband)
 */

import { create } from "zustand";
import type { 
  GrooveOperation, 
  DrillingOperation, 
  CncOperation,
  EdgebandOperation 
} from "@/lib/operations/types";

// ============================================================
// TYPES
// ============================================================

export interface EdgebandMaterial {
  id: string;
  edgeband_id: string;
  name: string;
  thickness_mm: number;
  width_mm: number;
  material?: string;
  color_code?: string;
}

interface OperationTypesState {
  // Data
  grooveOperations: GrooveOperation[];
  drillingOperations: DrillingOperation[];
  cncOperations: CncOperation[];
  edgebandOperations: EdgebandOperation[];
  edgebandMaterials: EdgebandMaterial[];

  // Loading states
  isLoadingGrooveOps: boolean;
  isLoadingDrillingOps: boolean;
  isLoadingCncOps: boolean;
  isLoadingEdgebandOps: boolean;
  isLoadingEdgebands: boolean;

  // Error states
  grooveOpsError: string | null;
  drillingOpsError: string | null;
  cncOpsError: string | null;
  edgebandOpsError: string | null;
  edgebandsError: string | null;

  // Actions
  fetchGrooveOperations: () => Promise<void>;
  fetchDrillingOperations: () => Promise<void>;
  fetchCncOperations: () => Promise<void>;
  fetchEdgebandOperations: () => Promise<void>;
  fetchEdgebandMaterials: () => Promise<void>;
  fetchAllOperations: () => Promise<void>;

  // Selectors
  getGrooveOpByCode: (code: string) => GrooveOperation | undefined;
  getDrillingOpByCode: (code: string) => DrillingOperation | undefined;
  getCncOpByCode: (code: string) => CncOperation | undefined;
  getEdgebandOpByCode: (code: string) => EdgebandOperation | undefined;
  getEdgebandById: (id: string) => EdgebandMaterial | undefined;
}

// ============================================================
// STORE
// ============================================================

export const useOperationTypesStore = create<OperationTypesState>((set, get) => ({
  // Initial state
  grooveOperations: [],
  drillingOperations: [],
  cncOperations: [],
  edgebandOperations: [],
  edgebandMaterials: [],

  isLoadingGrooveOps: false,
  isLoadingDrillingOps: false,
  isLoadingCncOps: false,
  isLoadingEdgebandOps: false,
  isLoadingEdgebands: false,

  grooveOpsError: null,
  drillingOpsError: null,
  cncOpsError: null,
  edgebandOpsError: null,
  edgebandsError: null,

  // Fetch groove operations
  fetchGrooveOperations: async () => {
    set({ isLoadingGrooveOps: true, grooveOpsError: null });
    try {
      const response = await fetch("/api/v1/operations/groove", {
        credentials: "include",
      });
      if (!response.ok) {
        // Return empty array on error - not critical
        set({ grooveOperations: [], isLoadingGrooveOps: false });
        return;
      }
      const data = await response.json();
      set({ grooveOperations: data.operations || [], isLoadingGrooveOps: false });
    } catch (error) {
      console.warn("Failed to fetch groove operations:", error);
      set({
        grooveOperations: [],
        grooveOpsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingGrooveOps: false,
      });
    }
  },

  // Fetch drilling operations
  fetchDrillingOperations: async () => {
    set({ isLoadingDrillingOps: true, drillingOpsError: null });
    try {
      const response = await fetch("/api/v1/operations/drilling", {
        credentials: "include",
      });
      if (!response.ok) {
        set({ drillingOperations: [], isLoadingDrillingOps: false });
        return;
      }
      const data = await response.json();
      set({ drillingOperations: data.operations || [], isLoadingDrillingOps: false });
    } catch (error) {
      console.warn("Failed to fetch drilling operations:", error);
      set({
        drillingOperations: [],
        drillingOpsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingDrillingOps: false,
      });
    }
  },

  // Fetch CNC operations
  fetchCncOperations: async () => {
    set({ isLoadingCncOps: true, cncOpsError: null });
    try {
      const response = await fetch("/api/v1/operations/cnc", {
        credentials: "include",
      });
      if (!response.ok) {
        set({ cncOperations: [], isLoadingCncOps: false });
        return;
      }
      const data = await response.json();
      set({ cncOperations: data.operations || [], isLoadingCncOps: false });
    } catch (error) {
      console.warn("Failed to fetch CNC operations:", error);
      set({
        cncOperations: [],
        cncOpsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingCncOps: false,
      });
    }
  },

  // Fetch edgeband operations
  fetchEdgebandOperations: async () => {
    set({ isLoadingEdgebandOps: true, edgebandOpsError: null });
    try {
      const response = await fetch("/api/v1/operations/edgeband", {
        credentials: "include",
      });
      if (!response.ok) {
        set({ edgebandOperations: [], isLoadingEdgebandOps: false });
        return;
      }
      const data = await response.json();
      set({ edgebandOperations: data.operations || [], isLoadingEdgebandOps: false });
    } catch (error) {
      console.warn("Failed to fetch edgeband operations:", error);
      set({
        edgebandOperations: [],
        edgebandOpsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingEdgebandOps: false,
      });
    }
  },

  // Fetch edgeband materials (from the edgebands API)
  fetchEdgebandMaterials: async () => {
    set({ isLoadingEdgebands: true, edgebandsError: null });
    try {
      const response = await fetch("/api/v1/edgebands", {
        credentials: "include",
      });
      if (!response.ok) {
        set({ edgebandMaterials: [], isLoadingEdgebands: false });
        return;
      }
      const data = await response.json();
      set({ edgebandMaterials: data.edgebands || [], isLoadingEdgebands: false });
    } catch (error) {
      console.warn("Failed to fetch edgebands:", error);
      set({
        edgebandMaterials: [],
        edgebandsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingEdgebands: false,
      });
    }
  },

  // Fetch all operations at once
  fetchAllOperations: async () => {
    const store = get();
    await Promise.all([
      store.fetchGrooveOperations(),
      store.fetchDrillingOperations(),
      store.fetchCncOperations(),
      store.fetchEdgebandOperations(),
      store.fetchEdgebandMaterials(),
    ]);
  },

  // Selectors
  getGrooveOpByCode: (code: string) => {
    return get().grooveOperations.find(op => op.code.toUpperCase() === code.toUpperCase());
  },

  getDrillingOpByCode: (code: string) => {
    return get().drillingOperations.find(op => op.code.toUpperCase() === code.toUpperCase());
  },

  getCncOpByCode: (code: string) => {
    return get().cncOperations.find(op => op.code.toUpperCase() === code.toUpperCase());
  },

  getEdgebandOpByCode: (code: string) => {
    return get().edgebandOperations.find(op => op.code.toUpperCase() === code.toUpperCase());
  },

  getEdgebandById: (id: string) => {
    return get().edgebandMaterials.find(e => e.id === id || e.edgeband_id === id);
  },
}));

// ============================================================
// SHORTCODE FORMATTING UTILITIES
// ============================================================

/**
 * Format operations as compact shortcode string
 */
export function formatOpsAsShortcode(
  ops: {
    edging?: { edgeband_id?: string; sides: string[] };
    grooves?: Array<{ type_code: string; width_mm: number; depth_mm: number; side: string }>;
    holes?: Array<{ type_code: string; face: string }>;
    cnc?: Array<{ type_code: string }>;
  },
  store: Pick<OperationTypesState, "getEdgebandById">
): string {
  const parts: string[] = [];

  // Edgebanding shortcode
  if (ops.edging && ops.edging.sides.length > 0) {
    const eb = ops.edging.edgeband_id
      ? store.getEdgebandById(ops.edging.edgeband_id)
      : undefined;
    const materialCode = eb?.edgeband_id?.substring(0, 4) || "EB";
    const sidesCode = formatSidesCode(ops.edging.sides);
    parts.push(`EB:${materialCode}:${sidesCode}`);
  }

  // Groove shortcodes
  if (ops.grooves && ops.grooves.length > 0) {
    for (const g of ops.grooves) {
      parts.push(`GR:${g.type_code}:${g.depth_mm}x${g.width_mm}@${g.side}`);
    }
  }

  // Hole shortcodes
  if (ops.holes && ops.holes.length > 0) {
    for (const h of ops.holes) {
      parts.push(`H:${h.type_code}@${h.face}`);
    }
  }

  // CNC shortcodes
  if (ops.cnc && ops.cnc.length > 0) {
    for (const c of ops.cnc) {
      parts.push(`CNC:${c.type_code}`);
    }
  }

  return parts.join(" ");
}

/**
 * Format edge sides as compact code
 */
function formatSidesCode(sides: string[]): string {
  if (sides.length === 0) return "";

  const lCount = sides.filter(s => s.startsWith("L")).length;
  const wCount = sides.filter(s => s.startsWith("W")).length;

  if (lCount === 2 && wCount === 2) return "4S";
  if (lCount === 2 && wCount === 0) return "2L";
  if (lCount === 0 && wCount === 2) return "2W";
  if (lCount === 1 && wCount === 1) return sides.sort().join("");

  return sides.sort().join("");
}

/**
 * Hook to fetch operation types on mount
 */
export function useOperationTypes() {
  const store = useOperationTypesStore();
  
  // Fetch all operations if not already loaded
  if (
    store.grooveOperations.length === 0 &&
    !store.isLoadingGrooveOps &&
    !store.grooveOpsError
  ) {
    store.fetchAllOperations();
  }

  return {
    grooveOperations: store.grooveOperations,
    drillingOperations: store.drillingOperations,
    cncOperations: store.cncOperations,
    edgebandOperations: store.edgebandOperations,
    edgebandMaterials: store.edgebandMaterials,
    isLoading:
      store.isLoadingGrooveOps ||
      store.isLoadingDrillingOps ||
      store.isLoadingCncOps ||
      store.isLoadingEdgebandOps ||
      store.isLoadingEdgebands,
    errors: {
      grooveOps: store.grooveOpsError,
      drillingOps: store.drillingOpsError,
      cncOps: store.cncOpsError,
      edgebandOps: store.edgebandOpsError,
      edgebands: store.edgebandsError,
    },
    refetch: store.fetchAllOperations,
    getGrooveOpByCode: store.getGrooveOpByCode,
    getDrillingOpByCode: store.getDrillingOpByCode,
    getCncOpByCode: store.getCncOpByCode,
    getEdgebandOpByCode: store.getEdgebandOpByCode,
    getEdgebandById: store.getEdgebandById,
  };
}
