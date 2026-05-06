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
  isCurriculumSeeded,
  isCurriculumSeededAsync,
  formatBoardLabel,
  formatBoardClassLabel,
  DEFAULT_BOARD_SLUG,
} from "@/lib/curriculum/boards";
import { getCurrentUser } from "@/lib/auth/user";
import {
  getTopicAccuracyMap,
  getCompletedTopicIds,
} from "@/lib/progress.rollup";
import {
  ensureCurriculum,
  getSubjectByCode,
  listChaptersBySubject,
  listTopicsByChapter,
} from "@/lib/curriculum/db";
import { listDocumentChapters } from "@/lib/curriculum/documents";

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
  searchParams: Promise<{ chapter?: string; topic?: string }>;
}) {
  const { board, classNum, subject } = await params;
  const { chapter: chapterSlug, topic: topicSlug } = await searchParams;

  const boardCode = boardSlugToCode(board);
  const classLevel = Number.parseInt(classNum, 10);
  if (!boardCode || !Number.isFinite(classLevel)) notFound();
  if (!isClassSupported(boardCode, classLevel)) notFound();

  const code = subject.toUpperCase();
  const basePath = `/b/${board}/c/${classLevel}/s/${subject}`;
  const boardLabel = formatBoardLabel(boardCode);
  const contextLabel = formatBoardClassLabel(boardCode, classLevel);
  const seeded = isCurriculumSeeded(boardCode, classLevel);

  // -- DB-curated branch ---------------------------------------------------
  // For non-static-curriculum combinations (i.e. anything other than Class 9
  // BSE Odisha MTH/SSC which still lives in `bse-class9.ts`), check the DB
  // for chapters + topics seeded by `npm run seed:topics`. If present, give
  // the same chapter-cards-then-chat layout that Class 9 enjoys, with each
  // chapter linking through to the first topic.
  const subjectRow = await getSubjectByCode(code, boardCode, classLevel);
  // CURRICULUM is the static Class-9 BSE Odisha curated block (MTH/SSC). Only
  // those exact (class=9, code) combinations should bypass the DB branch —
  // matching by code alone wrongly excluded e.g. Class 7 SSC and Class 8 SSC,
  // which then fell through to the legacy doc-as-chapter fallback even though
  // their chapters/topics are seeded in the DB.
  const isStaticCurated =
    classLevel === 9 && !!CURRICULUM.find((s) => s.code === code);
  if (subjectRow && !isStaticCurated) {
    // `ensureCurriculum()` loads all subjects/chapters/topics in one batch
    // and caches them for 5 min. Per-chapter `listTopicsByChapter` calls
    // would just be Map lookups, but each one was an `await` on a microtask
    // — read the maps directly to skip ~10ms of overhead per chapter.
    const curriculum = await ensureCurriculum();
    const dbChapters = curriculum.chaptersBySubject.get(subjectRow.id) ?? [];
    const chaptersWithTopics: Array<{
      chapter: (typeof dbChapters)[number];
      topics: Awaited<ReturnType<typeof listTopicsByChapter>>;
    }> = dbChapters
      .map((chapter) => ({
        chapter,
        topics: curriculum.topicsByChapter.get(chapter.id) ?? [],
      }))
      .filter(({ topics }) => topics.length > 0);

    if (chaptersWithTopics.length > 0) {
      const subjectName = subjectRow.name.en;
      const subjectNameOr = subjectRow.name.or;

      // Resolve active chapter / topic from searchParams.
      const activeChapterEntry =
        chaptersWithTopics.find(
          ({ chapter }) => chapter.slug === chapterSlug,
        ) ?? null;
      const activeTopic = activeChapterEntry && topicSlug
        ? activeChapterEntry.topics.find((t) => t.slug === topicSlug) ?? null
        : null;

      const chapterHint = activeTopic
        ? [
            activeChapterEntry?.chapter.title.en,
            activeTopic.title.en,
            activeTopic.title.or,
          ]
            .filter(Boolean)
            .join(" / ")
        : activeChapterEntry
          ? [
              activeChapterEntry.chapter.title.en,
              activeChapterEntry.chapter.title.or,
            ]
              .filter(Boolean)
              .join(" / ")
          : undefined;

      const suggestions = activeTopic
        ? [
            `Summarise "${activeTopic.title.en}" in simple words`,
            `Give me 3 key points from this topic`,
            `Quiz me with 5 short questions on this topic`,
          ]
        : activeChapterEntry
          ? [
              `Summarise "${activeChapterEntry.chapter.title.en}" in simple words`,
              `List the key topics in this chapter`,
              `Quiz me with 5 short questions on this chapter`,
            ]
          : [
              `What are the main chapters in Class ${classLevel} ${subjectName}?`,
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
              {subjectNameOr ? (
                <h1 className="text-2xl font-bold text-brand-900">
                  {subjectNameOr}
                </h1>
              ) : (
                <h1 className="text-2xl font-bold text-brand-900">
                  {subjectName}
                </h1>
              )}
              <p className="text-sm text-slate-600">
                {subjectName} · {contextLabel}
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand">
              ଟ୍ୟୁଟର ସହ · Tutor-led
            </span>
          </header>

          {(activeChapterEntry || activeTopic) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand bg-brand-50 px-3 py-2 text-sm text-brand-900">
              {activeTopic ? (
                <>
                  <span className="font-semibold">Topic:</span>
                  <span>{activeTopic.title.en}</span>
                  {activeTopic.title.or && (
                    <span className="text-xs text-slate-600">
                      · {activeTopic.title.or}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold">Chapter:</span>
                  <span>{activeChapterEntry!.chapter.title.en}</span>
                  {activeChapterEntry!.chapter.title.or && (
                    <span className="text-xs text-slate-600">
                      · {activeChapterEntry!.chapter.title.or}
                    </span>
                  )}
                </>
              )}
              {activeTopic && activeChapterEntry && (
                <Link
                  href={`${basePath}/ch/${activeChapterEntry.chapter.slug}/t/${activeTopic.slug}`}
                  className="ml-2 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  Open Learn / Practice →
                </Link>
              )}
              <Link
                href={basePath}
                className="ml-auto text-xs text-brand underline"
              >
                Clear
              </Link>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex h-[70vh] min-h-[28rem] flex-col">
              <ChatBox
                key={activeTopic?.slug ?? activeChapterEntry?.chapter.slug ?? "all"}
                topicId={code}
                topicTitle={subjectName}
                endpoint="/api/chat/subject"
                payloadKey="subjectCode"
                payloadValue={code}
                extraPayload={{
                  boardCode,
                  classLevel,
                  ...(chapterHint ? { chapterHint } : {}),
                }}
                suggestions={suggestions}
                boardLabel={boardLabel}
              />
            </div>

            <aside
              className="rounded-xl border border-slate-200 bg-white p-3"
              aria-label={`Chapters in ${subjectName}`}
            >
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                ଅଧ୍ୟାୟ · Chapters
              </h2>
              <ol className="space-y-2" role="list">
                {chaptersWithTopics.map(({ chapter, topics }) => {
                  const chActive =
                    activeChapterEntry?.chapter.slug === chapter.slug;
                  return (
                    <li key={chapter.id}>
                      <Link
                        href={`${basePath}?chapter=${chapter.slug}`}
                        className={`block rounded-md px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                          chActive && !activeTopic
                            ? "bg-brand text-white"
                            : "text-slate-700 hover:bg-brand-50 hover:text-brand"
                        }`}
                        aria-current={
                          chActive && !activeTopic ? "true" : undefined
                        }
                      >
                        <span className="mr-1 text-xs opacity-70">
                          {chapter.order}.
                        </span>
                        {chapter.title.en}
                        {chapter.title.or && (
                          <span
                            className={`mt-0.5 block text-xs ${
                              chActive && !activeTopic
                                ? "text-white/80"
                                : "text-slate-500"
                            }`}
                          >
                            {chapter.title.or}
                          </span>
                        )}
                      </Link>
                      {chActive && topics.length > 0 && (
                        <ul
                          className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2"
                          role="list"
                        >
                          {topics.map((t) => {
                            const tActive = activeTopic?.slug === t.slug;
                            const topicHub = `${basePath}/ch/${chapter.slug}/t/${t.slug}`;
                            return (
                              <li key={t.id}>
                                <div
                                  className={`group flex items-stretch rounded transition ${
                                    tActive
                                      ? "bg-brand text-white"
                                      : "text-slate-600 hover:bg-brand-50"
                                  }`}
                                >
                                  <Link
                                    href={`${basePath}?chapter=${chapter.slug}&topic=${t.slug}`}
                                    className={`flex-1 rounded-l px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                                      tActive
                                        ? "text-white"
                                        : "hover:text-brand"
                                    }`}
                                    aria-current={tActive ? "true" : undefined}
                                    title="Ask the tutor about this topic"
                                  >
                                    <span className="mr-1 opacity-70">
                                      {t.order}.
                                    </span>
                                    {t.title.en}
                                  </Link>
                                  <Link
                                    href={topicHub}
                                    className={`flex items-center rounded-r px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                                      tActive
                                        ? "text-white hover:bg-brand-600"
                                        : "text-brand hover:bg-brand-100"
                                    }`}
                                    title="Open Learn / Practice for this topic"
                                    aria-label={`Open Learn and Practice for ${t.title.en}`}
                                  >
                                    Learn →
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </aside>
          </div>
        </main>
      );
    }
  }

  // -- LEGACY-BLOCK-REMOVED -- the DB-curated branch above renders the chat
  // layout for all classes that have chapters+topics seeded. For combos
  // with neither static curriculum nor DB topics, fall through to the
  // doc-chunks fallback and (eventually) the static-curated branch.

  // For non-seeded combinations (e.g. BSE Odisha Class 6/7/8 today) we have
  // textbook chunks ingested but no curated chapters/topics yet. We mirror
  // the Class-9 curated layout (chapter cards grid + subject-wide chat box)
  // and treat each ingested PDF as a chapter. No per-topic progress yet —
  // those slots are stubs until chapters/topics are properly seeded.
  if (!seeded) {
    const subjectRowFb =
      subjectRow ?? (await getSubjectByCode(code, boardCode, classLevel));
    const docChapters = subjectRowFb
      ? await listDocumentChapters(boardCode, classLevel, code)
      : [];
    const activeDoc = chapterSlug
      ? docChapters.find((d) => d.slug === chapterSlug) ?? null
      : null;
    const subjectName = subjectRowFb?.name.en ?? code;
    const subjectNameOr = subjectRowFb?.name.or ?? null;
    const docHint = activeDoc?.title;
    const suggestions = activeDoc
      ? [
          `Summarise "${activeDoc.title}" in simple words`,
          `Give me 3 key points from this chapter`,
          `Quiz me with 5 short questions on this chapter`,
        ]
      : [
          `What are the main chapters in Class ${classLevel} ${subjectName}?`,
          `Give me a quick revision outline`,
          `Explain one key concept with an example`,
        ];

    return (
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-2 text-sm">
          <Link href="/today" className="text-brand underline">
            ← Today
          </Link>
        </nav>
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            {subjectNameOr ? (
              <h1 className="text-2xl font-bold text-brand-900">
                {subjectNameOr}
              </h1>
            ) : (
              <h1 className="text-2xl font-bold text-brand-900">
                {subjectName}
              </h1>
            )}
            <p className="text-sm text-slate-600">
              {subjectName} · {contextLabel}
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand">
            ଟ୍ୟୁଟର ସହ · Tutor-led
          </span>
        </header>

        {docChapters.length === 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            Textbooks for {contextLabel} {subjectName} aren&apos;t ingested
            yet. The tutor will still try to help, but answers won&apos;t have
            textbook citations.
          </div>
        ) : (
          <section aria-label="Chapters" className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              ଅଧ୍ୟାୟ · Chapters
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2" role="list">
              {docChapters.map((d, i) => {
                const order = d.order !== Number.MAX_SAFE_INTEGER ? d.order : i + 1;
                const active = activeDoc?.slug === d.slug;
                return (
                  <li key={d.slug}>
                    <Link
                      href={`${basePath}?chapter=${encodeURIComponent(d.slug)}`}
                      aria-current={active ? "true" : undefined}
                      className={`block rounded-lg border bg-white p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                        active
                          ? "border-brand ring-1 ring-brand"
                          : "border-slate-200 hover:border-brand"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Chapter {order}
                          </div>
                          <div className="mt-0.5 truncate font-semibold text-slate-800">
                            {d.title}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                          {active ? "Active" : "Open"}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-slate-600">
                        {active
                          ? "Tutor scoped to this chapter ↓"
                          : "Tap to ask the tutor about this chapter"}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section
          aria-label="Ask anything"
          className="flex h-[60vh] min-h-[24rem] flex-col"
        >
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            ପ୍ରଶ୍ନ କରନ୍ତୁ · Ask the tutor
            {activeDoc ? (
              <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-xs font-medium text-white">
                {activeDoc.title}
              </span>
            ) : null}
          </h2>
          {activeDoc ? (
            <div className="mb-2 text-xs text-slate-500">
              Scoped to this chapter ·{" "}
              <Link href={basePath} className="text-brand underline">
                Clear
              </Link>
            </div>
          ) : null}
          <ChatBox
            key={activeDoc?.slug ?? "all"}
            topicId={code}
            topicTitle={subjectName}
            endpoint="/api/chat/subject"
            payloadKey="subjectCode"
            payloadValue={code}
            extraPayload={{
              boardCode,
              classLevel,
              ...(docHint ? { chapterHint: docHint } : {}),
            }}
            suggestions={suggestions}
            boardLabel={boardLabel}
          />
        </section>
      </main>
    );
  }

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
              {curated.name.en} · {contextLabel}
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
            extraPayload={{ boardCode, classLevel }}
            boardLabel={boardLabel}
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
        `What are the main chapters in Class ${classLevel} ${ragSubject.name.en}?`,
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
            extraPayload={{ boardCode, classLevel, ...(chapterHint ? { chapterHint } : {}) }}
            suggestions={suggestions}
            boardLabel={boardLabel}
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
