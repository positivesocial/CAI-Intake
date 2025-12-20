/**
 * CAI Intake - CAI 2D Optimizer Client
 * 
 * Client for integrating with the CAI 2D panel optimization service.
 */

import { logger } from "../logger";
import type { CutPart, MaterialDef } from "../schema";

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
  edgebanding?: {
    L1?: string;
    L2?: string;
    W1?: string;
    W2?: string;
  };
}

export interface StockSheet {
  id?: string;
  length: number;
  width: number;
  quantity: number;
  cost?: number;
  material?: string;
  thickness?: number;
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
  /** Include labels on layout */
  includeLabels?: boolean;
  /** Group parts by material */
  groupByMaterial?: boolean;
}

export interface OptimizeRequest {
  parts: OptimizePart[];
  stock: StockSheet[];
  settings?: OptimizeSettings;
  callbackUrl?: string;
  organizationId?: string;
  cutlistId?: string;
}

export interface PlacedPart {
  partId: string;
  sheetIndex: number;
  x: number;
  y: number;
  length: number;
  width: number;
  rotated: boolean;
  label?: string;
}

export interface CutPath {
  type: "horizontal" | "vertical";
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
}

export interface NestingLayout {
  sheetIndex: number;
  stockId?: string;
  stockLength: number;
  stockWidth: number;
  parts: PlacedPart[];
  cuts: CutPath[];
  usedArea: number;
  wasteArea: number;
  efficiency: number;
  offcuts?: Array<{
    x: number;
    y: number;
    length: number;
    width: number;
    reusable: boolean;
  }>;
}

export interface OptimizeResult {
  success: boolean;
  jobId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  layouts: NestingLayout[];
  statistics: {
    totalSheets: number;
    totalParts: number;
    totalPieces: number;
    totalArea: number;
    usedArea: number;
    wasteArea: number;
    overallEfficiency: number;
    totalCost?: number;
    totalCuts?: number;
    edgebandingLength?: number;
  };
  unplacedParts: string[];
  errors?: string[];
  warnings?: string[];
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
   * Check if the client is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Test connection to the optimizer service
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Optimize a cutlist synchronously
   */
  async optimize(request: OptimizeRequest): Promise<OptimizeResult> {
    // For demo/development: return mock result
    if (!this.apiKey) {
      logger.info("CAI 2D API key not configured, using mock optimizer");
      return this.mockOptimize(request);
    }
    
    logger.info("Submitting optimization request", { 
      partsCount: request.parts.length,
      stockCount: request.stock.length,
    });
    
    const response = await fetch(`${this.baseUrl}/v1/optimize`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error("Optimization failed", { error, status: response.status });
      throw new Error(`Optimization failed: ${error}`);
    }
    
    const result = await response.json();
    logger.info("Optimization completed", { 
      success: result.success,
      sheets: result.statistics?.totalSheets,
      efficiency: result.statistics?.overallEfficiency,
    });
    
    return result;
  }
  
