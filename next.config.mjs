import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render deploy: ship a self-contained server bundle so the runtime
  // image stays small and cold starts are fast. Vercel ignores this flag.
  output: "standalone",
  // Skip in-build TS/ESLint checks — CI runs `npm run typecheck` + `npm run
  // lint` separately. Removing them from `next build` cuts peak memory by
  // ~40% on tiny build instances (Render Starter = 512 MB).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return [
      // Phase 1 pivot: legacy flat routes → board-scoped hierarchy.
      // Preserves query params (e.g. ?chapter=slug) automatically.
      {
        source: "/subject/:code",
        destination: "/b/bse-od/c/9/s/:code",
        permanent: false,
      },
    ];
  },
};

// Phase 15 — Sentry webpack plugin wraps the final config. When the Sentry
// env vars are missing (dev, self-hosted), this just no-ops — no upload,
// no build-time auth call.
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
  // Skip source-map generation entirely when no auth token is set — saves
  // a lot of memory + build time on small Render instances.
  sourcemaps: process.env.SENTRY_AUTH_TOKEN
    ? { deleteSourcemapsAfterUpload: true }
    : { disable: true },
};

// Wrap with Sentry only when explicitly enabled (DSN set). On bare-metal
// builds (no Sentry), skip the wrapper entirely so the plugin doesn't
// instrument routes or balloon memory usage.
const finalConfig = process.env.SENTRY_DSN
  ? withSentryConfig(withNextIntl(nextConfig), sentryOptions)
  : withNextIntl(nextConfig);

export default finalConfig;

