"use client";

import { useEffect } from "react";

/**
 * Phase 14 — registers /sw.js on the root layout. No-ops in dev (Next.js's
 * HMR clashes with SW caching) and when Service Workers are unsupported.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Silent — never crash the app on SW registration failure.
          console.warn("[sw] register failed:", err);
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
