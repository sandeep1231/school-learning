import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuiz, scoreAttempt } from "@/lib/ai/quizzes";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { getCurrentUser } from "@/lib/auth/user";
import { markStageFor } from "@/lib/progress.server";

const BodySchema = z.object({
  topicId: z.string(),
  stage: z.enum(["practice", "master"]),
  mcqAnswers: z.array(z.number().int()).default([]),
  shortAnswers: z.array(z.string()).default([]),
});

const MASTERY_THRESHOLD = 70;

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { topicId, stage, mcqAnswers, shortAnswers } = parsed.data;
  const topic = findTopic(topicId);
  if (!topic) {
    return NextResponse.json({ error: "unknown_topic" }, { status: 404 });
  }
  const quiz = getQuiz(topicId, stage);
  const result = scoreAttempt(quiz, mcqAnswers, shortAnswers);

  const passed = result.percent >= MASTERY_THRESHOLD;
  const status =
    stage === "master"
      ? passed
        ? "mastered"
        : "available"
      : passed
        ? "completed"
        : "available";
  const user = await getCurrentUser();
  await markStageFor(user, topicId, stage, {
    status,
    score: result.percent,
    attempts: 1,
  });

  return NextResponse.json({
    topicId,
    stage,
    percent: result.percent,
    passed,
    mastered: stage === "master" && passed,
    threshold: MASTERY_THRESHOLD,
    mcqResults: result.mcqResults.map((r, i) => ({
      ...r,
      explanation: quiz.mcqs[i]?.explanation ?? "",
      correctIndex: quiz.mcqs[i]?.correct ?? -1,
    })),
    shortResults: result.shortResults.map((r, i) => ({
      ...r,
      modelAnswer: quiz.shortQs[i]?.modelAnswer ?? "",
    })),
  });
}
