/**
 * Phase 7.5 — Topic matcher.
 *
 * Reads every OCR page under `data/raw/ocr/<filename>/page-NNN.txt`, and
 * scores each page against every demo-curriculum topic in the subject the
 * PDF belongs to. Output is written to
 *   data/matchers/<filename>.json
 * shaped as
 *   { subject: "MTH", pages: { "1": "mth-1-1", "2": "mth-1-1", ... } }
 *
 * Downstream (`embed-pdfs.ts --reset`) will consume the matcher output to
 * populate `chunks.topic_id` + `chunks.chapter_id` from the `topics`/
 * `chapters` DB tables at insert time.
 *
 * Scoring is intentionally simple — token bag overlap (jaccard-ish) of
 *   PAGE TOKENS  ∩  ( topic.title.or + topic.title.en + topic.objectives
 *                    + chapter.title.or + chapter.title.en )
 * We DO NOT rely on Gemini here: we want deterministic, free, offline
 * mapping that is easy to override manually.
 *
 * A hand-written override JSON may be placed at
 *   data/matchers/<filename>.override.json
 * of the form `{ "pages": { "12": "mth-2-1" } }` and those wins.
 *
 * Run:
 *   npx tsx scripts/ingest/topic-matcher.ts           # all subjects in ocr/
 *   npx tsx scripts/ingest/topic-matcher.ts --file=Algebra
 *   npx tsx scripts/ingest/topic-matcher.ts --dry-run
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CURRICULUM, RAG_ONLY_SUBJECTS } from "../../lib/curriculum/bse-class9";

const OCR_DIR = join(process.cwd(), "data", "raw", "ocr");
const OUT_DIR = join(process.cwd(), "data", "matchers");

const FLAGS = {
  fileFilter: process.argv.find((a) => a.startsWith("--file="))?.slice(7) ?? null,
  dryRun: process.argv.includes("--dry-run"),
};

/** PDF filename -> subject code (keyword-driven; mirrors embed-pdfs classify). */
function subjectOfFile(filename: string): string | null {
  const n = filename.toLowerCase();
  if (/(algebra|bijaganit|geometry|math|ଵୀଜଗଣିତ|ଜ୍ୟାମିତି|ଗଣିତ)/.test(filename) || /(algebra|geometry|math)/.test(n))
    return "MTH";
  if (/(geography|bhugola|history|social|civics|ଭୂଗୋଳ|ଇତିହାସ)/.test(filename) || /(geography|history|civics)/.test(n))
    return "SSC";
  if (/(life science|physical science|biology|physics|chemistry|vigyan|ଜୀଵ ଵିଜ୍ଞାନ|ଭୌତିକ ଵିଜ୍ଞାନ|ଵିଜ୍ଞାନ)/.test(filename) || /(life science|physical science|biology|physics|chemistry)/.test(n))
    return "GSC";
  if (/(hindi|ହିନ୍ଦୀ|हिन्दी)/.test(filename) || /hindi/.test(n)) return "TLH";
  if (/(english|ଇଂରାଜୀ)/.test(filename) || /english/.test(n)) return "SLE";
  if (/(odia|ଓଡ଼ିଆ|ଓଡିଆ|mil|sahitya|ସାହିତ୍ୟ|ଧାରା)/.test(filename) || /\bmil\b/.test(n)) return "FLO";
  return null;
}

/** Split into lowercase alnum tokens incl. Odia + Devanagari code points. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

const STOPWORDS = new Set([
  "the", "and", "a", "an", "of", "in", "on", "to", "for", "from", "by", "is", "are", "was", "were", "be", "this", "that",
  "ଓ", "ଏ", "କୁ", "କି", "ଯେ", "ନି", "ରେ", "ରୁ", "ଏବଂ", "ଏହା", "ଏହି",
  "और", "में", "से", "की", "का", "है", "ही", "तो", "वह", "यह",
]);

type TopicLite = {
  id: string;          // topic slug (e.g. "mth-1-1") OR chapter slug if chapter-only
  chapterSlug: string;
  subjectCode: string;
  isChapterOnly: boolean;
  tokens: Set<string>;
};

function buildTopics(): TopicLite[] {
  const out: TopicLite[] = [];
  // Full topic curriculum (MTH, SSC).
  for (const sub of CURRICULUM) {
    for (const ch of sub.chapters) {
      for (const t of ch.topics) {
        const text = [
          ch.title.en,
          ch.title.or,
          ch.title.hi,
          t.title.en,
          t.title.or,
          t.title.hi,
          ...(t.objectives ?? []),
        ]
          .filter(Boolean)
          .join(" ");
        const toks = new Set(tokenize(text).filter((x) => !STOPWORDS.has(x)));
        out.push({
          id: t.id,
          chapterSlug: ch.slug,
          subjectCode: sub.code,
          isChapterOnly: false,
          tokens: toks,
        });
      }
    }
  }
  // Chapter-only RAG subjects (GSC, FLO, SLE, TLH) — match at chapter grain.
  for (const sub of RAG_ONLY_SUBJECTS) {
    for (const ch of sub.chapters) {
      const text = [ch.title.en, (ch.title as any).or, (ch.title as any).hi]
        .filter(Boolean)
        .join(" ");
      const toks = new Set(tokenize(text).filter((x) => !STOPWORDS.has(x)));
      out.push({
        id: ch.slug,
        chapterSlug: ch.slug,
        subjectCode: sub.code,
        isChapterOnly: true,
        tokens: toks,
      });
    }
  }
  return out;
}

/** Overlap score: (|A ∩ B|^2) / |A| (favour topics whose vocab is covered). */
function score(pageTokens: Set<string>, topicTokens: Set<string>): number {
  if (topicTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of topicTokens) if (pageTokens.has(t)) overlap++;
  if (overlap === 0) return 0;
  return (overlap * overlap) / topicTokens.size;
}

