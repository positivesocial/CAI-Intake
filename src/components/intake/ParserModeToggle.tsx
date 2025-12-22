"use client";

import * as React from "react";
import { Cpu, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ParserMode = "simple" | "ai";

interface ParserModeToggleProps {
  mode: ParserMode;
  onModeChange: (mode: ParserMode) => void;
  aiProvider?: "openai" | "anthropic";
  onProviderChange?: (provider: "openai" | "anthropic") => void;
  showProviderSelector?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ParserModeToggle({
  mode,
  onModeChange,
  aiProvider = "openai",
  onProviderChange,
  showProviderSelector = false,
  disabled = false,
  className,
}: ParserModeToggleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Mode Toggle */}
      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
        <button
          type="button"
          onClick={() => onModeChange("simple")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "simple"
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          Simple
        </button>
        <button
          type="button"
          onClick={() => onModeChange("ai")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "ai"
              ? "bg-gradient-to-r from-[var(--cai-teal)] to-[var(--cai-gold)] text-white shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Mode
        </button>
      </div>

      {/* Provider Selector (shown when AI mode is active) */}
      {mode === "ai" && showProviderSelector && onProviderChange && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[var(--muted-foreground)]">via</span>
          <select
            value={aiProvider}
            onChange={(e) => onProviderChange(e.target.value as "openai" | "anthropic")}
            disabled={disabled}
            className="bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cai-teal)]"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude</option>
          </select>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function ParserModeToggleCompact({
  mode,
  onModeChange,
  disabled = false,
}: {
  mode: ParserMode;
  onModeChange: (mode: ParserMode) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={mode === "ai" ? "primary" : "outline"}
      size="sm"
      onClick={() => onModeChange(mode === "simple" ? "ai" : "simple")}
      disabled={disabled}
      className={cn(
        "gap-1.5",
        mode === "ai" && "bg-gradient-to-r from-[var(--cai-teal)] to-[var(--cai-gold)]"
      )}
    >
      {mode === "ai" ? (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          AI Mode
        </>
      ) : (
        <>
          <Cpu className="h-3.5 w-3.5" />
          Simple
        </>
      )}
    </Button>
  );
}




