/**
 * CAI Intake - CAI 2D Optimizer Client
 * 
 * Client for integrating with the CAI 2D panel optimization service.
 * API Documentation: https://cai-2d.app/api
 * 
 * API Version: 1.5.0
 * 
 * Features:
 * - Synchronous optimization (no webhooks needed)
 * - Multiple algorithms: guillotine, best, hybrid, optimal, maxrects
 * - Part clustering for operator-friendly layouts
 * - SVG layout generation
 * - PDF, labels, and BOM export
 * - CNC operations and hole drilling support
 */

import { logger } from "../logger";
import type { CutPart, MaterialDef } from "../schema";

// ============================================================
// CAI 2D API TYPES (Official Schema v1.5.0)
// ============================================================

/** Size object with Length and Width */
export interface Size {
  L: number;
  W: number;
}

/** Customer and project information */
export interface CustomerInfo {
  customer_name?: string;
  customer_contact?: string;
  customer_reference?: string;
  delivery_address?: string;
  project_name?: string;
  due_date?: string;
  notes?: string;
}

/** Material/board definition */
export interface Material {
  material_id: string;
  name: string;
  thickness: number;
  sheet_size: Size;
  cost?: MaterialCost;
}

/** Material cost information */
export interface MaterialCost {
  cost_per_unit: number;
  unit: "sheet" | "sqm";
  currency?: string;
  cutting_cost_per_unit?: number;
  cutting_unit?: "sheet" | "sqm" | "cut" | "meter";
  packaging_cost_per_unit?: number;
  packaging_unit?: "sheet" | "sqm" | "part";
}

/** Sheet inventory item */
export interface SheetInventory {
  sheet_id: string;
  material_id: string;
  size: Size;
  quantity: number;
  grained?: boolean;
}

/** Edgeband inventory item */
export interface EdgebandInventory {
  id: string;
  name: string;
  thickness_mm: number;
  width_mm: number;
  color?: string;
  cost_per_meter?: number;
  application_cost_per_meter?: number;
  overhang_mm?: number;
  waste_factor_pct?: number;
  currency?: string;
}

/** Edge specification for edgebanding */
export interface EdgeSpec {
  L1?: boolean;
  L2?: boolean;
  W1?: boolean;
  W2?: boolean;
}

/** Groove/dado specification */
export interface GrooveSpec {
  kind: "dado" | "rabbet" | "slot" | "custom";
  side: "L1" | "L2" | "W1" | "W2" | "face" | "back";
  depth_mm: number;
  width_mm: number;
  offset_mm: number;
}

/** CNC operation specification */
export interface CNCOperation {
  type: "pocket" | "profile" | "engraving" | "drilling" | "routing" | "custom";
  description?: string;
  time_minutes?: number;
  tool_diameter_mm?: number;
  depth_mm?: number;
  notes?: string;
}

/** Hole drilling specification */
export interface HoleDrilling {
  diameter_mm: number;
  depth_mm?: number;
  count: number;
  pattern?: "line" | "grid" | "custom";
  notes?: string;
}

/** Part operations (edging, grooves, CNC, drilling, notes) */
export interface PartOperations {
  edging?: {
    band_thickness_mm?: number;
    band_material_id?: string;
    edges: EdgeSpec;
  };
  grooves?: GrooveSpec[];
  cnc_operations?: CNCOperation[];
  hole_drilling?: HoleDrilling[];
  notes?: string;
}

/** Part to be cut */
export interface Part {
  part_id: string;
  label?: string;
  material_id: string;
  size: Size;
  qty: number;
  allow_rotation?: boolean;
  grained?: boolean;
  ops?: PartOperations;
  group?: string;
}

/** Trim margin settings */
export interface TrimMargin {
  L1?: number;
  L2?: number;
  W1?: number;
  W2?: number;
}

/** Panel saw settings */
export interface PanelSawSettings {
  workflow?: "rip_first" | "crosscut_first" | "auto";
  guillotine_mode?: "strip_shelf" | "tree";
  strip_grouping?: "strict" | "relaxed";
}

/** Machine settings (REQUIRED) */
export interface MachineSettings {
  type: "panel_saw" | "cnc";
  profile_id: string;
  kerf: number;
  trim_margin: TrimMargin;
  part_gap?: number;
  allow_rotation_default?: boolean;
  min_offcut_L?: number;
  min_offcut_W?: number;
  panel_saw?: PanelSawSettings;
}

