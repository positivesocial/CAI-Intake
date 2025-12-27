"use client";

import * as React from "react";
import { Zap, Plus, ArrowRight, Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useIntakeStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";

interface QuickAddFieldProps {
  /** Callback when a part is successfully parsed - receives parsed part data */
  onPartParsed?: (part: CutPart) => void;
  /** 
   * If true (default), adds directly to the parts list (store).
   * If false, only calls onPartParsed callback - use this when embedding
   * in ManualEntryForm to add to the Excel-like table instead.
   */
  addToStore?: boolean;
}

/**
 * Canonical format for quick parsing:
 * LABEL L W [T] [QTY] [EB:edges] [GR:side] [H:pattern] [CNC:program] [NOTE:text]
 * 
 * Examples:
 * - "Side panel 720 560"
 * - "Shelf 600 400 18 x4"
 * - "Top 800 600 x2 EB:L1,L2"
 * - "Base 1000 500 18 x1 GR:W2 H:32mm"
 */
const CANONICAL_FORMAT = "LABEL L W [T] [QTY] [EB:edges] [GR:side] [H:pattern] [CNC:prog]";

// Parse canonical format
function parseCanonical(input: string, defaults: {
  materialId: string;
  thickness: number;
  edgebandId: string;
  capabilities: {
    edging?: boolean;
    grooves?: boolean;
    cnc_holes?: boolean;
    cnc_routing?: boolean;
    custom_cnc?: boolean;
  };
}): CutPart | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Main pattern: Label followed by L W, then optional modifiers
  // Flexible pattern that captures label, dimensions, and modifiers
  const tokens = trimmed.split(/\s+/);
  
  if (tokens.length < 3) return null;
  
  let label = "";
  let L = 0;
  let W = 0;
  let thickness = defaults.thickness;
  let qty = 1;
  let edging: string[] = [];
  let grooveSide = "";
  let holePattern = "";
  let cncProgram = "";
  let note = "";
  
  let i = 0;
  
  // Extract label (non-numeric tokens at start)
  while (i < tokens.length && !/^\d+(\.\d+)?$/.test(tokens[i]) && !tokens[i].startsWith("x") && !tokens[i].includes(":")) {
    label += (label ? " " : "") + tokens[i];
    i++;
  }
  
  // Extract L
  if (i < tokens.length && /^\d+(\.\d+)?$/.test(tokens[i])) {
    L = parseFloat(tokens[i]);
    i++;
  } else {
    return null; // L is required
  }
  
  // Extract W
  if (i < tokens.length && /^\d+(\.\d+)?$/.test(tokens[i])) {
    W = parseFloat(tokens[i]);
    i++;
  } else {
    return null; // W is required
  }
  
  // Process remaining tokens (thickness, qty, modifiers)
  while (i < tokens.length) {
    const token = tokens[i];
    
    // Thickness (plain number, typically 16, 18, 19, 25, etc.)
    if (/^\d+(\.\d+)?$/.test(token)) {
      const num = parseFloat(token);
      // Only consider it thickness if it's a reasonable thickness value
      if (num >= 3 && num <= 50) {
        thickness = num;
      }
    }
    // Quantity: x2, x4, qty2, q3
    else if (/^[xq](\d+)$/i.test(token)) {
      const match = token.match(/^[xq](\d+)$/i);
      if (match) qty = parseInt(match[1]);
    }
    else if (/^qty(\d+)$/i.test(token)) {
      const match = token.match(/^qty(\d+)$/i);
      if (match) qty = parseInt(match[1]);
    }
    // Edge banding: EB:L1,L2 or EB:all
    else if (/^EB:/i.test(token)) {
      const edges = token.slice(3).toUpperCase();
      if (edges === "ALL") {
        edging = ["L1", "L2", "W1", "W2"];
      } else {
        edging = edges.split(",").filter(e => ["L1", "L2", "W1", "W2"].includes(e));
      }
    }
    // Groove: GR:L1 or GR:W2
    else if (/^GR:/i.test(token)) {
      grooveSide = token.slice(3).toUpperCase();
    }
    // Holes: H:32mm or H:system
    else if (/^H:/i.test(token)) {
      holePattern = token.slice(2);
    }
    // CNC: CNC:program_name
    else if (/^CNC:/i.test(token)) {
      cncProgram = token.slice(4);
    }
    // Note: NOTE:text or N:text
    else if (/^(NOTE|N):/i.test(token)) {
      note = token.replace(/^(NOTE|N):/i, "");
    }
    
    i++;
  }
  
  // Validate minimum requirements
  if (L <= 0 || W <= 0) return null;
  
  // Build ops based on capabilities
  const ops: CutPart["ops"] = {};
  
  // Edging
  if (edging.length > 0 && defaults.capabilities.edging) {
    ops.edging = {
      edges: edging.reduce((acc, edge) => {
        acc[edge] = { apply: true, edgeband_id: defaults.edgebandId };
        return acc;
      }, {} as Record<string, { apply: boolean; edgeband_id?: string }>),
    };
  }
  
  // Grooves
  if (grooveSide && defaults.capabilities.grooves) {
    ops.grooves = [{
      groove_id: generateId("GRV"),
      side: grooveSide as "L1" | "L2" | "W1" | "W2",
      offset_mm: 10,
      depth_mm: 8,
      width_mm: 4,
    }];
  }
  
  // Holes
  if (holePattern && defaults.capabilities.cnc_holes) {
    ops.holes = [{
      pattern_id: holePattern.includes("32") ? "SYS32" : undefined,
      face: "front" as const,
      notes: holePattern,
    }];
  }
  
  // CNC
  if (cncProgram && (defaults.capabilities.cnc_routing || defaults.capabilities.custom_cnc)) {
    ops.custom_cnc_ops = [{
      op_type: "program",
      payload: { program_name: cncProgram },
      notes: `CNC: ${cncProgram}`,
    }];
  }
  
  return {
    part_id: generateId("P"),
    label: label || undefined,
    qty,
    size: { L, W },
    thickness_mm: thickness,
    material_id: defaults.materialId,
    allow_rotation: true,
    notes: note ? { operator: note } : undefined,
    ops: Object.keys(ops).length > 0 ? ops : undefined,
    audit: {
      source_method: "manual",
      confidence: 1,
      human_verified: true,
    },
  };
}

