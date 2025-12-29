"use client";

import * as React from "react";
import Link from "next/link";
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  Video,
  FileText,
  Search,
  ChevronRight,
  ExternalLink,
  Keyboard,
  Zap,
  Users,
  CreditCard,
  FileSpreadsheet,
  Mic,
  Upload,
  Settings,
  BarChart3,
  Layers,
  Package,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ElementType;
  href?: string;
}

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

// ============================================================
// DATA
// ============================================================

const HELP_CATEGORIES = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of CAI Intake",
    icon: Zap,
    color: "text-green-600 bg-green-100",
    articles: [
      { title: "Quick Start Guide", href: "#quick-start" },
      { title: "Creating Your First Cutlist", href: "#first-cutlist" },
      { title: "Understanding the Dashboard", href: "#dashboard" },
      { title: "Navigation & Interface", href: "#navigation" },
    ],
  },
  {
    id: "input-methods",
    title: "Input Methods",
    description: "Learn all the ways to add parts",
    icon: Upload,
    color: "text-blue-600 bg-blue-100",
    articles: [
      { title: "Manual Entry", href: "#manual-entry" },
      { title: "Excel/CSV Import", href: "#excel-import" },
      { title: "Smart File Upload (OCR)", href: "#ocr-upload" },
      { title: "Voice Dictation", href: "#voice" },
      { title: "Copy/Paste Parsing", href: "#paste" },
      { title: "QR Templates", href: "#templates" },
    ],
  },
  {
    id: "operations",
    title: "Operations & CNC",
    description: "Edgebanding, grooves, holes & routing",
    icon: Layers,
    color: "text-purple-600 bg-purple-100",
    articles: [
      { title: "Edgebanding Setup", href: "#edgebanding" },
      { title: "Grooves & Dadoes", href: "#grooves" },
      { title: "Hole Patterns", href: "#holes" },
      { title: "CNC Routing Operations", href: "#cnc" },
      { title: "Operation Shortcodes", href: "#shortcodes" },
    ],
  },
  {
    id: "export",
    title: "Export & Integration",
    description: "Export to optimization software",
    icon: FileSpreadsheet,
    color: "text-orange-600 bg-orange-100",
    articles: [
      { title: "Export Formats Overview", href: "#export-formats" },
      { title: "MaxCut Export", href: "#maxcut" },
      { title: "CutList Plus Export", href: "#cutlistplus" },
      { title: "CSV & JSON Export", href: "#csv-json" },
      { title: "API Integration", href: "#api" },
    ],
  },
  {
    id: "team",
    title: "Team & Organization",
    description: "Manage users and settings",
    icon: Users,
    color: "text-teal-600 bg-teal-100",
    articles: [
      { title: "User Roles & Permissions", href: "#roles" },
      { title: "Inviting Team Members", href: "#invites" },
      { title: "Organization Settings", href: "#org-settings" },
      { title: "Branding & Templates", href: "#branding" },
    ],
  },
  {
    id: "billing",
    title: "Billing & Plans",
    description: "Subscription and payment help",
    icon: CreditCard,
    color: "text-pink-600 bg-pink-100",
    articles: [
      { title: "Plans & Pricing", href: "#plans" },
      { title: "Upgrading Your Plan", href: "#upgrade" },
      { title: "Payment Methods", href: "#payment" },
      { title: "Invoices & Receipts", href: "#invoices" },
    ],
  },
];

const FAQ_DATA: FAQ[] = [
  {
    question: "How accurate is the AI/OCR parsing?",
    answer: "Our AI parsing achieves 85-95% accuracy depending on document quality. Well-formatted PDFs and clean images achieve the highest accuracy. Handwritten notes may require more manual review. All parsed parts go through an inbox review process before being added to your cutlist.",
    category: "parsing",
  },
  {
    question: "What file formats can I upload?",
    answer: "CAI Intake supports PDF, PNG, JPG, JPEG, WEBP, HEIC (images), CSV, XLSX, XLS (spreadsheets), and TXT files. Maximum file size is 10MB for standard plans and 50MB for Professional and Enterprise.",
    category: "files",
  },
  {
    question: "Can I import from my existing cutting software?",
    answer: "Yes! We support CSV import with flexible column mapping that works with exports from most cutting software. You can also save column mappings as templates for repeated imports from the same source.",
    category: "import",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use Supabase for database storage with enterprise-grade security, automatic backups, and row-level security policies. Your cutlist data is isolated per organization.",
    category: "security",
  },
  {
    question: "Can I use CAI Intake offline?",
    answer: "CAI Intake is a cloud-based application and requires an internet connection. However, you can export your cutlists in various formats for offline use with your cutting optimization software.",
    category: "general",
  },
  {
    question: "How do I cancel my subscription?",
    answer: "You can cancel anytime from Settings > Billing. Your access continues until the end of your billing period. We also offer a 14-day money-back guarantee for new subscriptions.",
    category: "billing",
  },
  {
    question: "Do you offer API access?",
    answer: "Yes, API access is available on Professional and Enterprise plans. The API allows you to programmatically create cutlists, submit parse jobs, and export data. Full API documentation is available at /docs.",
    category: "api",
  },
  {
    question: "What units does CAI Intake use?",
    answer: "CAI Intake uses millimeters (mm) as the canonical unit internally. When entering dimensions, you can type values in mm, cm, or inches and they'll be converted automatically. Export formats can be configured for your preferred units.",
    category: "general",
  },
  {
    question: "How does voice dictation work?",
    answer: "Voice dictation uses browser-based speech recognition (Chrome/Edge) or file upload transcription via OpenAI Whisper. Speak parts in a structured format like 'side panel, 720 by 560, quantity 2, white board' and the system will parse them automatically.",
    category: "voice",
  },
  {
    question: "Can I undo mistakes?",
    answer: "Yes! CAI Intake has full undo/redo support. Use Ctrl/Cmd+Z to undo and Ctrl/Cmd+Shift+Z to redo. The intake inbox also lets you review and reject parsed parts before adding them to your cutlist.",
    category: "general",
  },
];

