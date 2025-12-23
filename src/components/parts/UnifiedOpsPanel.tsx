"use client";

/**
 * CAI Intake - Unified Operations Panel
 * 
 * A single slide-out/modal panel for managing ALL part operations:
 * - Edgebanding (material + sides)
 * - Grooves (type + specs + sides)
 * - Holes (patterns + face)
 * - CNC (programs/operations)
 * 
 * Mobile-optimized with touch-friendly controls.
 */

import * as React from "react";
import { X, Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface UnifiedOpsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: OperationsData;
  onChange: (value: OperationsData) => void;
  /** Part label for context */
  partLabel?: string;
}

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
  color?: "blue" | "amber";
}) {
  const colorClasses = {
    blue: active
      ? "bg-blue-500 text-white border-blue-500"
      : "border-[var(--border)] hover:border-blue-300 hover:bg-blue-50",
    amber: active
      ? "bg-amber-500 text-white border-amber-500"
      : "border-[var(--border)] hover:border-amber-300 hover:bg-amber-50",
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
// FACE TOGGLE (Front/Back for holes)
// ============================================================

function FaceToggle({
  face,
  onChange,
}: {
  face: "F" | "B";
  onChange: (face: "F" | "B") => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("F")}
        className={cn(
          "flex-1 h-10 rounded-lg border-2 text-sm font-medium transition-all",
          "active:scale-95",
          face === "F"
            ? "bg-purple-500 text-white border-purple-500"
            : "border-[var(--border)] hover:border-purple-300"
        )}
      >
        Front
      </button>
      <button
        type="button"
        onClick={() => onChange("B")}
        className={cn(
          "flex-1 h-10 rounded-lg border-2 text-sm font-medium transition-all",
          "active:scale-95",
          face === "B"
            ? "bg-purple-500 text-white border-purple-500"
            : "border-[var(--border)] hover:border-purple-300"
        )}
      >
        Back
      </button>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function UnifiedOpsPanel({
  open,
  onOpenChange,
  value,
  onChange,
  partLabel,
}: UnifiedOpsPanelProps) {
  const {
    edgebandMaterials,
    grooveTypes,
    holeTypes,
    cncTypes,
    isLoading,
  } = useOperationTypes();

  // Local state for editing (commit on close)
  const [localOps, setLocalOps] = React.useState<OperationsData>(value);

  // Sync local state when panel opens or value changes
  React.useEffect(() => {
    if (open) {
      setLocalOps(value);
    }
  }, [open, value]);

  // Calculate operation counts for accordion badges
  const edgingSideCount = Object.values(localOps.edgebanding.sides).filter(Boolean).length;
  const grooveCount = localOps.grooves.length;
  const holeCount = localOps.holes.length;
  const cncCount = localOps.cnc.length;
  const totalOps = edgingSideCount + grooveCount + holeCount + cncCount;

  // Handlers
  const toggleEdgeSide = (side: string) => {
    setLocalOps(prev => ({
      ...prev,
      edgebanding: {
        ...prev.edgebanding,
        sides: {
          ...prev.edgebanding.sides,
          [side]: !prev.edgebanding.sides[side],
        },
      },
    }));
  };

  const setEdgebandMaterial = (id: string) => {
    setLocalOps(prev => ({
      ...prev,
      edgebanding: { ...prev.edgebanding, edgeband_id: id },
    }));
  };

  const addGroove = (typeCode: string) => {
    const type = grooveTypes.find(t => t.code === typeCode);
    if (!type) return;
    
    setLocalOps(prev => ({
      ...prev,
      grooves: [
        ...prev.grooves,
        {
          type_code: type.code,
          width_mm: type.default_width_mm || 4,
          depth_mm: type.default_depth_mm || 8,
          side: "W1",
        },
      ],
    }));
  };

  const updateGroove = (index: number, updates: Partial<typeof localOps.grooves[0]>) => {
    setLocalOps(prev => ({
      ...prev,
      grooves: prev.grooves.map((g, i) => (i === index ? { ...g, ...updates } : g)),
    }));
  };

  const removeGroove = (index: number) => {
    setLocalOps(prev => ({
      ...prev,
      grooves: prev.grooves.filter((_, i) => i !== index),
    }));
  };

  const addHole = (typeCode: string) => {
    const type = holeTypes.find(t => t.code === typeCode);
    if (!type) return;
    
    setLocalOps(prev => ({
      ...prev,
      holes: [...prev.holes, { type_code: type.code, face: "F" as const }],
    }));
  };

  const updateHole = (index: number, updates: Partial<typeof localOps.holes[0]>) => {
    setLocalOps(prev => ({
      ...prev,
      holes: prev.holes.map((h, i) => (i === index ? { ...h, ...updates } : h)),
    }));
  };

  const removeHole = (index: number) => {
    setLocalOps(prev => ({
      ...prev,
      holes: prev.holes.filter((_, i) => i !== index),
    }));
  };

  const addCnc = (typeCode: string) => {
    const type = cncTypes.find(t => t.code === typeCode);
    if (!type) return;
    
    setLocalOps(prev => ({
      ...prev,
      cnc: [...prev.cnc, { type_code: type.code }],
    }));
  };

  const removeCnc = (index: number) => {
    setLocalOps(prev => ({
      ...prev,
      cnc: prev.cnc.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    onChange(localOps);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalOps({
      edgebanding: { edgeband_id: undefined, sides: { L1: false, L2: false, W1: false, W2: false } },
      grooves: [],
      holes: [],
      cnc: [],
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-visible">
        <SheetHeader className="px-4 py-3 border-b bg-[var(--muted)]">
          <SheetTitle className="flex items-center gap-2">
            Part Operations
            {totalOps > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalOps} configured
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {partLabel ? `Configuring: ${partLabel}` : "Configure operations for this part"}
          </SheetDescription>
        </SheetHeader>

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
                {/* Material Select */}
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Material</Label>
                  <Select
                    value={localOps.edgebanding.edgeband_id || ""}
                    onValueChange={setEdgebandMaterial}
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

                {/* Side Toggles */}
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

                {/* Quick presets */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLocalOps(prev => ({
                        ...prev,
                        edgebanding: {
                          ...prev.edgebanding,
                          sides: { L1: true, L2: true, W1: true, W2: true },
                        },
                      }))
                    }
                    className="text-xs"
                  >
                    All Sides (2L2W)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLocalOps(prev => ({
                        ...prev,
                        edgebanding: {
                          ...prev.edgebanding,
                          sides: { L1: true, L2: true, W1: false, W2: false },
                        },
                      }))
                    }
                    className="text-xs"
                  >
                    2L
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLocalOps(prev => ({
                        ...prev,
                        edgebanding: {
                          ...prev.edgebanding,
                          sides: { L1: false, L2: false, W1: true, W2: true },
                        },
                      }))
                    }
                    className="text-xs"
                  >
                    2W
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ====== GROOVES ====== */}
            <AccordionItem value="grooves" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-medium">Grooves</span>
                  {grooveCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      {grooveCount}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                {/* Existing grooves */}
                {localOps.grooves.map((groove, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg bg-[var(--muted)]/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-100 text-amber-700">
                        {groove.type_code}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => removeGroove(idx)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-[var(--muted-foreground)]">Depth</Label>
                        <Input
                          type="number"
                          value={groove.depth_mm}
                          onChange={(e) =>
                            updateGroove(idx, { depth_mm: parseFloat(e.target.value) || 0 })
                          }
                          className="h-10 text-center"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[var(--muted-foreground)]">Width</Label>
                        <Input
                          type="number"
                          value={groove.width_mm}
                          onChange={(e) =>
                            updateGroove(idx, { width_mm: parseFloat(e.target.value) || 0 })
                          }
                          className="h-10 text-center"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[var(--muted-foreground)]">Side</Label>
                        <Select
                          value={groove.side}
                          onValueChange={(v) => updateGroove(idx, { side: v })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="z-[200]">
                            {["L1", "L2", "W1", "W2"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add groove */}
                <Select value="" onValueChange={addGroove}>
                  <SelectTrigger className="h-11 border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Groove
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                    {grooveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.code}>
                        <span className="font-mono text-amber-600">{t.code}</span>
                        <span className="ml-2 text-[var(--muted-foreground)]">
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>

            {/* ====== HOLES ====== */}
            <AccordionItem value="holes" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--muted)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="font-medium">Holes</span>
                  {holeCount > 0 && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      {holeCount}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                {/* Existing holes */}
                {localOps.holes.map((hole, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg bg-[var(--muted)]/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="bg-purple-100 text-purple-700">
                        {hole.type_code}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => removeHole(idx)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <FaceToggle
                      face={hole.face}
                      onChange={(f) => updateHole(idx, { face: f })}
                    />
                  </div>
                ))}

                {/* Add hole */}
                <Select value="" onValueChange={addHole}>
                  <SelectTrigger className="h-11 border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Hole Pattern
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                    {holeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.code}>
                        <span className="font-mono text-purple-600">{t.code}</span>
                        <span className="ml-2 text-[var(--muted-foreground)]">
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {/* Existing CNC ops */}
                {localOps.cnc.map((cnc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg bg-[var(--muted)]/30"
                  >
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {cnc.type_code}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeCnc(idx)}
                      className="p-1.5 rounded hover:bg-red-100 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Add CNC */}
                <Select value="" onValueChange={addCnc}>
                  <SelectTrigger className="h-11 border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Add CNC Operation
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-60 z-[200]">
                    {cncTypes.map((t) => (
                      <SelectItem key={t.id} value={t.code}>
                        <span className="font-mono text-emerald-600">{t.code}</span>
                        <span className="ml-2 text-[var(--muted-foreground)]">
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <SheetFooter className="px-4 py-3 border-t bg-[var(--muted)] gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear All
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} className="flex-1">
            <Check className="h-4 w-4 mr-1" />
            Apply Operations
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

