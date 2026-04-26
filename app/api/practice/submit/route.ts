import { NextResponse } from "next/server";
import { z } from "zod";
import { getTopicBySlug } from "@/lib/curriculum/db";
import { listTopicPracticeItems } from "@/lib/curriculum/practice";
import {
  scoreAttempt,
  type ClientAnswer,
} from "@/lib/curriculum/practice.scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/user";
import { markStageFor } from "@/lib/progress.server";
import { recordActivity } from "@/lib/progress.rollup";
import { upsertSrsReviews } from "@/lib/srs/persist";

const MASTERY_THRESHOLD = 70;

const AnswerSchema = z.discriminatedUnion("kind", [
  z.object({
    itemId: z.string().uuid(),
    kind: z.literal("mcq"),
    choiceIndex: z.number().int().min(0).max(10),
  }),
  z.object({
    itemId: z.string().uuid(),
    kind: z.literal("short"),
    text: z.string().max(4000),
  }),
  z.object({
    itemId: z.string().uuid(),
    kind: z.literal("long"),
    text: z.string().max(8000),
  }),
]);

const BodySchema = z.object({
  topicSlug: z.string(),
  answers: z.array(AnswerSchema).min(1).max(32),
  timeMsByItem: z.record(z.string(), z.number().int().min(0)).optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { topicSlug, answers, timeMsByItem } = parsed.data;

  const topic = await getTopicBySlug(topicSlug);
  if (!topic) {
    return NextResponse.json({ error: "unknown_topic" }, { status: 404 });
  }

  // Load the full items (including answers / model answers) from the DB.
  const items = await listTopicPracticeItems(topic.id);
  const answered = items.filter((i) => answers.some((a) => a.itemId === i.id));
  if (answered.length === 0) {
    return NextResponse.json({ error: "no_matching_items" }, { status: 400 });
  }

  const { percent, results } = scoreAttempt(answered, answers as ClientAnswer[]);
  const passed = percent >= MASTERY_THRESHOLD;

  // Persist attempts + update topic_progress for auth users.
  const user = await getCurrentUser();
  if (user.isAuthenticated) {
    const admin = createAdminClient();
    const rows = results.map((r) => {
      const ans = answers.find((a) => a.itemId === r.itemId);
      const given: Record<string, unknown> = ans
        ? ans.kind === "mcq"
          ? { choice_index: ans.choiceIndex }
          : { text: ans.text }
        : {};
      return {
        student_id: user.id,
        item_id: r.itemId,
        topic_id: topic.id,
        given_answer: given,
        is_correct: r.correct,
        score: r.fraction,
        time_ms: timeMsByItem?.[r.itemId] ?? null,
        misconception_tag: r.misconceptionTag ?? null,
      };
    });
    if (rows.length > 0) {
      await admin.from("attempts").insert(rows);
    }

    // Phase 9.3 — SM-2 scheduler update per item.
    await upsertSrsReviews(
      admin,
      user.id,
      results.map((r) => ({ itemId: r.itemId, fraction: r.fraction })),
    );

    await markStageFor(user, topic.id, "practice", {
      status: passed ? "completed" : "available",
      score: percent,
      attempts: 1,
    });

    // Phase 4: record that the student was active today.
    await recordActivity(user);
  }

  return NextResponse.json({
    topicSlug,
    topicId: topic.id,
    percent,
    passed,
    threshold: MASTERY_THRESHOLD,
    persisted: user.isAuthenticated,
    results,
  });
}
