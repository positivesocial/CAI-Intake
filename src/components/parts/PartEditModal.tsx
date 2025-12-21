/**
 * CAI Intake - Part Edit Modal
 * 
 * Modal dialog for editing a single part with full field access.
 * Integrates with the learning system to record corrections.
 */

"use client";

import * as React from "react";
import { X, Save, RotateCcw, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useIntakeStore } from "@/lib/store";
import type { CutPart } from "@/lib/schema";
import { useCorrections } from "@/lib/learning/use-corrections";
import { useAuthStore } from "@/lib/auth/store";

// =============================================================================
// TYPES
// =============================================================================

interface PartEditModalProps {
  partId: string;
  onClose: () => void;
}

interface FormErrors {
  [key: string]: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PartEditModal({ partId, onClose }: PartEditModalProps) {
  const { currentCutlist, updatePart } = useIntakeStore();
  const { user } = useAuthStore();
  
  const originalPart = currentCutlist.parts.find((p) => p.part_id === partId);
  
  const [formData, setFormData] = React.useState<Partial<CutPart>>(
    originalPart ? { ...originalPart } : {}
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isDirty, setIsDirty] = React.useState(false);
  const [isLearning, setIsLearning] = React.useState(false);

  // Corrections tracking for learning from user edits
  const { trackOriginal, recordChanges } = useCorrections({
    organizationId: user?.organizationId ?? undefined,
    userId: user?.id ?? undefined,
    showLearningToast: true,
    enabled: true,
  });

  // Track original state when modal opens
  React.useEffect(() => {
    if (originalPart) {
      trackOriginal(partId, originalPart);
    }
  }, [partId, originalPart, trackOriginal]);

  // Reset form when part changes
  React.useEffect(() => {
    if (originalPart) {
      setFormData({ ...originalPart });
      setIsDirty(false);
      setErrors({});
    }
  }, [originalPart]);

  // Handle field changes
  const handleChange = (field: keyof CutPart, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Handle size changes
  const handleSizeChange = (dimension: "L" | "W", value: number) => {
    setFormData((prev) => ({
      ...prev,
      size: {
        L: dimension === "L" ? value : prev.size?.L ?? 0,
        W: dimension === "W" ? value : prev.size?.W ?? 0,
      },
    }));
    setIsDirty(true);
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.size?.L || formData.size.L <= 0) {
      newErrors.length = "Length must be greater than 0";
    }
    if (!formData.size?.W || formData.size.W <= 0) {
      newErrors.width = "Width must be greater than 0";
    }
    if (!formData.qty || formData.qty < 1) {
      newErrors.qty = "Quantity must be at least 1";
    }
    if (!formData.thickness_mm || formData.thickness_mm <= 0) {
      newErrors.thickness = "Thickness must be greater than 0";
    }
    if (!formData.material_id) {
      newErrors.material = "Material is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) return;

    setIsLearning(true);
    
    // Update the part
    updatePart(partId, formData);
    
    // Record corrections for learning (async, non-blocking)
    try {
      await recordChanges(partId, formData as CutPart);
    } catch (err) {
      console.warn("Failed to record corrections:", err);
    }
    
    setIsLearning(false);
    onClose();
  };

  // Handle reset
  const handleReset = () => {
    if (originalPart) {
      setFormData({ ...originalPart });
      setIsDirty(false);
      setErrors({});
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formData]);

  if (!originalPart) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">Edit Part</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {formData.label || formData.part_id}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-2 gap-4">
            {/* Part ID */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Part ID</label>
              <Input
                value={formData.part_id || ""}
                disabled
                className="bg-[var(--muted)]/50"
              />
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Label</label>
              <Input
                value={formData.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="Part name"
              />
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Length (mm) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.size?.L || ""}
                onChange={(e) => handleSizeChange("L", parseFloat(e.target.value) || 0)}
                error={errors.length}
                min={0}
                step={0.1}
              />
            </div>

            {/* Width */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Width (mm) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.size?.W || ""}
                onChange={(e) => handleSizeChange("W", parseFloat(e.target.value) || 0)}
                error={errors.width}
                min={0}
                step={0.1}
              />
            </div>

            {/* Thickness */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Thickness (mm) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.thickness_mm || ""}
                onChange={(e) => handleChange("thickness_mm", parseFloat(e.target.value) || 0)}
                error={errors.thickness}
                min={0}
                step={0.1}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.qty || ""}
                onChange={(e) => handleChange("qty", parseInt(e.target.value) || 1)}
                error={errors.qty}
                min={1}
              />
            </div>

            {/* Material */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Material <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.material_id || ""}
                onChange={(e) => handleChange("material_id", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
              >
                <option value="">Select material</option>
                {currentCutlist.materials.map((m) => (
                  <option key={m.material_id} value={m.material_id}>
                    {m.name} ({m.thickness_mm}mm)
                  </option>
                ))}
              </select>
              {errors.material && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.material}
                </p>
              )}
            </div>

            {/* Allow Rotation */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Rotation</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_rotation ?? true}
                  onChange={(e) => handleChange("allow_rotation", e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)]"
                />
                <span className="text-sm">Allow rotation during optimization</span>
              </label>
            </div>

            {/* Group */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Group ID</label>
              <Input
                value={formData.group_id || ""}
                onChange={(e) => handleChange("group_id", e.target.value)}
                placeholder="e.g., Cabinet-01"
              />
            </div>

            {/* Family */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Part Family</label>
              <select
                value={formData.family || ""}
                onChange={(e) => handleChange("family", e.target.value || undefined)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
              >
                <option value="">None</option>
                <option value="panel">Panel</option>
                <option value="door">Door</option>
                <option value="drawer_box">Drawer Box</option>
                <option value="face_frame">Face Frame</option>
                <option value="filler">Filler</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>

            {/* Notes - Full Width */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                value={typeof formData.notes === "string" ? formData.notes : ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Additional notes for this part..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none"
              />
            </div>
          </div>

          {/* Edge Banding Section */}
          {currentCutlist.capabilities.edging && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <h3 className="text-sm font-semibold mb-4">Edge Banding</h3>
              <div className="grid grid-cols-4 gap-4">
                {["L1", "L2", "W1", "W2"].map((edge) => (
                  <div key={edge}>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--muted-foreground)]">
                      {edge === "L1" ? "Length 1" : edge === "L2" ? "Length 2" : edge === "W1" ? "Width 1" : "Width 2"}
                    </label>
                    <select
                      value={
                        (formData.ops?.edging?.edges as Record<string, { edgeband_id?: string }>)?.[edge]?.edgeband_id || ""
                      }
                      onChange={(e) => {
                        const currentEdges = (formData.ops?.edging?.edges as Record<string, { apply: boolean; edgeband_id?: string }>) || {};
                        handleChange("ops", {
                          ...formData.ops,
                          edging: {
                            ...formData.ops?.edging,
                            edges: {
                              ...currentEdges,
                              [edge]: {
                                apply: !!e.target.value,
                                edgeband_id: e.target.value || undefined,
                              },
                            },
                          },
                        });
                      }}
                      className="w-full h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs"
                    >
                      <option value="">None</option>
                      {currentCutlist.edgebands.map((eb) => (
                        <option key={eb.edgeband_id} value={eb.edgeband_id}>
                          {eb.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area Preview */}
          <div className="mt-6 p-4 bg-[var(--muted)]/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Total Area:</span>
              <span className="font-mono font-semibold">
                {((formData.size?.L || 0) * (formData.size?.W || 0) * (formData.qty || 1) / 1000000).toFixed(3)} m²
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[var(--muted-foreground)]">Perimeter (per piece):</span>
              <span className="font-mono">
                {(((formData.size?.L || 0) + (formData.size?.W || 0)) * 2 / 1000).toFixed(2)} m
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]/30">
          <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
            {isLearning ? (
              <span className="flex items-center gap-1.5 text-[var(--cai-teal)]">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Learning from your edit...
              </span>
            ) : isDirty ? (
              <span className="text-amber-500">● Unsaved changes</span>
            ) : (
              <span className="text-green-500">✓ Saved</span>
            )}
            <Badge variant="outline" className="text-xs opacity-60">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Learning
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleReset} disabled={!isDirty || isLearning}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={isLearning}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || isLearning}>
              <Save className="h-4 w-4 mr-1" />
              {isLearning ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartEditModal;

