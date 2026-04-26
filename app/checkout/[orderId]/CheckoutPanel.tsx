"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "submitted" | "paid" | "failed" | "expired";

export function CheckoutPanel({
  orderId,
  initialStatus,
  initialUtr,
  rejectionReason,
  expiresAt,
}: {
  orderId: string;
  initialStatus: Status;
  initialUtr: string | null;
  rejectionReason: string | null;
  expiresAt: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [utr, setUtr] = useState(initialUtr ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(rejectionReason);

  // Poll while awaiting admin verification.
  useEffect(() => {
    if (status !== "submitted") return;
    const h = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/order/${orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          status: Status;
          rejectionReason?: string | null;
        };
        if (body.status !== status) {
          setStatus(body.status);
          setReason(body.rejectionReason ?? null);
          if (body.status === "paid") router.refresh();
        }
      } catch {
        /* network flake — keep polling */
      }
    }, 8_000);
    return () => window.clearInterval(h);
  }, [orderId, status, router]);

  async function submitUtr(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/order/${orderId}/utr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ utr: utr.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http ${res.status}`);
      }
      setStatus("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "paid") {
    return (
      <section className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900">
        <h2 className="text-lg font-semibold">Payment verified 🎉</h2>
        <p className="mt-1 text-sm">
          Your plan is active. Welcome aboard — head back to the dashboard.
        </p>
        <a
          href="/today"
          className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Go to today
        </a>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
        <h2 className="text-lg font-semibold">Payment could not be verified</h2>
        <p className="mt-1 text-sm">{reason ?? "UTR did not match."}</p>
        <a
          href="/pricing"
          className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Start a new order
        </a>
      </section>
    );
  }

  if (status === "expired") {
    return (
      <section className="mt-6 rounded-xl border border-neutral-300 bg-neutral-50 p-6 text-neutral-800">
        <h2 className="text-lg font-semibold">This order expired</h2>
        <p className="mt-1 text-sm">
          Orders are valid for 30 minutes. Please start a new order.
        </p>
        <a
          href="/pricing"
          className="mt-4 inline-block rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Start a new order
        </a>
      </section>
    );
  }

  if (status === "submitted") {
    return (
      <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-lg font-semibold">Waiting for verification…</h2>
        <p className="mt-1 text-sm">
          UTR <span className="font-mono">{utr}</span> received. An admin will
          confirm shortly. This page will refresh automatically.
        </p>
      </section>
    );
  }

  // pending
  return (
    <form
      onSubmit={submitUtr}
      className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-lg font-semibold">Submit your UTR</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
        After paying, open your UPI app's transaction history and copy the
        12-digit UTR / reference number.
      </p>
      <label className="mt-4 block text-xs font-medium text-neutral-500">
        UTR
      </label>
      <input
        value={utr}
        onChange={(e) => setUtr(e.target.value)}
        placeholder="e.g. 412345678901"
        required
        minLength={8}
        maxLength={24}
        pattern="[A-Za-z0-9]{8,24}"
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit for verification"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-4 text-xs text-neutral-500">
        Order expires at {new Date(expiresAt).toLocaleString()}
      </p>
    </form>
  );
}
