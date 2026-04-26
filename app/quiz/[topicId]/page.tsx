import { redirect } from "next/navigation";

// Legacy path — /quiz/:topicId used to host a Supabase-only stub.
// The canonical practice route is now /topic/:topicId/practice.
export default async function LegacyQuizRedirect({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  redirect(`/topic/${topicId}/practice`);
}
