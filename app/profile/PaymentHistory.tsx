type PaymentRow = {
  id: string;
  plan_code: string;
  amount_inr: number | null;
  status: string;
  utr: string | null;
  reference_id: string | null;
  granted_until: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PaymentHistory({
  payments,
}: {
  payments: PaymentRow[];
}) {
  if (payments.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        No payments yet.
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Plan</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Valid until</th>
            <th className="py-2">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-4">{fmt(p.created_at)}</td>
              <td className="py-2 pr-4">{p.plan_code}</td>
              <td className="py-2 pr-4">
                {p.amount_inr !== null ? `₹${p.amount_inr}` : "—"}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    STATUS_STYLES[p.status] ??
                    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="py-2 pr-4">{fmt(p.granted_until)}</td>
              <td className="py-2 font-mono text-xs">
                {p.reference_id ?? p.utr ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
