"use client";

/**
 * CAI Intake - Motion Components
 * 
 * Provides smooth animations and transitions for a native-like feel.
 * Uses Framer Motion for fluid, physics-based animations.
 */

import * as React from "react";
import { motion, AnimatePresence, type Variants, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

export const springBounce: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
};

export const easeOutExpo: Transition = {
  ease: [0.16, 1, 0.3, 1],
  duration: 0.4,
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeInScale: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: "100%" },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: "100%" },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: "-100%" },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: "-100%" },
};

export const slideInUp: Variants = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: "100%" },
};

export const modalBounce: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: springBounce,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const sheetSlideUp: Variants = {
  initial: { y: "100%", opacity: 0.8 },
  animate: { 
    y: 0, 
    opacity: 1,
    transition: springGentle,
  },
  exit: { 
    y: "100%", 
    opacity: 0.8,
    transition: { duration: 0.2 },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ============================================================================
// MOTION COMPONENTS
// ============================================================================

/**
 * Animated container with fade-in effect
 */
export function FadeIn({ 
  children, 
  className,
  delay = 0,
  duration = 0.3,
}: { 
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated container with fade-in-up effect
 */
export function FadeInUp({ 
  children, 
  className,
  delay = 0,
  distance = 20,
}: { 
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...springGentle }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated container with scale effect
 */
export function ScaleIn({ 
  children, 
  className,
  delay = 0,
}: { 
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, ...springBounce }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered children animation container
 */
export function StaggerContainer({ 
  children, 
  className,
  staggerDelay = 0.05,
}: { 
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Child item for stagger animations
 */
export function StaggerItem({ 
  children, 
  className,
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      transition={springGentle}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Tap-scale animation wrapper
 */
export function TapScale({ 
  children, 
  className,
  scale = 0.97,
}: { 
  children: React.ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <motion.div
      whileTap={{ scale }}
      transition={springSnappy}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Page transition wrapper
 */
export function PageTransition({ 
  children, 
  className,
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={easeOutExpo}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Modal/dialog animation wrapper
 */
export function ModalMotion({ 
  children, 
  className,
  isOpen,
}: { 
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={modalBounce}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Sheet/drawer animation wrapper
 */
export function SheetMotion({ 
  children, 
  className,
  isOpen,
  direction = "bottom",
}: { 
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  direction?: "bottom" | "top" | "left" | "right";
}) {
  const variants: Variants = {
    initial: {
      opacity: 0.8,
      ...(direction === "bottom" && { y: "100%" }),
      ...(direction === "top" && { y: "-100%" }),
      ...(direction === "left" && { x: "-100%" }),
      ...(direction === "right" && { x: "100%" }),
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: springGentle,
    },
    exit: {
      opacity: 0.8,
      ...(direction === "bottom" && { y: "100%" }),
      ...(direction === "top" && { y: "-100%" }),
      ...(direction === "left" && { x: "-100%" }),
      ...(direction === "right" && { x: "100%" }),
      transition: { duration: 0.2 },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Presence wrapper for conditional rendering with animations
 */
export function Presence({ 
  children, 
  show,
  variants = fadeInScale,
  className,
}: { 
  children: React.ReactNode; 
  show: boolean;
  variants?: Variants;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={springGentle}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Loading pulse animation
 */
export function LoadingPulse({ 
  className,
  size = "md",
}: { 
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <motion.div
      className={cn(
        "rounded-full bg-[var(--accent)]",
        sizeClasses[size],
        className
      )}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.7, 1, 0.7],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/**
 * Skeleton loading with shimmer effect
 */
export function SkeletonShimmer({ 
  className,
}: { 
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "bg-[var(--muted)] rounded overflow-hidden relative",
        className
      )}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </motion.div>
  );
}

/**
 * Spinning loader (motion-based)
 */
export function SpinnerMotion({ 
  className,
  size = "md",
}: { 
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-3",
  };

  return (
    <motion.div
      className={cn(
        "rounded-full border-[var(--accent)] border-t-transparent",
        sizeClasses[size],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

/**
 * Dots loading animation (motion-based)
 */
export function DotsLoader({ 
  className,
}: { 
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-[var(--accent)]"
          animate={{
            y: [0, -6, 0],
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

/**
 * Progress bar with motion
 */
export function ProgressMotion({ 
  value,
  className,
}: { 
  value: number; // 0-100
  className?: string;
}) {
  return (
    <div className={cn("h-2 w-full bg-[var(--muted)] rounded-full overflow-hidden", className)}>
      <motion.div
        className="h-full bg-[var(--accent)] rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={springGentle}
      />
    </div>
  );
}

/**
 * Number counter animation
 */
export function CountUp({ 
  value,
  duration = 1,
  className,
}: { 
  value: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      setDisplayValue(Math.round(startValue + diff * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <span className={className}>{displayValue.toLocaleString()}</span>;
}

// Re-export motion and AnimatePresence for direct usage
export { motion, AnimatePresence };

