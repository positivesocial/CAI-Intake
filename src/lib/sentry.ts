/**
 * CAI Intake - Sentry Error Monitoring Setup
 * 
 * Provides error tracking, performance monitoring, and session replay.
 * Initialize in the root layout for automatic error capture.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

interface ErrorContext {
  user?: {
    id: string;
    email?: string;
    organizationId?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: Partial<SentryConfig> = {
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
};

// =============================================================================
// INITIALIZATION
// =============================================================================

let isInitialized = false;

/**
 * Initialize Sentry error monitoring
 * Call this in your root layout or _app file
 */
export async function initSentry(): Promise<void> {
  if (isInitialized) return;
  
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  try {
    // Dynamic import to avoid SSR issues and reduce bundle size
    // Note: @sentry/nextjs must be installed: npm install @sentry/nextjs
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      
      // Performance monitoring
      tracesSampleRate: DEFAULT_CONFIG.tracesSampleRate,
      
      // Session replay (optional)
      replaysSessionSampleRate: DEFAULT_CONFIG.replaysSessionSampleRate,
      replaysOnErrorSampleRate: DEFAULT_CONFIG.replaysOnErrorSampleRate,
      
      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Filter out noisy errors
      ignoreErrors: [
        // Browser extensions
        /chrome-extension/,
        /moz-extension/,
        // Network errors
        /Network request failed/,
        /Failed to fetch/,
        /Load failed/,
        // User-cancelled requests
        /AbortError/,
        // ResizeObserver errors
        /ResizeObserver loop/,
      ],
      
      // Before sending error, allow modification
      beforeSend(event: { request?: { cookies?: string } } | null) {
        // Don't send errors in development
        if (process.env.NODE_ENV === "development") {
          console.error("[Sentry] Would send error:", event);
          return null;
        }
        
        // Redact sensitive data
        if (event?.request?.cookies) {
          event.request.cookies = "[Redacted]";
        }
        
        return event;
      },
    });
    
    isInitialized = true;
    console.log("Sentry initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Sentry:", error);
  }
}

// =============================================================================
// ERROR CAPTURING
// =============================================================================

/**
 * Capture an exception with optional context
 */
export async function captureException(
  error: Error | unknown,
  context?: ErrorContext
): Promise<string | undefined> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    // Set user context if provided
    if (context?.user) {
      Sentry.setUser({
        id: context.user.id,
        email: context.user.email,
      });
    }
    
    // Set tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }
    
    // Capture the error
    const eventId = Sentry.captureException(error, {
      extra: context?.extra,
    });
    
    return eventId;
  } catch {
    // Fallback to console if Sentry fails
    console.error("Error:", error, context);
    return undefined;
  }
}

/**
 * Capture a message with severity level
 */
export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: ErrorContext
): Promise<string | undefined> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    const eventId = Sentry.captureMessage(message, {
      level: level as string,
      extra: context?.extra,
      tags: context?.tags,
    });
    
    return eventId;
  } catch {
    console.log(`[${level.toUpperCase()}] ${message}`);
    return undefined;
  }
}

// =============================================================================
// USER IDENTIFICATION
// =============================================================================

/**
 * Set the current user for error tracking
 */
export async function setUser(user: {
  id: string;
  email?: string;
  name?: string;
  organizationId?: string;
}): Promise<void> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
    
    if (user.organizationId) {
      Sentry.setTag("organization_id", user.organizationId);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Clear user context (on logout)
 */
export async function clearUser(): Promise<void> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    Sentry.setUser(null);
  } catch {
    // Silently fail
  }
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * Start a performance transaction
 */
export async function startTransaction(
  name: string,
  operation: string
): Promise<{ finish: () => void } | null> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    const transaction = Sentry.startInactiveSpan({
      name,
      op: operation,
    });
    
    return {
      finish: () => transaction?.end(),
    };
  } catch {
    return null;
  }
}

/**
 * Add a breadcrumb for debugging
 */
export async function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    // @ts-expect-error - Sentry package may not be installed
    const Sentry = await import("@sentry/nextjs");
    
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: "info",
    });
  } catch {
    // Silently fail
  }
}

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN && isInitialized;
}

// Functions are exported inline with their definitions

