import { notFound, redirect } from "next/navigation";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { resolveTopicPath } from "@/lib/curriculum/db";
import { boardCodeToSlug, DEFAULT_BOARD_SLUG } from "@/lib/curriculum/boards";

// Legacy /topic/:topicId route. Static-curated IDs are typically caught
// by middleware. This page handles the DB-seeded fallback (and serves
// when middleware is bypassed, e.g. dev edge cases) so unknown IDs
// produce a clean 404 rather than a 500.

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topicId: string }> };

export default async function TopicRedirectPage({ params }: Params) {
  const { topicId } = await params;
  const topic = findTopic(topicId);
  if (topic) {
    redirect(
      `/b/${DEFAULT_BOARD_SLUG}/c/9/s/${topic.subjectCode.toLowerCase()}/ch/${topic.chapterSlug}/t/${topicId}`,
    );
  }
  const resolved = await resolveTopicPath(topicId);
  if (!resolved) notFound();
  const boardSlug =
    boardCodeToSlug(resolved.subject.board) ?? DEFAULT_BOARD_SLUG;
  redirect(
    `/b/${boardSlug}/c/${resolved.subject.classLevel}/s/${resolved.subject.code.toLowerCase()}/ch/${resolved.chapter.slug ?? ""}/t/${topicId}`,
  );
}