import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features - CAI Intake",
  description: "Discover the powerful features of CAI Intake for cutlist processing and optimization.",
};

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

const features = [
  {
    title: "AI-Powered Parsing",
    description: "Advanced OCR and AI extract data from handwritten notes, scanned documents, and messy spreadsheets with high accuracy.",
    items: [
      "Handwriting recognition",
      "Multi-format support (PDF, images, Excel)",
      "Intelligent data extraction",
      "Learning from corrections",
    ],
  },
  {
    title: "Smart Material Matching",
    description: "Automatically matches parsed materials to your organization's material library with confidence scoring.",
    items: [
      "Fuzzy matching algorithms",
      "Material library integration",
      "Edgeband auto-matching",
      "Thickness detection",
    ],
  },
  {
    title: "Multi-Format Export",
    description: "Export optimized cutlists to industry-standard formats compatible with popular software.",
    items: [
      "MaxCut compatible CSV",
      "CutList Plus format",
      "Custom CSV templates",
      "JSON API export",
    ],
  },
  {
    title: "Team Collaboration",
    description: "Work together with role-based access and real-time status tracking.",
    items: [
      "Organization workspaces",
      "Role-based permissions",
      "Activity tracking",
      "Shared material libraries",
    ],
  },
  {
    title: "Operations Support",
    description: "Full support for edgebanding, grooves, holes, and CNC operations.",
    items: [
      "Edgeband configuration",
      "Groove profiles",
      "Hole patterns",
      "CNC routing paths",
    ],
  },
  {
    title: "Quality Assurance",
    description: "Built-in validation and review workflows ensure data accuracy.",
    items: [
      "Confidence scoring",
      "Human review queue",
      "Error highlighting",
      "Audit trails",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="py-16">
      {/* Hero */}
      <section className="container mx-auto px-6 text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Powerful Features for
          <span className="text-[#00d4aa]"> Modern Manufacturing</span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          CAI Intake transforms chaotic cutlist data into structured, optimized production data.
          Here&apos;s what makes it powerful.
        </p>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#00d4aa]/50 transition-colors"
            >
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-white/60 mb-4">{feature.description}</p>
              <ul className="space-y-2">
                {feature.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 mt-20 text-center">
        <div className="bg-gradient-to-r from-[#00d4aa]/20 to-blue-500/20 border border-[#00d4aa]/30 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Workflow?</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Start processing cutlists with AI-powered accuracy today.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-lg border border-white/20 hover:border-white/40 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

