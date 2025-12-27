"use client";

/**
 * CAI Intake - Streamlined Entry Form
 * 
 * A mobile-first, decluttered manual entry interface that replaces the
 * complex spreadsheet-style table with a simpler, more intuitive design.
 * 
 * Features:
 * - Responsive: Cards on mobile, compact table on desktop
 * - 6 essential columns only (Label, L×W, Qty, Material, Ops, Actions)
 * - Unified operations panel for all ops
 * - Smart defaults remembered from last entry
 * - Quick keyboard navigation
 */

import * as React from "react";
import { Plus, Trash2, ArrowDown, Keyboard, LayoutGrid, LayoutList, Copy, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import { PartCard, type PartCardData } from "@/components/parts/PartCard";
import { BulkOpsPanel } from "@/components/parts/BulkOpsPanel";
import type { CutPart, CutlistCapabilities } from "@/lib/schema";
import { generateAutoNotesFromPartOps, mergeAutoNotes } from "@/lib/schema";
import { cn } from "@/lib/utils";
import type { OperationsData } from "@/components/operations";

// ============================================================
// REF TYPE
// ============================================================

export interface StreamlinedEntryFormRef {
  addRowFromPart: (part: CutPart) => void;
}

// ============================================================
// PROPS
// ============================================================

interface StreamlinedEntryFormProps {
  onPartAdded?: (part: CutPart) => void;
}

// ============================================================
// HELPERS
// ============================================================

const createEmptyRow = (
  defaultMaterial: string,
  defaultThickness: string,
  defaultEdgeband: string
): PartCardData => ({
  id: generateId("ROW"),
  label: "",
  qty: "1",
  L: "",
  W: "",
  thickness_mm: defaultThickness,
  material_id: defaultMaterial,
  allow_rotation: true,
  group_id: "",
  notes: "",
  operations: {
    edgebanding: { edgeband_id: defaultEdgeband, sides: { L1: false, L2: false, W1: false, W2: false } },
    grooves: [],
    holes: [],
    cnc: [],
  },
});

const convertPartToRow = (
  part: CutPart,
  defaultEdgeband: string
): PartCardData => {
  const ebSides = {
    L1: !!part.ops?.edging?.edges?.L1?.apply,
    L2: !!part.ops?.edging?.edges?.L2?.apply,
    W1: !!part.ops?.edging?.edges?.W1?.apply,
    W2: !!part.ops?.edging?.edges?.W2?.apply,
  };
  const ebId = part.ops?.edging?.edges?.L1?.edgeband_id || defaultEdgeband;

  return {
    id: generateId("ROW"),
    label: part.label || "",
    qty: part.qty.toString(),
    L: part.size.L.toString(),
    W: part.size.W.toString(),
    thickness_mm: part.thickness_mm.toString(),
    material_id: part.material_id || "",
    allow_rotation: part.allow_rotation ?? true,
    group_id: part.group_id || "",
    notes: part.notes?.operator || "",
    operations: {
      edgebanding: { edgeband_id: ebId, sides: ebSides },
      grooves: part.ops?.grooves?.map(g => ({
        type_code: g.groove_id?.substring(0, 4) || "GRV",
        width_mm: g.width_mm || 4,
        depth_mm: g.depth_mm || 8,
        side: g.side || "W1",
      })) || [],
      holes: part.ops?.holes?.map(h => ({
        type_code: h.pattern_id || "S32",
        face: (h.face === "front" ? "F" : "B") as "F" | "B",
      })) || [],
      cnc: part.ops?.custom_cnc_ops?.map(c => ({
        type_code: (c.payload as { program_name?: string } | undefined)?.program_name || c.op_type || "CNC",
      })) || [],
    },
  };
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const StreamlinedEntryForm = React.forwardRef<StreamlinedEntryFormRef, StreamlinedEntryFormProps>(
  function StreamlinedEntryForm({ onPartAdded }, ref) {
    const { currentCutlist, addPart, isAdvancedMode } = useIntakeStore();
    const capabilities = currentCutlist.capabilities;
    const defaultMaterial = currentCutlist.materials[0]?.material_id || "";
    const defaultThickness = "18";
    const defaultEdgeband = currentCutlist.edgebands?.[0]?.edgeband_id || "EB-WHITE-0.8";

    // View mode: table (desktop) or cards (mobile)
    const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");

    // Rows state
    // Initialize with 25 empty rows for efficient data entry
    const [rows, setRows] = React.useState<PartCardData[]>(() => 
      Array.from({ length: 25 }, () => 
        createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband)
      )
    );

    // Selection state
    const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());

    // Bulk ops panel
    const [showBulkOpsPanel, setShowBulkOpsPanel] = React.useState(false);

    // Validation errors
    const [errors, setErrors] = React.useState<Record<string, Record<string, boolean>>>({});

    // Material options
    const materialOptions = currentCutlist.materials.map((m) => ({
      value: m.material_id,
      label: `${m.name} (${m.thickness_mm}mm)`,
    }));

    // Expose addRowFromPart to parent
    React.useImperativeHandle(ref, () => ({
      addRowFromPart: (part: CutPart) => {
        const newRow = convertPartToRow(part, defaultEdgeband);
        setRows(prev => {
          const emptyIndex = prev.findIndex(r => !r.L && !r.W);
          if (emptyIndex >= 0) {
            return prev.map((r, i) => (i === emptyIndex ? newRow : r));
          }
          return [...prev, newRow];
        });
      },
    }), [defaultEdgeband]);

    // Auto-detect mobile
    React.useEffect(() => {
      const checkMobile = () => {
        setViewMode(window.innerWidth < 768 ? "cards" : "table");
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Row operations
    const updateRow = (index: number, updates: Partial<PartCardData>) => {
      setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
      // Clear errors for updated fields
      const rowId = rows[index]?.id;
      if (rowId && errors[rowId]) {
        const updatedErrors = { ...errors[rowId] };
        Object.keys(updates).forEach(k => delete updatedErrors[k]);
        setErrors(prev => ({ ...prev, [rowId]: updatedErrors }));
      }
    };

    const addNewRow = () => {
      setRows(prev => [...prev, createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband)]);
    };

    const removeRow = (index: number) => {
      if (rows.length > 1) {
        setRows(prev => prev.filter((_, i) => i !== index));
      }
    };

    const duplicateRow = (index: number) => {
      const rowToCopy = rows[index];
      const newRow = {
        ...rowToCopy,
        id: generateId("ROW"),
        label: rowToCopy.label ? `${rowToCopy.label} (copy)` : "",
      };
      setRows(prev => [...prev.slice(0, index + 1), newRow, ...prev.slice(index + 1)]);
    };

    // Selection handlers
    const toggleRowSelection = (rowId: string) => {
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
    };

    const selectAllRows = () => {
      setSelectedRowIds(new Set(rows.map(r => r.id)));
    };

    const clearSelection = () => {
      setSelectedRowIds(new Set());
    };

    const deleteSelectedRows = () => {
      if (selectedRowIds.size === 0) return;
      setRows(prev => prev.filter(r => !selectedRowIds.has(r.id)));
      setSelectedRowIds(new Set());
      // Ensure at least one row remains
      if (rows.length - selectedRowIds.size === 0) {
        setRows([createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband)]);
      }
    };

    const duplicateSelectedRows = () => {
      if (selectedRowIds.size === 0) return;
      const newRows: PartCardData[] = [];
      rows.forEach(row => {
        newRows.push(row);
        if (selectedRowIds.has(row.id)) {
          newRows.push({
            ...row,
            id: generateId("ROW"),
            label: row.label ? `${row.label} (copy)` : "",
          });
        }
      });
      setRows(newRows);
      setSelectedRowIds(new Set());
    };

    // Apply bulk operations to selected rows
    const applyBulkOps = (ops: OperationsData, mode: "add" | "replace") => {
      setRows(prev => prev.map(row => {
        if (!selectedRowIds.has(row.id)) return row;

        if (mode === "replace") {
          return { ...row, operations: ops };
        } else {
          // Merge operations
          const merged: OperationsData = {
            edgebanding: {
              edgeband_id: ops.edgebanding.edgeband_id || row.operations.edgebanding.edgeband_id,
              sides: {
                L1: ops.edgebanding.sides.L1 || row.operations.edgebanding.sides.L1,
                L2: ops.edgebanding.sides.L2 || row.operations.edgebanding.sides.L2,
                W1: ops.edgebanding.sides.W1 || row.operations.edgebanding.sides.W1,
                W2: ops.edgebanding.sides.W2 || row.operations.edgebanding.sides.W2,
              },
            },
            grooves: [...row.operations.grooves, ...ops.grooves],
            holes: [...row.operations.holes, ...ops.holes],
            cnc: [...row.operations.cnc, ...ops.cnc],
          };
          return { ...row, operations: merged };
        }
      }));
    };

    const addSelectedRowsToParts = () => {
      let addedCount = 0;
      rows.forEach((row, index) => {
        if (selectedRowIds.has(row.id) && row.L && row.W) {
          if (validateRow(row)) {
            handleSubmitRow(index);
            addedCount++;
          }
        }
      });
      setSelectedRowIds(new Set());
      return addedCount;
    };

    const validateRow = (row: PartCardData): boolean => {
      const rowErrors: Record<string, boolean> = {};
      let valid = true;

      if (!row.L || parseFloat(row.L) <= 0) {
        rowErrors.L = true;
        valid = false;
      }
      if (!row.W || parseFloat(row.W) <= 0) {
        rowErrors.W = true;
        valid = false;
      }
      if (!row.qty || parseInt(row.qty) <= 0) {
        rowErrors.qty = true;
        valid = false;
      }

      setErrors(prev => ({ ...prev, [row.id]: rowErrors }));
      return valid;
    };

    const handleSubmitRow = (index: number) => {
      const row = rows[index];
      if (!validateRow(row)) return;

      const { operations } = row;

      // Build edging ops
      const hasEdging = Object.values(operations.edgebanding.sides).some(Boolean);
      const edgingOps = hasEdging && capabilities.edging ? {
        edging: {
          edges: {
            ...(operations.edgebanding.sides.L1 && { L1: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
            ...(operations.edgebanding.sides.L2 && { L2: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
            ...(operations.edgebanding.sides.W1 && { W1: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
            ...(operations.edgebanding.sides.W2 && { W2: { apply: true, edgeband_id: operations.edgebanding.edgeband_id || defaultEdgeband } }),
          },
        },
      } : {};

      // Build groove ops
      const grooveOps = operations.grooves.length > 0 && capabilities.grooves ? {
        grooves: operations.grooves.map((g, i) => ({
          groove_id: generateId("GRV"),
          side: g.side as "L1" | "L2" | "W1" | "W2",
          offset_mm: 10 + i * 32,
          depth_mm: g.depth_mm,
          width_mm: g.width_mm,
        })),
      } : {};

      // Build hole ops
      const holeOps = operations.holes.length > 0 && capabilities.cnc_holes ? {
        holes: operations.holes.map(h => ({
          pattern_id: h.type_code,
          face: (h.face === "F" ? "front" : "back") as "front" | "back",
        })),
      } : {};

      // Build CNC ops
      const cncOps = operations.cnc.length > 0 && (capabilities.cnc_routing || capabilities.custom_cnc) ? {
        custom_cnc_ops: operations.cnc.map(c => ({
          op_type: "program" as const,
          payload: { program_name: c.type_code },
        })),
      } : {};

      const ops = { ...edgingOps, ...grooveOps, ...holeOps, ...cncOps };
      const hasOps = Object.keys(ops).length > 0;

      // Generate notes
      const autoNotes = hasOps ? generateAutoNotesFromPartOps(ops) : "";
      const existingNotes = row.notes ? { operator: row.notes } : undefined;
      const finalNotes = autoNotes ? mergeAutoNotes(existingNotes, autoNotes) : existingNotes;

      const part: CutPart = {
        part_id: generateId("P"),
        label: row.label || undefined,
        qty: parseInt(row.qty) || 1,
        size: {
          L: parseFloat(row.L),
          W: parseFloat(row.W),
        },
        thickness_mm: parseFloat(row.thickness_mm) || 18,
        material_id: row.material_id || defaultMaterial,
        allow_rotation: row.allow_rotation !== false,
        group_id: row.group_id || undefined,
        notes: Object.keys(finalNotes || {}).length > 0 ? finalNotes : undefined,
        ops: hasOps ? ops : undefined,
        audit: {
          source_method: "manual",
          confidence: 1,
          human_verified: true,
        },
      };

      addPart(part);
      onPartAdded?.(part);

      // Clear the row
      setRows(prev =>
        prev.map((r, i) =>
          i === index ? createEmptyRow(defaultMaterial, defaultThickness, defaultEdgeband) : r
        )
      );
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[row.id];
        return newErrors;
      });
    };

    const handleAddAllParts = () => {
      let addedCount = 0;
      rows.forEach((row, index) => {
        if (row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0) {
          if (validateRow(row)) {
            handleSubmitRow(index);
            addedCount++;
          }
        }
      });
      return addedCount;
    };

    const hasValidRows = rows.some(row => row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0);
    const validRowCount = rows.filter(row => row.L && row.W && parseFloat(row.L) > 0 && parseFloat(row.W) > 0).length;

    // Check if any operations are enabled
    const hasOpsEnabled = capabilities.edging || capabilities.grooves || capabilities.cnc_holes || capabilities.cnc_routing || capabilities.custom_cnc;

    return (
      <>
      <Card className="w-full">
        <CardHeader className="pb-2 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Add Parts</CardTitle>
              <Badge variant="teal">{viewMode === "cards" ? "Card View" : "Table View"}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "table" ? "bg-[var(--cai-teal)] text-white" : "hover:bg-[var(--muted)]"
                  )}
                  title="Table view"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "cards" ? "bg-[var(--cai-teal)] text-white" : "hover:bg-[var(--muted)]"
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-[var(--muted-foreground)] hidden sm:flex items-center gap-1">
                <Keyboard className="h-3 w-3" />
                Enter to add
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Toolbar */}
          {selectedRowIds.size > 0 && (
            <div className="flex items-center gap-2 p-2 border-b border-[var(--border)] bg-[var(--cai-teal)]/5">
              <Badge variant="outline" className="bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]">
                {selectedRowIds.size} selected
              </Badge>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setShowBulkOpsPanel(true)} className="h-8 px-2 text-[var(--cai-teal)]">
                <Settings2 className="h-4 w-4 mr-1" /> Bulk Ops
              </Button>
              <Button variant="ghost" size="sm" onClick={addSelectedRowsToParts} className="h-8 px-2 text-[var(--cai-teal)]">
                <Check className="h-4 w-4 mr-1" /> Add to Parts
              </Button>
              <Button variant="ghost" size="sm" onClick={duplicateSelectedRows} className="h-8 px-2">
                <Copy className="h-4 w-4 mr-1" /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" onClick={deleteSelectedRows} className="h-8 px-2 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 px-2">
                Clear
              </Button>
            </div>
          )}

          {viewMode === "table" ? (
            /* TABLE VIEW */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="bg-[var(--muted)]">
                    <th className="w-10 px-2 py-2 border-b">
                      <label className="inline-flex p-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.size === rows.length && rows.length > 0}
                          ref={(el) => { if (el) el.indeterminate = selectedRowIds.size > 0 && selectedRowIds.size < rows.length; }}
                          onChange={(e) => e.target.checked ? selectAllRows() : clearSelection()}
                          className="rounded border-[var(--border)]"
                        />
                      </label>
                    </th>
                    <th className="w-32 px-2 py-2 text-left text-xs font-medium border-b">Label</th>
                    <th className="w-36 px-2 py-2 text-center text-xs font-medium border-b">
                      Dimensions (mm)
                    </th>
                    <th className="w-24 px-2 py-2 text-center text-xs font-medium border-b">Qty</th>
                    <th className="w-40 px-2 py-2 text-left text-xs font-medium border-b">Material</th>
                    <th className="w-12 px-1 py-2 text-center text-xs font-medium border-b" title="Can Rotate">Rot</th>
                    {hasOpsEnabled && (
                      <th className="w-28 px-2 py-2 text-center text-xs font-medium border-b text-teal-600">Ops</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <PartCard
                      key={row.id}
                      data={row}
                      index={index}
                      materials={materialOptions}
                      onChange={(updates) => updateRow(index, updates)}
                      isSelected={selectedRowIds.has(row.id)}
                      onSelect={() => toggleRowSelection(row.id)}
                      errors={errors[row.id]}
                      compact={true}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARD VIEW */
            <div className="p-4 space-y-4">
              {rows.map((row, index) => (
                <PartCard
                  key={row.id}
                  data={row}
                  index={index}
                  materials={materialOptions}
                  onChange={(updates) => updateRow(index, updates)}
                  isSelected={selectedRowIds.has(row.id)}
                  onSelect={() => toggleRowSelection(row.id)}
                  onSubmit={() => handleSubmitRow(index)}
                  errors={errors[row.id]}
                  compact={false}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--muted)]/50">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={addNewRow}>
                <ArrowDown className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Add Row</span>
              </Button>
              <span className="text-xs text-[var(--muted-foreground)]">
                {validRowCount} row{validRowCount !== 1 ? "s" : ""} with data
              </span>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAddAllParts}
              disabled={!hasValidRows}
            >
              <Plus className="h-4 w-4" />
              <span className="ml-1">Add All Parts</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations Panel */}
      <BulkOpsPanel
        open={showBulkOpsPanel}
        onOpenChange={setShowBulkOpsPanel}
        selectedCount={selectedRowIds.size}
        onApply={applyBulkOps}
      />
    </>
    );
  }
);

