/**
 * Phase 9.3 — Persist / update `srs_cards` rows from a batch of attempt
 * results. Called from /api/practice/submit after attempts are inserted.
 *
 * One row per (student, item). Uses an explicit select-then-insert/update
 * pattern (not upsert-on-conflict) so we can feed the previous state into
 * `reviewCard` for correct SM-2 scheduling.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fractionToQ, reviewCard, INITIAL_SRS, type SrsState } from "./sm2";

export type ReviewInput = {
  itemId: string;
  fraction: number; // 0..1 attempt score
};

export async function upsertSrsReviews(
  admin: SupabaseClient,
  studentId: string,
  reviews: ReviewInput[],
): Promise<{ updated: number }> {
  if (reviews.length === 0) return { updated: 0 };

  const itemIds = reviews.map((r) => r.itemId);
  const { data: existing } = await admin
    .from("srs_cards")
    .select("id, item_id, ease, interval_days, reps, lapses")
    .eq("student_id", studentId)
    .in("item_id", itemIds);

  const byItem = new Map<string, { id: string } & SrsState>();
  for (const row of existing ?? []) {
    byItem.set(row.item_id as string, {
      id: row.id as string,
      ease: Number(row.ease),
      intervalDays: Number(row.interval_days),
      reps: Number(row.reps),
      lapses: Number(row.lapses),
    });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let updated = 0;

  for (const r of reviews) {
    const q = fractionToQ(r.fraction);
    const prev = byItem.get(r.itemId);
    const next = reviewCard(prev ?? INITIAL_SRS, q, now);
    if (prev) {
      const { error } = await admin
        .from("srs_cards")
        .update({
          ease: next.ease,
          interval_days: next.intervalDays,
          reps: next.reps,
          lapses: next.lapses,
          last_reviewed_at: nowIso,
          due_at: next.dueAt,
          updated_at: nowIso,
        })
        .eq("id", prev.id);
      if (!error) updated++;
    } else {
      const { error } = await admin.from("srs_cards").insert({
        student_id: studentId,
        item_id: r.itemId,
        ease: next.ease,
        interval_days: next.intervalDays,
        reps: next.reps,
        lapses: next.lapses,
        last_reviewed_at: nowIso,
        due_at: next.dueAt,
      });
      if (!error) updated++;
    }
  }
  return { updated };
}
