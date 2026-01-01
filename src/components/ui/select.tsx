"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

// ============================================================
// SIMPLE SELECT (native HTML select)
// ============================================================

export interface SimpleSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const SimpleSelect = React.forwardRef<HTMLSelectElement, SimpleSelectProps>(
  ({ className, error, label, hint, id, options, placeholder, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            className={cn(
              // Base styles
              "flex w-full rounded-lg border bg-[var(--card)] transition-colors appearance-none cursor-pointer",
              // Mobile-optimized sizing
              "h-11 sm:h-10 px-3 py-2",
              // Font size: 16px on mobile prevents iOS zoom
              "text-base sm:text-sm",
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
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-[var(--muted-foreground)] pointer-events-none" />
        </div>
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
SimpleSelect.displayName = "SimpleSelect";

// ============================================================
// CUSTOM SELECT (Dropdown-style)
// ============================================================

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within a Select");
  }
  return context;
}

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

function Select({ value: controlledValue, defaultValue = "", onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
      setOpen(false);
    },
    [controlledValue, onValueChange]
  );

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, triggerRef }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

function SelectTrigger({ children, className }: SelectTriggerProps) {
  const { open, setOpen, triggerRef } = useSelectContext();

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        // Base styles
        "flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2",
        // Mobile-optimized sizing
        "h-11 sm:h-10",
        // Font size: 16px on mobile prevents iOS zoom
        "text-base sm:text-sm",
        // Hover and focus states
        "hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--cai-teal)] focus:border-transparent",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Touch optimization
        "touch-manipulation active:scale-[0.99]",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-5 w-5 sm:h-4 sm:w-4 text-[var(--muted-foreground)] transition-transform shrink-0 ml-2", open && "rotate-180")} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelectContext();
  
  return (
    <span className={cn("truncate", !value && "text-[var(--muted-foreground)]")}>
      {value || placeholder || "Select..."}
    </span>
  );
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
  position?: "popper" | "item-aligned";
  sideOffset?: number;
}

function SelectContent({ children, className, position = "item-aligned", sideOffset = 4 }: SelectContentProps) {
  const { open, setOpen, triggerRef } = useSelectContext();
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);

  // Get trigger rect when opening
  React.useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  }, [open, triggerRef]);

  // Update position on scroll/resize
  React.useEffect(() => {
    if (!open || position !== "popper") return;

    const updatePosition = () => {
      if (triggerRef.current) {
        setTriggerRect(triggerRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, position, triggerRef]);

  if (!open) return null;

  // Use portal for "popper" position to avoid clipping by parent overflow
  if (position === "popper" && typeof window !== "undefined") {
    const portalContent = (
      <>
        {/* Backdrop to close dropdown */}
        <div
          className="fixed inset-0 z-[199]"
          onClick={() => setOpen(false)}
        />
        {/* Dropdown content */}
        <div
          style={triggerRect ? {
            position: "fixed",
            top: triggerRect.bottom + sideOffset,
            left: triggerRect.left,
            width: triggerRect.width,
            minWidth: 200,
            maxHeight: Math.min(300, window.innerHeight - triggerRect.bottom - sideOffset - 16),
          } : {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            minWidth: 200,
          }}
          className={cn(
            "z-[200] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg",
            className
          )}
        >
          <div className="p-1">
            {children}
          </div>
        </div>
      </>
    );
    return ReactDOM.createPortal(portalContent, document.body);
  }

  // Default: absolute positioning within parent
  return (
    <>
      {/* Backdrop to close dropdown */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          "absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg",
          className
        )}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    </>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function SelectItem({ value: itemValue, children, className }: SelectItemProps) {
  const { value, onValueChange } = useSelectContext();
  const isSelected = value === itemValue;

  return (
    <button
      type="button"
      onClick={() => onValueChange(itemValue)}
      className={cn(
        // Base styles
        "relative flex w-full items-center rounded-md outline-none cursor-pointer",
        // Mobile-optimized sizing: taller touch targets
        "px-3 py-3 sm:px-2 sm:py-2",
        // Font size
        "text-base sm:text-sm",
        // Hover and active states
        "hover:bg-[var(--muted)] active:bg-[var(--border)]",
        // Touch optimization
        "touch-manipulation",
        // Selected state
        isSelected && "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]",
        className
      )}
    >
      <span className="flex-1 text-left">{children}</span>
      {isSelected && <Check className="h-5 w-5 sm:h-4 sm:w-4 ml-2 shrink-0" />}
    </button>
  );
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SimpleSelect,
};
