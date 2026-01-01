"use client";

import * as React from "react";
import { Zap, Plus, Copy, Check, Info, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIntakeStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import type { CutPart } from "@/lib/schema";

interface QuickAddFieldProps {
  onPartParsed?: (part: CutPart) => void;
  addToStore?: boolean;
}

/**
 * QUICK ADD FORMAT v2 - Ultra-fast entry
 * 
 * Basic: L W [Qty]
 * Full:  L W [Qty] [ops...] ["Label"]
 * 
 * Dimensions can use 'x' separator: 720x560x2
 * 
 * Operations (order doesn't matter):
 * - Edging:  4e, 2L, 2W, L1, L2, W1, W2, all
 * - Groove:  gL, gW, gL1, gL2, gW1, gW2
 * - Holes:   h, h32, h:pattern
 * - CNC:     c, c:program
 * 
 * Label: quoted at end "My Label"
 * 
 * Examples:
 * - 720 560           → 720×560, qty 1
 * - 720x560x2         → 720×560, qty 2
 * - 720 560 2 4e      → with all edges
 * - 720 560 2L gW     → 2 long edges + groove
 * - 600 400 2 4e gW h "Shelf" → full spec
 */

// Edge banding shortcodes
const EDGE_PATTERNS: Record<string, string[]> = {
  "4e": ["L1", "L2", "W1", "W2"],
  "all": ["L1", "L2", "W1", "W2"],
  "2l": ["L1", "L2"],
  "2w": ["W1", "W2"],
  "l1": ["L1"],
  "l2": ["L2"],
  "w1": ["W1"],
  "w2": ["W2"],
  "1l": ["L1"],
  "1w": ["W1"],
  "l": ["L1", "L2"],  // Both long edges
  "w": ["W1", "W2"],  // Both width edges
  // Combined patterns
  "l1w1": ["L1", "W1"],
  "l1l2": ["L1", "L2"],
  "w1w2": ["W1", "W2"],
  "3e": ["L1", "L2", "W1"], // 3 edges (common for cabinet parts)
};

// Groove patterns - g prefix
const GROOVE_PATTERN = /^g(l1?|l2|w1?|w2)$/i;

// Hole patterns - h prefix
const HOLE_PATTERN = /^h(:?\d*m?m?|:\w+)?$/i;

// CNC patterns - c prefix  
const CNC_PATTERN = /^c(:\w+)?$/i;

// Quantity patterns
const QTY_PATTERN = /^(\d+)$/;

// Label pattern (quoted string at end)
const LABEL_PATTERN = /"([^"]+)"$/;

