import { notFound, redirect } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { resolveTopicPath } from "@/lib/curriculum/db";
import { boardCodeToSlug, DEFAULT_BOARD_SLUG } from "@/lib/curriculum/boards";

// Legacy /topic/:topicId/practice — redirects to the canonical
// /b/.../t/.../practice route. Handles both static curated topics and
// DB-seeded topics; the destination page does its own resolution.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function PracticeRedirect({ params }: Params) {
  const { topicId } = await params;
  const staticTopic = findTopic(topicId);
  if (staticTopic) {
    redirect(
      `/b/${DEFAULT_BOARD_SLUG}/c/9/s/${staticTopic.subjectCode.toLowerCase()}/ch/${staticTopic.chapterSlug}/t/${topicId}/practice`,
    );
  }
  const resolved = await resolveTopicPath(topicId);
  if (!resolved) notFound();
  const boardSlug = boardCodeToSlug(resolved.subject.board);
  redirect(
    `/b/${boardSlug}/c/${resolved.subject.classLevel}/s/${resolved.subject.code.toLowerCase()}/ch/${resolved.chapter.slug ?? ""}/t/${topicId}/practice`,
  );
}
