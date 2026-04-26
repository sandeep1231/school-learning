import Link from "next/link";
import { notFound } from "next/navigation";
import { findTopic, CURRICULUM } from "@/lib/curriculum/bse-class9";
import { getCurrentUser } from "@/lib/auth/user";
import { getProgressFor } from "@/lib/progress.server";
import { StageBadge } from "@/components/topic/TopicCard";
import {
  boardSlugToCode,
  isClassSupported,
  DEFAULT_BOARD_SLUG,
} from "@/lib/curriculum/boards";

// Phase 1 URL hierarchy: /b/:board/c/:classNum/s/:subject/ch/:chapter/t/:topic
//
// The four stages (Learn / Ask / Practice / Master) still live under the
// legacy /topic/:topicId/* and /chat/:topicId paths in v1. Those internals
// migrate to the new hierarchy in Phase 2/3.

export const dynamic = "force-dynamic";

type Params = {
  board: string;
  classNum: string;
  subject: string;
  chapter: string;
  topic: string;
};

export default async function BoardTopicPage({
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

  // URL integrity check — refuse to render if the URL's subject/chapter
  // don't match the topic's actual location.
  if (
    dataTopic.subjectCode.toLowerCase() !== subject.toLowerCase() ||
    dataTopic.chapterSlug !== chapter
  ) {
    notFound();
  }

  const user = await getCurrentUser();
  const progress = await getProgressFor(user, topicSlug);

  const stages = [
    {
      key: "learn" as const,
      href: `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}/learn`,
      label: { en: "Learn", or: "ଶିଖ" },
      desc: "AI-written lesson in Odia + worked examples",
    },
    {
      key: "ask" as const,
      href: `/chat/${topicSlug}`,
      label: { en: "Ask Tutor", or: "ପ୍ରଶ୍ନ କର" },
      desc: "Chat about this topic — answers cite the textbook",
    },
    {
      key: "practice" as const,
      href: `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}/practice`,
      label: { en: "Practice", or: "ଅଭ୍ୟାସ" },
      desc: "MCQs + short-answer questions with instant feedback",
    },
    {
      key: "master" as const,
      href: `/topic/${topicSlug}/master`,
      label: { en: "Master", or: "ମାଷ୍ଟର୍" },
      desc: "Harder questions. Score ≥ 70% to master the topic.",
    },
  ];

  const subjectPath = `/b/${board}/c/${classLevel}/s/${subject}`;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        <Link href={subjectPath} className="hover:underline">
          {dataTopic.subjectCode}
        </Link>
        <span className="mx-1 opacity-60">·</span>
        {dataTopic.chapterTitle.or}
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {dataTopic.title.or}
      </h1>
      <p className="mb-4 text-sm text-slate-500">{dataTopic.title.en}</p>

      {dataTopic.objectives.length > 0 && (
        <section className="mb-6 rounded-lg bg-brand-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-brand-900">
            ଶିକ୍ଷଣ ଲକ୍ଷ୍ୟ
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {dataTopic.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-3">
        {stages.map((s, i) => {
          const state = progress[s.key];
          const locked = state.status === "locked";
          const Wrapper: React.ElementType = locked ? "div" : Link;
          const wrapperProps = locked
            ? {
                className:
                  "block rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-60",
              }
            : {
                href: s.href,
                className:
                  "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md",
              };
          return (
            <li key={s.key}>
              <Wrapper {...(wrapperProps as Record<string, unknown>)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-brand">
                      Stage {i + 1}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {s.label.or} · {s.label.en}
                    </div>
                    <p className="text-sm text-slate-600">{s.desc}</p>
                  </div>
                  <StageBadge stage={s.key} state={state} />
                </div>
              </Wrapper>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex gap-3 text-sm">
        <Link href="/today" className="text-brand hover:underline">
          ← Back to Today
        </Link>
      </div>
    </main>
  );
}

export function generateStaticParams() {
  const out: Array<Params> = [];
  for (const subject of CURRICULUM) {
    for (const ch of subject.chapters) {
      for (const t of ch.topics) {
        out.push({
          board: DEFAULT_BOARD_SLUG,
          classNum: "9",
          subject: subject.code.toLowerCase(),
          chapter: ch.slug,
          topic: t.id,
        });
      }
    }
  }
  return out;
}
