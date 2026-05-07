import Link from "next/link";
import { ensureCurriculum } from "@/lib/curriculum/db";
import { getCurrentUser } from "@/lib/auth/user";
import { getProgressForMany } from "@/lib/progress.server";
import {
  getStreakInfo,
  getWeakSpots,
  getTopMisconceptions,
  labelMisconception,
} from "@/lib/progress.rollup";
import { progressPercent } from "@/lib/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import OnboardingModal from "@/components/onboarding/OnboardingModal";

/**
 * Structured dashboard for any board+class combination whose chapters and
 * topics are seeded in the DB. Mirrors the curated Class-9 `/today` layout
 * (header, streak/due chips, resume hero, weak-spots, misconception nudges,
 * subject grid with progress) but reads everything from the DB so the same
 * dashboard works for C6, C7, C8 — and any future board — without having to
 * hand-curate a static `bse-classN.ts` module per class.
 *
 * Falls back to a minimal "no chapters yet" empty state only when the DB
 * has nothing for the (board, class) combo — i.e. the seed script hasn't
 * run yet for that bucket.
 */
export default async function TodayUnseeded({
  boardSlug,
  boardCode,
  classLevel,
  contextLabel,
  boardLabel,
  userEmail,
}: {
  boardSlug: string;
  boardCode: string;
  classLevel: number;
  contextLabel: string;
  boardLabel: string;
  userEmail: string | null;
}) {
  // 1. Pull DB-backed subjects + topics for this (board, class).
  const curriculum = await ensureCurriculum();
  const classSubjects = curriculum.subjects
    .filter((s) => s.board === boardCode && s.classLevel === classLevel)
    .sort((a, b) => a.code.localeCompare(b.code));

  // Build the flat topic list (with chapter slug + subject code for URLs).
  type DashboardTopic = {
    id: string;
    slug: string;
    subjectCode: string;
    chapterSlug: string;
    chapterTitle: { en: string; or: string | null };
    title: { en: string; or: string | null };
  };
  const allTopics: DashboardTopic[] = [];
  const topicsBySubject = new Map<string, DashboardTopic[]>();
  for (const s of classSubjects) {
    const chapters = curriculum.chaptersBySubject.get(s.id) ?? [];
    const list: DashboardTopic[] = [];
    for (const ch of chapters) {
      const topics = curriculum.topicsByChapter.get(ch.id) ?? [];
      for (const t of topics) {
        list.push({
          id: t.id,
          slug: t.slug ?? t.id,
          subjectCode: s.code,
          chapterSlug: ch.slug ?? "",
          chapterTitle: { en: ch.title.en, or: ch.title.or },
          title: { en: t.title.en, or: t.title.or },
        });
      }
    }
    topicsBySubject.set(s.code, list);
    allTopics.push(...list);
  }

  // 2. Empty-state branch — no chapters/topics exist for this combo at all.
  if (allTopics.length === 0) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-brand-900">{contextLabel}</h1>
          <p className="text-slate-600">{classSubjects.length} subjects</p>
        </header>
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <h2 className="text-lg font-semibold text-amber-900">
            Curriculum being prepared
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            Textbook ingestion for {boardLabel} Class {classLevel} hasn&apos;t
            seeded chapters or topics yet. Once it does, this page will switch
            to the full dashboard with lessons, practice, and progress.
          </p>
        </section>
      </main>
    );
  }

  // 3. User-scoped reads (parallel) — same data the curated /today uses.
  const user = await getCurrentUser();
  const allTopicIds = allTopics.map((t) => t.id);
  const [progressByTopic, streak, weakSpots, misconceptions, dueCount] =
    await Promise.all([
      getProgressForMany(user, allTopicIds),
      getStreakInfo(user),
      getWeakSpots(user, 3, 2),
      getTopMisconceptions(user, 3, 30),
      (async (): Promise<number> => {
        if (!user.isAuthenticated) return 0;
        const admin = createAdminClient();
        const { count } = await admin
          .from("srs_cards")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id)
          .lte("due_at", new Date().toISOString());
        return count ?? 0;
      })(),
    ]);
  const topicById = new Map(allTopics.map((t) => [t.id, t] as const));

  const todayISO = new Date().toISOString().slice(0, 10);
  const subjectPath = (code: string) =>
    `/b/${boardSlug}/c/${classLevel}/s/${code.toLowerCase()}`;
  const topicPath = (t: DashboardTopic) =>
    `/b/${boardSlug}/c/${classLevel}/s/${t.subjectCode.toLowerCase()}/ch/${t.chapterSlug}/t/${t.slug}`;

  function nextPendingFor(subjectCode: string) {
    const list = topicsBySubject.get(subjectCode) ?? [];
    for (const topic of list) {
      const p = progressByTopic.get(topic.id);
      if (!p || progressPercent(p) < 100) return topic;
    }
    return null;
  }

  const doneCount = allTopics.filter(
    (topic) => progressPercent(progressByTopic.get(topic.id)!) >= 100,
  ).length;
  const globalPending = allTopics.find(
    (topic) => progressPercent(progressByTopic.get(topic.id)!) < 100,
  );

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">{contextLabel}</h1>
          <p className="text-slate-600">
            {todayISO} ·{" "}
            <span className="font-medium text-brand">
              {doneCount} of {allTopics.length}
            </span>{" "}
            topics ·{" "}
            <span className="text-slate-500">
              {classSubjects.length} subjects
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
          {user.isAuthenticated && streak.current > 0 && (
            <span
              aria-label={`${streak.current}-day streak`}
              title={`Longest: ${streak.longest} day${streak.longest === 1 ? "" : "s"}`}
              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
            >
              🔥 {streak.current}-day streak
            </span>
          )}
          {dueCount > 0 && (
            <Link
              href="/review"
              className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-900 hover:bg-indigo-200"
            >
              📚 {dueCount} due for review
            </Link>
          )}
          {userEmail ? (
            <span>
              Signed in as{" "}
              <span className="font-medium text-slate-700">{userEmail}</span>
            </span>
          ) : (
            <span>
              Browsing as guest ·{" "}
              <Link href="/auth/sign-in" className="text-brand underline">
                Save progress
              </Link>
            </span>
          )}
        </div>
      </header>

      <OnboardingModal />

      {globalPending && (
        <section
          aria-label="Resume learning"
          className="mb-6 rounded-xl border border-brand bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                ପରବର୍ତ୍ତୀ ପାଠ · Resume where you left off
              </div>
              <h2 className="mt-1 truncate text-xl font-bold text-brand-900">
                {globalPending.title.or ?? globalPending.title.en}
              </h2>
              <p className="truncate text-sm text-slate-600">
                {globalPending.subjectCode} · {globalPending.title.en}
              </p>
            </div>
            <Link
              href={topicPath(globalPending)}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {doneCount === 0 ? "Start →" : "Continue →"}
            </Link>
          </div>
        </section>
      )}

      {weakSpots.length > 0 && (
        <section
          aria-labelledby="weak-spots-heading"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50/60 p-5"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2
              id="weak-spots-heading"
              className="text-lg font-semibold text-rose-900"
            >
              🎯 Weak spots · ଦୁର୍ବଳ ବିଷୟ
            </h2>
            <span className="text-xs text-rose-800/70">
              Topics below 70% accuracy — practise these first.
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3" role="list">
            {weakSpots.map((ws) => {
              const topic = topicById.get(ws.topicId);
              if (!topic) return null;
              const practiceHref = `${topicPath(topic)}/practice`;
              return (
                <li key={ws.topicId}>
                  <Link
                    href={practiceHref}
                    className="flex h-full flex-col justify-between gap-2 rounded-lg border border-rose-200 bg-white p-3 text-sm shadow-sm transition hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                  >
                    <div>
                      <div className="truncate font-semibold text-slate-800">
                        {topic.title.or ?? topic.title.en}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {topic.subjectCode} · {topic.title.en}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        {Math.round(ws.accuracy * 100)}% · {ws.attemptsCount} tries
                      </span>
                      <span className="text-xs font-semibold text-rose-700">
                        Practise →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {misconceptions.length > 0 && (
        <section
          aria-labelledby="misconceptions-heading"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-5"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2
              id="misconceptions-heading"
              className="text-lg font-semibold text-amber-900"
            >
              💡 Common slip-ups
            </h2>
            <span className="text-xs text-amber-800/70">
              Patterns we spotted in your recent wrong answers.
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3" role="list">
            {misconceptions.map((m) => (
              <li
                key={m.tag}
                className="rounded-lg border border-amber-200 bg-white p-3 text-sm shadow-sm"
              >
                <div className="font-medium text-slate-800">
                  {labelMisconception(m.tag, "en")}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {labelMisconception(m.tag, "or")}
                </div>
                <div className="mt-2 text-xs font-semibold text-amber-800">
                  {m.count} recent {m.count === 1 ? "slip" : "slips"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-800">
          ବିଷୟ · Your subjects
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          All {classSubjects.length} {contextLabel} subjects. Open any to
          continue or ask the tutor.
        </p>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {classSubjects.map((s) => {
            const subjectTopics = topicsBySubject.get(s.code) ?? [];
            const subjectDone = subjectTopics.filter(
              (topic) =>
                progressPercent(progressByTopic.get(topic.id)!) >= 100,
            ).length;
            const pct =
              subjectTopics.length > 0
                ? Math.round((subjectDone / subjectTopics.length) * 100)
                : 0;
            const pending = nextPendingFor(s.code);
            return (
              <article
                key={s.code}
                role="listitem"
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand">
                    {s.code}
                  </div>
                  <h3 className="mt-1 text-base font-bold text-brand-900">
                    {s.name.or ?? s.name.en}
                  </h3>
                  <p className="text-xs text-slate-500">{s.name.en}</p>
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {subjectDone}
                  </span>
                  /{subjectTopics.length} topics ·{" "}
                  <span className="text-slate-500">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-3 flex-1">
                  {pending ? (
                    <div className="rounded-lg bg-brand-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-brand">
                        Up next
                      </div>
                      <div className="text-sm font-medium text-slate-800">
                        {pending.title.or ?? pending.title.en}
                      </div>
                      <div className="text-xs text-slate-500">
                        {pending.title.en}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
                      ✓ All topics complete
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  {pending ? (
                    <Link
                      href={topicPath(pending)}
                      className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      Continue →
                    </Link>
                  ) : (
                    <Link
                      href={subjectPath(s.code)}
                      className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      Review →
                    </Link>
                  )}
                  <Link
                    href={subjectPath(s.code)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    aria-label={`Ask tutor about ${s.name.en}`}
                  >
                    Ask
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">
            ପୂରା ପାଠ୍ୟକ୍ରମ ଦେଖ · See full curriculum ({allTopics.length} topics)
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {allTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={topicPath(topic)}
                  className="block rounded-lg border border-slate-100 p-2 text-sm hover:border-brand hover:bg-brand-50"
                >
                  <span className="text-xs text-brand">{topic.subjectCode}</span>{" "}
                  <span className="font-medium">{topic.title.or ?? topic.title.en}</span>
                  <span className="ml-1 text-xs text-slate-500">
                    ({topic.title.en})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
