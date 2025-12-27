/**
 * CAI Intake - Audio Transcription API
 * 
 * POST /api/v1/transcribe-audio
 * Transcribes audio files using OpenAI Whisper API.
 * Returns text that can be parsed for cutlist parts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { applyRateLimit } from "@/lib/api-middleware";
import OpenAI from "openai";

// Supported audio formats
const SUPPORTED_FORMATS = [
  "audio/mpeg",      // mp3
  "audio/mp3",       // mp3
  "audio/wav",       // wav
  "audio/wave",      // wav
  "audio/x-wav",     // wav
  "audio/mp4",       // m4a
  "audio/x-m4a",     // m4a
  "audio/ogg",       // ogg
  "audio/webm",      // webm
  "audio/flac",      // flac
];

// Max file size: 25MB (Whisper API limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, undefined, "parseJobs");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authenticate user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.error("OpenAI API key not configured for audio transcription");
      return NextResponse.json(
        { error: "Audio transcription is not available. Please contact your administrator." },
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = formData.get("language") as string || "en";

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(audioFile.type)) {
      return NextResponse.json(
        { 
          error: `Unsupported audio format: ${audioFile.type}. Supported formats: MP3, WAV, M4A, OGG, WebM, FLAC`,
          supportedFormats: ["mp3", "wav", "m4a", "ogg", "webm", "flac"],
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          maxSize: MAX_FILE_SIZE,
        },
        { status: 400 }
      );
    }

    logger.info("Starting audio transcription", {
      userId: user.id,
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      language,
    });

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Convert File to the format expected by OpenAI
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type });
    
    // Create a File object that OpenAI can process
    const file = new File([audioBlob], audioFile.name, { type: audioFile.type });

    // Transcribe using Whisper
    const startTime = Date.now();
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: language,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const duration = Date.now() - startTime;

    logger.info("Audio transcription complete", {
      userId: user.id,
      fileName: audioFile.name,
      transcriptLength: transcription.text.length,
      durationMs: duration,
      audioDuration: transcription.duration,
      segments: transcription.segments?.length || 0,
    });

    return NextResponse.json({
      success: true,
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      segments: transcription.segments?.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    });

  } catch (error) {
    logger.error("Audio transcription failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 400) {
        return NextResponse.json(
          { error: "Invalid audio file. Please ensure the file is a valid audio recording." },
          { status: 400 }
        );
      }
      if (error.status === 413) {
        return NextResponse.json(
          { error: "Audio file too large for processing." },
          { status: 413 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}

