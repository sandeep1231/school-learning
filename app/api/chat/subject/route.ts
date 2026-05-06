import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { chatLimiter } from "@/lib/ratelimit";
import { retrieveForScope } from "@/lib/ai/rag";
import { buildTutorSystemPrompt } from "@/lib/ai/prompts";
import {
  CHAT_MODEL,
  SAFETY_SETTINGS,
  getGemini,
  isGeminiConfigured,
} from "@/lib/ai/gemini";
import { CURRICULUM, RAG_ONLY_SUBJECTS } from "@/lib/curriculum/bse-class9";
import { getUserContext } from "@/lib/auth/context";
import {
  formatBoardLabel,
  isClassSupported,
} from "@/lib/curriculum/boards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  subjectCode: z.string().min(2).max(8),
  chapterHint: z.string().min(1).max(200).optional(),
  // Optional explicit board/class overrides (e.g. from a deep-linked
  // board-scoped page). When absent we fall back to the caller's persisted
  // context (cookie / profile).
  boardCode: z.string().min(2).max(32).optional(),
  classLevel: z.number().int().min(1).max(12).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

const ALL_SUBJECTS = [
  ...CURRICULUM.map((s) => ({ code: s.code, name: s.name })),
  ...RAG_ONLY_SUBJECTS,
];

function findSubject(code: string) {
  return ALL_SUBJECTS.find((s) => s.code === code);
}

function sseResponse(stream: ReadableStream) {
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { subjectCode, chapterHint, messages, boardCode: bodyBoard, classLevel: bodyClass } = parsed.data;
  // Subject metadata for naming/prompts. For multi-class boards the same
  // subject code may exist across classes; we still pull the human-readable
  // name from the Class-9 catalogue, then override the prompt's class
  // language with the caller's actual class below.
  const subject = findSubject(subjectCode) ?? {
    code: subjectCode.toUpperCase(),
    name: { en: subjectCode.toUpperCase(), or: subjectCode.toUpperCase() },
  };

  // Resolve scope: explicit body overrides → persisted user context.
  const ctx = await getUserContext();
  const boardCode =
    bodyBoard && isClassSupported(bodyBoard, bodyClass ?? ctx.classLevel)
      ? bodyBoard
      : ctx.boardCode;
  const classLevel =
    bodyClass && isClassSupported(boardCode, bodyClass)
      ? bodyClass
      : ctx.classLevel;
  const boardLabel = formatBoardLabel(boardCode);

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "gemini_not_configured" }, { status: 503 });
  }

  // Optional auth — used only for rate-limit key + retrieval credits.
  let rateKey = "guest";
  if (isSupabaseConfigured()) {
    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user) rateKey = `user:${user.id}`;
    } catch {
      /* guest */
    }
  }
  const rl = await chatLimiter().limit(rateKey);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const retrievalQuery = lastUser?.content ?? subject.name.en;

  const chunks = await retrieveForScope({
    query: retrievalQuery,
    board: boardCode,
    classLevel,
    subjectCode,
    k: 6,
    chapterHint,
  });

  const systemPrompt = buildTutorSystemPrompt({
    language: "or",
    studentName: null,
    classLevel,
    subjectName: subject.name.en,
    chapterTitle: subject.name.or,
    topicTitle: subject.name.or,
    learningObjectives: [
      `Help the student understand ${subject.name.en} concepts grounded in the ${boardLabel} Class ${classLevel} textbook.`,
    ],
    context: chunks.map((c) => ({
      id: c.id,
      text: c.content,
      source: c.documentTitle,
      page: c.page,
    })),
  });

  const client = getGemini();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    safetySettings: SAFETY_SETTINGS as any,
    systemInstruction: systemPrompt,
  });
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const userPart = messages[messages.length - 1]?.content ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(userPart);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) send({ type: "delta", text });
        }
        send({
          type: "citations",
          citations: chunks.map((c) => ({
            chunkId: c.id,
            documentTitle: c.documentTitle,
            sourceUrl: c.sourceUrl,
            page: c.page,
          })),
        });
        send({ type: "done" });
      } catch (err: any) {
        send({ type: "error", message: err?.message ?? "stream_failed" });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}
