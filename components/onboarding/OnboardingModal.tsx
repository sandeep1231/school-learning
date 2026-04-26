"use client";

/**
 * Phase 15 — first-visit onboarding modal.
 *
 * Captures a language preference (en/or/hi) and a study goal, then writes
 * a `NEXT_LOCALE` cookie so the next-intl request config picks it up on
 * subsequent renders. Stores a `sikhya.onboard.done` flag in localStorage
 * so we don't re-prompt. Pure client; safe to mount anywhere.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "sikhya.onboard.done";

const LANGS: Array<{ code: "en" | "or" | "hi"; native: string; en: string }> = [
  { code: "or", native: "ଓଡ଼ିଆ", en: "Odia" },
  { code: "en", native: "English", en: "English" },
  { code: "hi", native: "हिन्दी", en: "Hindi" },
];

const GOALS: Array<{ key: string; label: string; sub: string }> = [
  {
    key: "stay_on_track",
    label: "Stay on track",
    sub: "Daily lessons aligned to BSE syllabus",
  },
  {
    key: "exam_ready",
    label: "Crack the annual exam",
    sub: "Focus on practice + previous-year style questions",
  },
  {
    key: "fix_weak",
    label: "Fix weak topics",
    sub: "Tutor-led revision of tricky chapters",
  },
];

export default function OnboardingModal() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const [lang, setLang] = useState<"en" | "or" | "hi">("or");
  const [goal, setGoal] = useState<string>("stay_on_track");

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open !== true) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (open !== true) return null;

  function finish() {
    try {
      // 1 year cookie, root path so all pages get it.
      document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      localStorage.setItem(STORAGE_KEY, "1");
      localStorage.setItem("sikhya.onboard.goal", goal);
    } catch {
      /* ignore */
    }
    // Reload so server components pick up the new locale immediately.
    window.location.reload();
  }

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="onboard-title" className="text-lg font-semibold text-slate-900">
          {step === 0 ? "Welcome · ସ୍ୱାଗତ" : "What's your goal?"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {step === 0
            ? "Pick the language you'd like Sikhya Sathi to speak."
            : "We'll plan your daily lessons around this."}
        </p>

        {step === 0 && (
          <div className="mt-4 grid gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${
                  lang === l.code
                    ? "border-brand bg-brand/5 ring-2 ring-brand"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-900">{l.native}</span>
                <span className="text-xs text-slate-500">{l.en}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 grid gap-2">
            {GOALS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGoal(g.key)}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                  goal === g.key
                    ? "border-brand bg-brand/5 ring-2 ring-brand"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="font-medium text-slate-900">{g.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{g.sub}</div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Back
              </button>
            )}
            {step === 0 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Start learning
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
