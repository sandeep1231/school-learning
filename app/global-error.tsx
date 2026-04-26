"use client";

/**
 * Phase 15 — Root error boundary. Runs when the error happens above the
 * regular `error.tsx` (e.g. in root layout). Must render its own <html>
 * + <body> shell since the broken layout has already been discarded.
 */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
