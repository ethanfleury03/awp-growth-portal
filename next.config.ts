import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const devExtraOrigins = (process.env.NEXT_PUBLIC_DEV_EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers. We deliberately use a permissive CSP in dev (Next's HMR
 * needs unsafe-eval / unsafe-inline) and tighten in production.
 */
const csp = [
  "default-src 'self'",
  // Clerk ships its own chunks + images.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.dev https://js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk.com https://api.stripe.com https://maps.googleapis.com https://*.retellai.com https://*.sentry.io wss:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isProd ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  isProd
    ? { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
    : null,
].filter(Boolean) as { key: string; value: string }[];

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  ...(devExtraOrigins.length ? { allowedDevOrigins: devExtraOrigins } : {}),
  images: {
    // We author the marketing SVG placeholders ourselves; safe to allow here so
    // next/image can serve them before the photo pipeline runs.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
});
