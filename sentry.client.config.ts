/**
 * Phase 15 — Sentry client-side init.
 *
 * Bundled into every client page via the @sentry/nextjs webpack plugin.
 * Fires only when NEXT_PUBLIC_SENTRY_DSN is set, so dev + self-hosted
 * installs without a DSN are no-ops.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    // Keep sampling conservative to stay under free-tier quota.
    tracesSampleRate: 0.1,
    // Session replay is opt-in; off by default for minors.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // We already capture window.error / unhandledrejection via PostHog —
    // Sentry also captures them by default. That's fine; the two sinks
    // serve different purposes (product analytics vs debuggable stack traces).
  });
}
