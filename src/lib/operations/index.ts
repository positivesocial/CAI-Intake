/**
 * CAI Intake - Operations Module
 * 
 * Unified operations system for edgeband, groove, drilling, and CNC operations.
 * Replaces the old shortcode and operations library system.
 */

// Types
export * from "./types";

// Service (CRUD)
export {
  // Operation Types
  getOperationTypes,
  createOperationType,
  updateOperationType,
  deleteOperationType,
  // Edgeband
  getEdgebandOperations,
  findEdgebandByCode,
  createEdgebandOperation,
  updateEdgebandOperation,
  deleteEdgebandOperation,
  incrementEdgebandUsage,
  // Groove
  getGrooveOperations,
  findGrooveByCode,
  createGrooveOperation,
  updateGrooveOperation,
  deleteGrooveOperation,
  incrementGrooveUsage,
  // Drilling
  getDrillingOperations,
  findDrillingByCode,
  createDrillingOperation,
  updateDrillingOperation,
  deleteDrillingOperation,
  incrementDrillingUsage,
  // CNC
  getCncOperations,
  findCncByCode,
  createCncOperation,
  updateCncOperation,
  deleteCncOperation,
  incrementCncUsage,
  // Seeding
  seedSystemDefaults,
} from "./service";

// Resolver (for parsing)
export {
  resolveOperations,
  resolveEdgebanding,
  resolveGroove,
  resolveDrilling,
  resolveCnc,
  resolveOperationsBatch,
} from "./resolver";

// Defaults
export { getSystemDefaults } from "./defaults";
