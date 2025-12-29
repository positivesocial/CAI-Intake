/**
 * CAI Intake - Statistics Calculator
 * 
 * Calculates pre-optimization statistics from cutlist parts.
 * These are "invariant" statistics that don't depend on optimization results.
 */

import type { CutPart, MaterialDef, EdgebandDef } from "@/lib/schema";

// ============================================================
// TYPES
// ============================================================

export interface MaterialStatistics {
  materialId: string;
  name: string;
  thickness: number;
  /** Total area in mm² */
  totalArea: number;
  /** Total area in m² */
  totalAreaSqm: number;
  /** Number of unique part definitions */
  uniqueParts: number;
  /** Total number of pieces (sum of qty) */
  totalPieces: number;
  /** Theoretical minimum sheets (area / sheet_area, no waste) */
  theoreticalSheets: number;
  /** Default sheet size */
  sheetSize?: { L: number; W: number };
  /** Sheet area in mm² */
  sheetArea?: number;
  /** Sheet estimation with kerf consideration */
  sheetEstimate?: SheetEstimate;
}

/**
 * Sheet estimation result with kerf-adjusted calculations
 */
export interface SheetEstimate {
  /** Estimated number of sheets required */
  estimatedSheets: number;
  /** Estimated material efficiency (0-1) */
  estimatedEfficiency: number;
  /** Kerf-adjusted total area (mm²) - parts area + kerf allowances */
  kerfAdjustedArea: number;
  /** Total sheet area used (mm²) */
  totalSheetArea: number;
  /** Estimated waste area (mm²) */
  wasteArea: number;
  /** Kerf width used in calculation (mm) */
  kerfWidth: number;
  /** Parts that fit per sheet (average) */
  avgPartsPerSheet: number;
  /** Sheet dimensions used */
  sheetSize: { L: number; W: number };
  /** Warning if parts exceed sheet size */
  oversizedParts: number;
}

export interface EdgeBandingStatistics {
  edgebandId: string;
  name: string;
  thickness: number;
  /** Total length of edge banding in mm */
  totalLength: number;
  /** Total length in meters */
  totalLengthM: number;
  /** Number of individual edges */
  edgeCount: number;
  /** Number of parts with this edgeband */
  partsAffected: number;
}

export interface GroovingStatistics {
  profileId: string;
  /** Total length of grooves in mm */
  totalLength: number;
  /** Total length in meters */
  totalLengthM: number;
  /** Number of groove operations */
  grooveCount: number;
  /** Number of parts with grooves */
  partsAffected: number;
}

export interface CNCOperationStatistics {
  holes: {
    /** Total number of holes */
    count: number;
    /** Parts with hole operations */
    partsAffected: number;
  };
  routing: {
    /** Number of routing operations */
    count: number;
    /** Total routing length in mm (if applicable) */
    totalLength: number;
    /** Parts with routing operations */
    partsAffected: number;
  };
  customOps: {
    /** Number of custom CNC operations */
    count: number;
    /** Parts with custom operations */
    partsAffected: number;
  };
}

export interface CutlistStatistics {
  /** Material usage by material type */
  materials: MaterialStatistics[];
  
  /** Edge banding totals by edgeband type */
  edgeBanding: EdgeBandingStatistics[];
  
  /** Grooving totals by profile */
  grooving: GroovingStatistics[];
  
  /** CNC operation counts */
  cncOperations: CNCOperationStatistics;
  
  /** General totals */
  totals: {
    /** Number of unique part definitions */
    uniqueParts: number;
    /** Total pieces (sum of all qty) */
    totalPieces: number;
    /** Total area across all materials (mm²) */
    totalArea: number;
    /** Total area in m² */
    totalAreaSqm: number;
    /** Parts with operator notes */
    partsWithNotes: number;
    /** Parts with CNC notes */
    partsWithCNCNotes: number;
    /** Parts needing human review (low confidence) */
    partsNeedingReview: number;
    /** Parts with edge banding */
    partsWithEdging: number;
    /** Parts with grooving */
    partsWithGrooving: number;
    /** Parts with CNC operations */
    partsWithCNC: number;
    /** Parts with grain constraint (cannot rotate) */
    partsWithGrain: number;
  };
  
