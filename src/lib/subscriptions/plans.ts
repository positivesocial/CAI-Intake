/**
 * CAI Intake - Subscription Plans Configuration
 * 
 * This file defines all subscription plans, their features, and limits.
 * Industry best practice: Centralized configuration for easy updates.
 */

// =============================================================================
// PLAN TYPES
// =============================================================================

export type PlanId = "free" | "starter" | "professional" | "enterprise";
export type BillingInterval = "monthly" | "yearly";

export interface PlanLimit {
  value: number;
  unit: string;
  description: string;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: PlanLimit;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  badge?: string;
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: PlanFeature[];
  limits: PlanLimits;
  highlighted?: boolean;
  cta: string;
  stripeProductId?: string;
  stripePriceIds?: {
    monthly: string;
    yearly: string;
  };
}

export interface PlanLimits {
  // Team & Organization
  maxTeamMembers: number;
  maxOrganizations: number;
  
  // Cutlists & Parts
  maxCutlistsPerMonth: number;
  maxPartsPerCutlist: number;
  maxStorageMb: number;
  
  // AI & Processing
  maxAiParsesPerMonth: number;
  maxOcrPagesPerMonth: number;
  maxOptimizationsPerMonth: number;
  
  // Features (boolean gates)
  features: {
    // Core
    manualEntry: boolean;
    csvImport: boolean;
    excelImport: boolean;
    
    // AI Features
    aiParsing: boolean;
    ocrParsing: boolean;
    voiceInput: boolean;
    
    // Export
    pdfExport: boolean;
    csvExport: boolean;
    cutlistPlusExport: boolean;
    maxcutExport: boolean;
    cai2dExport: boolean;
    
    // Operations
    edgebanding: boolean;
    grooves: boolean;
    holes: boolean;
    cncOperations: boolean;
    
    // Optimization
    basicOptimization: boolean;
    advancedOptimization: boolean;
    multiMaterialOptimization: boolean;
    
    // Organization
    customBranding: boolean;
    customTemplates: boolean;
    templateQrCodes: boolean;
    
    // Advanced
    apiAccess: boolean;
    webhooks: boolean;
    auditLogs: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
    ssoIntegration: boolean;
    customIntegrations: boolean;
  };
}

// =============================================================================
// FEATURE CATALOG
// =============================================================================

