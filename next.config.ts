import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Which places the browser may load code and content from.
// 'unsafe-inline' is needed because Next.js and React add small inline scripts and styles themselves.
// A nonce-based policy would be stricter, but nonces need every page rendered per request, which
// would undo the page caching (ISR). Reviewed against Razorpay Checkout: Razorpay publishes no CSP
// list, and https://*.razorpay.com already covers the hosts it uses (checkout, api, cdn, lumberjack)
// for scripts, frames, requests, images, fonts and styles, so nothing needs loosening. Confirm with
// a real Test Mode payment in a browser and watch /api/csp-report for blocked requests.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://*.razorpay.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.razorpay.com",
  "font-src 'self' data: https://*.razorpay.com",
  "connect-src 'self' https://*.razorpay.com",
  "frame-src https://*.razorpay.com",
  "form-action 'self' https://*.razorpay.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // What this option does (see the Next.js docs): the proxy buffers each request body so the route
    // can read it again, and bodies above this size are cut off at the limit. Set to Vercel's real
    // request cap (4.5 MB, see src/lib/image-budget.ts REQUEST_LIMIT_BYTES) so local development
    // behaves like production: an oversize upload is refused instead of quietly working. The upload
    // routes also reject it up front from its Content-Length, with a readable 413 message.
    proxyClientMaxBodySize: 4_500_000,
    agentUpgrade: "security",
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
