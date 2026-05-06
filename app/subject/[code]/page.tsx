import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/context";

/**
 * Legacy `/subject/:code` route. Phase 1 onwards every learner UI lives
 * under `/b/:board/c/:classNum/s/:subject` so it can serve any board/class.
 * We redirect using the caller's persisted board+class so a saved bookmark
 * always resolves into the correct content surface.
 */
export const dynamic = "force-dynamic";

export default async function LegacySubjectRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const [{ code }, sp, ctx] = await Promise.all([
    params,
    searchParams,
    getUserContext(),
  ]);
  const subject = code.toLowerCase();
  const qs = sp.chapter ? `?chapter=${encodeURIComponent(sp.chapter)}` : "";
  redirect(`/b/${ctx.boardSlug}/c/${ctx.classLevel}/s/${subject}${qs}`);
}
