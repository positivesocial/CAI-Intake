/**
 * CAI Intake - Canonical Schema Index
 * 
 * This is the single entry point for all schema definitions.
 * Import from here: import { CutPart, CutlistDocument, ... } from "@/lib/schema"
 */

// Re-export everything from primitives
export * from "./primitives";

// Re-export everything from material
export * from "./material";

// Re-export everything from operations
export * from "./operations";

// Re-export everything from part
export * from "./part";

// Re-export everything from cutlist
export * from "./cutlist";

// Re-export everything from api
export * from "./api";

// Version constant
export { SCHEMA_VERSION } from "../constants";




