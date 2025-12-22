/**
 * CAI Intake - Operation Types Store
 * 
 * Zustand store for managing operation type libraries:
 * - Groove types
 * - Hole types
 * - CNC operation types
 * - Edgeband materials (from edgebands API)
 */

import { create } from "zustand";
import type { GrooveType, HoleType, CncOperationType } from "@/lib/schema";

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
  grooveTypes: GrooveType[];
  holeTypes: HoleType[];
  cncTypes: CncOperationType[];
  edgebandMaterials: EdgebandMaterial[];

  // Loading states
  isLoadingGrooveTypes: boolean;
  isLoadingHoleTypes: boolean;
  isLoadingCncTypes: boolean;
  isLoadingEdgebands: boolean;

  // Error states
  grooveTypesError: string | null;
  holeTypesError: string | null;
  cncTypesError: string | null;
  edgebandsError: string | null;

  // Actions
  fetchGrooveTypes: () => Promise<void>;
  fetchHoleTypes: () => Promise<void>;
  fetchCncTypes: () => Promise<void>;
  fetchEdgebandMaterials: () => Promise<void>;
  fetchAllTypes: () => Promise<void>;

  // Selectors
  getGrooveTypeByCode: (code: string) => GrooveType | undefined;
  getHoleTypeByCode: (code: string) => HoleType | undefined;
  getCncTypeByCode: (code: string) => CncOperationType | undefined;
  getEdgebandById: (id: string) => EdgebandMaterial | undefined;
}

// ============================================================
// STORE
// ============================================================

export const useOperationTypesStore = create<OperationTypesState>((set, get) => ({
  // Initial state
  grooveTypes: [],
  holeTypes: [],
  cncTypes: [],
  edgebandMaterials: [],

  isLoadingGrooveTypes: false,
  isLoadingHoleTypes: false,
  isLoadingCncTypes: false,
  isLoadingEdgebands: false,

  grooveTypesError: null,
  holeTypesError: null,
  cncTypesError: null,
  edgebandsError: null,

  // Fetch groove types
  fetchGrooveTypes: async () => {
    set({ isLoadingGrooveTypes: true, grooveTypesError: null });
    try {
      const response = await fetch("/api/v1/groove-types");
      if (!response.ok) throw new Error("Failed to fetch groove types");
      const data = await response.json();
      set({ grooveTypes: data.types || [], isLoadingGrooveTypes: false });
    } catch (error) {
      console.error("Failed to fetch groove types:", error);
      set({
        grooveTypesError: error instanceof Error ? error.message : "Unknown error",
        isLoadingGrooveTypes: false,
      });
    }
  },

  // Fetch hole types
  fetchHoleTypes: async () => {
    set({ isLoadingHoleTypes: true, holeTypesError: null });
    try {
      const response = await fetch("/api/v1/hole-types");
      if (!response.ok) throw new Error("Failed to fetch hole types");
      const data = await response.json();
      set({ holeTypes: data.types || [], isLoadingHoleTypes: false });
    } catch (error) {
      console.error("Failed to fetch hole types:", error);
      set({
        holeTypesError: error instanceof Error ? error.message : "Unknown error",
        isLoadingHoleTypes: false,
      });
    }
  },

  // Fetch CNC types
  fetchCncTypes: async () => {
    set({ isLoadingCncTypes: true, cncTypesError: null });
    try {
      const response = await fetch("/api/v1/cnc-types");
      if (!response.ok) throw new Error("Failed to fetch CNC types");
      const data = await response.json();
      set({ cncTypes: data.types || [], isLoadingCncTypes: false });
    } catch (error) {
      console.error("Failed to fetch CNC types:", error);
      set({
        cncTypesError: error instanceof Error ? error.message : "Unknown error",
        isLoadingCncTypes: false,
      });
    }
  },

  // Fetch edgeband materials
  fetchEdgebandMaterials: async () => {
    set({ isLoadingEdgebands: true, edgebandsError: null });
    try {
      const response = await fetch("/api/v1/edgebands");
      if (!response.ok) throw new Error("Failed to fetch edgebands");
      const data = await response.json();
      set({ edgebandMaterials: data.edgebands || [], isLoadingEdgebands: false });
    } catch (error) {
      console.error("Failed to fetch edgebands:", error);
      set({
        edgebandsError: error instanceof Error ? error.message : "Unknown error",
        isLoadingEdgebands: false,
      });
    }
  },

  // Fetch all types at once
  fetchAllTypes: async () => {
    const store = get();
    await Promise.all([
      store.fetchGrooveTypes(),
      store.fetchHoleTypes(),
      store.fetchCncTypes(),
      store.fetchEdgebandMaterials(),
    ]);
  },

  // Selectors
  getGrooveTypeByCode: (code: string) => {
    return get().grooveTypes.find(t => t.code.toUpperCase() === code.toUpperCase());
  },

  getHoleTypeByCode: (code: string) => {
    return get().holeTypes.find(t => t.code.toUpperCase() === code.toUpperCase());
  },

  getCncTypeByCode: (code: string) => {
    return get().cncTypes.find(t => t.code.toUpperCase() === code.toUpperCase());
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
  
  // Fetch all types if not already loaded
  if (
    store.grooveTypes.length === 0 &&
    !store.isLoadingGrooveTypes &&
    !store.grooveTypesError
  ) {
    store.fetchAllTypes();
  }

  return {
    grooveTypes: store.grooveTypes,
    holeTypes: store.holeTypes,
    cncTypes: store.cncTypes,
    edgebandMaterials: store.edgebandMaterials,
    isLoading:
      store.isLoadingGrooveTypes ||
      store.isLoadingHoleTypes ||
      store.isLoadingCncTypes ||
      store.isLoadingEdgebands,
    errors: {
      grooveTypes: store.grooveTypesError,
      holeTypes: store.holeTypesError,
      cncTypes: store.cncTypesError,
      edgebands: store.edgebandsError,
    },
    refetch: store.fetchAllTypes,
    getGrooveTypeByCode: store.getGrooveTypeByCode,
    getHoleTypeByCode: store.getHoleTypeByCode,
    getCncTypeByCode: store.getCncTypeByCode,
    getEdgebandById: store.getEdgebandById,
  };
}

