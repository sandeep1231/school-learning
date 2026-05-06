import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ALL_TOPICS,
  BSE_MILESTONES,
  CURRICULUM,
  RAG_ONLY_SUBJECTS,
  nextMilestone,
} from "@/lib/curriculum/bse-class9";
import { progressPercent } from "@/lib/progress";
import { getCurrentUser } from "@/lib/auth/user";
import { getUserContext } from "@/lib/auth/context";
import {
  formatBoardClassLabel,
  formatBoardLabel,
  isCurriculumSeeded,
} from "@/lib/curriculum/boards";
import { getProgressForMany } from "@/lib/progress.server";
import {
  getStreakInfo,
  getWeakSpots,
  getTopMisconceptions,
  labelMisconception,
} from "@/lib/progress.rollup";
import WelcomeBanner from "./WelcomeBanner";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import TodayUnseeded from "./TodayUnseeded";

export const dynamic = "force-dynamic";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

// Every BSE Class 9 subject shown on the dashboard so learners always see
// the full pattern — curated (MTH, SSC) with topic-level progress and
// tutor-led (GSC, FLO, SLE, TLH) with chapter-level chat.
type CuratedEntry = {
  kind: "curated";
  code: string;
  name: { en: string; or: string; hi: string };
};
type TutorLedEntry = {
  kind: "tutor";
  code: string;
  name: { en: string; or: string; hi: string };
  chapterCount: number;
};
type SubjectEntry = CuratedEntry | TutorLedEntry;

const ALL_SUBJECTS: SubjectEntry[] = [
  ...CURRICULUM.map(
    (s): CuratedEntry => ({ kind: "curated", code: s.code, name: s.name }),
  ),
  ...RAG_ONLY_SUBJECTS.map(
    (s): TutorLedEntry => ({
      kind: "tutor",
      code: s.code,
      name: s.name,
      chapterCount: s.chapters.length,
    }),
  ),
];
const TUTOR_LED_COUNT = RAG_ONLY_SUBJECTS.length;

