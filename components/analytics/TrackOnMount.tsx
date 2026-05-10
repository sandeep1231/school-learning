"use client";

import { useEffect, useRef } from "react";
import { track } from "@/components/analytics/AnalyticsProvider";

/**
 * Drop-in client component that fires a single PostHog event when it
 * mounts. Useful from server-rendered pages where you can't `useEffect`
 * directly. Pure side-effect, renders nothing.
 *
 *   <TrackOnMount event="topic_opened" properties={{ topic_slug, subject }} />
 *
 * Guarded against StrictMode double-invocation by an internal ref so the
 * event still fires exactly once per logical mount.
 */
export default function TrackOnMount({
  event,
  properties,
}: {
  event: string;
  properties?: Record<string, unknown>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, properties);
  }, [event, properties]);
  return null;
}
