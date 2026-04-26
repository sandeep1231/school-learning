import { notFound, redirect } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { DEFAULT_BOARD_SLUG } from "@/lib/curriculum/boards";

// Legacy /topic/:topicId route — Phase 1 redirects to the board-scoped hub.
// Stage routes (/topic/:id/{learn,practice,master}) still live at the legacy
// path in v1; Phase 2/3 migrate them to the new hierarchy.

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function TopicRedirectPage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);
  if (!topic) notFound();

  redirect(
    `/b/${DEFAULT_BOARD_SLUG}/c/9/s/${topic.subjectCode.toLowerCase()}/ch/${topic.chapterSlug}/t/${topicId}`,
  );
}