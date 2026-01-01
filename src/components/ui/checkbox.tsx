"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    
    const checkbox = (
      <input
        type="checkbox"
        ref={ref}
        id={checkboxId}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          // Base styles
          "rounded border border-primary text-primary",
          // Mobile-optimized sizing: larger touch target
          "h-5 w-5 sm:h-4 sm:w-4",
          // Focus states
          "focus:ring-2 focus:ring-primary focus:ring-offset-2",
          // Touch optimization
          "touch-manipulation cursor-pointer",
          className
        )}
        {...props}
      />
    );
    
    if (label) {
      return (
        <label 
          htmlFor={checkboxId}
          className="inline-flex items-center gap-2 cursor-pointer touch-manipulation select-none"
        >
          {checkbox}
          <span className="text-sm sm:text-sm">{label}</span>
        </label>
      );
    }
    
    return checkbox;
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

