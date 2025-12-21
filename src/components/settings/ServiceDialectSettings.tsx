"use client";

/**
 * Service Dialect Settings Component
 * 
 * Allows organization admins to configure how external service notations
 * (edgebanding, grooves, drilling, CNC) are translated to canonical codes.
 */

import * as React from "react";
import {
  Settings2,
  Plus,
  Trash2,
  Save,
  TestTube,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  type OrgServiceDialect,
  type EdgeSide,
  getDefaultDialect,
  parseEdgeCode,
  parseGrooveCode,
  parseHoleCode,
  parseCncCode,
  SHORTCODE_REFERENCE,
  formatEdgebandCode,
  formatGroovesCode,
  formatHolesCode,
  formatCncCodes,
} from "@/lib/services";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

interface AliasEntry {
  externalCode: string;
  canonicalCode: string;
  source: "manual" | "learned" | "default";
  usageCount?: number;
}

interface TestResult {
  input: string;
  output: string;
  success: boolean;
  details?: string;
}

// ============================================================
// ALIAS EDITOR
// ============================================================

interface AliasEditorProps {
  title: string;
  description: string;
  aliases: Record<string, string>;
  onAdd: (external: string, canonical: string) => void;
  onRemove: (external: string) => void;
  validateCanonical: (code: string) => boolean;
  examples: ReadonlyArray<{ readonly code: string; readonly description: string }>;
  colorClass: string;
}

