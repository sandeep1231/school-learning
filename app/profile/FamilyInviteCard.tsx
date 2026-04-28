"use client";

import { useEffect, useState } from "react";

/**
 * Student-only widget. Fetches the family invite code from
 * /api/family/code (creates one on first GET) and shows it with a
 * one-click copy button.
 */
export default function FamilyInviteCard() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/family/code");
        const data = (await res.json()) as {
          inviteCode?: string;
          error?: string;
        };
        if (!res.ok || !data.inviteCode) {
          setError(data.error ?? "Could not load invite code.");
        } else {
          setCode(data.inviteCode);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      aria-labelledby="invite-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="invite-heading"
        className="text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        Family invite code
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Share this code with a parent. They&rsquo;ll enter it on their
        dashboard to see your daily progress and notes.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {loading ? (
          <span className="text-sm text-slate-400">Loading…</span>
        ) : error ? (
          <span className="text-sm text-red-600">{error}</span>
        ) : (
          <>
            <code className="rounded bg-slate-100 px-3 py-1.5 font-mono text-base font-semibold tracking-widest text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {code}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
