"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            // Base styles
            "flex w-full rounded-lg border bg-[var(--card)] transition-colors",
            // Mobile-optimized sizing: taller touch targets on mobile
            "h-11 sm:h-10 px-3 py-2",
            // Font size: 16px on mobile prevents iOS zoom
            "text-base sm:text-sm",
            "placeholder:text-[var(--muted-foreground)]",
            // Focus states
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:border-transparent",
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Touch optimization
            "touch-manipulation",
            // Error state
            error
              ? "border-[var(--cai-error)] focus-visible:ring-[var(--cai-error)]"
              : "border-[var(--border)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-[var(--cai-error)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };

