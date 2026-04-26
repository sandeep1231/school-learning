/**
 * Server-side progress store.
 *
 * - If the caller is an authenticated Supabase user → read/write the
 *   `topic_progress` table (per-row RLS: `auth.uid() = student_id`).
 * - Otherwise (guest cookie or Supabase not configured) → fall back to the
 *   in-memory `lib/progress` store keyed by the guest id.
 */

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getProgress as getMemProgress,
  markStage as markMemStage,
  type Stage,
  type StageState,
  type TopicProgress,
} from "@/lib/progress";
import type { CurrentUser } from "@/lib/auth/user";

type Row = {
  stage: Stage;
  status: StageState["status"];
  score: number | null;
  attempts: number;
  updated_at: string;
};

function defaultProgress(): TopicProgress {
  const now = new Date().toISOString();
  return {
    learn: { status: "available", attempts: 0, updatedAt: now },
    ask: { status: "available", attempts: 0, updatedAt: now },
    practice: { status: "locked", attempts: 0, updatedAt: now },
    master: { status: "locked", attempts: 0, updatedAt: now },
  };
}

function hydrate(rows: Row[]): TopicProgress {
  const p = defaultProgress();
  for (const r of rows) {
    p[r.stage] = {
      status: r.status,
      score: r.score ?? undefined,
      attempts: r.attempts,
      updatedAt: r.updated_at,
    };
  }
  return p;
}

export async function getProgressFor(
  user: CurrentUser,
  topicId: string,
): Promise<TopicProgress> {
  if (!user.isAuthenticated || !isSupabaseConfigured()) {
    return getMemProgress(user.id, topicId);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_progress")
    .select("stage, status, score, attempts, updated_at")
    .eq("student_id", user.id)
    .eq("topic_id", topicId);
  if (error || !data) return getMemProgress(user.id, topicId);
  return hydrate(data as Row[]);
}

/**
 * Batch variant — fetches progress for many topics in a single round-trip.
 * Use this on dashboards (e.g. /today) instead of looping `getProgressFor`
 * to avoid N+1 query patterns. Returns a Map keyed by topicId.
 */
export async function getProgressForMany(
  user: CurrentUser,
  topicIds: string[],
): Promise<Map<string, TopicProgress>> {
  const out = new Map<string, TopicProgress>();
  if (topicIds.length === 0) return out;
  if (!user.isAuthenticated || !isSupabaseConfigured()) {
    for (const id of topicIds) out.set(id, getMemProgress(user.id, id));
    return out;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_progress")
    .select("topic_id, stage, status, score, attempts, updated_at")
    .eq("student_id", user.id)
    .in("topic_id", topicIds);
  if (error || !data) {
    for (const id of topicIds) out.set(id, defaultProgress());
    return out;
  }
  const byTopic = new Map<string, Row[]>();
  for (const row of data as (Row & { topic_id: string })[]) {
    const arr = byTopic.get(row.topic_id) ?? [];
    arr.push(row);
    byTopic.set(row.topic_id, arr);
  }
  for (const id of topicIds) {
    out.set(id, hydrate(byTopic.get(id) ?? []));
  }
  return out;
}

export async function markStageFor(
  user: CurrentUser,
  topicId: string,
  stage: Stage,
  patch: Partial<StageState>,
): Promise<TopicProgress> {
  if (!user.isAuthenticated || !isSupabaseConfigured()) {
    return markMemStage(user.id, topicId, stage, patch);
  }
  const supabase = await createClient();

  // Upsert current stage
  const now = new Date().toISOString();
  const { data: existingRows } = await supabase
    .from("topic_progress")
    .select("stage, status, score, attempts, updated_at")
    .eq("student_id", user.id)
    .eq("topic_id", topicId);
  const existing = (existingRows ?? []) as Row[];
  const byStage = new Map(existing.map((r) => [r.stage, r]));
  const prior = byStage.get(stage);

  const nextRow = {
    student_id: user.id,
    topic_id: topicId,
    stage,
    status: patch.status ?? prior?.status ?? "available",
    score: patch.score ?? prior?.score ?? null,
    attempts: (prior?.attempts ?? 0) + (patch.attempts ?? 0),
    updated_at: now,
    completed_at:
      patch.status === "completed" || patch.status === "mastered" ? now : null,
  };

  await supabase
    .from("topic_progress")
    .upsert(nextRow, { onConflict: "student_id,topic_id,stage" });

  // Unlock next stage if appropriate
  const unlock = async (nextStage: Stage) => {
    const cur = byStage.get(nextStage);
    if (cur && cur.status !== "locked") return;
    await supabase.from("topic_progress").upsert(
      {
        student_id: user.id,
        topic_id: topicId,
        stage: nextStage,
        status: "available",
        attempts: 0,
        updated_at: now,
      },
      { onConflict: "student_id,topic_id,stage" },
    );
  };
  if (
    stage === "learn" &&
    (patch.status === "completed" || patch.status === "mastered")
  ) {
    await unlock("practice");
  }
  if (
    stage === "practice" &&
    (patch.status === "completed" || patch.status === "mastered")
  ) {
    await unlock("master");
  }
  if (stage === "master" && patch.status === "mastered" && patch.score != null) {
    await supabase.from("mastery_events").insert({
      student_id: user.id,
      topic_id: topicId,
      score: patch.score,
    });
  }

  return getProgressFor(user, topicId);
}