  /**
   * Submit an optimization job asynchronously
   */
  async submitJob(request: OptimizeRequest): Promise<{
    jobId: string;
    status: string;
    estimatedTime?: number;
  }> {
    if (!this.apiKey) {
      // For demo, return a fake job ID and process synchronously
      const result = this.mockOptimize(request);
      return {
        jobId: `mock_${Date.now()}`,
        status: "completed",
        estimatedTime: 0,
      };
    }
    
    const response = await fetch(`${this.baseUrl}/v1/jobs`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...request,
        async: true,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit job: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get the status and result of an optimization job
   */
  async getJob(jobId: string): Promise<OptimizeResult> {
    if (!this.apiKey) {
      return {
        success: true,
        jobId,
        status: "completed",
        layouts: [],
        statistics: {
          totalSheets: 0,
          totalParts: 0,
          totalPieces: 0,
          totalArea: 0,
          usedArea: 0,
          wasteArea: 0,
          overallEfficiency: 0,
        },
        unplacedParts: [],
      };
    }
    
    const response = await fetch(`${this.baseUrl}/v1/jobs/${jobId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get job: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Cancel a pending optimization job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.apiKey) {
      return true;
    }
    
    const response = await fetch(`${this.baseUrl}/v1/jobs/${jobId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    
    return response.ok;
  }
  
  /**
   * Get optimization preview (quick estimate without full solve)
   */
  async preview(request: OptimizeRequest): Promise<{
    estimatedSheets: number;
    estimatedEfficiency: number;
    estimatedCost?: number;
    estimatedCuts?: number;
  }> {
    // Quick calculation without actual optimization
    const parts = request.parts;
    const stock = request.stock[0] ?? { length: 2800, width: 2070 };
    
    const totalPartArea = parts.reduce(
      (sum, p) => sum + p.length * p.width * p.quantity,
      0
    );
    const totalPieces = parts.reduce((sum, p) => sum + p.quantity, 0);
    const sheetArea = stock.length * stock.width;
    
    // Estimate with 75% efficiency
    const estimatedSheets = Math.ceil(totalPartArea / (sheetArea * 0.75));
    const estimatedEfficiency = totalPartArea / (estimatedSheets * sheetArea);
    
    // Rough cut estimate: 2 cuts per part on average
    const estimatedCuts = totalPieces * 2;
    
    return {
      estimatedSheets,
      estimatedEfficiency,
      estimatedCost: stock.cost ? estimatedSheets * stock.cost : undefined,
      estimatedCuts,
    };
  }
  
  /**
   * Generate SVG layout visualization
   */
  generateLayoutSVG(layout: NestingLayout, options?: {
    scale?: number;
    showLabels?: boolean;
    showCuts?: boolean;
  }): string {
    const scale = options?.scale ?? 0.1;
    const width = layout.stockLength * scale;
    const height = layout.stockWidth * scale;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    
    // Background (stock)
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>`;
    
    // Parts
    for (const part of layout.parts) {
      const x = part.x * scale;
      const y = part.y * scale;
      const w = part.length * scale;
      const h = part.width * scale;
      
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0D9488" fill-opacity="0.8" stroke="#fff" stroke-width="0.5"/>`;
      
      if (options?.showLabels && part.label) {
        const fontSize = Math.min(w, h) * 0.15;
        svg += `<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${fontSize}px" font-family="sans-serif">${part.label}</text>`;
      }
    }
    
    // Cuts
    if (options?.showCuts && layout.cuts) {
      for (const cut of layout.cuts) {
        svg += `<line x1="${cut.start.x * scale}" y1="${cut.start.y * scale}" x2="${cut.end.x * scale}" y2="${cut.end.y * scale}" stroke="#ff0000" stroke-width="0.5" stroke-dasharray="2,2"/>`;
      }
    }
    
    svg += "</svg>";
    return svg;
  }
  
  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
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
      .flatMap(p => Array(p.quantity).fill({ ...p }))
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
          label: part.name,
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
            label: part.name,
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
            label: part.name,
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
      
      // Generate simple cut paths
      const cuts: CutPath[] = [];
      for (const part of sheetParts) {
        // Vertical cut before part
        cuts.push({
          type: "vertical",
          start: { x: part.x, y: 0 },
          end: { x: part.x, y: stock.width },
          length: stock.width,
        });
        // Horizontal cut below part
        cuts.push({
          type: "horizontal",
          start: { x: 0, y: part.y + part.width },
          end: { x: stock.length, y: part.y + part.width },
          length: stock.length,
        });
      }
      
      layouts.push({
        sheetIndex: i,
        stockLength: stock.length,
        stockWidth: stock.width,
        parts: sheetParts,
        cuts,
        usedArea,
        wasteArea: sheetArea - usedArea,
        efficiency: usedArea / sheetArea,
      });
    }
    
    const totalUsedArea = layouts.reduce((sum, l) => sum + l.usedArea, 0);
    const totalArea = totalSheets * sheetArea;
    const totalPieces = request.parts.reduce((sum, p) => sum + p.quantity, 0);
    
    // Calculate edgebanding length
    let edgebandingLength = 0;
    for (const part of request.parts) {
      if (part.edgebanding) {
        const perimeter = (part.length + part.width) * 2;
        const edgeCount = Object.values(part.edgebanding).filter(Boolean).length;
        edgebandingLength += (perimeter / 4) * edgeCount * part.quantity;
      }
    }
    
    return {
      success: true,
      jobId: `mock_${Date.now()}`,
      status: "completed",
      layouts,
      statistics: {
        totalSheets,
        totalParts: request.parts.length,
        totalPieces,
        totalArea,
        usedArea: totalUsedArea,
        wasteArea: totalArea - totalUsedArea,
        overallEfficiency: totalUsedArea / totalArea,
        totalCost: stock.cost ? totalSheets * stock.cost : undefined,
        totalCuts: layouts.reduce((sum, l) => sum + l.cuts.length, 0),
        edgebandingLength,
      },
      unplacedParts,
      computeTime: 50 + Math.random() * 100,
    };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Convert CutPart array to OptimizePart array
 */
export function cutPartsToOptimizeParts(parts: CutPart[]): OptimizePart[] {
  return parts.map(part => ({
    id: part.part_id,
    name: part.label,
    length: part.size.L,
    width: part.size.W,
    quantity: part.qty,
    material: part.material_id,
    thickness: part.thickness_mm,
    grain: "none",
    canRotate: part.allow_rotation ?? true,
    priority: part.priority,
    edgebanding: part.ops?.edging?.edges as unknown as Record<string, string> | undefined,
  }));
}

/**
 * Convert MaterialDef array to StockSheet array
 */
export function materialsToStockSheets(materials: MaterialDef[]): StockSheet[] {
  return materials.map(material => ({
    id: material.material_id,
    length: material.default_sheet?.size.L ?? 2800,
    width: material.default_sheet?.size.W ?? 2070,
    quantity: 999, // Unlimited stock by default
    material: material.name,
    thickness: material.thickness_mm,
  }));
}

/**
 * Submit optimization for a cutlist
 */
export async function submitOptimization(params: {
  parts: CutPart[] | unknown[];
  materials?: MaterialDef[];
  options?: OptimizeSettings;
}): Promise<OptimizeResult> {
  const client = new CAI2DClient();
  
  const optimizeParts = cutPartsToOptimizeParts(params.parts as CutPart[]);
  const stockSheets = params.materials 
    ? materialsToStockSheets(params.materials)
    : [{ length: 2800, width: 2070, quantity: 999 }];
  
  return client.optimize({
    parts: optimizeParts,
    stock: stockSheets,
    settings: params.options,
  });
}

// Export singleton client
export const cai2dClient = new CAI2DClient();
