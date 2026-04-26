"use client";

import { useEffect, useState } from "react";

/**
 * Phase 15 — cookie / analytics consent banner.
 *
 * India's DPDP Act 2023 requires explicit consent for non-essential
 * processing. We gate PostHog analytics behind this choice; Sentry error
 * reporting (no PII) and essential auth cookies remain always-on.
 *
 * Choice is persisted in localStorage under `sikhya_consent` with values
 * `accepted` or `rejected`. AnalyticsProvider reads the same key and
 * listens for the `sikhya:consent` CustomEvent to re-init on acceptance.
 */
const KEY = "sikhya_consent";

export default function ConsentBanner() {
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored !== "accepted" && stored !== "rejected") {
        setNeedsChoice(true);
      }
    } catch {
      // Private mode / storage blocked — skip the banner.
    }
  }, []);

  function choose(value: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(KEY, value);
      window.dispatchEvent(
        new CustomEvent("sikhya:consent", { detail: value }),
      );
    } catch {
      /* ignore */
    }
    setNeedsChoice(false);
  }

  if (!needsChoice) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="container mx-auto flex max-w-5xl flex-col gap-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl">
          We use a small set of first-party cookies to keep you signed in and
          to remember your audience preference. With your permission we also
          collect anonymous usage analytics to improve the product. See our{" "}
          <a href="/legal/privacy" className="underline hover:text-brand">
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
