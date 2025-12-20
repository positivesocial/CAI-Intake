/**
 * CAI Intake - Optimizer Module
 * 
 * Exports CAI 2D optimizer client and preview functionality.
 */

export {
  CAI2DClient,
  type OptimizeRequest,
  type OptimizeResult,
  type NestingLayout,
  type PlacedPart,
  type OptimizeSettings,
} from "./cai2d-client";

export {
  calculateOptimizationStats,
  calculateMaterialUsage,
  calculateWaste,
  type OptimizationStats,
  type MaterialUsage,
} from "./stats";

