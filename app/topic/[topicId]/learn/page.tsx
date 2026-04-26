import Link from "next/link";
import { notFound } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { getLesson } from "@/lib/ai/lessons";
import CompleteLessonButton from "./CompleteLessonButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function LearnPage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);
  if (!topic) notFound();
  const lesson = getLesson(topicId);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        {topic.subjectCode} · {topic.chapterTitle.or} · Stage 1 — Learn
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{lesson.titleOr}</h1>
      <p className="mb-6 text-sm text-slate-500">{lesson.titleEn}</p>

      <article className="space-y-6">
        {lesson.sections.map((s, i) => (
          <section key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-brand-900">{s.heading}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {s.body}
            </p>
          </section>
        ))}

        {lesson.workedExamples.length > 0 && (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="mb-3 text-lg font-semibold text-emerald-900">
              ଉଦାହରଣ (Worked examples)
            </h2>
            <ol className="space-y-4">
              {lesson.workedExamples.map((ex, i) => (
                <li key={i}>
                  <p className="text-sm font-medium text-slate-900">
                    {i + 1}. {ex.problem}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    <span className="font-semibold">ସମାଧାନ:</span> {ex.solution}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-lg border-l-4 border-brand bg-brand-50 p-4 text-sm">
          <h3 className="mb-1 font-semibold text-brand-900">ସୂତ୍ର</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            {lesson.citations.map((c, i) => (
              <li key={i}>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                    {c.title}
                  </a>
                ) : (
                  c.title
                )}
                {c.page ? ` · ${c.page}` : ""}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <CompleteLessonButton topicId={topicId} />
        <Link
          href={`/chat/${topicId}`}
          className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-50"
        >
          ପ୍ରଶ୍ନ ପଚାର → Ask Tutor
        </Link>
        <Link href={`/topic/${topicId}`} className="text-sm text-brand hover:underline">
          ← Topic overview
        </Link>
      </div>
    </main>
  );
}
