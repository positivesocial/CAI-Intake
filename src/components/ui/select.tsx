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
              "flex h-10 w-full rounded-lg border bg-[var(--card)] px-3 py-2 text-sm transition-colors appearance-none cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50",
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
        </div>
        {hint && !error && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-xs text-[var(--cai-error)]">{error}</p>
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
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
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
  const { open, setOpen } = useSelectContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm",
        "hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--cai-teal)] focus:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelectContext();
  
  // We'll let SelectContent children populate the display value
  return (
    <span className={cn(!value && "text-[var(--muted-foreground)]")}>
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
  const { open, setOpen } = useSelectContext();
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      // Find the trigger button (sibling of content's parent)
      const trigger = contentRef.current?.parentElement?.querySelector("button");
      if (trigger) {
        setTriggerRect(trigger.getBoundingClientRect());
      }
    }
  }, [open]);

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
          ref={contentRef}
          style={triggerRect ? {
            position: "fixed",
            top: triggerRect.bottom + sideOffset,
            left: triggerRect.left,
            width: triggerRect.width,
            maxHeight: `calc(100vh - ${triggerRect.bottom + sideOffset + 16}px)`,
          } : undefined}
          className={cn(
            "z-[200] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg",
            !triggerRect && "absolute top-full left-0 right-0 mt-1",
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
        ref={contentRef}
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
        "relative flex w-full items-center rounded-md px-2 py-2 text-sm outline-none cursor-pointer",
        "hover:bg-[var(--muted)]",
        isSelected && "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]",
        className
      )}
    >
      <span className="flex-1 text-left">{children}</span>
      {isSelected && <Check className="h-4 w-4 ml-2" />}
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
