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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseTextBatch, type TextParseResult } from "@/lib/parsers/text-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ParserModeToggle, type ParserMode } from "./ParserModeToggle";
import { getOrCreateProvider, type AIParseResult, type ParsedPartResult } from "@/lib/ai";

interface PasteParsePanelProps {
  defaultMaterialId?: string;
  defaultThicknessMm?: number;
  onParsed?: (results: TextParseResult[] | ParsedPartResult[]) => void;
}

export function PasteParsePanel({
  defaultMaterialId = "MAT-WHITE-18",
  defaultThicknessMm = 18,
  onParsed,
}: PasteParsePanelProps) {
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
  const capabilities = useIntakeStore((state) => state.currentCutlist.capabilities);
  
  // Build capability hints for placeholder and help
  const enabledFeatures = React.useMemo(() => {
    const features: string[] = [];
    if (capabilities.edging) features.push("edging");
    if (capabilities.grooves) features.push("grooves");
    if (capabilities.cnc_holes) features.push("holes");
    if (capabilities.cnc_routing || capabilities.custom_cnc) features.push("CNC");
    return features;
  }, [capabilities]);

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
  
  // Estimate line count
  const lineCount = text.split("\n").filter(l => l.trim()).length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                parserMode === "ai" 
                  ? "bg-gradient-to-br from-[var(--cai-teal)]/20 to-[var(--cai-gold)]/20"
                  : "bg-[var(--cai-teal)]/10"
              )}>
                {parserMode === "ai" ? (
                  <Sparkles className="h-5 w-5 text-[var(--cai-gold)]" />
                ) : (
                  <ClipboardPaste className="h-5 w-5 text-[var(--cai-teal)]" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">Paste & Parse</CardTitle>
                <CardDescription>
                  {parserMode === "ai" 
                    ? "AI-powered parsing for messy, unstructured data"
                    : "Pattern-based parsing for structured cutlists"
                  }
                </CardDescription>
              </div>
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
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Mode description banners */}
          {parserMode === "ai" ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-[var(--cai-teal)]/10 to-[var(--cai-gold)]/10 border border-[var(--cai-teal)]/20">
              <Wand2 className="h-5 w-5 text-[var(--cai-gold)] mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--foreground)]">AI Parser Mode</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Intelligently parses handwritten notes, messy spreadsheets, email excerpts, and complex formats.
                  Automatically detects materials, dimensions, quantities, and operations.
                  {enabledFeatures.length > 0 && (
                    <span className="block mt-1 text-[var(--cai-teal)]">
                      Enabled operations: {enabledFeatures.join(", ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
              <Zap className="h-5 w-5 text-[var(--cai-teal)] mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--foreground)]">Regex Parser Mode</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Fast pattern-based parsing for structured data. Works best with consistent formats like 
                  copy-pasted spreadsheets, CSV data, or formatted cutlists.
                  {enabledFeatures.length > 0 && (
                    <span className="block mt-1 text-[var(--cai-teal)]">
                      Enabled operations: {enabledFeatures.join(", ")}
                    </span>
                  )}
                </p>
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

          {/* Textarea */}
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={parserMode === "ai" 
                ? `Paste anything - AI will figure it out:

"I need 2 side panels 720x560mm in white melamine with edge banding on all visible edges
Also 4 shelves, 560 by 500, same material, grain along length
And a top piece 800x600 with groove for back panel"

Or messy notes:
"side panel 720 560 qty2 white, shelf 560x500 x4 GL, top 800×600..."

Or spreadsheet data:
"Part1  720  560  2  white
Part2  600  400  4  oak
..."`
                : `Paste structured data, one part per line:

Side panel 720x560 qty 2
Shelf 560x500 qty 4 grain length
Top 800x600 q1 white board

Or CSV-style:
Part1, 720, 560, 2
Part2, 600, 400, 4`}
              className={cn(
                "min-h-[200px] font-mono text-sm transition-colors resize-y",
                parserMode === "ai" && "border-[var(--cai-teal)]/30 focus:border-[var(--cai-teal)]"
              )}
            />
            {lineCount > 0 && (
              <div className="absolute bottom-2 right-2">
                <Badge variant="outline" className="text-xs font-normal">
                  {lineCount} line{lineCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lastResults && (
                <div className="flex items-center gap-2">
                  {lastResults.count > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-700">
                        {lastResults.count} parsed
                      </span>
                      {lastResults.mode === "ai" && lastResults.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(lastResults.confidence * 100)}% confident
                        </Badge>
                      )}
                    </div>
                  )}
                  {lastResults.errors > 0 && (
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">{lastResults.errors} errors</span>
                    </div>
                  )}
                  {lastResults.mode === "ai" && lastResults.processingTime && (
                    <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <Clock className="h-3 w-3" />
                      {(lastResults.processingTime / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">
                ⌘/Ctrl + Enter to parse
              </span>
              <Button
                onClick={handleParse}
                disabled={!text.trim() || isProcessing}
                loading={isProcessing}
                size="default"
                className={cn(
                  parserMode === "ai" 
                    ? "bg-gradient-to-r from-[var(--cai-teal)] to-[var(--cai-gold)] hover:from-[var(--cai-teal)]/90 hover:to-[var(--cai-gold)]/90"
                    : ""
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
          </div>
        </CardContent>
      </Card>

      {/* Format Reference Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {parserMode === "ai" ? "AI Parser Capabilities" : "Supported Formats"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parserMode === "ai" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium mb-2 text-[var(--foreground)]">Natural Language</p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li>• "2 side panels 720x560 white melamine"</li>
                  <li>• "shelf 600 by 400 with edge banding"</li>
                  {capabilities.grooves && <li>• "back panel with 4mm groove"</li>}
                  {capabilities.cnc_holes && <li>• "bottom with 32mm system holes"</li>}
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2 text-[var(--foreground)]">Messy Data</p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li>• Mixed formats and abbreviations</li>
                  <li>• Handwritten note transcriptions</li>
                  <li>• Email excerpts with part lists</li>
                  <li>• OCR'd documents</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-medium mb-2 text-[var(--foreground)]">Dimensions</p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li><code className="bg-[var(--muted)] px-1 rounded">720x560</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">720 x 560</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">720×560</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">L720 W560</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2 text-[var(--foreground)]">Quantity</p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li><code className="bg-[var(--muted)] px-1 rounded">qty 2</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">x2</code> or <code className="bg-[var(--muted)] px-1 rounded">×2</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">2pcs</code></li>
                  <li><code className="bg-[var(--muted)] px-1 rounded">q2</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2 text-[var(--foreground)]">Options</p>
                <ul className="space-y-1 text-[var(--muted-foreground)]">
                  <li><code className="bg-[var(--muted)] px-1 rounded">grain length</code> / <code className="bg-[var(--muted)] px-1 rounded">GL</code></li>
                  {capabilities.edging && <li><code className="bg-blue-50 text-blue-700 px-1 rounded">EB all</code></li>}
                  {capabilities.grooves && <li><code className="bg-amber-50 text-amber-700 px-1 rounded">groove</code></li>}
                  {capabilities.cnc_holes && <li><code className="bg-purple-50 text-purple-700 px-1 rounded">holes 32mm</code></li>}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

