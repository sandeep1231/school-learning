import { notFound, redirect } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { resolveTopicPath } from "@/lib/curriculum/db";
import {
  boardCodeToSlug,
  DEFAULT_BOARD_SLUG,
} from "@/lib/curriculum/boards";
import QuizRunner from "@/components/quiz/QuizRunner";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function MasterPage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);

  // Static curated topics use the legacy hardcoded MCQ bank.
  if (topic) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-1 text-xs uppercase tracking-wide text-brand">
          {topic.subjectCode} · Stage 4 — Master
        </div>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">
          {topic.title.or}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Master Challenge — ୭୦% ପାଇଲେ ଏହି ଟପିକ୍ ମାଷ୍ଟର୍ ହେବ।
        </p>
        <QuizRunner topicId={topicId} stage="master" />
      </main>
    );
  }

  // DB-seeded topics use the board-scoped /master route which renders a
  // PracticeSession with stage="master" — that pre-filters the bank to hard
  // items and routes the score into the master progress stage on a pass.
  const resolved = await resolveTopicPath(topicId);
  if (!resolved) notFound();
  const boardSlug = boardCodeToSlug(resolved.subject.board) ?? DEFAULT_BOARD_SLUG;
  redirect(
    `/b/${boardSlug}/c/${resolved.subject.classLevel}/s/${resolved.subject.code.toLowerCase()}/ch/${resolved.chapter.slug ?? ""}/t/${topicId}/master`,
  );
}
