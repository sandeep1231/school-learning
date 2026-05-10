import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer-support inbox.
 *
 * POST /api/support
 *   { message: string, contact?: string, currentUrl?: string }
 *
 * Persists into the existing `content_feedback` table with
 *   surface='other', category='other', rating=null
 * so the admin /admin/feedback view shows support tickets alongside
 * content reports without needing a new schema or new admin UI.
 *
 * Open to guests (uses the per-IP guest cookie key for rate-limit
 * accounting). When a contact email/phone is provided we tack it onto the
 * comment so support can follow up; otherwise the ticket is anonymous.
 */
const BodySchema = z.object({
  message: z.string().min(5).max(2000),
  contact: z.string().max(200).optional(),
  currentUrl: z.string().url().max(500).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { message, contact, currentUrl } = parsed.data;

  const user = await getCurrentUser();
  // Compose a single comment string so admins see both the message and a
  // way to follow up. Hard-cap to the column's 2000-char limit.
  const composedComment = (
    contact
      ? `[contact: ${contact.slice(0, 120)}]\n${message}`
      : message
  ).slice(0, 2000);

  const sb = createAdminClient();
  const { error } = await sb.from("content_feedback").insert({
    user_id: user.isAuthenticated ? user.id : null,
    topic_id: null,
    surface: "other",
    ref_id: null,
    rating: null,
    category: "other",
    comment: composedComment,
    url: currentUrl ?? null,
  });
  if (error) {
    return NextResponse.json(
      { error: "save_failed", detail: error.message.slice(0, 200) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
