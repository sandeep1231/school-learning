/**
 * BSE Odisha Class 9 PDF ingest — free-tier pipeline.
 *
 * Reads every *.pdf under `data/raw/`, extracts text with `unpdf`
 * (pure JS, no native deps), chunks it, embeds with Gemini
 * `text-embedding-004` (free tier) and upserts rows into Supabase
 * `documents` + `chunks`.
 *
 * Usage:
 *   1. Drop textbook / syllabus PDFs into data/raw/.
 *   2. npm run ingest:embed
 *
 * No paid OCR. Scanned PDFs without a text layer will be skipped with a
 * warning — drop through Cloud Vision later if needed.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Polyfill Promise.try (Node 23+ feature). unpdf's bundled pdf.js requires it.
if (typeof (Promise as any).try !== "function") {
  (Promise as any).try = function <T>(
    fn: (...args: any[]) => T | PromiseLike<T>,
    ...args: any[]
  ): Promise<T> {
    return new Promise<T>((resolve) => resolve(fn(...args)));
  };
}

import { extractText, getDocumentProxy } from "unpdf";
import { createAdminClient } from "../../lib/supabase/admin";
import { embedBatch } from "../../lib/ai/gemini";

dotenvConfig({ path: ".env.local" });

const RAW_DIR = join(process.cwd(), "data", "raw");
const OCR_DIR = join(RAW_DIR, "ocr");
const MATCHERS_DIR = join(process.cwd(), "data", "matchers");
const CHUNK_CHARS = 3200; // ~800 tokens at 4 chars/token
const OVERLAP_CHARS = 480;
const EMBED_BATCH = 32;

/** Parsed CLI flags */
const FLAGS = {
  reset: process.argv.includes("--reset"),
  fileFilter: (() => {
    const f = process.argv.find((a) => a.startsWith("--file="));
    return f ? f.slice("--file=".length) : null;
  })(),
  preferOcr: !process.argv.includes("--no-ocr"),
};

type FileKind = {
  title: string;
  subjectCode: string | null;
  language: "en" | "or" | "hi";
  sourceType: "syllabus" | "textbook";
};

function classify(filename: string): FileKind {
  const name = filename.replace(/\.pdf$/i, "");
  const lower = name.toLowerCase();
  const isSyllabus = lower.includes("syllabus");
  const hasOdia = /[\u0B00-\u0B7F]/.test(name);
  const hasDevanagari = /[\u0900-\u097F]/.test(name);

  // Subject heuristics — English + Odia script + transliteration keywords.
  const has = (...needles: (string | RegExp)[]) =>
    needles.some((n) =>
      typeof n === "string" ? lower.includes(n) || name.includes(n) : n.test(name),
    );

  const subject =
    has("algebra", "bijaganit", "geometry", "math", "ଵୀଜଗଣିତ", "ଜ୍ୟାମିତି", "ଗଣିତ")
      ? "MTH"
      : has("geography", "bhugola", "history", "social", "civics", "ଭୂଗୋଳ", "ଇତିହାସ")
        ? "SSC"
        : has(
              "life science",
              "physical science",
              "biology",
              "physics",
              "chemistry",
              "vigyan",
              "ଜୀଵ ଵିଜ୍ଞାନ",
              "ଭୌତିକ ଵିଜ୍ଞାନ",
              "ଵିଜ୍ଞାନ",
            )
          ? "GSC"
          : has("hindi", "ହିନ୍ଦୀ", "हिन्दी")
            ? "TLH"
            : has("english", "ଇଂରାଜୀ")
              ? "SLE"
              : has(
                    "odia",
                    "ଓଡ଼ିଆ",
                    "ଓଡିଆ", // plain ଡ (U+0B21) variant used in some filenames
                    "mil",
                    "sahitya",
                    "ସାହିତ୍ୟ",
                    "ଧାରା",
                  )
                ? "FLO"
                : null; // sanskrit etc. → no subject linkage

  // Language of the TEXT inside the PDF: if filename is in Odia script
  // it's almost certainly the Odia-medium edition; English-only filenames
  // are English editions.
  const language: FileKind["language"] = hasOdia
    ? "or"
    : hasDevanagari || has("hindi")
      ? "hi"
      : "en";

  return {
    title: name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim(),
    subjectCode: subject,
    language,
    sourceType: isSyllabus ? "syllabus" : "textbook",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedBatchWithRetry(texts: string[]): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    try {
      return await embedBatch(texts);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const is429 = msg.includes("429") || /quota|rate/i.test(msg);
      if (!is429 || attempt >= 5) throw err;
      const backoff = 2000 * 2 ** attempt; // 2s, 4s, 8s, 16s, 32s
      console.warn(`    ⚠ rate-limited, retry in ${backoff}ms…`);
      await sleep(backoff);
      attempt++;
    }
  }
}

