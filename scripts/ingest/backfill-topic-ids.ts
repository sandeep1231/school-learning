/**
 * Topic-id backfill for already-ingested chunks.
 *
 * Problem:
 *   Some subjects (C6/C7 CMP, C9 FLO/GSC/SLE/TLH) have textbook chunks in
 *   the `chunks` table tied to a `document_id` (and therefore a subject)
 *   but with `topic_id IS NULL` and `chapter_id IS NULL`. The chat tutor
 *   still retrieves them via subject-scope fallback, but topic-scoped
 *   queries (used by lesson generation and the more precise tutor path)
 *   miss them, so the user-visible quality is lower than it could be.
 *
 * What this script does:
 *   1. Loads the curriculum (subjects → chapters → topics) from the DB
 *      for the requested (class, subject) combos.
 *   2. Pre-tokenizes each topic's title (en + or + hi) + learning
 *      objectives + parent-chapter title into a search bag.
 *   3. Pages through untagged chunks for the affected documents and
 *      scores each chunk's content tokens against every topic in the
 *      same subject. Highest-scoring topic wins if the overlap clears
 *      the configurable `--min-score` threshold (default 3 token hits).
 *   4. Updates `chunks.topic_id` and `chunks.chapter_id` in batches.
 *
 * Scoring is intentionally token-based (no embedding calls) so the
 * backfill is free, deterministic, and re-runnable. For chunks that
 * fall below the threshold the script reports them as "unassigned"
 * — those are typically prefaces, indices, or boilerplate that
 * legitimately don't belong to any specific topic.
 *
 * Usage:
 *   npx tsx scripts/ingest/backfill-topic-ids.ts --class 6 --subject CMP
 *   npx tsx scripts/ingest/backfill-topic-ids.ts --class 9 --subject FLO,GSC,SLE,TLH
 *   npx tsx scripts/ingest/backfill-topic-ids.ts --class 6 --subject CMP --dry-run
 *   npx tsx scripts/ingest/backfill-topic-ids.ts --class 6 --subject CMP --min-score 4
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "../../lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

type Args = {
  classLevel: number;
  subjectCodes: string[];
  dryRun: boolean;
  minScore: number;
  pageSize: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    classLevel: 0,
    subjectCodes: [],
    dryRun: false,
    minScore: 3,
    pageSize: 500,
  };
  const splitList = (raw: string | undefined) =>
    (raw ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--class") out.classLevel = Number(argv[++i]);
    else if (a.startsWith("--class=")) out.classLevel = Number(a.slice(8));
    else if (a === "--subject") out.subjectCodes = splitList(argv[++i]);
    else if (a.startsWith("--subject=")) out.subjectCodes = splitList(a.slice(10));
    else if (a === "--dry-run" || a === "--dry") out.dryRun = true;
    else if (a === "--min-score") out.minScore = Number(argv[++i]);
    else if (a.startsWith("--min-score=")) out.minScore = Number(a.slice(12));
    else if (a === "--page-size") out.pageSize = Number(argv[++i]);
  }
  if (!out.classLevel) throw new Error("Missing --class N");
  if (out.subjectCodes.length === 0)
    throw new Error("Missing --subject CODE[,CODE...]");
  return out;
}

const STOPWORDS = new Set([
  "the", "and", "a", "an", "of", "in", "on", "to", "for", "from", "by", "is",
  "are", "was", "were", "be", "this", "that", "with", "or", "if", "as", "at",
  "we", "you", "he", "she", "it", "they", "but", "not", "all", "any", "some",
  "ଓ", "ଏ", "କୁ", "କି", "ଯେ", "ନି", "ରେ", "ରୁ", "ଏବଂ", "ଏହା", "ଏହି", "ର", "ଯାହା",
  "और", "में", "से", "की", "का", "है", "ही", "तो", "वह", "यह", "जो", "के",
]);

function tokenize(s: string): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

type DbTopic = {
  id: string;
  slug: string | null;
  chapter_id: string;
  title_en: string;
  title_or: string | null;
  title_hi: string | null;
  learning_objectives: unknown;
};

type ScoredTopic = {
  topicId: string;
  chapterId: string;
  slug: string | null;
  title: string;
  // Token bag for this topic — tokens are unique.
  tokens: Set<string>;
};

function buildTopicBag(t: DbTopic, chapterTitle: string): ScoredTopic {
  const objs = Array.isArray(t.learning_objectives)
    ? (t.learning_objectives as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const text = [
    t.title_en,
    t.title_or ?? "",
    t.title_hi ?? "",
    chapterTitle,
    ...objs,
  ].join(" ");
  return {
    topicId: t.id,
    chapterId: t.chapter_id,
    slug: t.slug,
    title: t.title_en,
    tokens: new Set(tokenize(text)),
  };
}

function score(chunkTokens: Set<string>, topic: ScoredTopic): number {
  let s = 0;
  for (const tok of topic.tokens) if (chunkTokens.has(tok)) s += 1;
  return s;
}

async function main() {
  const args = parseArgs();
  const sb = createAdminClient();

  console.log(
    `\n=== Backfill topic_id for class ${args.classLevel}, subjects ${args.subjectCodes.join(",")} ===`,
  );
  console.log(
    `min-score=${args.minScore} page-size=${args.pageSize} dry-run=${args.dryRun}\n`,
  );

  for (const code of args.subjectCodes) {
    console.log(`-- ${code} --`);
    const { data: subj } = await sb
      .from("subjects")
      .select("id")
      .eq("board", "BSE_ODISHA")
      .eq("class_level", args.classLevel)
      .eq("code", code)
      .maybeSingle();
    if (!subj) {
      console.log(`  ⚠ no subject row found for C${args.classLevel} ${code}`);
      continue;
    }

    // Pull every topic in this subject + its chapter title.
    const { data: chapters } = await sb
      .from("chapters")
      .select("id, title_en, title_or")
      .eq("subject_id", subj.id);
    const chapterTitleById = new Map<string, string>();
    for (const c of chapters ?? [])
      chapterTitleById.set(
        c.id,
        `${c.title_en ?? ""} ${(c as any).title_or ?? ""}`,
      );
    const chapterIds = (chapters ?? []).map((c) => c.id);
    if (chapterIds.length === 0) {
      console.log(`  ⚠ no chapters in C${args.classLevel} ${code}`);
      continue;
    }
    const { data: topics } = await sb
      .from("topics")
      .select("id, slug, chapter_id, title_en, title_or, title_hi, learning_objectives")
      .in("chapter_id", chapterIds);
    if (!topics || topics.length === 0) {
      console.log(`  ⚠ no topics in C${args.classLevel} ${code}`);
      continue;
    }
    const topicBags = topics.map((t) =>
      buildTopicBag(t as DbTopic, chapterTitleById.get(t.chapter_id) ?? ""),
    );
    console.log(`  built ${topicBags.length} topic bags`);

    // Find documents owned by this subject — the universe of chunks to look at.
    const { data: docs } = await sb
      .from("documents")
      .select("id")
      .eq("subject_id", subj.id);
    const docIds = (docs ?? []).map((d) => d.id);
    if (docIds.length === 0) {
      console.log(`  ⚠ no documents for C${args.classLevel} ${code}`);
      continue;
    }

    // Page through untagged chunks. Use a stable order so re-runs are
    // idempotent if interrupted.
    let from = 0;
    let processed = 0;
    let assigned = 0;
    let unassigned = 0;
    const PAGE = args.pageSize;
    for (;;) {
      const { data: chunks, error } = await sb
        .from("chunks")
        .select("id, content")
        .in("document_id", docIds)
        .is("topic_id", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error(`  ✗ chunk read failed: ${error.message}`);
        break;
      }
      if (!chunks || chunks.length === 0) break;

      // Score and decide for each chunk.
      type Update = { id: string; topic_id: string; chapter_id: string };
      const updates: Update[] = [];
      for (const ch of chunks) {
        const tokens = new Set(tokenize((ch.content as string) ?? ""));
        let bestScore = 0;
        let best: ScoredTopic | null = null;
        for (const bag of topicBags) {
          const s = score(tokens, bag);
          if (s > bestScore) {
            bestScore = s;
            best = bag;
          }
        }
        if (best && bestScore >= args.minScore) {
          updates.push({
            id: ch.id as string,
            topic_id: best.topicId,
            chapter_id: best.chapterId,
          });
          assigned += 1;
        } else {
          unassigned += 1;
        }
        processed += 1;
      }

      if (!args.dryRun && updates.length > 0) {
        // Batch updates 100 at a time to keep payloads sensible.
        for (let i = 0; i < updates.length; i += 100) {
          const batch = updates.slice(i, i + 100);
          // PostgREST can't do bulk UPDATE with different values per row in
          // one call without an upsert. Issue per-row updates — at <500
          // chunks per subject this is bounded and fine.
          for (const u of batch) {
            const { error: upErr } = await sb
              .from("chunks")
              .update({ topic_id: u.topic_id, chapter_id: u.chapter_id })
              .eq("id", u.id);
            if (upErr) {
              console.error(`    ✗ update ${u.id}: ${upErr.message}`);
            }
          }
        }
      }

      // If we got fewer than a full page, we've drained all untagged chunks.
      // Note: after updates, the next page would skip them (topic_id IS NULL
      // changes), so we can stop when we've processed less than PAGE.
      if (chunks.length < PAGE) break;
      // If we DID NOT update (dry run), advance the offset; otherwise the
      // updated rows now fail the filter and the next .range() correctly
      // returns the next batch starting at `from`.
      if (args.dryRun) from += PAGE;
    }

    console.log(
      `  processed=${processed} assigned=${assigned} unassigned=${unassigned}${
        args.dryRun ? " (dry run, no writes)" : ""
      }`,
    );
  }

  console.log(`\n✓ backfill complete.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
