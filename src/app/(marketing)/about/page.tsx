import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About - CAI Intake",
  description: "Learn about CAI Intake and our mission to streamline cutlist processing for woodworking professionals.",
};

export default function AboutPage() {
  return (
    <div className="py-16">
      {/* Hero */}
      <section className="container mx-auto px-6 text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          About <span className="text-[#00d4aa]">CAI Intake</span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          We&apos;re building the future of cutlist processing for woodworking professionals.
        </p>
      </section>

      {/* Mission */}
      <section className="container mx-auto px-6 mb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
            <p className="text-white/70 text-lg leading-relaxed mb-6">
              CAI Intake was born from a simple observation: woodworking professionals spend too much 
              time manually transcribing cutlists from handwritten notes, scanned documents, and messy 
              spreadsheets into their optimization software.
            </p>
            <p className="text-white/70 text-lg leading-relaxed mb-6">
              Our mission is to eliminate this tedious, error-prone process by leveraging AI and 
              machine learning to automatically extract, validate, and format cutlist data – saving 
              hours of manual work and reducing costly errors.
            </p>
            <p className="text-white/70 text-lg leading-relaxed">
              Whether you&apos;re a small custom shop or a large production facility, CAI Intake 
              adapts to your workflow and integrates with the tools you already use.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-6 mb-20">
        <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#00d4aa]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Efficiency</h3>
            <p className="text-white/60">
              Every feature is designed to save time and reduce manual work.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-[#00d4aa]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Accuracy</h3>
            <p className="text-white/60">
              AI-powered extraction with human verification for reliable results.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-[#00d4aa]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Collaboration</h3>
            <p className="text-white/60">
              Built for teams with shared libraries and role-based access.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 text-center">
        <div className="bg-gradient-to-r from-[#00d4aa]/20 to-blue-500/20 border border-[#00d4aa]/30 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Join the Future of Cutlist Processing</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Start your free trial today and see the difference AI-powered cutlist processing can make.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}

