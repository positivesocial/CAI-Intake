"use client";

import * as React from "react";
import Link from "next/link";
import {
  Book,
  Search,
  ChevronRight,
  FileText,
  Upload,
  Settings,
  Users,
  Download,
  Code,
  Zap,
  Layers,
  Package,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  articles: {
    title: string;
    description: string;
    href: string;
  }[];
}

// ============================================================
// DOCUMENTATION DATA
// ============================================================

const DOCUMENTATION: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics and get up and running quickly",
    icon: Zap,
    articles: [
      {
        title: "Quick Start Guide",
        description: "Create your first cutlist in under 5 minutes",
        href: "#quick-start",
      },
      {
        title: "Creating Your First Cutlist",
        description: "Step-by-step guide to creating and saving cutlists",
        href: "#first-cutlist",
      },
      {
        title: "Understanding the Dashboard",
        description: "Navigate the interface and key features",
        href: "#dashboard",
      },
      {
        title: "Keyboard Shortcuts",
        description: "Speed up your workflow with shortcuts",
        href: "#shortcuts",
      },
    ],
  },
  {
    id: "parsing",
    title: "Parsing & Import",
    description: "Import cutlists from various formats using AI",
    icon: Upload,
    articles: [
      {
        title: "Text & Paste Parsing",
        description: "Parse cutlists from pasted text automatically",
        href: "#text-parsing",
      },
      {
        title: "Excel/CSV Import",
        description: "Import from spreadsheets with column mapping",
        href: "#excel-import",
      },
      {
        title: "Image & PDF OCR",
        description: "Extract parts from images and PDFs using AI",
        href: "#ocr",
      },
      {
        title: "Voice Dictation",
        description: "Speak your cutlist using voice input",
        href: "#voice",
      },
      {
        title: "Smart Material Matching",
        description: "How AI matches materials from your input",
        href: "#material-matching",
      },
    ],
  },
  {
    id: "materials",
    title: "Materials & Operations",
    description: "Configure materials, edgebands, and CNC operations",
    icon: Layers,
    articles: [
      {
        title: "Material Library",
        description: "Manage your board materials and properties",
        href: "#materials",
      },
      {
        title: "Edgeband Configuration",
        description: "Set up edgebanding types and shortcodes",
        href: "#edgebands",
      },
      {
        title: "Groove Profiles",
        description: "Define groove profiles for panel backs",
        href: "#grooves",
      },
      {
        title: "Hole Patterns",
        description: "Configure hole patterns for hardware",
        href: "#holes",
      },
      {
        title: "CNC Routing",
        description: "Set up custom CNC routing operations",
        href: "#cnc",
      },
    ],
  },
  {
    id: "export",
    title: "Export & Integration",
    description: "Export cutlists to optimization software",
    icon: Download,
    articles: [
      {
        title: "Export Formats Overview",
        description: "Available export formats and when to use them",
        href: "#export-overview",
      },
      {
        title: "MaxCut Export",
        description: "Export for MaxCut optimization software",
        href: "#maxcut",
      },
      {
        title: "CutList Plus Export",
        description: "Export for CutList Plus Pro",
        href: "#cutlistplus",
      },
      {
        title: "CutRite/Holzma Export",
        description: "Export for Holzma cutting systems",
        href: "#cutrite",
      },
      {
        title: "CSV Export Options",
        description: "Customizable CSV export settings",
        href: "#csv",
      },
    ],
  },
  {
    id: "team",
    title: "Team & Organization",
    description: "Manage your team and organization settings",
    icon: Users,
    articles: [
      {
        title: "User Roles & Permissions",
        description: "Understand role-based access control",
        href: "#roles",
      },
      {
        title: "Inviting Team Members",
        description: "Add new users to your organization",
        href: "#invites",
      },
      {
        title: "Organization Settings",
        description: "Configure org-wide settings and branding",
        href: "#org-settings",
      },
      {
        title: "QR Templates",
        description: "Create branded QR templates for intake",
        href: "#qr-templates",
      },
    ],
  },
  {
    id: "api",
    title: "API Reference",
    description: "Integrate CAI Intake with your systems",
    icon: Code,
    articles: [
      {
        title: "API Overview",
        description: "Introduction to the CAI Intake REST API",
        href: "#api-overview",
      },
      {
        title: "Authentication",
        description: "API key authentication and security",
        href: "#api-auth",
      },
      {
        title: "Parse Jobs",
        description: "Submit and retrieve parse jobs via API",
        href: "#api-parse",
      },
      {
        title: "Cutlists",
        description: "CRUD operations for cutlists",
        href: "#api-cutlists",
      },
      {
        title: "Webhooks",
        description: "Receive notifications for async events",
        href: "#api-webhooks",
      },
    ],
  },
];