/** Optimization objective settings (REQUIRED) */
export interface ObjectiveSettings {
  primary: "min_sheets";
  secondary: string[];
  weights: {
    sheets: number;
    waste_area: number;
    clustering?: number;
  };
}

/** Complete job definition */
export interface Job {
  job_id: string;
  job_name?: string;
  org_id: string;      // REQUIRED
  user_id: string;     // REQUIRED
  units?: "mm" | "in";
  customer?: CustomerInfo;
  materials: Material[];
  sheet_inventory: SheetInventory[];
  edgeband_inventory?: EdgebandInventory[];
  parts: Part[];
  machine: MachineSettings;     // REQUIRED
  objective: ObjectiveSettings; // REQUIRED
}

/** Run configuration */
export interface RunConfig {
  mode?: "guillotine" | "best" | "hybrid" | "optimal" | "maxrects";
  search?: "none" | "beam";
  runs?: number;
  seed?: number | null;
  groupingEnabled?: boolean;
  groupField?: string;
}

/** Render options */
export interface RenderOptions {
  svg?: boolean;
  showLabels?: boolean;
  showCutNumbers?: boolean;
  showFreeRects?: boolean;
  showEdgeDimensions?: boolean;
}

/** Complete optimization request */
export interface OptimizeRequest {
  job: Job;
  run?: RunConfig;
  render?: RenderOptions;
}

/** Part placement in a sheet */
export interface Placement {
  part_id: string;
  instance_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

/** Sheet layout result */
export interface Sheet {
  sheet_no: number;
  sheet_id: string;
  material_id: string;
  size: Size;
  usable_rect: { x: number; y: number; w: number; h: number };
  placements: Placement[];
  efficiency: number;
}

/** Optimization summary statistics */
export interface Summary {
  sheets_used: number;
  utilization_pct: number;
  waste_area: number;
  total_edgeband_length_mm?: number;
  total_groove_length_mm?: number;
  total_cut_length_mm?: number;
  parts_with_notes?: number;
  clustering_pct?: number; // New in v1.5.0 - how well similar parts are grouped (0-100%)
}

/** Cut plan step */
export interface CutStep {
  type: "rip" | "crosscut";
  label: string;
  position: number;
  length: number;
  creates: string[];
}

/** Cut plan for a sheet */
export interface CutPlan {
  sheet_no: number;
  sheet_id: string;
  material_id: string;
  plan: {
    steps: CutStep[];
  };
}

/** SVG output */
export interface SvgOutput {
  filename: string;
  svg: string;
}

/** Algorithm comparison result */
export interface AlgorithmComparison {
  algorithm: string;
  sheets_used: number;
  utilization_pct: number;
  score: number;
}

/** Beam search info (updated for v1.5.0) */
export interface BeamInfo {
  mode?: string;
  algorithmUsed?: string;                    // Which algorithm was selected (in "best" mode)
  algorithmsCompared?: AlgorithmComparison[]; // All algorithms tested with scores
  runs?: number;
  strategies?: string[];
  bestWorkflow?: string;
  workflowBreakdown?: Record<string, number>;
}

/** Validation error */
export interface ValidationError {
  path: string;
  message: string;
}

/** Optimization result */
export interface OptimizeResult {
  ok: boolean;
  mode?: string;
  search?: string;
  workflow?: string;
  timing_ms?: number;
  result?: {
    job_id: string;
    status: "ok" | "error";
    sheets: Sheet[];
    summary: Summary;
  };
  cutplans?: CutPlan[];  // Only returned when guillotine-based algorithm wins
  beam?: BeamInfo;
  svgs?: SvgOutput[];
  error?: string;
  errors?: ValidationError[];
}

/** Health check response */
export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  version: string;
  uptime: {
    seconds: number;
    formatted: string;
    started_at: string;
  };
  memory?: {
    heap_used_mb: number;
    heap_total_mb: number;
    rss_mb: number;
    usage_percent: number;
  };
  algorithms: {
    best?: { enabled: boolean; modes: string[]; description: string };
    maxrects: { enabled: boolean; modes: string[]; description: string };
    guillotine: { enabled: boolean; modes: string[]; description: string };
  };
  features: Record<string, boolean>;
  rate_limits: Record<string, { limit: number; window: string }>;
  endpoints?: Record<string, { method: string; path: string; description: string }>;
  environment?: {
    node_version: string;
    platform: string;
    arch: string;
  };
}

/** Import response */
export interface ImportResponse {
  success: boolean;
  detectedFormat: string;
  job?: Job;
  summary?: {
    partsCount: number;
    totalPieces: number;
    materialsCount: number;
    sheetsCount?: number;
  };
  shareableUrl?: string;
  warnings?: string[];
  errors?: string[];
}

