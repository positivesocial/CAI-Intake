import Link from "next/link";

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="navGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4aa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path
        d="M8 8 L56 8 L56 16 L40 32 L40 56 L24 56 L24 32 L8 16 Z"
        fill="url(#navGradient)"
        stroke="#00d4aa"
        strokeWidth="2"
      />
      <line x1="16" y1="12" x2="48" y2="12" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
      <line x1="20" y1="18" x2="44" y2="18" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
      <path d="M32 36 L28 44 L30 44 L30 52 L34 52 L34 44 L36 44 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Navigation */}
      <header className="border-b border-white/10">
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
              <Link href="/features" className="text-white/70 hover:text-white transition-colors font-medium">
                Features
              </Link>
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
                className="text-white/80 hover:text-white transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/60">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-white/60">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <Link href="/" className="flex items-center gap-2">
                <Logo className="w-8 h-8" />
                <span className="font-bold">CAI Intake</span>
              </Link>
              <p className="text-white/50 text-sm mt-4">
                Transform messy cutlists into optimized production data.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-white/50 text-sm">
            &copy; {new Date().getFullYear()} CAI Intake. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

