/**
 * CAI Intake - Keyboard Shortcuts Dialog
 * 
 * Shows all available keyboard shortcuts.
 * Triggered by pressing "?" key.
 */

"use client";

import * as React from "react";
import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

// =============================================================================
// SHORTCUT DATA
// =============================================================================

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["⌘", "S"], description: "Save current cutlist" },
      { keys: ["⌘", "Z"], description: "Undo last action" },
      { keys: ["⌘", "⇧", "Z"], description: "Redo last action" },
      { keys: ["Escape"], description: "Close modal/cancel action" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "D"], description: "Go to Dashboard" },
      { keys: ["G", "I"], description: "Go to Intake" },
      { keys: ["G", "M"], description: "Go to Materials" },
      { keys: ["G", "S"], description: "Go to Settings" },
    ],
  },
  {
    title: "Intake",
    shortcuts: [
      { keys: ["⌘", "Enter"], description: "Parse entered text", context: "Quick parse" },
      { keys: ["Tab"], description: "Move to next cell", context: "Spreadsheet" },
      { keys: ["⇧", "Tab"], description: "Move to previous cell", context: "Spreadsheet" },
      { keys: ["↑", "↓"], description: "Navigate rows", context: "Spreadsheet" },
      { keys: ["Enter"], description: "Add part and move to next row", context: "Spreadsheet" },
      { keys: ["⌘", "D"], description: "Duplicate selected row", context: "Spreadsheet" },
      { keys: ["Delete"], description: "Delete selected parts", context: "Parts table" },
    ],
  },
  {
    title: "Parts Table",
    shortcuts: [
      { keys: ["⌘", "A"], description: "Select all parts" },
      { keys: ["⌘", "Click"], description: "Add to selection" },
      { keys: ["⇧", "Click"], description: "Select range" },
      { keys: ["⌘", "C"], description: "Copy selected parts" },
      { keys: ["⌘", "V"], description: "Paste parts" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["⌘", "E"], description: "Export cutlist" },
      { keys: ["⌘", "O"], description: "Optimize cutlist" },
      { keys: ["⌘", "N"], description: "New cutlist" },
      { keys: ["⌘", "P"], description: "Print cutlist" },
    ],
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function KeyboardShortcutsDialog() {
  const [isOpen, setIsOpen] = React.useState(false);

  // Listen for ? key to open dialog
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || 
                     target.tagName === "TEXTAREA" || 
                     target.isContentEditable;
      
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setIsOpen(true);
      }
      
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl max-h-[80vh] m-4 bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--cai-teal)]/10 flex items-center justify-center">
              <Keyboard className="h-5 w-5 text-[var(--cai-teal)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Press <Key>?</Key> anytime to show this dialog
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, i) => (
                    <ShortcutRow key={i} shortcut={shortcut} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--muted)]/50">
          <p className="text-xs text-[var(--muted-foreground)] text-center">
            On Windows/Linux, use <Key>Ctrl</Key> instead of <Key>⌘</Key>
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-medium bg-[var(--muted)] border border-[var(--border)] rounded shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--foreground)]">
          {shortcut.description}
        </span>
        {shortcut.context && (
          <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
            {shortcut.context}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-[var(--muted-foreground)]">+</span>}
            <Key>{key}</Key>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to use keyboard shortcuts in components
 */
export function useKeyboardShortcut(
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
) {
  const { enabled = true, preventDefault = true } = options;

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check modifier keys
      const hasCmd = keys.includes("⌘") ? (e.metaKey || e.ctrlKey) : true;
      const hasShift = keys.includes("⇧") ? e.shiftKey : true;
      const hasAlt = keys.includes("⌥") ? e.altKey : true;

      // Get the actual key
      const nonModifierKeys = keys.filter(k => !["⌘", "⇧", "⌥"].includes(k));
      const keyMatch = nonModifierKeys.some(k => 
        e.key.toLowerCase() === k.toLowerCase()
      );

      if (hasCmd && hasShift && hasAlt && keyMatch) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback(e);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keys, callback, enabled, preventDefault]);
}

