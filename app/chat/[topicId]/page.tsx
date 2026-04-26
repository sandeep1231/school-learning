import { notFound, redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import ChatBox from "@/components/chat/ChatBox";
import { findTopic } from "@/lib/curriculum/bse-class9";

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

    const { data: topic } = await supabase
      .from("topics")
      .select(
        `id, title_en, title_or, title_hi, learning_objectives,
         chapter:chapters ( title_en, subject:subjects ( name_en ) )`,
      )
      .eq("id", topicId)
      .maybeSingle();

    if (!topic) notFound();
    subject = (topic as any).chapter?.subject?.name_en ?? "Subject";
    chapter = (topic as any).chapter?.title_en ?? "";
    topicTitle = topic.title_en;
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
