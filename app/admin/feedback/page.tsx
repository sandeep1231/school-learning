/**
 * Phase 15 — /admin/feedback. Read-only queue of content_feedback rows.
 * Admins can triage reports of confusing/wrong AI-generated content.
 */
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string | null;
  topic_id: string | null;
  surface: string;
  ref_id: string | null;
  rating: number | null;
  category: string | null;
  comment: string | null;
  url: string | null;
  created_at: string;
};

export default async function AdminFeedbackPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("content_feedback")
    .select(
      "id, user_id, topic_id, surface, ref_id, rating, category, comment, url, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const rows: Row[] = data ?? [];

  // Hydrate reporter emails (best-effort).
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map<string, string | null>(
    (profiles ?? []).map((p: { id: string; email: string | null }) => [
      p.id,
      p.email,
    ]),
  );

  const byCategory = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.category ?? "uncategorised";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Admin" className="mb-4 flex gap-4 text-xs">
        <a href="/admin/payments" className="text-slate-600 hover:text-brand">
          Payments
        </a>
        <a
          href="/admin/feedback"
          className="font-semibold text-brand-900 underline"
        >
          Feedback
        </a>
      </nav>
      <h1 className="text-2xl font-semibold">Content feedback</h1>
      <p className="mt-1 text-sm text-slate-500">
        Newest {rows.length} reports. Use these to prioritise lesson/practice
        regeneration.
      </p>

      <section className="mt-6 flex flex-wrap gap-2 text-xs">
        {Object.entries(byCategory).map(([cat, n]) => (
          <span
            key={cat}
            className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
          >
            {cat}: {n}
          </span>
        ))}
      </section>

      <section className="mt-6 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No feedback yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Surface</th>
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Reporter</th>
                <th className="px-3 py-2">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-900">
                      {r.surface}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {r.topic_id ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {r.category ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {r.user_id
                      ? (emailById.get(r.user_id) ?? r.user_id.slice(0, 8))
                      : "anon"}
                  </td>
                  <td className="max-w-md px-3 py-2 text-slate-800">
                    {r.comment ?? "—"}
                    {r.url ? (
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {r.url}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
