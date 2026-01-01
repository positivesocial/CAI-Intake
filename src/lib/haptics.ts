/**
 * CAI Intake - Haptic Feedback Utility
 * 
 * Provides native-like haptic feedback for touch interactions.
 * Uses the Vibration API on supported devices.
 */

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

// Vibration patterns in milliseconds
const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
  selection: 5,
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof window !== "undefined" && "vibrate" in navigator;
}

/**
 * Trigger haptic feedback
 */
export function haptic(pattern: HapticPattern = "light"): void {
  if (!isHapticSupported()) return;
  
  try {
    const vibrationPattern = HAPTIC_PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
  } catch {
    // Silently fail - haptics are non-critical
  }
}

/**
 * Trigger haptic feedback on tap (for button clicks, etc.)
 */
export function hapticTap(): void {
  haptic("light");
}

/**
 * Trigger haptic feedback for selection changes
 */
export function hapticSelection(): void {
  haptic("selection");
}

/**
 * Trigger haptic feedback for success actions
 */
export function hapticSuccess(): void {
  haptic("success");
}

/**
 * Trigger haptic feedback for warnings
 */
export function hapticWarning(): void {
  haptic("warning");
}

/**
 * Trigger haptic feedback for errors
 */
export function hapticError(): void {
  haptic("error");
}

/**
 * Trigger haptic feedback for important actions
 */
export function hapticImpact(intensity: "light" | "medium" | "heavy" = "medium"): void {
  haptic(intensity);
}

/**
 * Hook to use haptics in React components
 */
export function useHaptics() {
  return {
    tap: hapticTap,
    selection: hapticSelection,
    success: hapticSuccess,
    warning: hapticWarning,
    error: hapticError,
    impact: hapticImpact,
    isSupported: isHapticSupported(),
  };
}

// Export for global access
export const Haptics = {
  tap: hapticTap,
  selection: hapticSelection,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  impact: hapticImpact,
  isSupported: isHapticSupported,
};

