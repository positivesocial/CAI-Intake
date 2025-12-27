"use client";

import * as React from "react";
import {
  Mic,
  MicOff,
  Square,
  Trash2,
  Check,
  Volume2,
  AlertCircle,
  Upload,
  FileAudio,
  Loader2,
  X,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { parseTextLine, type TextParseResult } from "@/lib/parsers/text-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TranscriptItem {
  id: string;
  text: string;
  parseResult: TextParseResult | null;
  timestamp: Date;
  source: "mic" | "file";
}

interface UploadedAudio {
  file: File;
  status: "pending" | "transcribing" | "transcribed" | "error";
  transcription?: string;
  error?: string;
  duration?: number;
}

export function VoiceDictation() {
  const addToInbox = useIntakeStore((state) => state.addToInbox);

  const [activeTab, setActiveTab] = React.useState<"mic" | "upload">("mic");
  const [isListening, setIsListening] = React.useState(false);
  const [isSupported, setIsSupported] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Live microphone state - single part at a time
  const [currentTranscript, setCurrentTranscript] = React.useState("");
  const [currentParseResult, setCurrentParseResult] = React.useState<TextParseResult | null>(null);
  const [partsAddedCount, setPartsAddedCount] = React.useState(0);

  // File upload state - multiple parts queue
  const [transcripts, setTranscripts] = React.useState<TranscriptItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedAudio[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);

  // Parse the current transcript whenever it changes
  React.useEffect(() => {
    if (currentTranscript.trim()) {
      const result = parseTextLine(currentTranscript, {
        sourceMethod: "voice",
        defaultMaterialId: "MAT-WHITE-18",
        defaultThicknessMm: 18,
      });
      setCurrentParseResult(result.errors.length === 0 ? result : null);
    } else {
      setCurrentParseResult(null);
    }
  }, [currentTranscript]);

  // Check for browser support and set up recognition
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Update the current transcript with interim results for live preview
      if (interim) {
        setCurrentTranscript((prev) => {
          // If we have a final result, append interim to it
          // Otherwise just show interim
          return prev ? prev + " " + interim : interim;
        });
      }

      // When we get a final result, update the transcript
      if (final) {
        setCurrentTranscript((prev) => {
          const updated = prev ? prev + " " + final.trim() : final.trim();
          return updated;
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Restart if still supposed to be listening
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isListening]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setError(null);
    setCurrentTranscript("");
    setCurrentParseResult(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      setError("Failed to start speech recognition");
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const addCurrentPartToInbox = () => {
    if (!currentParseResult?.part) return;

    const partWithStatus: ParsedPartWithStatus = {
      ...currentParseResult.part,
      _status: "pending",
      _originalText: currentTranscript,
    };

    addToInbox([partWithStatus]);
    setPartsAddedCount((prev) => prev + 1);
    setCurrentTranscript("");
    setCurrentParseResult(null);
  };

  const clearCurrentPart = () => {
    setCurrentTranscript("");
    setCurrentParseResult(null);
  };

  // ============================================================
  // FILE UPLOAD HANDLING
  // ============================================================

  const handleFileSelect = React.useCallback((files: FileList | null) => {
    if (!files) return;

    const audioFiles = Array.from(files).filter((file) =>
      file.type.startsWith("audio/")
    );

    if (audioFiles.length === 0) {
      setError("Please select audio files (MP3, WAV, M4A, OGG, WebM)");
      return;
    }

    const newUploads: UploadedAudio[] = audioFiles.map((file) => ({
      file,
      status: "pending",
    }));

    setUploadedFiles((prev) => [...prev, ...newUploads]);
    setError(null);

    // Auto-transcribe each file
    newUploads.forEach((upload) => {
      transcribeAudio(upload.file);
    });
  }, []);

  const transcribeAudio = async (file: File) => {
    // Update status to transcribing
    setUploadedFiles((prev) =>
      prev.map((u) =>
        u.file === file ? { ...u, status: "transcribing" } : u
      )
    );

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch("/api/v1/transcribe-audio", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      // Update file with transcription
      setUploadedFiles((prev) =>
        prev.map((u) =>
          u.file === file
            ? {
                ...u,
                status: "transcribed",
                transcription: data.text,
                duration: data.duration,
              }
            : u
        )
      );

      // Parse the transcription - split by "next" or "done"
      if (data.text) {
        // Split by "next" keyword and filter out "done"
        const segments = data.text
          .split(/\b(?:next|and\s+next|then)\b/i)
          .map((s: string) => s.replace(/\bdone\b/gi, "").trim())
          .filter((s: string) => s.length > 0);

        for (const segment of segments) {
          const parseResult = parseTextLine(segment, {
            sourceMethod: "voice",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
          });

          setTranscripts((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text: segment,
              parseResult: parseResult.errors.length === 0 ? parseResult : null,
              timestamp: new Date(),
              source: "file",
            },
          ]);
        }
      }
    } catch (err) {
      setUploadedFiles((prev) =>
        prev.map((u) =>
          u.file === file
            ? {
                ...u,
                status: "error",
                error: err instanceof Error ? err.message : "Unknown error",
              }
            : u
        )
      );
    }
  };

  const removeUploadedFile = (file: File) => {
    setUploadedFiles((prev) => prev.filter((u) => u.file !== file));
  };

  const removeTranscript = (id: string) => {
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAllTranscripts = () => {
    setTranscripts([]);
  };

  const addAllToInbox = () => {
    const validParts = transcripts
      .filter((t) => t.parseResult?.part)
      .map((t) => ({
        ...t.parseResult!.part,
        _status: "pending" as const,
        _originalText: t.text,
      }));

    addToInbox(validParts as ParsedPartWithStatus[]);
    setTranscripts([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const validCount = transcripts.filter((t) => t.parseResult).length;
  const transcribingCount = uploadedFiles.filter(
    (f) => f.status === "transcribing"
  ).length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Voice Input</CardTitle>
            {isListening && (
              <Badge variant="success" className="animate-pulse">
                Listening...
              </Badge>
            )}
            {transcribingCount > 0 && (
              <Badge variant="secondary" className="animate-pulse">
                Transcribing {transcribingCount}...
              </Badge>
            )}
          </div>
          {partsAddedCount > 0 && activeTab === "mic" && (
            <Badge variant="outline" className="text-green-600">
              {partsAddedCount} parts added
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tabs for Mic vs Upload */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "mic" | "upload")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mic" className="gap-2">
              <Mic className="h-4 w-4" />
              Live Microphone
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Voice Note
            </TabsTrigger>
          </TabsList>

          {/* Live Microphone Tab - One part at a time */}
          <TabsContent value="mic" className="mt-4 space-y-4">
            {!isSupported ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <MicOff className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
                <h3 className="text-lg font-medium mb-1">Voice Not Supported</h3>
                <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
                  Your browser doesn't support the Web Speech API. Try using Chrome
                  or Edge for voice dictation.
                </p>
              </div>
            ) : (
              <>
                {/* Microphone control */}
                <div className="flex flex-col items-center py-4">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                      isListening
                        ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse"
                        : "bg-[var(--cai-teal)] hover:bg-[var(--cai-teal-light)] shadow-lg shadow-[var(--cai-teal)]/30"
                    )}
                  >
                    {isListening ? (
                      <Square className="h-8 w-8 text-white" />
                    ) : (
                      <Mic className="h-8 w-8 text-[var(--cai-navy)]" />
                    )}
                  </button>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {isListening
                      ? "Listening... Speak one part at a time"
                      : "Click to start dictating"}
                  </p>
                </div>

                {/* Live part preview */}
                <div className={cn(
                  "p-4 rounded-lg border-2 transition-colors min-h-[120px]",
                  currentParseResult
                    ? "border-green-300 bg-green-50/50"
                    : currentTranscript
                    ? "border-yellow-300 bg-yellow-50/50"
                    : "border-[var(--border)] bg-[var(--muted)]/30"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--muted-foreground)] mb-1">Current Part:</p>
                      {currentTranscript ? (
                        <>
                          <p className="font-medium text-[var(--foreground)]">
                            "{currentTranscript}"
                          </p>
                          {currentParseResult?.part ? (
                            <div className="mt-2 p-2 bg-white/70 rounded border border-green-200">
                              <div className="flex items-center gap-2 text-sm text-green-700">
                                <Check className="h-4 w-4" />
                                <span className="font-medium">
                                  {currentParseResult.part.qty}× {currentParseResult.part.size.L} × {currentParseResult.part.size.W}mm
                                </span>
                                {currentParseResult.part.label && (
                                  <span className="text-xs">"{currentParseResult.part.label}"</span>
                                )}
                              </div>
                              {currentParseResult.part.ops?.edging && (
                                <p className="text-xs text-green-600 mt-1">
                                  Edges: {Object.keys(currentParseResult.part.ops.edging.edges || {}).join(", ")}
                                </p>
                              )}
                              {currentParseResult.part.ops?.grooves && currentParseResult.part.ops.grooves.length > 0 && (
                                <p className="text-xs text-green-600">
                                  Groove: ✓
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-yellow-600">
                              Could not parse dimensions yet...
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[var(--muted-foreground)] italic">
                          Say: "[Length] by [Width] by [Qty] with [Operations]"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {currentTranscript && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={addCurrentPartToInbox}
                        disabled={!currentParseResult?.part}
                        className="flex-1"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add to Inbox
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearCurrentPart}
                        className="text-[var(--muted-foreground)]"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                {/* Voice format help for microphone */}
                <div className="bg-[var(--muted)] rounded-lg p-3 text-xs">
                  <p className="font-semibold text-[var(--foreground)] mb-2">Voice Format:</p>
                  <div className="font-mono p-2 bg-[var(--background)] rounded mb-2">
                    [LENGTH] by [WIDTH] by [QTY] with [OPS]
                  </div>
                  <div className="space-y-1 text-[var(--muted-foreground)]">
                    <p>"720 by 560" → 1× 720×560mm</p>
                    <p>"800 by 400 by 2 with edges" → 2× 800×400mm, all edges</p>
                    <p>"600 by 300 by 4 with two long" → 4× 600×300mm, L1+L2</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Upload Voice Note Tab - Multiple parts */}
          <TabsContent value="upload" className="mt-4 space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-[var(--cai-teal)] bg-[var(--cai-teal)]/5"
                  : "border-[var(--border)] hover:border-[var(--cai-teal)]/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <FileAudio className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3" />
              <h3 className="text-base font-medium mb-1">Upload Voice Notes</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Drag & drop or click to browse
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                MP3, WAV, M4A, OGG, WebM (max 25MB)
              </p>
            </div>

            {/* Voice format help for uploads */}
            <div className="bg-[var(--muted)] rounded-lg p-3 text-xs">
              <p className="font-semibold text-[var(--foreground)] mb-2">Recording Format:</p>
              <div className="font-mono p-2 bg-[var(--background)] rounded mb-2">
                [LENGTH] by [WIDTH] by [QTY] with [OPS], <strong>next</strong>, [part 2], ... <strong>done</strong>
              </div>
              <div className="space-y-1 text-[var(--muted-foreground)]">
                <p>"720 by 560, <strong>next</strong>, 800 by 400 by 2 with edges, <strong>next</strong>, 600 by 300, <strong>done</strong>"</p>
              </div>
              <p className="mt-2 text-[var(--foreground)]">
                💡 Say <strong>"next"</strong> between parts, <strong>"done"</strong> when finished
              </p>
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Uploaded Files</h4>
                <div className="space-y-2 max-h-[150px] overflow-auto">
                  {uploadedFiles.map((upload, idx) => (
                    <div
                      key={`${upload.file.name}-${idx}`}
                      className={cn(
                        "flex items-center justify-between gap-3 p-2.5 rounded-lg border",
                        upload.status === "transcribed"
                          ? "border-green-200 bg-green-50/50"
                          : upload.status === "error"
                          ? "border-red-200 bg-red-50/50"
                          : "border-[var(--border)] bg-[var(--muted)]/50"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileAudio className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {upload.file.name}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                            {upload.duration && ` • ${Math.round(upload.duration)}s`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {upload.status === "transcribing" && (
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--cai-teal)]" />
                        )}
                        {upload.status === "transcribed" && (
                          <Badge variant="success" className="text-xs">✓</Badge>
                        )}
                        {upload.status === "error" && (
                          <Badge variant="error" className="text-xs">Error</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[var(--muted-foreground)] hover:text-red-600"
                          onClick={() => removeUploadedFile(upload.file)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcripts queue */}
            {transcripts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Parsed Parts ({transcripts.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={clearAllTranscripts}>
                      Clear All
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={addAllToInbox}
                      disabled={validCount === 0}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Add {validCount} to Inbox
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {transcripts.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-start justify-between gap-2 p-2.5 rounded-lg border",
                        t.parseResult
                          ? "border-green-200 bg-green-50/50"
                          : "border-red-200 bg-red-50/50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.text}</p>
                        {t.parseResult ? (
                          <p className="text-xs text-green-600 mt-0.5">
                            → {t.parseResult.part.qty}× {t.parseResult.part.size.L} × {t.parseResult.part.size.W}
                            {t.parseResult.part.label && ` "${t.parseResult.part.label}"`}
                          </p>
                        ) : (
                          <p className="text-xs text-red-600 mt-0.5">
                            Could not parse
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[var(--muted-foreground)] hover:text-red-600 flex-shrink-0"
                        onClick={() => removeTranscript(t.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
