import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation - CAI Intake",
  description: "Learn how to use CAI Intake with our comprehensive documentation and guides.",
};

const sections = [
  {
    title: "Getting Started",
    description: "Learn the basics of CAI Intake and get up and running quickly.",
    links: [
      { title: "Quick Start Guide", href: "#quick-start" },
      { title: "Creating Your First Cutlist", href: "#first-cutlist" },
      { title: "Understanding the Dashboard", href: "#dashboard" },
    ],
  },
  {
    title: "Parsing & Import",
    description: "Import cutlists from various formats using AI-powered parsing.",
    links: [
      { title: "Text & Paste Parsing", href: "#text-parsing" },
      { title: "Excel/CSV Import", href: "#excel-import" },
      { title: "Image & PDF OCR", href: "#ocr" },
      { title: "Smart Material Matching", href: "#material-matching" },
    ],
  },
  {
    title: "Materials & Operations",
    description: "Configure materials, edgebands, and CNC operations.",
    links: [
      { title: "Material Library", href: "#materials" },
      { title: "Edgeband Configuration", href: "#edgebands" },
      { title: "Groove Profiles", href: "#grooves" },
      { title: "Hole Patterns", href: "#holes" },
    ],
  },
  {
    title: "Export & Integration",
    description: "Export cutlists to optimization software.",
    links: [
      { title: "MaxCut Export", href: "#maxcut" },
      { title: "CutList Plus Export", href: "#cutlistplus" },
      { title: "CSV Export Options", href: "#csv" },
      { title: "API Integration", href: "#api" },
    ],
  },
  {
    title: "Team & Organization",
    description: "Manage your team and organization settings.",
    links: [
      { title: "User Roles", href: "#roles" },
      { title: "Inviting Team Members", href: "#invites" },
      { title: "Organization Settings", href: "#org-settings" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="py-16">
      {/* Hero */}
      <section className="container mx-auto px-6 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          <span className="text-[#00d4aa]">Documentation</span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          Everything you need to know about using CAI Intake effectively.
        </p>
      </section>

      {/* Search */}
      <section className="container mx-auto px-6 mb-12">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Search documentation..."
              className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50"
            />
            <svg
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Documentation Sections */}
      <section className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#00d4aa]/50 transition-colors"
            >
              <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
              <p className="text-white/60 text-sm mb-4">{section.description}</p>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[#00d4aa] hover:text-[#00e6b8] text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* User Guide Link */}
      <section className="container mx-auto px-6 mt-16 text-center">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Need More Help?</h2>
          <p className="text-white/60 mb-6">
            Check out our comprehensive user guide or contact support for personalized assistance.
          </p>
          <div className="flex justify-center gap-4">
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