/** Encode response */
export interface EncodeResponse {
  success: boolean;
  detectedFormat: string;
  encoded: string;
  urlFormat: {
    baseUrl: string;
    queryParam: string;
    encoded: string;
  };
  shareableUrl: string;
  size: {
    jsonBytes: number;
    compressedBytes: number;
    urlLength: number;
    compressionRatio: string;
    status: "ok" | "warning" | "danger" | "too_large";
    message: string;
  };
  summary: {
    partsCount: number;
    totalPieces: number;
    materialsCount: number;
  };
}

/** Session response */
export interface SessionResponse {
  success: boolean;
  detectedFormat?: string;
  token: string;
  sessionUrl: string;
  expiresAt: string;
  expiresIn: string;
  maxAccess: number;
  summary?: {
    partsCount: number;
    totalPieces: number;
    materialsCount: number;
    sheetsCount?: number;
  };
  usage: {
    url: string;
    apiRetrieve: string;
    note: string;
  };
}

/** Costing config for BOM export */
export interface CostingConfig {
  currency?: string;
  labor_rates?: {
    cutting?: { rate: number; unit: string };
    edgebanding?: { rate: number; unit: string };
    packaging?: { rate: number; unit: string };
  };
  operation_rates?: {
    grooving?: { rate: number; unit: string };
    cnc?: { rate: number; unit: string };
    hole_drilling?: { rate: number; unit: string };
  };
  markup_percent?: number;
  tax_percent?: number;
}

/** BOM export request */
export interface BOMExportRequest {
  job: Job;
  result: OptimizeResult["result"];
  costingConfig?: CostingConfig;
}

/** Label options */
export interface LabelOptions {
  includeJobName?: boolean;
  includePartNumber?: boolean;
  includeDimensions?: boolean;
  includeMaterial?: boolean;
  includeThickness?: boolean;
  includeOps?: boolean;
  includeNotes?: boolean;
  includeQuantityIndex?: boolean;
  includeQrCode?: boolean;
  includeBranding?: boolean;
  copiesMode?: "quantity" | "single";
  sortBy?: "part_number" | "material" | "size";
}

/** Custom label format */
export interface CustomLabelFormat {
  id: string;
  name: string;
  pageWidth: number;
  pageHeight: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gapHorizontal: number;
  gapVertical: number;
}

// ============================================================
// LEGACY TYPES (for backwards compatibility)
// ============================================================

/** @deprecated Use Part instead */
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
  edgebanding?: EdgeSpec;
}

/** @deprecated Use SheetInventory instead */
export interface StockSheet {
  id?: string;
  length: number;
  width: number;
  quantity: number;
  cost?: number;
  material?: string;
  thickness?: number;
}

/** @deprecated Use MachineSettings instead */
export interface OptimizeSettings {
  kerf?: number;
  edgeTrim?: number;
  allowGrainRotation?: boolean;
  strategy?: "minimize_waste" | "minimize_sheets" | "minimize_cuts";
  maxSheets?: number;
  timeout?: number;
  includeLabels?: boolean;
  groupByMaterial?: boolean;
}

/** Legacy nesting layout for mock optimizer */
export interface NestingLayout {
  sheetIndex: number;
  stockId?: string;
  stockLength: number;
  stockWidth: number;
  parts: Array<{
    partId: string;
    x: number;
    y: number;
    length: number;
    width: number;
    rotated: boolean;
    label?: string;
  }>;
  cuts: Array<{
    type: "horizontal" | "vertical";
    start: { x: number; y: number };
    end: { x: number; y: number };
    length: number;
  }>;
  usedArea: number;
  wasteArea: number;
  efficiency: number;
}

/** Legacy cut path */
export interface CutPath {
  type: "horizontal" | "vertical";
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
}

/** Legacy placed part */
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

// ============================================================
// CLIENT
// ============================================================

export class CAI2DClient {
  private baseUrl: string;
  private apiKey: string | null;
  
