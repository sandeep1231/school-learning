import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import MarkdownBody from "@/components/markdown/MarkdownBody";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";

import { findTopic } from "@/lib/curriculum/bse-class9";
import {
  boardSlugToCode,
  isClassSupported,
} from "@/lib/curriculum/boards";
import { getTopicBySlug, resolveTopicPath } from "@/lib/curriculum/db";
import {
  getLessonVariantsForTopic,
  pickLessonVariant,
  type LessonVariantKind,
} from "@/lib/curriculum/lessons";
import {
  AUDIENCE_COOKIE,
  readAudience,
} from "@/lib/learn/audience";
import AudienceToggle from "@/components/learn/AudienceToggle";
import { languageProfileFor } from "@/scripts/content/language-profile";

export const dynamic = "force-dynamic";

type Params = {
  board: string;
  classNum: string;
  subject: string;
  chapter: string;
  topic: string;
};

export default async function BoardLearnPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { board, classNum, subject, chapter, topic: topicSlug } = await params;

  const boardCode = boardSlugToCode(board);
  const classLevel = Number.parseInt(classNum, 10);
  if (!boardCode || !Number.isFinite(classLevel)) notFound();
  if (!isClassSupported(boardCode, classLevel)) notFound();

  // Resolve topic — try static curated curriculum first, fall back to DB.
  // Either path must yield a DB UUID (lesson_variants is keyed by topic_id).
  const staticTopic = findTopic(topicSlug);
  const dbTopic = await getTopicBySlug(topicSlug);
  if (!dbTopic) notFound();

  let subjectCode: string;
  let resolvedChapterSlug: string;
  let chapterTitleOr: string;
  let topicTitleOr: string;
  let topicTitleEn: string;

  if (staticTopic) {
    subjectCode = staticTopic.subjectCode;
    resolvedChapterSlug = staticTopic.chapterSlug;
    chapterTitleOr =
      staticTopic.chapterTitle.or ?? staticTopic.chapterTitle.en;
    topicTitleOr = staticTopic.title.or ?? staticTopic.title.en;
    topicTitleEn = staticTopic.title.en;
  } else {
    const resolved = await resolveTopicPath(topicSlug);
    if (!resolved) notFound();
    subjectCode = resolved.subject.code;
    resolvedChapterSlug = resolved.chapter.slug ?? "";
    chapterTitleOr =
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

  const cookieStore = await cookies();
  const requested = readAudience(cookieStore.get(AUDIENCE_COOKIE)?.value);

  // Pick the variant language based on the subject's bilingual profile.
  // SLE → 'en', TLH → 'hi', everything else on BSE → 'or'.
  const profile = languageProfileFor(boardCode, subjectCode);
  const variants = await getLessonVariantsForTopic(dbTopic.id, profile.language);
  const available = (Object.keys(variants) as LessonVariantKind[]);
  const selected = pickLessonVariant(variants, requested);

  const hubHref = `/b/${board}/c/${classLevel}/s/${subject}/ch/${chapter}/t/${topicSlug}`;
  const practiceHref = `${hubHref}/practice`;

  const isParent = selected?.variant === "parent";

  const pageClass = isParent
    ? "bg-amber-50/40 min-h-screen"
    : "min-h-screen";
  const cardClass = isParent
    ? "rounded-xl border border-amber-200 bg-white/90 p-6 shadow-sm"
    : "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

  return (
    <div className={pageClass}>
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-1 text-xs uppercase tracking-wide text-brand">
          <Link href={hubHref} className="hover:underline">
            ← {subjectCode} · {chapterTitleOr}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {topicTitleOr}
        </h1>
        <p className="mb-4 text-sm text-slate-500">{topicTitleEn}</p>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <AudienceToggle
            current={requested}
            available={
              available.length > 0
                ? available
                : (["textbook"] as LessonVariantKind[])
            }
          />
          {available.length > 0 && selected && selected.variant !== requested && (
            <p className="text-xs text-slate-500">
              Showing <strong>{selected.variant}</strong> variant (requested
              variant not available for this topic yet).
            </p>
          )}
        </div>

        {!selected ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              ପାଠ୍ୟ ପ୍ରସ୍ତୁତ ହେଉଛି · Lesson being prepared
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              We&apos;re writing this lesson now. Please check back in a few
              minutes — meanwhile you can ask the tutor any question about
              this topic.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href={`/chat/${topicSlug}`}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Ask the tutor →
              </Link>
              <Link
                href={hubHref}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back to topic
              </Link>
            </div>
          </div>
        ) : (
          <>
            <article className={cardClass}>
              <div
                className={
                  "prose prose-slate max-w-none prose-headings:font-semibold prose-h2:text-xl prose-p:leading-relaxed " +
                  (isParent ? "prose-p:text-slate-800" : "prose-p:text-slate-900")
                }
              >
                <MarkdownBody>{selected.bodyMd}</MarkdownBody>
              </div>
            </article>

            {isParent && selected.parentPrompts && (
              <section className="mt-4 rounded-xl border border-amber-300 bg-amber-100/70 p-5">
                <h2 className="mb-2 text-base font-semibold text-amber-900">
                  ପିଲାକୁ ପଚାରିବା ପାଇଁ ପ୍ରଶ୍ନ · Questions to ask your child
                </h2>
                {selected.parentPrompts.questions?.length > 0 && (
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-amber-950">
                    {selected.parentPrompts.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                )}
                {selected.parentPrompts.tips?.length ? (
                  <>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Coaching tips
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                      {selected.parentPrompts.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            )}

            {selected.citations.length > 0 && (
              <section className="mt-4 rounded-lg border-l-4 border-brand bg-brand-50 p-4 text-sm">
                <h3 className="mb-1 font-semibold text-brand-900">ସୂତ୍ର / Sources</h3>
                <ul className="list-disc space-y-1 pl-5 text-slate-700">
                  {selected.citations.map((c, i) => (
                    <li key={i}>
                      {c.title}
                      {c.page ? ` · p.${c.page}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={practiceHref}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-600"
          >
            ଅଭ୍ୟାସ →
          </Link>
          <Link
            href={hubHref}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to topic
          </Link>
        </div>
        <FeedbackWidget surface="lesson" topicId={dbTopic.id} />
      </main>
    </div>
  );
}