function AliasEditor({
  title,
  description,
  aliases,
  onAdd,
  onRemove,
  validateCanonical,
  examples,
  colorClass,
}: AliasEditorProps) {
  const [newExternal, setNewExternal] = React.useState("");
  const [newCanonical, setNewCanonical] = React.useState("");
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const handleAdd = () => {
    if (newExternal.trim() && newCanonical.trim()) {
      onAdd(newExternal.trim().toUpperCase(), newCanonical.trim().toUpperCase());
      setNewExternal("");
      setNewCanonical("");
    }
  };
  
  const aliasEntries = Object.entries(aliases).map(([ext, can]) => ({
    externalCode: ext,
    canonicalCode: can,
    source: "manual" as const,
  }));
  
  return (
    <div className="space-y-3">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", colorClass)}>{title}</Badge>
          <span className="text-sm text-[var(--muted-foreground)]">
            {aliasEntries.length} aliases
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-4 pl-4 border-l-2 border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
          
          {/* Existing aliases */}
          {aliasEntries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase">
                Current Aliases
              </h4>
              <div className="grid gap-2">
                {aliasEntries.map(({ externalCode, canonicalCode, source }) => (
                  <div 
                    key={externalCode}
                    className="flex items-center gap-2 p-2 bg-[var(--muted)]/30 rounded"
                  >
                    <code className="text-sm font-mono">{externalCode}</code>
                    <span className="text-[var(--muted-foreground)]">→</span>
                    <code className={cn("text-sm font-mono font-bold", colorClass)}>
                      {canonicalCode}
                    </code>
                    <div className="flex-1" />
                    <Badge variant="outline" className="text-xs">
                      {source}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => onRemove(externalCode)}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Add new alias */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase">
              Add Alias
            </h4>
            <div className="flex items-center gap-2">
              <Input
                placeholder="External code (e.g., ALL)"
                value={newExternal}
                onChange={(e) => setNewExternal(e.target.value)}
                className="flex-1 font-mono"
              />
              <span className="text-[var(--muted-foreground)]">→</span>
              <Input
                placeholder="Canonical code (e.g., 2L2W)"
                value={newCanonical}
                onChange={(e) => setNewCanonical(e.target.value)}
                className="flex-1 font-mono"
              />
              <Button size="sm" onClick={handleAdd}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Reference */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Canonical Codes
            </h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {examples.slice(0, 6).map(({ code, description }) => (
                <div key={code} className="flex items-center gap-1">
                  <code className={cn("font-mono", colorClass)}>{code}</code>
                  <span className="text-[var(--muted-foreground)]">- {description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TEST PARSER
// ============================================================

interface TestParserProps {
  dialect: Partial<OrgServiceDialect>;
}

function TestParser({ dialect }: TestParserProps) {
  const [testInput, setTestInput] = React.useState("");
  const [results, setResults] = React.useState<TestResult[]>([]);
  
  const runTest = () => {
    if (!testInput.trim()) return;
    
    const newResults: TestResult[] = [];
    
    // Test edgeband parsing
    const ebResult = parseEdgeCode(testInput.trim());
    if (ebResult.length > 0) {
      newResults.push({
        input: testInput,
        output: `Edgeband: ${formatEdgebandCode({ edges: ebResult as EdgeSide[] })}`,
        success: true,
        details: `Edges: ${ebResult.join(", ")}`,
      });
    }
    
    // Test groove parsing
    const grResult = parseGrooveCode(testInput.trim());
    if (grResult) {
      newResults.push({
        input: testInput,
        output: `Groove: ${formatGroovesCode([{
          onEdge: grResult.edges[0] as EdgeSide,
          widthMm: grResult.widthMm,
          distanceFromEdgeMm: grResult.offsetMm,
          depthMm: 10,
          face: "back",
        }])}`,
        success: true,
        details: `Width: ${grResult.widthMm}mm, Offset: ${grResult.offsetMm}mm`,
      });
    }
    
    // Test hole parsing
    const holeResult = parseHoleCode(testInput.trim());
    if (holeResult) {
      newResults.push({
        input: testInput,
        output: `Holes: ${holeResult.kind}`,
        success: true,
        details: `Kind: ${holeResult.kind}, Count: ${holeResult.count ?? "N/A"}`,
      });
    }
    
    // Test CNC parsing
    const cncResult = parseCncCode(testInput.trim());
    if (cncResult) {
      newResults.push({
        input: testInput,
        output: `CNC: ${cncResult.type} - ${cncResult.shapeId}`,
        success: true,
        details: JSON.stringify(cncResult.params),
      });
    }
    
    if (newResults.length === 0) {
      newResults.push({
        input: testInput,
        output: "No match found",
        success: false,
        details: "The input didn't match any known patterns. Consider adding an alias.",
      });
    }
    
    setResults(newResults);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <TestTube className="w-4 h-4" />
          Test Parser
        </CardTitle>
        <CardDescription>
          Test how your notation will be interpreted
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter notation to test (e.g., 2L2W, G-ALL-4-10, H2-110)"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTest()}
            className="font-mono"
          />
          <Button onClick={runTest}>
            Test
          </Button>
        </div>
        
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result, idx) => (
              <div 
                key={idx}
                className={cn(
                  "p-3 rounded-lg border",
                  result.success 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}
              >
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <div className="font-medium text-sm">{result.output}</div>
                    {result.details && (
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                        {result.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface ServiceDialectSettingsProps {
  organizationId?: string;
  initialDialect?: Partial<OrgServiceDialect>;
  onSave?: (dialect: Partial<OrgServiceDialect>) => Promise<void>;
}

export function ServiceDialectSettings({
  organizationId,
  initialDialect,
  onSave,
}: ServiceDialectSettingsProps) {
  const [dialect, setDialect] = React.useState<Partial<OrgServiceDialect>>(
    initialDialect ?? {}
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  
  // Get defaults for reference
  const defaults = getDefaultDialect();
  
  // Update alias handlers
  const addEdgebandAlias = (external: string, canonical: string) => {
    setDialect(prev => ({
      ...prev,
      edgeband: {
        ...defaults.edgeband,
        ...prev.edgeband,
        aliases: {
          ...defaults.edgeband.aliases,
          ...prev.edgeband?.aliases,
          [external]: canonical,
        },
      },
    }));
    setHasChanges(true);
  };
  
  const removeEdgebandAlias = (external: string) => {
    setDialect(prev => {
      const newAliases = { ...prev.edgeband?.aliases };
      delete newAliases[external];
      return {
        ...prev,
        edgeband: {
          ...defaults.edgeband,
          ...prev.edgeband,
          aliases: newAliases,
        },
      };
    });
    setHasChanges(true);
  };
  
  const addGrooveAlias = (external: string, canonical: string) => {
    setDialect(prev => ({
      ...prev,
      groove: {
        ...defaults.groove,
        ...prev.groove,
        aliases: {
          ...defaults.groove.aliases,
          ...prev.groove?.aliases,
          [external]: canonical,
        },
      },
    }));
    setHasChanges(true);
  };
  
  const removeGrooveAlias = (external: string) => {
    setDialect(prev => {
      const newAliases = { ...prev.groove?.aliases };
      delete newAliases[external];
      return {
        ...prev,
        groove: {
          ...defaults.groove,
          ...prev.groove,
          aliases: newAliases,
        },
      };
    });
    setHasChanges(true);
  };
  
  const addDrillingAlias = (external: string, canonical: string) => {
    setDialect(prev => ({
      ...prev,
      drilling: {
        ...defaults.drilling,
        ...prev.drilling,
        aliases: {
          ...defaults.drilling.aliases,
          ...prev.drilling?.aliases,
          [external]: canonical,
        },
      },
    }));
    setHasChanges(true);
  };
  
  const removeDrillingAlias = (external: string) => {
    setDialect(prev => {
      const newAliases = { ...prev.drilling?.aliases };
      delete newAliases[external];
      return {
        ...prev,
        drilling: {
          ...defaults.drilling,
          ...prev.drilling,
          aliases: newAliases,
        },
      };
    });
    setHasChanges(true);
  };
  
  const addCncAlias = (external: string, canonical: string) => {
    setDialect(prev => ({
      ...prev,
      cnc: {
        ...defaults.cnc,
        ...prev.cnc,
        aliases: {
          ...defaults.cnc.aliases,
          ...prev.cnc?.aliases,
          [external]: canonical,
        },
      },
    }));
    setHasChanges(true);
  };
  
  const removeCncAlias = (external: string) => {
    setDialect(prev => {
      const newAliases = { ...prev.cnc?.aliases };
      delete newAliases[external];
      return {
        ...prev,
        cnc: {
          ...defaults.cnc,
          ...prev.cnc,
          aliases: newAliases,
        },
      };
    });
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(dialect);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--primary)]/10">
            <Settings2 className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Service Dialect</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Configure how external notations are translated to CabinetAI codes
            </p>
          </div>
        </div>
        {onSave && (
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
      
      {/* Info Banner */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              One Internal Truth, Many External Dialects
            </p>
            <p className="text-blue-600/80 dark:text-blue-400/80 mt-1">
              CabinetAI uses canonical shortcodes internally (e.g., <code>2L2W</code>, <code>G-ALL-4-10</code>). 
              Configure aliases to translate your customers' notations to these codes.
            </p>
          </div>
        </div>
      </div>
      
      {/* Alias Editors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alias Configuration</CardTitle>
          <CardDescription>
            Define how external codes map to canonical CabinetAI codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Edgeband */}
          <AliasEditor
            title="Edgebanding"
            description="Map external edgeband notations to canonical codes (L1, L2, W1, W2)"
            aliases={dialect.edgeband?.aliases ?? {}}
            onAdd={addEdgebandAlias}
            onRemove={removeEdgebandAlias}
            validateCanonical={(code) => parseEdgeCode(code).length > 0}
            examples={SHORTCODE_REFERENCE.edgeband.examples}
            colorClass="bg-blue-500/20 text-blue-700 dark:text-blue-300"
          />
          
          {/* Groove */}
          <AliasEditor
            title="Grooves"
            description="Map groove notations to canonical G-codes (G[edge]-[width]-[offset])"
            aliases={dialect.groove?.aliases ?? {}}
            onAdd={addGrooveAlias}
            onRemove={removeGrooveAlias}
            validateCanonical={(code) => parseGrooveCode(code) !== null}
            examples={SHORTCODE_REFERENCE.groove.examples}
            colorClass="bg-amber-500/20 text-amber-700 dark:text-amber-300"
          />
          
          {/* Drilling */}
          <AliasEditor
            title="Drilling/Holes"
            description="Map drilling notations to canonical H-codes (H[count]-[offset], SP-*, HD-*)"
            aliases={dialect.drilling?.aliases ?? {}}
            onAdd={addDrillingAlias}
            onRemove={removeDrillingAlias}
            validateCanonical={(code) => parseHoleCode(code) !== null}
            examples={SHORTCODE_REFERENCE.holes.examples}
            colorClass="bg-purple-500/20 text-purple-700 dark:text-purple-300"
          />
          
          {/* CNC */}
          <AliasEditor
            title="CNC Operations"
            description="Map CNC notations to canonical codes (CUTOUT-*, RADIUS-*, POCKET-*)"
            aliases={dialect.cnc?.aliases ?? {}}
            onAdd={addCncAlias}
            onRemove={removeCncAlias}
            validateCanonical={(code) => parseCncCode(code) !== null}
            examples={SHORTCODE_REFERENCE.cnc.examples}
            colorClass="bg-green-500/20 text-green-700 dark:text-green-300"
          />
        </CardContent>
      </Card>
      
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dialect.useAiFallback ?? defaults.useAiFallback}
              onChange={(e) => {
                setDialect(prev => ({ ...prev, useAiFallback: e.target.checked }));
                setHasChanges(true);
              }}
              className="w-4 h-4 rounded border-[var(--border)]"
            />
            <div>
              <div className="font-medium text-sm">Use AI Fallback</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Use AI to interpret unrecognized notations
              </div>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dialect.autoLearn ?? defaults.autoLearn}
              onChange={(e) => {
                setDialect(prev => ({ ...prev, autoLearn: e.target.checked }));
                setHasChanges(true);
              }}
              className="w-4 h-4 rounded border-[var(--border)]"
            />
            <div>
              <div className="font-medium text-sm">Auto-Learn Aliases</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Automatically learn new aliases from user corrections
              </div>
            </div>
          </label>
        </CardContent>
      </Card>
      
      {/* Test Parser */}
      <TestParser dialect={dialect} />
    </div>
  );
}

export default ServiceDialectSettings;