export const FEATURE_CATALOG = {
  // Core Features
  manualEntry: {
    id: "manual_entry",
    name: "Manual Entry",
    description: "Enter parts manually with spreadsheet-like interface",
    category: "core",
  },
  csvImport: {
    id: "csv_import",
    name: "CSV Import",
    description: "Import cutlists from CSV files",
    category: "core",
  },
  excelImport: {
    id: "excel_import",
    name: "Excel Import",
    description: "Import cutlists from Excel files with column mapping",
    category: "core",
  },
  
  // AI Features
  aiParsing: {
    id: "ai_parsing",
    name: "AI Text Parsing",
    description: "Parse unstructured text into parts using AI",
    category: "ai",
  },
  ocrParsing: {
    id: "ocr_parsing",
    name: "PDF/Image OCR",
    description: "Extract parts from scanned PDFs and images",
    category: "ai",
  },
  voiceInput: {
    id: "voice_input",
    name: "Voice Input",
    description: "Dictate parts using voice recognition",
    category: "ai",
  },
  
  // Export Features
  pdfExport: {
    id: "pdf_export",
    name: "PDF Export",
    description: "Export cutlists as branded PDF documents",
    category: "export",
  },
  csvExport: {
    id: "csv_export",
    name: "CSV Export",
    description: "Export cutlists as CSV files",
    category: "export",
  },
  cutlistPlusExport: {
    id: "cutlistplus_export",
    name: "CutList Plus Export",
    description: "Export to CutList Plus format",
    category: "export",
  },
  maxcutExport: {
    id: "maxcut_export",
    name: "MaxCut Export",
    description: "Export to MaxCut optimizer format",
    category: "export",
  },
  cai2dExport: {
    id: "cai2d_export",
    name: "CAI 2D Export",
    description: "Export to CAI 2D optimizer",
    category: "export",
  },
  
  // Operations
  edgebanding: {
    id: "edgebanding",
    name: "Edgebanding",
    description: "Configure edgeband materials and sides",
    category: "operations",
  },
  grooves: {
    id: "grooves",
    name: "Grooves",
    description: "Define groove operations and profiles",
    category: "operations",
  },
  holes: {
    id: "holes",
    name: "Hole Patterns",
    description: "Configure drilling patterns",
    category: "operations",
  },
  cncOperations: {
    id: "cnc_operations",
    name: "CNC Operations",
    description: "Advanced CNC machining operations",
    category: "operations",
  },
  
  // Optimization
  basicOptimization: {
    id: "basic_optimization",
    name: "Basic Optimization",
    description: "Simple sheet nesting optimization",
    category: "optimization",
  },
  advancedOptimization: {
    id: "advanced_optimization",
    name: "Advanced Optimization",
    description: "Multi-pass optimization with grain matching",
    category: "optimization",
  },
  multiMaterialOptimization: {
    id: "multi_material_optimization",
    name: "Multi-Material Optimization",
    description: "Optimize across multiple materials simultaneously",
    category: "optimization",
  },
  
  // Organization
  customBranding: {
    id: "custom_branding",
    name: "Custom Branding",
    description: "Add your logo and colors to exports",
    category: "organization",
  },
  customTemplates: {
    id: "custom_templates",
    name: "Custom Templates",
    description: "Create and use custom intake templates",
    category: "organization",
  },
  templateQrCodes: {
    id: "template_qr_codes",
    name: "Template QR Codes",
    description: "QR codes for instant template recognition",
    category: "organization",
  },
  
  // Advanced
  apiAccess: {
    id: "api_access",
    name: "API Access",
    description: "REST API for custom integrations",
    category: "advanced",
  },
  webhooks: {
    id: "webhooks",
    name: "Webhooks",
    description: "Real-time event notifications",
    category: "advanced",
  },
  auditLogs: {
    id: "audit_logs",
    name: "Audit Logs",
    description: "Complete activity audit trail",
    category: "advanced",
  },
  prioritySupport: {
    id: "priority_support",
    name: "Priority Support",
    description: "Faster response times for support requests",
    category: "support",
  },
  dedicatedSupport: {
    id: "dedicated_support",
    name: "Dedicated Support",
    description: "Dedicated account manager",
    category: "support",
  },
  ssoIntegration: {
    id: "sso_integration",
    name: "SSO Integration",
    description: "SAML/OIDC single sign-on",
    category: "advanced",
  },
  customIntegrations: {
    id: "custom_integrations",
    name: "Custom Integrations",
    description: "Custom ERP/CAD integrations",
    category: "advanced",
  },
} as const;

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with basic cutlist management",
    pricing: {
      monthly: 0,
      yearly: 0,
      currency: "USD",
    },
    limits: {
      maxTeamMembers: 1,
      maxOrganizations: 1,
      maxCutlistsPerMonth: 5,
      maxPartsPerCutlist: 50,
      maxStorageMb: 100,
      maxAiParsesPerMonth: 10,
      maxOcrPagesPerMonth: 5,
      maxOptimizationsPerMonth: 3,
      features: {
        manualEntry: true,
        csvImport: true,
        excelImport: false,
        aiParsing: true, // Limited
        ocrParsing: true, // Limited
        voiceInput: false,
        pdfExport: true,
        csvExport: true,
        cutlistPlusExport: false,
        maxcutExport: false,
        cai2dExport: false,
        edgebanding: true,
        grooves: false,
        holes: false,
        cncOperations: false,
        basicOptimization: true,
        advancedOptimization: false,
        multiMaterialOptimization: false,
        customBranding: false,
        customTemplates: false,
        templateQrCodes: false,
        apiAccess: false,
        webhooks: false,
        auditLogs: false,
        prioritySupport: false,
        dedicatedSupport: false,
        ssoIntegration: false,
        customIntegrations: false,
      },
    },
    features: [
      { id: "cutlists", name: "5 cutlists/month", description: "", included: true },
      { id: "parts", name: "50 parts per cutlist", description: "", included: true },
      { id: "manual", name: "Manual entry", description: "", included: true },
      { id: "csv", name: "CSV import", description: "", included: true },
      { id: "ai", name: "10 AI parses/month", description: "", included: true },
      { id: "pdf", name: "PDF export", description: "", included: true },
      { id: "edge", name: "Basic edgebanding", description: "", included: true },
    ],
    cta: "Get Started Free",
  },
  
  starter: {
    id: "starter",
    name: "Starter",
    description: "Perfect for small workshops and freelancers",
    pricing: {
      monthly: 29,
      yearly: 290, // ~17% discount
      currency: "USD",
    },
    limits: {
      maxTeamMembers: 3,
      maxOrganizations: 1,
      maxCutlistsPerMonth: 50,
      maxPartsPerCutlist: 200,
      maxStorageMb: 1024, // 1GB
      maxAiParsesPerMonth: 100,
      maxOcrPagesPerMonth: 50,
      maxOptimizationsPerMonth: 25,
      features: {
        manualEntry: true,
        csvImport: true,
        excelImport: true,
        aiParsing: true,
        ocrParsing: true,
        voiceInput: true,
        pdfExport: true,
        csvExport: true,
        cutlistPlusExport: true,
        maxcutExport: true,
        cai2dExport: false,
        edgebanding: true,
        grooves: true,
        holes: true,
        cncOperations: false,
        basicOptimization: true,
        advancedOptimization: true,
        multiMaterialOptimization: false,
        customBranding: true,
        customTemplates: false,
        templateQrCodes: false,
        apiAccess: false,
        webhooks: false,
        auditLogs: false,
        prioritySupport: false,
        dedicatedSupport: false,
        ssoIntegration: false,
        customIntegrations: false,
      },
    },
    features: [
      { id: "cutlists", name: "50 cutlists/month", description: "", included: true },
      { id: "parts", name: "200 parts per cutlist", description: "", included: true },
      { id: "team", name: "Up to 3 team members", description: "", included: true },
      { id: "excel", name: "Excel import", description: "", included: true },
      { id: "ai", name: "100 AI parses/month", description: "", included: true },
      { id: "ocr", name: "50 OCR pages/month", description: "", included: true },
      { id: "voice", name: "Voice input", description: "", included: true },
      { id: "exports", name: "All basic exports", description: "", included: true },
      { id: "ops", name: "Edgebanding, grooves, holes", description: "", included: true },
      { id: "branding", name: "Custom branding", description: "", included: true },
    ],
    cta: "Start Free Trial",
  },
  
  professional: {
    id: "professional",
    name: "Professional",
    description: "For growing cabinet shops and manufacturers",
    badge: "Most Popular",
    highlighted: true,
    pricing: {
      monthly: 79,
      yearly: 790, // ~17% discount
      currency: "USD",
    },
    limits: {
      maxTeamMembers: 10,
      maxOrganizations: 1,
      maxCutlistsPerMonth: 500,
      maxPartsPerCutlist: 1000,
      maxStorageMb: 10240, // 10GB
      maxAiParsesPerMonth: 1000,
      maxOcrPagesPerMonth: 500,
      maxOptimizationsPerMonth: 250,
      features: {
        manualEntry: true,
        csvImport: true,
        excelImport: true,
        aiParsing: true,
        ocrParsing: true,
        voiceInput: true,
        pdfExport: true,
        csvExport: true,
        cutlistPlusExport: true,
        maxcutExport: true,
        cai2dExport: true,
        edgebanding: true,
        grooves: true,
        holes: true,
        cncOperations: true,
        basicOptimization: true,
        advancedOptimization: true,
        multiMaterialOptimization: true,
        customBranding: true,
        customTemplates: true,
        templateQrCodes: true,
        apiAccess: true,
        webhooks: true,
        auditLogs: true,
        prioritySupport: true,
        dedicatedSupport: false,
        ssoIntegration: false,
        customIntegrations: false,
      },
    },
    features: [
      { id: "cutlists", name: "500 cutlists/month", description: "", included: true },
      { id: "parts", name: "1,000 parts per cutlist", description: "", included: true },
      { id: "team", name: "Up to 10 team members", description: "", included: true },
      { id: "ai", name: "1,000 AI parses/month", description: "", included: true },
      { id: "ocr", name: "500 OCR pages/month", description: "", included: true },
      { id: "cnc", name: "Full CNC operations", description: "", included: true },
      { id: "templates", name: "Custom templates with QR", description: "", included: true },
      { id: "api", name: "API & webhooks", description: "", included: true },
      { id: "audit", name: "Audit logs", description: "", included: true },
      { id: "support", name: "Priority support", description: "", included: true },
    ],
    cta: "Start Free Trial",
  },
  
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For large manufacturers and multi-location operations",
    pricing: {
      monthly: 249,
      yearly: 2490, // ~17% discount
      currency: "USD",
    },
    limits: {
      maxTeamMembers: -1, // Unlimited
      maxOrganizations: -1, // Unlimited
      maxCutlistsPerMonth: -1, // Unlimited
      maxPartsPerCutlist: -1, // Unlimited
      maxStorageMb: -1, // Unlimited
      maxAiParsesPerMonth: -1, // Unlimited
      maxOcrPagesPerMonth: -1, // Unlimited
      maxOptimizationsPerMonth: -1, // Unlimited
      features: {
        manualEntry: true,
        csvImport: true,
        excelImport: true,
        aiParsing: true,
        ocrParsing: true,
        voiceInput: true,
        pdfExport: true,
        csvExport: true,
        cutlistPlusExport: true,
        maxcutExport: true,
        cai2dExport: true,
        edgebanding: true,
        grooves: true,
        holes: true,
        cncOperations: true,
        basicOptimization: true,
        advancedOptimization: true,
        multiMaterialOptimization: true,
        customBranding: true,
        customTemplates: true,
        templateQrCodes: true,
        apiAccess: true,
        webhooks: true,
        auditLogs: true,
        prioritySupport: true,
        dedicatedSupport: true,
        ssoIntegration: true,
        customIntegrations: true,
      },
    },
    features: [
      { id: "unlimited", name: "Unlimited everything", description: "", included: true },
      { id: "team", name: "Unlimited team members", description: "", included: true },
      { id: "orgs", name: "Multiple organizations", description: "", included: true },
      { id: "sso", name: "SSO integration", description: "", included: true },
      { id: "integrations", name: "Custom integrations", description: "", included: true },
      { id: "support", name: "Dedicated account manager", description: "", included: true },
      { id: "sla", name: "99.9% SLA", description: "", included: true },
      { id: "training", name: "Custom training", description: "", included: true },
    ],
    cta: "Contact Sales",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

