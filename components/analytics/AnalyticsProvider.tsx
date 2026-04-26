"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Phase 15 — PostHog analytics bootstrap.
 *
 * Fires only when NEXT_PUBLIC_POSTHOG_KEY is set, so dev + self-hosted
 * installs without analytics keys are no-ops. `person_profiles=identified_only`
 * keeps anonymous traffic from bloating the person table.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
    if (!key) return;

    // Phase 15 — DPDP consent gate. Only boot PostHog after the user
    // explicitly opts in. We still attach error listeners so crashes are
    // captured locally; they are only forwarded once PostHog is loaded.
    function hasConsent() {
      try {
        return window.localStorage.getItem("sikhya_consent") === "accepted";
      } catch {
        return false;
      }
    }
    function boot() {
      if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;
      posthog.init(key!, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
      });
    }
    if (hasConsent()) boot();
    function onConsent(ev: Event) {
      if ((ev as CustomEvent).detail === "accepted") boot();
    }
    window.addEventListener("sikhya:consent", onConsent);

    // Phase 15 — capture uncaught errors + unhandled promise rejections.
    function onError(ev: ErrorEvent) {
      try {
        posthog.capture("client_error", {
          message: ev.message?.slice(0, 300) ?? "",
          filename: ev.filename?.slice(0, 300) ?? "",
          lineno: ev.lineno ?? null,
          colno: ev.colno ?? null,
          stack: ev.error?.stack?.slice(0, 1000) ?? null,
        });
      } catch {
        /* swallow */
      }
    }
    function onReject(ev: PromiseRejectionEvent) {
      try {
        const reason = ev.reason;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : JSON.stringify(reason)?.slice(0, 300);
        posthog.capture("unhandled_rejection", {
          message: message?.slice(0, 300) ?? "",
          stack:
            reason instanceof Error ? reason.stack?.slice(0, 1000) : null,
        });
      } catch {
        /* swallow */
      }
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      window.removeEventListener("sikhya:consent", onConsent);
    };
  }, []);
  return null;
}

/**
 * Small typed wrapper so route handlers can fire analytics without
 * importing the full SDK. No-op when PostHog isn't initialised.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* swallow — analytics never blocks UX */
  }
}
