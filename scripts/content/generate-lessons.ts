/**
 * Generate 3-level lesson variants for any board+class topics.
 *
 * For each topic:
 *   1. Load metadata from the DB.
 *   2. Retrieve 8 textbook chunks (topic-scoped → subject-scoped fallback).
 *   3. Prompt Gemini with a strict JSON schema: textbook + simpler + parent + exam.
 *   4. Upsert into lesson_variants (one row per variant).
 *
 * Usage:
 *   npx tsx scripts/content/generate-lessons.ts mth-1-1
 *   npx tsx scripts/content/generate-lessons.ts --subject MTH
 *   npx tsx scripts/content/generate-lessons.ts --class 9 --board BSE_ODISHA --subject FLO
 *   npx tsx scripts/content/generate-lessons.ts --class 9 --subject FLO,GSC,SLE,TLH
 *   npx tsx scripts/content/generate-lessons.ts --limit 3
 *   npx tsx scripts/content/generate-lessons.ts --force
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { CHAT_MODEL, SAFETY_SETTINGS, getGemini } from "@/lib/ai/gemini";
import { retrieveForScope } from "@/lib/ai/rag";
import {
  ensureCurriculum,
  getTopicBySlug,
  listTopicsForClass,
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
  // PowerShell turns unquoted `--subject FLO,GSC` into one arg "FLO GSC";
  // accept either separator. Same for board codes if ever multi.
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

/**
 * Build the LANGUAGE block of the prompt from the language profile.
 * For language-learning subjects (English/Hindi/Odia-MIL) we ask the
 * model to weave a helper-language sentence after each section so the
 * lesson is bilingual end-to-end.
 */
function langBlock(profile: SubjectLanguageProfile): string {
  return profile.bilingualInstruction;
}

type Variant = "textbook" | "simpler" | "parent" | "exam";

type GeneratedVariant = {
  variant: Variant;
  body_md: string;
  citation_chunks: number[];
  parent_prompts?: { questions: string[]; tips: string[] };
};

type GeminiReturn = { variants: GeneratedVariant[] };

/**
 * Gemini frequently returns LaTeX like `$x \in S$` with single backslashes
 * inside JSON strings, which is not valid JSON (only \", \\, \/, \b, \f, \n,
 * \r, \t, \uXXXX are legal). This repair doubles any backslash that is not
 * already a valid escape so JSON.parse succeeds. Applied as a fallback only.
 */
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

  const isOdia = ctx.profile.language === "or";
  const isHindi = ctx.profile.language === "hi";
  const langLine = langBlock(ctx.profile);

  const examHeadings = isOdia
    ? `## ପରୀକ୍ଷାରେ କି ପଚାରାଯାଏ (What gets asked)
       Enumerate 3-5 concrete question patterns seen in board papers for this
       topic.
     ## ସାଧାରଣ ଭୁଲ୍ (Common mistakes)
       3-5 bullet points of typical errors, each 1 sentence.
     ## ସ୍କୋରିଂ ସୂଚକ (Scoring hints)
       3-4 bullets on how to pick up full marks — what to state, label,
       justify, or write step-by-step.
     ## ଅଭ୍ଯାସ ପ୍ରଶ୍ନ (Practice prompts)
       2-3 short prompts the student can attempt right now, each 1 line.`
    : isHindi
    ? `## परीक्षा में क्या पूछा जाता है (What gets asked)
       Enumerate 3-5 concrete question patterns seen in board papers for this
       topic.
     ## सामान्य गलतियाँ (Common mistakes)
       3-5 bullet points of typical errors, each 1 sentence.
     ## स्कोरिंग संकेत (Scoring hints)
       3-4 bullets on how to pick up full marks — what to state, label,
       justify, or write step-by-step.
     ## अभ्यास प्रश्न (Practice prompts)
       2-3 short prompts the student can attempt right now, each 1 line.`
    : `## What gets asked
       Enumerate 3-5 concrete question patterns seen in board papers for this
       topic.
     ## Common mistakes
       3-5 bullet points of typical errors, each 1 sentence.
     ## Scoring hints
       3-4 bullets on how to pick up full marks — what to state, label,
       justify, or write step-by-step.
     ## Practice prompts
       2-3 short prompts the student can attempt right now, each 1 line.`;

  return `You are a ${ctx.boardLabel} Class ${ctx.classLevel} teacher writing a lesson for a student. Produce FOUR variants of the same lesson, grounded ONLY in CONTEXT.

SUBJECT: ${subjectName}
CHAPTER: ${chapterTitle}
TOPIC: ${topicTitle}

${langLine}

MATH & DIAGRAMS:
- Use KaTeX / LaTeX math syntax inside markdown. Inline: $...$. Display: $$...$$
- Examples: $x^2 + y^2 = r^2$, $\frac{a}{b}$, $\sqrt{2}$, $a \ne b$, $\in$, $\subseteq$.
- NEVER write math as plain text (do not write x^2, x squared, or (a/b); always wrap in $).
- For geometry, set theory, or flow diagrams use fenced \`\`\`mermaid code blocks. Prefer mermaid flowcharts and Venn-like block diagrams (using \`graph TD\` or \`graph LR\`).
- Keep mermaid blocks short (≤ 12 nodes) and self-contained.

VARIANTS (produce EXACTLY these four, in this order):

1. variant="textbook" — Formal, comprehensive, mirrors textbook structure.
   Length: 400-700 words. Use markdown headings (##), bullet lists, and 1-2
   worked examples. Keep terminology precise.

2. variant="simpler" — Friendlier, concise, relatable. For a student who
   struggled with the textbook version. Length: 250-400 words. Use short
   paragraphs, everyday examples/analogies, and 1 worked example. Avoid
   heavy jargon; when you must use a technical term, briefly explain it.

3. variant="parent" — A coaching script for a PARENT to read WITH their
   child. Length: 200-350 words. Second-person, warm tone. Suggest when to
   pause and check understanding. DO NOT solve problems — guide the parent
   to ask the child to solve.
   Also return parent_prompts with:
     - questions: array of 4-6 specific questions the parent should ask the
       child while/after reading the lesson.
     - tips: array of 2-3 coaching tips (e.g. "let them struggle for 30s
       before helping").

4. variant="exam" — Board-exam preparation angle for ${ctx.boardLabel} Class ${ctx.classLevel}. Length: 250-450
   words. Structure (use these exact headings):
${examHeadings}
   Keep it dense and checklist-like — NOT a narrative.

GROUNDING:
- Every variant lists citation_chunks (array of [[n]] numbers) — the CONTEXT
  chunks it drew from. Include at least one per variant.
- Do NOT invent facts outside CONTEXT.

OUTPUT: Respond with a single JSON object — no prose, no markdown fences:

{
  "variants": [
    { "variant": "textbook", "body_md": string, "citation_chunks": [number, ...] },
    { "variant": "simpler",  "body_md": string, "citation_chunks": [number, ...] },
    { "variant": "parent",   "body_md": string, "citation_chunks": [number, ...],
      "parent_prompts": { "questions": [string, ...], "tips": [string, ...] } },
    { "variant": "exam",     "body_md": string, "citation_chunks": [number, ...] }
  ]
}

CONTEXT:
${context}`;
}