type MatcherOut = {
  subject: string | null;
  totalPages: number;
  matchedPages: number;
  pages: Record<string, { topic: string | null; chapter: string; score: number } | null>;
};

function matchFile(filename: string, topics: TopicLite[]): MatcherOut {
  const subject = subjectOfFile(filename);
  const subjectTopics = subject ? topics.filter((t) => t.subjectCode === subject) : [];
  const dir = join(OCR_DIR, filename);
  const pageFiles = readdirSync(dir)
    .filter((f) => /^page-\d+\.txt$/.test(f))
    .sort();

  // Optional manual overrides.
  const overridePath = join(OUT_DIR, `${filename}.override.json`);
  const overrides: Record<string, string> = existsSync(overridePath)
    ? (JSON.parse(readFileSync(overridePath, "utf8")).pages ?? {})
    : {};

  const pages: MatcherOut["pages"] = {};
  let matched = 0;
  for (const f of pageFiles) {
    const pageNum = Number(f.match(/page-(\d+)\.txt/)![1]);
    const text = readFileSync(join(dir, f), "utf8");
    const toks = new Set(tokenize(text).filter((x) => !STOPWORDS.has(x)));
    const override = overrides[String(pageNum)];
    if (override) {
      const t = topics.find((x) => x.id === override);
      if (t) {
        pages[pageNum] = {
          topic: t.isChapterOnly ? null : t.id,
          chapter: t.chapterSlug,
          score: 1,
        };
        matched++;
        continue;
      }
    }
    if (subjectTopics.length === 0 || toks.size < 8) {
      pages[pageNum] = null;
      continue;
    }
    let best: { t: TopicLite; s: number } | null = null;
    for (const t of subjectTopics) {
      const s = score(toks, t.tokens);
      if (!best || s > best.s) best = { t, s };
    }
    if (best && best.s >= 0.15) {
      pages[pageNum] = {
        topic: best.t.isChapterOnly ? null : best.t.id,
        chapter: best.t.chapterSlug,
        score: +best.s.toFixed(3),
      };
      matched++;
    } else {
      pages[pageNum] = null;
    }
  }
  return { subject, totalPages: pageFiles.length, matchedPages: matched, pages };
}

function main() {
  if (!existsSync(OCR_DIR)) {
    console.log(`No OCR output at ${OCR_DIR}. Run scripts/ingest/ocr-bse-pdfs.ts first.`);
    return;
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const topics = buildTopics();
  console.log(`Loaded ${topics.length} topics from demo curriculum.`);

  const files = readdirSync(OCR_DIR).filter((f) => {
    const full = join(OCR_DIR, f);
    try {
      return readdirSync(full).some((x) => /^page-\d+\.txt$/.test(x));
    } catch {
      return false;
    }
  });

  let grandTotal = 0;
  let grandMatched = 0;
  for (const f of files) {
    if (FLAGS.fileFilter && !f.includes(FLAGS.fileFilter)) continue;
    const r = matchFile(f, topics);
    grandTotal += r.totalPages;
    grandMatched += r.matchedPages;
    const cov = r.totalPages ? ((r.matchedPages / r.totalPages) * 100).toFixed(1) : "0.0";
    console.log(`• ${f}  [${r.subject ?? "?"}]  ${r.matchedPages}/${r.totalPages} pages matched (${cov}%)`);
    if (!FLAGS.dryRun) {
      writeFileSync(join(OUT_DIR, `${f}.json`), JSON.stringify(r, null, 2), "utf8");
    }
  }
  const cov = grandTotal ? ((grandMatched / grandTotal) * 100).toFixed(1) : "0.0";
  console.log(`\nTotal: ${grandMatched}/${grandTotal} pages matched (${cov}%)`);
  if (!FLAGS.dryRun)
    console.log(`Output written to ${OUT_DIR}. Use data/matchers/<filename>.override.json to correct any miss.`);
}

main();
