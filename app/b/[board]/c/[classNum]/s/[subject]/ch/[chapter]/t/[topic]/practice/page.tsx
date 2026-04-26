import { notFound } from "next/navigation";
import Link from "next/link";
import { findTopic } from "@/lib/curriculum/bse-class9";
import {
  boardSlugToCode,
  isClassSupported,
} from "@/lib/curriculum/boards";
import PracticeSession from "@/components/practice/PracticeSession";

export const dynamic = "force-dynamic";

type Params = {
  board: string;
  classNum: string;
  subject: string;
  chapter: string;
  topic: string;
};

export default async function BoardPracticePage({
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

  const dataTopic = findTopic(topicSlug);
  if (!dataTopic) notFound();
  if (
    dataTopic.subjectCode.toLowerCase() !== subject.toLowerCase() ||
    dataTopic.chapterSlug !== chapter
  ) {
    notFound();
  }

  const hubHref = `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}`;
  // Master stage still lives at the legacy URL until Phase 3 migrates it.
  const masterHref = `/topic/${topicSlug}/master`;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        <Link href={hubHref} className="hover:underline">
          {dataTopic.subjectCode} · {dataTopic.chapterTitle.or}
        </Link>
        <span className="mx-1 opacity-60">·</span>
        Stage 3 — Practice
      </div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">
        {dataTopic.title.or}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅ। 70% କିମ୍ବା ଅଧିକ ପାଇଲେ Master ସ୍ତର ଖୋଲିବ।
      </p>

      <PracticeSession
        topicSlug={topicSlug}
        topicHubHref={hubHref}
        nextStageHref={masterHref}
      />
    </main>
  );
}
