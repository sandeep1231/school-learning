/**
 * Generate practice items for any board+class topics.
 *
 * For each topic:
 *   1. Load topic metadata from the DB (via slug → lib/curriculum/db.ts).
 *   2. Retrieve 8 top textbook chunks via topic-scoped hybrid RAG.
 *   3. Prompt Gemini with a strict JSON schema: 5 MCQ + 2 short + 1 long.
 *   4. Upsert into practice_items (status=published). Keyed by a stable
 *      content hash so re-running is a no-op unless --force is passed.
 *
 * Usage:
 *   npx tsx scripts/content/generate-practice.ts                     # all topics (default board/class)
 *   npx tsx scripts/content/generate-practice.ts --topic mth-1-1     # single topic
 *   npx tsx scripts/content/generate-practice.ts --subject MTH       # all topics in subject
 *   npx tsx scripts/content/generate-practice.ts --class 9 --board BSE_ODISHA --subject FLO,GSC,SLE,TLH
 *   npx tsx scripts/content/generate-practice.ts --limit 3           # first N topics
 *   npx tsx scripts/content/generate-practice.ts --force             # overwrite existing
 */
import crypto from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { CHAT_MODEL, SAFETY_SETTINGS, getGemini } from "@/lib/ai/gemini";
import { retrieveForScope } from "@/lib/ai/rag";
import {
  ensureCurriculum,
  getTopicBySlug,
  listTopicsForClass,
  resolveTopicPath,
} from "@/lib/curriculum/db";
import { formatBoardLabel } from "@/lib/curriculum/boards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLanguage } from "@/lib/types";
import { languageProfileFor, type SubjectLanguageProfile } from "./language-profile";
import { CostCap, parseCapArgs } from "./cost-cap";

type Args = {
  topicSlugs: string[] | null;
  subjectCodes: string[] | null;
  classLevel: number;
  board: string;
  limit: number | null;
  force: boolean;
};

function parseArgs(): Args {
  // Supports: --topic X, --subject X[,Y...], --class N, --board CODE,
  //           --limit N, --force, AND bare positional topic ids.
  // Positional is important because `npm run content:practice -- --topic X`
  // has npm swallow `--topic`.
  // PowerShell mangles unquoted commas to spaces; accept both separators.
  const argv = process.argv.slice(2);
  const out: Args = {
    topicSlugs: null,
    subjectCodes: null,
    classLevel: 9,
    board: "BSE_ODISHA",
    limit: null,
    force: false,
  };
  const positional: string[] = [];
  const splitList = (raw: string | undefined) =>
    (raw ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--topic") {
      const v = argv[++i];
      if (v) {
        const slugs = v.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
        if (slugs.length > 0) (out.topicSlugs ??= []).push(...slugs);
      }
    } else if (a.startsWith("--topic=")) {
      const slugs = a.slice("--topic=".length).split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
      if (slugs.length > 0) (out.topicSlugs ??= []).push(...slugs);
    } else if (a === "--subject") {
      const list = splitList(argv[++i]);
      if (list.length > 0) out.subjectCodes = list;
    } else if (a.startsWith("--subject=")) {
      const list = splitList(a.slice("--subject=".length));
      if (list.length > 0) out.subjectCodes = list;
    } else if (a === "--class") out.classLevel = Number(argv[++i]);
    else if (a.startsWith("--class=")) out.classLevel = Number(a.slice("--class=".length));
    else if (a === "--board") out.board = String(argv[++i]).toUpperCase();
    else if (a.startsWith("--board=")) out.board = a.slice("--board=".length).toUpperCase();
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--force") out.force = true;
    else if (a === "--max-calls" || a === "--max-tokens") { i++; /* consumed by parseCapArgs */ }
    else if (a.startsWith("--max-calls=") || a.startsWith("--max-tokens=")) { /* consumed by parseCapArgs */ }
    else if (!a.startsWith("--")) positional.push(a);
  }
  if (positional.length > 0) {
    out.topicSlugs = [...(out.topicSlugs ?? []), ...positional];
  }
  return out;
}

