import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAI Intake - The Universal Cutlist Ingestion Engine",
  description:
    "Transform messy spreadsheets, handwritten notes, and scanned documents into perfectly structured cutlists. AI-powered. Ready for optimization.",
};

// =============================================================================
// COMPONENTS
// =============================================================================

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path
        d="M8 8 L56 8 L56 16 L40 32 L40 56 L24 56 L24 32 L8 16 Z"
        fill="url(#heroGradient)"
        stroke="#00d4aa"
        strokeWidth="2"
      />
      <line x1="16" y1="12" x2="48" y2="12" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
      <line x1="20" y1="18" x2="44" y2="18" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
      <path d="M32 36 L28 44 L30 44 L30 52 L34 52 L34 44 L36 44 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#0a1628] h-[800px]" />
      <div className="absolute top-0 left-0 right-0 h-[800px] bg-[radial-gradient(ellipse_at_top,rgba(0,212,170,0.15),transparent_60%)]" />

      {/* Navigation */}
      <header className="relative z-20">
        <nav className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <div>
                <span className="text-xl font-bold text-white">CAI</span>
                <span className="text-xl font-medium text-[#00d4aa] ml-1">Intake</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/pricing" className="text-white/70 hover:text-white transition-colors font-medium">
                Pricing
              </Link>
              <Link href="/docs" className="text-white/70 hover:text-white transition-colors font-medium">
                Documentation
              </Link>
              <Link href="/about" className="text-white/70 hover:text-white transition-colors font-medium">
                About
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-white/80 hover:text-white transition-colors font-medium hidden sm:block"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all shadow-lg shadow-[#00d4aa]/20"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/10 mb-8">
              <span className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-4 h-4 text-yellow-400" />
                ))}
              </span>
              <span className="text-white/80 text-sm">Trusted by 500+ cabinet shops worldwide</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1]">
              The Universal{" "}
              <span className="bg-gradient-to-r from-[#00d4aa] to-[#3b82f6] bg-clip-text text-transparent">
                Cutlist Ingestion
              </span>
              <br />
              Engine for Manufacturing
            </h1>

            <p className="text-lg sm:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Transform messy spreadsheets, handwritten notes, voice commands, and scanned documents into 
              perfectly structured cutlists. AI-powered. Ready for optimization. Ready for production.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/signup"
                className="px-8 py-4 rounded-xl bg-[#00d4aa] text-[#0a1628] font-bold text-lg hover:bg-[#00e6b8] transition-all shadow-xl shadow-[#00d4aa]/25 hover:shadow-[#00d4aa]/40 hover:scale-[1.02]"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 rounded-xl border-2 border-white/20 text-white font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur"
              >
                Watch Demo Video
              </Link>
            </div>

            {/* Social Proof Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white">2.5M+</div>
                <div className="text-white/60 text-sm">Parts Processed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white">99.2%</div>
                <div className="text-white/60 text-sm">Accuracy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white">4.9</div>
                <div className="text-white/60 text-sm">Customer Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Input Methods Section */}
      <section className="relative z-10 py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Import From Anywhere
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Six powerful ways to get your cutlists into the system. No matter how your data arrives, we handle it.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: "⌨️", title: "Manual Entry", desc: "Smart spreadsheet with fast parsing" },
              { icon: "📊", title: "Excel & CSV Import", desc: "Intelligent column mapping" },
              { icon: "🎤", title: "Voice Dictation", desc: "Speak your cutlists naturally" },
              { icon: "📄", title: "PDF & Image OCR", desc: "AI-powered extraction" },
              { icon: "📱", title: "QR Templates", desc: "99%+ accuracy recognition" },
              { icon: "📋", title: "Copy & Paste", desc: "From any source" },
            ].map((method, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-gray-100/50 transition-all duration-300"
              >
                <div className="text-4xl mb-3">{method.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{method.title}</h3>
                <p className="text-sm text-gray-600">{method.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              One Canonical Format. Zero Ambiguity.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every part is validated, normalized, and ready for downstream processing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-[#00d4aa]/10 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-[#00d4aa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Validated & Verified</h3>
              <p className="text-gray-600 leading-relaxed">
                Every part passes strict schema validation. Confidence scores highlight items needing human review.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M12 9v6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">CNC-Ready Operations</h3>
              <p className="text-gray-600 leading-relaxed">
                Full support for edge banding, grooves, drilling patterns, routing, and custom CNC operations.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Export Anywhere</h3>
              <p className="text-gray-600 leading-relaxed">
                CAI 2D, MaxCut, CutList Plus, CutRite, Optimik, Excel, CSV, JSON - export to any format.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Industry Leaders
            </h2>
            <p className="text-lg text-gray-600">
              See what cabinet professionals are saying about CAI Intake
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                quote: "Cut our intake time by 75%. The AI parsing is remarkably accurate even with messy handwritten notes.",
                name: "Michael Thompson",
                role: "Production Manager",
                company: "Premium Cabinets Co.",
              },
              {
                quote: "Finally, a system that understands woodworking. Edge banding, grooves, drilling - it handles everything.",
                name: "Sarah Chen",
                role: "Owner",
                company: "Chen Custom Millwork",
              },
              {
                quote: "The QR template system is brilliant. Our clients fill out forms, we scan them, and parts appear instantly.",
                name: "David Rodriguez",
                role: "Operations Director",
                company: "Precision Cabinet Works",
              },
            ].map((testimonial, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <StarIcon key={j} className="w-5 h-5 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-gradient-to-br from-[#0a1628] to-[#0f2847]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Start free, upgrade as you grow. No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Free", price: "$0", features: ["5 cutlists/month", "50 parts/cutlist", "Basic exports"] },
              { name: "Professional", price: "$79", features: ["Unlimited cutlists", "All export formats", "Priority support"], popular: true },
              { name: "Enterprise", price: "Custom", features: ["Unlimited everything", "Custom integrations", "Dedicated support"] },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-2xl ${
                  plan.popular
                    ? "bg-[#00d4aa] text-[#0a1628]"
                    : "bg-white/10 backdrop-blur text-white"
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-bold uppercase tracking-wider mb-2">Most Popular</div>
                )}
                <div className="text-2xl font-bold mb-1">{plan.name}</div>
                <div className="text-3xl font-bold mb-4">
                  {plan.price}
                  {plan.price !== "Custom" && <span className="text-lg font-normal">/mo</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <CheckIcon className={`w-4 h-4 ${plan.popular ? "text-[#0a1628]" : "text-[#00d4aa]"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.price === "Custom" ? "/contact" : "/signup"}
                  className={`block text-center py-2.5 rounded-lg font-semibold transition-all ${
                    plan.popular
                      ? "bg-[#0a1628] text-white hover:bg-[#0a1628]/90"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing" className="text-[#00d4aa] hover:underline font-medium">
              View full pricing details →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Workflow?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Join hundreds of cabinet shops already saving hours every week with CAI Intake.
              Start your free trial today - no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 rounded-xl bg-[#00d4aa] text-[#0a1628] font-bold text-lg hover:bg-[#00e6b8] transition-all shadow-lg shadow-[#00d4aa]/20"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact"
                className="px-8 py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-lg hover:bg-gray-50 transition-all"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Logo className="w-8 h-8" />
                <span className="font-bold">CAI Intake</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Part of the CabinetAI ecosystem. Transforming woodworking manufacturing with AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="/guides" className="hover:text-white transition-colors">Guides</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} CabinetAI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="https://twitter.com/cabinetai" className="text-gray-500 hover:text-white transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="https://linkedin.com/company/cabinetai" className="text-gray-500 hover:text-white transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a href="https://github.com/cabinetai" className="text-gray-500 hover:text-white transition-colors">
                <span className="sr-only">GitHub</span>
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
