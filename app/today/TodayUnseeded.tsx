import Link from "next/link";
import { listSubjects } from "@/lib/curriculum/db";
import { countDocumentsBySubject } from "@/lib/curriculum/documents";

/**
 * Dashboard shown for board+class combinations whose chapters/topics aren't
 * curated yet. Mirrors the Class-9 today-page subject grid (cards with
 * counts + open CTA) but uses ingested-document counts in place of topics.
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
  const subjects = await listSubjects(boardCode, classLevel);
  const docCounts = await countDocumentsBySubject(subjects.map((s) => s.id));
  const totalChapters = [...docCounts.values()].reduce((a, b) => a + b, 0);
  const subjectPath = (code: string) =>
    `/b/${boardSlug}/c/${classLevel}/s/${code.toLowerCase()}`;
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">{contextLabel}</h1>
          <p className="text-slate-600">
            <span className="font-medium text-brand">{subjects.length}</span>{" "}
            subjects ·{" "}
            <span className="font-medium text-brand">{totalChapters}</span>{" "}
            chapters ingested ·{" "}
            <span className="text-slate-500">tutor-led</span>
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {userEmail ? (
            <>
              Signed in as{" "}
              <span className="font-medium text-slate-700">{userEmail}</span>
            </>
          ) : (
            <>
              Browsing as guest ·{" "}
              <Link href="/auth/sign-in" className="text-brand underline">
                Save progress
              </Link>
            </>
          )}
        </div>
      </header>

      <section
        aria-label="Curriculum status"
        className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-5"
      >
        <h2 className="text-lg font-semibold text-amber-900">
          Curriculum being prepared
        </h2>
        <p className="mt-1 text-sm text-amber-900/80">
          We&apos;ve ingested the official {boardLabel} Class {classLevel}{" "}
          textbooks end-to-end, so the AI tutor can already answer questions
          grounded in the official content with citations. Tap any subject
          below to see its chapters. Day-by-day lessons, practice sets, and
          spaced-repetition cards arrive once our chapter map for Class{" "}
          {classLevel} is finalised.
        </p>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-800">
          ବିଷୟ · Your subjects
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          All {subjects.length} {contextLabel} subjects. Open any to ask the
          tutor — answers cite the official textbooks.
        </p>
        {subjects.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No subjects ingested yet for {contextLabel}. Drop the textbook
            PDFs into <code>data/sources/class-{classLevel}/</code> and run{" "}
            <code>
              npx tsx scripts/ingest/ingest-class.ts --class {classLevel}
            </code>
            .
          </div>
        ) : (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {subjects.map((s) => {
              const chapterCount = docCounts.get(s.id) ?? 0;
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
                    {s.name.or ? (
                      <h3 className="mt-1 text-base font-bold text-brand-900">
                        {s.name.or}
                      </h3>
                    ) : (
                      <h3 className="mt-1 text-base font-bold text-brand-900">
                        {s.name.en}
                      </h3>
                    )}
                    <p className="text-xs text-slate-500">{s.name.en}</p>
                  </div>

                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {chapterCount}
                    </span>{" "}
                    {chapterCount === 1 ? "chapter" : "chapters"} ingested
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand/40"
                      style={{ width: chapterCount > 0 ? "100%" : "0%" }}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-3 flex-1">
                    <div className="rounded-lg bg-brand-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-brand">
                        Tutor-led
                      </div>
                      <div className="text-sm font-medium text-slate-800">
                        Ask anything from the textbook
                      </div>
                      <div className="text-xs text-slate-500">
                        Citations included
                      </div>
                    </div>
                  </div>

                  <Link
                    href={subjectPath(s.code)}
                    className="mt-3 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    Open chapters →
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
