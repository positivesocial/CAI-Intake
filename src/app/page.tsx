import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--cai-navy)] via-[var(--cai-navy-light)] to-[var(--cai-navy)]">
      {/* Hero Section */}
      <header className="container mx-auto px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <svg
              className="w-10 h-10"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="heroGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
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
              <line
                x1="16"
                y1="12"
                x2="48"
                y2="12"
                stroke="#ffffff"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <line
                x1="20"
                y1="18"
                x2="44"
                y2="18"
                stroke="#ffffff"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <path
                d="M32 36 L28 44 L30 44 L30 52 L34 52 L34 44 L36 44 Z"
                fill="#ffffff"
                opacity="0.9"
              />
            </svg>
            <div>
              <span className="text-xl font-bold text-white">CAI</span>
              <span className="text-xl font-medium text-[var(--cai-teal)] ml-1">
                Intake
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-white/80 hover:text-white transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-[var(--cai-teal)] text-[var(--cai-navy)] font-semibold hover:bg-[var(--cai-teal-light)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Hero */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            The Universal{" "}
            <span className="text-[var(--cai-teal)]">Cutlist</span>
            <br />
            Ingestion Engine
          </h1>

          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
            Transform messy spreadsheets, handwritten notes, voice commands, and
            scanned documents into perfectly structured cutlists. Ready for
            optimization. Ready for production.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-xl bg-[var(--cai-teal)] text-[var(--cai-navy)] font-bold text-lg hover:bg-[var(--cai-teal-light)] transition-all hover:scale-105"
            >
              Start Free Trial
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl border-2 border-white/30 text-white font-semibold text-lg hover:bg-white/10 transition-all"
            >
              Watch Demo
            </Link>
          </div>

          {/* Input Modes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: "⌨️",
                title: "Manual Entry",
                desc: "Fast parsing & full forms",
              },
              {
                icon: "📊",
                title: "Excel Import",
                desc: "Smart column mapping",
              },
              {
                icon: "🎤",
                title: "Voice Dictation",
                desc: "Speak your cutlist",
              },
              {
                icon: "📄",
                title: "PDF/Image OCR",
                desc: "AI-powered extraction",
              },
              {
                icon: "📱",
                title: "QR Templates",
                desc: "99%+ accuracy forms",
              },
              { icon: "📋", title: "Copy/Paste", desc: "From any source" },
            ].map((mode, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="text-3xl mb-2">{mode.icon}</div>
                <div className="text-white font-semibold">{mode.title}</div>
                <div className="text-white/50 text-sm">{mode.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            One Canonical Format.{" "}
            <span className="text-[var(--cai-teal)]">Zero Ambiguity.</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-[var(--cai-teal)]/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-[var(--cai-teal)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Validated & Verified
              </h3>
              <p className="text-white/60">
                Every part passes through strict schema validation. Confidence
                scores show what needs human review.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-[var(--cai-teal)]/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-[var(--cai-teal)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6M12 9v6"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                CNC-Ready Operations
              </h3>
              <p className="text-white/60">
                Full support for edge banding, grooves, holes, routing, and
                custom CNC operations per part.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-[var(--cai-teal)]/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-[var(--cai-teal)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Export Anywhere
              </h3>
              <p className="text-white/60">
                CAI 2D optimizer, MaxCut, CutList Plus, Excel, JSON - export to
                any format your shop needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white/60">
              Part of the{" "}
              <span className="text-white font-semibold">CabinetAI</span>{" "}
              ecosystem
            </span>
          </div>
          <div className="flex items-center gap-6 text-white/60">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/docs" className="hover:text-white transition-colors">
              API Docs
            </Link>
            <a
              href="https://github.com/positivesocial/CAI-Intake"
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