/** Per-board primary instructional language for generated content. */
function primaryLanguageFor(board: string): AppLanguage {
  switch (board) {
    case "BSE_ODISHA":
      return "or";
    default:
      return "en";
  }
}

type GeneratedMcq = {
  kind: "mcq";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correct_index: number;
  /**
   * Phase 9.7 — misconception slug per wrong option (null for the correct one).
   * Array length matches options[]. Optional in the model response; absent
   * arrays get passed through as-is.
   */
  misconceptions?: (string | null)[];
  explanation: string;
  citation_chunk: number | null;
};
type GeneratedRubricCriterion = {
  criterion: string;
  weight: number;
  keywords: string[];
};
type GeneratedFreeText = {
  kind: "short" | "long";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  model_answer: string;
  keywords: string[];
  /**
   * Phase 9.11 — optional weighted rubric. Required for kind="long", optional
   * for kind="short". Weights are summed; any positive numbers work.
   */
  rubric?: GeneratedRubricCriterion[];
  explanation: string;
  citation_chunk: number | null;
};
type Generated = GeneratedMcq | GeneratedFreeText;

type GeminiReturn = { items: Generated[] };

/** Doubles single backslashes that aren't part of valid JSON escapes
 * (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX). Gemini sometimes emits raw
 * LaTeX like `$x \in S$` inside JSON strings, breaking JSON.parse. */
