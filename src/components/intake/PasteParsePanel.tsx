"use client";

import * as React from "react";
import { 
  ClipboardPaste, 
  Plus, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  Zap,
  FileText,
  Wand2,
  CheckCircle2,
  XCircle,
  Brain,
  TableIcon,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseTextBatch, type TextParseResult } from "@/lib/parsers/text-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type ParsedPartResult } from "@/lib/ai";
import { toast } from "sonner";
import { 
  analyzeTextForParserMode, 
  shouldForceAI, 
  shouldForcePattern,
  type ParserModeAnalysis,
  type ParserModeRecommendation,
} from "@/lib/parser/format-detector";

interface PasteParsePanelProps {
  defaultMaterialId?: string;
  defaultThicknessMm?: number;
  onParsed?: (results: TextParseResult[] | ParsedPartResult[]) => void;
}

type ParserMode = "pattern" | "ai" | "auto";

interface ParseResult {
  count: number;
  errors: number;
  confidence?: number;
  processingTime?: number;
  modeUsed: ParserModeRecommendation;
  analysis?: ParserModeAnalysis;
}

export function PasteParsePanel({
  defaultMaterialId = "MAT-WHITE-18",
  defaultThicknessMm = 18,
  onParsed,
}: PasteParsePanelProps) {
  const [text, setText] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [lastResults, setLastResults] = React.useState<ParseResult | null>(null);
  const [aiError, setAIError] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<ParserModeAnalysis | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [forceMode, setForceMode] = React.useState<ParserMode>("auto");
  
  const addToInbox = useIntakeStore((state) => state.addToInbox);
  const capabilities = useIntakeStore((state) => state.currentCutlist.capabilities);
  
  // Build capability hints
  const enabledFeatures = React.useMemo(() => {
    const features: string[] = [];
    if (capabilities.edging) features.push("edging");
    if (capabilities.grooves) features.push("grooves");
    if (capabilities.cnc_holes) features.push("holes");
    if (capabilities.cnc_routing || capabilities.custom_cnc) features.push("CNC");
    return features;
  }, [capabilities]);

  // Analyze text when it changes (debounced)
  React.useEffect(() => {
    if (!text.trim()) {
      setAnalysis(null);
      return;
    }
    
    const timer = setTimeout(() => {
      const result = analyzeTextForParserMode(text);
      setAnalysis(result);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [text]);

  // Determine effective parser mode
  const effectiveMode = React.useMemo((): ParserModeRecommendation => {
    if (forceMode !== "auto") {
      return forceMode as ParserModeRecommendation;
    }
    
    // Quick checks for forced modes
    if (shouldForceAI(text)) return "ai";
    if (shouldForcePattern(text)) return "pattern";
    
    // Use analysis recommendation
    return analysis?.recommended || "pattern";
  }, [forceMode, text, analysis]);

  const handlePatternParse = React.useCallback((): ParseResult => {
    const startTime = Date.now();
    const results = parseTextBatch(text, {
      defaultMaterialId,
      defaultThicknessMm,
      sourceMethod: "paste_parser",
    });

    const inboxParts: ParsedPartWithStatus[] = results.parts.map((r) => ({
      ...r.part,
      _status: r.confidence >= 0.85 ? "pending" : "pending",
      _originalText: r.originalText,
    }));

    addToInbox(inboxParts);
    onParsed?.(results.parts);

    return {
      count: results.parts.filter((r) => r.errors.length === 0).length,
      errors: results.parts.filter((r) => r.errors.length > 0).length,
      processingTime: Date.now() - startTime,
      modeUsed: "pattern",
      analysis: analysis || undefined,
    };
  }, [text, defaultMaterialId, defaultThicknessMm, addToInbox, onParsed, analysis]);

  const handleAIParse = React.useCallback(async (): Promise<ParseResult | null> => {
    setAIError(null);
    
    try {
      const response = await fetch("/api/v1/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          options: {
            extractMetadata: true,
            confidence: "balanced",
            defaultMaterialId,
            defaultThicknessMm,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "AI_NOT_CONFIGURED") {
          toast.error("AI processing is not available", {
            description: "Falling back to pattern-based parsing.",
          });
          // Fallback to pattern parsing
          return handlePatternParse();
        }
        setAIError(data.error || "AI parsing failed");
        return null;
      }

      if (!data.success) {
        setAIError("AI parsing failed");
        return null;
      }

      const parts = data.parts as ParsedPartResult[];
      const inboxParts: ParsedPartWithStatus[] = parts.map((r) => ({
        ...r.part,
        _status: r.confidence >= 0.85 ? "pending" : "pending",
        _originalText: r.originalText,
      }));

      addToInbox(inboxParts);
      onParsed?.(parts);

      return {
        count: parts.length,
        errors: 0,
        confidence: data.totalConfidence,
        processingTime: data.processingTimeMs,
        modeUsed: "ai",
        analysis: analysis || undefined,
      };
    } catch (error) {
      setAIError(error instanceof Error ? error.message : "AI parsing failed");
      return null;
    }
  }, [text, defaultMaterialId, defaultThicknessMm, addToInbox, onParsed, handlePatternParse, analysis]);

  const handleParse = React.useCallback(async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setAIError(null);

    try {
      let result: ParseResult | null = null;
      
      if (effectiveMode === "ai") {
        result = await handleAIParse();
      } else {
        result = handlePatternParse();
      }
      
      if (result) {
        setLastResults(result);
        setText("");
        
        // Show toast with mode used
        const modeLabel = result.modeUsed === "ai" ? "AI Parser" : "Pattern Parser";
        toast.success(`Parsed ${result.count} part${result.count !== 1 ? "s" : ""}`, {
          description: `Using ${modeLabel}${result.errors > 0 ? ` (${result.errors} with warnings)` : ""}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [text, effectiveMode, handleAIParse, handlePatternParse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleParse();
    }
  };
  
  const lineCount = text.split("\n").filter(l => l.trim()).length;

  return (
    <div className="space-y-6">
      {/* Main Input Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                "bg-gradient-to-br from-[var(--cai-teal)]/20 to-[var(--cai-gold)]/20"
              )}>
                <Brain className="h-5 w-5 text-[var(--cai-teal)]" />
              </div>
              <div>
                <CardTitle className="text-lg">Smart Paste & Parse</CardTitle>
                <CardDescription>
                  Paste any format — we&apos;ll automatically detect the best parsing method
                </CardDescription>
              </div>
            </div>
            
            {/* Mode indicator */}
            {analysis && text.trim() && (
              <div className="flex items-center gap-2">
                {effectiveMode === "ai" ? (
                  <Badge variant="secondary" className="gap-1 bg-gradient-to-r from-[var(--cai-teal)]/20 to-[var(--cai-gold)]/20 border-[var(--cai-teal)]/30">
                    <Sparkles className="h-3 w-3" />
                    AI Mode
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    Pattern Mode
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Smart detection banner */}
          {analysis && text.trim() && (
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors",
              effectiveMode === "ai" 
                ? "bg-gradient-to-r from-[var(--cai-teal)]/5 to-[var(--cai-gold)]/5 border-[var(--cai-teal)]/20"
                : "bg-[var(--muted)]/50 border-[var(--border)]"
            )}>
              {effectiveMode === "ai" ? (
                <Wand2 className="h-4 w-4 text-[var(--cai-gold)] mt-0.5 shrink-0" />
              ) : (
                <TableIcon className="h-4 w-4 text-[var(--cai-teal)] mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {effectiveMode === "ai" 
                      ? "AI parsing recommended" 
                      : "Structured data detected"}
                  </p>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {analysis.reasons.slice(0, 2).join(" • ")}
                </p>
              </div>
            </div>
          )}

          {/* Error display */}
          {aiError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">{aiError}</div>
            </div>
          )}

          {/* Textarea */}
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Paste anything — structured or messy:

Structured data (CSV, spreadsheet, cutlist):
Part1  720  560  2  white
Part2  600  400  4  oak

Or natural language:
"I need 2 side panels 720x560mm in white melamine
with edge banding on all visible edges"

Or messy notes:
"side panel 720 560 qty2 white, shelf 560x500 x4 GL..."`}
              className="min-h-[200px] font-mono text-sm transition-colors resize-y"
            />
            {lineCount > 0 && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                {analysis && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-normal",
                      analysis.formatHint !== "free_form" && "text-green-600 border-green-300"
                    )}
                  >
                    {analysis.formatHint === "free_form" ? "Free-form" : 
                     analysis.formatHint === "excel" ? "Tabular" :
                     analysis.formatHint === "generic_table" ? "Structured" :
                     analysis.formatHint}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs font-normal">
                  {lineCount} line{lineCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {/* Last results */}
              {lastResults && (
                <div className="flex items-center gap-2">
                  {lastResults.count > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        {lastResults.count} parsed
                      </span>
                    </div>
                  )}
                  {lastResults.errors > 0 && (
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">{lastResults.errors} errors</span>
                    </div>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {lastResults.modeUsed === "ai" ? (
                      <><Sparkles className="h-3 w-3 mr-1" /> AI</>
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" /> Pattern</>
                    )}
                  </Badge>
                  {lastResults.processingTime && (
                    <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <Clock className="h-3 w-3" />
                      {lastResults.processingTime > 1000 
                        ? `${(lastResults.processingTime / 1000).toFixed(1)}s`
                        : `${lastResults.processingTime}ms`}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Advanced toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs"
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                Advanced
              </Button>
              
              <span className="text-xs text-[var(--muted-foreground)]">
                ⌘/Ctrl + Enter
              </span>
              <Button
                onClick={handleParse}
                disabled={!text.trim() || isProcessing}
                size="default"
                className={cn(
                  "transition-all",
                  effectiveMode === "ai" 
                    ? "bg-gradient-to-r from-[var(--cai-teal)] to-[var(--cai-gold)] hover:from-[var(--cai-teal)]/90 hover:to-[var(--cai-gold)]/90"
                    : ""
                )}
              >
                {isProcessing ? (
                  <>
                    {effectiveMode === "ai" ? (
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Zap className="h-4 w-4 animate-pulse" />
                    )}
                    Processing...
                  </>
                ) : (
                  <>
                    {effectiveMode === "ai" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Parse & Add to Inbox
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-4">
                <span className="text-xs text-[var(--muted-foreground)]">Force mode:</span>
                <div className="flex gap-1">
                  {(["auto", "pattern", "ai"] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant={forceMode === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForceMode(mode)}
                      className="text-xs h-7 px-2"
                    >
                      {mode === "auto" && <Brain className="h-3 w-3 mr-1" />}
                      {mode === "pattern" && <Zap className="h-3 w-3 mr-1" />}
                      {mode === "ai" && <Sparkles className="h-3 w-3 mr-1" />}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Button>
                  ))}
                </div>
                {forceMode !== "auto" && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Override active
                  </span>
                )}
              </div>
              
              {/* Debug metrics */}
              {analysis && text.trim() && (
                <div className="mt-3 p-2 rounded bg-[var(--muted)]/50 text-xs font-mono">
                  <div className="grid grid-cols-3 gap-2">
                    <div>Structure: {(analysis.metrics.structuralScore * 100).toFixed(0)}%</div>
                    <div>Dimensions: {(analysis.metrics.dimensionPatternScore * 100).toFixed(0)}%</div>
                    <div>Natural Lang: {(analysis.metrics.naturalLanguageScore * 100).toFixed(0)}%</div>
                    <div>Consistency: {(analysis.metrics.consistencyScore * 100).toFixed(0)}%</div>
                    <div>Lines: {analysis.metrics.lineCount}</div>
                    <div>Tokens/line: {analysis.metrics.avgTokensPerLine.toFixed(1)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format Reference Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            What can I paste?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <p className="font-medium mb-1.5 text-[var(--foreground)] flex items-center gap-1">
                  <Zap className="h-3 w-3 text-[var(--cai-teal)]" />
                  Structured Data (Pattern Parser)
                </p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li>• Spreadsheet copy-paste (Excel, Sheets)</li>
                  <li>• CSV/TSV data</li>
                  <li>• Cabinet Vision, Mozaik exports</li>
                  <li>• Consistent formatted cutlists</li>
                </ul>
              </div>
              <div className="p-2 rounded bg-[var(--muted)]/50 font-mono text-[10px]">
                Side Panel  720  560  2<br/>
                Shelf       600  400  4<br/>
                Top         800  600  1
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="font-medium mb-1.5 text-[var(--foreground)] flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[var(--cai-gold)]" />
                  Messy Data (AI Parser)
                </p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li>• Natural language descriptions</li>
                  <li>• Handwritten note transcriptions</li>
                  <li>• Email excerpts with parts</li>
                  <li>• Mixed formats, abbreviations</li>
                </ul>
              </div>
              <div className="p-2 rounded bg-gradient-to-r from-[var(--cai-teal)]/5 to-[var(--cai-gold)]/5 font-mono text-[10px]">
                I need 2 side panels 720x560<br/>
                white melamine with edging<br/>
                Also 4 shelves 600 by 400...
              </div>
            </div>
          </div>
          {enabledFeatures.length > 0 && (
            <p className="mt-3 text-xs text-[var(--cai-teal)]">
              Enabled operations: {enabledFeatures.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
