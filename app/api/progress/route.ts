import { NextResponse } from "next/server";
import { z } from "zod";
import { findTopic } from "@/lib/curriculum/bse-class9";
import { getCurrentUser } from "@/lib/auth/user";
import { markStageFor } from "@/lib/progress.server";

const BodySchema = z.object({
  topicId: z.string(),
  stage: z.enum(["learn", "ask", "practice", "master"]),
  status: z.enum(["available", "completed", "mastered"]),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { topicId, stage, status } = parsed.data;
  if (!findTopic(topicId)) {
    return NextResponse.json({ error: "unknown_topic" }, { status: 404 });
  }
  const user = await getCurrentUser();
  const progress = await markStageFor(user, topicId, stage, { status });
  return NextResponse.json({ topicId, progress });
}
