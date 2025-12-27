"use client";

/**
 * CAI Intake - Bulk Operations Panel
 * 
 * Apply operations to multiple selected parts at once.
 * All operations follow the same simple pattern:
 * 1. Select type from dropdown
 * 2. Toggle sides/faces with buttons
 * 3. Quick presets available
 */

import * as React from "react";
import { Check, PlusCircle, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useOperationTypes } from "@/lib/stores/operation-types-store";
import type { OperationsData } from "@/components/operations";

// ============================================================
// TYPES
// ============================================================

interface BulkOpsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onApply: (ops: OperationsData, mode: "add" | "replace") => void;
}

// Simplified local state that mirrors edgebanding pattern
interface SimplifiedOps {
  edgebanding: {
    edgeband_id?: string;
    sides: Record<string, boolean>;
  };
  grooves: {
    groove_type_id?: string;
    sides: Record<string, boolean>;
  };
  holes: {
    hole_type_id?: string;
    faces: { front: boolean; back: boolean };
  };
  cnc: {
    types: string[]; // Array of selected CNC type codes
  };
}

const emptySimplifiedOps: SimplifiedOps = {
  edgebanding: { edgeband_id: undefined, sides: { L1: false, L2: false, W1: false, W2: false } },
  grooves: { groove_type_id: undefined, sides: { L1: false, L2: false, W1: false, W2: false } },
  holes: { hole_type_id: undefined, faces: { front: false, back: false } },
  cnc: { types: [] },
};

// ============================================================
// SIDE TOGGLE BUTTON
// ============================================================

function SideToggle({
  side,
  active,
  onClick,
  color = "blue",
}: {
  side: string;
  active: boolean;
  onClick: () => void;
  color?: "blue" | "amber" | "purple" | "emerald";
}) {
  const colorClasses = {
    blue: active
      ? "bg-blue-500 text-white border-blue-500"
      : "border-[var(--border)] hover:border-blue-300 hover:bg-blue-50",
    amber: active
      ? "bg-amber-500 text-white border-amber-500"
      : "border-[var(--border)] hover:border-amber-300 hover:bg-amber-50",
    purple: active
      ? "bg-purple-500 text-white border-purple-500"
      : "border-[var(--border)] hover:border-purple-300 hover:bg-purple-50",
    emerald: active
      ? "bg-emerald-500 text-white border-emerald-500"
      : "border-[var(--border)] hover:border-emerald-300 hover:bg-emerald-50",
  };

  const sideLabels: Record<string, string> = {
    L1: "Front (L)",
    L2: "Back (L)",
    W1: "Left (W)",
    W2: "Right (W)",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-12 rounded-lg border-2 text-sm font-medium transition-all",
        "flex flex-col items-center justify-center gap-0.5",
        "active:scale-95",
        colorClasses[color]
      )}
    >
      <span className="text-xs opacity-70">{sideLabels[side] || side}</span>
      <span className="font-mono font-bold">{side}</span>
    </button>
  );
}

// ============================================================
// FACE TOGGLE BUTTON
// ============================================================

function FaceToggle({
  face,
  active,
  onClick,
  color = "purple",
}: {
  face: string;
  active: boolean;
  onClick: () => void;
  color?: "purple";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-12 rounded-lg border-2 text-sm font-medium transition-all",
        "flex flex-col items-center justify-center gap-0.5",
        "active:scale-95",
        active
          ? "bg-purple-500 text-white border-purple-500"
          : "border-[var(--border)] hover:border-purple-300 hover:bg-purple-50"
      )}
    >
      <span className="font-medium">{face}</span>
    </button>
  );
}

// ============================================================
// CONVERT SIMPLIFIED OPS TO OPERATIONS DATA
// ============================================================

