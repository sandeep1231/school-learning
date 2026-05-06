/**
 * Phase 9.5 — Today's SRS-due review page.
 *
 * Lists all practice items whose SRS cards are due, grouped by topic, with
 * a "Review now" deep-link per topic. This is the GA-shippable version;
 * a unified flashcard-style session (one item at a time with an inline
 * Again/Good/Easy rating widget) lands post-launch.
 *
 * Guests see a CTA to sign in.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { getUserContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_TOPICS } from "@/lib/curriculum/bse-class9";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's review",
  description:
    "Spaced-repetition review — practice items due for revision today.",
  robots: { index: false, follow: false },
};

type DueRow = {
  item_id: string;
  due_at: string;
  interval_days: number;
  reps: number;
  lapses: number;
  practice_items: {
    id: string;
    topic_id: string | null;
  } | null;
};

export default async function ReviewPage() {
  const t = await getTranslations("review");
  const user = await getCurrentUser();
  const ctx = await getUserContext();

  if (!user.isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
          {t("guest.blurb")}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t("guest.cta")}
        </Link>
      </main>
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: dueRows } = await admin
    .from("srs_cards")
    .select(
      "item_id, due_at, interval_days, reps, lapses, practice_items(id, topic_id)",
    )
    .eq("student_id", user.id)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(100);

  const rows = (dueRows ?? []) as unknown as DueRow[];

  // Group by topic_id.
  type Group = {
    topicId: string;
    count: number;
    oldestDueAt: string;
    avgInterval: number;
    totalLapses: number;
  };
  const byTopic = new Map<string, Group>();
  for (const r of rows) {
    const tid = r.practice_items?.topic_id;
    if (!tid) continue;
    const g = byTopic.get(tid) ?? {
      topicId: tid,
      count: 0,
      oldestDueAt: r.due_at,
      avgInterval: 0,
      totalLapses: 0,
    };
    g.count++;
    if (r.due_at < g.oldestDueAt) g.oldestDueAt = r.due_at;
    g.avgInterval += r.interval_days;
    g.totalLapses += r.lapses;
    byTopic.set(tid, g);
  }
  const groups = [...byTopic.values()].map((g) => ({
    ...g,
    avgInterval: Math.round(g.avgInterval / Math.max(1, g.count)),
  }));

  // Hydrate topic slugs via the DB (ALL_TOPICS only covers curated subjects).
  const topicIds = groups.map((g) => g.topicId);
  const topicsByUuid = new Map<
    string,
    { slug: string | null; titleOr: string | null; titleEn: string | null; chapterSlug: string | null; subjectCode: string | null }
  >();
  if (topicIds.length > 0) {
    const { data: tRows } = await admin
      .from("topics")
      .select(
        "id, slug, title_en, title_or, chapter:chapters(slug, subject:subjects(code))",
      )
      .in("id", topicIds);
    for (const row of (tRows ?? []) as any[]) {
      topicsByUuid.set(row.id, {
        slug: row.slug,
        titleEn: row.title_en,
        titleOr: row.title_or,
        chapterSlug: row.chapter?.slug ?? null,
        subjectCode: row.chapter?.subject?.code ?? null,
      });
    }
  }

  // Fallback: use demo curriculum when DB row missing (e.g. dev env).
  function demoFallback(topicId: string) {
    const demo = ALL_TOPICS.find((x) => x.id === topicId);
    return demo
      ? {
          slug: demo.id,
          titleEn: demo.title.en,
          titleOr: demo.title.or,
          chapterSlug: demo.chapterSlug,
          subjectCode: demo.subjectCode,
        }
      : null;
  }

  const totalDue = rows.length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {totalDue === 0
          ? t("empty")
          : t("summary", { count: totalDue, topics: groups.length })}
      </p>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">{t("noCards")}</p>
          <Link
            href="/today"
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            {t("backToToday")}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {groups
            .sort((a, b) => b.count - a.count)
            .map((g) => {
              const meta =
                topicsByUuid.get(g.topicId) ?? demoFallback(g.topicId);
              if (!meta) return null;
              const href =
                meta.subjectCode && meta.chapterSlug && meta.slug
                  ? `/b/${ctx.boardSlug}/c/${ctx.classLevel}/s/${meta.subjectCode.toLowerCase()}/ch/${meta.chapterSlug}/t/${meta.slug}/practice`
                  : "/today";
              return (
                <li
                  key={g.topicId}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div>
                    <div className="font-medium">
                      {meta.titleOr ?? meta.titleEn ?? g.topicId}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {t("cardMeta", {
                        count: g.count,
                        interval: g.avgInterval,
                        lapses: g.totalLapses,
                      })}
                    </div>
                  </div>
                  <Link
                    href={href}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    {t("reviewNow")}
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </main>
  );
}
