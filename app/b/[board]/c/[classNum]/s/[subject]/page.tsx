import Link from "next/link";
import { notFound } from "next/navigation";
import ChatBox from "@/components/chat/ChatBox";
import {
  RAG_ONLY_SUBJECTS,
  findRagOnlySubject,
  CURRICULUM,
} from "@/lib/curriculum/bse-class9";
import {
  boardSlugToCode,
  isClassSupported,
  DEFAULT_BOARD_SLUG,
} from "@/lib/curriculum/boards";
import { getCurrentUser } from "@/lib/auth/user";
import {
  getTopicAccuracyMap,
  getCompletedTopicIds,
} from "@/lib/progress.rollup";
import { ensureCurriculum } from "@/lib/curriculum/db";

// Phase 1 URL hierarchy: /b/:board/c/:classNum/s/:subject (?chapter=:slug)
//
// Reads board/class from the URL so the same code serves every board the
// platform eventually supports. Content is still sourced from the in-code
// curriculum (bse-class9.ts) — Phase 0.4+ migrates it to `lib/curriculum/db.ts`.

export const dynamic = "force-dynamic";

type Params = { board: string; classNum: string; subject: string };

export default async function BoardSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { board, classNum, subject } = await params;
  const { chapter: chapterSlug } = await searchParams;

  const boardCode = boardSlugToCode(board);
  const classLevel = Number.parseInt(classNum, 10);
  if (!boardCode || !Number.isFinite(classLevel)) notFound();
  if (!isClassSupported(boardCode, classLevel)) notFound();

  const code = subject.toUpperCase();
  const basePath = `/b/${board}/c/${classLevel}/s/${subject}`;

  // Curated subjects (MTH, SSC) → chapter cards with progress + accuracy,
  // plus a subject-wide chat box. Structured lessons live under
  // ch/:chapter/t/:topic.
  const curated = CURRICULUM.find((s) => s.code === code);
  if (curated) {
    // Resolve curriculum topic slugs → DB UUIDs so we can look up accuracy
    // / completion which are keyed by UUID.
    const cacheCur = await ensureCurriculum();
    const slugToUuid = new Map<string, string>();
    for (const ch of curated.chapters) {
      for (const t of ch.topics) {
        const dbTopic = cacheCur.topicBySlug.get(t.id);
        if (dbTopic) slugToUuid.set(t.id, dbTopic.id);
      }
    }
    const uuids = [...slugToUuid.values()];

    const user = await getCurrentUser();
    const [accuracyByUuid, doneUuids] = await Promise.all([
      getTopicAccuracyMap(user, uuids),
      getCompletedTopicIds(user),
    ]);

    return (
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-2 text-sm">
          <Link href="/today" className="text-brand underline">
            ← Today
          </Link>
        </nav>
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-brand-900">
              {curated.name.or}
            </h1>
            <p className="text-sm text-slate-600">
              {curated.name.en} · BSE Odisha Class {classLevel}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Structured lessons
          </span>
        </header>

        <section aria-label="Chapters" className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            ଅଧ୍ୟାୟ · Chapters
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2" role="list">
            {curated.chapters.map((ch) => {
              const total = ch.topics.length;
              let done = 0;
              let accSum = 0;
              let accCount = 0;
              let attempts = 0;
              for (const t of ch.topics) {
                const uuid = slugToUuid.get(t.id);
                if (!uuid) continue;
                if (doneUuids.has(uuid)) done++;
                const a = accuracyByUuid.get(uuid);
                if (a) {
                  accSum += a.accuracy;
                  accCount++;
                  attempts += a.attemptsCount;
                }
              }
              const accPct =
                accCount > 0 ? Math.round((accSum / accCount) * 100) : null;
              const firstTopic = ch.topics[0];
              const chapterHref = firstTopic
                ? `${basePath}/ch/${ch.slug}/t/${firstTopic.id}`
                : basePath;
              return (
                <li key={ch.slug}>
                  <Link
                    href={chapterHref}
                    className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Chapter {ch.order}
                        </div>
                        <div className="mt-0.5 truncate font-semibold text-slate-800">
                          {ch.title.or}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {ch.title.en}
                        </div>
                      </div>
                      {accPct !== null && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            accPct >= 70
                              ? "bg-emerald-100 text-emerald-800"
                              : accPct >= 40
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                          title={`${attempts} attempt${attempts === 1 ? "" : "s"}`}
                        >
                          {accPct}%
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        <span className="font-semibold text-brand">{done}</span>
                        <span className="text-slate-400">/{total}</span>{" "}
                        topics done
                      </span>
                      <span className="text-slate-400">
                        {accCount > 0
                          ? `${attempts} practice ${attempts === 1 ? "try" : "tries"}`
                          : "No practice yet"}
                      </span>
                    </div>
                    {/* thin progress bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-brand"
                        style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Ask anything" className="flex h-[60vh] min-h-[24rem] flex-col">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            ପ୍ରଶ୍ନ କରନ୍ତୁ · Ask the tutor
          </h2>
          <ChatBox
            topicId={curated.code}
            topicTitle={curated.name.en}
            endpoint="/api/chat/subject"
            payloadKey="subjectCode"
            payloadValue={curated.code}
          />
        </section>
      </main>
    );
  }

  const ragSubject = findRagOnlySubject(code);
  if (!ragSubject) notFound();

  const activeChapter = chapterSlug
    ? ragSubject.chapters.find((c) => c.slug === chapterSlug)
    : null;

  const chapterHint = activeChapter
    ? [activeChapter.title.en, activeChapter.title.or, activeChapter.title.hi]
        .filter(Boolean)
        .join(" / ")
    : undefined;

  const suggestions = activeChapter
    ? [
        `Summarise "${activeChapter.title.en}" in simple words`,
        `Give me 3 key points from this chapter`,
        `Quiz me with 5 short questions on this chapter`,
      ]
    : [
        `What are the main chapters in Class 9 ${ragSubject.name.en}?`,
        `Give me a quick revision outline`,
        `Explain one key concept with an example`,
      ];

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-2 text-sm">
        <Link
          href="/today"
          className="rounded text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          ← Today
        </Link>
      </nav>

      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">
            {ragSubject.name.or}
          </h1>
          <p className="text-sm text-slate-600">
            {ragSubject.name.en} ·{" "}
            <span className="text-slate-500">
              {ragSubject.books.join(" · ")}
            </span>
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand">
          ଟ୍ୟୁଟର ସହ · Tutor-led
        </span>
      </header>

      {activeChapter && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <span className="font-semibold">Chapter:</span>
          <span>{activeChapter.title.en}</span>
          {activeChapter.title.or && (
            <span className="text-xs text-slate-600">
              · {activeChapter.title.or}
            </span>
          )}
          <Link href={basePath} className="ml-auto text-xs text-brand underline">
            Clear
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex h-[70vh] min-h-[28rem] flex-col">
          <ChatBox
            key={activeChapter?.slug ?? "all"}
            topicId={ragSubject.code}
            topicTitle={ragSubject.name.en}
            endpoint="/api/chat/subject"
            payloadKey="subjectCode"
            payloadValue={ragSubject.code}
            extraPayload={chapterHint ? { chapterHint } : undefined}
            suggestions={suggestions}
          />
        </div>

        <aside
          className="rounded-xl border border-slate-200 bg-white p-3"
          aria-label={`Chapters in ${ragSubject.name.en}`}
        >
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ଅଧ୍ୟାୟ · Chapters
          </h2>
          <ol className="space-y-1" role="list">
            {ragSubject.chapters.map((ch) => {
              const active = activeChapter?.slug === ch.slug;
              return (
                <li key={ch.slug}>
                  <Link
                    href={`${basePath}?chapter=${ch.slug}`}
                    className={`block rounded-md px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                      active
                        ? "bg-brand text-white"
                        : "text-slate-700 hover:bg-brand-50 hover:text-brand"
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="mr-1 text-xs opacity-70">{ch.order}.</span>
                    {ch.title.en}
                    {ch.title.or && (
                      <span
                        className={`mt-0.5 block text-xs ${
                          active ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {ch.title.or}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </main>
  );
}

export function generateStaticParams() {
  const out: Array<Params> = [];
  for (const s of CURRICULUM) {
    out.push({
      board: DEFAULT_BOARD_SLUG,
      classNum: "9",
      subject: s.code.toLowerCase(),
    });
  }
  for (const s of RAG_ONLY_SUBJECTS) {
    out.push({
      board: DEFAULT_BOARD_SLUG,
      classNum: "9",
      subject: s.code.toLowerCase(),
    });
  }
  return out;
}
