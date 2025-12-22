"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface StatItem {
  value: string;
  label: string;
  suffix?: string;
}

interface InputMethod {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ProcessStep {
  number: string;
  title: string;
  description: string;
  detail: string;
}

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  metric: string;
}

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

// =============================================================================
// DATA
// =============================================================================

const STATS: StatItem[] = [
  { value: "2.5M", suffix: "+", label: "Parts Processed" },
  { value: "99.2", suffix: "%", label: "Accuracy Rate" },
  { value: "75", suffix: "%", label: "Time Saved" },
];

const INPUT_METHODS: InputMethod[] = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: "Manual Entry",
    description: "Smart spreadsheet with instant parsing and validation",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Excel & CSV",
    description: "Intelligent column mapping with auto-detection",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: "Voice Dictation",
    description: "Speak your cutlist naturally, we transcribe it",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "OCR & Image",
    description: "AI-powered extraction from photos and PDFs",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: "QR Templates",
    description: "99%+ accuracy with scannable order forms",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
      </svg>
    ),
    title: "Copy & Paste",
    description: "From emails, docs, or any source—we parse it",
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  {
    number: "01",
    title: "Ingest",
    description: "Data arrives in any format",
    detail: "Voice, image, spreadsheet, PDF—doesn't matter",
  },
  {
    number: "02",
    title: "Parse",
    description: "AI extracts structured data",
    detail: "GPT-4 Vision + custom models trained on cutlists",
  },
  {
    number: "03",
    title: "Validate",
    description: "Schema verification & confidence scoring",
    detail: "Every part passes 47 validation checks",
  },
  {
    number: "04",
    title: "Match",
    description: "Smart material matching",
    detail: "Auto-maps to your material library with fallbacks",
  },
  {
    number: "05",
    title: "Export",
    description: "CNC-ready output",
    detail: "MaxCut, CutList Plus, CutRite, Optimik, and more",
  },
];

const EXPORT_FORMATS = [
  { name: "CAI 2D", ext: ".json" },
  { name: "MaxCut", ext: ".csv" },
  { name: "CutList Plus", ext: ".csv" },
  { name: "CutRite", ext: ".xml" },
  { name: "Optimik", ext: ".csv" },
  { name: "Excel", ext: ".xlsx" },
  { name: "JSON API", ext: ".json" },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "We went from 2 hours of data entry per job to 3 minutes. The AI parsing is scary accurate—even with handwritten notes from our guys on the floor.",
    name: "Michael Thompson",
    role: "Production Manager",
    company: "Premium Cabinets Co.",
    metric: "40x faster intake",
  },
  {
    quote: "Finally, software that speaks our language. Edge banding notation, groove specs, drilling patterns—it handles everything we throw at it.",
    name: "Sarah Chen",
    role: "Owner",
    company: "Chen Custom Millwork",
    metric: "99.4% accuracy",
  },
  {
    quote: "The QR template system is brilliant. Clients fill out forms, we scan, and parts appear in our queue. Changed our entire workflow.",
    name: "David Rodriguez",
    role: "Operations Director",
    company: "Precision Cabinet Works",
    metric: "Zero re-entry errors",
  },
];

const PRICING: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    features: [
      "5 cutlists per month",
      "50 parts per cutlist",
      "Basic exports (CSV, JSON)",
      "Email support",
    ],
    cta: "Start Free",
  },
  {
    name: "Professional",
    price: "$79",
    period: "/month",
    features: [
      "Unlimited cutlists",
      "Unlimited parts",
      "All export formats",
      "Voice & OCR input",
      "Material library sync",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Everything in Pro",
      "Custom integrations",
      "API access",
      "Dedicated account manager",
      "On-premise deployment",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#00a888" />
        </linearGradient>
      </defs>
      <path
        d="M8 8 L56 8 L56 16 L40 32 L40 56 L24 56 L24 32 L8 16 Z"
        fill="url(#logoGradient)"
        stroke="#00d4aa"
        strokeWidth="1"
      />
      <line x1="16" y1="12" x2="48" y2="12" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
      <line x1="20" y1="17" x2="44" y2="17" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
      <path d="M32 36 L28 44 L30 44 L30 52 L34 52 L34 44 L36 44 Z" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

function BlueprintGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main grid */}
      <div className="absolute inset-0 blueprint-grid-lg opacity-60" />
      
      {/* Crosshair at center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] opacity-20">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#00d4aa]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#00d4aa]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-[#00d4aa] rounded-full" />
      </div>
      
      {/* Edge measurement marks - left */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-20 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`h-px ${i % 5 === 0 ? 'w-6 bg-[#00d4aa]' : 'w-3 bg-white/30'}`} />
            {i % 5 === 0 && (
              <span className="text-[8px] text-[#8b9bb4] ml-1 font-mono">{i * 50}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Edge measurement marks - top */}
      <div className="absolute left-0 right-0 top-0 h-8 flex justify-between px-20 opacity-30">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className={`w-px ${i % 5 === 0 ? 'h-6 bg-[#00d4aa]' : 'h-3 bg-white/30'}`} />
          </div>
        ))}
      </div>

      {/* Scan line effect */}
      <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00d4aa]/30 to-transparent animate-scan-line" />
    </div>
  );
}