function repairJsonBackslashes(s: string): string {
  return s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function buildPrompt(
  topicTitle: string,
  subjectName: string,
  chapterTitle: string,
  chunks: Array<{ idx: number; text: string; page: number | null; title: string }>,
  ctx: { boardLabel: string; classLevel: number; profile: SubjectLanguageProfile },
): string {
  const context = chunks
    .map(
      (c) =>
        `[[${c.idx}]] page=${c.page ?? "?"} source="${c.title}"\n${c.text.trim()}`,
    )
    .join("\n\n---\n\n");

  const language = ctx.profile.language;
  const isOdia = language === "or";
  const isHindi = language === "hi";
  const isEnglish = language === "en";
  // Build a practice-flavoured language directive from the profile. We
  // reuse the same bilingual instruction so question text and helper
  // sentences match the lesson_variants of the same subject.
  const langLine = `${ctx.profile.bilingualInstruction} The questions, options, and answers below MUST follow the same language pattern.`;
  const keywordsHint = isOdia
    ? "keywords is 3-6 key Odia/English terms."
    : isHindi
    ? "keywords is 3-6 key Hindi/English terms."
    : "keywords is 3-6 key terms.";
  const longKeywordsHint = isOdia
    ? "keywords is 4-8 terms (Odia or English)."
    : isHindi
    ? "keywords is 4-8 terms (Hindi or English)."
    : "keywords is 4-8 terms.";

  return `You are a ${ctx.boardLabel} Class ${ctx.classLevel} teacher creating practice questions. Generate EXACTLY 8 items for the topic below — grounded ONLY in the provided CONTEXT.

SUBJECT: ${subjectName}
CHAPTER: ${chapterTitle}
TOPIC: ${topicTitle}

ITEM MIX (required):
- 5 multiple-choice questions (kind="mcq"): 2 easy, 2 medium, 1 hard.
  Each MCQ has exactly 4 options, correct_index (0-3), 1-2 sentence explanation.
  MISCONCEPTIONS: supply a "misconceptions" array of length 4 aligned with options. For the correct option use null. For each wrong option use a short lowercase snake_case slug naming the error the student is making, e.g. "off_by_one", "sign_error", "order_of_operations", "subset_vs_proper_subset", "unit_confusion", "rounding_error", "distributive_missing". Prefer reusing slugs across items.
- 2 short-answer questions (kind="short"): 1 medium, 1 hard.
  model_answer is 1-3 sentences. ${keywordsHint}
- 1 long-answer question (kind="long"): difficulty=hard.
  model_answer is a 4-8 sentence complete answer. ${longKeywordsHint}
  RUBRIC (required for long): supply a "rubric" array of 3-4 items shaped { "criterion": string, "weight": number, "keywords": [string, ...] }. Each criterion names a dimension being assessed (e.g. "Definition", "Example", "Notation", "Reasoning"). Weights are positive numbers summing to roughly 4; heavier weights for more important criteria. Keywords are 2-5 short terms (Odia or English) a model answer should contain for that criterion. Criterion labels in English for analytics; keywords may be in Odia.

${langLine}

MATH:
- Use KaTeX / LaTeX math syntax inside markdown for all expressions. Inline: $...$. Display: $$...$$
- Examples: $x^2 + y^2$, $\frac{a}{b}$, $\sqrt{2}$, $a \ne b$, $\in$, $\subseteq$.
- NEVER write math as plain text (do not write x^2 or x squared).
- MCQ options may contain inline math; keep each option concise.

GROUNDING:
- Every item must have citation_chunk set to the [[n]] number of the CONTEXT chunk it's based on. If the item synthesises across chunks, pick the most important one. If you cannot ground an item, set citation_chunk=null but try not to.
- Do NOT invent facts outside CONTEXT.

OUTPUT: Respond with a single JSON object matching this TypeScript type exactly — no prose, no markdown fences:

{
  "items": [
    { "kind": "mcq", "difficulty": "easy"|"medium"|"hard", "question": string, "options": [string, string, string, string], "correct_index": 0|1|2|3, "misconceptions": [string|null, string|null, string|null, string|null], "explanation": string, "citation_chunk": number|null },
    { "kind": "short"|"long", "difficulty": "easy"|"medium"|"hard", "question": string, "model_answer": string, "keywords": [string, ...], "rubric": [{ "criterion": string, "weight": number, "keywords": [string, ...] }, ...]?, "explanation": string, "citation_chunk": number|null }
  ]
}

CONTEXT:
${context}`;
}

function contentHash(g: Generated): string {
  return crypto.createHash("sha1").update(g.question.trim()).digest("hex").slice(0, 16);
}

function toRow(
  g: Generated,
  opts: {
    topicUuid: string;
    sourceChunkIds: string[];
    citationPage: number | null;
    citationTitle: string | null;
    language: "or" | "en" | "hi";
  },
) {
  const base = {
    scope_type: "topic" as const,
    scope_id: opts.topicUuid,
    kind: g.kind,
    difficulty: g.difficulty,
    language: opts.language,
    question_md: g.question,
    explanation_md: g.explanation ?? null,
    source_chunk_ids: opts.sourceChunkIds,
    citation_page: opts.citationPage,
    citation_title: opts.citationTitle,
    status: "published" as const,
  };
  if (g.kind === "mcq") {
    const misconceptions = Array.isArray(g.misconceptions)
      ? g.misconceptions.slice(0, g.options.length).map((m) => {
          if (m == null) return null;
          const s = String(m).trim().toLowerCase();
          return s.length === 0 || s.length > 60 ? null : s;
        })
      : null;
    const payload: Record<string, unknown> = {
      options: g.options,
      correct_index: g.correct_index,
    };
    if (misconceptions && misconceptions.some((m) => m !== null)) {
      payload.misconceptions = misconceptions;
    }
    return { ...base, payload };
  }
  const payload: Record<string, unknown> = {
    model_answer: g.model_answer,
    keywords: g.keywords,
  };
  if (Array.isArray(g.rubric) && g.rubric.length > 0) {
    const rubric = g.rubric
      .map((c) => {
        const criterion = String(c.criterion ?? "").trim().slice(0, 80);
        const weight = Number(c.weight);
        const keywords = Array.isArray(c.keywords)
          ? c.keywords
              .map((k) => String(k ?? "").trim())
              .filter((k) => k.length > 0 && k.length <= 60)
              .slice(0, 6)
          : [];
        if (!criterion || !Number.isFinite(weight) || weight <= 0 || keywords.length === 0) {
          return null;
        }
        return { criterion, weight, keywords };
      })
      .filter((c): c is GeneratedRubricCriterion => c !== null);
    if (rubric.length > 0) payload.rubric = rubric;
  }
  return { ...base, payload };
}

async function generateForTopic(
  topic: { slug: string; titleEn: string; titleOr: string; chapterTitle: string; subjectName: string; uuid: string; subjectCode: string },
  force: boolean,
  ctx: { boardLabel: string; classLevel: number; profile: SubjectLanguageProfile; cap: CostCap },
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const supabase = createAdminClient();
  const language = ctx.profile.language;

  // Skip if already populated, unless --force.
  if (!force) {
    const { count } = await supabase
      .from("practice_items")
      .select("id", { count: "exact", head: true })
      .eq("scope_type", "topic")
      .eq("scope_id", topic.uuid)
      .eq("status", "published");
    if ((count ?? 0) >= 6) {
      return { inserted: 0, skipped: count ?? 0 };
    }
  }

  // Retrieval. Try topic-scoped first; fall back to subject-scope biased
  // with the chapter title when chunks aren't topic-tagged (current state
  // of the bulk-ingested textbook PDFs — all 954 chunks have topic_id=null).
  const retrievalQuery = `${topic.chapterTitle}\n${topic.titleOr}\n${topic.titleEn}`;
  // Retrieval intentionally does NOT filter by output language: source
  // chunks for BSE Odisha are stored with language='or' even when the
  // generated content is English (SLE) or Hindi (TLH).
  let chunks = await retrieveForScope({
    query: retrievalQuery,
    topicId: topic.uuid,
    includeNeighbours: true,
    k: 8,
  });
  if (chunks.length === 0) {
    chunks = await retrieveForScope({
      query: retrievalQuery,
      subjectCode: topic.subjectCode,
      k: 8,
      chapterHint: `${topic.chapterTitle} — ${topic.titleOr}`,
    });
  }
  if (chunks.length === 0) {
    return { inserted: 0, skipped: 0, error: "no_chunks" };
  }

  const indexed = chunks.map((c, i) => ({
    idx: i + 1,
    id: c.id,
    text: c.content,
    page: c.page,
    title: c.documentTitle,
  }));

  const prompt = buildPrompt(
    `${topic.titleOr} (${topic.titleEn})`,
    topic.subjectName,
    topic.chapterTitle,
    indexed,
    ctx,
  );

  const client = getGemini();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    safetySettings: SAFETY_SETTINGS as any,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 32768,
    },
  });

  let parsed: GeminiReturn | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    let text = "";
    try {
      const res = await model.generateContent(prompt);
      ctx.cap.record(res);
      text = res.response.text().trim();
    } catch (e) {
      lastErr = `network: ${(e as Error).message}`;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const candidates = [text, repairJsonBackslashes(text)];
    for (const c of candidates) {
      try {
        parsed = JSON.parse(c);
        break;
      } catch (e) {
        lastErr = `bad_json: ${(e as Error).message}`;
      }
    }
  }
  if (!parsed) {
    return { inserted: 0, skipped: 0, error: lastErr };
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) {
    return { inserted: 0, skipped: 0, error: "empty_items" };
  }

  // If --force, wipe previous topic items first (keep attempts via ON DELETE CASCADE? Attempts cascade — only OK if force).
  if (force) {
    await supabase
      .from("practice_items")
      .delete()
      .eq("scope_type", "topic")
      .eq("scope_id", topic.uuid);
  }

  // Skip items whose question hash already exists (de-dupe on re-runs).
  const { data: existing } = await supabase
    .from("practice_items")
    .select("question_md")
    .eq("scope_type", "topic")
    .eq("scope_id", topic.uuid);
  const existingHashes = new Set(
    (existing ?? []).map((r: { question_md: string }) =>
      crypto.createHash("sha1").update(r.question_md.trim()).digest("hex").slice(0, 16),
    ),
  );

  const rows = items
    .filter((g) => !existingHashes.has(contentHash(g)))
    .map((g) => {
      const chunk =
        g.citation_chunk != null && indexed[g.citation_chunk - 1]
          ? indexed[g.citation_chunk - 1]
          : indexed[0];
      return toRow(g, {
        topicUuid: topic.uuid,
        sourceChunkIds: [chunk.id],
        citationPage: chunk.page,
        citationTitle: chunk.title,
        language,
      });
    });

  if (rows.length === 0) return { inserted: 0, skipped: items.length };

  const { error } = await supabase.from("practice_items").insert(rows);
  if (error) return { inserted: 0, skipped: 0, error: error.message };

  return { inserted: rows.length, skipped: items.length - rows.length };
}