function simplifiedToOperationsData(
  simplified: SimplifiedOps,
  grooveOps: { code: string; widthMm?: number | null; depthMm?: number | null }[]
): OperationsData {
  // Convert grooves: generate entries for each active side
  const grooveOp = grooveOps.find(g => g.code === simplified.grooves.groove_type_id);
  const grooves = simplified.grooves.groove_type_id
    ? Object.entries(simplified.grooves.sides)
        .filter(([, active]) => active)
        .map(([side]) => ({
          type_code: simplified.grooves.groove_type_id!,
          side,
          width_mm: grooveOp?.widthMm || 4,
          depth_mm: grooveOp?.depthMm || 8,
        }))
    : [];

  // Convert holes: generate entries for each active face
  const holes: { type_code: string; face: "F" | "B" }[] = [];
  if (simplified.holes.hole_type_id) {
    if (simplified.holes.faces.front) {
      holes.push({ type_code: simplified.holes.hole_type_id, face: "F" });
    }
    if (simplified.holes.faces.back) {
      holes.push({ type_code: simplified.holes.hole_type_id, face: "B" });
    }
  }

  // Convert CNC: one entry per selected type
  const cnc = simplified.cnc.types.map(type_code => ({ type_code }));

  return {
    edgebanding: simplified.edgebanding,
    grooves,
    holes,
    cnc,
  };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function BulkOpsPanel({
  open,
  onOpenChange,
  selectedCount,
  onApply,
}: BulkOpsPanelProps) {
  const {
    edgebandMaterials,
    grooves,
    drilling,
    cnc,
  } = useOperationTypes();

  const [localOps, setLocalOps] = React.useState<SimplifiedOps>(emptySimplifiedOps);
  const [mode, setMode] = React.useState<"add" | "replace">("add");

  // Reset when panel opens
  React.useEffect(() => {
    if (open) {
      setLocalOps(emptySimplifiedOps);
      setMode("add");
    }
  }, [open]);

  // Calculate counts for badges
  const edgingSideCount = Object.values(localOps.edgebanding.sides).filter(Boolean).length;
  const grooveSideCount = Object.values(localOps.grooves.sides).filter(Boolean).length;
  const holeFaceCount = (localOps.holes.faces.front ? 1 : 0) + (localOps.holes.faces.back ? 1 : 0);
  const cncCount = localOps.cnc.types.length;
  const totalOps = edgingSideCount + grooveSideCount + holeFaceCount + cncCount;

  // Handlers
  const toggleEdgeSide = (side: string) => {
    setLocalOps(prev => ({
      ...prev,
      edgebanding: {
        ...prev.edgebanding,
        sides: { ...prev.edgebanding.sides, [side]: !prev.edgebanding.sides[side] },
      },
    }));
  };

  const toggleGrooveSide = (side: string) => {
    setLocalOps(prev => ({
      ...prev,
      grooves: {
        ...prev.grooves,
        sides: { ...prev.grooves.sides, [side]: !prev.grooves.sides[side] },
      },
    }));
  };

  const toggleHoleFace = (face: "front" | "back") => {
    setLocalOps(prev => ({
      ...prev,
      holes: {
        ...prev.holes,
        faces: { ...prev.holes.faces, [face]: !prev.holes.faces[face] },
      },
    }));
  };

  const toggleCncType = (code: string) => {
    setLocalOps(prev => ({
      ...prev,
      cnc: {
        types: prev.cnc.types.includes(code)
          ? prev.cnc.types.filter(c => c !== code)
          : [...prev.cnc.types, code],
      },
    }));
  };

  const handleApply = () => {
    const opsData = simplifiedToOperationsData(localOps, grooves);
    onApply(opsData, mode);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalOps(emptySimplifiedOps);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-visible">
        <SheetHeader className="px-4 py-3 border-b bg-[var(--cai-teal)]/10">
          <SheetTitle className="flex items-center gap-2">
            Bulk Operations
            <Badge variant="teal" className="text-xs">
              {selectedCount} part{selectedCount > 1 ? "s" : ""}
            </Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Configure operations to apply to all selected parts
          </SheetDescription>
        </SheetHeader>

        {/* Mode Toggle */}
        <div className="px-4 py-3 border-b bg-[var(--muted)]/50">
          <Label className="text-xs text-[var(--muted-foreground)] mb-2 block">Apply Mode</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 text-sm font-medium transition-all",
                mode === "add"
                  ? "bg-[var(--cai-teal)] text-white border-[var(--cai-teal)]"
                  : "border-[var(--border)] hover:border-[var(--cai-teal)]"
              )}
            >
              <PlusCircle className="h-4 w-4" />
              Add to Existing
            </button>
            <button
              type="button"
              onClick={() => setMode("replace")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 text-sm font-medium transition-all",
                mode === "replace"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-[var(--border)] hover:border-amber-500"
              )}
            >
              <Replace className="h-4 w-4" />
              Replace All
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            {mode === "add" 
              ? "Operations will be merged with existing part operations" 
              : "All existing operations will be replaced"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-visible">
          <Accordion type="multiple" defaultValue={["edging"]} className="w-full pb-20">
            {/* ====== EDGEBANDING ====== */}
            <AccordionItem value="edging" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium">Edgebanding</span>
                  {edgingSideCount > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      {edgingSideCount} side{edgingSideCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Material</Label>
                  <Select
                    value={localOps.edgebanding.edgeband_id || ""}
                    onValueChange={(id) => setLocalOps(prev => ({
                      ...prev,
                      edgebanding: { ...prev.edgebanding, edgeband_id: id },
                    }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select edgeband material..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                      {edgebandMaterials.map((eb) => (
                        <SelectItem key={eb.edgeband_id} value={eb.edgeband_id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: eb.color_code || "#ccc" }}
                            />
                            {eb.name} ({eb.thickness_mm}mm)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Apply to Sides</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["L1", "L2", "W1", "W2"].map((side) => (
                      <SideToggle
                        key={side}
                        side={side}
                        active={!!localOps.edgebanding.sides[side]}
                        onClick={() => toggleEdgeSide(side)}
                        color="blue"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      edgebanding: { ...prev.edgebanding, sides: { L1: true, L2: true, W1: true, W2: true } },
                    }))}
                    className="text-xs"
                  >
                    All Sides (2L2W)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      edgebanding: { ...prev.edgebanding, sides: { L1: true, L2: true, W1: false, W2: false } },
                    }))}
                    className="text-xs"
                  >
                    2L
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      edgebanding: { ...prev.edgebanding, sides: { L1: false, L2: false, W1: true, W2: true } },
                    }))}
                    className="text-xs"
                  >
                    2W
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ====== GROOVES (same pattern as edgebanding) ====== */}
            <AccordionItem value="grooves" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-medium">Grooves</span>
                  {grooveSideCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      {grooveSideCount} side{grooveSideCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Groove Type</Label>
                  <Select
                    value={localOps.grooves.groove_type_id || ""}
                    onValueChange={(id) => setLocalOps(prev => ({
                      ...prev,
                      grooves: { ...prev.grooves, groove_type_id: id },
                    }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select groove type..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                      {grooves.map((g) => (
                        <SelectItem key={g.id} value={g.code}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-amber-600 font-bold">{g.code}</span>
                            <span className="text-[var(--muted-foreground)]">{g.name}</span>
                            {g.widthMm && g.depthMm && (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                ({g.widthMm}×{g.depthMm}mm)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Apply to Sides</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["L1", "L2", "W1", "W2"].map((side) => (
                      <SideToggle
                        key={side}
                        side={side}
                        active={!!localOps.grooves.sides[side]}
                        onClick={() => toggleGrooveSide(side)}
                        color="amber"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      grooves: { ...prev.grooves, sides: { L1: true, L2: true, W1: true, W2: true } },
                    }))}
                    className="text-xs"
                  >
                    All Sides (2L2W)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      grooves: { ...prev.grooves, sides: { L1: true, L2: true, W1: false, W2: false } },
                    }))}
                    className="text-xs"
                  >
                    2L
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      grooves: { ...prev.grooves, sides: { L1: false, L2: false, W1: true, W2: true } },
                    }))}
                    className="text-xs"
                  >
                    2W
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ====== HOLES (select type, toggle faces) ====== */}
            <AccordionItem value="holes" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="font-medium">Holes</span>
                  {holeFaceCount > 0 && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      {holeFaceCount} face{holeFaceCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Hole Pattern</Label>
                  <Select
                    value={localOps.holes.hole_type_id || ""}
                    onValueChange={(id) => setLocalOps(prev => ({
                      ...prev,
                      holes: { ...prev.holes, hole_type_id: id },
                    }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select hole pattern..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                      {drilling.map((d) => (
                        <SelectItem key={d.id} value={d.code}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-purple-600 font-bold">{d.code}</span>
                            <span className="text-[var(--muted-foreground)]">{d.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Apply to Faces</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <FaceToggle
                      face="Front"
                      active={localOps.holes.faces.front}
                      onClick={() => toggleHoleFace("front")}
                    />
                    <FaceToggle
                      face="Back"
                      active={localOps.holes.faces.back}
                      onClick={() => toggleHoleFace("back")}
                    />
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalOps(prev => ({
                      ...prev,
                      holes: { ...prev.holes, faces: { front: true, back: true } },
                    }))}
                    className="text-xs"
                  >
                    Both Faces
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ====== CNC ====== */}
            <AccordionItem value="cnc" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-medium">CNC Operations</span>
                  {cncCount > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                      {cncCount}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Add CNC Operation</Label>
                  <Select
                    value=""
                    onValueChange={(code) => {
                      if (code && !localOps.cnc.types.includes(code)) {
                        toggleCncType(code);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select CNC operation..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                      {cnc.map((c) => (
                        <SelectItem key={c.id} value={c.code} disabled={localOps.cnc.types.includes(c.code)}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-emerald-600 font-bold">{c.code}</span>
                            <span className="text-[var(--muted-foreground)]">{c.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {localOps.cnc.types.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--muted-foreground)]">Selected Operations</Label>
                    <div className="flex flex-wrap gap-2">
                      {localOps.cnc.types.map((code) => {
                        const cncOp = cnc.find(c => c.code === code);
                        return (
                          <Badge 
                            key={code} 
                            className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1 gap-2"
                          >
                            <span className="font-mono font-bold">{code}</span>
                            {cncOp && <span className="font-normal">- {cncOp.name}</span>}
                            <button
                              type="button"
                              onClick={() => toggleCncType(code)}
                              className="ml-1 hover:bg-emerald-200 rounded p-0.5"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {cnc.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                    No CNC operation types configured
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <SheetFooter className="px-4 py-3 border-t bg-[var(--muted)] gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleApply} 
            className="flex-1"
            disabled={totalOps === 0}
          >
            <Check className="h-4 w-4 mr-1" />
            Apply to {selectedCount} Part{selectedCount > 1 ? "s" : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
