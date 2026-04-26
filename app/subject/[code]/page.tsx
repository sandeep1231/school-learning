import Link from "next/link";
import { notFound } from "next/navigation";
import ChatBox from "@/components/chat/ChatBox";
import {
  CURRICULUM,
  RAG_ONLY_SUBJECTS,
  findRagOnlySubject,
} from "@/lib/curriculum/bse-class9";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { code: rawCode } = await params;
  const { chapter: chapterSlug } = await searchParams;
  const code = rawCode.toUpperCase();

  // Curated subjects (MTH, SSC) keep the simple "ask anything" page — their
  // structured lessons live at /topic/[id].
  const curated = CURRICULUM.find((s) => s.code === code);
  if (curated) {
    return (
      <main className="container mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6">
        <header className="mb-4">
          <Link href="/today" className="text-sm text-brand underline">
            ← Today
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-brand-900">
            {curated.name.or}
          </h1>
          <p className="text-sm text-slate-600">
            {curated.name.en} · Ask anything from the BSE Odisha Class 9{" "}
            {curated.name.en} textbook. Answers are grounded with citations.
          </p>
        </header>
        <ChatBox
          topicId={curated.code}
          topicTitle={curated.name.en}
          endpoint="/api/chat/subject"
          payloadKey="subjectCode"
          payloadValue={curated.code}
        />
      </main>
    );
  }

  const ragSubject = findRagOnlySubject(code);
  if (!ragSubject) notFound();

  const activeChapter = chapterSlug
    ? ragSubject.chapters.find((c) => c.slug === chapterSlug)
    : null;

  const chapterHint = activeChapter
    ? [
        activeChapter.title.en,
        activeChapter.title.or,
        activeChapter.title.hi,
      ]
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
          <Link
            href={`/subject/${ragSubject.code}`}
            className="ml-auto text-xs text-brand underline"
          >
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
                    href={`/subject/${ragSubject.code}?chapter=${ch.slug}`}
                    className={`block rounded-md px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                      active
                        ? "bg-brand text-white"
                        : "text-slate-700 hover:bg-brand-50 hover:text-brand"
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="mr-1 text-xs opacity-70">
                      {ch.order}.
                    </span>
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
  return [
    ...CURRICULUM.map((s) => ({ code: s.code })),
    ...RAG_ONLY_SUBJECTS.map((s) => ({ code: s.code })),
  ];
}