export function getPlanPrice(planId: PlanId, interval: BillingInterval): number {
  const plan = PLANS[planId];
  return interval === "yearly" ? plan.pricing.yearly : plan.pricing.monthly;
}

export function getPlanMonthlyPrice(planId: PlanId, interval: BillingInterval): number {
  const plan = PLANS[planId];
  if (interval === "yearly") {
    return Math.round(plan.pricing.yearly / 12);
  }
  return plan.pricing.monthly;
}

export function getYearlySavings(planId: PlanId): number {
  const plan = PLANS[planId];
  const monthlyTotal = plan.pricing.monthly * 12;
  return monthlyTotal - plan.pricing.yearly;
}

export function getYearlySavingsPercent(planId: PlanId): number {
  const plan = PLANS[planId];
  const monthlyTotal = plan.pricing.monthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - plan.pricing.yearly) / monthlyTotal) * 100);
}

export function isFeatureAvailable(planId: PlanId, featureKey: keyof PlanLimits["features"]): boolean {
  const plan = PLANS[planId];
  return plan.limits.features[featureKey];
}

export function getLimit(planId: PlanId, limitKey: keyof Omit<PlanLimits, "features">): number {
  const plan = PLANS[planId];
  return plan.limits[limitKey] as number;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function formatLimit(value: number): string {
  if (isUnlimited(value)) return "Unlimited";
  return value.toLocaleString();
}

export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

export function getUpgradePlan(currentPlanId: PlanId): PlanId | null {
  const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
  const currentIndex = planOrder.indexOf(currentPlanId);
  if (currentIndex < planOrder.length - 1) {
    return planOrder[currentIndex + 1];
  }
  return null;
}

export function canUpgrade(currentPlanId: PlanId, targetPlanId: PlanId): boolean {
  const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
  return planOrder.indexOf(targetPlanId) > planOrder.indexOf(currentPlanId);
}

export function canDowngrade(currentPlanId: PlanId, targetPlanId: PlanId): boolean {
  const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
  return planOrder.indexOf(targetPlanId) < planOrder.indexOf(currentPlanId);
}