const KEYBOARD_SHORTCUTS = [
  { keys: ["Ctrl", "K"], action: "Open command palette" },
  { keys: ["Ctrl", "N"], action: "New cutlist" },
  { keys: ["Ctrl", "S"], action: "Save current cutlist" },
  { keys: ["Ctrl", "E"], action: "Export cutlist" },
  { keys: ["Ctrl", "Z"], action: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], action: "Redo" },
  { keys: ["Delete"], action: "Delete selected parts" },
  { keys: ["Enter"], action: "Confirm edit / Add part" },
  { keys: ["Tab"], action: "Next field" },
  { keys: ["Escape"], action: "Cancel / Close modal" },
  { keys: ["?"], action: "Show keyboard shortcuts" },
];

// ============================================================
// COMPONENTS
// ============================================================

function SearchBar() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ title: string; href: string }[]>([]);

  const allArticles = HELP_CATEGORIES.flatMap((cat) =>
    cat.articles.map((a) => ({ ...a, category: cat.title }))
  );

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const filtered = allArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered.slice(0, 5));
  }, [query]);

  return (
    <div className="relative max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--muted-foreground)]" />
      <Input
        type="text"
        placeholder="Search help articles..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-12 py-6 text-lg"
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-10 overflow-hidden">
          {results.map((result, i) => (
            <a
              key={i}
              href={result.href}
              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--muted)] transition-colors"
            >
              <span>{result.title}</span>
              <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  category,
}: {
  category: (typeof HELP_CATEGORIES)[0];
}) {
  const Icon = category.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", category.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{category.title}</CardTitle>
            <CardDescription>{category.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {category.articles.map((article, i) => (
            <li key={i}>
              <a
                href={article.href}
                className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--cai-teal)] transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                {article.title}
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-[var(--cai-teal)]/10 to-[var(--cai-teal)]/5 border-[var(--cai-teal)]/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-[var(--cai-teal)]/20">
              <Video className="h-6 w-6 text-[var(--cai-teal)]" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Video Tutorials</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                Watch step-by-step guides
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://youtube.com/@cai-intake" target="_blank" rel="noopener noreferrer">
                  Watch Now
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/20">
              <Book className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Documentation</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                Full technical docs & API
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/docs">
                  Read Docs
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-500/20">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Contact Support</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                Get help from our team
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/contact">
                  Contact Us
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function HelpPage() {
  const [faqCategory, setFaqCategory] = React.useState<string>("all");

  const filteredFAQs =
    faqCategory === "all"
      ? FAQ_DATA
      : FAQ_DATA.filter((f) => f.category === faqCategory);

  const faqCategories = ["all", ...new Set(FAQ_DATA.map((f) => f.category))];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-gradient-to-r from-[var(--cai-teal)]/5 to-transparent">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--cai-teal)]/10">
              <HelpCircle className="h-6 w-6 text-[var(--cai-teal)]" />
            </div>
            <h1 className="text-2xl font-bold">Help & Support</h1>
          </div>
          <p className="text-[var(--muted-foreground)] mb-6">
            Find answers, learn best practices, and get help with CAI Intake
          </p>
          <SearchBar />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Access</h2>
          <QuickActions />
        </section>

        {/* Help Categories */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Browse by Topic</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HELP_CATEGORIES.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
            <div className="flex items-center gap-2">
              {faqCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFaqCategory(cat)}
                  className={cn(
                    "px-3 py-1 text-sm rounded-full transition-colors capitalize",
                    faqCategory === cat
                      ? "bg-[var(--cai-teal)] text-white"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {filteredFAQs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-[var(--muted-foreground)]">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]/50"
                  >
                    <span className="text-sm">{shortcut.action}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          <kbd className="px-2 py-1 text-xs font-mono bg-[var(--card)] border border-[var(--border)] rounded shadow-sm">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="text-[var(--muted-foreground)]">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contact Section */}
        <section className="text-center py-8">
          <div className="max-w-xl mx-auto">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h2 className="text-xl font-semibold mb-2">Still need help?</h2>
            <p className="text-[var(--muted-foreground)] mb-6">
              Our support team is here to assist you. Response time is typically within 24 hours.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" asChild>
                <a href="mailto:support@cai-intake.io">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Support
                </a>
              </Button>
              <Button variant="primary" asChild>
                <Link href="/contact">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contact Form
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Status & Version */}
        <section className="border-t border-[var(--border)] pt-6">
          <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>All systems operational</span>
              </div>
              <a
                href="https://status.cai-intake.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--foreground)] transition-colors"
              >
                View status page →
              </a>
            </div>
            <div>
              <span>CAI Intake v1.0.0</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

