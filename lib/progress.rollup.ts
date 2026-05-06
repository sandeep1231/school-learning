/**
 * Dashboard rollups (Phase 4).
 *
 * Thin read-side helpers over `attempts`, `topic_progress`, `activity_days`,
 * and `v_topic_accuracy`. Guests get zeros — they aren't persisted.
 */
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth/user";

export type TopicAccuracy = {
  topicId: string;
  accuracy: number;      // 0..1
  attemptsCount: number;
};

export type WeakSpot = {
  topicId: string;
  accuracy: number;      // 0..1
  attemptsCount: number;
};

export type SubjectRollup = {
  subjectCode: string;
  topicsTotal: number;
  topicsDone: number;        // topics with master stage completed
  practiceAccuracyPct: number; // 0..100, averaged over all attempts in subject
  practiceAttempts: number;
};

export type ChapterRollup = {
  chapterId: string;
  chapterSlug: string | null;
  topicsTotal: number;
  topicsDone: number;
  practiceAccuracyPct: number;
  practiceAttempts: number;
};

export type StreakInfo = {
  current: number;          // consecutive days ending today (or yesterday)
  longest: number;          // all-time best
  activeToday: boolean;
};

/**
 * Accuracy per topic for the current user. Empty map for guests.
 */
export async function getTopicAccuracyMap(
  user: CurrentUser,
  topicIds?: string[],
): Promise<Map<string, TopicAccuracy>> {
  if (!user.isAuthenticated) return new Map();
  const supabase = createAdminClient();
  let q = supabase
    .from("v_topic_accuracy")
    .select("topic_id, accuracy, attempts_count")
    .eq("student_id", user.id);
  if (topicIds && topicIds.length > 0) q = q.in("topic_id", topicIds);
  const { data, error } = await q;
  if (error || !data) return new Map();
  const out = new Map<string, TopicAccuracy>();
  for (const row of data as Array<{
    topic_id: string;
    accuracy: number | string;
    attempts_count: number;
  }>) {
    out.set(row.topic_id, {
      topicId: row.topic_id,
      accuracy: Number(row.accuracy) || 0,
      attemptsCount: row.attempts_count,
    });
  }
  return out;
}

/**
 * Top-N weak spots: topics with lowest accuracy (among those the student
 * has actually attempted). Returns an empty array for guests.
 */
export const getWeakSpots = cache(async function getWeakSpots(
  user: CurrentUser,
  limit = 3,
  minAttempts = 2,
): Promise<WeakSpot[]> {
  if (!user.isAuthenticated) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("v_topic_accuracy")
    .select("topic_id, accuracy, attempts_count")
    .eq("student_id", user.id)
    .gte("attempts_count", minAttempts)
    .lt("accuracy", 0.7)
    .order("accuracy", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as Array<{
    topic_id: string;
    accuracy: number | string;
    attempts_count: number;
  }>).map((r) => ({
    topicId: r.topic_id,
    accuracy: Number(r.accuracy) || 0,
    attemptsCount: r.attempts_count,
  }));
});

/**
 * Phase 9.10 — Top misconception tags from the student's recent wrong
 * answers. Returns e.g. [{ tag: "subset_vs_proper_subset", count: 4 }, …]
 * so the dashboard can nudge "You often confuse subset vs. proper subset."
 */
export type MisconceptionHit = {
  tag: string;
  count: number;
};

const MISCONCEPTION_LABELS: Record<string, { en: string; or: string }> = {
  off_by_one: {
    en: "Off-by-one errors",
    or: "ଗୋଟିଏ-ଭୁଲ୍ ଗଣନା",
  },
  sign_error: {
    en: "Sign errors (positive / negative)",
    or: "ଚିହ୍ନ (ଧନ / ଋଣ) ଭୁଲ୍",
  },
  order_of_operations: {
    en: "Order of operations (BODMAS)",
    or: "ଗଣିତ ପ୍ରକ୍ରିୟାର କ୍ରମ",
  },
  subset_vs_proper_subset: {
    en: "Subset vs. proper subset",
    or: "Subset ଏବଂ Proper subset ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ",
  },
  unit_confusion: {
    en: "Unit confusion",
    or: "ଏକକ ଭ୍ରମ",
  },
  rounding_error: {
    en: "Rounding errors",
    or: "ରାଉଣ୍ଡିଂ ଭୁଲ୍",
  },
  distributive_missing: {
    en: "Missing distributive step",
    or: "ବଣ୍ଟନ ନିୟମ ଛାଡିଦେବା",
  },
};