export default async function TodayPage() {
  // The four top-level fetches are independent — parallelize them so the
  // page is gated by max() not sum() of their latencies.
  const [t, user, ctx] = await Promise.all([
    getTranslations("today"),
    getCurrentUser(),
    getUserContext(),
  ]);
  const contextLabel = formatBoardClassLabel(ctx.boardCode, ctx.classLevel);
  const boardLabel = formatBoardLabel(ctx.boardCode);

  // Classes 6–8 (and any future board) have textbook chunks ingested but no
  // structured chapters/topics yet. Show a tutor-led fallback dashboard so
  // the learner still gets value while curriculum seeding catches up.
  if (!isCurriculumSeeded(ctx.boardCode, ctx.classLevel)) {
    return (
      <TodayUnseeded
        boardSlug={ctx.boardSlug}
        boardCode={ctx.boardCode}
        classLevel={ctx.classLevel}
        contextLabel={contextLabel}
        boardLabel={boardLabel}
        userEmail={user.isAuthenticated ? (user.email ?? user.fullName ?? null) : null}
      />
    );
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const milestone = nextMilestone(today);
  const daysLeft = milestone
    ? daysBetween(today, new Date(milestone.dueISO))
    : null;

  // Board-scoped URL helpers (Phase 1).
  const subjectPath = (code: string) =>
    `/b/${ctx.boardSlug}/c/${ctx.classLevel}/s/${code.toLowerCase()}`;
  const topicPath = (t: {
    subjectCode: string;
    chapterSlug: string;
    id: string;
  }) =>
    `/b/${ctx.boardSlug}/c/${ctx.classLevel}/s/${t.subjectCode.toLowerCase()}/ch/${t.chapterSlug}/t/${t.id}`;

  // All five reads below are independent and only need `user` — fan them
  // out in one Promise.all so the dashboard is gated by the slowest (~one
  // round-trip) instead of summed latency.
  const allTopicIds = ALL_TOPICS.map((tt) => tt.id);
  const [progressByTopic, streak, weakSpots, misconceptions, dueCount] =
    await Promise.all([
      getProgressForMany(user, allTopicIds),
      getStreakInfo(user),
      getWeakSpots(user, 3, 2),
      getTopMisconceptions(user, 3, 30),
      (async (): Promise<number> => {
        if (!user.isAuthenticated) return 0;
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { count } = await admin
          .from("srs_cards")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id)
          .lte("due_at", new Date().toISOString());
        return count ?? 0;
      })(),
    ]);
  const topicById = new Map(ALL_TOPICS.map((tt) => [tt.id, tt] as const));

  // Pick, for every curated subject, the next not-yet-completed topic.
  function nextPendingFor(subjectCode: string) {
    for (const topic of ALL_TOPICS) {
      if (topic.subjectCode !== subjectCode) continue;
      const p = progressByTopic.get(topic.id)!;
      if (progressPercent(p) < 100) return { topic, progress: p };
    }
    return null;
  }

  const doneCount = ALL_TOPICS.filter(
    (topic) => progressPercent(progressByTopic.get(topic.id)!) >= 100,
  ).length;

  // Global "next pending" across all curated subjects — drives the Focus hero.
  const globalPending = ALL_TOPICS.find(
    (topic) => progressPercent(progressByTopic.get(topic.id)!) < 100,
  );
  const firstTopic = ALL_TOPICS[0];

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">{t("heading")}</h1>
          <p className="text-slate-600">
            {todayISO} ·{" "}
            <span className="font-medium text-brand">
              {doneCount} of {ALL_TOPICS.length}
            </span>{" "}
            curated topics ·{" "}
            <span className="text-slate-500">
              + {TUTOR_LED_COUNT} subjects with lessons & practice
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
          {milestone && (
            <Link
              href="#milestones"
              className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {milestone.label}
              {daysLeft != null && daysLeft >= 0
                ? ` · ${daysLeft}d`
                : ""}
            </Link>
          )}
          {user.isAuthenticated ? (
            <span>
              Signed in as{" "}
              <span className="font-medium text-slate-700">
                {user.email ?? user.fullName ?? "student"}
              </span>
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

      {doneCount === 0 && firstTopic && (
        <WelcomeBanner
          firstTopicId={firstTopic.id}
          firstTopicTitleOr={firstTopic.title.or}
          firstTopicTitleEn={firstTopic.title.en}
        />
      )}
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
                {globalPending.title.or}
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
              const practiceHref = `/b/${ctx.boardSlug}/c/${ctx.classLevel}/s/${topic.subjectCode.toLowerCase()}/ch/${topic.chapterSlug}/t/${topic.id}/practice`;
              return (
                <li key={ws.topicId}>
                  <Link
                    href={practiceHref}
                    className="flex h-full flex-col justify-between gap-2 rounded-lg border border-rose-200 bg-white p-3 text-sm shadow-sm transition hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                  >
                    <div>
                      <div className="truncate font-semibold text-slate-800">
                        {topic.title.or}
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
          All {ALL_SUBJECTS.length} {contextLabel} subjects. Open any to learn or ask the tutor.
        </p>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {ALL_SUBJECTS.map((s) => {
            if (s.kind === "curated") {
              const pending = nextPendingFor(s.code);
              const subjectTopics = ALL_TOPICS.filter(
                (topic) => topic.subjectCode === s.code,
              );
              const subjectDone = subjectTopics.filter(
                (topic) =>
                  progressPercent(progressByTopic.get(topic.id)!) >= 100,
              ).length;
              const pct =
                subjectTopics.length > 0
                  ? Math.round((subjectDone / subjectTopics.length) * 100)
                  : 0;
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
                      {s.name.or}
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
                          {pending.topic.title.or}
                        </div>
                        <div className="text-xs text-slate-500">
                          {pending.topic.title.en}
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
                        href={topicPath(pending.topic)}
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
            }

            // Tutor-led subject card
            return (
              <article
                key={s.code}
                role="listitem"
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
                    <span>{s.code}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold normal-case text-brand">
                      ପାଠ + ଅଭ୍ୟାସ · Lessons + Practice
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-brand-900">
                    {s.name.or}
                  </h3>
                  <p className="text-xs text-slate-500">{s.name.en}</p>
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {s.chapterCount}
                  </span>{" "}
                  chapters · AI lessons, practice MCQs & tutor chat
                </div>

                <p className="mt-3 flex-1 text-sm text-slate-600">
                  Read the lesson, try the practice questions, or ask the tutor
                  — every answer cites the BSE {s.name.en} textbook.
                </p>

                <Link
                  href={subjectPath(s.code)}
                  className="mt-3 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Open subject →
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">
            ପୂରା ପାଠ୍ୟକ୍ରମ ଦେଖ · See full curriculum ({ALL_TOPICS.length} topics)
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ALL_TOPICS.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={topicPath(topic)}
                  className="block rounded-lg border border-slate-100 p-2 text-sm hover:border-brand hover:bg-brand-50"
                >
                  <span className="text-xs text-brand">{topic.subjectCode}</span>{" "}
                  <span className="font-medium">{topic.title.or}</span>
                  <span className="ml-1 text-xs text-slate-500">
                    ({topic.title.en})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="mt-8" id="milestones">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          ପରୀକ୍ଷା ସମୟସୂଚୀ · BSE 2025-26 assessments
        </h2>
        <ol className="space-y-2">
          {BSE_MILESTONES.map((m) => {
            const past = new Date(m.dueISO) < today;
            return (
              <li
                key={m.key}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  past
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-brand-50 bg-white"
                }`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="text-sm">{m.dueISO}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
