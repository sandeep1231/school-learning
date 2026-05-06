import { notFound } from "next/navigation";
import Link from "next/link";
import { findTopic } from "@/lib/curriculum/bse-class9";
import {
  boardSlugToCode,
  isClassSupported,
} from "@/lib/curriculum/boards";
import { resolveTopicPath } from "@/lib/curriculum/db";
import PracticeSession from "@/components/practice/PracticeSession";

export const dynamic = "force-dynamic";

type Params = {
  board: string;
  classNum: string;
  subject: string;
  chapter: string;
  topic: string;
};

/**
 * Stage 4 — Master Challenge.
 *
 * Reuses `PracticeSession` with `stage="master"` so the harder bank
 * (`?difficulty=hard` URL param applied as the initial filter) and the
 * stage-aware submit path mark the master progress on a passing score.
 */
export default async function BoardMasterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { board, classNum, subject, chapter, topic: topicSlug } =
    await params;

  const boardCode = boardSlugToCode(board);
  const classLevel = Number.parseInt(classNum, 10);
  if (!boardCode || !Number.isFinite(classLevel)) notFound();
  if (!isClassSupported(boardCode, classLevel)) notFound();

  let subjectCode: string;
  let chapterTitle: string;
  let topicTitleOr: string;
  let topicTitleEn: string;
  let resolvedChapterSlug: string;

  const staticTopic = findTopic(topicSlug);
  if (staticTopic) {
    subjectCode = staticTopic.subjectCode;
    resolvedChapterSlug = staticTopic.chapterSlug;
    chapterTitle =
      staticTopic.chapterTitle.or ?? staticTopic.chapterTitle.en;
    topicTitleOr = staticTopic.title.or ?? staticTopic.title.en;
    topicTitleEn = staticTopic.title.en;
  } else {
    const resolved = await resolveTopicPath(topicSlug);
    if (!resolved) notFound();
    subjectCode = resolved.subject.code;
    resolvedChapterSlug = resolved.chapter.slug ?? "";
    chapterTitle =
      resolved.chapter.title.or ?? resolved.chapter.title.en;
    topicTitleOr = resolved.topic.title.or ?? resolved.topic.title.en;
    topicTitleEn = resolved.topic.title.en;
  }

  if (
    subjectCode.toLowerCase() !== subject.toLowerCase() ||
    resolvedChapterSlug !== chapter
  ) {
    notFound();
  }

  const hubHref = `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}`;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        <Link href={hubHref} className="hover:underline">
          {subjectCode} · {chapterTitle}
        </Link>
        <span className="mx-1 opacity-60">·</span>
        Stage 4 — Master Challenge
      </div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">
        {topicTitleOr}
      </h1>
      <p className="mb-1 text-sm text-slate-500">{topicTitleEn}</p>
      <p className="mb-6 text-sm text-amber-900">
        ମାଷ୍ଟର୍ ଚ୍ୟାଲେଞ୍ଜ — ଅଧିକ କଠିନ ପ୍ରଶ୍ନ। 70% କିମ୍ବା ଅଧିକ ପାଇଲେ ତୁମେ ଏହି
        ଟପିକ୍ ମାଷ୍ଟର୍ କରିବ।
      </p>

      <PracticeSession
        topicSlug={topicSlug}
        topicHubHref={hubHref}
        nextStageHref={null}
        stage="master"
      />
    </main>
  );
}
