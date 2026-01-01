"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { hapticImpact } from "@/lib/haptics";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
  undefined
);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isControlled = onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const prevOpen = React.useRef(isOpen);

  // Haptic feedback on open/close
  React.useEffect(() => {
    if (isOpen !== prevOpen.current) {
      hapticImpact(isOpen ? "medium" : "light");
      prevOpen.current = isOpen;
    }
  }, [isOpen]);

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)}>
      {children}
    </button>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function DialogContent({ children, className, ...props }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();
  const [isVisible, setIsVisible] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      // Small delay to ensure CSS animation plays correctly
      requestAnimationFrame(() => {
        setIsVisible(true);
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for exit animation before hiding
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with fade animation */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          isAnimating ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Content with bounce animation - mobile optimized */}
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className={cn(
            // Base styles
            "relative w-full overflow-auto bg-[var(--card)] shadow-xl transition-all duration-300",
            // Mobile: full width, slide up from bottom, max height
            "max-h-[85vh] sm:max-h-[90vh]",
            "rounded-t-2xl sm:rounded-xl",
            "border-t sm:border border-[var(--border)]",
            // Desktop: centered modal with max width
            "sm:max-w-lg",
            // Animation states
            isAnimating 
              ? "opacity-100 translate-y-0 sm:scale-100" 
              : "opacity-0 translate-y-full sm:translate-y-4 sm:scale-95",
            // Bounce effect using cubic-bezier
            "ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            // Safe area for notched devices
            "pb-safe",
            className
          )}
          {...props}
        >
          {/* Mobile drag handle */}
          <div className="flex sm:hidden justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-[var(--muted-foreground)] opacity-30" />
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-full opacity-70 transition-all duration-150 hover:opacity-100 hover:bg-[var(--muted)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--cai-teal)] focus:ring-offset-2 touch-manipulation"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="sr-only">Close</span>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 pb-0",
        // Responsive padding
        "p-4 sm:p-6",
        // Account for close button on mobile (where it's in the corner)
        "pr-12 sm:pr-14",
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Mobile: stack buttons, full width
        "flex flex-col gap-2 pt-4",
        // Responsive padding
        "p-4 sm:p-6",
        // Desktop: horizontal layout
        "sm:flex-row sm:justify-end sm:gap-2",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-semibold leading-none tracking-tight",
        // Responsive font size
        "text-base sm:text-lg",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[var(--muted-foreground)]",
        // Responsive font size
        "text-sm",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};





