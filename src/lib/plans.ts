/**
 * CAI Intake - Plan & Subscription Management
 * 
 * Defines plan limits and provides enforcement utilities.
 */

import { db } from "./db";

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

export type PlanType = "free" | "starter" | "professional" | "enterprise";

export interface PlanLimits {
  /** Maximum cutlists (-1 for unlimited) */
  cutlists: number;
  /** Maximum parts per cutlist */
  partsPerCutlist: number;
  /** AI parsing requests per month */
  aiParsesPerMonth: number;
  /** File upload storage in MB */
  storageGB: number;
  /** Maximum team members */
  teamMembers: number;
  /** Optimization jobs per month */
  optimizeJobsPerMonth: number;
  /** Export operations per day */
  exportsPerDay: number;
  /** API requests per minute */
  apiRpm: number;
  /** Features enabled */
  features: {
    voiceDictation: boolean;
    ocrScanning: boolean;
    aiParsing: boolean;
    templateSystem: boolean;
    advancedCnc: boolean;
    bulkOperations: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    auditLogs: boolean;
    prioritySupport: boolean;
  };
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    cutlists: 5,
    partsPerCutlist: 100,
    aiParsesPerMonth: 10,
    storageGB: 1,
    teamMembers: 1,
    optimizeJobsPerMonth: 10,
    exportsPerDay: 5,
    apiRpm: 30,
    features: {
      voiceDictation: false,
      ocrScanning: false,
      aiParsing: true, // Limited
      templateSystem: false,
      advancedCnc: false,
      bulkOperations: false,
      apiAccess: false,
      webhooks: false,
      auditLogs: false,
      prioritySupport: false,
    },
  },
  starter: {
    cutlists: 50,
    partsPerCutlist: 500,
    aiParsesPerMonth: 100,
    storageGB: 10,
    teamMembers: 5,
    optimizeJobsPerMonth: 100,
    exportsPerDay: 50,
    apiRpm: 60,
    features: {
      voiceDictation: true,
      ocrScanning: true,
      aiParsing: true,
      templateSystem: true,
      advancedCnc: false,
      bulkOperations: true,
      apiAccess: false,
      webhooks: false,
      auditLogs: false,
      prioritySupport: false,
    },
  },
  professional: {
    cutlists: -1, // Unlimited
    partsPerCutlist: 5000,
    aiParsesPerMonth: 1000,
    storageGB: 100,
    teamMembers: 25,
    optimizeJobsPerMonth: -1,
    exportsPerDay: -1,
    apiRpm: 120,
    features: {
      voiceDictation: true,
      ocrScanning: true,
      aiParsing: true,
      templateSystem: true,
      advancedCnc: true,
      bulkOperations: true,
      apiAccess: true,
      webhooks: true,
      auditLogs: true,
      prioritySupport: false,
    },
  },
  enterprise: {
    cutlists: -1,
    partsPerCutlist: -1,
    aiParsesPerMonth: -1,
    storageGB: -1,
    teamMembers: -1,
    optimizeJobsPerMonth: -1,
    exportsPerDay: -1,
    apiRpm: 300,
    features: {
      voiceDictation: true,
      ocrScanning: true,
      aiParsing: true,
      templateSystem: true,
      advancedCnc: true,
      bulkOperations: true,
      apiAccess: true,
      webhooks: true,
      auditLogs: true,
      prioritySupport: true,
    },
  },
};

// =============================================================================
// PLAN ENFORCEMENT
// =============================================================================

export interface UsageStats {
  cutlistCount: number;
  aiParsesThisMonth: number;
  storageUsedGB: number;
  teamMemberCount: number;
  optimizeJobsThisMonth: number;
  exportsToday: number;
}

/**
 * Get current usage stats for an organization
 */
export async function getUsageStats(organizationId: string): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    cutlistCount,
    aiParsesThisMonth,
    teamMemberCount,
    optimizeJobsThisMonth,
    exportsToday,
  ] = await Promise.all([
    db.cutlist.count({ where: { organizationId } }),
    db.parseJob.count({
      where: {
        organizationId,
        createdAt: { gte: startOfMonth },
        sourceKind: { in: ["text", "file"] }, // AI-parsed sources
      },
    }),
    db.user.count({ where: { organizationId } }),
    db.optimizeJob.count({
      where: {
        cutlist: { organizationId },
        createdAt: { gte: startOfMonth },
      },
    }),
    db.export.count({
      where: {
        cutlist: { organizationId },
        createdAt: { gte: startOfDay },
      },
    }),
  ]);

  // TODO: Calculate actual storage from uploaded files
  const storageUsedGB = 0;

  return {
    cutlistCount,
    aiParsesThisMonth,
    storageUsedGB,
    teamMemberCount,
    optimizeJobsThisMonth,
    exportsToday,
  };
}

/**
 * Check if an organization has exceeded a specific limit
 */
export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

export async function checkLimit(
  organizationId: string,
  plan: PlanType,
  limitType: keyof Omit<PlanLimits, "features">
): Promise<LimitCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const limit = limits[limitType];

  // Unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, current: 0 };
  }

  const stats = await getUsageStats(organizationId);

  let current: number;
  switch (limitType) {
    case "cutlists":
      current = stats.cutlistCount;
      break;
    case "aiParsesPerMonth":
      current = stats.aiParsesThisMonth;
      break;
    case "storageGB":
      current = stats.storageUsedGB;
      break;
    case "teamMembers":
      current = stats.teamMemberCount;
      break;
    case "optimizeJobsPerMonth":
      current = stats.optimizeJobsThisMonth;
      break;
    case "exportsPerDay":
      current = stats.exportsToday;
      break;
    default:
      current = 0;
  }

  const allowed = current < limit;

  return {
    allowed,
    limit,
    current,
    message: allowed
      ? undefined
      : `You have reached your ${plan} plan limit for ${limitType}. Please upgrade to continue.`,
  };
}

/**
 * Check if a feature is enabled for a plan
 */
export function isFeatureEnabled(
  plan: PlanType,
  feature: keyof PlanLimits["features"]
): boolean {
  return PLAN_LIMITS[plan].features[feature];
}

/**
 * Get organization's plan from database
 */
export async function getOrganizationPlan(organizationId: string): Promise<PlanType> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, planExpiry: true },
  });

  if (!org) return "free";

  // Check if plan has expired
  if (org.planExpiry && new Date(org.planExpiry) < new Date()) {
    return "free";
  }

  return (org.plan as PlanType) || "free";
}

// =============================================================================
// MIDDLEWARE HELPER
// =============================================================================

export interface PlanCheckResult {
  plan: PlanType;
  limits: PlanLimits;
  canProceed: boolean;
  error?: string;
}

/**
 * Check plan limits for an API operation
 */
export async function checkPlanForOperation(
  organizationId: string,
  operation: "create_cutlist" | "ai_parse" | "optimize" | "export" | "add_team_member"
): Promise<PlanCheckResult> {
  const plan = await getOrganizationPlan(organizationId);
  const limits = PLAN_LIMITS[plan];

  let limitType: keyof Omit<PlanLimits, "features">;
  switch (operation) {
    case "create_cutlist":
      limitType = "cutlists";
      break;
    case "ai_parse":
      limitType = "aiParsesPerMonth";
      break;
    case "optimize":
      limitType = "optimizeJobsPerMonth";
      break;
    case "export":
      limitType = "exportsPerDay";
      break;
    case "add_team_member":
      limitType = "teamMembers";
      break;
  }

  const check = await checkLimit(organizationId, plan, limitType);

  return {
    plan,
    limits,
    canProceed: check.allowed,
    error: check.message,
  };
}

