import { notFound } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import QuizRunner from "@/components/quiz/QuizRunner";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function MasterPage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);
  if (!topic) notFound();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        {topic.subjectCode} · Stage 4 — Master
      </div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{topic.title.or}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Master Challenge — ୭୦% ପାଇଲେ ଏହି ଟପିକ୍ ମାଷ୍ଟର୍ ହେବ।
      </p>
      <QuizRunner topicId={topicId} stage="master" />
    </main>
  );
}