function parseQuickFormat(input: string, defaults: {
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
  let trimmed = input.trim();
  if (!trimmed) return null;

  // Extract label if present (quoted string at end)
  let label = "";
  const labelMatch = trimmed.match(LABEL_PATTERN);
  if (labelMatch) {
    label = labelMatch[1];
    trimmed = trimmed.slice(0, labelMatch.index).trim();
  }

  // Normalize: replace 'x' with space for dimension parsing
  // Handle formats like "720x560x2" → "720 560 2"
  const normalized = trimmed.replace(/(\d)x(\d)/gi, "$1 $2");
  
  // Split into tokens
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  
  if (tokens.length < 2) return null;

  // First two tokens must be dimensions
  const L = parseFloat(tokens[0]);
  const W = parseFloat(tokens[1]);
  
  if (isNaN(L) || isNaN(W) || L <= 0 || W <= 0) return null;

  // Parse remaining tokens
  let qty = 1;
  let edging: string[] = [];
  let grooveSide = "";
  let holePattern = "";
  let cncProgram = "";

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    
    // Check for quantity (plain number)
    if (QTY_PATTERN.test(token)) {
      const num = parseInt(token);
      if (num >= 1 && num <= 9999) {
        qty = num;
      }
      continue;
    }
    
    // Check for edge patterns
    if (EDGE_PATTERNS[token]) {
      edging = [...new Set([...edging, ...EDGE_PATTERNS[token]])];
      continue;
    }
    
    // Check for groove (g prefix)
    if (GROOVE_PATTERN.test(token)) {
      const side = token.slice(1).toUpperCase();
      // Normalize: gL → L1, gW → W1, gL2 → L2, etc.
      if (side === "L" || side === "L1") grooveSide = "L1";
      else if (side === "L2") grooveSide = "L2";
      else if (side === "W" || side === "W1") grooveSide = "W1";
      else if (side === "W2") grooveSide = "W2";
      continue;
    }
    
    // Check for holes (h prefix)
    if (HOLE_PATTERN.test(token)) {
      if (token.includes(":")) {
        holePattern = token.slice(2); // h:32mm → 32mm
      } else if (token.length > 1) {
        holePattern = token.slice(1); // h32 → 32
      } else {
        holePattern = "SYS32"; // Default system 32
      }
      continue;
    }
    
    // Check for CNC (c prefix)
    if (CNC_PATTERN.test(token)) {
      if (token.includes(":")) {
        cncProgram = token.slice(2);
      } else {
        cncProgram = "default";
      }
      continue;
    }
    
    // If unrecognized and no label yet, treat as label
    if (!label && i === tokens.length - 1 && !/^\d/.test(token)) {
      label = tokens[i]; // Keep original case for label
    }
  }

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
      pattern_id: holePattern.includes("32") ? "SYS32" : holePattern,
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
    thickness_mm: defaults.thickness,
    material_id: defaults.materialId,
    allow_rotation: true,
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
  const [showHelp, setShowHelp] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const { currentCutlist, addPart } = useIntakeStore();
  const capabilities = currentCutlist.capabilities;
  
  const defaultMaterialId = currentCutlist.materials[0]?.material_id || "MAT-DEFAULT";
  const defaultEdgebandId = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";
  const defaultThickness = currentCutlist.materials[0]?.thickness_mm || 18;
  
  // Dynamic placeholder based on capabilities
  const placeholder = React.useMemo(() => {
    let ex = "720 560 2";
    if (capabilities.edging) ex += " 4e";
    if (capabilities.grooves) ex += " gW";
    return ex;
  }, [capabilities]);
  
  const handleQuickAdd = React.useCallback(() => {
    const part = parseQuickFormat(input, {
      materialId: defaultMaterialId,
      thickness: defaultThickness,
      edgebandId: defaultEdgebandId,
      capabilities,
    });
    
    if (part) {
      if (addToStore) {
        addPart(part);
      }
      onPartParsed?.(part);
      setLastAdded(part.label || `${part.size.L}×${part.size.W}`);
      setInput("");
      inputRef.current?.focus();
      
      setTimeout(() => setLastAdded(null), 2000);
    }
  }, [input, defaultMaterialId, defaultThickness, defaultEdgebandId, capabilities, addPart, onPartParsed, addToStore]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      handleQuickAdd();
    }
  };
  
  return (
    <div className="space-y-2">
      {/* Header with help toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--cai-teal)]" />
          <span className="text-sm font-medium">Quick Add</span>
          <Badge variant="outline" className="text-xs font-mono px-1.5">
            L W Qty
          </Badge>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <Keyboard className="h-3.5 w-3.5" />
                {showHelp ? "Hide" : "Shortcuts"}
              </button>
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts reference</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Expanded help */}
      {showHelp && (
        <div className="p-3 rounded-lg bg-[var(--muted)]/50 border text-xs space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="font-medium text-[var(--foreground)]">Format</div>
            <div className="font-mono text-[var(--muted-foreground)]">L W [Qty] [ops] ["Label"]</div>
            
            <div className="font-medium text-[var(--foreground)]">Alt format</div>
            <div className="font-mono text-[var(--muted-foreground)]">LxWxQty</div>
          </div>
          
          <div className="pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-[var(--foreground)]">
              <span className="font-medium">Edge banding:</span>
            </div>
            <div className="font-mono text-[var(--muted-foreground)]">
              4e all 2L 2W L1 L2 W1 W2
            </div>
            
            <div className="text-[var(--foreground)]">
              <span className="font-medium">Groove:</span>
            </div>
            <div className="font-mono text-[var(--muted-foreground)]">
              gL gW gL1 gL2 gW1 gW2
            </div>
            
            <div className="text-[var(--foreground)]">
              <span className="font-medium">Holes:</span>
            </div>
            <div className="font-mono text-[var(--muted-foreground)]">
              h h32 h:pattern
            </div>
            
            <div className="text-[var(--foreground)]">
              <span className="font-medium">CNC:</span>
            </div>
            <div className="font-mono text-[var(--muted-foreground)]">
              c c:program
            </div>
          </div>
          
          <div className="pt-2 border-t space-y-1">
            <div className="font-medium text-[var(--foreground)]">Examples:</div>
            <div className="font-mono text-[var(--muted-foreground)] space-y-0.5">
              <div>720 560 2</div>
              <div>720x560x4 4e gW</div>
              <div>600 400 2 2L gW h "Shelf"</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Input with add button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="font-mono text-sm h-9"
          />
          {lastAdded && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Badge variant="success" className="text-xs animate-in fade-in slide-in-from-right-2">
                ✓ Added
              </Badge>
            </div>
          )}
        </div>
        <Button
          onClick={handleQuickAdd}
          disabled={!input.trim()}
          variant="primary"
          size="sm"
          className="shrink-0 h-9"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {/* Compact inline hints */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
        <span className="opacity-70">Quick:</span>
        {capabilities.edging && (
          <code className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded">4e</code>
        )}
        {capabilities.edging && (
          <code className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded">2L</code>
        )}
        {capabilities.grooves && (
          <code className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">gW</code>
        )}
        {capabilities.cnc_holes && (
          <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded">h</code>
        )}
        {(capabilities.cnc_routing || capabilities.custom_cnc) && (
          <code className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded">c</code>
        )}
        <span className="opacity-50">|</span>
        <span className="opacity-70">Enter to add</span>
      </div>
    </div>
  );
}
