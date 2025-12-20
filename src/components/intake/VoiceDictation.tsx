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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { parseTextLine, type TextParseResult } from "@/lib/parsers/text-parser";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TranscriptItem {
  id: string;
  text: string;
  parseResult: TextParseResult | null;
  timestamp: Date;
}

export function VoiceDictation() {
  const addToInbox = useIntakeStore((state) => state.addToInbox);

  const [isListening, setIsListening] = React.useState(false);
  const [isSupported, setIsSupported] = React.useState(true);
  const [transcripts, setTranscripts] = React.useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

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

  const validCount = transcripts.filter((t) => t.parseResult).length;

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <MicOff className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-1">Voice Not Supported</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Your browser doesn't support the Web Speech API. Try using Chrome
              or Edge for voice dictation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[var(--cai-teal)]" />
            <CardTitle className="text-lg">Voice Dictation</CardTitle>
            {isListening && (
              <Badge variant="success" className="animate-pulse">
                Listening...
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
        {/* Microphone control */}
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

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Dictation format help */}
        <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3">
          <p className="font-medium mb-1">Say parts like:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>"Side panel seven twenty by five sixty quantity two"</li>
            <li>"Shelf five sixty by five hundred times four"</li>
            <li>"Top panel eight hundred by six hundred grain length"</li>
          </ul>
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
                    <p className="text-sm font-medium truncate">{t.text}</p>
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