  constructor(config: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = config.baseUrl ?? process.env.CAI2D_API_URL ?? "https://cai-2d.app/api";
    this.apiKey = config.apiKey ?? process.env.CAI2D_API_KEY ?? null;
  }
  
  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    
    return headers;
  }
  
  /**
   * Check if the optimizer service is available
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        logger.info("CAI 2D optimizer is available", { baseUrl: this.baseUrl });
      }
      
      return response.ok;
    } catch (error) {
      logger.warn("CAI 2D optimizer ping failed", { 
        baseUrl: this.baseUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
  
  /**
   * Get health and capabilities info
   */
  async getHealth(): Promise<HealthResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
  
  /**
   * Run optimization (synchronous)
   * 
   * NOTE: External API access requires an API key in the x-api-key header.
   */
  async optimize(request: OptimizeRequest): Promise<OptimizeResult> {
    logger.info("Submitting optimization request", { 
      jobId: request.job.job_id,
      partsCount: request.job.parts.length,
      sheetsCount: request.job.sheet_inventory.length,
      mode: request.run?.mode ?? "guillotine",
      hasApiKey: !!this.apiKey,
    });
    
    try {
      const response = await fetch(`${this.baseUrl}/optimize`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      const result: OptimizeResult = await response.json();
      
      if (!response.ok || !result.ok) {
        logger.error("Optimization failed", { 
          status: response.status,
          error: result.error,
          errors: result.errors,
        });
        return result;
      }
      
      logger.info("Optimization completed", { 
        jobId: result.result?.job_id,
        sheetsUsed: result.result?.summary.sheets_used,
        utilization: result.result?.summary.utilization_pct,
        clusteringPct: result.result?.summary.clustering_pct,
        algorithmUsed: result.beam?.algorithmUsed,
        timing: result.timing_ms,
      });
      
      return result;
    } catch (error) {
      logger.error("Optimization request failed", { error });
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }
  
  /**
   * Import cutlist data from external formats
   */
  async import(data: unknown, format?: string): Promise<ImportResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/import`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(format ? { format, data } : data),
      });
      
      return response.json();
    } catch (error) {
      logger.error("Import request failed", { error });
      return {
        success: false,
        detectedFormat: "unknown",
        errors: [error instanceof Error ? error.message : "Network error"],
      };
    }
  }
  
  /**
   * Encode cutlist for URL sharing
   */
  async encode(data: unknown, format?: string): Promise<EncodeResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/import/encode`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(format ? { format, data } : data),
      });
      
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      logger.error("Encode request failed", { error });
      return null;
    }
  }
  
  /**
   * Create a session for large cutlists
   */
  async createSession(data: unknown, format?: string): Promise<SessionResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/import/session`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(format ? { format, data } : data),
      });
      
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      logger.error("Session creation failed", { error });
      return null;
    }
  }
  
  /**
   * Export optimization result as PDF
   */
  async exportPDF(request: OptimizeRequest): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/export/pdf`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        logger.error("PDF export failed", { status: response.status });
        return null;
      }
      
      return response.blob();
    } catch (error) {
      logger.error("PDF export request failed", { error });
      return null;
    }
  }
  
  /**
   * Export Bill of Materials as PDF
   */
  async exportBOM(request: BOMExportRequest): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/export/bom`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        logger.error("BOM export failed", { status: response.status });
        return null;
      }
      
      return response.blob();
    } catch (error) {
      logger.error("BOM export request failed", { error });
      return null;
    }
  }
  
  /**
   * Export part labels as PDF
   */
  async exportLabels(
    request: OptimizeRequest,
    options?: {
      labelFormat?: string;
      customFormat?: CustomLabelFormat;
      labelOptions?: LabelOptions;
    }
  ): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/export/labels`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          ...request,
          labelFormat: options?.labelFormat ?? "avery_5163",
          customFormat: options?.customFormat,
          labelOptions: options?.labelOptions,
        }),
      });
      
      if (!response.ok) {
        logger.error("Labels export failed", { status: response.status });
        return null;
      }
      
      return response.blob();
    } catch (error) {
      logger.error("Labels export request failed", { error });
      return null;
    }
  }
  
  /**
   * Get available label formats
   */
  async getLabelFormats(): Promise<{ formats: Array<{ id: string; name: string; description: string }> } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/export/labels`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
  
  /**
   * Get optimization preview (quick estimate without full solve)
   */
  preview(request: OptimizeRequest): {
    estimatedSheets: number;
    estimatedEfficiency: number;
    estimatedCuts?: number;
  } {
    const parts = request.job.parts;
    const stock = request.job.sheet_inventory[0];
    const kerf = request.job.machine?.kerf ?? 4;
    const trim = request.job.machine?.trim_margin ?? { L1: 5, L2: 5, W1: 5, W2: 5 };
    
    // Calculate usable area
    const usableL = stock.size.L - (trim.L1 ?? 5) - (trim.L2 ?? 5);
    const usableW = stock.size.W - (trim.W1 ?? 5) - (trim.W2 ?? 5);
    const usableArea = usableL * usableW;
    
    // Calculate total part area (including kerf)
    let totalPartArea = 0;
    let totalPieces = 0;
    for (const part of parts) {
      const partArea = (part.size.L + kerf) * (part.size.W + kerf) * part.qty;
      totalPartArea += partArea;
      totalPieces += part.qty;
    }
    
    // Estimate with ~80% efficiency (guillotine typically achieves 75-90%)
    const estimatedSheets = Math.ceil(totalPartArea / (usableArea * 0.80));
    const actualUsedArea = parts.reduce((sum, p) => sum + p.size.L * p.size.W * p.qty, 0);
    const estimatedEfficiency = actualUsedArea / (estimatedSheets * usableArea);
    
    // Rough cut estimate: ~2 cuts per part
    const estimatedCuts = totalPieces * 2;
    
    return {
      estimatedSheets: Math.max(1, estimatedSheets),
      estimatedEfficiency: Math.min(1, estimatedEfficiency),
      estimatedCuts,
    };
  }
  
  /**
   * Generate SVG layout visualization for a sheet
   */
  generateLayoutSVG(
    sheet: Sheet,
    options?: {
      scale?: number;
      showLabels?: boolean;
    }
  ): string {
    const scale = options?.scale ?? 0.1;
    const width = sheet.size.L * scale;
    const height = sheet.size.W * scale;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    
    // Background (stock)
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>`;
    
    // Usable area
    const usable = sheet.usable_rect;
    svg += `<rect x="${usable.x * scale}" y="${usable.y * scale}" width="${usable.w * scale}" height="${usable.h * scale}" fill="none" stroke="#999" stroke-width="0.5" stroke-dasharray="2,2"/>`;
    
    // Parts
    for (const placement of sheet.placements) {
      const x = placement.x * scale;
      const y = placement.y * scale;
      const w = placement.w * scale;
      const h = placement.h * scale;
      
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0D9488" fill-opacity="0.8" stroke="#fff" stroke-width="0.5"/>`;
      
      if (options?.showLabels) {
        const fontSize = Math.min(w, h) * 0.15;
        const label = placement.part_id.split("-")[0]; // Show short ID
        svg += `<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${fontSize}px" font-family="sans-serif">${label}</text>`;
      }
    }
    
    svg += "</svg>";
    return svg;
  }
  
  /**
   * Run mock optimization for demo/offline mode
   */
  mockOptimize(request: OptimizeRequest): OptimizeResult {
    const job = request.job;
    const stock = job.sheet_inventory[0];
    const kerf = job.machine?.kerf ?? 4;
    const trim = job.machine?.trim_margin ?? { L1: 5, L2: 5, W1: 5, W2: 5 };
    
    // Calculate usable area
    const usableX = trim.L1 ?? 5;
    const usableY = trim.W1 ?? 5;
    const usableL = stock.size.L - usableX - (trim.L2 ?? 5);
    const usableW = stock.size.W - usableY - (trim.W2 ?? 5);
    
    // Simple bin-packing simulation
    const sheets: Sheet[] = [];
    const allPlacements: Placement[] = [];
    
    let currentSheet = 0;
    let currentX = usableX;
    let currentY = usableY;
    let rowHeight = 0;
    
    // Expand parts by quantity and sort by height (descending)
    const expandedParts: Array<Part & { instance: number }> = [];
    for (const part of job.parts) {
      for (let i = 0; i < part.qty; i++) {
        expandedParts.push({ ...part, instance: i + 1 });
      }
    }
    expandedParts.sort((a, b) => b.size.W - a.size.W);
    
    for (const part of expandedParts) {
      const partL = part.size.L;
      const partW = part.size.W;
      
      // Try to place in current row
      if (currentX + partL + kerf <= usableX + usableL) {
        allPlacements.push({
          part_id: part.part_id,
          instance_id: `${part.part_id}-${part.instance}`,
          x: currentX,
          y: currentY,
          w: partL,
          h: partW,
          rotated: false,
        });
        
        currentX += partL + kerf;
        rowHeight = Math.max(rowHeight, partW);
      } else {
        // Start new row
        currentX = usableX;
        currentY += rowHeight + kerf;
        rowHeight = 0;
        
        if (currentY + partW + kerf <= usableY + usableW) {
          allPlacements.push({
            part_id: part.part_id,
            instance_id: `${part.part_id}-${part.instance}`,
            x: currentX,
            y: currentY,
            w: partL,
            h: partW,
            rotated: false,
          });
          
          currentX += partL + kerf;
          rowHeight = partW;
        } else {
          // New sheet
          currentSheet++;
          currentX = usableX;
          currentY = usableY;
          rowHeight = partW;
          
          allPlacements.push({
            part_id: part.part_id,
            instance_id: `${part.part_id}-${part.instance}`,
            x: currentX,
            y: currentY,
            w: partL,
            h: partW,
            rotated: false,
          });
          
          currentX += partL + kerf;
        }
      }
    }
    
    // Build sheet results
    const totalSheets = currentSheet + 1;
    const sheetArea = usableL * usableW;
    let totalUsedArea = 0;
    let totalEdgebandLength = 0;
    let totalGrooveLength = 0;
    let partsWithNotes = 0;
    
    for (let i = 0; i < totalSheets; i++) {
      const sheetPlacements = allPlacements.filter((_, idx) => {
        // Determine which sheet this placement belongs to
        let sheet = 0;
        let x = usableX;
        let y = usableY;
        let rh = 0;
        
        for (let j = 0; j <= idx; j++) {
          const p = expandedParts[j];
          if (x + p.size.L + kerf <= usableX + usableL) {
            x += p.size.L + kerf;
            rh = Math.max(rh, p.size.W);
          } else {
            x = usableX;
            y += rh + kerf;
            rh = 0;
            if (y + p.size.W + kerf > usableY + usableW) {
              sheet++;
              y = usableY;
            }
            x += p.size.L + kerf;
            rh = p.size.W;
          }
        }
        return sheet === i;
      });
      
      const usedArea = sheetPlacements.reduce((sum, p) => sum + p.w * p.h, 0);
      totalUsedArea += usedArea;
      
      sheets.push({
        sheet_no: i + 1,
        sheet_id: stock.sheet_id,
        material_id: stock.material_id,
        size: stock.size,
        usable_rect: { x: usableX, y: usableY, w: usableL, h: usableW },
        placements: sheetPlacements,
        efficiency: (usedArea / sheetArea) * 100,
      });
    }
    
    // Calculate edgeband and groove lengths
    for (const part of job.parts) {
      if (part.ops?.edging) {
        const edges = part.ops.edging.edges;
        let edgeLength = 0;
        if (edges.L1) edgeLength += part.size.L;
        if (edges.L2) edgeLength += part.size.L;
        if (edges.W1) edgeLength += part.size.W;
        if (edges.W2) edgeLength += part.size.W;
        totalEdgebandLength += edgeLength * part.qty;
      }
      if (part.ops?.grooves) {
        for (const groove of part.ops.grooves) {
          const grooveLength = groove.side.startsWith("L") ? part.size.L : part.size.W;
          totalGrooveLength += grooveLength * part.qty;
        }
      }
      if (part.ops?.notes) {
        partsWithNotes += part.qty;
      }
    }
    
    const totalPieces = job.parts.reduce((sum, p) => sum + p.qty, 0);
    const wasteArea = (totalSheets * sheetArea) - totalUsedArea;
    
    return {
      ok: true,
      mode: request.run?.mode ?? "guillotine",
      search: request.run?.search ?? "beam",
      workflow: "rip_first",
      timing_ms: 50 + Math.random() * 100,
      result: {
        job_id: job.job_id,
        status: "ok",
        sheets,
        summary: {
          sheets_used: totalSheets,
          utilization_pct: (totalUsedArea / (totalSheets * sheetArea)) * 100,
          waste_area: wasteArea,
          total_edgeband_length_mm: totalEdgebandLength,
          total_groove_length_mm: totalGrooveLength,
          total_cut_length_mm: totalPieces * (usableL + usableW), // Rough estimate
          parts_with_notes: partsWithNotes,
          clustering_pct: 75, // Mock clustering value
        },
      },
      cutplans: sheets.map(sheet => ({
        sheet_no: sheet.sheet_no,
        sheet_id: sheet.sheet_id,
        material_id: sheet.material_id,
        plan: {
          steps: [
            { type: "crosscut", label: "C1", position: 0, length: usableW, creates: ["strip-1"] },
          ],
        },
      })),
      svgs: request.render?.svg ? sheets.map(sheet => ({
        filename: `sheet-${sheet.sheet_no}.svg`,
        svg: this.generateLayoutSVG(sheet, { showLabels: request.render?.showLabels }),
      })) : undefined,
    };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a complete job payload from cutlist data
 */
export function buildJobPayload(params: {
  jobId: string;
  jobName?: string;
  orgId: string;      // REQUIRED
  userId: string;     // REQUIRED
  parts: CutPart[];
  materials?: MaterialDef[];
  customer?: CustomerInfo;
  machineSettings?: Partial<MachineSettings>;
}): Job {
  // Build materials from parts or use provided
  const materialMap = new Map<string, Material>();
  
  if (params.materials) {
    for (const mat of params.materials) {
      materialMap.set(mat.material_id, {
        material_id: mat.material_id,
        name: mat.name,
        thickness: mat.thickness_mm,
        sheet_size: mat.default_sheet?.size ?? { L: 2440, W: 1220 },
      });
    }
  }
  
  // Ensure all parts have their materials
  for (const part of params.parts) {
    if (!materialMap.has(part.material_id)) {
      materialMap.set(part.material_id, {
        material_id: part.material_id,
        name: part.material_id,
        thickness: part.thickness_mm,
        sheet_size: { L: 2440, W: 1220 },
      });
    }
  }
  
  // Build sheet inventory from materials
  const sheetInventory: SheetInventory[] = Array.from(materialMap.values()).map((mat, idx) => ({
    sheet_id: `s${idx + 1}`,
    material_id: mat.material_id,
    size: mat.sheet_size,
    quantity: 999, // Unlimited by default
    grained: false,
  }));
  
  // Convert parts - ensure label is always a string
  const parts: Part[] = params.parts.map((part, idx) => ({
    part_id: part.part_id,
    label: part.label || `Part ${idx + 1}`, // Ensure label is never null/undefined
    material_id: part.material_id,
    size: part.size,
    qty: part.qty,
    allow_rotation: part.allow_rotation ?? true,
    grained: false,
    ops: part.ops ? convertPartOps(part.ops) : undefined,
  }));
  
  // Build machine settings with REQUIRED fields
  const machineSettings: MachineSettings = {
    type: params.machineSettings?.type ?? "panel_saw",
    profile_id: params.machineSettings?.profile_id ?? "default",
    kerf: params.machineSettings?.kerf ?? 4,
    trim_margin: params.machineSettings?.trim_margin ?? { L1: 5, L2: 5, W1: 5, W2: 5 },
    min_offcut_L: params.machineSettings?.min_offcut_L ?? 200,
    min_offcut_W: params.machineSettings?.min_offcut_W ?? 100,
    panel_saw: params.machineSettings?.panel_saw ?? {
      workflow: "auto",
      guillotine_mode: "strip_shelf",
    },
  };
  
  // Build objective settings with REQUIRED fields and proper weights
  const objectiveSettings: ObjectiveSettings = {
    primary: "min_sheets",
    secondary: ["min_waste_area"],
    weights: {
      sheets: 1000000,  // High weight for sheet count (most important)
      waste_area: 1,    // Lower weight for waste
      clustering: 50000, // Part clustering bonus
    },
  };
  
  return {
    job_id: params.jobId,
    job_name: params.jobName,
    org_id: params.orgId,
    user_id: params.userId,
    units: "mm",
    customer: params.customer,
    materials: Array.from(materialMap.values()),
    sheet_inventory: sheetInventory,
    parts,
    machine: machineSettings,
    objective: objectiveSettings,
  };
}

/**
 * Map internal groove kind to CAI 2D API valid values
 */
function mapGrooveKind(kind?: string): "dado" | "rabbet" | "slot" | "custom" {
  switch (kind?.toLowerCase()) {
    case "dado":
    case "shelf_dado":
      return "dado";
    case "backpanel":
    case "rabbet":
      return "rabbet";
    case "slot":
      return "slot";
    default:
      return "custom";
  }
}

/**
 * Convert internal PartOps to CAI 2D API PartOperations format
 */
function convertPartOps(ops: CutPart["ops"]): PartOperations | undefined {
  if (!ops) return undefined;
  
  const result: PartOperations = {};
  
  // Convert edging - internal format uses edges record with EdgebandEdge objects
  if (ops.edging?.edges) {
    const edges: EdgeSpec = {};
    let hasAnyEdge = false;
    let maxThickness = 0;
    
    for (const [edge, config] of Object.entries(ops.edging.edges)) {
      if (edge === "L1" || edge === "L2" || edge === "W1" || edge === "W2") {
        const shouldApply = config?.apply ?? false;
        edges[edge] = shouldApply;
        if (shouldApply) {
          hasAnyEdge = true;
          // Track max thickness from edge configs
          if (config?.thickness_mm && config.thickness_mm > maxThickness) {
            maxThickness = config.thickness_mm;
          }
        }
      }
    }
    
    // Only include edging if at least one edge is applied
    if (hasAnyEdge) {
      result.edging = { 
        band_thickness_mm: maxThickness > 0 ? maxThickness : 0.5, // Use max found or default
        edges 
      };
    }
  }
  
  // Convert grooves - map kind to valid API values
  if (ops.grooves && ops.grooves.length > 0) {
    result.grooves = ops.grooves.map(g => ({
      kind: mapGrooveKind((g as { kind?: string }).kind),
      side: g.side as "L1" | "L2" | "W1" | "W2" | "face" | "back",
      depth_mm: g.depth_mm ?? 8, // Default depth if not specified
      width_mm: g.width_mm ?? 18, // Default width if not specified
      offset_mm: g.offset_mm ?? 0,
    }));
  }
  
  // Convert CNC operations if present
  if ((ops as { cnc_operations?: CNCOperation[] }).cnc_operations) {
    result.cnc_operations = (ops as { cnc_operations: CNCOperation[] }).cnc_operations;
  }
  
  // Convert hole drilling if present
  if ((ops as { hole_drilling?: HoleDrilling[] }).hole_drilling) {
    result.hole_drilling = (ops as { hole_drilling: HoleDrilling[] }).hole_drilling;
  }
  
  // Add notes if present  
  if ((ops as { notes?: string }).notes) {
    result.notes = (ops as { notes?: string }).notes;
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Convert CutPart array to Part array (official schema)
 */
export function cutPartsToApiParts(parts: CutPart[]): Part[] {
  return parts.map((part, idx) => ({
    part_id: part.part_id,
    label: part.label || `Part ${idx + 1}`, // Ensure label is never null
    material_id: part.material_id,
    size: part.size,
    qty: part.qty,
    allow_rotation: part.allow_rotation ?? true,
    grained: false,
    ops: part.ops ? convertPartOps(part.ops) : undefined,
  }));
}

/**
 * @deprecated Use buildJobPayload instead
 * Convert CutPart array to legacy OptimizePart array
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
    canRotate: part.allow_rotation ?? true,
    priority: part.priority,
    edgebanding: part.ops?.edging?.edges as EdgeSpec | undefined,
  }));
}

/**
 * @deprecated Use buildJobPayload instead
 * Convert MaterialDef array to StockSheet array
 */
export function materialsToStockSheets(materials: MaterialDef[]): StockSheet[] {
  return materials.map(material => ({
    id: material.material_id,
    length: material.default_sheet?.size.L ?? 2440,
    width: material.default_sheet?.size.W ?? 1220,
    quantity: 999,
    material: material.name,
    thickness: material.thickness_mm,
  }));
}

/**
 * Submit optimization for a cutlist (convenience function)
 */
export async function submitOptimization(params: {
  jobId?: string;
  jobName?: string;
  orgId: string;     // REQUIRED
  userId: string;    // REQUIRED
  parts: CutPart[] | unknown[];
  materials?: MaterialDef[];
  customer?: CustomerInfo;
  machineSettings?: Partial<MachineSettings>;
  runConfig?: RunConfig;
  renderOptions?: RenderOptions;
  useMock?: boolean;
  apiKey?: string;
}): Promise<OptimizeResult> {
  const client = new CAI2DClient({ apiKey: params.apiKey });
  
  const job = buildJobPayload({
    jobId: params.jobId ?? `job_${Date.now()}`,
    jobName: params.jobName,
    orgId: params.orgId,
    userId: params.userId,
    parts: params.parts as CutPart[],
    materials: params.materials,
    customer: params.customer,
    machineSettings: params.machineSettings,
  });
  
  const request: OptimizeRequest = {
    job,
    run: params.runConfig ?? {
      mode: "guillotine",
      search: "beam",
      runs: 30,
    },
    render: params.renderOptions ?? {
      svg: true,
      showLabels: true,
      showCutNumbers: false,
    },
  };
  
  // Use mock if explicitly requested or if service is unavailable
  if (params.useMock) {
    logger.info("Using mock optimizer (explicitly requested)");
    return client.mockOptimize(request);
  }
  
  // Try real optimizer, fall back to mock
  const isAvailable = await client.ping();
  if (!isAvailable) {
    logger.warn("CAI 2D optimizer unavailable, using mock");
    return client.mockOptimize(request);
  }
  
  return client.optimize(request);
}

// Export singleton client (configure with env vars)
export const cai2dClient = new CAI2DClient();
