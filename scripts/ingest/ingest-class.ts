/**
 * Class-aware textbook ingest — Phase 14 multi-class rollout.
 *
 * Reads every *.pdf under `data/raw/clean/class-N/` (recursive), classifies
 * each by filename to a subject code, ensures a (subject, class_level)
 * row exists in the DB, and embeds chunks tagged to that subject.
 *
 * This is a thin wrapper around the existing single-class pipeline at
 * scripts/ingest/embed-pdfs.ts but with three adaptations:
 *   1. Class detection comes from the folder path, not a constant.
 *   2. Subject lookup is keyed on (code, class_level, board) so Class 6
 *      MTH is a different row from Class 9 MTH.
 *   3. Subjects are auto-inserted for the new class if missing.
 *
 * Chapters/topics for classes 6-8 are NOT seeded by this script — those
 * require curated TOCs. Chunks are inserted with chapter_id=null and
 * topic_id=null. The tutor's RAG search is subject-scoped, so chat still
 * works; the structured /today / /b/... browser will be empty until a
 * follow-up TOC pass.
 *
 * Usage:
 *   npm run ingest:class -- --class 6
 *   npm run ingest:class -- --class 7 --reset
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

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
import { pdfToTextViaGemini } from "../../lib/ai/pdf-ocr";

dotenvConfig({ path: ".env.local" });

const BOARD = "BSE_ODISHA";
const CHUNK_CHARS = 3200;
const OVERLAP_CHARS = 480;
const EMBED_BATCH = 32;

const FLAGS = {
  classLevel: (() => {
    const f = process.argv.find((a) => a.startsWith("--class"));
    if (!f) return null;
    // Accept both "--class=6" and "--class 6".
    const eq = f.indexOf("=");
    if (eq >= 0) return Number(f.slice(eq + 1));
    const idx = process.argv.indexOf(f);
    return Number(process.argv[idx + 1]);
  })(),
  reset: process.argv.includes("--reset"),
  fileFilter: (() => {
    const f = process.argv.find((a) => a.startsWith("--file="));
    return f ? f.slice("--file=".length) : null;
  })(),
};

if (!FLAGS.classLevel || isNaN(FLAGS.classLevel)) {
  console.error("Usage: npm run ingest:class -- --class <6|7|8|9> [--reset] [--file=substr]");
  process.exit(1);
}

const CLASS_LEVEL = FLAGS.classLevel;
const ROOT = join(process.cwd(), "data", "raw", "clean", `class-${CLASS_LEVEL}`);

// -- Subject metadata (canonical names so we can auto-create rows). ---------

const SUBJECT_META: Record<
  string,
  { name_en: string; name_or: string; name_hi: string }
> = {
  MTH: {
    name_en: "Mathematics",
    name_or: "ଗଣିତ",
    name_hi: "गणित",
  },
  GSC: {
    name_en: "General Science",
    name_or: "ସାଧାରଣ ବିଜ୍ଞାନ",
    name_hi: "सामान्य विज्ञान",
  },
  SSC: {
    name_en: "Social Science",
    name_or: "ସାମାଜିକ ବିଜ୍ଞାନ",
    name_hi: "सामाजिक विज्ञान",
  },
  FLO: {
    name_en: "First Language (Odia)",
    name_or: "ପ୍ରଥମ ଭାଷା (ଓଡ଼ିଆ)",
    name_hi: "प्रथम भाषा (ओड़िया)",
  },
  SLE: {
    name_en: "Second Language (English)",
    name_or: "ଦ୍ୱିତୀୟ ଭାଷା (ଇଂରାଜୀ)",
    name_hi: "द्वितीय भाषा (अंग्रेज़ी)",
  },
  TLH: {
    name_en: "Third Language (Hindi)",
    name_or: "ତୃତୀୟ ଭାଷା (ହିନ୍ଦୀ)",
    name_hi: "तृतीय भाषा (हिन्दी)",
  },
  SAN: {
    name_en: "Sanskrit",
    name_or: "ସଂସ୍କୃତ",
    name_hi: "संस्कृत",
  },
  CMP: {
    name_en: "Computer Science",
    name_or: "କମ୍ପ୍ୟୁଟର ଶିକ୍ଷା",
    name_hi: "कंप्यूटर शिक्षा",
  },
};

// -- Filename → subject classifier (mirrors embed-pdfs.ts). -----------------

type FileKind = {
  title: string;
  subjectCode: string | null;
  language: "en" | "or" | "hi";
  sourceType: "syllabus" | "textbook";
};

function classify(filename: string): FileKind {
  const name = filename.replace(/\.pdf$/i, "");
  const lower = name.toLowerCase();
  const hasOdia = /[\u0B00-\u0B7F]/.test(name);
  const hasDevanagari = /[\u0900-\u097F]/.test(name);
  const isSyllabus = lower.includes("syllabus") || lower.includes("curriculum");

  const has = (...needles: (string | RegExp)[]) =>
    needles.some((n) =>
      typeof n === "string" ? lower.includes(n) || name.includes(n) : n.test(name),
    );

  // SAN/CMP must be checked BEFORE generic language buckets so a
  // Sanskrit textbook (which may also include Devanagari) doesn't fall
  // through to TLH, and a Computer textbook doesn't get caught by
  // FLO via the Odia filename script.
  const subject = has("sanskrit", "ସଂସ୍କୃତ", "संस्कृत")
    ? "SAN"
    : has("computer", "sikshya", "କମ୍ପ୍ୟୁଟର")
    ? "CMP"
    : has(
        "math",
        "algebra",
        "geometry",
        "bijaganit",
        "ganit",
        "ଗଣିତ",
        "ଵୀଜଗଣିତ",
        "ଜ୍ୟାମିତି",
      )
    ? "MTH"
    : has(
          "geography",
          "bhugola",
          "history",
          "social",
          "civics",
          "ଭୂଗୋଳ",
          "ଇତିହାସ",
        )
      ? "SSC"
      : has(
            "science",
            "vigyan",
            "biology",
            "physics",
            "chemistry",
            "ଵିଜ୍ଞାନ",
            "ବିଜ୍ଞାନ",
          )
        ? "GSC"
        : has("hindi", "ହିନ୍ଦୀ", "हिन्दी")
          ? "TLH"
          : has("english", "ଇଂରାଜୀ")
            ? "SLE"
            : has("odia", "ଓଡ଼ିଆ", "ଓଡିଆ", "mil", "sahitya", "ସାହିତ୍ୟ")
              ? "FLO"
              : null;

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

// -- Helpers ----------------------------------------------------------------

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
      const backoff = 2000 * 2 ** attempt;
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
 * OCR fallback for scanned PDFs.
 *
 * BSE Odisha textbooks are scanned PDFs that use JPEG2000 image
 * compression, which pdfjs-dist + tesseract.js cannot decode in Node
 * (OpenJPEG is unavailable). We use Gemini 2.5 Flash directly: it
 * accepts PDFs natively and reads Odia / Hindi / English script.
 *
 * Cap with OCR_MAX_PAGES so a 300-page book doesn't burn quota.
 */
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES ?? 500);

