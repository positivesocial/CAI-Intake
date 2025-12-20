import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ==========================================================================
  // SECURITY HEADERS
  // ==========================================================================
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent clickjacking attacks
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // XSS Protection (legacy, but still useful)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // DNS prefetch control
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // Permissions Policy (formerly Feature-Policy)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // CSP for main app (stricter)
        source: "/:path((?!api/).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // API routes get CORS headers
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-CSRF-Token, X-Request-Id",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400", // 24 hours
          },
        ],
      },
    ];
  },

  // ==========================================================================
  // STRICT MODE & PERFORMANCE
  // ==========================================================================
  reactStrictMode: true,
  
  // Enable compression
  compress: true,

  // ==========================================================================
  // POWERED BY HEADER (security through obscurity)
  // ==========================================================================
  poweredByHeader: false,

  // ==========================================================================
  // IMAGE OPTIMIZATION
  // ==========================================================================
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
    // Optimize images
    formats: ["image/avif", "image/webp"],
  },

  // ==========================================================================
  // EXPERIMENTAL FEATURES
  // ==========================================================================
  experimental: {
    // Enable server actions (already default in Next 14+)
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // ==========================================================================
  // REDIRECTS
  // ==========================================================================
  async redirects() {
    return [
      // Redirect old routes if needed
      // {
      //   source: '/old-route',
      //   destination: '/new-route',
      //   permanent: true,
      // },
    ];
  },

  // ==========================================================================
  // TURBOPACK CONFIG (Next.js 16+ uses Turbopack by default)
  // ==========================================================================
  turbopack: {
    // Configuration for Turbopack if needed
  },
};

export default nextConfig;
