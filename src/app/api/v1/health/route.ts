/**
 * CAI Intake - Health Check API
 * 
 * GET /api/v1/health - Health check endpoint for monitoring
 * 
 * Returns system health status including:
 * - API status
 * - Database connectivity
 * - External services status
 * - Version information
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceClient } from "@/lib/supabase/server";
import { API_VERSION, successResponse, serverError } from "@/lib/api/response";

interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latency_ms?: number;
  message?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  uptime_seconds: number;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
    storage: ServiceHealth;
    ai?: ServiceHealth;
  };
}

// Track server start time
const serverStartTime = Date.now();

/**
 * Check database health
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

/**
 * Check Supabase storage health
 */
async function checkStorage(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.storage.listBuckets();
    
    if (error) {
      return {
        status: "degraded",
        latency_ms: Date.now() - start,
        message: error.message,
      };
    }
    
    return {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : "Storage connection failed",
    };
  }
}

/**
 * Check AI provider availability
 */
async function checkAI(): Promise<ServiceHealth> {
  // Check if AI is configured
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasAnthropicKey && !hasOpenAIKey) {
    return {
      status: "unhealthy",
      message: "No AI provider configured",
    };
  }
  
  return {
    status: "healthy",
    message: hasAnthropicKey ? "Anthropic" : "OpenAI",
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(services: HealthResponse["services"]): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(services).map(s => s.status);
  
  if (statuses.some(s => s === "unhealthy")) {
    // If database is unhealthy, whole system is unhealthy
    if (services.database.status === "unhealthy") {
      return "unhealthy";
    }
    return "degraded";
  }
  
  if (statuses.some(s => s === "degraded")) {
    return "degraded";
  }
  
  return "healthy";
}

export async function GET(request: NextRequest) {
  try {
    // Check all services in parallel
    const [database, storage, ai] = await Promise.all([
      checkDatabase(),
      checkStorage(),
      checkAI(),
    ]);
    
    const services = {
      api: { status: "healthy" as const },
      database,
      storage,
      ai,
    };
    
    const status = determineOverallStatus(services);
    
    const response: HealthResponse = {
      status,
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
      services,
    };
    
    // Return appropriate HTTP status based on health
    const httpStatus = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;
    
    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-API-Version": API_VERSION,
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return serverError("Health check failed");
  }
}

/**
 * HEAD request for simple liveness check
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-API-Version": API_VERSION,
    },
  });
}

