"use client";

import * as React from "react";
import { Zap, Plus, AlertCircle, Sparkles, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseTextBatch, type TextParseResult } from "@/lib/parsers/text-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ParserModeToggle, type ParserMode } from "./ParserModeToggle";
import { getOrCreateProvider, type AIParseResult, type ParsedPartResult } from "@/lib/ai";

interface QuickParseFieldProps {
  defaultMaterialId?: string;
  defaultThicknessMm?: number;
  onParsed?: (results: TextParseResult[] | ParsedPartResult[]) => void;
}

export function QuickParseField({
  defaultMaterialId = "MAT-WHITE-18",
  defaultThicknessMm = 18,
  onParsed,
}: QuickParseFieldProps) {
  const [text, setText] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [lastResults, setLastResults] = React.useState<{
    count: number;
    errors: number;
    confidence?: number;
    processingTime?: number;
    mode: ParserMode;
  } | null>(null);
  const [parserMode, setParserMode] = React.useState<ParserMode>("simple");
  const [aiProvider, setAIProvider] = React.useState<"openai" | "anthropic">("openai");
  const [aiError, setAIError] = React.useState<string | null>(null);
  
  const addToInbox = useIntakeStore((state) => state.addToInbox);

  const handleSimpleParse = React.useCallback(() => {
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

    setLastResults({
      count: results.parts.filter((r) => r.errors.length === 0).length,
      errors: results.parts.filter((r) => r.errors.length > 0).length,
      mode: "simple",
    });
    
    setText("");
  }, [text, defaultMaterialId, defaultThicknessMm, addToInbox, onParsed]);

  const handleAIParse = React.useCallback(async () => {
    setAIError(null);
    
    try {
      const provider = await getOrCreateProvider();
      
      if (!provider.isConfigured()) {
        setAIError(`${aiProvider === "openai" ? "OpenAI" : "Anthropic"} API key not configured. Please add your API key in settings.`);
        return;
      }

      const result: AIParseResult = await provider.parseText(text, {
        extractMetadata: true,
        confidence: "balanced",
        defaultMaterialId,
        defaultThicknessMm,
      });

      if (!result.success && result.errors.length > 0) {
        setAIError(result.errors.join(", "));
        return;
      }

      const inboxParts: ParsedPartWithStatus[] = result.parts.map((r) => ({
        ...r.part,
        _status: r.confidence >= 0.85 ? "pending" : "pending",
        _originalText: r.originalText,
      }));

      addToInbox(inboxParts);
      onParsed?.(result.parts);

      setLastResults({
        count: result.parts.length,
        errors: result.errors.length,
        confidence: result.totalConfidence,
        processingTime: result.processingTime,
        mode: "ai",
      });

      setText("");
    } catch (error) {
      setAIError(error instanceof Error ? error.message : "AI parsing failed");
    }
  }, [text, defaultMaterialId, defaultThicknessMm, aiProvider, addToInbox, onParsed]);

  const handleParse = React.useCallback(async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setAIError(null);

    try {
      if (parserMode === "ai") {
        await handleAIParse();
      } else {
        handleSimpleParse();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [text, parserMode, handleAIParse, handleSimpleParse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {parserMode === "ai" ? (
            <Sparkles className="h-4 w-4 text-[var(--cai-gold)]" />
          ) : (
            <Zap className="h-4 w-4 text-[var(--cai-teal)]" />
          )}
          <span className="text-sm font-medium">Quick Parse</span>
          <span className="text-xs text-[var(--muted-foreground)]">
            (⌘/Ctrl + Enter)
          </span>
        </div>
        
        <ParserModeToggle
          mode={parserMode}
          onModeChange={setParserMode}
          aiProvider={aiProvider}
          onProviderChange={setAIProvider}
          showProviderSelector={true}
          disabled={isProcessing}
        />
      </div>

      {/* AI Mode info banner */}
      {parserMode === "ai" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-[var(--cai-teal)]/10 to-[var(--cai-gold)]/10 border border-[var(--cai-teal)]/20">
          <Sparkles className="h-4 w-4 text-[var(--cai-gold)] mt-0.5 shrink-0" />
          <div className="text-xs text-[var(--foreground)]">
            <strong>AI Mode:</strong> Intelligent parsing for messy data, handwritten notes, 
            and complex formats. Automatically detects edge banding, grooving, and CNC operations.
          </div>
        </div>
      )}

      {/* Error display */}
      {aiError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">{aiError}</div>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={parserMode === "ai" 
          ? `Enter parts in any format - AI will parse them:
I need 2 side panels 720x560mm in white melamine with edge banding on all visible edges
Also 4 shelves, 560 by 500, same material, grain along length
And a top piece 800x600 with groove for back panel`
          : `Enter parts, one per line:
Side panel 720x560 qty 2
Shelf 560x500 qty 4 grain length
Top 800x600 q1 white board`}
        className={cn(
          "min-h-[120px] font-mono text-sm transition-colors",
          parserMode === "ai" && "border-[var(--cai-teal)]/30 focus:border-[var(--cai-teal)]"
        )}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lastResults && (
            <>
              {lastResults.count > 0 && (
                <Badge variant="success">
                  {lastResults.count} parsed
                  {lastResults.mode === "ai" && lastResults.confidence && (
                    <span className="ml-1 opacity-75">
                      ({Math.round(lastResults.confidence * 100)}%)
                    </span>
                  )}
                </Badge>
              )}
              {lastResults.errors > 0 && (
                <Badge variant="error">{lastResults.errors} errors</Badge>
              )}
              {lastResults.mode === "ai" && lastResults.processingTime && (
                <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Clock className="h-3 w-3" />
                  {(lastResults.processingTime / 1000).toFixed(1)}s
                </span>
              )}
            </>
          )}
        </div>

        <Button
          onClick={handleParse}
          disabled={!text.trim() || isProcessing}
          loading={isProcessing}
          variant={parserMode === "ai" ? "primary" : "primary"}
          size="sm"
          className={cn(
            parserMode === "ai" && "bg-gradient-to-r from-[var(--cai-teal)] to-[var(--cai-gold)]"
          )}
        >
          {parserMode === "ai" ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isProcessing 
            ? (parserMode === "ai" ? "AI Processing..." : "Parsing...") 
            : "Parse & Add to Inbox"}
        </Button>
      </div>

      {/* Format help */}
      <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3">
        {parserMode === "ai" ? (
          <>
            <p className="font-medium mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI understands natural language:
            </p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>"2 side panels 720x560 white melamine"</li>
              <li>"shelf 600 by 400 with edge banding on long sides"</li>
              <li>"back panel with 4mm groove, 550×350"</li>
              <li>Messy notes, abbreviations, and mixed formats</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-medium mb-1">Supported formats:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>
                <code className="bg-[var(--card)] px-1 rounded">720x560</code> or{" "}
                <code className="bg-[var(--card)] px-1 rounded">720 x 560</code> -
                dimensions
              </li>
              <li>
                <code className="bg-[var(--card)] px-1 rounded">qty 2</code> or{" "}
                <code className="bg-[var(--card)] px-1 rounded">x2</code> or{" "}
                <code className="bg-[var(--card)] px-1 rounded">2pcs</code> -
                quantity
              </li>
              <li>
                <code className="bg-[var(--card)] px-1 rounded">grain length</code>{" "}
                or <code className="bg-[var(--card)] px-1 rounded">GL</code> - grain
                direction
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
