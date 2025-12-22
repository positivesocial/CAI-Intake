"use client";

/**
 * CAI Intake - Operation Type Selectors
 * 
 * Reusable components for selecting operation types and entering shortcodes:
 * - EdgebandSelector: Material + side checkboxes
 * - GrooveTypeSelector: Groove type + side + dimensions
 * - HoleTypeSelector: Hole type + face
 * - CncTypeSelector: CNC operation type
 */

import * as React from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOperationTypes, type EdgebandMaterial } from "@/lib/stores/operation-types-store";
import type { GrooveType, HoleType, CncOperationType } from "@/lib/schema";
import {
  formatEdgebandShortcode,
  formatGrooveShortcode,
  formatHoleShortcode,
  formatCncShortcode,
} from "@/lib/schema";

// ============================================================
// EDGEBAND SELECTOR
// ============================================================

interface EdgebandSelectorProps {
  value: {
    edgeband_id?: string;
    sides: Record<string, boolean>; // L1, L2, W1, W2
  };
  onChange: (value: { edgeband_id?: string; sides: Record<string, boolean> }) => void;
  compact?: boolean;
  className?: string;
}

export function EdgebandSelector({
  value,
  onChange,
  compact = false,
  className,
}: EdgebandSelectorProps) {
  const { edgebandMaterials, isLoading } = useOperationTypes();

  const sides = ["L1", "L2", "W1", "W2"];
  const appliedSides = sides.filter(s => value.sides[s]);
  const shortcode = value.edgeband_id 
    ? formatEdgebandShortcode(
        edgebandMaterials.find(e => e.edgeband_id === value.edgeband_id)?.name?.substring(0, 4) || "EB",
        value.sides
      )
    : "";

  const toggleSide = (side: string) => {
    onChange({
      ...value,
      sides: { ...value.sides, [side]: !value.sides[side] },
    });
  };

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-mono justify-between gap-1",
              appliedSides.length > 0 ? "text-blue-600" : "text-muted-foreground",
              className
            )}
          >
            {shortcode || "EB:—"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              Edgeband Material
            </div>
            <Select
              value={value.edgeband_id || ""}
              onValueChange={(v) => onChange({ ...value, edgeband_id: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select material..." />
              </SelectTrigger>
              <SelectContent>
                {edgebandMaterials.map((eb) => (
                  <SelectItem key={eb.edgeband_id} value={eb.edgeband_id}>
                    {eb.name} ({eb.thickness_mm}mm)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-xs font-medium text-muted-foreground uppercase">
              Apply to Sides
            </div>
            <div className="grid grid-cols-4 gap-2">
              {sides.map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => toggleSide(side)}
                  className={cn(
                    "h-8 rounded border text-xs font-medium transition-colors",
                    value.sides[side]
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "border-muted hover:bg-muted"
                  )}
                >
                  {side}
                </button>
              ))}
            </div>

            {shortcode && (
              <div className="pt-2 border-t">
                <Badge variant="outline" className="font-mono text-blue-600">
                  {shortcode}
                </Badge>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Full width version
  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={value.edgeband_id || ""}
        onValueChange={(v) => onChange({ ...value, edgeband_id: v })}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select edgeband..." />
        </SelectTrigger>
        <SelectContent>
          {edgebandMaterials.map((eb) => (
            <SelectItem key={eb.edgeband_id} value={eb.edgeband_id}>
              {eb.name} ({eb.thickness_mm}mm)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-1">
        {sides.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => toggleSide(side)}
            className={cn(
              "flex-1 h-7 rounded border text-xs font-medium transition-colors",
              value.sides[side]
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "border-muted hover:bg-muted"
            )}
          >
            {side}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GROOVE TYPE SELECTOR
// ============================================================

interface GrooveEntry {
  type_code: string;
  width_mm: number;
  depth_mm: number;
  side: string;
}

interface GrooveTypeSelectorProps {
  value: GrooveEntry[];
  onChange: (value: GrooveEntry[]) => void;
  compact?: boolean;
  className?: string;
}

export function GrooveTypeSelector({
  value,
  onChange,
  compact = false,
  className,
}: GrooveTypeSelectorProps) {
  const { grooveTypes, isLoading } = useOperationTypes();

  const addGroove = (type: GrooveType) => {
    onChange([
      ...value,
      {
        type_code: type.code,
        width_mm: type.default_width_mm || 4,
        depth_mm: type.default_depth_mm || 8,
        side: "W1",
      },
    ]);
  };

  const removeGroove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateGroove = (index: number, updates: Partial<GrooveEntry>) => {
    onChange(value.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  };

  const shortcodes = value.map((g) =>
    formatGrooveShortcode(g.type_code, g.depth_mm, g.width_mm, g.side)
  );

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-mono justify-between gap-1",
              value.length > 0 ? "text-amber-600" : "text-muted-foreground",
              className
            )}
          >
            {value.length > 0 ? `GR:${value.length}` : "GR:—"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Grooves
              </span>
              <Select
                value=""
                onValueChange={(code) => {
                  const type = grooveTypes.find((t) => t.code === code);
                  if (type) addGroove(type);
                }}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </SelectTrigger>
                <SelectContent>
                  {grooveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.code} - {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No grooves added
              </div>
            )}

            {value.map((groove, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 border rounded bg-muted/30"
              >
                <Badge variant="outline" className="font-mono text-amber-600 text-xs">
                  {groove.type_code}
                </Badge>
                <Input
                  type="number"
                  value={groove.depth_mm}
                  onChange={(e) =>
                    updateGroove(idx, { depth_mm: parseFloat(e.target.value) || 0 })
                  }
                  className="h-6 w-14 text-xs text-center"
                  placeholder="D"
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={groove.width_mm}
                  onChange={(e) =>
                    updateGroove(idx, { width_mm: parseFloat(e.target.value) || 0 })
                  }
                  className="h-6 w-14 text-xs text-center"
                  placeholder="W"
                />
                <Select
                  value={groove.side}
                  onValueChange={(v) => updateGroove(idx, { side: v })}
                >
                  <SelectTrigger className="h-6 w-14 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["L1", "L2", "W1", "W2"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeGroove(idx)}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {shortcodes.length > 0 && (
              <div className="pt-2 border-t flex flex-wrap gap-1">
                {shortcodes.map((sc, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-amber-600 text-xs">
                    {sc}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Full version - render inline
  return (
    <div className={cn("space-y-2", className)}>
      {value.map((groove, idx) => (
        <div key={idx} className="flex items-center gap-1 text-xs">
          <Badge variant="outline" className="font-mono text-amber-600">
            {groove.type_code}
          </Badge>
          <Input
            type="number"
            value={groove.depth_mm}
            onChange={(e) =>
              updateGroove(idx, { depth_mm: parseFloat(e.target.value) || 0 })
            }
            className="h-6 w-12 text-xs"
            placeholder="D"
          />
          <span>×</span>
          <Input
            type="number"
            value={groove.width_mm}
            onChange={(e) =>
              updateGroove(idx, { width_mm: parseFloat(e.target.value) || 0 })
            }
            className="h-6 w-12 text-xs"
            placeholder="W"
          />
          <Select
            value={groove.side}
            onValueChange={(v) => updateGroove(idx, { side: v })}
          >
            <SelectTrigger className="h-6 w-14 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["L1", "L2", "W1", "W2"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => removeGroove(idx)}
            className="text-red-500 hover:bg-red-50 p-1 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Select
        value=""
        onValueChange={(code) => {
          const type = grooveTypes.find((t) => t.code === code);
          if (type) addGroove(type);
        }}
      >
        <SelectTrigger className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Groove
        </SelectTrigger>
        <SelectContent>
          {grooveTypes.map((t) => (
            <SelectItem key={t.id} value={t.code}>
              {t.code} - {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// HOLE TYPE SELECTOR
// ============================================================

interface HoleEntry {
  type_code: string;
  face: "F" | "B"; // Front or Back
}

interface HoleTypeSelectorProps {
  value: HoleEntry[];
  onChange: (value: HoleEntry[]) => void;
  compact?: boolean;
  className?: string;
}

export function HoleTypeSelector({
  value,
  onChange,
  compact = false,
  className,
}: HoleTypeSelectorProps) {
  const { holeTypes, isLoading } = useOperationTypes();

  const addHole = (type: HoleType) => {
    onChange([...value, { type_code: type.code, face: "F" }]);
  };

  const removeHole = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateHole = (index: number, updates: Partial<HoleEntry>) => {
    onChange(value.map((h, i) => (i === index ? { ...h, ...updates } : h)));
  };

  const shortcodes = value.map((h) => formatHoleShortcode(h.type_code, h.face));

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-mono justify-between gap-1",
              value.length > 0 ? "text-purple-600" : "text-muted-foreground",
              className
            )}
          >
            {value.length > 0 ? `H:${value.length}` : "H:—"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Holes
              </span>
              <Select
                value=""
                onValueChange={(code) => {
                  const type = holeTypes.find((t) => t.code === code);
                  if (type) addHole(type);
                }}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </SelectTrigger>
                <SelectContent>
                  {holeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.code} - {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No holes added
              </div>
            )}

            {value.map((hole, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 border rounded bg-muted/30"
              >
                <Badge variant="outline" className="font-mono text-purple-600 text-xs">
                  {hole.type_code}
                </Badge>
                <div className="flex gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => updateHole(idx, { face: "F" })}
                    className={cn(
                      "flex-1 h-6 text-xs rounded border transition-colors",
                      hole.face === "F"
                        ? "bg-purple-100 border-purple-300 text-purple-700"
                        : "border-muted hover:bg-muted"
                    )}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => updateHole(idx, { face: "B" })}
                    className={cn(
                      "flex-1 h-6 text-xs rounded border transition-colors",
                      hole.face === "B"
                        ? "bg-purple-100 border-purple-300 text-purple-700"
                        : "border-muted hover:bg-muted"
                    )}
                  >
                    Back
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeHole(idx)}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {shortcodes.length > 0 && (
              <div className="pt-2 border-t flex flex-wrap gap-1">
                {shortcodes.map((sc, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-purple-600 text-xs">
                    {sc}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.map((hole, idx) => (
        <div key={idx} className="flex items-center gap-1 text-xs">
          <Badge variant="outline" className="font-mono text-purple-600">
            {hole.type_code}
          </Badge>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => updateHole(idx, { face: "F" })}
              className={cn(
                "h-6 px-2 text-xs rounded border",
                hole.face === "F" ? "bg-purple-100 border-purple-300" : "border-muted"
              )}
            >
              F
            </button>
            <button
              type="button"
              onClick={() => updateHole(idx, { face: "B" })}
              className={cn(
                "h-6 px-2 text-xs rounded border",
                hole.face === "B" ? "bg-purple-100 border-purple-300" : "border-muted"
              )}
            >
              B
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeHole(idx)}
            className="text-red-500 hover:bg-red-50 p-1 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Select
        value=""
        onValueChange={(code) => {
          const type = holeTypes.find((t) => t.code === code);
          if (type) addHole(type);
        }}
      >
        <SelectTrigger className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Hole
        </SelectTrigger>
        <SelectContent>
          {holeTypes.map((t) => (
            <SelectItem key={t.id} value={t.code}>
              {t.code} - {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// CNC TYPE SELECTOR
// ============================================================

interface CncEntry {
  type_code: string;
}

interface CncTypeSelectorProps {
  value: CncEntry[];
  onChange: (value: CncEntry[]) => void;
  compact?: boolean;
  className?: string;
}

export function CncTypeSelector({
  value,
  onChange,
  compact = false,
  className,
}: CncTypeSelectorProps) {
  const { cncTypes, isLoading } = useOperationTypes();

  const addCnc = (type: CncOperationType) => {
    onChange([...value, { type_code: type.code }]);
  };

  const removeCnc = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const shortcodes = value.map((c) => formatCncShortcode(c.type_code));

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-mono justify-between gap-1",
              value.length > 0 ? "text-emerald-600" : "text-muted-foreground",
              className
            )}
          >
            {value.length > 0 ? `CNC:${value.length}` : "CNC:—"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                CNC Operations
              </span>
              <Select
                value=""
                onValueChange={(code) => {
                  const type = cncTypes.find((t) => t.code === code);
                  if (type) addCnc(type);
                }}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </SelectTrigger>
                <SelectContent>
                  {cncTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.code} - {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No CNC operations
              </div>
            )}

            {value.map((cnc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 border rounded bg-muted/30"
              >
                <Badge variant="outline" className="font-mono text-emerald-600 text-xs">
                  {cnc.type_code}
                </Badge>
                <button
                  type="button"
                  onClick={() => removeCnc(idx)}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {shortcodes.length > 0 && (
              <div className="pt-2 border-t flex flex-wrap gap-1">
                {shortcodes.map((sc, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-emerald-600 text-xs">
                    {sc}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.map((cnc, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="font-mono text-emerald-600">
            {cnc.type_code}
          </Badge>
          <button
            type="button"
            onClick={() => removeCnc(idx)}
            className="text-red-500 hover:bg-red-50 p-1 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Select
        value=""
        onValueChange={(code) => {
          const type = cncTypes.find((t) => t.code === code);
          if (type) addCnc(type);
        }}
      >
        <SelectTrigger className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add CNC
        </SelectTrigger>
        <SelectContent>
          {cncTypes.map((t) => (
            <SelectItem key={t.id} value={t.code}>
              {t.code} - {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// COMBINED OPERATIONS INPUT
// ============================================================

export interface OperationsData {
  edgebanding: {
    edgeband_id?: string;
    sides: Record<string, boolean>;
  };
  grooves: GrooveEntry[];
  holes: HoleEntry[];
  cnc: CncEntry[];
}

interface OperationsInputProps {
  value: OperationsData;
  onChange: (value: OperationsData) => void;
  compact?: boolean;
  className?: string;
}

export function OperationsInput({
  value,
  onChange,
  compact = true,
  className,
}: OperationsInputProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <EdgebandSelector
        value={value.edgebanding}
        onChange={(eb) => onChange({ ...value, edgebanding: eb })}
        compact={compact}
      />
      <GrooveTypeSelector
        value={value.grooves}
        onChange={(gr) => onChange({ ...value, grooves: gr })}
        compact={compact}
      />
      <HoleTypeSelector
        value={value.holes}
        onChange={(h) => onChange({ ...value, holes: h })}
        compact={compact}
      />
      <CncTypeSelector
        value={value.cnc}
        onChange={(c) => onChange({ ...value, cnc: c })}
        compact={compact}
      />
    </div>
  );
}

// ============================================================
// SHORTCODE DISPLAY (Read-only badges)
// ============================================================

export interface ShortcodeDisplayProps {
  edgebanding?: { edgeband_id?: string; sides: Record<string, boolean> };
  grooves?: GrooveEntry[];
  holes?: HoleEntry[];
  cnc?: CncEntry[];
  className?: string;
}

export function ShortcodeDisplay({
  edgebanding,
  grooves,
  holes,
  cnc,
  className,
}: ShortcodeDisplayProps) {
  const { edgebandMaterials } = useOperationTypes();

  const hasSomething =
    (edgebanding && Object.values(edgebanding.sides).some(Boolean)) ||
    (grooves && grooves.length > 0) ||
    (holes && holes.length > 0) ||
    (cnc && cnc.length > 0);

  if (!hasSomething) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const ebShortcode = edgebanding?.edgeband_id
    ? formatEdgebandShortcode(
        edgebandMaterials.find((e) => e.edgeband_id === edgebanding.edgeband_id)?.name?.substring(0, 4) || "EB",
        edgebanding.sides
      )
    : null;

  const grShortcodes = grooves?.map((g) =>
    formatGrooveShortcode(g.type_code, g.depth_mm, g.width_mm, g.side)
  );

  const hShortcodes = holes?.map((h) => formatHoleShortcode(h.type_code, h.face));

  const cncShortcodes = cnc?.map((c) => formatCncShortcode(c.type_code));

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {ebShortcode && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-blue-50 text-blue-700 border-blue-200">
          {ebShortcode}
        </Badge>
      )}
      {grShortcodes?.map((sc, i) => (
        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-amber-50 text-amber-700 border-amber-200">
          {sc}
        </Badge>
      ))}
      {hShortcodes?.map((sc, i) => (
        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-purple-50 text-purple-700 border-purple-200">
          {sc}
        </Badge>
      ))}
      {cncShortcodes?.map((sc, i) => (
        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-emerald-50 text-emerald-700 border-emerald-200">
          {sc}
        </Badge>
      ))}
    </div>
  );
}

