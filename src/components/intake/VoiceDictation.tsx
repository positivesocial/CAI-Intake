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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  const [transcripts, setTranscripts] = React.useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedAudio[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);

  // Check for browser support
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
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimText(interim);

      if (final) {
        const cleanText = final.trim();
        if (cleanText) {
          const parseResult = parseTextLine(cleanText, {
            sourceMethod: "voice",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
          });

          setTranscripts((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text: cleanText,
              parseResult:
                parseResult.errors.length === 0 ? parseResult : null,
              timestamp: new Date(),
              source: "mic",
            },
          ]);
        }
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
    setInterimText("");
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

      // Parse the transcription and add to transcripts
      if (data.text) {
        // Split by common delimiters and parse each segment
        const segments = data.text
          .split(/[,;.]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        for (const segment of segments) {
          const parseResult = parseTextLine(segment, {
            sourceMethod: "voice",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
          });

          if (parseResult.errors.length === 0 && parseResult.part) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                text: segment,
                parseResult,
                timestamp: new Date(),
                source: "file",
              },
            ]);
          }
        }

        // If no segments parsed, add the whole transcription
        if (segments.length === 0 || !transcripts.some((t) => t.source === "file")) {
          const parseResult = parseTextLine(data.text, {
            sourceMethod: "voice",
            defaultMaterialId: "MAT-WHITE-18",
            defaultThicknessMm: 18,
          });

          setTranscripts((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text: data.text,
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
          {transcripts.length > 0 && (
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
                <Check className="h-4 w-4" />
                Add {validCount} to Inbox
              </Button>
            </div>
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

          {/* Live Microphone Tab */}
          <TabsContent value="mic" className="mt-4">
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
              <div className="flex flex-col items-center py-6">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse"
                      : "bg-[var(--cai-teal)] hover:bg-[var(--cai-teal-light)] shadow-lg shadow-[var(--cai-teal)]/30"
                  )}
                >
                  {isListening ? (
                    <Square className="h-10 w-10 text-white" />
                  ) : (
                    <Mic className="h-10 w-10 text-[var(--cai-navy)]" />
                  )}
                </button>
                <p className="mt-4 text-sm text-[var(--muted-foreground)]">
                  {isListening
                    ? "Click to stop recording"
                    : "Click to start dictating parts"}
                </p>

                {/* Interim text display */}
                {interimText && (
                  <div className="mt-4 p-3 bg-[var(--muted)] rounded-lg text-center max-w-md">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Hearing: {interimText}
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Upload Voice Note Tab */}
          <TabsContent value="upload" className="mt-4">
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
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
              <FileAudio className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <h3 className="text-lg font-medium mb-1">Upload Voice Notes</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-2">
                Drag & drop audio files or click to browse
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Supports: MP3, WAV, M4A, OGG, WebM, FLAC (max 25MB)
              </p>
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium">Uploaded Files</h4>
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {uploadedFiles.map((upload, idx) => (
                    <div
                      key={`${upload.file.name}-${idx}`}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-lg border",
                        upload.status === "transcribed"
                          ? "border-green-200 bg-green-50/50"
                          : upload.status === "error"
                          ? "border-red-200 bg-red-50/50"
                          : "border-[var(--border)] bg-[var(--muted)]/50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileAudio className="h-5 w-5 flex-shrink-0 text-[var(--muted-foreground)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {upload.file.name}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                            {upload.duration && ` • ${Math.round(upload.duration)}s`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {upload.status === "transcribing" && (
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--cai-teal)]" />
                        )}
                        {upload.status === "transcribed" && (
                          <Badge variant="success" className="text-xs">
                            Transcribed
                          </Badge>
                        )}
                        {upload.status === "error" && (
                          <Badge variant="error" className="text-xs">
                            Error
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-red-600"
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
          </TabsContent>
        </Tabs>

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Dictation format help - Simplified */}
        <div className="bg-[var(--muted)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Voice Format</p>
            <Badge variant="secondary" className="text-[10px]">Simple &amp; Fast</Badge>
          </div>
          
          <div className="text-xs text-[var(--foreground)] mb-3 p-2 bg-[var(--background)] rounded font-mono">
            [QTY] [LENGTH] by [WIDTH] [OPS]
          </div>
          
          <div className="grid gap-2 text-xs">
            <p className="font-medium text-[var(--foreground)]">Examples:</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">"2 720 by 560"</span>
                <span className="text-green-600">→ 2× 720×560</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">"800 by 400 edges"</span>
                <span className="text-green-600">→ 1× 800×400, all edges</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">"4 600 by 300 two long"</span>
                <span className="text-green-600">→ 4× 600×300, L1+L2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">"500 by 200 groove white"</span>
                <span className="text-green-600">→ 1× 500×200, groove, W</span>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className="font-medium text-[var(--foreground)] mb-1">Operation Keywords:</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[9px]">edges</Badge>
                <Badge variant="outline" className="text-[9px]">two long</Badge>
                <Badge variant="outline" className="text-[9px]">two short</Badge>
                <Badge variant="outline" className="text-[9px]">front edge</Badge>
                <Badge variant="outline" className="text-[9px]">groove</Badge>
                <Badge variant="outline" className="text-[9px]">white/ply/mdf</Badge>
              </div>
            </div>
            
            <p className="text-[var(--muted-foreground)] mt-2">
              💡 Say <strong>"next"</strong> between parts, <strong>"done"</strong> when finished
            </p>
          </div>
        </div>

        {/* Transcripts queue */}
        {transcripts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Dictation Queue ({transcripts.length})
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {transcripts.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start justify-between gap-3 p-3 rounded-lg border",
                    t.parseResult
                      ? "border-green-200 bg-green-50/50"
                      : "border-red-200 bg-red-50/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.text}</p>
                      <Badge variant="outline" className="text-[9px] flex-shrink-0">
                        {t.source === "mic" ? "Mic" : "File"}
                      </Badge>
                    </div>
                    {t.parseResult ? (
                      <p className="text-xs text-green-600 mt-1">
                        → {t.parseResult.part.qty}x{" "}
                        {t.parseResult.part.size.L} × {t.parseResult.part.size.W}
                        {t.parseResult.part.label &&
                          ` "${t.parseResult.part.label}"`}
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 mt-1">
                        Could not parse dimensions
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {t.parseResult && (
                      <Badge variant="success" className="text-xs">
                        Parsed
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[var(--muted-foreground)] hover:text-red-600"
                      onClick={() => removeTranscript(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
