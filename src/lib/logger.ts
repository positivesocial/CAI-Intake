/**
 * CAI Intake - Structured Logger
 * 
 * Provides structured logging with log levels, context, and redaction.
 * Replaces console.log/error/warn throughout the application.
 */

// =============================================================================
// TYPES
// =============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  organizationId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL = LOG_LEVELS[
  (process.env.LOG_LEVEL as LogLevel) || "info"
];

// Fields to redact from logs
const REDACT_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "sessionToken",
  "accessToken",
  "refreshToken",
  "credit_card",
  "ssn",
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Redact sensitive fields from an object
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 10) return "[MAX_DEPTH]";
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    // Redact JWT tokens
    if (obj.startsWith("eyJ")) return "[REDACTED_JWT]";
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, depth + 1));
  }
  
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (REDACT_FIELDS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitive(value, depth + 1);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Format error for logging
 */
function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) return undefined;
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  
  // Handle Supabase/PostgrestError objects
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    // Check for Supabase/Postgrest error structure
    if ("message" in errObj || "code" in errObj || "details" in errObj) {
      return {
        name: (errObj.name as string) || (errObj.code as string) || "DatabaseError",
        message: (errObj.message as string) || (errObj.details as string) || JSON.stringify(errObj),
        stack: errObj.hint as string,
      };
    }
    // Generic object - try to stringify it
    try {
      return {
        name: "ObjectError",
        message: JSON.stringify(error),
      };
    } catch {
      return {
        name: "UnknownError",
        message: "[Object could not be stringified]",
      };
    }
  }
  
  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Format log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
  const redacted = redactSensitive(entry) as LogEntry;
  return JSON.stringify(redacted);
}

// =============================================================================
// LOGGER CLASS
// =============================================================================

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  /**
   * Log at specified level
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error: formatError(error),
    };

    const formatted = formatLogEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }

    // Send to external logging service in production
    if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
      // TODO: Integrate with Sentry or other logging service
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.log("error", message, context, error);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/** Global logger instance */
export const logger = new Logger();

/** Create a logger with context for a specific module */
export function createLogger(module: string): Logger {
  return logger.child({ module });
}

/** Create a logger for an API request */
export function createRequestLogger(
  requestId: string,
  userId?: string,
  organizationId?: string
): Logger {
  return logger.child({ requestId, userId, organizationId });
}

export type { LogContext, LogLevel, Logger };