async function pdfToTextViaOcr(path: string): Promise<string> {
  return pdfToTextViaGemini(path, { maxPages: OCR_MAX_PAGES });
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

/** Walk a directory recursively, returning absolute paths to *.pdf. */
function walkPdfs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkPdfs(full));
    else if (st.isFile() && name.toLowerCase().endsWith(".pdf")) out.push(full);
  }
  return out;
}

// -- Main -------------------------------------------------------------------

async function main() {
  console.log(`\n=== Ingesting Class ${CLASS_LEVEL} from ${ROOT} ===\n`);

  if (!existsSync(ROOT)) {
    console.log(`No folder at ${ROOT}. Create it and drop PDFs inside.`);
    return;
  }
  const files = walkPdfs(ROOT);
  if (files.length === 0) {
    console.log(`No PDFs found under ${ROOT}.`);
    return;
  }
  console.log(`Found ${files.length} PDF(s).`);

  const sb = createAdminClient();

  // 1. Ensure every subject row exists for this class. Insert any missing
  //    on demand, skipping ones we never reference.
  const referencedSubjects = new Set<string>();
  for (const path of files) {
    const filename = path.split(/[\\/]/).pop()!;
    const kind = classify(filename);
    if (kind.subjectCode) referencedSubjects.add(kind.subjectCode);
  }

  const { data: existingSubjects } = await sb
    .from("subjects")
    .select("id, code, class_level, board")
    .eq("board", BOARD)
    .eq("class_level", CLASS_LEVEL);

  const subjectIdByCode = new Map<string, string>(
    (existingSubjects ?? []).map((s) => [s.code as string, s.id as string]),
  );

  for (const code of referencedSubjects) {
    if (subjectIdByCode.has(code)) continue;
    const meta = SUBJECT_META[code];
    if (!meta) {
      console.warn(`  ⚠ unknown subject code ${code}, skipping subject create`);
      continue;
    }
    const { data, error } = await sb
      .from("subjects")
      .insert({
        code,
        class_level: CLASS_LEVEL,
        board: BOARD,
        name_en: meta.name_en,
        name_or: meta.name_or,
        name_hi: meta.name_hi,
      })
      .select("id, code")
      .single();
    if (error) {
      console.error(`  ✗ insert subject ${code} (class ${CLASS_LEVEL}): ${error.message}`);
      continue;
    }
    subjectIdByCode.set(code, data.id as string);
    console.log(`  + created subjects row: class ${CLASS_LEVEL} ${code}`);
  }

  // 2. Ingest each PDF.
  for (const path of files) {
    const filename = path.split(/[\\/]/).pop()!;
    if (FLAGS.fileFilter && !filename.includes(FLAGS.fileFilter)) continue;

    const kind = classify(filename);
    const subjectId = kind.subjectCode
      ? subjectIdByCode.get(kind.subjectCode) ?? null
      : null;

    console.log(
      `\n▶ ${filename}  [class ${CLASS_LEVEL} · ${kind.sourceType} · ${kind.language}${kind.subjectCode ? " · " + kind.subjectCode : " · ⚠ unclassified"}]`,
    );
    if (!subjectId) {
      // Sanskrit, Computer, and other out-of-curriculum books land here.
      // Skip rather than burn embed budget on content we can't surface
      // through the UI (no subject row → no /b/.../s/<code>/ route).
      // Pass --include-unclassified to override.
      if (!process.argv.includes("--include-unclassified")) {
        console.warn(
          `  ⚠ skipped (no subject match). Pass --include-unclassified to ingest anyway.`,
        );
        continue;
      }
      console.warn(
        `  ⚠ no subject match — chunks will be inserted without subject_id (still searchable but harder to scope).`,
      );
    }

    // Document title is per (class, filename) so the same NCERT chapter
    // file uploaded for multiple classes doesn't collide.
    const title = `[C${CLASS_LEVEL}] ${kind.title}`;
    const { data: existingDoc } = await sb
      .from("documents")
      .select("id")
      .eq("title", title)
      .maybeSingle();
    let documentId = existingDoc?.id as string | undefined;
    if (!documentId) {
      const { data: inserted, error } = await sb
        .from("documents")
        .insert({
          title,
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

    const { count } = await sb
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", documentId);
    if (!FLAGS.reset && (count ?? 0) > 0) {
      console.log(`  ✓ ${count} chunks already embedded — skipping.`);
      continue;
    }

    let text: string;
    try {
      text = await pdfToText(path);
    } catch (e) {
      console.error(`  ✗ unpdf failed: ${(e as Error).message}`);
      continue;
    }
    if (text.trim().length < 40) {
      console.warn(
        `  ⚠ no text layer (likely scanned). Falling back to OCR (this is slow)…`,
      );
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

    const parts = chunk(text);
    console.log(`  · ${parts.length} chunks, embedding in batches of ${EMBED_BATCH}…`);

    const rows: any[] = [];
    for (let i = 0; i < parts.length; i += EMBED_BATCH) {
      const batch = parts.slice(i, i + EMBED_BATCH);
      const vectors = await embedBatchWithRetry(batch);
      batch.forEach((content, j) => {
        // Extract first `## Page N` marker that survived chunking; this lets
        // downstream topic linkage match chunks against TOC page ranges.
        const pageMatch = /##\s*Page\s+(\d+)/i.exec(content);
        rows.push({
          document_id: documentId,
          content,
          page: pageMatch ? Number(pageMatch[1]) : null,
          language: kind.language,
          token_count: Math.round(content.length / 4),
          embedding: vectors[j] as unknown as string,
          chapter_id: null,
          topic_id: null,
        });
      });
      process.stdout.write(
        `    · embedded ${Math.min(i + EMBED_BATCH, parts.length)}/${parts.length}\r`,
      );
      await sleep(250);
    }
    console.log("");

    const SLICE = 200;
    for (let i = 0; i < rows.length; i += SLICE) {
      const slice = rows.slice(i, i + SLICE);
      const { error } = await sb.from("chunks").insert(slice);
      if (error) {
        console.error(`  ✗ chunk insert failed: ${error.message}`);
        break;
      }
    }
    console.log(`  ✓ inserted ${rows.length} chunks for "${title}"`);
  }

  const { count: docCount } = await sb
    .from("documents")
    .select("*", { count: "exact", head: true });
  const { count: chunkCount } = await sb
    .from("chunks")
    .select("*", { count: "exact", head: true });
  console.log(
    `\nDB state: documents=${docCount ?? 0}, chunks=${chunkCount ?? 0}`,
  );
  console.log(`\n✓ Class ${CLASS_LEVEL} ingestion complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
