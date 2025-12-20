/**
 * CAI Intake - CAI 2D Optimizer Client
 * 
 * Client for integrating with the CAI 2D panel optimization service.
 */

// ============================================================
// TYPES
// ============================================================

export interface OptimizePart {
  id: string;
  name?: string;
  length: number;
  width: number;
  quantity: number;
  material: string;
  thickness: number;
  grain?: "none" | "along_L" | "along_W";
  canRotate: boolean;
  priority?: number;
}

export interface StockSheet {
  length: number;
  width: number;
  quantity: number;
  cost?: number;
}

export interface OptimizeSettings {
  /** Blade kerf width in mm */
  kerf?: number;
  /** Edge trim allowance in mm */
  edgeTrim?: number;
  /** Allow rotating grained parts */
  allowGrainRotation?: boolean;
  /** Optimization strategy */
  strategy?: "minimize_waste" | "minimize_sheets" | "minimize_cuts";
  /** Maximum sheets to use */
  maxSheets?: number;
  /** Timeout in seconds */
  timeout?: number;
}

export interface OptimizeRequest {
  parts: OptimizePart[];
  stock: StockSheet[];
  settings?: OptimizeSettings;
}

export interface PlacedPart {
  partId: string;
  sheetIndex: number;
  x: number;
  y: number;
  length: number;
  width: number;
  rotated: boolean;
}

export interface NestingLayout {
  sheetIndex: number;
  stockLength: number;
  stockWidth: number;
  parts: PlacedPart[];
  usedArea: number;
  wasteArea: number;
  efficiency: number;
}

export interface OptimizeResult {
  success: boolean;
  layouts: NestingLayout[];
  statistics: {
    totalSheets: number;
    totalParts: number;
    totalArea: number;
    usedArea: number;
    wasteArea: number;
    overallEfficiency: number;
    totalCost?: number;
  };
  unplacedParts: string[];
  errors?: string[];
  computeTime?: number;
}

// ============================================================
// CLIENT
// ============================================================

export class CAI2DClient {
  private baseUrl: string;
  private apiKey?: string;
  
  constructor(config: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = config.baseUrl ?? process.env.CAI2D_API_URL ?? "https://api.cai2d.com";
    this.apiKey = config.apiKey ?? process.env.CAI2D_API_KEY;
  }
  
  /**
   * Optimize a cutlist
   */
  async optimize(request: OptimizeRequest): Promise<OptimizeResult> {
    // For demo/development: return mock result
    if (!this.apiKey) {
      return this.mockOptimize(request);
    }
    
    const response = await fetch(`${this.baseUrl}/v1/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Optimization failed: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get optimization preview (quick estimate without full solve)
   */
  async preview(request: OptimizeRequest): Promise<{
    estimatedSheets: number;
    estimatedEfficiency: number;
    estimatedCost?: number;
  }> {
    // Quick calculation without actual optimization
    const parts = request.parts;
    const stock = request.stock[0] ?? { length: 2800, width: 2070 };
    
    const totalPartArea = parts.reduce(
      (sum, p) => sum + p.length * p.width * p.quantity,
      0
    );
    const sheetArea = stock.length * stock.width;
    
    // Estimate with 75% efficiency
    const estimatedSheets = Math.ceil(totalPartArea / (sheetArea * 0.75));
    const estimatedEfficiency = totalPartArea / (estimatedSheets * sheetArea);
    
    return {
      estimatedSheets,
      estimatedEfficiency,
      estimatedCost: stock.cost ? estimatedSheets * stock.cost : undefined,
    };
  }
  
  /**
   * Mock optimization for demo/development
   */
  private mockOptimize(request: OptimizeRequest): OptimizeResult {
    const stock = request.stock[0] ?? { length: 2800, width: 2070 };
    const kerf = request.settings?.kerf ?? 4;
    
    // Simple bin-packing simulation
    const layouts: NestingLayout[] = [];
    const placedParts: PlacedPart[] = [];
    const unplacedParts: string[] = [];
    
    let currentSheet = 0;
    let currentX = kerf;
    let currentY = kerf;
    let rowHeight = 0;
    
    // Sort parts by height (descending) for better packing
    const sortedParts = [...request.parts]
      .flatMap(p => Array(p.quantity).fill(p))
      .sort((a, b) => b.width - a.width);
    
    for (const part of sortedParts) {
      const partLength = part.length;
      const partWidth = part.width;
      
      // Try to place in current row
      if (currentX + partLength + kerf <= stock.length) {
        // Fits in current row
        placedParts.push({
          partId: part.id,
          sheetIndex: currentSheet,
          x: currentX,
          y: currentY,
          length: partLength,
          width: partWidth,
          rotated: false,
        });
        
        currentX += partLength + kerf;
        rowHeight = Math.max(rowHeight, partWidth);
      } else {
        // Start new row
        currentX = kerf;
        currentY += rowHeight + kerf;
        rowHeight = 0;
        
        if (currentY + partWidth + kerf <= stock.width) {
          // New row on same sheet
          placedParts.push({
            partId: part.id,
            sheetIndex: currentSheet,
            x: currentX,
            y: currentY,
            length: partLength,
            width: partWidth,
            rotated: false,
          });
          
          currentX += partLength + kerf;
          rowHeight = partWidth;
        } else {
          // New sheet
          currentSheet++;
          currentX = kerf;
          currentY = kerf;
          rowHeight = partWidth;
          
          placedParts.push({
            partId: part.id,
            sheetIndex: currentSheet,
            x: currentX,
            y: currentY,
            length: partLength,
            width: partWidth,
            rotated: false,
          });
          
          currentX += partLength + kerf;
        }
      }
    }
    
    // Build layouts
    const totalSheets = currentSheet + 1;
    const sheetArea = stock.length * stock.width;
    
    for (let i = 0; i < totalSheets; i++) {
      const sheetParts = placedParts.filter(p => p.sheetIndex === i);
      const usedArea = sheetParts.reduce((sum, p) => sum + p.length * p.width, 0);
      
      layouts.push({
        sheetIndex: i,
        stockLength: stock.length,
        stockWidth: stock.width,
        parts: sheetParts,
        usedArea,
        wasteArea: sheetArea - usedArea,
        efficiency: usedArea / sheetArea,
      });
    }
    
    const totalUsedArea = layouts.reduce((sum, l) => sum + l.usedArea, 0);
    const totalArea = totalSheets * sheetArea;
    
    return {
      success: true,
      layouts,
      statistics: {
        totalSheets,
        totalParts: request.parts.reduce((sum, p) => sum + p.quantity, 0),
        totalArea,
        usedArea: totalUsedArea,
        wasteArea: totalArea - totalUsedArea,
        overallEfficiency: totalUsedArea / totalArea,
        totalCost: stock.cost ? totalSheets * stock.cost : undefined,
      },
      unplacedParts,
      computeTime: 50,
    };
  }
}

