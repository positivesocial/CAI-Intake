"use client";

/**
 * Quick Ops Popover
 * 
 * A keyboard-triggered popover for quick bulk operations.
 * Appears when pressing E (edging), G (groove), M (material), or H (holes).
 */

import * as React from "react";
import { Check, Layers, Package, Grid3X3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

export type QuickOpsType = "edging" | "groove" | "material" | "holes" | null;

interface QuickOpsOption {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
}

interface QuickOpsPopoverProps {
  type: QuickOpsType;
  onClose: () => void;
  onSelectEdging: (edges: ("L1" | "L2" | "W1" | "W2")[]) => void;
  onSelectGroove: (side: "L1" | "L2" | "W1" | "W2") => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectHolePattern: (pattern: string) => void;
  materials: { material_id: string; name: string; thickness_mm: number }[];
  selectedCount: number;
}

// ============================================================
// EDGE OPTIONS
// ============================================================

const EDGE_OPTIONS: { id: string; label: string; edges: ("L1" | "L2" | "W1" | "W2")[]; shortcut: string }[] = [
  { id: "4E", label: "All 4 Edges (2L2W)", edges: ["L1", "L2", "W1", "W2"], shortcut: "4" },
  { id: "2L", label: "Both Long Edges (2L)", edges: ["L1", "L2"], shortcut: "2" },
  { id: "2W", label: "Both Short Edges (2W)", edges: ["W1", "W2"], shortcut: "w" },
  { id: "L1", label: "Front Edge (L1)", edges: ["L1"], shortcut: "1" },
  { id: "L2", label: "Back Edge (L2)", edges: ["L2"], shortcut: "b" },
  { id: "W1", label: "Left Edge (W1)", edges: ["W1"], shortcut: "l" },
  { id: "W2", label: "Right Edge (W2)", edges: ["W2"], shortcut: "r" },
  { id: "3E", label: "Three Edges (L1+L2+W1)", edges: ["L1", "L2", "W1"], shortcut: "3" },
  { id: "none", label: "No Edging (Clear)", edges: [], shortcut: "0" },
];

const GROOVE_OPTIONS: { id: string; label: string; side: "L1" | "L2" | "W1" | "W2"; shortcut: string }[] = [
  { id: "W2", label: "Back Panel Groove (W2)", side: "W2", shortcut: "b" },
  { id: "L1", label: "Front Groove (L1)", side: "L1", shortcut: "1" },
  { id: "L2", label: "Back Groove (L2)", side: "L2", shortcut: "2" },
  { id: "W1", label: "Left Groove (W1)", side: "W1", shortcut: "l" },
];

const HOLE_OPTIONS: { id: string; label: string; pattern: string; shortcut: string }[] = [
  { id: "sys32", label: "32mm System Holes", pattern: "32mm system", shortcut: "3" },
  { id: "shelf", label: "Shelf Pin Holes", pattern: "shelf pins", shortcut: "s" },
  { id: "hinge", label: "Hinge Cup Holes", pattern: "hinge cups", shortcut: "h" },
  { id: "drawer", label: "Drawer Slide Holes", pattern: "drawer slides", shortcut: "d" },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function QuickOpsPopover({
  type,
  onClose,
  onSelectEdging,
  onSelectGroove,
  onSelectMaterial,
  onSelectHolePattern,
  materials,
  selectedCount,
}: QuickOpsPopoverProps) {
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Get options based on type
  const options = React.useMemo(() => {
    switch (type) {
      case "edging":
        return EDGE_OPTIONS.map(o => ({ id: o.id, label: o.label, shortcut: o.shortcut }));
      case "groove":
        return GROOVE_OPTIONS.map(o => ({ id: o.id, label: o.label, shortcut: o.shortcut }));
      case "material":
        return materials.map((m, i) => ({ 
          id: m.material_id, 
          label: `${m.name} (${m.thickness_mm}mm)`,
          shortcut: (i + 1).toString(),
        }));
      case "holes":
        return HOLE_OPTIONS.map(o => ({ id: o.id, label: o.label, shortcut: o.shortcut }));
      default:
        return [];
    }
  }, [type, materials]);

  // Handle selection
  const handleSelect = React.useCallback((optionId: string) => {
    switch (type) {
      case "edging":
        const edgeOption = EDGE_OPTIONS.find(o => o.id === optionId);
        if (edgeOption) onSelectEdging(edgeOption.edges);
        break;
      case "groove":
        const grooveOption = GROOVE_OPTIONS.find(o => o.id === optionId);
        if (grooveOption) onSelectGroove(grooveOption.side);
        break;
      case "material":
        onSelectMaterial(optionId);
        break;
      case "holes":
        const holeOption = HOLE_OPTIONS.find(o => o.id === optionId);
        if (holeOption) onSelectHolePattern(holeOption.pattern);
        break;
    }
    onClose();
  }, [type, onSelectEdging, onSelectGroove, onSelectMaterial, onSelectHolePattern, onClose]);

  // Keyboard handling
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (options[highlightedIndex]) {
            handleSelect(options[highlightedIndex].id);
          }
          break;
        default:
          // Check for shortcut keys
          const shortcut = e.key.toLowerCase();
          const matchingOption = options.find(o => o.shortcut?.toLowerCase() === shortcut);
          if (matchingOption) {
            e.preventDefault();
            handleSelect(matchingOption.id);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, highlightedIndex, handleSelect, onClose]);

  // Focus container on mount
  React.useEffect(() => {
    containerRef.current?.focus();
  }, []);

  if (!type) return null;

  const typeConfig = {
    edging: { title: "Apply Edging", icon: Layers, color: "text-blue-600" },
    groove: { title: "Add Groove", icon: Grid3X3, color: "text-amber-600" },
    material: { title: "Set Material", icon: Package, color: "text-green-600" },
    holes: { title: "Add Holes", icon: Grid3X3, color: "text-purple-600" },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100] bg-black/20"
        onClick={onClose}
      />
      
      {/* Popover */}
      <div
        ref={containerRef}
        tabIndex={0}
        className={cn(
          "fixed left-1/2 top-1/4 -translate-x-1/2 z-[101]",
          "w-[320px] max-h-[400px] overflow-hidden",
          "bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-100"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
          <Icon className={cn("h-5 w-5", config.color)} />
          <span className="font-medium">{config.title}</span>
          <span className="ml-auto text-xs text-[var(--muted-foreground)]">
            {selectedCount} selected
          </span>
        </div>

        {/* Options */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                "text-sm transition-colors text-left",
                highlightedIndex === index
                  ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]"
                  : "hover:bg-[var(--muted)]"
              )}
            >
              {highlightedIndex === index && (
                <ChevronRight className="h-4 w-4 text-[var(--cai-teal)]" />
              )}
              {highlightedIndex !== index && <div className="w-4" />}
              <span className="flex-1">{option.label}</span>
              {option.shortcut && (
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[10px] font-mono text-[var(--muted-foreground)]">
                  {option.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/50">
          <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}


