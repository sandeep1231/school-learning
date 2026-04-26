"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentRow({
  order,
  student,
}: {
  order: {
    id: string;
    planCode: string;
    amountInr: number;
    referenceId: string;
    utr: string | null;
    status: string;
    createdAt: string;
  };
  student: { id: string; email: string | null; full_name: string | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/admin/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          action,
          reason: action === "reject" ? reason : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {student?.full_name ?? student?.email ?? order.referenceId}
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            {student?.email ?? "—"}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-neutral-500">Plan</dt>
            <dd>{order.planCode}</dd>
            <dt className="text-neutral-500">Amount</dt>
            <dd>₹{order.amountInr.toLocaleString("en-IN")}</dd>
            <dt className="text-neutral-500">Reference</dt>
            <dd className="font-mono">{order.referenceId}</dd>
            <dt className="text-neutral-500">UTR</dt>
            <dd className="font-mono">{order.utr ?? "—"}</dd>
            <dt className="text-neutral-500">Placed</dt>
            <dd>{new Date(order.createdAt).toLocaleString()}</dd>
          </dl>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Approve
          </button>
          <div className="flex items-center gap-1">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="reason (optional)"
              className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="button"
              onClick={() => act("reject")}
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </li>
  );
}
