import { notFound } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import QuizRunner from "@/components/quiz/QuizRunner";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function PracticePage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);
  if (!topic) notFound();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        {topic.subjectCode} · Stage 3 — Practice
      </div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{topic.title.or}</h1>
      <p className="mb-6 text-sm text-slate-500">
        ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅ। 70% କିମ୍ବା ଅଧିକ ପାଇଲେ Master ସ୍ତର ଖୋଲିବ।
      </p>
      <QuizRunner topicId={topicId} stage="practice" />
    </main>
  );
}