async function main() {
  const args = parseArgs();
  await ensureCurriculum();

  const boardLabel = formatBoardLabel(args.board);

  type Target = {
    slug: string;
    titleEn: string;
    titleOr: string;
    chapterTitle: string;
    subjectName: string;
    uuid: string;
    subjectCode: string;
  };
  let targets: Target[] = [];

  if (args.topicSlugs && args.topicSlugs.length > 0) {
    for (const slug of args.topicSlugs) {
      const r = await resolveTopicPath(slug);
      if (!r) {
        console.log(`  ✗ ${slug}: no DB row`);
        continue;
      }
      targets.push({
        slug,
        titleEn: r.topic.title.en,
        titleOr: r.topic.title.or ?? r.topic.title.en,
        chapterTitle: r.chapter.title.or ?? r.chapter.title.en,
        subjectName: r.subject.name.en,
        uuid: r.topic.id,
        subjectCode: r.subject.code,
      });
    }
  } else {
    const rows = await listTopicsForClass({
      board: args.board,
      classLevel: args.classLevel,
      subjectCodes: args.subjectCodes,
    });
    targets = rows
      .filter((r) => r.topic.slug != null)
      .map((r) => ({
        slug: r.topic.slug!,
        titleEn: r.topic.title.en,
        titleOr: r.topic.title.or ?? r.topic.title.en,
        chapterTitle: r.chapter.title.or ?? r.chapter.title.en,
        subjectName: r.subject.name.en,
        uuid: r.topic.id,
        subjectCode: r.subject.code,
      }));
  }

  if (args.limit) targets = targets.slice(0, args.limit);

  console.log(
    `Generating practice items for ${targets.length} topic(s) — ${boardLabel} Class ${args.classLevel}…`,
  );

  const cap = new CostCap(parseCapArgs(process.argv.slice(2)));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let aborted = false;
  for (const t of targets) {
    if (cap.isOverCap()) {
      console.log(`\nCost cap reached: ${cap.reason}. Stopping.`);
      aborted = true;
      break;
    }
    const profile = languageProfileFor(args.board, t.subjectCode);
    const ctx = { boardLabel, classLevel: args.classLevel, profile, cap };
    const result = await generateForTopic(t, args.force, ctx);
    if (result.error) {
      console.log(`  ✗ ${t.slug} [${profile.language}]: ${result.error}`);
      failed++;
    } else if (result.inserted > 0) {
      console.log(
        `  ✓ ${t.slug} [${profile.language}]: +${result.inserted} items (skipped ${result.skipped})`,
      );
      ok++;
    } else {
      console.log(`  · ${t.slug} [${profile.language}]: already has ${result.skipped} items`);
      skipped++;
    }
  }

  console.log(
    `\nDone. ok=${ok}, skipped=${skipped}, failed=${failed}, total=${targets.length}${aborted ? " (aborted by cost cap)" : ""}. ${cap.summary()}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
