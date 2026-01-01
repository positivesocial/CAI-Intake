"use client";

import * as React from "react";
import { Check, Zap, Brain, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { type AIProviderType } from "@/lib/ai";

// ============================================================
// TYPES
// ============================================================

interface ProviderInfo {
  id: AIProviderType;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  features: string[];
  costEstimate: string;
  configKey: string;
}

interface OCRProviderSelectProps {
  value: AIProviderType;
  onChange: (provider: AIProviderType) => void;
  disabled?: boolean;
  className?: string;
  showCostEstimate?: boolean;
  compact?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI GPT-4 Vision",
    icon: <Zap className="h-4 w-4" />,
    color: "text-green-600",
    description: "Best for structured documents and spreadsheets",
    features: [
      "High accuracy on tables",
      "Good at inferring structure",
      "Fast processing",
      "Handles handwriting",
    ],
    costEstimate: "~$0.01-0.03/page",
    configKey: "OPENAI_API_KEY",
  },
  {
    id: "anthropic",
    name: "Claude 4.5 Sonnet",
    icon: <Brain className="h-4 w-4" />,
    color: "text-purple-600",
    description: "Best for complex, messy, or handwritten data",
    features: [
      "Excellent reasoning",
      "Better at messy data",
      "Strong context understanding",
      "Good at corrections",
    ],
    costEstimate: "~$0.015-0.045/page",
    configKey: "ANTHROPIC_API_KEY",
  },
];

// ============================================================
// COMPONENT
// ============================================================

export function OCRProviderSelect({
  value,
  onChange,
  disabled = false,
  className,
  showCostEstimate = true,
  compact = false,
}: OCRProviderSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [configuredProviders, setConfiguredProviders] = React.useState<Set<AIProviderType>>(new Set());

  // Check which providers are configured
  React.useEffect(() => {
    const checkProviders = async () => {
      const configured = new Set<AIProviderType>();
      
      // Check OpenAI
      if (process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
        configured.add("openai");
      }
      
      // Check Anthropic
      if (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
        configured.add("anthropic");
      }
      
      // For client-side, we can't directly check env vars
      // So we assume both are potentially configured and let the API call fail
      if (configured.size === 0) {
        configured.add("openai");
        configured.add("anthropic");
      }
      
      setConfiguredProviders(configured);
    };
    
    checkProviders();
  }, []);

  const selectedProvider = PROVIDERS.find((p) => p.id === value) || PROVIDERS[0];

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 justify-start", className)}
            disabled={disabled}
          >
            <span className={selectedProvider.color}>{selectedProvider.icon}</span>
            <span className="ml-2 hidden sm:inline">{selectedProvider.name.split(" ")[0]}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <ProviderList
            providers={PROVIDERS}
            selectedId={value}
            configuredProviders={configuredProviders}
            showCostEstimate={showCostEstimate}
            onSelect={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium">OCR Provider</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => {
          const isSelected = value === provider.id;
          const isConfigured = configuredProviders.has(provider.id);

          return (
            <button
              key={provider.id}
              type="button"
              disabled={disabled || !isConfigured}
              onClick={() => onChange(provider.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all",
                "hover:border-[var(--cai-teal)] hover:bg-[var(--muted)]/50",
                isSelected && "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5",
                !isConfigured && "opacity-50 cursor-not-allowed",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-[var(--cai-teal)]" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2">
                <span className={provider.color}>{provider.icon}</span>
                <span className="font-medium text-sm">{provider.name}</span>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--muted-foreground)]">
                {provider.description}
              </p>

              {/* Features */}
              <ul className="text-xs text-[var(--muted-foreground)] space-y-0.5">
                {provider.features.slice(0, 2).map((feature, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="text-[var(--cai-teal)]">•</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Cost estimate */}
              {showCostEstimate && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {provider.costEstimate}
                  </Badge>
                  {!isConfigured && (
                    <Badge variant="error" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not configured
                    </Badge>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Configuration help */}
      {!configuredProviders.has(value) && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Provider not configured</p>
              <p className="mt-1">
                Add{" "}
                <code className="bg-amber-100 px-1 rounded">
                  {selectedProvider.configKey}
                </code>{" "}
                to your environment variables.
              </p>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:underline"
              >
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROVIDER LIST (for popover)
// ============================================================

interface ProviderListProps {
  providers: ProviderInfo[];
  selectedId: AIProviderType;
  configuredProviders: Set<AIProviderType>;
  showCostEstimate: boolean;
  onSelect: (id: AIProviderType) => void;
}

function ProviderList({
  providers,
  selectedId,
  configuredProviders,
  showCostEstimate,
  onSelect,
}: ProviderListProps) {
  return (
    <div className="p-1">
      {providers.map((provider) => {
        const isSelected = selectedId === provider.id;
        const isConfigured = configuredProviders.has(provider.id);

        return (
          <button
            key={provider.id}
            type="button"
            disabled={!isConfigured}
            onClick={() => onSelect(provider.id)}
            className={cn(
              "w-full flex items-start gap-3 rounded-md p-3 text-left transition-colors",
              "hover:bg-[var(--muted)]",
              isSelected && "bg-[var(--muted)]",
              !isConfigured && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn("mt-0.5", provider.color)}>{provider.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{provider.name}</span>
                {isSelected && <Check className="h-4 w-4 text-[var(--cai-teal)]" />}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {provider.description}
              </p>
              {showCostEstimate && (
                <Badge variant="outline" className="text-xs mt-1.5">
                  {provider.costEstimate}
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// SIMPLE TOGGLE (alternative compact version)
// ============================================================

interface OCRProviderToggleProps {
  value: AIProviderType;
  onChange: (provider: AIProviderType) => void;
  disabled?: boolean;
  className?: string;
}

export function OCRProviderToggle({
  value,
  onChange,
  disabled = false,
  className,
}: OCRProviderToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border bg-[var(--muted)] p-1",
        className
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("openai")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          value === "openai"
            ? "bg-[var(--background)] shadow text-green-600"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">OpenAI</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("anthropic")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          value === "anthropic"
            ? "bg-[var(--background)] shadow text-purple-600"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
      >
        <Brain className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Claude</span>
      </button>
    </div>
  );
}

