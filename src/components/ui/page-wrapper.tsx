"use client";

/**
 * CAI Intake - Page Wrapper with Transitions
 * 
 * Provides smooth page transitions and standard page layout.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Disable animations for instant render */
  instant?: boolean;
  /** Custom animation variant */
  variant?: "fade" | "slide" | "scale";
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

export function PageWrapper({ 
  children, 
  className,
  instant = false,
  variant = "slide",
}: PageWrapperProps) {
  if (instant) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants[variant]}
      transition={{
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1], // Expo ease out
      }}
      className={cn("min-h-full", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Section wrapper for staggered content animations
 */
interface SectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function Section({ children, className, delay = 0 }: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/**
 * Card with hover animation
 */
export function AnimatedCard({ 
  children, 
  className, 
  interactive = true,
  delay = 0,
  onClick,
}: { 
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={interactive ? { y: -2, transition: { duration: 0.2 } } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm",
        interactive && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/**
 * List with staggered item animations
 */
interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function AnimatedList({ 
  children, 
  className,
  staggerDelay = 0.05,
}: AnimatedListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
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
 * List item for AnimatedList
 */
export function AnimatedListItem({ 
  children, 
  className,
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1],
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
 * Number that animates when value changes
 */
interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
  formatter?: (value: number) => string;
}

export function AnimatedNumber({ 
  value, 
  className,
  duration = 0.5,
  formatter = (v) => v.toLocaleString(),
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(value);
  const previousValue = React.useRef(value);

  React.useEffect(() => {
    const startValue = previousValue.current;
    const difference = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(startValue + difference * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <motion.span 
      className={className}
      key={value}
      initial={{ opacity: 0.8, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {formatter(Math.round(displayValue))}
    </motion.span>
  );
}

/**
 * Presence wrapper for conditional rendering
 */
interface PresenceProps {
  children: React.ReactNode;
  show: boolean;
  mode?: "sync" | "wait" | "popLayout";
}

export function Presence({ children, show, mode = "sync" }: PresenceProps) {
  const { AnimatePresence } = require("framer-motion");
  
  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

