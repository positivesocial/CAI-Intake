/**
 * CAI Intake - Optimizer Module
 * 
 * Client for CAI 2D panel optimization service.
 * API: https://cai-2d.app/api
 */

// Main client and types
export {
  CAI2DClient,
  cai2dClient,
  submitOptimization,
  buildJobPayload,
  cutPartsToApiParts,
  // Official API types
  type OptimizeRequest,
  type OptimizeResult,
  type Job,
  type Part,
  type Material,
  type SheetInventory,
  type Sheet,
  type Placement,
  type Summary,
  type CutPlan,
  type CutStep,
  type RunConfig,
  type RenderOptions,
  type CustomerInfo,
  type MachineSettings,
  type PartOperations,
  type EdgeSpec,
  type GrooveSpec,
  type HealthResponse,
  // Legacy types (deprecated)
  type OptimizePart,
  type StockSheet,
  type OptimizeSettings,
  type NestingLayout,
  type PlacedPart,
  type CutPath,
  // Legacy helpers (deprecated)
  cutPartsToOptimizeParts,
  materialsToStockSheets,
} from "./cai2d-client";

export {
  calculateOptimizationStats,
  calculateMaterialUsage,
  calculateWaste,
  type OptimizationStats,
  type MaterialUsage,
} from "./stats";





