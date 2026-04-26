"use client";

/**
 * Phase 15 — theme toggle.
 *
 * Reads `sikhya.theme` (light|dark|system) from localStorage and toggles
 * the `dark` class on <html>. Companion to the inline pre-hydration
 * script in app/layout.tsx that prevents FOUC.
 */
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const KEY = "sikhya.theme";

function apply(mode: Mode) {
  const sysDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && sysDark);
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(KEY) as Mode | null) ?? "system";
      setMode(saved);
      apply(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function cycle() {
    const next: Mode =
      mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    apply(next);
  }

  const label =
    mode === "system" ? "System theme" : mode === "light" ? "Light" : "Dark";
  const icon = mode === "system" ? "🖥" : mode === "light" ? "☀" : "🌙";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
