import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import ChatBox from "@/components/chat/ChatBox";
import { findTopic } from "@/lib/curriculum/bse-class9";
import {
  getTopicBySlug,
  getChapterById,
  getSubjectById,
} from "@/lib/curriculum/db";
import { boardCodeToSlug, DEFAULT_BOARD_SLUG } from "@/lib/curriculum/boards";

export const dynamic = "force-dynamic";

export default async function TopicChatPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const demoMode = !isSupabaseConfigured();

  let topicTitle: string;
  let subject: string;
  let chapter: string;
  // Topic-hub href so the chat page has a "back to topic" link instead of
  // dead-ending the user (browser-back is unreliable on mobile and after a
  // long chat the chat URL is the user's only memory of where they are).
  let topicHubHref: string;

  // Resolve the topic for both demo mode and real backend mode. Guests are
  // welcome here — the chat API has a guest-path branch that streams real
  // RAG-grounded answers via the per-browser guest cookie. The previous
  // page-level `redirect("/auth/sign-in")` blocked guests entirely, even
  // though the API supports them, which made the tutor unreachable for
  // first-time visitors who hadn't signed up.
  const staticTopic = findTopic(topicId);
  if (staticTopic) {
    topicTitle = staticTopic.title.or;
    subject = staticTopic.subjectCode;
    chapter = staticTopic.chapterTitle.or;
    // Static curriculum is BSE Odisha Class 9 only; hardcode that pair so
    // the back link points at the canonical board-scoped hub.
    topicHubHref = `/b/${DEFAULT_BOARD_SLUG}/c/9/s/${staticTopic.subjectCode.toLowerCase()}/ch/${staticTopic.chapterSlug}/t/${topicId}`;
  } else if (demoMode) {
    notFound();
  } else {
    // DB topics: param is the topic slug seeded by `npm run seed:topics`.
    const dbTopic = await getTopicBySlug(topicId);
    if (!dbTopic) notFound();
    const dbChapter = await getChapterById(dbTopic.chapterId);
    const dbSubject = dbChapter
      ? await getSubjectById(dbChapter.subjectId)
      : null;
    if (!dbChapter || !dbSubject) notFound();
    topicTitle = dbTopic.title.or ?? dbTopic.title.en;
    subject = dbSubject.name.en;
    chapter = dbChapter.title.or ?? dbChapter.title.en;
    const boardSlug = boardCodeToSlug(dbSubject.board) ?? DEFAULT_BOARD_SLUG;
    topicHubHref = `/b/${boardSlug}/c/${dbSubject.classLevel}/s/${dbSubject.code.toLowerCase()}/ch/${dbChapter.slug ?? ""}/t/${topicId}`;
  }

  return (
    <main className="container mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 py-4">
      {demoMode && (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900">
          Demo mode — canned answers. Add Gemini API key for real AI tutoring.
        </div>
      )}
      <header className="mb-3">
        <Link
          href={topicHubHref}
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">←</span>
          <span>Back to topic</span>
        </Link>
        <div className="mt-1 text-xs uppercase tracking-wide text-brand">
          {subject} · {chapter}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{topicTitle}</h1>
      </header>
      <ChatBox topicId={topicId} topicTitle={topicTitle} />
    </main>
  );
}