export function QuickAddField({ onPartParsed, addToStore = true }: QuickAddFieldProps) {
  const [input, setInput] = React.useState("");
  const [lastAdded, setLastAdded] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const { currentCutlist, addPart } = useIntakeStore();
  const capabilities = currentCutlist.capabilities;
  
  const defaultMaterialId = currentCutlist.materials[0]?.material_id || "MAT-DEFAULT";
  const defaultEdgebandId = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";
  const defaultThickness = currentCutlist.materials[0]?.thickness_mm || 18;
  
  // Build dynamic format string based on capabilities
  const formatHint = React.useMemo(() => {
    let format = "LABEL L W [T] [QTY]";
    if (capabilities.edging) format += " [EB:edges]";
    if (capabilities.grooves) format += " [GR:side]";
    if (capabilities.cnc_holes) format += " [H:pattern]";
    if (capabilities.cnc_routing || capabilities.custom_cnc) format += " [CNC:prog]";
    return format;
  }, [capabilities]);
  
  // Build example based on capabilities
  const example = React.useMemo(() => {
    let ex = "Side panel 720 560 18 x2";
    if (capabilities.edging) ex += " EB:L1,L2";
    if (capabilities.grooves) ex += " GR:W2";
    return ex;
  }, [capabilities]);
  
  const handleQuickAdd = React.useCallback(() => {
    const part = parseCanonical(input, {
      materialId: defaultMaterialId,
      thickness: defaultThickness,
      edgebandId: defaultEdgebandId,
      capabilities,
    });
    
    if (part) {
      // Only add to store if explicitly requested (standalone mode)
      if (addToStore) {
        addPart(part);
      }
      // Always call the callback if provided (for Excel table integration)
      onPartParsed?.(part);
      setLastAdded(part.label || `${part.size.L}×${part.size.W}`);
      setInput("");
      inputRef.current?.focus();
      
      // Clear lastAdded after 2 seconds
      setTimeout(() => setLastAdded(null), 2000);
    }
  }, [input, defaultMaterialId, defaultThickness, defaultEdgebandId, capabilities, addPart, onPartParsed, addToStore]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      handleQuickAdd();
    }
  };
  
  const copyFormat = () => {
    navigator.clipboard.writeText(example);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <div className="space-y-3">
      {/* Format display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--cai-teal)]" />
          <span className="text-sm font-medium">Quick Add</span>
          <Badge variant="outline" className="text-xs font-mono">
            {formatHint}
          </Badge>
        </div>
        <button
          onClick={copyFormat}
          className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy example"}
        </button>
      </div>
      
      {/* Input with add button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={example}
            className="font-mono text-sm pr-20"
          />
          {lastAdded && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Badge variant="success" className="text-xs animate-in fade-in slide-in-from-right-2">
                Added!
              </Badge>
            </div>
          )}
        </div>
        <Button
          onClick={handleQuickAdd}
          disabled={!input.trim()}
          variant="primary"
          size="sm"
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      
      {/* Quick reference */}
      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          Format:
        </span>
        <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded">x2</code>
        <span>qty</span>
        {capabilities.edging && (
          <>
            <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">EB:L1,L2</code>
            <span>edging</span>
          </>
        )}
        {capabilities.grooves && (
          <>
            <code className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">GR:W2</code>
            <span>groove</span>
          </>
        )}
        {capabilities.cnc_holes && (
          <>
            <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">H:32mm</code>
            <span>holes</span>
          </>
        )}
        {(capabilities.cnc_routing || capabilities.custom_cnc) && (
          <>
            <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">CNC:prog</code>
            <span>program</span>
          </>
        )}
      </div>
    </div>
  );
}