  /** Calculation timestamp */
  calculatedAt: string;
}

// ============================================================
// CALCULATOR
// ============================================================

/**
 * Calculate all statistics from a list of parts
 */
export function calculateStatistics(
  parts: CutPart[],
  materials: MaterialDef[] = [],
  edgebands: EdgebandDef[] = []
): CutlistStatistics {
  // Initialize accumulators
  const materialStats: Map<string, MaterialStatistics> = new Map();
  const edgebandStats: Map<string, EdgeBandingStatistics> = new Map();
  const groovingStats: Map<string, GroovingStatistics> = new Map();
  
  let totalHoles = 0;
  let partsWithHoles = 0;
  let totalRouting = 0;
  let routingLength = 0;
  let partsWithRouting = 0;
  let totalCustomOps = 0;
  let partsWithCustomOps = 0;
  
  let partsWithNotes = 0;
  let partsWithCNCNotes = 0;
  let partsNeedingReview = 0;
  let partsWithEdging = 0;
  let partsWithGrooving = 0;
  let partsWithCNC = 0;
  let partsWithGrain = 0;
  
  // Process each part
  for (const part of parts) {
    const qty = part.qty;
    const area = part.size.L * part.size.W * qty;
    
    // Material statistics
    const materialId = part.material_id;
    const materialDef = materials.find(m => m.material_id === materialId);
    
    if (!materialStats.has(materialId)) {
      materialStats.set(materialId, {
        materialId,
        name: materialDef?.name ?? materialId,
        thickness: part.thickness_mm,
        totalArea: 0,
        totalAreaSqm: 0,
        uniqueParts: 0,
        totalPieces: 0,
        theoreticalSheets: 0,
        sheetSize: materialDef?.default_sheet?.size,
        sheetArea: materialDef?.default_sheet?.size 
          ? materialDef.default_sheet.size.L * materialDef.default_sheet.size.W 
          : undefined,
      });
    }
    
    const matStat = materialStats.get(materialId)!;
    matStat.totalArea += area;
    matStat.uniqueParts += 1;
    matStat.totalPieces += qty;
    
    // Edge banding statistics
    if (part.ops?.edging?.edges) {
      const edges = part.ops.edging.edges;
      let hasAnyEdging = false;
      
      for (const [edgeKey, edgeConfig] of Object.entries(edges)) {
        if (edgeConfig.apply) {
          hasAnyEdging = true;
          const edgebandId = edgeConfig.edgeband_id || "default";
          const edgebandDef = edgebands.find(eb => eb.edgeband_id === edgebandId);
          
          if (!edgebandStats.has(edgebandId)) {
            edgebandStats.set(edgebandId, {
              edgebandId,
              name: edgebandDef?.name ?? edgebandId,
              thickness: edgebandDef?.thickness_mm ?? 0.8,
              totalLength: 0,
              totalLengthM: 0,
              edgeCount: 0,
              partsAffected: 0,
            });
          }
          
          const ebStat = edgebandStats.get(edgebandId)!;
          
          // Calculate edge length
          const isLongEdge = edgeKey.startsWith("L");
          const edgeLength = isLongEdge ? part.size.L : part.size.W;
          
          ebStat.totalLength += edgeLength * qty;
          ebStat.edgeCount += qty;
        }
      }
      
      if (hasAnyEdging) {
        partsWithEdging++;
        // Update parts affected for all edgebands used by this part
        const usedEdgebands = new Set<string>();
        for (const edgeConfig of Object.values(edges)) {
          if (edgeConfig.apply) {
            usedEdgebands.add(edgeConfig.edgeband_id || "default");
          }
        }
        for (const ebId of usedEdgebands) {
          const ebStat = edgebandStats.get(ebId);
          if (ebStat) ebStat.partsAffected++;
        }
      }
    }
    
    // Grooving statistics
    if (part.ops?.grooves && part.ops.grooves.length > 0) {
      partsWithGrooving++;
      
      for (const groove of part.ops.grooves) {
        const profileId = groove.profile_id || "default";
        
        if (!groovingStats.has(profileId)) {
          groovingStats.set(profileId, {
            profileId,
            totalLength: 0,
            totalLengthM: 0,
            grooveCount: 0,
            partsAffected: 0,
          });
        }
        
        const grvStat = groovingStats.get(profileId)!;
        
        // Estimate groove length based on side reference
        // If groove has explicit length, use that; otherwise estimate from part dimensions
        let grooveLength = groove.length_mm ?? 0;
        
        if (!grooveLength) {
          // Estimate based on which side the groove is referenced from
          // L1/L2 sides run along length, W1/W2 sides run along width
          if (groove.side.startsWith("L")) {
            grooveLength = part.size.L;
          } else if (groove.side.startsWith("W")) {
            grooveLength = part.size.W;
          } else {
            // Default to longer dimension
            grooveLength = Math.max(part.size.L, part.size.W);
          }
        }
        
        grvStat.totalLength += grooveLength * qty;
        grvStat.grooveCount += qty;
      }
      
      // Update parts affected
      const usedProfiles = new Set<string>();
      for (const groove of part.ops.grooves) {
        usedProfiles.add(groove.profile_id || "default");
      }
      for (const profId of usedProfiles) {
        const grvStat = groovingStats.get(profId);
        if (grvStat) grvStat.partsAffected++;
      }
    }
    
    // CNC hole statistics
    if (part.ops?.holes && part.ops.holes.length > 0) {
      let partHoleCount = 0;
      for (const holeOp of part.ops.holes) {
        // Count inline holes if defined, otherwise count the operation as 1
        const count = holeOp.holes?.length ?? 1;
        partHoleCount += count * qty;
      }
      totalHoles += partHoleCount;
      partsWithHoles++;
    }
    
    // CNC routing statistics
    if (part.ops?.routing && part.ops.routing.length > 0) {
      totalRouting += part.ops.routing.length;
      partsWithRouting++;
      
      // Estimate routing length from region perimeter if no explicit path length
      for (const routeOp of part.ops.routing) {
        if (routeOp.region) {
          // Estimate path length as perimeter of routing region
          const perimeter = 2 * (routeOp.region.L + routeOp.region.W);
          routingLength += perimeter * qty;
        }
      }
    }
    
    // Custom CNC operations
    if (part.ops?.custom_cnc_ops && part.ops.custom_cnc_ops.length > 0) {
      totalCustomOps += part.ops.custom_cnc_ops.length * qty;
      partsWithCustomOps++;
    }
    
    // General statistics
    if (part.ops?.holes || part.ops?.routing || part.ops?.custom_cnc_ops) {
      partsWithCNC++;
    }
    
    if (part.notes?.operator) {
      partsWithNotes++;
    }
    
    if (part.notes?.cnc) {
      partsWithCNCNotes++;
    }
    
    if (part.audit?.confidence !== undefined && part.audit.confidence < 0.75) {
      partsNeedingReview++;
    }
    
    if (part.allow_rotation === false) {
      partsWithGrain++; // Part respects material grain
    }
  }
  
  // Group parts by material for sheet estimation
  const partsByMaterial = new Map<string, CutPart[]>();
  for (const part of parts) {
    if (!partsByMaterial.has(part.material_id)) {
      partsByMaterial.set(part.material_id, []);
    }
    partsByMaterial.get(part.material_id)!.push(part);
  }

  // Finalize material statistics with sheet estimates
  for (const matStat of materialStats.values()) {
    matStat.totalAreaSqm = matStat.totalArea / 1_000_000;
    if (matStat.sheetArea) {
      matStat.theoreticalSheets = Math.ceil(matStat.totalArea / matStat.sheetArea);
    }
    
    // Calculate sheet estimate with kerf consideration
    const materialParts = partsByMaterial.get(matStat.materialId) || [];
    const sheetSize = matStat.sheetSize || DEFAULT_SHEET_SIZE;
    matStat.sheetEstimate = calculateSheetEstimate(materialParts, sheetSize, DEFAULT_KERF_WIDTH);
  }
  
  // Finalize edgeband statistics
  for (const ebStat of edgebandStats.values()) {
    ebStat.totalLengthM = ebStat.totalLength / 1000;
  }
  
  // Finalize grooving statistics
  for (const grvStat of groovingStats.values()) {
    grvStat.totalLengthM = grvStat.totalLength / 1000;
  }
  
  // Calculate totals
  const totalArea = Array.from(materialStats.values())
    .reduce((sum, m) => sum + m.totalArea, 0);
  
  const totalPieces = Array.from(materialStats.values())
    .reduce((sum, m) => sum + m.totalPieces, 0);
  
  return {
    materials: Array.from(materialStats.values()),
    edgeBanding: Array.from(edgebandStats.values()),
    grooving: Array.from(groovingStats.values()),
    cncOperations: {
      holes: {
        count: totalHoles,
        partsAffected: partsWithHoles,
      },
      routing: {
        count: totalRouting,
        totalLength: routingLength,
        partsAffected: partsWithRouting,
      },
      customOps: {
        count: totalCustomOps,
        partsAffected: partsWithCustomOps,
      },
    },
    totals: {
      uniqueParts: parts.length,
      totalPieces,
      totalArea,
      totalAreaSqm: totalArea / 1_000_000,
      partsWithNotes,
      partsWithCNCNotes,
      partsNeedingReview,
      partsWithEdging,
      partsWithGrooving,
      partsWithCNC,
      partsWithGrain,
    },
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format area for display
 */
export function formatArea(areaMm2: number): string {
  const sqm = areaMm2 / 1_000_000;
  if (sqm >= 1) {
    return `${sqm.toFixed(2)} m²`;
  }
  return `${(areaMm2 / 10000).toFixed(0)} cm²`;
}

/**
 * Format length for display
 */
export function formatLength(lengthMm: number): string {
  if (lengthMm >= 1000) {
    return `${(lengthMm / 1000).toFixed(2)} m`;
  }
  return `${lengthMm.toFixed(0)} mm`;
}

/**
 * Get a summary string for statistics
 */
export function getStatsSummary(stats: CutlistStatistics): string {
  const lines: string[] = [];
  
  lines.push(`${stats.totals.uniqueParts} unique parts, ${stats.totals.totalPieces} total pieces`);
  lines.push(`Total area: ${stats.totals.totalAreaSqm.toFixed(2)} m²`);
  
  if (stats.materials.length > 0) {
    const sheets = stats.materials.reduce((sum, m) => sum + m.theoreticalSheets, 0);
    lines.push(`Theoretical minimum: ${sheets} sheets`);
  }
  
  if (stats.totals.partsWithEdging > 0) {
    const totalEdging = stats.edgeBanding.reduce((sum, eb) => sum + eb.totalLengthM, 0);
    lines.push(`Edge banding: ${totalEdging.toFixed(1)} m`);
  }
  
  if (stats.totals.partsWithCNC > 0) {
    lines.push(`CNC operations: ${stats.cncOperations.holes.count} holes, ${stats.cncOperations.routing.count} routes`);
  }
  
  return lines.join("\n");
}

/**
 * Check if statistics are empty
 */
export function isStatsEmpty(stats: CutlistStatistics): boolean {
  return stats.totals.uniqueParts === 0;
}

// ============================================================
// SHEET ESTIMATION
// ============================================================

/** Default kerf width in mm (saw blade thickness + margin) */
const DEFAULT_KERF_WIDTH = 4;

/** Default sheet size if not specified (mm) - standard 2440x1220 */
const DEFAULT_SHEET_SIZE = { L: 2440, W: 1220 };

/** Margin from sheet edges (mm) */
const EDGE_MARGIN = 10;

/**
 * Part with kerf-adjusted dimensions for packing
 */
interface PackingPart {
  id: string;
  L: number;  // Length with kerf
  W: number;  // Width with kerf
  originalL: number;
  originalW: number;
  area: number;
  canRotate: boolean;
}

/**
 * Calculate sheet estimates for a set of parts with kerf consideration.
 * Uses a First Fit Decreasing (FFD) bin packing approximation.
 * 
 * @param parts - Parts to estimate sheets for
 * @param sheetSize - Sheet dimensions (default: 2440x1220mm)
 * @param kerfWidth - Kerf width in mm (default: 4mm)
 * @returns Sheet estimation results
 */
export function calculateSheetEstimate(
  parts: CutPart[],
  sheetSize: { L: number; W: number } = DEFAULT_SHEET_SIZE,
  kerfWidth: number = DEFAULT_KERF_WIDTH
): SheetEstimate {
  if (parts.length === 0) {
    return {
      estimatedSheets: 0,
      estimatedEfficiency: 0,
      kerfAdjustedArea: 0,
      totalSheetArea: 0,
      wasteArea: 0,
      kerfWidth,
      avgPartsPerSheet: 0,
      sheetSize,
      oversizedParts: 0,
    };
  }

  // Usable sheet area (accounting for edge margins)
  const usableL = sheetSize.L - (2 * EDGE_MARGIN);
  const usableW = sheetSize.W - (2 * EDGE_MARGIN);
  const fullSheetArea = sheetSize.L * sheetSize.W;

  // Expand parts by quantity and add kerf allowance
  const packingParts: PackingPart[] = [];
  let oversizedParts = 0;
  let totalOriginalArea = 0;

  for (const part of parts) {
    for (let i = 0; i < part.qty; i++) {
      // Add kerf to each dimension (kerf is needed on each cut)
      const adjustedL = part.size.L + kerfWidth;
      const adjustedW = part.size.W + kerfWidth;
      
      totalOriginalArea += part.size.L * part.size.W;
      
      // Check if part fits on sheet (even with rotation if allowed)
      const canRotate = part.allow_rotation !== false;
      const fitsNormal = adjustedL <= usableL && adjustedW <= usableW;
      const fitsRotated = canRotate && adjustedW <= usableL && adjustedL <= usableW;
      
      if (!fitsNormal && !fitsRotated) {
        oversizedParts++;
        continue; // Skip oversized parts from packing
      }
      
      packingParts.push({
        id: `${part.part_id}-${i}`,
        L: adjustedL,
        W: adjustedW,
        originalL: part.size.L,
        originalW: part.size.W,
        area: adjustedL * adjustedW,
        canRotate,
      });
    }
  }

  // Sort parts by area (largest first) for FFD bin packing
  packingParts.sort((a, b) => b.area - a.area);

  // First Fit Decreasing bin packing approximation
  const sheets: { usedArea: number; remainingSpace: ShelfSpace[] }[] = [];
  
  interface ShelfSpace {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  // Simple shelf-based packing algorithm
  for (const part of packingParts) {
    let placed = false;
    
    // Try to fit in existing sheets
    for (const sheet of sheets) {
      // Try each remaining space
      for (let i = 0; i < sheet.remainingSpace.length; i++) {
        const space = sheet.remainingSpace[i];
        
        // Try normal orientation
        if (part.L <= space.w && part.W <= space.h) {
          // Place part, split remaining space
          sheet.usedArea += part.area;
          
          // Create new spaces from the remaining area
          const newSpaces: ShelfSpace[] = [];
          
          // Right remainder
          if (space.w - part.L > kerfWidth) {
            newSpaces.push({
              x: space.x + part.L,
              y: space.y,
              w: space.w - part.L,
              h: space.h,
            });
          }
          
          // Top remainder
          if (space.h - part.W > kerfWidth) {
            newSpaces.push({
              x: space.x,
              y: space.y + part.W,
              w: part.L,
              h: space.h - part.W,
            });
          }
          
          // Remove used space, add new spaces
          sheet.remainingSpace.splice(i, 1, ...newSpaces);
          placed = true;
          break;
        }
        
        // Try rotated orientation (if allowed)
        if (part.canRotate && part.W <= space.w && part.L <= space.h) {
          sheet.usedArea += part.area;
          
          const newSpaces: ShelfSpace[] = [];
          
          if (space.w - part.W > kerfWidth) {
            newSpaces.push({
              x: space.x + part.W,
              y: space.y,
              w: space.w - part.W,
              h: space.h,
            });
          }
          
          if (space.h - part.L > kerfWidth) {
            newSpaces.push({
              x: space.x,
              y: space.y + part.L,
              w: part.W,
              h: space.h - part.L,
            });
          }
          
          sheet.remainingSpace.splice(i, 1, ...newSpaces);
          placed = true;
          break;
        }
      }
      
      if (placed) break;
    }
    
    // Need a new sheet
    if (!placed) {
      const newSheet = {
        usedArea: part.area,
        remainingSpace: [] as ShelfSpace[],
      };
      
      // Initial placement at origin, create remaining spaces
      const newSpaces: ShelfSpace[] = [];
      
      // Try normal orientation first
      let placedL = part.L;
      let placedW = part.W;
      
      // If doesn't fit normally but can rotate, try rotated
      if (placedL > usableL || placedW > usableW) {
        if (part.canRotate) {
          placedL = part.W;
          placedW = part.L;
        }
      }
      
      if (usableL - placedL > kerfWidth) {
        newSpaces.push({
          x: placedL,
          y: 0,
          w: usableL - placedL,
          h: usableW,
        });
      }
      
      if (usableW - placedW > kerfWidth) {
        newSpaces.push({
          x: 0,
          y: placedW,
          w: placedL,
          h: usableW - placedW,
        });
      }
      
      newSheet.remainingSpace = newSpaces;
      sheets.push(newSheet);
    }
  }

  const estimatedSheets = Math.max(sheets.length, oversizedParts > 0 ? 1 : 0);
  const totalSheetArea = estimatedSheets * fullSheetArea;
  const kerfAdjustedArea = packingParts.reduce((sum, p) => sum + p.area, 0);
  const wasteArea = totalSheetArea - totalOriginalArea;
  
  // Efficiency based on original part area vs total sheet area used
  const estimatedEfficiency = totalSheetArea > 0 
    ? totalOriginalArea / totalSheetArea 
    : 0;
  
  const avgPartsPerSheet = estimatedSheets > 0 
    ? packingParts.length / estimatedSheets 
    : 0;

  return {
    estimatedSheets,
    estimatedEfficiency,
    kerfAdjustedArea,
    totalSheetArea,
    wasteArea,
    kerfWidth,
    avgPartsPerSheet,
    sheetSize,
    oversizedParts,
  };
}

/**
 * Calculate sheet estimates for parts grouped by material
 */
export function calculateSheetEstimatesByMaterial(
  parts: CutPart[],
  materials: MaterialDef[] = [],
  kerfWidth: number = DEFAULT_KERF_WIDTH
): Map<string, SheetEstimate> {
  const estimates = new Map<string, SheetEstimate>();
  
  // Group parts by material
  const partsByMaterial = new Map<string, CutPart[]>();
  
  for (const part of parts) {
    const materialId = part.material_id;
    if (!partsByMaterial.has(materialId)) {
      partsByMaterial.set(materialId, []);
    }
    partsByMaterial.get(materialId)!.push(part);
  }
  
  // Calculate estimate for each material
  for (const [materialId, materialParts] of partsByMaterial) {
    const materialDef = materials.find(m => m.material_id === materialId);
    const sheetSize = materialDef?.default_sheet?.size || DEFAULT_SHEET_SIZE;
    
    const estimate = calculateSheetEstimate(materialParts, sheetSize, kerfWidth);
    estimates.set(materialId, estimate);
  }
  
  return estimates;
}

/**
 * Format efficiency as percentage
 */
export function formatEfficiency(efficiency: number): string {
  return `${(efficiency * 100).toFixed(1)}%`;
}

/**
 * Get efficiency color class based on value
 */
export function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 0.85) return "text-green-600 dark:text-green-400";
  if (efficiency >= 0.70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

