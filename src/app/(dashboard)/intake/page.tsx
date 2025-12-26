"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Plus,
  ListChecks,
  Download,
  Home,
  ChevronRight,
  X,
  BarChart3,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SetupStep,
  IntakeStep,
  ReviewStep,
  ExportStep,
  StatsSidebar,
} from "@/components/intake";
import { useIntakeStore, type StepId } from "@/lib/store";
import { Stepper, type Step } from "@/components/ui/stepper";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS: Step[] = [
  { id: "setup", label: "Setup", icon: Settings },
  { id: "intake", label: "Add Parts", icon: Plus },
  { id: "review", label: "Review", icon: ListChecks },
  { id: "export", label: "Export", icon: Download },
];

export default function IntakePage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const {
    currentCutlist,
    inboxParts,
    currentStep,
    setCurrentStep,
    goToNextStep,
    goToPreviousStep,
    setCutlistName,
    canProceedToReview,
    canProceedToExport,
    loadCutlistForEditing,
    resetCutlist,
  } = useIntakeStore();

  const [showMobileStats, setShowMobileStats] = React.useState(false);
  const [isLoadingCutlist, setIsLoadingCutlist] = React.useState(false);
  const [loadedCutlistId, setLoadedCutlistId] = React.useState<string | null>(null);

  // Reset cutlist when starting fresh (no editId)
  // Track if we've already reset for this session to avoid infinite resets
  const hasResetRef = React.useRef(false);
  
  React.useEffect(() => {
    // If no editId and we haven't reset yet, start fresh
    if (!editId && !hasResetRef.current) {
      resetCutlist();
      hasResetRef.current = true;
    }
    // Reset the flag when editId changes (e.g., navigating away and back)
    if (editId) {
      hasResetRef.current = false;
    }
  }, [editId, resetCutlist]);

  // Load existing cutlist for editing
  React.useEffect(() => {
    if (editId && editId !== loadedCutlistId) {
      setIsLoadingCutlist(true);
      
      fetch(`/api/v1/cutlists/${editId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load cutlist");
          const data = await res.json();
          
          if (data.cutlist) {
            // Load the cutlist into the store
            loadCutlistForEditing({
              id: data.cutlist.id,
              doc_id: data.cutlist.doc_id,
              name: data.cutlist.name,
              description: data.cutlist.description,
              status: data.cutlist.status,
              capabilities: data.cutlist.capabilities || {},
              parts: data.cutlist.parts || [],
            });
            
            // Go to review step since we're editing
            setCurrentStep("review");
            setLoadedCutlistId(editId);
            toast.success(`Loaded "${data.cutlist.name}" for editing`);
          }
        })
        .catch((err) => {
          console.error("Failed to load cutlist for editing:", err);
          toast.error("Failed to load cutlist for editing");
        })
        .finally(() => {
          setIsLoadingCutlist(false);
        });
    }
  }, [editId, loadedCutlistId, loadCutlistForEditing, setCurrentStep]);

  const totalParts = currentCutlist.parts.length;
  const totalPieces = currentCutlist.parts.reduce((sum, p) => sum + p.qty, 0);
  const inboxCount = inboxParts.filter((p) => p._status !== "rejected").length;

  // Calculate completed steps based on progress
  const completedSteps = React.useMemo(() => {
    const completed: string[] = [];
    // Setup is completed if name is set and we've moved past it
    if (currentCutlist.name.trim() && currentStep !== "setup") {
      completed.push("setup");
    }
    // Intake is completed if there are parts
    if (totalParts > 0 && (currentStep === "review" || currentStep === "export")) {
      completed.push("intake");
    }
    // Review is completed if we're at export
    if (currentStep === "export") {
      completed.push("review");
    }
    return completed;
  }, [currentCutlist.name, currentStep, totalParts]);

  const handleStepClick = (stepId: string) => {
    // Allow flexible navigation but validate some constraints
    const targetStep = stepId as StepId;
    
    // Always allow going back
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    const targetIndex = STEPS.findIndex((s) => s.id === targetStep);
    
    if (targetIndex <= currentIndex) {
      setCurrentStep(targetStep);
      return;
    }
    
    // Validate forward navigation
    if (targetStep === "intake" || targetStep === "review") {
      // Allow going to intake/review at any time
      setCurrentStep(targetStep);
    } else if (targetStep === "export") {
      // Only allow export if there are parts
      if (canProceedToExport()) {
        setCurrentStep(targetStep);
      }
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const currentStepLabel = STEPS[currentStepIndex]?.label || "Setup";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Breadcrumb & Title */}
            <div className="flex items-center gap-3">
              {/* Breadcrumb */}
              <nav className="hidden md:flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                <Link href="/dashboard" className="hover:text-[var(--foreground)] transition-colors">
                  <Home className="h-4 w-4" />
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-[var(--foreground)]">Intake</span>
              </nav>

              {/* Divider */}
              <div className="hidden md:block w-px h-6 bg-[var(--border)]" />

              {/* Cutlist name (editable in header, compact) */}
              <div className="flex items-center gap-2">
                <Input
                  value={currentCutlist.name}
                  onChange={(e) => setCutlistName(e.target.value)}
                  className="w-[160px] lg:w-[200px] h-8 text-sm font-medium border-transparent hover:border-[var(--border)] focus:border-[var(--cai-teal)]"
                  placeholder="Cutlist name..."
                />
              </div>
            </div>

            {/* Center: Stats (desktop) */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--cai-navy)]">{totalParts}</span>
                <span className="text-xs text-[var(--muted-foreground)]">Parts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--cai-navy)]">{totalPieces}</span>
                <span className="text-xs text-[var(--muted-foreground)]">Pieces</span>
              </div>
              {inboxCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-[var(--cai-teal)]">{inboxCount}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">In Inbox</span>
                </div>
              )}
            </div>

            {/* Right: Mobile stats button */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileStats(true)}
                className="lg:hidden"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stepper Navigation - Below header */}
      <div className="sticky top-14 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-4">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
            allowJump={true}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="p-4 lg:p-6 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto">
          {/* Loading state when loading cutlist for editing */}
          {isLoadingCutlist ? (
            <div className="flex flex-col items-center justify-center h-64">
              <RefreshCw className="h-10 w-10 animate-spin text-[var(--cai-teal)] mb-4" />
              <p className="text-[var(--muted-foreground)]">Loading cutlist for editing...</p>
            </div>
          ) : (
            <>
              {/* Step Content */}
              {currentStep === "setup" && <SetupStep />}
              {currentStep === "intake" && <IntakeStep />}
              {currentStep === "review" && <ReviewStep />}
              {currentStep === "export" && <ExportStep />}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation - Step aware */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--card)] border-t border-[var(--border)] z-50 safe-area-inset-bottom">
        <div className="flex items-center justify-between h-full px-4">
          {/* Back Button */}
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              currentStepIndex === 0
                ? "text-[var(--muted-foreground)]/50 cursor-not-allowed"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {/* Step Label & Progress */}
          <div className="text-center">
            <p className="text-sm font-medium">{currentStepLabel}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {currentStepIndex + 1} / {STEPS.length}
            </p>
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={goToNextStep}
            disabled={
              currentStepIndex === STEPS.length - 1 ||
              (currentStep === "intake" && !canProceedToReview()) ||
              (currentStep === "review" && !canProceedToExport())
            }
            className={cn(
              "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              currentStepIndex === STEPS.length - 1
                ? "text-[var(--muted-foreground)]/50 cursor-not-allowed"
                : "bg-[var(--cai-teal)] text-white hover:bg-[var(--cai-teal-dark)]"
            )}
          >
            {currentStepIndex === STEPS.length - 1 ? "Done" : "Next"}
            {currentStepIndex < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Stats Drawer */}
      {showMobileStats && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowMobileStats(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[var(--card)] rounded-t-3xl max-h-[80vh] overflow-auto safe-area-inset-bottom animate-slide-up">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
              <h2 className="font-semibold text-lg">Cutlist Statistics</h2>
              <button
                onClick={() => setShowMobileStats(false)}
                className="p-2 hover:bg-[var(--muted)] rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 pb-20">
              <StatsSidebar />
            </div>
          </div>
        </>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog />

      {/* Add padding for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
