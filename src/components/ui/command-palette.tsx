"use client";

/**
 * Command Palette (⌘K / Ctrl+K)
 * 
 * A VS Code-style command palette for quick actions:
 * - Add part presets (Door, Shelf, Side, Back, Drawer set)
 * - Apply operations to selection
 * - Assign material
 * - Navigate to pages
 * - Search parts
 */

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Plus,
  Layers,
  Package,
  Settings,
  Home,
  FileText,
  Search,
  ArrowRight,
  Check,
  Grid3X3,
  Copy,
  Trash2,
  RotateCcw,
  Wand2,
  Box,
  LayoutDashboard,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntakeStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";

// ============================================================
// PART PRESETS
// ============================================================

interface PartPreset {
  name: string;
  label: string;
  defaultOps?: {
    edging?: ("L1" | "L2" | "W1" | "W2")[];
    groove?: ("L1" | "L2" | "W1" | "W2")[];
  };
  description: string;
}

const PART_PRESETS: PartPreset[] = [
  {
    name: "door",
    label: "Door",
    defaultOps: { edging: ["L1", "L2", "W1", "W2"] },
    description: "Cabinet door with all edges banded",
  },
  {
    name: "drawer-front",
    label: "Drawer Front",
    defaultOps: { edging: ["L1", "L2", "W1", "W2"] },
    description: "Drawer front with all edges banded",
  },
  {
    name: "shelf",
    label: "Shelf",
    defaultOps: { edging: ["L1"] },
    description: "Adjustable shelf with front edge banded",
  },
  {
    name: "fixed-shelf",
    label: "Fixed Shelf",
    defaultOps: { edging: ["L1"], groove: ["W1", "W2"] },
    description: "Fixed shelf with front edge + dado grooves",
  },
  {
    name: "side-panel",
    label: "Side Panel",
    defaultOps: { edging: ["L1"], groove: ["W2"] },
    description: "Cabinet side with front edge + back groove",
  },
  {
    name: "top-bottom",
    label: "Top/Bottom Panel",
    defaultOps: { edging: ["L1"], groove: ["W2"] },
    description: "Horizontal panel with front edge + back groove",
  },
  {
    name: "back-panel",
    label: "Back Panel",
    defaultOps: {},
    description: "Back panel (no edging, fits in groove)",
  },
  {
    name: "kick-board",
    label: "Kick Board / Plinth",
    defaultOps: { edging: ["L1"] },
    description: "Toe kick with visible front edge",
  },
  {
    name: "drawer-box-side",
    label: "Drawer Box Side",
    defaultOps: {},
    description: "Drawer side (typically no edging)",
  },
  {
    name: "drawer-box-front-back",
    label: "Drawer Box Front/Back",
    defaultOps: {},
    description: "Drawer front/back piece",
  },
  {
    name: "drawer-bottom",
    label: "Drawer Bottom",
    defaultOps: {},
    description: "Drawer bottom panel",
  },
];

// ============================================================
// EDGE PRESETS
// ============================================================

interface EdgePreset {
  id: string;
  label: string;
  edges: ("L1" | "L2" | "W1" | "W2")[];
  shortcut: string;
}

