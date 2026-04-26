/**
 * Phase 13 — /admin/payments. Admin-only queue of submitted orders.
 * Admin pastes UTR into their bank statement, then clicks Approve/Reject.
 */
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentRow } from "./PaymentRow";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_orders")
    .select(
      "id, student_id, plan_code, amount_inr, reference_id, utr, status, created_at, expires_at, rejection_reason",
    )
    .in("status", ["submitted", "pending", "failed", "paid"])
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];

  // Hydrate student emails.
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: profiles } = studentIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", studentIds)
    : { data: [] };
  const profileById = new Map(
    (profiles ?? []).map((p: any) => [p.id, p as { id: string; email: string | null; full_name: string | null }]),
  );

  const submitted = rows.filter((r) => r.status === "submitted");
  const other = rows.filter((r) => r.status !== "submitted");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Admin" className="mb-4 flex gap-4 text-xs">
        <a
          href="/admin/payments"
          className="font-semibold text-brand-900 underline"
        >
          Payments
        </a>
        <a href="/admin/feedback" className="text-slate-600 hover:text-brand">
          Feedback
        </a>
      </nav>
      <h1 className="text-2xl font-semibold">Payments queue</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Verify UTRs against the merchant bank statement, then approve or reject.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Awaiting verification ({submitted.length})
        </h2>
        {submitted.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Queue empty. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {submitted.map((r) => (
              <PaymentRow
                key={r.id}
                order={{
                  id: r.id,
                  planCode: r.plan_code,
                  amountInr: r.amount_inr,
                  referenceId: r.reference_id,
                  utr: r.utr,
                  status: r.status,
                  createdAt: r.created_at,
                }}
                student={profileById.get(r.student_id) ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent ({other.length})
        </h2>
        <ul className="mt-4 space-y-2">
          {other.slice(0, 50).map((r) => {
            const p = profileById.get(r.student_id);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <div>
                  <span className="font-mono text-xs text-neutral-500">
                    {r.reference_id}
                  </span>{" "}
                  · {p?.email ?? r.student_id} · {r.plan_code} · ₹
                  {r.amount_inr}
                </div>
                <span
                  className={
                    r.status === "paid"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                      : r.status === "failed"
                        ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                        : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                  }
                >
                  {r.status}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
