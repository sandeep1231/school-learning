import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/http/rate-limit";

/**
 * Phase 15 — POST /api/feedback
 *
 * Body: { surface: "lesson"|"practice"|"other", topicId?, refId?,
 *         rating?: 1..5, category?, comment?: string, url?: string }
 *
 * Writes to content_feedback with RLS respecting the signed-in user.
 * Anonymous guests can also submit (user_id is left null).
 */
type Surface = "lesson" | "practice" | "other";
type Category =
  | "wrong_answer"
  | "confusing"
  | "translation"
  | "typo"
  | "other";

const SURFACES: Surface[] = ["lesson", "practice", "other"];
const CATEGORIES: Category[] = [
  "wrong_answer",
  "confusing",
  "translation",
  "typo",
  "other",
];

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }

  // 10 feedback submissions per IP per 10 minutes.
  const rl = rateLimit(req, {
    key: "feedback",
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!rl.ok) return rl.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const surface = typeof body.surface === "string" ? body.surface : "";
  if (!SURFACES.includes(surface as Surface)) {
    return NextResponse.json({ error: "invalid_surface" }, { status: 400 });
  }
  const rating =
    typeof body.rating === "number" &&
    Number.isInteger(body.rating) &&
    body.rating >= 1 &&
    body.rating <= 5
      ? body.rating
      : null;
  const category =
    typeof body.category === "string" &&
    CATEGORIES.includes(body.category as Category)
      ? (body.category as Category)
      : null;
  const comment =
    typeof body.comment === "string" ? body.comment.slice(0, 2000) : null;
  if (!comment && rating === null) {
    return NextResponse.json(
      { error: "empty_feedback" },
      { status: 400 },
    );
  }
  const topicId =
    typeof body.topicId === "string" ? body.topicId.slice(0, 100) : null;
  const refId =
    typeof body.refId === "string" ? body.refId.slice(0, 100) : null;
  const url = typeof body.url === "string" ? body.url.slice(0, 500) : null;

  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { error } = await admin.from("content_feedback").insert({
    user_id: user.isAuthenticated ? user.id : null,
    surface,
    topic_id: topicId,
    ref_id: refId,
    rating,
    category,
    comment,
    url,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