async function pdfToText(path: string): Promise<string> {
  const buf = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

/**
 * OCR fallback for scanned PDFs without a text layer.
 *
 * Renders each page to a PNG via pdfjs-dist + @napi-rs/canvas, then runs
 * tesseract.js with Odia + Hindi + English language packs. Language packs
 * are downloaded on first run and cached by tesseract.js.
 *
 * This is slow (~3-10s per page) so we cap pages per doc at OCR_MAX_PAGES
 * to keep wall time reasonable. Remaining pages can be processed in a
 * follow-up run by raising the cap.
 */
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES ?? 200);
const OCR_SCALE = 2.0; // 2x gives good accuracy without huge memory.

async function pdfToTextViaOcr(path: string): Promise<string> {
  // Dynamic imports so non-OCR runs don't pay the startup cost.
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const Tesseract = await import("tesseract.js");

  const data = new Uint8Array(readFileSync(path));
  // pdfjs in Node needs workerSrc disabled.
  (pdfjs as any).GlobalWorkerOptions.workerSrc = "";
  const loadingTask = (pdfjs as any).getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;
  const totalPages: number = doc.numPages;
  const pages = Math.min(totalPages, OCR_MAX_PAGES);
  console.log(`    · OCR: ${pages}/${totalPages} pages @ ${OCR_SCALE}x`);

  const worker = await Tesseract.createWorker(["ori", "hin", "eng"], 1, {
    // Keep log output quiet — tesseract.js is chatty by default.
    logger: () => {},
  });

  const pageTexts: string[] = [];
  try {
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const png = canvas.toBuffer("image/png");
      const { data: ocr } = await worker.recognize(png);
      pageTexts.push(ocr.text);
      process.stdout.write(`    · OCR page ${p}/${pages}\r`);
    }
    console.log("");
  } finally {
    await worker.terminate();
  }

  return pageTexts.join("\n\n");
}

function chunk(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_CHARS) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + CHUNK_CHARS));
    i += CHUNK_CHARS - OVERLAP_CHARS;
  }
  return out;
}

/**
 * Per-page chunk with page number preserved for citation.
 * When a single page is bigger than CHUNK_CHARS we split it and reuse the
 * same page number across the resulting sub-chunks.
 */
type PagedChunk = { content: string; page: number | null };

function pagedChunks(pages: { page: number; text: string }[]): PagedChunk[] {
  const out: PagedChunk[] = [];
  for (const p of pages) {
    const parts = chunk(p.text);
    for (const c of parts) out.push({ content: c, page: p.page });
  }
  return out;
}

/**
 * Read Phase-7 OCR output for a given PDF filename.
 * Returns null when the OCR directory is absent (fall back to unpdf).
 */
function readOcrPages(
  filename: string,
): { page: number; text: string }[] | null {
  const dir = join(OCR_DIR, filename);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^page-\d+\.txt$/.test(f))
    .sort();
  if (files.length === 0) return null;
  const out: { page: number; text: string }[] = [];
  for (const f of files) {
    const m = f.match(/^page-(\d+)\.txt$/);
    if (!m) continue;
    const p = Number(m[1]);
    const raw = readFileSync(join(dir, f), "utf8");
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length >= 40) out.push({ page: p, text });
  }
  return out.length ? out : null;
}

/**
 * Read Phase-7.5 topic-matcher output for a given PDF filename.
 * Returns a Map<pageNum, { chapterSlug, topicSlug? }>; empty when no matcher
 * file exists yet (chunks will be inserted without topic/chapter tags).
 */
