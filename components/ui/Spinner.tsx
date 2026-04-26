"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

/**
 * Brand-coloured spinner. Use inline (`<Spinner size="sm" />`) inside buttons
 * and as centred page loaders. Accessible: has `role="status"` + sr-only text.
 */
export function Spinner({ size = "md", label = "Loading", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span
        className={`${SIZE[size]} animate-spin rounded-full border-brand/30 border-t-brand`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}…</span>
    </span>
  );
}

/**
 * Three bouncing dots used while the tutor is streaming a reply.
 */
export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Tutor is typing"
      className={`inline-flex items-center gap-1 ${className}`}
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand" />
    </span>
  );
}

/**
 * Global top-of-viewport progress bar. Mount once near the app root.
 * Triggers on every same-origin <Link>/<a> click and GET form submit;
 * completes when pathname/searchParams change. Auto-hides after 30s.
 */
function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);

  function clearTimers() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (safetyRef.current !== null) {
      window.clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    if (hideRef.current !== null) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }

  function start() {
    clearTimers();
    setActive(true);
    setProgress(8);
    let p = 8;
    tickRef.current = window.setInterval(() => {
      p = Math.min(p + Math.max(0.5, (90 - p) * 0.08), 90);
      setProgress(p);
    }, 200);
    safetyRef.current = window.setTimeout(() => finish(), 30000);
  }

  function finish() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setProgress(100);
    if (hideRef.current !== null) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
  }

  // Complete whenever the resolved route changes.
  useEffect(() => {
    if (active) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Document-level listeners cover <Link>, <a>, and GET forms without
  // touching every component.
  useEffect(() => {
    function isSameOrigin(href: string) {
      try {
        return new URL(href, window.location.href).origin === window.location.origin;
      } catch {
        return false;
      }
    }
    function isInternalNav(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a || !a.href) return false;
      if (a.target && a.target !== "_self") return false;
      if (a.hasAttribute("download")) return false;
      if (a.getAttribute("rel")?.includes("external")) return false;
      if (!isSameOrigin(a.href)) return false;
      const url = new URL(a.href);
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return false;
      }
      return true;
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isInternalNav(e.target)) return;
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.method || "get").toLowerCase();
      if (method !== "get") return;
      if (!isSameOrigin(form.action || window.location.href)) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
    >
      <div
        className="h-full bg-brand shadow-[0_0_8px_rgba(15,118,110,0.6)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * Mount once at the app root. Wraps the implementation in <Suspense>
 * because `useSearchParams` requires a Suspense boundary in Next 15.
 */
export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}
