import { NextResponse } from "next/server";
import { getLesson } from "@/lib/ai/lessons";
import { getQuiz } from "@/lib/ai/quizzes";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { getCurrentUser } from "@/lib/auth/user";
import { getProgressFor } from "@/lib/progress.server";

// Simple read endpoint used by both demo-mode and later the Supabase flow.
// ?topicId=&kind=lesson|quiz:practice|quiz:master|progress
export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicId = url.searchParams.get("topicId");
  const kind = url.searchParams.get("kind") ?? "lesson";

  if (!topicId) {
    return NextResponse.json({ error: "topicId required" }, { status: 400 });
  }
  const topic = findTopic(topicId);
  if (!topic) {
    return NextResponse.json({ error: "unknown_topic" }, { status: 404 });
  }

  if (kind === "lesson") {
    return NextResponse.json({ topic, lesson: getLesson(topicId) });
  }
  if (kind === "quiz:practice" || kind === "quiz:master") {
    const difficulty = kind === "quiz:master" ? "master" : "practice";
    const quiz = getQuiz(topicId, difficulty);
    // Strip correct answers/keywords before sending to client
    const safe = {
      ...quiz,
      mcqs: quiz.mcqs.map(({ correct, explanation, ...rest }) => rest),
      shortQs: quiz.shortQs.map(({ modelAnswer, keywords, ...rest }) => rest),
    };
    return NextResponse.json({ topic, quiz: safe });
  }
  if (kind === "progress") {
    const user = await getCurrentUser();
    return NextResponse.json({
      topic,
      progress: await getProgressFor(user, topicId),
    });
  }
  return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
}