// ============================================================
// COMPONENTS
// ============================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4 text-white/40" />
      )}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative rounded-lg bg-slate-900 border border-white/10 overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-white/40 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-white/80 font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  // Filter articles based on search
  const filteredDocs = React.useMemo(() => {
    if (!searchQuery) return DOCUMENTATION;

    const query = searchQuery.toLowerCase();
    return DOCUMENTATION.map((section) => ({
      ...section,
      articles: section.articles.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query)
      ),
    })).filter((section) => section.articles.length > 0);
  }, [searchQuery]);

  const totalArticles = DOCUMENTATION.reduce((sum, s) => sum + s.articles.length, 0);

  return (
    <div className="py-16">
      {/* Hero */}
      <section className="container mx-auto px-6 text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Book className="h-10 w-10 text-[#00d4aa]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          <span className="text-[#00d4aa]">Documentation</span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          Everything you need to know about using CAI Intake effectively.
          {" "}{totalArticles} articles across {DOCUMENTATION.length} categories.
        </p>
      </section>

      {/* Search */}
      <section className="container mx-auto px-6 mb-12">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-white/50 mt-2 text-center">
              Found {filteredDocs.reduce((sum, s) => sum + s.articles.length, 0)} articles
            </p>
          )}
        </div>
      </section>

      {/* Documentation Sections */}
      <section className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {filteredDocs.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;

            return (
              <div
                key={section.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-[#00d4aa]/30 transition-colors"
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-[#00d4aa]/10">
                      <Icon className="h-5 w-5 text-[#00d4aa]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{section.title}</h2>
                      <p className="text-white/60 text-sm">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white/40">{section.articles.length} articles</span>
                    <ChevronRight
                      className={`h-5 w-5 text-white/40 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 border-t border-white/10">
                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                      {section.articles.map((article) => (
                        <Link
                          key={article.href}
                          href={article.href}
                          className="flex items-start gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                        >
                          <FileText className="h-5 w-5 text-[#00d4aa] mt-0.5 shrink-0" />
                          <div>
                            <h3 className="font-medium group-hover:text-[#00d4aa] transition-colors">
                              {article.title}
                            </h3>
                            <p className="text-sm text-white/50">{article.description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Start Example */}
      <section className="container mx-auto px-6 mt-16">
        <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Code className="h-6 w-6 text-[#00d4aa]" />
            Quick API Example
          </h2>
          <p className="text-white/60 mb-6">
            Create a parse job via the API:
          </p>
          <CodeBlock
            language="bash"
            code={`curl -X POST https://api.cai-intake.io/v1/parse-jobs \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": {
      "kind": "text",
      "text": "Side panel 720x560 qty 2 white board"
    },
    "options": {
      "units": "mm",
      "default_thickness_mm": 18
    }
  }'`}
          />
        </div>
      </section>

      {/* Help Section */}
      <section className="container mx-auto px-6 mt-16 text-center">
        <div className="bg-gradient-to-r from-[#00d4aa]/10 to-transparent border border-white/10 rounded-xl p-8 max-w-2xl mx-auto">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 text-[#00d4aa]" />
          <h2 className="text-2xl font-bold mb-4">Need More Help?</h2>
          <p className="text-white/60 mb-6">
            Can&apos;t find what you&apos;re looking for? Our support team is ready to assist.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/help"
              className="px-5 py-2.5 rounded-lg bg-white/10 border border-white/20 font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Help Center
            </Link>
            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