async function generateForTopic(
  topic: {
    slug: string;
    titleEn: string;
    titleOr: string;
    chapterTitle: string;
    subjectName: string;
    uuid: string;
    subjectCode: string;
  },
  force: boolean,
  ctx: { boardLabel: string; classLevel: number; profile: SubjectLanguageProfile; cap: CostCap },
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const supabase = createAdminClient();
  const language = ctx.profile.language;

  if (!force) {
    const { count } = await supabase
      .from("lesson_variants")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic.uuid)
      .eq("language", language);
    if ((count ?? 0) >= 4) {
      return { inserted: 0, skipped: count ?? 0 };
    }
  }

  const retrievalQuery = `${topic.chapterTitle}\n${topic.titleOr}\n${topic.titleEn}`;
  // Retrieval intentionally does NOT filter by output language: source
  // chunks for BSE Odisha are stored with language='or' even when the
  // generated lesson is English (SLE) or Hindi (TLH). The model handles
  // the translation/explanation in the prompt.
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
    if (!parsed) {
      try {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync("data/reports/llm-debug", { recursive: true });
        writeFileSync(
          `data/reports/llm-debug/${topic.slug}-attempt-${attempt + 1}.json`,
          text,
          "utf8",
        );
      } catch {
        /* ignore */
      }
    }
  }
  if (!parsed) {
    return { inserted: 0, skipped: 0, error: lastErr };
  }

  const variants = Array.isArray(parsed.variants) ? parsed.variants : [];
  const valid = variants.filter(
    (v) =>
      v &&
      (v.variant === "textbook" ||
        v.variant === "simpler" ||
        v.variant === "parent" ||
        v.variant === "exam") &&
      typeof v.body_md === "string" &&
      v.body_md.trim().length > 0,
  );
  // Gemini occasionally returns duplicate variants in one batch (e.g. two
  // "simpler" entries). Dedupe keeping the first to avoid Postgres UPSERT
  // "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const seenVariants = new Set<string>();
  const deduped = valid.filter((v) => {
    if (seenVariants.has(v.variant)) return false;
    seenVariants.add(v.variant);
    return true;
  });
  if (deduped.length === 0) {
    return { inserted: 0, skipped: 0, error: "empty_variants" };
  }

  if (force) {
    await supabase
      .from("lesson_variants")
      .delete()
      .eq("topic_id", topic.uuid)
      .eq("language", language);
  }

  const rows = deduped.map((v) => {
    const citedIds = (v.citation_chunks ?? [])
      .map((n) => indexed[n - 1]?.id)
      .filter((x): x is string => typeof x === "string");
    const firstChunk =
      (v.citation_chunks ?? [])
        .map((n) => indexed[n - 1])
        .find((c) => c != null) ?? indexed[0];
    const citations = [
      {
        title: firstChunk.title,
        page: firstChunk.page,
        chunk_idx: firstChunk.idx,
      },
    ];
    return {
      topic_id: topic.uuid,
      variant: v.variant,
      language,
      body_md: v.body_md,
      parent_prompts:
        v.variant === "parent" && v.parent_prompts ? v.parent_prompts : null,
      citations,
      source_chunk_ids: citedIds.length > 0 ? citedIds : [firstChunk.id],
    };
  });

  const { error } = await supabase
    .from("lesson_variants")
    .upsert(rows, { onConflict: "topic_id,variant,language" });
  if (error) return { inserted: 0, skipped: 0, error: error.message };

  return { inserted: rows.length, skipped: 0 };
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
    // Explicit slug list — works regardless of class/board.
    const { resolveTopicPath } = await import("@/lib/curriculum/db");
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
    `Generating lesson variants for ${targets.length} topic(s) — ${boardLabel} Class ${args.classLevel}…`,
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
      console.log(`  ✓ ${t.slug} [${profile.language}]: +${result.inserted} variants`);
      ok++;
    } else {
      console.log(`  · ${t.slug} [${profile.language}]: already has ${result.skipped} variants`);
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