export function labelMisconception(
  tag: string,
  lang: "en" | "or" = "en",
): string {
  const hit = MISCONCEPTION_LABELS[tag];
  if (hit) return hit[lang];
  // Fallback: "snake_case" → "Snake case".
  return tag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const getTopMisconceptions = cache(async function getTopMisconceptions(
  user: CurrentUser,
  limit = 3,
  lookbackDays = 30,
): Promise<MisconceptionHit[]> {
  if (!user.isAuthenticated) return [];
  const supabase = createAdminClient();
  const since = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("attempts")
    .select("misconception_tag")
    .eq("student_id", user.id)
    .not("misconception_tag", "is", null)
    .gte("created_at", since)
    .limit(500);
  if (error || !data) return [];
  const counts = new Map<string, number>();
  for (const row of data as Array<{ misconception_tag: string | null }>) {
    const tag = row.misconception_tag;
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
});

/**
 * Completed-topic set for the current user (topics whose `master` stage is
 * marked 'completed' OR whose `practice` stage has score >= 70).
 */
export async function getCompletedTopicIds(
  user: CurrentUser,
): Promise<Set<string>> {
  if (!user.isAuthenticated) return new Set();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topic_progress")
    .select("topic_id, stage, status, score")
    .eq("student_id", user.id)
    .in("stage", ["master", "practice"]);
  if (error || !data) return new Set();
  const done = new Set<string>();
  for (const r of data as Array<{
    topic_id: string;
    stage: string;
    status: string;
    score: number | null;
  }>) {
    if (r.stage === "master" && r.status === "completed") done.add(r.topic_id);
    else if (r.stage === "practice" && (r.score ?? 0) >= 70) done.add(r.topic_id);
  }
  return done;
}

/**
 * Record that the user was active today. Idempotent — upserts the row
 * for (student, today UTC) and updates `last_at`.
 */
export async function recordActivity(user: CurrentUser): Promise<void> {
  if (!user.isAuthenticated) return;
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  // upsert; on conflict bump last_at only
  await supabase
    .from("activity_days")
    .upsert(
      { student_id: user.id, day: today, first_at: now, last_at: now },
      { onConflict: "student_id,day", ignoreDuplicates: false },
    );
  // Ensure last_at is refreshed even when a row already existed.
  await supabase
    .from("activity_days")
    .update({ last_at: now })
    .eq("student_id", user.id)
    .eq("day", today);
}

/**
 * Current streak = count of consecutive UTC days ending at today (or
 * yesterday if no activity today yet) where an activity row exists.
 * Longest streak = max run seen across all activity_days rows for the user.
 */
export const getStreakInfo = cache(async function getStreakInfo(user: CurrentUser): Promise<StreakInfo> {
  if (!user.isAuthenticated) return { current: 0, longest: 0, activeToday: false };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_days")
    .select("day")
    .eq("student_id", user.id)
    .order("day", { ascending: false })
    .limit(365);
  if (error || !data || data.length === 0) {
    return { current: 0, longest: 0, activeToday: false };
  }
  const days = (data as Array<{ day: string }>).map((r) => r.day);
  const todayISO = new Date().toISOString().slice(0, 10);
  const yesterdayISO = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const activeToday = days[0] === todayISO;

  // Current streak (ends at today or yesterday).
  let current = 0;
  const anchor = activeToday ? todayISO : days[0] === yesterdayISO ? yesterdayISO : null;
  if (anchor) {
    let expected = anchor;
    for (const d of days) {
      if (d === expected) {
        current++;
        expected = new Date(Date.parse(expected) - 86400000)
          .toISOString()
          .slice(0, 10);
      } else if (d < expected) {
        break;
      }
    }
  }

  // Longest streak: iterate ascending, count runs of consecutive days.
  const ascending = [...days].reverse();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of ascending) {
    if (prev === null) {
      run = 1;
    } else {
      const nextDay = new Date(Date.parse(prev) + 86400000)
        .toISOString()
        .slice(0, 10);
      run = d === nextDay ? run + 1 : 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest, activeToday };
});
