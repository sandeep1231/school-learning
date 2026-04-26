"use client";

import { useState } from "react";

/**
 * Phase 15 — Settings > Danger zone.
 * Exposes the DPDP right-to-erasure endpoint and lets users re-open the
 * consent dialog.
 */
export default function SettingsClient({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function del() {
    if (
      !window.confirm(
        "This permanently deletes your account, progress, and payment records. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          errors?: string[];
        };
        setMsg(data.errors?.join("; ") ?? data.error ?? "Failed to delete");
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function resetConsent() {
    try {
      window.localStorage.removeItem("sikhya_consent");
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Account</h2>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-mono">{email ?? "guest"}</span>
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Your data</h2>
        <p className="mt-1 text-sm text-slate-600">
          Download a JSON copy of everything we store about your account.
          Includes profile, attempts, review cards, progress, and payment
          history.
        </p>
        <a
          href="/api/profile/export"
          className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Download my data
        </a>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Privacy</h2>
        <p className="mt-1 text-sm text-slate-600">
          Re-show the cookie and analytics consent banner to change your
          choice.
        </p>
        <button
          type="button"
          onClick={resetConsent}
          className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset consent
        </button>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Delete account</h2>
        <p className="mt-1 text-sm text-red-800">
          Permanently removes your profile, learning progress, attempts,
          review cards, and payment history. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={del}
          disabled={busy}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete my account"}
        </button>
        {msg && (
          <p role="alert" className="mt-2 text-xs text-red-900">
            {msg}
          </p>
        )}
      </section>
    </div>
  );
}
