"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            // Base styles
            "flex w-full rounded-lg border bg-[var(--card)] transition-colors resize-y",
            // Mobile-optimized sizing
            "min-h-[100px] sm:min-h-[80px]",
            "px-3 py-3 sm:py-2",
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
Textarea.displayName = "Textarea";

export { Textarea };

