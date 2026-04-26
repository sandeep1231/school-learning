"use client";

import { useState } from "react";

/**
 * Phase 15 — compact feedback widget mountable on lesson & practice pages.
 * Posts to /api/feedback. Keeps state local; no analytics ping here
 * (we don't want to accidentally PII-leak comment text into PostHog).
 */
type Props = {
  surface: "lesson" | "practice";
  topicId?: string;
  refId?: string;
};

const CATEGORIES = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "confusing", label: "Confusing" },
  { value: "translation", label: "Translation issue" },
  { value: "typo", label: "Typo" },
  { value: "other", label: "Other" },
] as const;

export default function FeedbackWidget({ surface, topicId, refId }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["value"]>("confusing");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (comment.trim().length === 0) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          topicId,
          refId,
          category,
          comment: comment.slice(0, 2000),
          url:
            typeof window !== "undefined" ? window.location.pathname : null,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus("sent");
      setComment("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1600);
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <div className="mt-6 text-right">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-slate-500 underline hover:text-brand"
        >
          Report an issue with this {surface}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Content feedback"
      className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Report an issue
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
          aria-label="Close feedback form"
        >
          ×
        </button>
      </div>
      <label className="mt-3 block text-xs font-medium text-slate-700">
        Category
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as typeof category)
          }
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-700">
        What&rsquo;s wrong?
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 2000))}
          required
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          placeholder="Describe the issue in a sentence or two…"
        />
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {status === "sent"
            ? "Thanks — we'll review it."
            : status === "error"
              ? "Couldn't send. Try again."
              : `${comment.length}/2000`}
        </span>
        <button
          type="submit"
          disabled={status === "sending" || comment.trim().length === 0}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
