"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { track } from "@/components/analytics/AnalyticsProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
    track("app_error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.slice(0, 1000),
    });
  }, [error]);

  return (
    <main className="container mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Something went wrong</h1>
      <p className="text-sm text-slate-600">
        We hit an unexpected error while loading this page. You can retry, or
        head back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400">ref: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
        <a
          href="/today"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Today
        </a>
      </div>
    </main>
  );
}
