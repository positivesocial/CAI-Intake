import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID for parts, documents, etc.
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

/**
 * Format a number with proper decimal places for dimensions
 */
export function formatDimension(value: number, decimals: number = 1): string {
  return value.toFixed(decimals).replace(/\.0+$/, "");
}

/**
 * Convert between units (mm, cm, inch)
 */
export function convertUnit(
  value: number,
  from: "mm" | "cm" | "inch",
  to: "mm" | "cm" | "inch"
): number {
  // Convert to mm first
  let mm: number;
  switch (from) {
    case "mm":
      mm = value;
      break;
    case "cm":
      mm = value * 10;
      break;
    case "inch":
      mm = value * 25.4;
      break;
  }

  // Convert from mm to target
  switch (to) {
    case "mm":
      return mm;
    case "cm":
      return mm / 10;
    case "inch":
      return mm / 25.4;
  }
}

/**
 * Deep clone an object (for immutable operations)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safely parse a number from string input
 */
export function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : parseFloat(value);
  return isNaN(num) ? null : num;
}

