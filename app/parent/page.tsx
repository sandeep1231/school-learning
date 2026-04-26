import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const supabase = await createClient();
  const t = await getTranslations("parent");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  // Children linked via family_members (RLS limits to this parent's family)
  const { data: children } = await supabase
    .from("family_members")
    .select(
      `profile:profiles!family_members_profile_id_fkey (
         id, full_name, preferred_language
       )`,
    )
    .eq("relation", "student");

  const childProfiles =
    (children ?? [])
      .map((r: any) => r.profile)
      .filter((p: any): p is { id: string; full_name: string | null } => !!p) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const { data: summaries } = await supabase
    .from("daily_summaries")
    .select("student_id, summary_date, parent_note, chat_count, quiz_avg_score")
    .in("student_id", childProfiles.map((c) => c.id))
    .gte("summary_date", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10))
    .order("summary_date", { ascending: false });

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">{t("heading")}</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("children")}</h2>
        {childProfiles.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            No children linked yet. Ask your child for their family invite code.
          </p>
        ) : (
          <ul className="space-y-2">
            {childProfiles.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 p-3 text-slate-800"
              >
                {c.full_name ?? "Student"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("todayNote")}</h2>
        {!summaries || summaries.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Summary will appear here every evening after 8pm IST.
          </p>
        ) : (
          <ul className="space-y-3">
            {summaries.map((s) => (
              <li
                key={`${s.student_id}-${s.summary_date}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="text-xs text-slate-500">
                  {s.summary_date}
                  {s.summary_date === today && " · today"}
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {s.parent_note ?? "(pending)"}
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Chats: {s.chat_count}
                  {s.quiz_avg_score != null && ` · Quiz avg: ${s.quiz_avg_score}%`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
