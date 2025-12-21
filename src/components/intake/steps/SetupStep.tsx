"use client";

import * as React from "react";
import {
  Settings,
  Package,
  Ruler,
  Scissors,
  Drill,
  CircleSlash,
  FileText,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StepNavigation } from "@/components/ui/stepper";

interface CapabilityToggleProps {
  label: string;
  description?: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  color?: string;
}

function CapabilityToggle({
  label,
  description,
  icon,
  enabled,
  onChange,
  color,
}: CapabilityToggleProps) {
  return (
    <label className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/50 cursor-pointer transition-colors">
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          enabled ? "bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
        )}
        style={color && enabled ? { backgroundColor: `${color}15`, color } : undefined}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{label}</div>
        {description && (
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cai-teal)] focus-visible:ring-offset-2",
          enabled ? "bg-[var(--cai-teal)]" : "bg-[var(--muted)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}

export function SetupStep() {
  const {
    currentCutlist,
    setCutlistName,
    setCapabilities,
    goToNextStep,
    canProceedToIntake,
  } = useIntakeStore();

  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Focus name input on mount
  React.useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const capabilities = currentCutlist.capabilities;
  const canProceed = canProceedToIntake();

  const enableAllCNC = () => {
    setCapabilities({
      grooves: true,
      cnc_holes: true,
      cnc_routing: true,
      custom_cnc: true,
    });
  };

  const hasCNCEnabled = !!capabilities.grooves || !!capabilities.cnc_holes || !!capabilities.cnc_routing || !!capabilities.custom_cnc;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Name Section */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            Name Your Cutlist
          </h2>
          <p className="text-[var(--muted-foreground)]">
            Give your cutlist a descriptive name to identify it later
          </p>
        </div>

        <Input
          ref={nameInputRef}
          type="text"
          value={currentCutlist.name}
          onChange={(e) => setCutlistName(e.target.value)}
          placeholder="e.g., Kitchen Cabinets - Johnson Project"
          className="text-lg h-14 px-4"
        />
      </section>

      {/* Capabilities Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Cutlist Capabilities
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Enable features based on your manufacturing requirements
            </p>
          </div>
          {!hasCNCEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={enableAllCNC}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Enable All CNC
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {/* Core - Always enabled */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--cai-teal)]/30 bg-[var(--cai-teal)]/5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--cai-teal)]/10 text-[var(--cai-teal)] shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">Core Dimensions</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Length, width, thickness, quantity, material
              </div>
            </div>
            <Badge variant="success">Always On</Badge>
          </div>

          {/* Edge Banding */}
          <CapabilityToggle
            label="Edge Banding"
            description="Apply edging to panel edges (L1, L2, W1, W2)"
            icon={<Ruler className="h-5 w-5" />}
            enabled={capabilities.edging ?? false}
            onChange={(v) => setCapabilities({ edging: v })}
            color="#3B82F6"
          />

          {/* Part Notes */}
          <CapabilityToggle
            label="Part Notes"
            description="Add operator, CNC, and design notes to parts"
            icon={<FileText className="h-5 w-5" />}
            enabled={capabilities.part_notes ?? false}
            onChange={(v) => setCapabilities({ part_notes: v })}
          />

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--background)] px-3 text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                CNC Operations
              </span>
            </div>
          </div>

          {/* Grooves */}
          <CapabilityToggle
            label="Grooves"
            description="Panel grooves for backs, dividers, etc."
            icon={<Scissors className="h-5 w-5" />}
            enabled={capabilities.grooves ?? false}
            onChange={(v) => setCapabilities({ grooves: v })}
            color="#F59E0B"
          />

          {/* CNC Holes */}
          <CapabilityToggle
            label="CNC Holes"
            description="System holes, shelf pin holes, hardware holes"
            icon={<CircleSlash className="h-5 w-5" />}
            enabled={capabilities.cnc_holes ?? false}
            onChange={(v) => setCapabilities({ cnc_holes: v })}
            color="#8B5CF6"
          />

          {/* CNC Routing */}
          <CapabilityToggle
            label="CNC Routing"
            description="Pocket cuts, profiles, dados, rabbets"
            icon={<Drill className="h-5 w-5" />}
            enabled={capabilities.cnc_routing ?? false}
            onChange={(v) => setCapabilities({ cnc_routing: v })}
            color="#10B981"
          />

          {/* Custom CNC */}
          <CapabilityToggle
            label="Custom CNC Operations"
            description="Custom programs, special operations, macros"
            icon={<Settings className="h-5 w-5" />}
            enabled={capabilities.custom_cnc ?? false}
            onChange={(v) => setCapabilities({ custom_cnc: v })}
            color="#10B981"
          />

          {/* Advanced Grouping */}
          <CapabilityToggle
            label="Advanced Grouping"
            description="Group parts by cabinet, assembly, or custom groups"
            icon={<Layers className="h-5 w-5" />}
            enabled={capabilities.advanced_grouping ?? false}
            onChange={(v) => setCapabilities({ advanced_grouping: v })}
          />
        </div>
      </section>

      {/* Navigation */}
      <StepNavigation
        showBack={false}
        onNext={goToNextStep}
        nextLabel="Continue to Add Parts"
        nextDisabled={!canProceed}
      />
    </div>
  );
}

