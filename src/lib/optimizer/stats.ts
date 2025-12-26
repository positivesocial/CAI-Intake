/**
 * CAI Intake - Optimization Statistics
 * 
 * Utility functions for calculating optimization statistics.
 * Supports both new API format and legacy format.
 */

import type { OptimizeResult, NestingLayout, Sheet } from "./cai2d-client";

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
 * Calculate comprehensive optimization statistics from API result
 */
export function calculateOptimizationStats(result: OptimizeResult): OptimizationStats {
  // Handle new API format
  if (result.result?.sheets) {
    const sheets = result.result.sheets;
    const summary = result.result.summary;
    
    const totalStockArea = sheets.reduce(
      (sum, sheet) => sum + sheet.size.L * sheet.size.W,
      0
    );
    
    const totalUsedArea = sheets.reduce((sum, sheet) => {
      const used = sheet.placements.reduce((pSum, p) => pSum + p.w * p.h, 0);
      return sum + used;
    }, 0);
    
    const totalPieces = sheets.reduce(
      (sum, sheet) => sum + sheet.placements.length,
      0
    );
    
    return {
      totalSheets: summary.sheets_used,
      totalParts: totalPieces, // In new format, each placement is a piece
      totalPieces,
      totalStockArea,
      totalUsedArea,
      totalWasteArea: summary.waste_area,
      overallEfficiency: summary.utilization_pct / 100,
      sheetEfficiencies: sheets.map(s => s.efficiency / 100),
      totalCost: undefined,
      costPerPart: undefined,
    };
  }
  
  // Legacy format not supported in new implementation
  return {
    totalSheets: 0,
    totalParts: 0,
    totalPieces: 0,
    totalStockArea: 0,
    totalUsedArea: 0,
    totalWasteArea: 0,
    overallEfficiency: 0,
    sheetEfficiencies: [],
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
    const stock = stockSheets?.get(materialId) ?? { length: 2440, width: 1220 };
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
 * Calculate waste statistics from API result
 */
export function calculateWaste(result: OptimizeResult): {
  totalWaste: number;
  wastePercentage: number;
  wasteBySheet: Array<{ sheetIndex: number; waste: number; percentage: number }>;
  reusableOffcuts: Array<{ length: number; width: number; sheetIndex: number }>;
} {
  // Handle new API format
  if (result.result?.sheets) {
    const sheets = result.result.sheets;
    const summary = result.result.summary;
    
    const wasteBySheet = sheets.map((sheet, idx) => {
      const sheetArea = sheet.size.L * sheet.size.W;
      const usedArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
      const waste = sheetArea - usedArea;
      return {
        sheetIndex: idx,
        waste,
        percentage: (waste / sheetArea) * 100,
      };
    });
    
    const totalStockArea = sheets.reduce(
      (sum, sheet) => sum + sheet.size.L * sheet.size.W,
      0
    );
    
    // Identify potentially reusable offcuts
    const reusableOffcuts: Array<{ length: number; width: number; sheetIndex: number }> = [];
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetArea = sheet.size.L * sheet.size.W;
      const usedArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
      const wasteArea = sheetArea - usedArea;
      const wastePercentage = wasteArea / sheetArea;
      
      if (wastePercentage > 0.2) {
        const offcutLength = Math.sqrt(wasteArea);
        const offcutWidth = wasteArea / offcutLength;
        
        if (offcutLength >= 200 && offcutWidth >= 200) {
          reusableOffcuts.push({
            length: Math.round(offcutLength),
            width: Math.round(offcutWidth),
            sheetIndex: i,
          });
        }
      }
    }
    
    return {
      totalWaste: summary.waste_area,
      wastePercentage: (summary.waste_area / totalStockArea) * 100,
      wasteBySheet,
      reusableOffcuts,
    };
  }
  
  // Legacy format not supported
  return {
    totalWaste: 0,
    wastePercentage: 0,
    wasteBySheet: [],
    reusableOffcuts: [],
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
