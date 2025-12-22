"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  X,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Users,
  FileSpreadsheet,
  Cpu,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  getAllPlans,
  getPlanMonthlyPrice,
  getYearlySavingsPercent,
  type PlanId,
  type BillingInterval,
} from "@/lib/subscriptions/plans";

// =============================================================================
// PRICING PAGE
// =============================================================================

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("monthly");
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--cai-teal)] to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CAI</span>
            </div>
            <span className="font-semibold text-lg">Intake</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button variant="primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>
      
      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 text-center">
          <div className="container mx-auto px-4">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Simple, transparent pricing
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Choose the plan that fits your shop
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              From individual craftsmen to large manufacturers, we have a plan that scales with your business.
              All plans include a 14-day free trial.
            </p>
            
            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-slate-100 p-1.5 rounded-full">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all",
                  billingInterval === "monthly"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  billingInterval === "yearly"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Yearly
                <Badge variant="success" className="text-xs">Save 17%</Badge>
              </button>
            </div>
          </div>
        </section>
        
        {/* Pricing Cards */}
        <section className="pb-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {getAllPlans().map((plan) => (
                <PricingCard
                  key={plan.id}
                  planId={plan.id}
                  billingInterval={billingInterval}
                />
              ))}
            </div>
          </div>
        </section>
        
        {/* Feature Comparison */}
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Compare all features</h2>
            <FeatureComparison />
          </div>
        </section>
        
        {/* FAQ */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
            <FAQ />
          </div>
        </section>
        
        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-[var(--cai-teal)] to-teal-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to streamline your cutlist workflow?</h2>
            <p className="text-teal-100 mb-8 max-w-xl mx-auto">
              Start your 14-day free trial today. No credit card required.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-white text-[var(--cai-teal)] hover:bg-teal-50">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="py-8 border-t border-slate-200">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600">
          <p>© {new Date().getFullYear()} CAI Intake. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// PRICING CARD
// =============================================================================

function PricingCard({
  planId,
  billingInterval,
}: {
  planId: PlanId;
  billingInterval: BillingInterval;
}) {
  const plans = getAllPlans();
  const plan = plans.find((p) => p.id === planId)!;
  const monthlyPrice = getPlanMonthlyPrice(planId, billingInterval);
  const yearlySavings = getYearlySavingsPercent(planId);
  
  return (
    <Card
      className={cn(
        "relative flex flex-col transition-all hover:shadow-lg",
        plan.highlighted && "border-[var(--cai-teal)] shadow-lg ring-2 ring-[var(--cai-teal)]/20"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-[var(--cai-teal)] to-teal-600 text-white shadow-sm">
            <Star className="h-3 w-3 mr-1" />
            {plan.badge}
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <p className="text-sm text-slate-600">{plan.description}</p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">${monthlyPrice}</span>
            <span className="text-slate-600">/mo</span>
          </div>
          {billingInterval === "yearly" && yearlySavings > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Save {yearlySavings}% with yearly billing
            </p>
          )}
          {planId === "free" && (
            <p className="text-sm text-slate-600 mt-1">Forever free</p>
          )}
        </div>
        
        {/* Features */}
        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.slice(0, 8).map((feature) => (
            <li key={feature.id} className="flex items-start gap-2 text-sm">
              {feature.included ? (
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <X className="h-5 w-5 text-slate-300 flex-shrink-0" />
              )}
              <span className={cn(!feature.included && "text-slate-400")}>
                {feature.name}
              </span>
            </li>
          ))}
        </ul>
        
        {/* CTA */}
        <Link href="/login" className="w-full">
          <Button
            className="w-full"
            variant={plan.highlighted ? "primary" : "outline"}
          >
            {plan.cta}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// FEATURE COMPARISON
// =============================================================================

function FeatureComparison() {
  const plans = getAllPlans();
  
  const categories = [
    {
      name: "Core Features",
      features: [
        { key: "cutlists", name: "Cutlists per month" },
        { key: "parts", name: "Parts per cutlist" },
        { key: "team", name: "Team members" },
        { key: "storage", name: "Storage" },
      ],
    },
    {
      name: "Data Input",
      features: [
        { key: "manual", name: "Manual entry" },
        { key: "csv", name: "CSV import" },
        { key: "excel", name: "Excel import" },
        { key: "ai", name: "AI text parsing" },
        { key: "ocr", name: "PDF/Image OCR" },
        { key: "voice", name: "Voice input" },
      ],
    },
    {
      name: "Operations",
      features: [
        { key: "edgebanding", name: "Edgebanding" },
        { key: "grooves", name: "Grooves" },
        { key: "holes", name: "Hole patterns" },
        { key: "cnc", name: "CNC operations" },
      ],
    },
    {
      name: "Export & Integration",
      features: [
        { key: "pdf", name: "PDF export" },
        { key: "csvExport", name: "CSV export" },
        { key: "cutlistplus", name: "CutList Plus" },
        { key: "maxcut", name: "MaxCut" },
        { key: "api", name: "API access" },
      ],
    },
    {
      name: "Advanced",
      features: [
        { key: "branding", name: "Custom branding" },
        { key: "templates", name: "Custom templates" },
        { key: "sso", name: "SSO integration" },
        { key: "support", name: "Priority support" },
      ],
    },
  ];
  
  const getFeatureValue = (planId: PlanId, featureKey: string): string | boolean => {
    const plan = plans.find((p) => p.id === planId)!;
    
    // Handle limit-based features
    const limitMap: Record<string, number> = {
      cutlists: plan.limits.maxCutlistsPerMonth,
      parts: plan.limits.maxPartsPerCutlist,
      team: plan.limits.maxTeamMembers,
      storage: plan.limits.maxStorageMb,
    };
    
    if (featureKey in limitMap) {
      const value = limitMap[featureKey];
      if (value === -1) return "Unlimited";
      if (featureKey === "storage") return `${value >= 1024 ? `${value / 1024}GB` : `${value}MB`}`;
      return value.toString();
    }
    
    // Handle boolean features
    const featureMap: Record<string, keyof typeof plan.limits.features> = {
      manual: "manualEntry",
      csv: "csvImport",
      excel: "excelImport",
      ai: "aiParsing",
      ocr: "ocrParsing",
      voice: "voiceInput",
      edgebanding: "edgebanding",
      grooves: "grooves",
      holes: "holes",
      cnc: "cncOperations",
      pdf: "pdfExport",
      csvExport: "csvExport",
      cutlistplus: "cutlistPlusExport",
      maxcut: "maxcutExport",
      api: "apiAccess",
      branding: "customBranding",
      templates: "customTemplates",
      sso: "ssoIntegration",
      support: "prioritySupport",
    };
    
    if (featureKey in featureMap) {
      return plan.limits.features[featureMap[featureKey]];
    }
    
    return false;
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-4 px-4 font-medium text-slate-600 w-64">Feature</th>
            {plans.map((plan) => (
              <th key={plan.id} className="text-center py-4 px-4 font-semibold">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <React.Fragment key={category.name}>
              <tr className="bg-slate-50">
                <td colSpan={5} className="py-3 px-4 font-semibold text-slate-900">
                  {category.name}
                </td>
              </tr>
              {category.features.map((feature) => (
                <tr key={feature.key} className="border-b border-slate-100">
                  <td className="py-3 px-4 text-slate-700">{feature.name}</td>
                  {plans.map((plan) => {
                    const value = getFeatureValue(plan.id, feature.key);
                    return (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {typeof value === "boolean" ? (
                          value ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-slate-900 font-medium">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// FAQ
// =============================================================================

function FAQ() {
  const faqs = [
    {
      question: "Can I try before I buy?",
      answer: "Absolutely! All paid plans come with a 14-day free trial. No credit card required to start.",
    },
    {
      question: "Can I change plans later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the remaining time. When downgrading, the change takes effect at the end of your billing period.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.",
    },
    {
      question: "Is there a discount for yearly billing?",
      answer: "Yes! You save approximately 17% when you choose yearly billing instead of monthly.",
    },
    {
      question: "What happens if I exceed my limits?",
      answer: "We'll notify you when you're approaching your limits. You can upgrade your plan at any time to get higher limits, or wait until your usage resets at the start of your next billing period.",
    },
    {
      question: "Do you offer discounts for non-profits or education?",
      answer: "Yes! Contact us at support@caiintake.com for special pricing for educational institutions and non-profit organizations.",
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period.",
    },
    {
      question: "Do you offer custom Enterprise pricing?",
      answer: "Yes! For large organizations or special requirements, contact our sales team for custom pricing and features.",
    },
  ];
  
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-slate-600">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

