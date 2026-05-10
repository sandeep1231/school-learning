"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const MIN_LEN = 5;
const MAX_LEN = 2000;

export default function ContactForm() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < MIN_LEN) {
      setStatus({
        kind: "error",
        message: `Please write at least ${MIN_LEN} characters.`,
      });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message.trim().slice(0, MAX_LEN),
          contact: contact.trim() || undefined,
          currentUrl:
            typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({
          kind: "error",
          message: j.error ?? `Request failed (${res.status}).`,
        });
        return;
      }
      setStatus({ kind: "ok" });
      setMessage("");
      setContact("");
    } catch (e) {
      setStatus({
        kind: "error",
        message: `Network error: ${(e as Error).message}`,
      });
    }
  }

  if (status.kind === "ok") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">
          Got it — thank you.
        </h2>
        <p className="mt-1 text-sm text-emerald-900/80">
          Your message reached us. We&apos;ll get back within a working day if
          you left contact details.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-4 text-sm text-brand underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="msg"
          className="block text-sm font-semibold text-slate-800"
        >
          Your message
          <span className="text-rose-500" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="msg"
          required
          minLength={MIN_LEN}
          maxLength={MAX_LEN}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={submitting}
          placeholder="Describe what's happening — the more specific, the faster we can help."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-xs text-slate-500">
          {message.length}/{MAX_LEN}
        </p>
      </div>
      <div>
        <label
          htmlFor="contact"
          className="block text-sm font-semibold text-slate-800"
        >
          Email or phone (optional)
        </label>
        <input
          id="contact"
          type="text"
          maxLength={200}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          disabled={submitting}
          placeholder="So we can reply. Skip if you'd rather stay anonymous."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      {status.kind === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
        >
          {status.message}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || message.trim().length < MIN_LEN}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting && <Spinner size="sm" />}
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
