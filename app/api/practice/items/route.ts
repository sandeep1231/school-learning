import { NextResponse } from "next/server";
import {
  listTopicPracticeItems,
  type PracticeItem,
  type McqPayload,
  type FreeTextPayload,
} from "@/lib/curriculum/practice";
import { getTopicBySlug } from "@/lib/curriculum/db";

export const dynamic = "force-dynamic";

type ClientMcq = {
  id: string;
  kind: "mcq";
  difficulty: PracticeItem["difficulty"];
  questionMd: string;
  options: string[];
  citationPage: number | null;
};
type ClientFreeText = {
  id: string;
  kind: "short" | "long";
  difficulty: PracticeItem["difficulty"];
  questionMd: string;
  citationPage: number | null;
};
type ClientItem = ClientMcq | ClientFreeText;

function toClientItem(item: PracticeItem): ClientItem | null {
  if (item.kind === "mcq") {
    const p = item.payload as McqPayload;
    if (!p?.options || !Array.isArray(p.options)) return null;
    return {
      id: item.id,
      kind: "mcq",
      difficulty: item.difficulty,
      questionMd: item.questionMd,
      options: p.options,
      citationPage: item.citationPage,
    };
  }
  return {
    id: item.id,
    kind: item.kind,
    difficulty: item.difficulty,
    questionMd: item.questionMd,
    citationPage: item.citationPage,
  };
}

/**
 * GET /api/practice/items?topic=<slug>[&difficulty=easy|medium|hard][&kinds=mcq,short]
 * Strips correct answers + model answers before returning to the client.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicSlug = url.searchParams.get("topic");
  if (!topicSlug) {
    return NextResponse.json({ error: "topic_required" }, { status: 400 });
  }
  const topic = await getTopicBySlug(topicSlug);
  if (!topic) {
    return NextResponse.json({ error: "unknown_topic" }, { status: 404 });
  }

  const difficulty = url.searchParams.get("difficulty") as
    | "easy"
    | "medium"
    | "hard"
    | null;
  const kindsParam = url.searchParams.get("kinds");
  const kinds = kindsParam
    ? (kindsParam.split(",").filter((k) =>
        ["mcq", "short", "long"].includes(k),
      ) as PracticeItem["kind"][])
    : undefined;

  const items = await listTopicPracticeItems(topic.id, {
    kinds,
    difficulty: difficulty ?? undefined,
  });

  const safe = items
    .map(toClientItem)
    .filter((x): x is ClientItem => x !== null);

  return NextResponse.json({
    topicId: topic.id,
    topicSlug,
    count: safe.length,
    items: safe,
  });
}