const EDGE_PRESETS: EdgePreset[] = [
  { id: "4E", label: "All 4 Edges (2L2W)", edges: ["L1", "L2", "W1", "W2"], shortcut: "4" },
  { id: "2L", label: "Both Long Edges (2L)", edges: ["L1", "L2"], shortcut: "2l" },
  { id: "2W", label: "Both Short Edges (2W)", edges: ["W1", "W2"], shortcut: "2w" },
  { id: "L1", label: "Front Long Edge (L1)", edges: ["L1"], shortcut: "l1" },
  { id: "L2", label: "Back Long Edge (L2)", edges: ["L2"], shortcut: "l2" },
  { id: "W1", label: "Left Short Edge (W1)", edges: ["W1"], shortcut: "w1" },
  { id: "W2", label: "Right Short Edge (W2)", edges: ["W2"], shortcut: "w2" },
  { id: "3E", label: "Three Edges (L1+L2+W1)", edges: ["L1", "L2", "W1"], shortcut: "3" },
  { id: "none", label: "No Edging", edges: [], shortcut: "0" },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<string[]>([]);
  const page = pages[pages.length - 1];
  const router = useRouter();

  // Store access
  const {
    currentCutlist,
    addPart,
    selectedPartIds,
    updateSelectedParts,
    duplicateSelectedParts,
    removeSelectedParts,
    selectAllParts,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useIntakeStore();

  const materials = currentCutlist.materials;
  const parts = currentCutlist.parts;
  const hasSelection = selectedPartIds.length > 0;

  // Toggle command palette
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        if (pages.length > 0) {
          setPages((p) => p.slice(0, -1));
        } else {
          setOpen(false);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, pages]);

  // Reset state when closing
  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setPages([]);
    }
  }, [open]);

  // Add a part with preset
  const addPartWithPreset = (preset: PartPreset) => {
    const defaultMaterial = materials[0]?.material_id || "MAT-WHITE-18";
    const defaultEdgeband = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";

    // Build ops from preset
    const ops: CutPart["ops"] = {};
    
    if (preset.defaultOps?.edging && preset.defaultOps.edging.length > 0) {
      ops.edging = {
        edges: preset.defaultOps.edging.reduce((acc, edge) => {
          acc[edge] = { apply: true, edgeband_id: defaultEdgeband };
          return acc;
        }, {} as Record<string, { apply: boolean; edgeband_id?: string }>),
      };
    }

    if (preset.defaultOps?.groove && preset.defaultOps.groove.length > 0) {
      ops.grooves = preset.defaultOps.groove.map((side, i) => ({
        groove_id: generateId("GRV"),
        side: side,
        offset_mm: 10,
        depth_mm: 8,
        width_mm: 4,
      }));
    }

    const part: CutPart = {
      part_id: generateId("P"),
      label: preset.label,
      qty: 1,
      size: { L: 0, W: 0 }, // User will fill in
      thickness_mm: 18,
      material_id: defaultMaterial,
      allow_rotation: true,
      ops: Object.keys(ops).length > 0 ? ops : undefined,
      audit: {
        source_method: "manual",
        confidence: 1,
        human_verified: true,
      },
    };

    addPart(part);
    setOpen(false);
  };

  // Apply edging to selection
  const applyEdgingToSelection = (edges: ("L1" | "L2" | "W1" | "W2")[]) => {
    if (!hasSelection) return;

    const defaultEdgeband = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";
    
    const edgingConfig = edges.length > 0 ? {
      edging: {
        edges: edges.reduce((acc, edge) => {
          acc[edge] = { apply: true, edgeband_id: defaultEdgeband };
          return acc;
        }, {} as Record<string, { apply: boolean; edgeband_id?: string }>),
      },
    } : { edging: undefined };

    updateSelectedParts({ ops: edgingConfig });
    setOpen(false);
  };

  // Apply material to selection
  const applyMaterialToSelection = (materialId: string) => {
    if (!hasSelection) return;
    updateSelectedParts({ material_id: materialId });
    setOpen(false);
  };

  // Navigate to page
  const navigateTo = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className={cn(
        "fixed left-1/2 top-[20%] -translate-x-1/2 z-[9999]",
        "w-[90vw] max-w-[640px] rounded-xl",
        "bg-[var(--card)] border border-[var(--border)]",
        "shadow-2xl overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
    >
      {/* Search Input */}
      <div className="flex items-center border-b border-[var(--border)] px-4">
        <Search className="h-5 w-5 text-[var(--muted-foreground)] shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder={
            page === "add-part" ? "Search part types..." :
            page === "apply-edging" ? "Search edge presets..." :
            page === "apply-material" ? "Search materials..." :
            "Type a command or search..."
          }
          className={cn(
            "flex-1 h-14 px-3 bg-transparent",
            "text-base placeholder:text-[var(--muted-foreground)]",
            "focus:outline-none"
          )}
        />
        <kbd className="hidden sm:inline-flex h-6 px-2 rounded bg-[var(--muted)] text-[10px] font-medium text-[var(--muted-foreground)] items-center">
          ESC
        </kbd>
      </div>

      {/* Command List */}
      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No results found.
        </Command.Empty>

        {/* Breadcrumb for subpages */}
        {page && (
          <div className="px-2 py-1.5 mb-2">
            <button
              onClick={() => setPages((p) => p.slice(0, -1))}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ====== ADD PART PAGE ====== */}
        {page === "add-part" && (
          <Command.Group heading="Part Types">
            {PART_PRESETS.map((preset) => (
              <Command.Item
                key={preset.name}
                value={`${preset.name} ${preset.label} ${preset.description}`}
                onSelect={() => addPartWithPreset(preset)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Box className="h-4 w-4 opacity-60" />
                <div className="flex-1">
                  <p className="font-medium">{preset.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {preset.description}
                  </p>
                </div>
                {preset.defaultOps?.edging && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
                    EB:{preset.defaultOps.edging.length === 4 ? "4" : preset.defaultOps.edging.join("+")}
                  </span>
                )}
                {preset.defaultOps?.groove && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">
                    GR:{preset.defaultOps.groove.length}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* ====== APPLY EDGING PAGE ====== */}
        {page === "apply-edging" && (
          <Command.Group heading={`Apply Edging to ${selectedPartIds.length} selected parts`}>
            {EDGE_PRESETS.map((preset) => (
              <Command.Item
                key={preset.id}
                value={`${preset.id} ${preset.label}`}
                onSelect={() => applyEdgingToSelection(preset.edges)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Layers className="h-4 w-4 opacity-60" />
                <div className="flex-1">
                  <p className="font-medium">{preset.label}</p>
                </div>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                  {preset.shortcut}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* ====== APPLY MATERIAL PAGE ====== */}
        {page === "apply-material" && (
          <Command.Group heading={`Apply Material to ${selectedPartIds.length} selected parts`}>
            {materials.map((m) => (
              <Command.Item
                key={m.material_id}
                value={`${m.material_id} ${m.name}`}
                onSelect={() => applyMaterialToSelection(m.material_id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Package className="h-4 w-4 opacity-60" />
                <div className="flex-1">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {m.thickness_mm}mm
                  </p>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* ====== MAIN PAGE ====== */}
        {!page && (
          <>
            {/* Quick Actions */}
            <Command.Group heading="Quick Actions">
              <Command.Item
                value="add part new"
                onSelect={() => setPages([...pages, "add-part"])}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Plus className="h-4 w-4" />
                <span>Add Part...</span>
                <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
              </Command.Item>

              {hasSelection && (
                <>
                  <Command.Item
                    value="apply edging edge banding"
                    onSelect={() => setPages([...pages, "apply-edging"])}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                      "text-sm transition-colors",
                      "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                    )}
                  >
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span>Apply Edging to Selection...</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {selectedPartIds.length} selected
                    </span>
                    <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
                  </Command.Item>

                  <Command.Item
                    value="apply material assign"
                    onSelect={() => setPages([...pages, "apply-material"])}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                      "text-sm transition-colors",
                      "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                    )}
                  >
                    <Package className="h-4 w-4 text-green-500" />
                    <span>Apply Material to Selection...</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {selectedPartIds.length} selected
                    </span>
                    <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
                  </Command.Item>

                  <Command.Item
                    value="duplicate copy selected"
                    onSelect={() => {
                      duplicateSelectedParts();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                      "text-sm transition-colors",
                      "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                    )}
                  >
                    <Copy className="h-4 w-4" />
                    <span>Duplicate Selected Parts</span>
                    <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                      ⌘D
                    </kbd>
                  </Command.Item>

                  <Command.Item
                    value="delete remove selected"
                    onSelect={() => {
                      removeSelectedParts();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                      "text-sm transition-colors text-red-600",
                      "aria-selected:bg-red-50"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Selected Parts</span>
                    <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                      Del
                    </kbd>
                  </Command.Item>
                </>
              )}

              <Command.Item
                value="select all parts"
                onSelect={() => {
                  selectAllParts();
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Check className="h-4 w-4" />
                <span>Select All Parts</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  ⌘A
                </kbd>
              </Command.Item>

              {hasSelection && (
                <Command.Item
                  value="clear selection deselect"
                  onSelect={() => {
                    clearSelection();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                    "text-sm transition-colors",
                    "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                  <span>Clear Selection</span>
                  <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                    Esc
                  </kbd>
                </Command.Item>
              )}
            </Command.Group>

            {/* Edit */}
            <Command.Group heading="Edit">
              <Command.Item
                value="undo"
                onSelect={() => {
                  undo();
                  setOpen(false);
                }}
                disabled={!canUndo}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]",
                  !canUndo && "opacity-50 cursor-not-allowed"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Undo</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  ⌘Z
                </kbd>
              </Command.Item>

              <Command.Item
                value="redo"
                onSelect={() => {
                  redo();
                  setOpen(false);
                }}
                disabled={!canRedo}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]",
                  !canRedo && "opacity-50 cursor-not-allowed"
                )}
              >
                <Wand2 className="h-4 w-4" />
                <span>Redo</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  ⌘⇧Z
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigation">
              <Command.Item
                value="go dashboard home"
                onSelect={() => navigateTo("/dashboard")}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Go to Dashboard</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  G D
                </kbd>
              </Command.Item>

              <Command.Item
                value="go intake parts entry"
                onSelect={() => navigateTo("/intake")}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Inbox className="h-4 w-4" />
                <span>Go to Intake</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  G I
                </kbd>
              </Command.Item>

              <Command.Item
                value="go cutlists projects"
                onSelect={() => navigateTo("/cutlists")}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <FileText className="h-4 w-4" />
                <span>Go to Cutlists</span>
              </Command.Item>

              <Command.Item
                value="go materials library"
                onSelect={() => navigateTo("/materials")}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Package className="h-4 w-4" />
                <span>Go to Materials</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  G M
                </kbd>
              </Command.Item>

              <Command.Item
                value="go settings preferences"
                onSelect={() => navigateTo("/settings")}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-sm transition-colors",
                  "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                )}
              >
                <Settings className="h-4 w-4" />
                <span>Go to Settings</span>
                <kbd className="ml-auto text-[10px] px-1.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  G S
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Search Parts */}
            {parts.length > 0 && search.length > 0 && (
              <Command.Group heading="Parts">
                {parts
                  .filter((p) => 
                    p.label?.toLowerCase().includes(search.toLowerCase()) ||
                    p.material_id?.toLowerCase().includes(search.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((part) => (
                    <Command.Item
                      key={part.part_id}
                      value={`part ${part.label} ${part.material_id}`}
                      onSelect={() => {
                        // Could scroll to part or select it
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                        "text-sm transition-colors",
                        "aria-selected:bg-[var(--cai-teal)]/10 aria-selected:text-[var(--cai-teal)]"
                      )}
                    >
                      <Box className="h-4 w-4 opacity-60" />
                      <div className="flex-1">
                        <p className="font-medium">{part.label || "Unnamed Part"}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {part.size.L} × {part.size.W} × {part.thickness_mm}mm
                        </p>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Qty: {part.qty}
                      </span>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}
          </>
        )}
      </Command.List>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-2 flex items-center gap-4 text-[10px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[var(--muted)]">↑↓</kbd> Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[var(--muted)]">↵</kbd> Select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[var(--muted)]">esc</kbd> Close
        </span>
      </div>
    </Command.Dialog>
  );
}


