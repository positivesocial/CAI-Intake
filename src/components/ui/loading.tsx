"use client";

/**
 * CAI Intake - Loading Components
 * 
 * Animated loading states for a polished native feel.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ============================================================================
// SPINNER
// ============================================================================

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <Loader2 
      className={cn(
        "animate-spin text-[var(--accent)]",
        spinnerSizes[size],
        className
      )} 
    />
  );
}

// ============================================================================
// LOADING DOTS
// ============================================================================

interface LoadingDotsProps {
  className?: string;
  dotClassName?: string;
}

export function LoadingDots({ className, dotClassName }: LoadingDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full bg-[var(--accent)]",
            dotClassName
          )}
          animate={{
            y: [0, -8, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// PULSE LOADER
// ============================================================================

interface PulseLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const pulseSizes = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function PulseLoader({ className, size = "md" }: PulseLoaderProps) {
  return (
    <motion.div
      className={cn(
        "rounded-full bg-[var(--accent)]",
        pulseSizes[size],
        className
      )}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.6, 1, 0.6],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// ============================================================================
// RING LOADER
// ============================================================================

interface RingLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const ringSizes = {
  sm: { size: 24, stroke: 2 },
  md: { size: 40, stroke: 3 },
  lg: { size: 56, stroke: 4 },
};

export function RingLoader({ className, size = "md" }: RingLoaderProps) {
  const { size: s, stroke } = ringSizes[size];
  const radius = (s - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  
  return (
    <svg
      className={cn("text-[var(--accent)]", className)}
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
    >
      {/* Background ring */}
      <circle
        cx={s / 2}
        cy={s / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.2}
      />
      {/* Animated ring */}
      <motion.circle
        cx={s / 2}
        cy={s / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.75}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  );
}

// ============================================================================
// BAR LOADER
// ============================================================================

interface BarLoaderProps {
  className?: string;
}

export function BarLoader({ className }: BarLoaderProps) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-[var(--muted)]", className)}>
      <motion.div
        className="h-full w-1/3 rounded-full bg-[var(--accent)]"
        animate={{
          x: ["-100%", "400%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

interface SkeletonProps {
  className?: string;
  animated?: boolean;
}

export function Skeleton({ className, animated = true }: SkeletonProps) {
  if (!animated) {
    return (
      <div className={cn("rounded bg-[var(--muted)]", className)} />
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded bg-[var(--muted)]", className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

// ============================================================================
// SKELETON PATTERNS
// ============================================================================

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-[var(--border)] overflow-hidden", className)}>
      {/* Header */}
      <div className="flex gap-4 p-4 bg-[var(--muted)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-t border-[var(--border)]">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// FULL PAGE LOADER
// ============================================================================

interface FullPageLoaderProps {
  message?: string;
  className?: string;
}

export function FullPageLoader({ message = "Loading...", className }: FullPageLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)]",
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        <RingLoader size="lg" />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-[var(--muted-foreground)]"
        >
          {message}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  blur?: boolean;
}

export function LoadingOverlay({ show, message, blur = true }: LoadingOverlayProps) {
  const { AnimatePresence } = require("framer-motion");
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--background)]/80",
            blur && "backdrop-blur-sm"
          )}
        >
          <Spinner size="lg" />
          {message && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-sm text-[var(--muted-foreground)]"
            >
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// PROGRESS LOADER
// ============================================================================

interface ProgressLoaderProps {
  value: number; // 0-100
  className?: string;
  showPercentage?: boolean;
}

export function ProgressLoader({ value, className, showPercentage = false }: ProgressLoaderProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className={cn("w-full", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <motion.div
          className="h-full rounded-full bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      {showPercentage && (
        <motion.p 
          className="mt-1 text-xs text-[var(--muted-foreground)] text-center"
          key={Math.round(clampedValue)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {Math.round(clampedValue)}%
        </motion.p>
      )}
    </div>
  );
}

