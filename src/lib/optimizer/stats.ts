/**
 * CAI Intake - Optimization Statistics
 * 
 * Utility functions for calculating optimization statistics.
 */

import type { OptimizeResult, NestingLayout } from "./cai2d-client";

// ============================================================
// TYPES
// ============================================================

export interface OptimizationStats {
  /** Total number of sheets used */
  totalSheets: number;
  /** Total number of parts placed */
  totalParts: number;
  /** Total number of individual pieces */
  totalPieces: number;
  /** Total stock area in mm² */
  totalStockArea: number;
  /** Total used area in mm² */
  totalUsedArea: number;
  /** Total waste area in mm² */
  totalWasteArea: number;
  /** Overall material efficiency (0-1) */
  overallEfficiency: number;
  /** Efficiency per sheet */
  sheetEfficiencies: number[];
  /** Total cost if pricing available */
  totalCost?: number;
  /** Cost per part */
  costPerPart?: number;
}

export interface MaterialUsage {
  materialId: string;
  materialName?: string;
  thickness: number;
  totalParts: number;
  totalPieces: number;
  totalArea: number;
  sheetsRequired: number;
  efficiency: number;
  cost?: number;
}

// ============================================================
// STATISTICS CALCULATION
// ============================================================

/**
 * Calculate comprehensive optimization statistics
 */
export function calculateOptimizationStats(result: OptimizeResult): OptimizationStats {
  const totalStockArea = result.layouts.reduce(
    (sum, layout) => sum + layout.stockLength * layout.stockWidth,
    0
  );
  
  const sheetEfficiencies = result.layouts.map(l => l.efficiency);
  
  return {
    totalSheets: result.statistics.totalSheets,
    totalParts: result.statistics.totalParts,
    totalPieces: result.layouts.reduce((sum, l) => sum + l.parts.length, 0),
    totalStockArea,
    totalUsedArea: result.statistics.usedArea,
    totalWasteArea: result.statistics.wasteArea,
    overallEfficiency: result.statistics.overallEfficiency,
    sheetEfficiencies,
    totalCost: result.statistics.totalCost,
    costPerPart: result.statistics.totalCost && result.statistics.totalParts > 0
      ? result.statistics.totalCost / result.statistics.totalParts
      : undefined,
  };
}

/**
 * Calculate material usage by material type
 */
export function calculateMaterialUsage(
  parts: Array<{
    id: string;
    length: number;
    width: number;
    quantity: number;
    material: string;
    thickness: number;
  }>,
  stockSheets?: Map<string, { length: number; width: number; cost?: number }>
): MaterialUsage[] {
  // Group parts by material
  const byMaterial = new Map<string, typeof parts>();
  
  for (const part of parts) {
    const key = `${part.material}:${part.thickness}`;
    const existing = byMaterial.get(key) ?? [];
    existing.push(part);
    byMaterial.set(key, existing);
  }
  
  // Calculate usage per material
  return Array.from(byMaterial.entries()).map(([key, materialParts]) => {
    const [materialId, thicknessStr] = key.split(":");
    const thickness = parseFloat(thicknessStr);
    
    const totalParts = materialParts.length;
    const totalPieces = materialParts.reduce((sum, p) => sum + p.quantity, 0);
    const totalArea = materialParts.reduce(
      (sum, p) => sum + p.length * p.width * p.quantity,
      0
    );
    
    // Get stock sheet info
    const stock = stockSheets?.get(materialId) ?? { length: 2800, width: 2070 };
    const sheetArea = stock.length * stock.width;
    
    // Estimate sheets needed (assuming 75% efficiency)
    const estimatedEfficiency = 0.75;
    const sheetsRequired = Math.ceil(totalArea / (sheetArea * estimatedEfficiency));
    const actualEfficiency = totalArea / (sheetsRequired * sheetArea);
    
    return {
      materialId,
      thickness,
      totalParts,
      totalPieces,
      totalArea,
      sheetsRequired,
      efficiency: actualEfficiency,
      cost: stock.cost ? sheetsRequired * stock.cost : undefined,
    };
  });
}

/**
 * Calculate waste statistics
 */
export function calculateWaste(result: OptimizeResult): {
  totalWaste: number;
  wastePercentage: number;
  wasteBySheet: Array<{ sheetIndex: number; waste: number; percentage: number }>;
  reusableOffcuts: Array<{ length: number; width: number; sheetIndex: number }>;
} {
  const wasteBySheet = result.layouts.map(layout => ({
    sheetIndex: layout.sheetIndex,
    waste: layout.wasteArea,
    percentage: (layout.wasteArea / (layout.stockLength * layout.stockWidth)) * 100,
  }));
  
  // Identify potentially reusable offcuts (pieces > 200mm in both dimensions)
  const reusableOffcuts: Array<{ length: number; width: number; sheetIndex: number }> = [];
  
  // This is a simplified calculation - actual offcut identification
  // would require analyzing the placed parts geometry
  for (const layout of result.layouts) {
    const wastePercentage = layout.wasteArea / (layout.stockLength * layout.stockWidth);
    
    // If waste is significant, estimate a single large offcut
    if (wastePercentage > 0.2) {
      // Rough estimate of offcut dimensions
      const offcutLength = Math.sqrt(layout.wasteArea);
      const offcutWidth = layout.wasteArea / offcutLength;
      
      if (offcutLength >= 200 && offcutWidth >= 200) {
        reusableOffcuts.push({
          length: Math.round(offcutLength),
          width: Math.round(offcutWidth),
          sheetIndex: layout.sheetIndex,
        });
      }
    }
  }
  
  return {
    totalWaste: result.statistics.wasteArea,
    wastePercentage: (result.statistics.wasteArea / result.statistics.totalArea) * 100,
    wasteBySheet,
    reusableOffcuts,
  };
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

/**
 * Format area in human-readable form
 */
export function formatArea(mm2: number): string {
  if (mm2 >= 1_000_000) {
    return `${(mm2 / 1_000_000).toFixed(2)} m²`;
  }
  return `${mm2.toLocaleString()} mm²`;
}

/**
 * Format efficiency as percentage
 */
export function formatEfficiency(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}




