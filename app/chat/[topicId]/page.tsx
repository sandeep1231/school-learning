import { notFound, redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import ChatBox from "@/components/chat/ChatBox";
import { findTopic } from "@/lib/curriculum/bse-class9";
import {
  getTopicBySlug,
  getChapterById,
  getSubjectById,
} from "@/lib/curriculum/db";

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

  if (demoMode) {
    const topic = findTopic(topicId);
    if (!topic) notFound();
    topicTitle = topic.title.or;
    subject = topic.subjectCode;
    chapter = topic.chapterTitle.or;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/sign-in");

    // Try static curated curriculum first (Class 9 — slugs like "mth-1-1").
    const staticTopic = findTopic(topicId);
    if (staticTopic) {
      topicTitle = staticTopic.title.or;
      subject = staticTopic.subjectCode;
      chapter = staticTopic.chapterTitle.or;
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
    }
  }

  return (
    <main className="container mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 py-4">
      {demoMode && (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900">
          Demo mode — canned answers. Add Gemini API key for real AI tutoring.
        </div>
      )}
      <header className="mb-3">
        <div className="text-xs uppercase tracking-wide text-brand">
          {subject} · {chapter}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{topicTitle}</h1>
      </header>
      <ChatBox topicId={topicId} topicTitle={topicTitle} />
    </main>
  );
}
