/** @type {import('next').NextConfig} */
const SCRIPT_SRC_DIRECTIVE =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:";

// In development, allow connecting to a local self-hosted Convex backend over
// http/ws (e.g. the Docker Compose stack: discovery on http://localhost:3211 and the
// realtime WebSocket on ws://localhost:3210). Production stays locked to https/wss.
const CONNECT_SRC_DIRECTIVE =
  process.env.NODE_ENV === "production"
    ? "connect-src 'self' https: wss:"
    : "connect-src 'self' https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  SCRIPT_SRC_DIRECTIVE,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  CONNECT_SRC_DIRECTIVE,
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig = {
  transpilePackages: ["@opencom/ui", "@opencom/web-shared"],
  experimental: {
    // Reduce memory usage during webpack compilation
    webpackMemoryOptimizations: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

module.exports = nextConfig;
