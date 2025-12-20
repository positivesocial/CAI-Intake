/**
 * CAI Intake - Background Job Queue System
 * 
 * A simple job queue for processing async tasks like:
 * - Parse jobs (text, file, voice)
 * - Optimization jobs
 * - Email notifications
 * - File processing
 * 
 * In production, this should be replaced with a proper queue like:
 * - BullMQ + Redis
 * - AWS SQS
 * - Vercel Edge Functions with queues
 */

import { logger } from "../logger";
import { db } from "../db";

// =============================================================================
// TYPES
// =============================================================================

export type JobType = 
  | "parse_text"
  | "parse_file"
  | "parse_voice"
  | "optimize"
  | "send_email"
  | "process_file"
  | "generate_export";

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface Job<T = unknown> {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: T;
  result?: unknown;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  organizationId?: string;
  userId?: string;
}

export interface JobHandler<T = unknown, R = unknown> {
  (payload: T, job: Job<T>): Promise<R>;
}

// =============================================================================
// JOB HANDLERS REGISTRY
// =============================================================================

const handlers = new Map<JobType, JobHandler>();

/**
 * Register a job handler
 */
export function registerJobHandler<T = unknown, R = unknown>(
  type: JobType,
  handler: JobHandler<T, R>
): void {
  handlers.set(type, handler as JobHandler);
  logger.info(`Registered job handler for type: ${type}`);
}

// =============================================================================
// JOB QUEUE OPERATIONS
// =============================================================================

/**
 * Create a new job and queue it for processing
 */
export async function createJob<T = unknown>(params: {
  type: JobType;
  payload: T;
  organizationId?: string;
  userId?: string;
  maxAttempts?: number;
}): Promise<Job<T>> {
  const { type, payload, organizationId, userId, maxAttempts = 3 } = params;
  
  const job: Job<T> = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    status: "pending",
    payload,
    attempts: 0,
    maxAttempts,
    createdAt: new Date(),
    organizationId,
    userId,
  };

  // Store job in database (using a generic jobs table or specific tables)
  logger.info(`Created job: ${job.id}`, { type, organizationId, userId });

  // In a proper implementation, this would add to Redis/SQS queue
  // For now, process immediately in development
  if (process.env.NODE_ENV === "development" || process.env.PROCESS_JOBS_INLINE === "true") {
    processJobInline(job);
  }

  return job;
}

/**
 * Process a job inline (for development/serverless)
 */
async function processJobInline<T>(job: Job<T>): Promise<void> {
  const handler = handlers.get(job.type);
  
  if (!handler) {
    logger.error(`No handler registered for job type: ${job.type}`);
    return;
  }

  job.status = "processing";
  job.startedAt = new Date();
  job.attempts++;

  try {
    job.result = await handler(job.payload, job);
    job.status = "completed";
    job.completedAt = new Date();
    
    logger.info(`Job completed: ${job.id}`, {
      type: job.type,
      duration: job.completedAt.getTime() - job.startedAt.getTime(),
    });
  } catch (error) {
    job.error = error instanceof Error ? error.message : "Unknown error";
    
    if (job.attempts < job.maxAttempts) {
      job.status = "pending"; // Retry
      logger.warn(`Job failed, will retry: ${job.id}`, { 
        error: job.error, 
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
      });
      
      // Exponential backoff retry
      const delay = Math.pow(2, job.attempts) * 1000;
      setTimeout(() => processJobInline(job), delay);
    } else {
      job.status = "failed";
      job.completedAt = new Date();
      logger.error(`Job failed permanently: ${job.id}`, error, {
        type: job.type,
        attempts: job.attempts,
      });
    }
  }
}

// =============================================================================
// JOB QUERY OPERATIONS
// =============================================================================

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  // In a real implementation, this would fetch from database
  logger.debug(`Getting job: ${jobId}`);
  return null;
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  logger.info(`Cancelling job: ${jobId}`);
  // In a real implementation, this would update the job status
  return true;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<Job | null> {
  logger.info(`Retrying job: ${jobId}`);
  // In a real implementation, this would reset the job and requeue
  return null;
}

// =============================================================================
// BUILT-IN JOB HANDLERS
// =============================================================================

// These are registered when the module loads

// Parse text job handler
registerJobHandler("parse_text", async (payload: { content: string; cutlistId?: string }) => {
  const { parseText } = await import("../parser/text-parser");
  const result = parseText(payload.content);
  
  // Calculate confidence from success rate
  const confidence = result.stats.totalLines > 0 
    ? result.stats.parsedLines / result.stats.totalLines 
    : 0;
  
  if (payload.cutlistId) {
    await db.parseJob.updateMany({
      where: { cutlistId: payload.cutlistId, status: "processing" },
      data: {
        status: "completed",
        partsPreview: JSON.parse(JSON.stringify(result.parts)),
        summary: {
          partsCount: result.parts.length,
          parseMethod: "text",
          confidence,
        },
        completedAt: new Date(),
      },
    });
  }
  
  return result;
});

// Parse file job handler
registerJobHandler("parse_file", async (payload: { 
  fileId: string; 
  fileUrl: string; 
  mimeType: string;
  cutlistId?: string;
}) => {
  const { mimeType, fileUrl } = payload;
  
  if (mimeType.includes("csv") || mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
    const { parseExcel } = await import("../parser/excel-parser");
    
    // Fetch the file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    
    return parseExcel(buffer);
  }
  
  if (mimeType.includes("image") || mimeType === "application/pdf") {
    const { parseFile } = await import("../parser/ocr-parser");
    // Fetch the file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    return parseFile(buffer, mimeType);
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
});

// Optimization job handler
registerJobHandler("optimize", async (payload: { 
  cutlistId: string;
  options?: Record<string, unknown>;
}) => {
  const { submitOptimization } = await import("../optimizer/cai2d-client");
  
  // Fetch the cutlist
  const cutlist = await db.cutlist.findUnique({
    where: { id: payload.cutlistId },
    include: { parts: true },
  });
  
  if (!cutlist) {
    throw new Error("Cutlist not found");
  }
  
  // Submit to optimizer
  return submitOptimization({
    parts: cutlist.parts,
    options: payload.options,
  });
});

// Email job handler
registerJobHandler("send_email", async (payload: {
  template: string;
  to: string;
  data: Record<string, unknown>;
}) => {
  const { sendEmail } = await import("../email");
  
  // Build email from template
  const html = `<p>Email template: ${payload.template}</p><pre>${JSON.stringify(payload.data, null, 2)}</pre>`;
  
  return sendEmail({
    to: payload.to,
    subject: `CAI Intake - ${payload.template}`,
    html,
  });
});

// Export generation job handler
registerJobHandler("generate_export", async (payload: {
  cutlistId: string;
  format: string;
  options?: Record<string, unknown>;
}) => {
  // Fetch the cutlist
  const cutlist = await db.cutlist.findUnique({
    where: { id: payload.cutlistId },
    include: { parts: true },
  });
  
  if (!cutlist) {
    throw new Error("Cutlist not found");
  }
  
  // Generate export - the actual format-specific export is done elsewhere
  // This job just validates and prepares the data
  return {
    format: payload.format,
    generated: true,
    cutlistId: payload.cutlistId,
    partsCount: cutlist.parts.length,
  };
});

// Functions are exported inline with their definitions

