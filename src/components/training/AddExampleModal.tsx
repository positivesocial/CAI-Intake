"use client";

/**
 * Add Training Example Modal
 * 
 * Allows super admins to add verified training examples for few-shot learning.
 * Supports BOTH file upload (using real OCR pipeline) and text paste.
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
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
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  Wand2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Info,
  Upload,
  ImageIcon,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type InputMethod = "upload" | "paste";

export function AddExampleModal({ open, onOpenChange, onSuccess }: AddExampleModalProps) {
  // Input method
  const [inputMethod, setInputMethod] = useState<InputMethod>("upload");
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Text paste state
  const [activeTab, setActiveTab] = useState("input");
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState("pdf");
  
  // Common state
  const [difficulty, setDifficulty] = useState("medium");
  const [category, setCategory] = useState("");
  const [clientName, setClientName] = useState("");
  const [partsJson, setPartsJson] = useState("");
  const [parsedParts, setParsedParts] = useState<PartRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [processingStats, setProcessingStats] = useState<{
    confidence: number;
    timeMs: number;
    partsCount: number;
  } | null>(null);

  // File dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Clean up previous preview
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setUploadedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
    setProcessingStats(null);
    setParsedParts([]);
    setPartsJson("");

    // Auto-process the file
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("returnParsedParts", "true");
      formData.append("extractMetadata", "true");

      const startTime = Date.now();
      const response = await fetch("/api/v1/parse-file", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (response.ok && data.success && data.parts?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized = data.parts.map((p: any) => {
          // Extract edge banding - can be in ops.edgeBanding, ops.edging, or top-level edgeBanding
          const edgeBanding = p.ops?.edgeBanding || p.edgeBanding || p.ops?.edging;
          let edgeCode = "";
          if (edgeBanding) {
            if (typeof edgeBanding === "string") {
              edgeCode = edgeBanding;
            } else if (edgeBanding.detected || edgeBanding.L1 || edgeBanding.L2 || edgeBanding.W1 || edgeBanding.W2) {
              edgeCode = formatEdgeCode(edgeBanding);
            } else if (edgeBanding.summary?.code) {
              edgeCode = edgeBanding.summary.code;
            }
          }
          
          // Extract grooving - can be in ops.grooves, grooving, or top-level
          const grooving = p.ops?.grooves || p.grooving;
          let grooveCode = "";
          if (grooving) {
            if (typeof grooving === "string") {
              grooveCode = grooving;
            } else if (Array.isArray(grooving) && grooving.length > 0) {
              grooveCode = "GL"; // Has groove operations
            } else if (grooving.detected) {
              grooveCode = (grooving.GL ? "GL" : "") + (grooving.GW ? "GW" : "");
            }
          }
          
          return {
            label: p.label || p.part_id || "Part",
            length: p.size?.L ?? p.length ?? p.length_mm ?? 0,
            width: p.size?.W ?? p.width ?? p.width_mm ?? 0,
            quantity: p.qty ?? p.quantity ?? 1,
            thickness: p.thickness_mm ?? p.thickness ?? 18,
            material: p.material_id ?? p.material,
            edge: edgeCode || undefined,
            groove: grooveCode || undefined,
            notes: p.notes,
          };
        });

        setParsedParts(normalized);
        setPartsJson(JSON.stringify(normalized, null, 2));
        setProcessingStats({
          confidence: data.totalConfidence || 0,
          timeMs: processingTime,
          partsCount: normalized.length,
        });
        
        // Auto-set source type based on file
        if (file.type === "application/pdf") setSourceType("pdf");
        else if (file.type.startsWith("image/")) setSourceType("image");
        else if (file.type.includes("excel") || file.type.includes("spreadsheet")) setSourceType("excel");
        else if (file.type === "text/csv") setSourceType("csv");
        
        toast.success(`Extracted ${normalized.length} parts - please verify!`);
      } else {
        toast.error(data.errors?.[0] || data.error || "No parts extracted");
        setParseError(data.errors?.[0] || "Failed to extract parts");
      }
    } catch (error) {
      toast.error("Processing failed: " + (error as Error).message);
      setParseError((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [filePreviewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

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

  // Use AI to parse the source text (for text paste mode)
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
    if (inputMethod === "paste" && !sourceText.trim()) {
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
          sourceText: inputMethod === "upload" 
            ? `[Parsed from file: ${uploadedFile?.name}]\nParts: ${parsedParts.length}`
            : sourceText,
          sourceFileName: uploadedFile?.name,
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
      resetForm();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setUploadedFile(null);
    setFilePreviewUrl(null);
    setSourceText("");
    setPartsJson("");
    setParsedParts([]);
    setActiveTab("input");
    setProcessingStats(null);
    setParseError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Training Example
          </DialogTitle>
          <DialogDescription>
            Add a verified example to improve AI parsing accuracy. You can upload a file (recommended) or paste text.
          </DialogDescription>
        </DialogHeader>

        {/* Input method selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={inputMethod === "upload" ? "primary" : "outline"}
            onClick={() => setInputMethod("upload")}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File (Recommended)
          </Button>
          <Button
            variant={inputMethod === "paste" ? "primary" : "outline"}
            onClick={() => setInputMethod("paste")}
            className="flex-1"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Paste Text
          </Button>
        </div>

        {inputMethod === "upload" ? (
          /* File Upload Mode */
          <div className="space-y-4">
            {/* Info banner */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 flex gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Same OCR as users:</strong> Your file will be processed through the exact same 
                  pipeline that regular users use. Verify and correct the output to create a training example.
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* File upload / preview */}
              <div>
                <Label className="mb-2 block">Source File</Label>
                {!uploadedFile ? (
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors h-[300px] flex flex-col items-center justify-center",
                      isDragActive
                        ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                        : "border-[var(--border)] hover:border-[var(--cai-teal)]/50",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-10 w-10 text-[var(--muted-foreground)] mb-3" />
                    <p className="font-medium">
                      {isDragActive ? "Drop file here..." : "Drop a file here"}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">
                      or click to browse
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">
                      PDF, Images, Excel, CSV
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden h-[300px] relative">
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="text-center text-white">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p>Processing...</p>
                        </div>
                      </div>
                    )}
                    {filePreviewUrl && uploadedFile.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={filePreviewUrl}
                        alt={uploadedFile.name}
                        className="w-full h-full object-contain bg-gray-50 dark:bg-gray-900"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
                        <FileText className="h-16 w-16 text-red-500 mb-2" />
                        <p className="font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                        setUploadedFile(null);
                        setFilePreviewUrl(null);
                        setParsedParts([]);
                        setPartsJson("");
                        setProcessingStats(null);
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                )}
                
                {/* Processing stats */}
                {processingStats && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {processingStats.partsCount} parts
                    </Badge>
                    <Badge variant="secondary">
                      {Math.round(processingStats.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="outline">
                      {(processingStats.timeMs / 1000).toFixed(1)}s
                    </Badge>
                  </div>
                )}
              </div>

              {/* Editable parts */}
              <div>
                <Label className="mb-2 block">Parsed Parts (Edit to correct)</Label>
                <Textarea
                  value={partsJson}
                  onChange={(e) => {
                    setPartsJson(e.target.value);
                    setParseError(null);
                  }}
                  className="font-mono text-xs h-[260px] resize-none"
                  placeholder="Upload a file to see parsed parts here..."
                />
                <div className="flex gap-2 mt-2">
                  <Button onClick={handleParseJson} variant="outline" size="sm">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Validate JSON
                  </Button>
                </div>
                {parseError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                    <AlertCircle className="h-4 w-4" />
                    {parseError}
                  </div>
                )}
                {parsedParts.length > 0 && !parseError && (
                  <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {parsedParts.length} parts validated
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy - Clean data</SelectItem>
                    <SelectItem value="medium">Medium - Some ambiguity</SelectItem>
                    <SelectItem value="hard">Hard - Messy/handwritten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Input
                  placeholder="e.g., Kitchen, Closet"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Name (optional)</Label>
                <Input
                  placeholder="e.g., RadiantCuts"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={parsedParts.length === 0 || isSubmitting}
              >
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
          </div>
        ) : (
          /* Text Paste Mode (original flow) */
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
                      &quot;ground truth&quot; that the AI learns from.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Correct Parts (JSON)</Label>
                <Textarea
                  placeholder={`[
  { "label": "Side Panel", "length": 720, "width": 560, "quantity": 2 },
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

              <Button onClick={handleParseJson} variant="outline">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Validate JSON
              </Button>

              {parseError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {parseError}
                </div>
              )}

              {parsedParts.length > 0 && (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-green-600 text-sm mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Validated: {parsedParts.length} parts
                    </div>
                    <div className="max-h-32 overflow-auto text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-2 py-1 text-left">Label</th>
                            <th className="px-2 py-1 text-right">L</th>
                            <th className="px-2 py-1 text-right">W</th>
                            <th className="px-2 py-1 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedParts.slice(0, 5).map((part, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1">{part.label}</td>
                              <td className="px-2 py-1 text-right">{part.length}</td>
                              <td className="px-2 py-1 text-right">{part.width}</td>
                              <td className="px-2 py-1 text-right">{part.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedParts.length > 5 && (
                        <p className="text-center py-1 text-[var(--muted-foreground)]">
                          ...and {parsedParts.length - 5} more
                        </p>
                      )}
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
                      <SelectItem value="easy">Easy - Clean, structured</SelectItem>
                      <SelectItem value="medium">Medium - Some ambiguity</SelectItem>
                      <SelectItem value="hard">Hard - Messy, handwritten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category (optional)</Label>
                  <Input
                    placeholder="e.g., Kitchen, Closet"
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
                </div>
              </div>

              {/* Summary */}
              <Card className="bg-gray-50 dark:bg-gray-900">
                <CardContent className="p-4 space-y-2">
                  <div className="font-medium text-sm">Training Example Summary</div>
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
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AddExampleModal;

// ============================================================
// HELPERS
// ============================================================

function formatEdgeCode(edgeBanding: { L1?: boolean; L2?: boolean; W1?: boolean; W2?: boolean }): string {
  const parts: string[] = [];
  const l1 = edgeBanding.L1 ?? false;
  const l2 = edgeBanding.L2 ?? false;
  const w1 = edgeBanding.W1 ?? false;
  const w2 = edgeBanding.W2 ?? false;
  
  if (l1 && l2) parts.push("2L");
  else if (l1 || l2) parts.push("1L");
  
  if (w1 && w2) parts.push("2W");
  else if (w1 || w2) parts.push("1W");
  
  return parts.join("") || "";
}
