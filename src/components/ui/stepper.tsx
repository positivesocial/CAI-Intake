"use client";

import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface StepperProps {
  steps: Step[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
  completedSteps?: string[];
  className?: string;
  /** Allow clicking on any step (flexible navigation) */
  allowJump?: boolean;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
  className,
  allowJump = true,
}: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const getStepStatus = (step: Step, index: number) => {
    if (completedSteps.includes(step.id)) return "completed";
    if (step.id === currentStep) return "current";
    if (index < currentIndex) return "completed";
    return "upcoming";
  };

  const handleStepClick = (step: Step, index: number) => {
    if (!onStepClick) return;
    if (!allowJump && index > currentIndex) return;
    onStepClick(step.id);
  };

  return (
    <>
      {/* Desktop Stepper - Horizontal */}
      <nav
        aria-label="Progress"
        className={cn("hidden md:block", className)}
      >
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index);
            const Icon = step.icon;
            const isLast = index === steps.length - 1;
            const isClickable = allowJump || index <= currentIndex;

            return (
              <li
                key={step.id}
                className={cn("flex items-center", !isLast && "flex-1")}
              >
                <button
                  type="button"
                  onClick={() => handleStepClick(step, index)}
                  disabled={!isClickable}
                  className={cn(
                    "group flex items-center gap-3 transition-colors",
                    isClickable && "cursor-pointer",
                    !isClickable && "cursor-not-allowed opacity-50"
                  )}
                >
                  {/* Step Circle */}
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      status === "completed" &&
                        "border-[var(--cai-teal)] bg-[var(--cai-teal)] text-white",
                      status === "current" &&
                        "border-[var(--cai-teal)] bg-[var(--cai-teal)]/10 text-[var(--cai-teal)]",
                      status === "upcoming" &&
                        "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]",
                      isClickable &&
                        status === "upcoming" &&
                        "group-hover:border-[var(--cai-teal)]/50"
                    )}
                  >
                    {status === "completed" ? (
                      <Check className="h-5 w-5" />
                    ) : Icon ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </span>

                  {/* Step Label */}
                  <div className="hidden lg:block">
                    <p
                      className={cn(
                        "text-sm font-medium transition-colors",
                        status === "current" && "text-[var(--cai-teal)]",
                        status === "completed" && "text-[var(--foreground)]",
                        status === "upcoming" && "text-[var(--muted-foreground)]"
                      )}
                    >
                      {step.label}
                    </p>
                    {step.description && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {step.description}
                      </p>
                    )}
                  </div>
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div className="mx-4 flex-1">
                    <div
                      className={cn(
                        "h-0.5 w-full transition-colors",
                        index < currentIndex
                          ? "bg-[var(--cai-teal)]"
                          : "bg-[var(--border)]"
                      )}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile Stepper - Compact Progress Bar */}
      <nav
        aria-label="Progress"
        className={cn("md:hidden", className)}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {steps[currentIndex]?.label}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            Step {currentIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-1">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step, index)}
                disabled={!allowJump && index > currentIndex}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  status === "completed" && "bg-[var(--cai-teal)]",
                  status === "current" && "bg-[var(--cai-teal)]",
                  status === "upcoming" && "bg-[var(--border)]",
                  allowJump && "cursor-pointer hover:opacity-80"
                )}
                aria-label={`Go to ${step.label}`}
              />
            );
          })}
        </div>

        {/* Step Indicators (dots) */}
        <div className="flex justify-center gap-2 mt-3">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index);
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step, index)}
                disabled={!allowJump && index > currentIndex}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full transition-all",
                  status === "completed" &&
                    "bg-[var(--cai-teal)] text-white",
                  status === "current" &&
                    "bg-[var(--cai-teal)]/20 text-[var(--cai-teal)] ring-2 ring-[var(--cai-teal)]",
                  status === "upcoming" &&
                    "bg-[var(--muted)] text-[var(--muted-foreground)]",
                  (allowJump || index <= currentIndex) && "cursor-pointer"
                )}
                aria-label={step.label}
                aria-current={status === "current" ? "step" : undefined}
              >
                {status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// Step Navigation Buttons Component
export interface StepNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  showBack?: boolean;
  showNext?: boolean;
  nextDisabled?: boolean;
  nextVariant?: "primary" | "default";
  className?: string;
}

export function StepNavigation({
  onBack,
  onNext,
  backLabel = "Back",
  nextLabel = "Continue",
  showBack = true,
  showNext = true,
  nextDisabled = false,
  nextVariant = "primary",
  className,
}: StepNavigationProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pt-6 border-t border-[var(--border)] mt-6",
        className
      )}
    >
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          {backLabel}
        </button>
      ) : (
        <div />
      )}

      {showNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-colors",
            nextVariant === "primary" &&
              "bg-[var(--cai-teal)] text-white hover:bg-[var(--cai-teal-dark)] disabled:opacity-50 disabled:cursor-not-allowed",
            nextVariant === "default" &&
              "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
          )}
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Mobile Bottom Step Navigation
export interface MobileStepNavProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  onBack?: () => void;
  onNext?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  nextLabel?: string;
  className?: string;
}

export function MobileStepNav({
  currentStep,
  totalSteps,
  stepLabel,
  onBack,
  onNext,
  canGoBack = true,
  canGoNext = true,
  nextLabel = "Next",
  className,
}: MobileStepNavProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 h-16 bg-[var(--card)] border-t border-[var(--border)] z-50 safe-area-inset-bottom",
        "flex items-center justify-between px-4",
        className
      )}
    >
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        disabled={isFirstStep || !canGoBack}
        className={cn(
          "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
          isFirstStep || !canGoBack
            ? "text-[var(--muted-foreground)]/50 cursor-not-allowed"
            : "text-[var(--foreground)] hover:bg-[var(--muted)]"
        )}
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        Back
      </button>

      {/* Step Label */}
      <div className="text-center">
        <p className="text-sm font-medium">{stepLabel}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {currentStep + 1} / {totalSteps}
        </p>
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className={cn(
          "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
          canGoNext
            ? "bg-[var(--cai-teal)] text-white hover:bg-[var(--cai-teal-dark)]"
            : "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
        )}
      >
        {isLastStep ? "Done" : nextLabel}
        {!isLastStep && <ChevronRight className="h-4 w-4" />}
      </button>
    </nav>
  );
}

