import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildParentSummaryPrompt } from "@/lib/ai/prompts";
import { CHAT_MODEL, SAFETY_SETTINGS, getGemini } from "@/lib/ai/gemini";
import type { AppLanguage } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Vercel cron: POST /api/cron/daily-summary at 20:00 IST.
 * Requires header `Authorization: Bearer $CRON_SECRET`.
 *
 * For every active student:
 *   1. Aggregate today's completed topics, chat count, quiz average.
 *   2. Ask Gemini to write a 120-word note to the parent in their language.
 *   3. Upsert daily_summaries row.
 *   4. Queue email + whatsapp messages in notifications_outbox.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: students } = await sb
    .from("profiles")
    .select("id, full_name, preferred_language")
    .eq("role", "student");

  const client = getGemini();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    safetySettings: SAFETY_SETTINGS as any,
  });

  let processed = 0;
  for (const student of students ?? []) {
    const { data: done } = await sb
      .from("study_plan_items")
      .select("topic:topics ( title_en )")
      .eq("status", "completed")
      .eq("scheduled_on", today);

    const { count: chatCount } = await sb
      .from("chat_messages")
      .select("id, chat_sessions!inner(student_id)", { count: "exact", head: true })
      .eq("chat_sessions.student_id", student.id)
      .gte("created_at", `${today}T00:00:00Z`);

    const { data: attempts } = await sb
      .from("quiz_attempts")
      .select("score")
      .eq("student_id", student.id)
      .gte("started_at", `${today}T00:00:00Z`);

    const scores = (attempts ?? [])
      .map((a) => a.score)
      .filter((n): n is number => typeof n === "number");
    const quizAvg =
      scores.length === 0 ? null : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const topics = (done ?? [])
      .map((d: any) => d.topic?.title_en)
      .filter(Boolean);

    const prompt = buildParentSummaryPrompt({
      language: (student.preferred_language as AppLanguage) ?? "en",
      studentName: student.full_name ?? "your child",
      date: today,
      topics,
      chatCount: chatCount ?? 0,
      quizAvg,
      weakAreas: [],
    });

    let note = "";
    try {
      const res = await model.generateContent(prompt);
      note = res.response.text().trim();
    } catch {
      note = `Today ${student.full_name ?? "your child"} covered ${topics.length} topic(s) and asked ${chatCount ?? 0} tutor questions.`;
    }

    await sb.from("daily_summaries").upsert(
      {
        student_id: student.id,
        summary_date: today,
        covered_topic_ids: [],
        chat_count: chatCount ?? 0,
        quiz_avg_score: quizAvg,
        parent_note: note,
      },
      { onConflict: "student_id,summary_date" },
    );

    // Queue notifications for linked parents
    const { data: family } = await sb
      .from("family_members")
      .select("family_id")
      .eq("profile_id", student.id)
      .eq("relation", "student");
    const familyIds = (family ?? []).map((f) => f.family_id);
    if (familyIds.length) {
      const { data: parents } = await sb
        .from("family_members")
        .select("profile_id")
        .in("family_id", familyIds)
        .in("relation", ["parent", "guardian"]);
      const parentIds = (parents ?? []).map((p) => p.profile_id);
      if (parentIds.length) {
        await sb.from("notifications_outbox").insert(
          parentIds.flatMap((pid) => [
            {
              recipient_profile_id: pid,
              channel: "email" as const,
              template: "daily_summary_v1",
              payload: { student_name: student.full_name, note, date: today },
            },
            {
              recipient_profile_id: pid,
              channel: "whatsapp" as const,
              template: "daily_summary_v1",
              payload: { student_name: student.full_name, note, date: today },
            },
          ]),
        );
      }
    }

    processed += 1;
  }

  // Tiny observability line so Render Cron logs are immediately useful.
  console.log(
    JSON.stringify({
      event: "cron.daily_summary",
      processed,
      total: students?.length ?? 0,
      date: today,
    }),
  );

  return NextResponse.json({ ok: true, processed });
}
