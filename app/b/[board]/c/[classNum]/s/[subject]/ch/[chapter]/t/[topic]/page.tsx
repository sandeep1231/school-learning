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
import {
  getTopicBySlug,
  getChapterById,
  getSubjectById,
} from "@/lib/curriculum/db";
import { topicHasLessons } from "@/lib/curriculum/lessons";
import { topicHasPractice } from "@/lib/curriculum/practice";

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

type TopicView = {
  source: "static" | "db";
  slug: string;
  /** DB UUID — present for both static (resolved via slug→DB lookup) and DB topics. */
  uuid: string | null;
  subjectCode: string;
  chapterSlug: string;
  chapterTitle: { en: string; or: string | null; hi: string | null };
  title: { en: string; or: string | null; hi: string | null };
  objectives: string[];
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

  // Resolve topic — try static curriculum first (Class 9 BSE Odisha curated),
  // then fall back to DB (seeded by `npm run seed:topics`).
  let view: TopicView | null = null;
  const staticTopic = findTopic(topicSlug);
  if (staticTopic) {
    view = {
      source: "static",
      slug: topicSlug,
      uuid: null,
      subjectCode: staticTopic.subjectCode,
      chapterSlug: staticTopic.chapterSlug,
      chapterTitle: {
        en: staticTopic.chapterTitle.en,
        or: staticTopic.chapterTitle.or,
        hi: staticTopic.chapterTitle.hi,
      },
      title: {
        en: staticTopic.title.en,
        or: staticTopic.title.or,
        hi: staticTopic.title.hi,
      },
      objectives: staticTopic.objectives,
    };
  } else {
    const dbTopic = await getTopicBySlug(topicSlug);
    if (dbTopic) {
      const dbChapter = await getChapterById(dbTopic.chapterId);
      const dbSubject = dbChapter
        ? await getSubjectById(dbChapter.subjectId)
        : null;
      if (dbChapter && dbSubject) {
        view = {
          source: "db",
          slug: topicSlug,
          uuid: dbTopic.id,
          subjectCode: dbSubject.code,
          chapterSlug: dbChapter.slug ?? "",
          chapterTitle: dbChapter.title,
          title: dbTopic.title,
          objectives: dbTopic.objectives,
        };
      }
    }
  }
  if (!view) notFound();

  // URL integrity check — refuse to render if the URL's subject/chapter
  // don't match the topic's actual location.
  if (
    view.subjectCode.toLowerCase() !== subject.toLowerCase() ||
    view.chapterSlug !== chapter
  ) {
    notFound();
  }

  const user = await getCurrentUser();

  // Parallelize the three independent reads. progress, hasLessons, and
  // hasPractice all just need (user, topicSlug, topicUuid) which we already
  // have — no need to wait for them in series.
  const [progress, hasLessons, hasPractice] = await Promise.all([
    getProgressFor(user, topicSlug),
    view.uuid ? topicHasLessons(view.uuid) : Promise.resolve(false),
    view.uuid ? topicHasPractice(view.uuid) : Promise.resolve(false),
  ]);

  const stages = [
    {
      key: "learn" as const,
      href: `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}/learn`,
      label: { en: "Learn", or: "ଶିଖ" },
      desc: hasLessons
        ? "AI-written lesson with worked examples"
        : "Lesson coming soon — content is being generated",
      available: hasLessons,
    },
    {
      key: "ask" as const,
      href: `/chat/${topicSlug}`,
      label: { en: "Ask Tutor", or: "ପ୍ରଶ୍ନ କର" },
      desc: "Chat about this topic — answers cite the textbook",
      available: true,
    },
    {
      key: "practice" as const,
      href: `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}/practice`,
      label: { en: "Practice", or: "ଅଭ୍ୟାସ" },
      desc: hasPractice
        ? "MCQs + short-answer questions with instant feedback"
        : "Auto-generated practice — coming soon",
      available: hasPractice,
    },
    {
      key: "master" as const,
      href: `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}/master`,
      label: { en: "Master", or: "ମାଷ୍ଟର୍" },
      desc: "Harder questions. Score ≥ 70% to master the topic.",
      available: hasPractice,
    },
  ];

  const subjectPath = `/b/${board}/c/${classLevel}/s/${subject}`;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        <Link href={subjectPath} className="hover:underline">
          {view.subjectCode}
        </Link>
        <span className="mx-1 opacity-60">·</span>
        {view.chapterTitle.or ?? view.chapterTitle.en}
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {view.title.or ?? view.title.en}
      </h1>
      <p className="mb-4 text-sm text-slate-500">{view.title.en}</p>

      {view.objectives.length > 0 && (
        <section className="mb-6 rounded-lg bg-brand-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-brand-900">
            ଶିକ୍ଷଣ ଲକ୍ଷ୍ୟ · Learning objectives
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {view.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-3">
        {stages.map((s, i) => {
          const state =
            view!.source === "static" && s.key in progress
              ? progress[s.key as keyof typeof progress]
              : { status: s.available ? "ready" : "locked" } as const;
          const locked =
            !s.available || (state as { status: string }).status === "locked";
          // Disabled stages render as non-interactive divs with clear visual
          // language: dashed border, "not-allowed" cursor, faded text — so
          // they read as "info card" rather than "broken button".
          const Wrapper: React.ElementType = locked ? "div" : Link;
          const wrapperProps = locked
            ? {
                "aria-disabled": "true" as const,
                className:
                  "block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 cursor-not-allowed select-none",
              }
            : {
                href: s.href,
                className:
                  "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
              };
          return (
            <li key={s.key}>
              <Wrapper {...(wrapperProps as Record<string, unknown>)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`text-xs uppercase tracking-wide ${locked ? "text-slate-400" : "text-brand"}`}>
                      Stage {i + 1}
                    </div>
                    <div className={`font-semibold ${locked ? "text-slate-500" : "text-slate-900"}`}>
                      {s.label.or} · {s.label.en}
                    </div>
                    <p className={`text-sm ${locked ? "text-slate-500" : "text-slate-600"}`}>
                      {s.desc}
                    </p>
                  </div>
                  {view!.source === "static" && s.key in progress ? (
                    <StageBadge
                      stage={s.key as "learn" | "ask" | "practice" | "master"}
                      state={progress[s.key as keyof typeof progress]}
                    />
                  ) : !s.available ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Coming soon
                    </span>
                  ) : null}
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
