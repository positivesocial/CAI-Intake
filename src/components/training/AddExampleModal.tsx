"use client";

/**
 * Add Training Example Modal
 * 
 * Allows super admins to add verified training examples for few-shot learning.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  Wand2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface AddExampleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PartRow {
  label: string;
  length: number;
  width: number;
  quantity: number;
  thickness?: number;
  material?: string;
  edge?: string;
  groove?: string;
  notes?: string;
}

export function AddExampleModal({ open, onOpenChange, onSuccess }: AddExampleModalProps) {
  const [activeTab, setActiveTab] = useState("input");
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState("pdf");
  const [difficulty, setDifficulty] = useState("medium");
  const [category, setCategory] = useState("");
  const [clientName, setClientName] = useState("");
  const [partsJson, setPartsJson] = useState("");
  const [parsedParts, setParsedParts] = useState<PartRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Parse JSON input to validate parts
  const handleParseJson = () => {
    setParseError(null);
    try {
      const parts = JSON.parse(partsJson);
      if (!Array.isArray(parts)) {
        throw new Error("Parts must be an array");
      }
      if (parts.length === 0) {
        throw new Error("At least one part is required");
      }
      // Validate each part has required fields
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part.label && !part.partName && !part.name) {
          throw new Error(`Part ${i + 1}: Missing label/name`);
        }
        if (typeof part.length !== "number" && typeof part.L !== "number") {
          throw new Error(`Part ${i + 1}: Missing or invalid length`);
        }
        if (typeof part.width !== "number" && typeof part.W !== "number") {
          throw new Error(`Part ${i + 1}: Missing or invalid width`);
        }
      }
      // Normalize parts
      const normalized = parts.map((p: Record<string, unknown>) => ({
        label: (p.label || p.partName || p.name) as string,
        length: (p.length || p.L) as number,
        width: (p.width || p.W) as number,
        quantity: ((p.quantity || p.qty || p.Qty || 1) as number),
        thickness: (p.thickness || p.thk || p.Thk) as number | undefined,
        material: (p.material || p.mat) as string | undefined,
        edge: (p.edge || p.edging || p.EB) as string | undefined,
        groove: (p.groove || p.grooving) as string | undefined,
        notes: (p.notes || p.note) as string | undefined,
      }));
      setParsedParts(normalized);
      toast.success(`Validated ${normalized.length} parts`);
    } catch (e) {
      const error = e as Error;
      setParseError(error.message);
      setParsedParts([]);
    }
  };

  // Use AI to parse the source text and get ground truth
  const handleAIParse = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter source text first");
      return;
    }
    
    setIsParsing(true);
    try {
      const response = await fetch("/api/v1/training/test-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          provider: "anthropic",
        }),
      });
      
      if (!response.ok) {
        throw new Error("AI parsing failed");
      }
      
      const data = await response.json();
      if (data.parts?.length > 0) {
        setPartsJson(JSON.stringify(data.parts, null, 2));
        setParsedParts(data.parts);
        setActiveTab("verify");
        toast.success(`AI extracted ${data.parts.length} parts - please verify!`);
      } else {
        toast.error("AI could not extract any parts");
      }
    } catch (error) {
      toast.error("AI parsing failed: " + (error as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  // Submit the training example
  const handleSubmit = async () => {
    if (!sourceText.trim()) {
      toast.error("Source text is required");
      return;
    }
    if (parsedParts.length === 0) {
      toast.error("Please validate parts first");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/training/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceText,
          correctParts: parsedParts,
          difficulty,
          category: category || undefined,
          clientName: clientName || undefined,
          features: {
            hasHeaders: sourceText.toLowerCase().includes("length") || sourceText.toLowerCase().includes("width"),
            columnCount: null,
            rowCount: parsedParts.length,
            hasEdgeNotation: parsedParts.some(p => p.edge),
            hasGrooveNotation: parsedParts.some(p => p.groove),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save example");
      }

      toast.success("Training example added successfully!");
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setSourceText("");
      setPartsJson("");
      setParsedParts([]);
      setActiveTab("input");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Training Example
          </DialogTitle>
          <DialogDescription>
            Add a verified cutlist example to improve AI parsing accuracy via few-shot learning.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="input">1. Input</TabsTrigger>
            <TabsTrigger value="verify">2. Verify Output</TabsTrigger>
            <TabsTrigger value="metadata">3. Metadata</TabsTrigger>
          </TabsList>

          {/* Step 1: Input */}
          <TabsContent value="input" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="image">Scanned Image</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                  <SelectItem value="csv">CSV File</SelectItem>
                  <SelectItem value="text">Plain Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source Text (OCR Output)</Label>
              <Textarea
                placeholder="Paste the raw OCR text or extracted content here..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This is the text that the AI will learn to parse. Paste exactly what the OCR extracted.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAIParse}
                disabled={!sourceText.trim() || isParsing}
                className="flex-1"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Parse with AI (then verify)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab("verify")}
                disabled={!sourceText.trim()}
              >
                Manual Entry →
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Verify Output */}
          <TabsContent value="verify" className="space-y-4 mt-4">
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Important:</strong> Verify and correct the parts below. These become the 
                    &quot;ground truth&quot; that the AI learns from. Accuracy here directly impacts 
                    future parsing quality.
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Correct Parts (JSON)</Label>
              <Textarea
                placeholder={`[
  { "label": "Side Panel", "length": 720, "width": 560, "quantity": 2, "material": "MDF", "edge": "2L" },
  { "label": "Top", "length": 600, "width": 400, "quantity": 1 }
]`}
                value={partsJson}
                onChange={(e) => {
                  setPartsJson(e.target.value);
                  setParseError(null);
                }}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleParseJson} variant="outline">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Validate JSON
              </Button>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </div>
            )}

            {parsedParts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Validated: {parsedParts.length} parts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-2 py-1 text-left">Label</th>
                          <th className="px-2 py-1 text-right">L</th>
                          <th className="px-2 py-1 text-right">W</th>
                          <th className="px-2 py-1 text-right">Qty</th>
                          <th className="px-2 py-1 text-left">Material</th>
                          <th className="px-2 py-1 text-left">Edge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedParts.map((part, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{part.label}</td>
                            <td className="px-2 py-1 text-right">{part.length}</td>
                            <td className="px-2 py-1 text-right">{part.width}</td>
                            <td className="px-2 py-1 text-right">{part.quantity}</td>
                            <td className="px-2 py-1">{part.material || "-"}</td>
                            <td className="px-2 py-1">{part.edge || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setActiveTab("input")}>
                ← Back
              </Button>
              <Button
                onClick={() => setActiveTab("metadata")}
                disabled={parsedParts.length === 0}
              >
                Continue →
              </Button>
            </div>
          </TabsContent>

          {/* Step 3: Metadata */}
          <TabsContent value="metadata" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy - Clean, structured data</SelectItem>
                    <SelectItem value="medium">Medium - Some ambiguity</SelectItem>
                    <SelectItem value="hard">Hard - Messy, handwritten, or complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Input
                  placeholder="e.g., Kitchen, Closet, Office"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Client/Template Name (optional)</Label>
                <Input
                  placeholder="e.g., RadiantCuts, ABC Cabinets"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If this cutlist format is from a specific client, add their name for better matching.
                </p>
              </div>
            </div>

            {/* Summary */}
            <Card className="bg-gray-50 dark:bg-gray-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Training Example Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{sourceType}</Badge>
                  <Badge variant={
                    difficulty === "easy" ? "default" : 
                    difficulty === "hard" ? "destructive" : "secondary"
                  }>
                    {difficulty}
                  </Badge>
                  <Badge variant="outline">{parsedParts.length} parts</Badge>
                  {category && <Badge variant="outline">{category}</Badge>}
                  {clientName && <Badge variant="outline">{clientName}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Source text: {sourceText.slice(0, 100)}...
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setActiveTab("verify")}>
                ← Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Training Example
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AddExampleModal;