function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
            const duration = 2000;
            const steps = 60;
            const stepValue = numericValue / steps;
            let current = 0;
            
            const interval = setInterval(() => {
              current += stepValue;
              if (current >= numericValue) {
                setDisplayValue(value);
                clearInterval(interval);
              } else {
                setDisplayValue(current.toFixed(value.includes(".") ? 1 : 0));
              }
            }, duration / steps);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {displayValue}{suffix}
    </span>
  );
}

function ScrollReveal({ 
  children, 
  delay = 0,
  className = "" 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(30px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function InputMethodCard({ method, index }: { method: InputMethod; index: number }) {
  return (
    <ScrollReveal delay={index * 100}>
      <div className="group relative p-6 rounded-xl bg-[#111820] border border-white/5 hover:border-[#00d4aa]/30 transition-all duration-300 hover:bg-[#1a2332]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00d4aa]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative">
          <div className="text-[#00d4aa] mb-4 group-hover:scale-110 transition-transform duration-300">
            {method.icon}
          </div>
          <h3 className="text-lg font-semibold text-[#f0f4f8] mb-2 font-[family-name:var(--font-display)]">
            {method.title}
          </h3>
          <p className="text-sm text-[#8b9bb4] leading-relaxed font-[family-name:var(--font-body)]">
            {method.description}
          </p>
        </div>
      </div>
    </ScrollReveal>
  );
}

function ProcessStepCard({ step, index, total }: { step: ProcessStep; index: number; total: number }) {
  return (
    <ScrollReveal delay={index * 150} className="relative">
      <div className="flex flex-col items-center text-center">
        {/* Connector line */}
        {index < total - 1 && (
          <div className="hidden lg:block absolute top-8 left-[calc(50%+4rem)] w-[calc(100%-2rem)] h-px bg-gradient-to-r from-[#00d4aa]/50 to-[#00d4aa]/10" />
        )}
        
        {/* Step number */}
        <div className="relative w-16 h-16 rounded-full bg-[#111820] border border-[#00d4aa]/30 flex items-center justify-center mb-4">
          <span className="text-[#00d4aa] font-mono text-lg font-bold">{step.number}</span>
          <div className="absolute inset-0 rounded-full animate-pulse-glow opacity-20" />
        </div>
        
        {/* Content */}
        <h3 className="text-xl font-bold text-[#f0f4f8] mb-2 font-[family-name:var(--font-display)]">
          {step.title}
        </h3>
        <p className="text-[#8b9bb4] mb-2 font-[family-name:var(--font-body)]">
          {step.description}
        </p>
        <p className="text-xs text-[#5a6a7a] font-mono">
          {step.detail}
        </p>
      </div>
    </ScrollReveal>
  );
}

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  return (
    <ScrollReveal delay={index * 150}>
      <div className="relative p-8 rounded-xl bg-[#111820] border border-white/5 hover:border-[#00d4aa]/20 transition-all duration-300 group">
        {/* Metric badge */}
        <div className="absolute -top-3 right-6 px-4 py-1 bg-[#00d4aa] text-[#0a0f14] text-xs font-bold rounded-full font-mono">
          {testimonial.metric}
        </div>
        
        {/* Quote */}
        <blockquote className="text-[#f0f4f8] mb-6 leading-relaxed font-[family-name:var(--font-body)]">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>
        
        {/* Author */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1a2332] flex items-center justify-center text-[#00d4aa] font-bold text-lg">
            {testimonial.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-[#f0f4f8]">{testimonial.name}</div>
            <div className="text-sm text-[#8b9bb4]">
              {testimonial.role}, {testimonial.company}
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}

function PricingCard({ tier, index }: { tier: PricingTier; index: number }) {
  return (
    <ScrollReveal delay={index * 150}>
      <div 
        className={`relative p-8 rounded-xl transition-all duration-300 ${
          tier.highlighted 
            ? "bg-gradient-to-br from-[#00d4aa]/20 to-[#00d4aa]/5 border-2 border-[#00d4aa] scale-105" 
            : "bg-[#111820] border border-white/10 hover:border-[#00d4aa]/30"
        }`}
      >
        {tier.highlighted && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#00d4aa] text-[#0a0f14] text-xs font-bold rounded-full uppercase tracking-wider">
            Most Popular
          </div>
        )}
        
        <div className="mb-6">
          <h3 className="text-xl font-bold text-[#f0f4f8] mb-2 font-[family-name:var(--font-display)]">
            {tier.name}
          </h3>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[#f0f4f8]">{tier.price}</span>
            {tier.period && <span className="text-[#8b9bb4]">{tier.period}</span>}
          </div>
        </div>
        
        <ul className="space-y-3 mb-8">
          {tier.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3 text-[#8b9bb4]">
              <svg className="w-5 h-5 text-[#00d4aa] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-[family-name:var(--font-body)]">{feature}</span>
            </li>
          ))}
        </ul>
        
        <Link
          href={tier.name === "Enterprise" ? "/contact" : "/signup"}
          className={`block w-full py-3 px-6 rounded-lg text-center font-semibold transition-all duration-300 ${
            tier.highlighted
              ? "bg-[#00d4aa] text-[#0a0f14] hover:bg-[#33e0bb] hover:shadow-lg hover:shadow-[#00d4aa]/20"
              : "bg-white/5 text-[#f0f4f8] hover:bg-white/10 border border-white/10"
          }`}
        >
          {tier.cta}
        </Link>
      </div>
    </ScrollReveal>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div data-landing="true" className="min-h-screen text-[#f0f4f8] font-[family-name:var(--font-body)]" style={{ backgroundColor: '#0a0f14' }}>
      {/* Navigation */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#0a0f14]/90 backdrop-blur-lg border-b border-white/5" : ""
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <Logo className="w-10 h-10 group-hover:scale-105 transition-transform" />
              <div className="font-[family-name:var(--font-display)]">
                <span className="text-xl font-bold text-[#f0f4f8]">CAI</span>
                <span className="text-xl font-medium text-[#00d4aa] ml-1">Intake</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/pricing" className="text-[#8b9bb4] hover:text-[#f0f4f8] transition-colors text-sm font-medium">
                Pricing
              </Link>
              <Link href="/docs" className="text-[#8b9bb4] hover:text-[#f0f4f8] transition-colors text-sm font-medium">
                Docs
              </Link>
              <Link href="/about" className="text-[#8b9bb4] hover:text-[#f0f4f8] transition-colors text-sm font-medium">
                About
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-[#8b9bb4] hover:text-[#f0f4f8] transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-lg bg-[#00d4aa] text-[#0a0f14] font-semibold text-sm hover:bg-[#33e0bb] transition-all hover:shadow-lg hover:shadow-[#00d4aa]/20"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <BlueprintGrid />
        
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00d4aa]/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Precision badge */}
          <div className="animate-fade-in-up delay-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111820] border border-[#00d4aa]/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-sm text-[#8b9bb4] font-mono">PRECISION: ±0.1mm</span>
          </div>

          {/* Main headline */}
          <h1 className="animate-fade-in-up delay-100 text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-[1.1] font-[family-name:var(--font-display)]">
            Your Cutlists Are a{" "}
            <span className="text-[#00d4aa] text-glow-teal">Mess</span>.
            <br />
            <span className="text-[#8b9bb4]">We Fix That.</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-up delay-200 text-lg sm:text-xl text-[#8b9bb4] mb-10 max-w-2xl mx-auto leading-relaxed">
            AI-powered ingestion that transforms handwritten notes, chaotic spreadsheets, 
            and blurry photos into perfectly structured, CNC-ready parts lists.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="group px-8 py-4 rounded-xl bg-[#00d4aa] text-[#0a0f14] font-bold text-lg hover:bg-[#33e0bb] transition-all shadow-xl shadow-[#00d4aa]/20 hover:shadow-[#00d4aa]/40 hover:scale-[1.02]"
            >
              Start 14-Day Free Trial
              <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl border border-white/10 text-[#f0f4f8] font-semibold text-lg hover:bg-white/5 transition-all backdrop-blur"
            >
              Watch Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="animate-fade-in-up delay-400 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-[#f0f4f8] font-mono">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[#5a6a7a] text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
          <span className="text-xs text-[#5a6a7a] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-[#00d4aa] to-transparent animate-pulse" />
        </div>
      </section>

      {/* Problem Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">The Problem</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 mb-6 font-[family-name:var(--font-display)]">
                Every cabinet shop knows<br />
                <span className="text-[#8b9bb4]">this nightmare</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "📝", title: "Napkin Math", desc: "Handwritten notes with coffee stains and illegible dimensions" },
              { icon: "📊", title: "Excel Hell", desc: "47 merged cells, broken formulas, and references to deleted sheets" },
              { icon: "📄", title: "PDF Chaos", desc: "Scanned documents from clients with zero standardization" },
              { icon: "📞", title: "Last-Minute Calls", desc: '"Can you add 3 more shelves? I need it by tomorrow."' },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div className="p-6 rounded-xl bg-[#111820]/50 border border-white/5 hover:border-red-500/20 transition-colors">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="text-lg font-semibold text-[#f0f4f8] mb-2 font-[family-name:var(--font-display)]">{item.title}</h3>
                  <p className="text-sm text-[#8b9bb4]">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="mt-16 p-8 rounded-xl bg-gradient-to-r from-[#111820] to-[#1a2332] border border-[#00d4aa]/20 text-center">
              <p className="text-2xl text-[#f0f4f8] font-[family-name:var(--font-display)]">
                Hours wasted. Errors introduced. Money lost.
              </p>
              <p className="text-[#00d4aa] mt-4 text-lg">
                There&apos;s a better way.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Input Methods Section */}
      <section className="relative py-32 bg-[#0d1219]">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        
        <div className="relative max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">Input Methods</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 mb-6 font-[family-name:var(--font-display)]">
                Six ways in.<br />
                <span className="text-[#00d4aa]">One perfect output.</span>
              </h2>
              <p className="text-[#8b9bb4] max-w-2xl mx-auto text-lg">
                CAI Intake doesn&apos;t care how your data arrives. Voice memo? Scanned PDF? 
                Copy-paste from an email? We&apos;ve seen it all—and we parse it all.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INPUT_METHODS.map((method, i) => (
              <InputMethodCard key={i} method={method} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="relative py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-20">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">How It Works</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 font-[family-name:var(--font-display)]">
                From chaos to<br />
                <span className="text-[#00d4aa]">CNC-ready</span> in seconds
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
            {PROCESS_STEPS.map((step, i) => (
              <ProcessStepCard key={i} step={step} index={i} total={PROCESS_STEPS.length} />
            ))}
          </div>
        </div>
      </section>

      {/* Export Formats Section */}
      <section className="relative py-32 bg-[#0d1219]">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">Export Formats</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 mb-6 font-[family-name:var(--font-display)]">
                Export to <span className="text-[#00d4aa]">anything</span>.<br />
                Instantly.
              </h2>
            </div>
          </ScrollReveal>

          <div className="flex flex-wrap justify-center gap-4">
            {EXPORT_FORMATS.map((format, i) => (
              <ScrollReveal key={i} delay={i * 50}>
                <div className="group px-6 py-4 rounded-xl bg-[#111820] border border-white/5 hover:border-[#00d4aa]/30 transition-all hover:scale-105 cursor-default">
                  <span className="text-[#f0f4f8] font-semibold">{format.name}</span>
                  <span className="text-[#00d4aa] font-mono text-sm ml-2">{format.ext}</span>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="mt-16 text-center">
              <p className="text-[#8b9bb4] mb-4">Need a custom format? We&apos;ve got you covered.</p>
              <Link href="/contact" className="text-[#00d4aa] hover:underline font-medium">
                Talk to our team →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">Testimonials</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 font-[family-name:var(--font-display)]">
                Trusted by <span className="text-[#00d4aa]">500+</span><br />
                cabinet shops worldwide
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <TestimonialCard key={i} testimonial={testimonial} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Technical Section */}
      <section className="relative py-32 bg-[#0d1219]">
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        
        <div className="relative max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">Technical</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 font-[family-name:var(--font-display)]">
                Built for <span className="text-[#00d4aa]">production</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <div className="space-y-6">
                {[
                  { label: "API Rate Limit", value: "10,000 requests/hour" },
                  { label: "Average Parse Time", value: "< 2 seconds" },
                  { label: "Uptime SLA", value: "99.9%" },
                  { label: "Data Encryption", value: "AES-256" },
                  { label: "Compliance", value: "SOC2, GDPR" },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-[#8b9bb4]">{item.label}</span>
                    <span className="text-[#f0f4f8] font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="p-6 rounded-xl bg-[#111820] border border-white/10 font-mono text-sm overflow-x-auto">
                <div className="text-[#5a6a7a] mb-4"># API Integration Example</div>
                <pre className="text-[#8b9bb4]">
                  <code>{`curl -X POST https://api.cai-intake.io/v1/parse \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "base64_encoded_image",
    "output_format": "maxcut"
  }'`}</code>
                </pre>
                <div className="mt-4 text-[#00d4aa]"># → Returns CNC-ready cutlist in 1.8s</div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-[#00d4aa] text-sm font-mono uppercase tracking-wider">Pricing</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 mb-6 font-[family-name:var(--font-display)]">
                Simple, <span className="text-[#00d4aa]">transparent</span> pricing
              </h2>
              <p className="text-[#8b9bb4] max-w-xl mx-auto">
                Start free, upgrade as you grow. No hidden fees. Cancel anytime.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {PRICING.map((tier, i) => (
              <PricingCard key={i} tier={tier} index={i} />
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="mt-12 text-center">
              <Link href="/pricing" className="text-[#00d4aa] hover:underline font-medium">
                View full pricing details →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14] to-[#0d1219]" />
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00d4aa]/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 font-[family-name:var(--font-display)]">
              Stop transcribing.<br />
              <span className="text-[#00d4aa]">Start manufacturing.</span>
            </h2>
            <p className="text-[#8b9bb4] text-lg mb-10 max-w-xl mx-auto">
              Your first 14 days are free. No credit card required. 
              Set up in under 5 minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="group px-10 py-5 rounded-xl bg-[#00d4aa] text-[#0a0f14] font-bold text-lg hover:bg-[#33e0bb] transition-all shadow-xl shadow-[#00d4aa]/20 hover:shadow-[#00d4aa]/40 hover:scale-[1.02]"
              >
                Start Free Trial
                <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/contact"
                className="px-10 py-5 rounded-xl border border-white/10 text-[#f0f4f8] font-semibold text-lg hover:bg-white/5 transition-all"
              >
                Talk to Sales
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-[#0a0f14] border-t border-white/5 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Logo className="w-8 h-8" />
                <span className="font-bold text-[#f0f4f8] font-[family-name:var(--font-display)]">CAI Intake</span>
              </Link>
              <p className="text-sm text-[#5a6a7a] leading-relaxed">
                Part of the CabinetAI ecosystem. 
                Transforming woodworking manufacturing with AI.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-[#f0f4f8] mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-[#8b9bb4]">
                <li><Link href="/features" className="hover:text-[#f0f4f8] transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-[#f0f4f8] transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="hover:text-[#f0f4f8] transition-colors">Integrations</Link></li>
                <li><Link href="/changelog" className="hover:text-[#f0f4f8] transition-colors">Changelog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-[#f0f4f8] mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-[#8b9bb4]">
                <li><Link href="/docs" className="hover:text-[#f0f4f8] transition-colors">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-[#f0f4f8] transition-colors">API Reference</Link></li>
                <li><Link href="/guides" className="hover:text-[#f0f4f8] transition-colors">Guides</Link></li>
                <li><Link href="/support" className="hover:text-[#f0f4f8] transition-colors">Support</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-[#f0f4f8] mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[#8b9bb4]">
                <li><Link href="/about" className="hover:text-[#f0f4f8] transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-[#f0f4f8] transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-[#f0f4f8] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-[#f0f4f8] transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#5a6a7a]">
              © {new Date().getFullYear()} CabinetAI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="https://twitter.com/cabinetai" className="text-[#5a6a7a] hover:text-[#00d4aa] transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="https://linkedin.com/company/cabinetai" className="text-[#5a6a7a] hover:text-[#00d4aa] transition-colors" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a href="https://github.com/cabinetai" className="text-[#5a6a7a] hover:text-[#00d4aa] transition-colors" aria-label="GitHub">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
