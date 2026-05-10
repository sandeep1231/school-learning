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
import { ensureCurriculum } from "@/lib/curriculum/db";
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

  // Pull DB curriculum so tutor-led subjects (GSC, FLO, SLE, TLH) get the
  // same Continue + Ask treatment as the curated MTH/SSC subjects. Without
  // this, the dashboard shows two visually-different card variants — which
  // confuses students because every subject actually has lessons + practice
  // + master available now.
  type TutorLedTopic = {
    id: string;
    slug: string;
    chapterSlug: string;
    title: { en: string; or: string | null };
  };
  const tutorLedTopicsBySubject = new Map<string, TutorLedTopic[]>();
  try {
    const curriculum = await ensureCurriculum();
    for (const ragSub of RAG_ONLY_SUBJECTS) {
      const dbSub = curriculum.subjects.find(
        (s) =>
          s.code === ragSub.code &&
          s.board === ctx.boardCode &&
          s.classLevel === ctx.classLevel,
      );
      if (!dbSub) continue;
      const chapters = curriculum.chaptersBySubject.get(dbSub.id) ?? [];
      const list: TutorLedTopic[] = [];
      for (const ch of chapters) {
        const topics = curriculum.topicsByChapter.get(ch.id) ?? [];
        for (const t of topics) {
          list.push({
            id: t.id,
            slug: t.slug ?? t.id,
            chapterSlug: ch.slug ?? "",
            title: { en: t.title.en, or: t.title.or },
          });
        }
      }
      if (list.length > 0) tutorLedTopicsBySubject.set(ragSub.code, list);
    }
  } catch {
    // DB curriculum miss is non-fatal — tutor-led cards fall back to the
    // generic "Open subject" CTA below.
  }

  // All reads below are independent and only need `user` — fan them out in
  // one Promise.all so the dashboard is gated by the slowest (~one round-
  // trip) instead of summed latency.
  const tutorLedTopicIds = Array.from(tutorLedTopicsBySubject.values())
    .flat()
    .map((t) => t.id);
  const allTopicIds = [
    ...ALL_TOPICS.map((tt) => tt.id),
    ...tutorLedTopicIds,
  ];
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

  // Per-tutor-led-subject "next pending" topic (first incomplete in DB
  // order). Returns null if the user has finished every topic in the
  // subject — caller falls back to the "All topics complete" state, same
  // as curated subjects.
  function nextPendingTutorLed(subjectCode: string): TutorLedTopic | null {
    const list = tutorLedTopicsBySubject.get(subjectCode) ?? [];
    for (const t of list) {
      const p = progressByTopic.get(t.id);
      if (!p || progressPercent(p) < 100) return t;
    }
    return list.length > 0 ? null : null;
  }
  function tutorLedDoneCount(subjectCode: string): {
    done: number;
    total: number;
  } {
    const list = tutorLedTopicsBySubject.get(subjectCode) ?? [];
    let done = 0;
    for (const t of list) {
      const p = progressByTopic.get(t.id);
      if (p && progressPercent(p) >= 100) done += 1;
    }
    return { done, total: list.length };
  }

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
              // Same pattern as subject cards: pass chapter only, let the
              // subject hub be a clean topic-selection page rather than
              // auto-selecting a topic for the student.
              href={`${subjectPath(globalPending.subjectCode)}?chapter=${globalPending.chapterSlug}`}
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
                    {/*
                      Continue always opens the subject hub (topic-selection
                      page) so the journey is uniform: Today → subject hub
                      (pick a topic) → topic hub (Learn / Ask / Practice /
                      Master). When there's a next-pending topic we pre-
                      select its chapter+topic via query params so the user
                      lands with their progress already highlighted in the
                      sidebar — no "where was I?" guesswork.

                      Button label rules (shared with tutor-led card below):
                        - has pending && 0 done   → "Start →"
                        - has pending && some done→ "Continue →"
                        - no pending (all done)   → "Review →"
                    */}
                    {pending ? (
                      <Link
                        // Only pass `?chapter=X` (no `&topic=Y`). The subject
                        // hub then expands the right chapter in the sidebar
                        // but doesn't auto-select a specific topic — the
                        // student picks one explicitly. Including the topic
                        // param made the suggestions / notification scope
                        // tighten to that one topic, which read like the
                        // page had already chosen the topic for them.
                        href={`${subjectPath(s.code)}?chapter=${pending.topic.chapterSlug}`}
                        className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      >
                        {subjectDone > 0 ? "Continue →" : "Start →"}
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

            // Tutor-led subject card — mirrors the curated layout so every
            // subject reads as a first-class card (Continue + Ask), not a
            // second-tier "browse the chapters" stub.
            const pendingTl = nextPendingTutorLed(s.code);
            const tlCounts = tutorLedDoneCount(s.code);
            const tlPct =
              tlCounts.total > 0
                ? Math.round((tlCounts.done / tlCounts.total) * 100)
                : 0;
            // Continue always lands on the subject hub (topic-selection
            // page) with the next-pending chapter pre-expanded. We
            // intentionally don't include `&topic=` because including it
            // makes the subject hub auto-scope chat + the top notification
            // to that specific topic — which reads like the page chose
            // for the student. Letting them click a topic from the
            // sidebar is the cleaner UX.
            const tlContinueHref = pendingTl
              ? `${subjectPath(s.code)}?chapter=${pendingTl.chapterSlug}`
              : subjectPath(s.code);
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
                  {tlCounts.total > 0 ? (
                    <>
                      <span className="font-semibold text-slate-800">
                        {tlCounts.done}
                      </span>
                      /{tlCounts.total} topics ·{" "}
                      <span className="text-slate-500">{tlPct}%</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-800">
                        {s.chapterCount}
                      </span>{" "}
                      chapters
                    </>
                  )}
                </div>
                {tlCounts.total > 0 && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${tlPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                )}

                <div className="mt-3 flex-1">
                  {pendingTl ? (
                    <div className="rounded-lg bg-brand-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-brand">
                        Up next
                      </div>
                      <div className="text-sm font-medium text-slate-800">
                        {pendingTl.title.or ?? pendingTl.title.en}
                      </div>
                      <div className="text-xs text-slate-500">
                        {pendingTl.title.en}
                      </div>
                    </div>
                  ) : tlCounts.total > 0 ? (
                    <div className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
                      ✓ All topics complete
                    </div>
                  ) : (
                    <div className="rounded-lg bg-brand-50 p-2 text-xs text-slate-600">
                      AI lessons, practice MCQs & tutor chat for every chapter.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={tlContinueHref}
                    className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {/* Same button-label rules as the curated card above:
                        Start (0 done) / Continue (some done) / Review (all done). */}
                    {pendingTl
                      ? tlCounts.done > 0
                        ? "Continue →"
                        : "Start →"
                      : tlCounts.total > 0
                        ? "Review →"
                        : "Open subject →"}
                  </Link>
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