function readMatcher(
  filename: string,
): Map<number, { chapter: string; topic: string | null }> {
  const out = new Map<number, { chapter: string; topic: string | null }>();
  const path = join(MATCHERS_DIR, `${filename}.json`);
  if (!existsSync(path)) return out;
  try {
    const doc = JSON.parse(readFileSync(path, "utf8")) as {
      pages: Record<string, { chapter: string; topic: string | null } | null>;
    };
    for (const [k, v] of Object.entries(doc.pages ?? {})) {
      if (v) out.set(Number(k), { chapter: v.chapter, topic: v.topic });
    }
  } catch (e) {
    console.warn(`  · matcher read failed (${(e as Error).message})`);
  }
  return out;
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.log(`No data/raw/ directory. Create it and drop PDFs inside.`);
    return;
  }
  const files = readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (files.length === 0) {
    console.log(`No PDFs in data/raw/. Drop BSE syllabus/textbook PDFs there and rerun.`);
    return;
  }

  const sb = createAdminClient();

  // Map subject codes → ids for foreign key.
  const { data: subjects } = await sb.from("subjects").select("id, code");
  const subjectIdByCode = new Map(
    (subjects ?? []).map((s) => [s.code as string, s.id as string]),
  );

  // Slug → id lookups for chapter/topic tagging.
  const { data: allChapters } = await sb.from("chapters").select("id, slug");
  const chapterIdBySlug = new Map(
    (allChapters ?? [])
      .filter((c) => c.slug)
      .map((c) => [c.slug as string, c.id as string]),
  );
  const { data: allTopics } = await sb.from("topics").select("id, slug");
  const topicIdBySlug = new Map(
    (allTopics ?? [])
      .filter((t) => t.slug)
      .map((t) => [t.slug as string, t.id as string]),
  );

  for (const filename of files) {
    if (FLAGS.fileFilter && !filename.includes(FLAGS.fileFilter)) continue;
    const kind = classify(filename);
    const path = join(RAW_DIR, filename);
    console.log(`\n▶ ${filename}  [${kind.sourceType} · ${kind.language}${kind.subjectCode ? " · " + kind.subjectCode : ""}]`);

    // Upsert document row (dedupe by title).
    const subjectId = kind.subjectCode
      ? subjectIdByCode.get(kind.subjectCode) ?? null
      : null;
    const { data: existingDoc } = await sb
      .from("documents")
      .select("id")
      .eq("title", kind.title)
      .maybeSingle();
    let documentId = existingDoc?.id as string | undefined;
    if (!documentId) {
      const { data: inserted, error } = await sb
        .from("documents")
        .insert({
          title: kind.title,
          source_type: kind.sourceType,
          language: kind.language,
          subject_id: subjectId,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`  ✗ insert document failed: ${error.message}`);
        continue;
      }
      documentId = inserted.id as string;
    }

    // Reset path: clear old chunks for this document before re-ingesting.
    if (FLAGS.reset) {
      const { error: delErr } = await sb
        .from("chunks")
        .delete()
        .eq("document_id", documentId);
      if (delErr) {
        console.error(`  ✗ reset failed: ${delErr.message}`);
        continue;
      }
      console.log(`  · reset: cleared existing chunks`);
    }

    // Skip if chunks already exist (unless reset).
    const { count } = await sb
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", documentId);
    if (!FLAGS.reset && (count ?? 0) > 0) {
      console.log(`  ✓ ${count} chunks already embedded — skipping.`);
      continue;
    }

    // Prefer Phase-7 OCR output when present (bypasses mojibake font encoding).
    let paged: { page: number; text: string }[] | null = null;
    if (FLAGS.preferOcr) {
      paged = readOcrPages(filename);
      if (paged) {
        console.log(`  · using OCR text (${paged.length} pages from data/raw/ocr/)`);
      }
    }

    if (!paged) {
      // Fall back to unpdf direct text extraction.
      let text: string;
      try {
        text = await pdfToText(path);
      } catch (e) {
        console.error(`  ✗ unpdf failed: ${(e as Error).message}`);
        continue;
      }
      if (text.trim().length < 40) {
        console.warn(`  ⚠ no text layer (likely scanned). Falling back to runtime OCR…`);
        try {
          text = await pdfToTextViaOcr(path);
        } catch (e) {
          console.error(`  ✗ OCR failed: ${(e as Error).message}`);
          continue;
        }
        if (text.trim().length < 40) {
          console.warn(`  ⚠ OCR produced no usable text. Skipping.`);
          continue;
        }
      }
      // No per-page info from unpdf mergePages — treat as single unknown-page blob.
      paged = [{ page: 0, text }];
    }

    const pc = pagedChunks(paged);
    const matcher = readMatcher(filename);
    const taggedCount = [...matcher.values()].filter((v) => v.chapter).length;
    if (matcher.size > 0)
      console.log(`  · matcher: ${taggedCount}/${matcher.size} pages tagged`);
    console.log(`  · ${pc.length} chunks, embedding in batches of ${EMBED_BATCH}…`);

    const rows: any[] = [];
    for (let i = 0; i < pc.length; i += EMBED_BATCH) {
      const batch = pc.slice(i, i + EMBED_BATCH);
      const vectors = await embedBatchWithRetry(batch.map((b) => b.content));
      batch.forEach((b, j) => {
        const m = b.page && b.page > 0 ? matcher.get(b.page) : undefined;
        rows.push({
          document_id: documentId,
          content: b.content,
          page: b.page && b.page > 0 ? b.page : null,
          language: kind.language,
          token_count: Math.round(b.content.length / 4),
          embedding: vectors[j] as unknown as string,
          chapter_id: m ? chapterIdBySlug.get(m.chapter) ?? null : null,
          topic_id: m && m.topic ? topicIdBySlug.get(m.topic) ?? null : null,
        });
      });
      process.stdout.write(`    · embedded ${Math.min(i + EMBED_BATCH, pc.length)}/${pc.length}\r`);
      await sleep(250); // gentle pacing for free tier
    }
    console.log("");

    // Insert chunks in slices to avoid single-payload limits.
    const SLICE = 200;
    for (let i = 0; i < rows.length; i += SLICE) {
      const slice = rows.slice(i, i + SLICE);
      const { error } = await sb.from("chunks").insert(slice);
      if (error) {
        console.error(`  ✗ chunk insert failed: ${error.message}`);
        break;
      }
    }
    console.log(`  ✓ inserted ${rows.length} chunks for "${kind.title}"`);
  }

  const { count: docCount } = await sb
    .from("documents")
    .select("*", { count: "exact", head: true });
  const { count: chunkCount } = await sb
    .from("chunks")
    .select("*", { count: "exact", head: true });
  console.log(`\nDB state: documents=${docCount ?? 0}, chunks=${chunkCount ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
