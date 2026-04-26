/**
 * Phase 9.4 — Today's due SRS items.
 *
 * Returns the practice items whose SRS cards are due (due_at <= now),
 * sorted by oldest due first. Caps at 50 per request to keep the
 * /review session bounded.
 *
 *   GET /api/practice/due?limit=20
 *
 * Unauthenticated callers get { items: [] }.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ items: [], due: 0 });
  }
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.trunc(rawLimit)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Pull due cards first (cheap, indexed by (student_id, due_at)).
  const { data: cards, error } = await admin
    .from("srs_cards")
    .select("item_id, due_at, interval_days, reps, lapses")
    .eq("student_id", user.id)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "db_read_failed" }, { status: 500 });
  }

  if (!cards || cards.length === 0) {
    return NextResponse.json({ items: [], due: 0 });
  }

  // Hydrate each card with its practice item + topic slug for routing.
  const itemIds = cards.map((c) => c.item_id as string);
  const { data: itemRows } = await admin
    .from("practice_items")
    .select("id, topic_id, payload, language")
    .in("id", itemIds);

  const topicIds = Array.from(
    new Set((itemRows ?? []).map((r) => r.topic_id).filter(Boolean) as string[]),
  );
  const { data: topicRows } = await admin
    .from("topics")
    .select("id, slug, title_en, title_or, chapter_id")
    .in("id", topicIds);
  const topicById = new Map((topicRows ?? []).map((t) => [t.id as string, t]));

  const itemById = new Map((itemRows ?? []).map((r) => [r.id as string, r]));

  const items = cards
    .map((c) => {
      const item = itemById.get(c.item_id as string);
      if (!item) return null;
      const topic = topicById.get(item.topic_id as string);
      return {
        itemId: c.item_id,
        topicId: item.topic_id,
        topicSlug: topic?.slug ?? null,
        topicTitleEn: topic?.title_en ?? null,
        topicTitleOr: topic?.title_or ?? null,
        payload: item.payload,
        language: item.language,
        dueAt: c.due_at,
        intervalDays: c.interval_days,
        reps: c.reps,
        lapses: c.lapses,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items, due: items.length });
}
