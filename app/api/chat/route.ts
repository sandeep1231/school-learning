import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { chatLimiter } from "@/lib/ratelimit";
import { retrieveWithFallback } from "@/lib/ai/rag";
import { buildTutorSystemPrompt } from "@/lib/ai/prompts";
import { CHAT_MODEL, SAFETY_SETTINGS, getGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import type { AppLanguage } from "@/lib/types";
import { streamDemoReply } from "@/lib/ai/demo";
import { findTopic } from "@/lib/curriculum/bse-class9";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  topicId: z.string().min(1),
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
  const parsedEarly = BodySchema.safeParse(await req.clone().json());
  if (!parsedEarly.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsedEarly.error.flatten() },
      { status: 400 },
    );
  }

  const demoMode = !isSupabaseConfigured() || !isGeminiConfigured();

  if (demoMode) {
    const lastUser = [...parsedEarly.data.messages]
      .reverse()
      .find((m) => m.role === "user");
    return sseResponse(
      streamDemoReply({
        topicId: parsedEarly.data.topicId,
        question: lastUser?.content ?? "",
      }),
    );
  }

  // Guest path: visitors without a Supabase session (browsing with the
  // middleware-planted guest cookie). Streams real Gemini grounded on the
  // curriculum module. No RAG, no DB persistence.
  const supabaseServer = await createClient();
  const {
    data: { user: maybeUser },
  } = await supabaseServer.auth.getUser();

  if (!maybeUser) {
    const { topicId, messages } = parsedEarly.data;
    // Resolve the topic. Static C9 curriculum first (slugs like "mth-1-1"),
    // then DB fallback for everything else (C6/C7/C8 + C9 tutor-led
    // subjects). Without the DB fallback, guests visiting any DB-only
    // topic chat URL get a 404 from this endpoint even though the page
    // already rendered.
    type GuestTopic = {
      id: string;
      subjectCode: string;
      title: { or: string };
      chapterTitle: { or: string };
      objectives: string[];
      excerpt?: { or?: string };
    };
    let topic: GuestTopic | null = null;
    const staticTopic = findTopic(topicId);
    if (staticTopic) {
      topic = {
        id: staticTopic.id,
        subjectCode: staticTopic.subjectCode,
        title: { or: staticTopic.title.or },
        chapterTitle: { or: staticTopic.chapterTitle.or },
        objectives: staticTopic.objectives,
        excerpt: staticTopic.excerpt
          ? { or: staticTopic.excerpt.or }
          : undefined,
      };
    } else {
      const { getTopicBySlug, getChapterById, getSubjectById } = await import(
        "@/lib/curriculum/db"
      );
      const dbTopic = await getTopicBySlug(topicId);
      if (dbTopic) {
        const dbChapter = await getChapterById(dbTopic.chapterId);
        const dbSubject = dbChapter
          ? await getSubjectById(dbChapter.subjectId)
          : null;
        if (dbChapter && dbSubject) {
          topic = {
            id: dbTopic.id,
            subjectCode: dbSubject.code,
            title: { or: dbTopic.title.or ?? dbTopic.title.en },
            chapterTitle: {
              or: dbChapter.title.or ?? dbChapter.title.en,
            },
            objectives: dbTopic.objectives ?? [],
          };
        }
      }
    }
    if (!topic) {
      return NextResponse.json({ error: "topic_not_found" }, { status: 404 });
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const retrievalQuery = lastUser?.content ?? topic.title.or;

    // Subject-scoped RAG with progressive fallback (topic → chapter →
    // subject → class). If it errors entirely (e.g. no embeddings at all)
    // we degrade to the static topic excerpt.
    let ragContext: Array<{ id: string; text: string; source: string; page: number | null }> = [];
    let scopeUsed: "topic" | "chapter" | "subject" | "class" | "none" = "none";
    try {
      const result = await retrieveWithFallback({
        query: retrievalQuery,
        subjectCode: topic.subjectCode,
        k: 5,
      });
      ragContext = result.chunks.map((c) => ({
        id: c.id,
        text: c.content,
        source: c.documentTitle,
        page: c.page,
      }));
      scopeUsed = result.scopeUsed;
    } catch {
      /* ignore — fall back to curated excerpt below */
    }
    if (ragContext.length === 0 && topic.excerpt?.or) {
      ragContext = [
        {
          id: `${topic.id}-excerpt`,
          text: topic.excerpt.or,
          source: "BSE Odisha textbook",
          page: null,
        },
      ];
      scopeUsed = "topic";
    }

    const systemPrompt = buildTutorSystemPrompt({
      language: "or",
      studentName: null,
      classLevel: 9,
      subjectName: topic.subjectCode,
      chapterTitle: topic.chapterTitle.or,
      topicTitle: topic.title.or,
      learningObjectives: topic.objectives,
      context: ragContext,
      contextScope: scopeUsed,
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
            citations: ragContext
              .filter((c) => !c.id.endsWith("-excerpt"))
              .map((c) => ({
                chunkId: c.id,
                documentTitle: c.source,
                sourceUrl: null,
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

  const supabase = supabaseServer;
  const user = maybeUser;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { topicId, messages } = parsedEarly.data;

  const rl = await chatLimiter().limit(`user:${user.id}`);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  // Accept either a UUID (legacy) or a slug. Slugs are how URLs identify
  // topics in the v1 hierarchy and are what `findTopic`/`getTopicBySlug`
  // produce for both static (Class 9) and DB-seeded (Class 6/7/8) topics.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      topicId,
    );
  const topicQuery = supabase
    .from("topics")
    .select(
      `id, title_en, title_or, title_hi, learning_objectives, chapter_id,
       chapter:chapters ( id, title_en, subject:subjects ( code, name_en, class_level, board ) )`,
    );
  const { data: topic } = await (isUuid
    ? topicQuery.eq("id", topicId)
    : topicQuery.eq("slug", topicId)
  ).maybeSingle();

  if (!topic) {
    return NextResponse.json({ error: "topic_not_found" }, { status: 404 });
  }

  const language: AppLanguage =
    (profile?.preferred_language as AppLanguage) ?? "en";
  const subjectName = (topic as any).chapter?.subject?.name_en ?? "Subject";
  const subjectCode: string | undefined = (topic as any).chapter?.subject?.code;
  const boardCode: string | undefined = (topic as any).chapter?.subject?.board;
  const classLevel: number =
    (topic as any).chapter?.subject?.class_level ?? 9;
  const chapterTitle = (topic as any).chapter?.title_en ?? "";
  const chapterId: string | undefined = (topic as any).chapter?.id ?? (topic as any).chapter_id;
  const topicTitle =
    language === "or"
      ? topic.title_or ?? topic.title_en
      : language === "hi"
        ? topic.title_hi ?? topic.title_en
        : topic.title_en;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const retrievalQuery = lastUser?.content ?? topicTitle;

  const topicUuid = topic.id as string;

  // Progressive scope fallback: try topic-tagged chunks first, widen to
  // chapter / subject / class as needed so the tutor doesn't refuse when
  // chunks are sparse for a given topic.
  const { chunks, scopeUsed } = await retrieveWithFallback({
    query: retrievalQuery,
    topicId: topicUuid,
    chapterId,
    subjectCode,
    classLevel,
    board: boardCode,
    k: 6,
  });

  const systemPrompt = buildTutorSystemPrompt({
    language,
    studentName: profile?.full_name ?? null,
    classLevel,
    subjectName,
    chapterTitle,
    topicTitle,
    learningObjectives: (topic.learning_objectives as string[]) ?? [],
    context: chunks.map((c) => ({
      id: c.id,
      text: c.content,
      source: c.documentTitle,
      page: c.page,
    })),
    contextScope: scopeUsed,
  });

  // Get or create chat session
  let sessionId: string;
  const { data: recentSession } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("student_id", user.id)
    .eq("topic_id", topicUuid)
    .order("last_msg_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (recentSession) {
    sessionId = recentSession.id;
  } else {
    const { data: newSession, error } = await supabase
      .from("chat_sessions")
      .insert({ student_id: user.id, topic_id: topicUuid, language })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }
    sessionId = newSession.id;
  }

  // Persist the latest user message
  if (lastUser) {
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: lastUser.content,
    });
  }

  const citations = chunks.map((c) => ({
    chunkId: c.id,
    documentTitle: c.documentTitle,
    sourceUrl: c.sourceUrl,
    page: c.page,
  }));

  // Stream Gemini response as Server-Sent Events
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
      let assembled = "";
      try {
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(userPart);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            assembled += text;
            send({ type: "delta", text });
          }
        }
        send({ type: "citations", citations });
        send({ type: "done" });
      } catch (err: any) {
        send({ type: "error", message: err?.message ?? "stream_failed" });
      } finally {
        controller.close();
        // Persist assistant message (fire-and-forget)
        await supabase
          .from("chat_messages")
          .insert({
            session_id: sessionId,
            role: "assistant",
            content: assembled,
            citations: citations as any,
          });
        await supabase
          .from("chat_sessions")
          .update({ last_msg_at: new Date().toISOString() })
          .eq("id", sessionId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
