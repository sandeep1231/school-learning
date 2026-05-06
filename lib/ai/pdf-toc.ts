/**
 * Gemini-powered Table-of-Contents extractor.
 *
 * Given an ingested chapter PDF, asks Gemini for a structured JSON
 * description: chapter title (en/or/hi) and an ordered list of topics
 * (title in en/or/hi, learning objectives, page range). The result is
 * cached on disk under `data/.toc-cache/<digest>.json` so re-running the
 * seeder doesn't re-burn quota.
 *
 * We deliberately keep the schema small so a single Gemini call can cover
 * a 30-page chapter without hitting output-token limits.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const CACHE_ROOT = resolve(process.cwd(), "data/.toc-cache");

function readApiKey(): string {
  const sanitize = (v: string | undefined) => {
    if (!v) return undefined;
    const t = v.trim();
    if (!t || /^placeholder$/i.test(t)) return undefined;
    return t;
  };
  const k =
    sanitize(process.env.GOOGLE_GENERATIVE_AI_API_KEY) ??
    sanitize(process.env.GOOGLE_API_KEY);
  if (!k) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY missing in env");
  return k;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TocTopic = {
  title_en: string;
  title_or: string | null;
  title_hi: string | null;
  /** 2-5 short, action-oriented learner objectives in English. */
  objectives: string[];
  /** Inclusive 1-based page range covering this topic in the source PDF. */
  page_start: number | null;
  page_end: number | null;
};

export type TocChapter = {
  title_en: string;
  title_or: string | null;
  title_hi: string | null;
  /** 1-based ordinal of the chapter within the book (matches TOC numbering). */
  order: number | null;
  /** Optional grouping label, e.g. "Poetry Section", "Prose Section". */
  section: string | null;
  /** Inclusive 1-based page range for the whole chapter in the source PDF. */
  page_start: number | null;
  page_end: number | null;
  topics: TocTopic[];
};

export type TocResult = {
  /** New shape (multi-chapter book). */
  book_title_en?: string;
  book_title_or?: string | null;
  chapters?: TocChapter[];
  /** Legacy shape (single-chapter PDF) — retained for back-compat. */
  chapter_title_en?: string;
  chapter_title_or?: string | null;
  chapter_title_hi?: string | null;
  chapter_order?: number | null;
  topics?: TocTopic[];
};

/** Normalises either shape to a uniform list of chapters. */
export function tocToChapters(t: TocResult): TocChapter[] {
  if (Array.isArray(t.chapters) && t.chapters.length > 0) return t.chapters;
  // Legacy single-chapter cache file.
  if (t.chapter_title_en) {
    return [
      {
        title_en: t.chapter_title_en,
        title_or: t.chapter_title_or ?? null,
        title_hi: t.chapter_title_hi ?? null,
        order: t.chapter_order ?? 1,
        section: null,
        page_start: null,
        page_end: null,
        topics: t.topics ?? [],
      },
    ];
  }
  return [];
}

const TOC_SCHEMA = {
  type: "object",
  properties: {
    book_title_en: { type: "string" },
    book_title_or: { type: "string", nullable: true },
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title_en: { type: "string" },
          title_or: { type: "string", nullable: true },
          title_hi: { type: "string", nullable: true },
          order: { type: "integer", nullable: true },
          section: { type: "string", nullable: true },
          page_start: { type: "integer", nullable: true },
          page_end: { type: "integer", nullable: true },
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title_en: { type: "string" },
                title_or: { type: "string", nullable: true },
                title_hi: { type: "string", nullable: true },
                objectives: {
                  type: "array",
                  items: { type: "string" },
                },
                page_start: { type: "integer", nullable: true },
                page_end: { type: "integer", nullable: true },
              },
              required: ["title_en", "objectives"],
            },
          },
        },
        required: ["title_en", "topics"],
      },
    },
  },
  required: ["book_title_en", "chapters"],
} as const;

/**
 * Salvage a truncated Gemini JSON response. Strategy: find the last
 * complete `}` inside the `chapters` array, slice everything after, and
 * close the array + object. Returns a best-effort `TocResult`.
 */
function repairTruncatedToc(raw: string): TocResult {
  const arrStart = raw.indexOf('"chapters"');
  if (arrStart < 0) throw new Error("no chapters field in truncated JSON");
  const bracketStart = raw.indexOf("[", arrStart);
  if (bracketStart < 0) throw new Error("no chapters [ in truncated JSON");

  // Walk forward tracking depth and string state, recording the index
  // immediately after each `}` whose depth returns to 1 (i.e. closing a
  // chapter object inside the array).
  let depth = 0;
  let inStr = false;
  let escape = false;
  let lastGoodEnd = -1; // exclusive end of the last fully-closed chapter
  for (let i = bracketStart; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 1 && ch === "}") lastGoodEnd = i + 1;
      if (depth === 0) break;
    }
  }
  if (lastGoodEnd < 0) throw new Error("no complete chapter to salvage");

  const head = raw.slice(0, lastGoodEnd);
  const repaired = `${head}]}`;
  return JSON.parse(repaired) as TocResult;
}

function cacheFileFor(path: string): string {
  if (!existsSync(CACHE_ROOT)) mkdirSync(CACHE_ROOT, { recursive: true });
  const stat = statSync(path);
  const digest = createHash("sha1")
    .update(`${resolve(path)}|${stat.size}|${stat.mtimeMs}`)
    .digest("hex")
    .slice(0, 16);
  const base = path
    .split(/[\\/]/)
    .pop()!
    .replace(/\.pdf$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 60);
  return join(CACHE_ROOT, `${base}-${digest}.json`);
}

async function uploadPdfFile(
  fileManager: GoogleAIFileManager,
  path: string,
): Promise<{ uri: string; mimeType: string; name: string }> {
  const upload = await fileManager.uploadFile(path, {
    mimeType: "application/pdf",
    displayName: path.split(/[\\/]/).pop()!,
  });
  let file = upload.file;
  let waited = 0;
  while (file.state === "PROCESSING" && waited < 60_000) {
    await sleep(2000);
    waited += 2000;
    file = await fileManager.getFile(file.name);
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini File state=${file.state} after ${waited}ms`);
  }
  return { uri: file.uri, mimeType: file.mimeType, name: file.name };
}

const SYSTEM_PROMPT = `You are an expert curriculum cartographer for Indian school textbooks (BSE Odisha, NCERT). Given a textbook PDF, you produce a precise multi-chapter Table of Contents in JSON.

Rules:
- The PDF is a COMPLETE TEXTBOOK for one subject. It usually has a TOC page ("Contents", "ବିଷୟ ସୂଚୀ", "विषय सूची") listing all lessons with page numbers.
- Each NUMBERED ITEM in the TOC (lesson, poem, prose piece, grammar topic, etc.) becomes ONE CHAPTER in your output. DO NOT merge lessons. DO NOT collapse a whole section (Poetry/Prose) into one chapter.
- If the TOC groups items under a section heading like "ପଦ୍ୟ ବିଭାଗ (Poetry Section)" or "ଗଦ୍ୟ ବିଭାଗ (Prose Section)", set that label as the chapter's "section" field on every chapter belonging to that group. If the book has no sections, leave it null.
- The "order" field matches the printed TOC numbering (1, 2, 3, ...). Span across sections if the printed numbering does (e.g. Poetry 1-5, Prose 6-15, Grammar 16-17).
- For each chapter, provide "page_start" and "page_end" as the inclusive 1-based page range in the PDF. If only a start page is printed in the TOC, infer end as the page before the next chapter's start.
- For each chapter, list its topics. If the lesson has clearly named subsections (e.g. "1.1 Introduction", "1.2 Definitions"), use them. Otherwise produce 1-3 topics covering the lesson's main beats. Each topic should have 2-4 short learner objectives (<= 12 words each) in clear English.
- Preserve original Odia/Hindi script for titles when present — DO NOT transliterate.
- For Math/Science textbooks where the book has 8-15 numbered chapters, give every numbered chapter. For Language textbooks (Mil/English/Hindi) where the book has 15-25 numbered lessons (poems, stories), give EVERY numbered lesson.
- Output ONLY the JSON object that matches the schema. No commentary.`;

/**
 * Extract a structured TOC from a chapter PDF. Cached by content digest.
 *
 * @param pdfPath Absolute path to the chapter PDF.
 * @param opts.force Bypass cache and re-call Gemini.
 */
export async function pdfToToc(
  pdfPath: string,
  opts: { force?: boolean } = {},
): Promise<TocResult> {
  const cacheFile = cacheFileFor(pdfPath);
  if (!opts.force && existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, "utf8")) as TocResult;
    } catch {
      /* fall through and regenerate */
    }
  }

  const apiKey = readApiKey();
  const fileManager = new GoogleAIFileManager(apiKey);
  const genai = new GoogleGenerativeAI(apiKey);

  let uploaded: { uri: string; mimeType: string; name: string } | null = null;
  try {
    uploaded = await uploadPdfFile(fileManager, pdfPath);
    const model = genai.getGenerativeModel({
      model: process.env.GEMINI_TOC_MODEL ?? "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        // Schema is loosely enforced by the SDK; the prompt does the
        // heavy lifting. Cast through unknown so the SDK's narrower
        // SchemaType union doesn't reject our literal shape.
        responseSchema: TOC_SCHEMA as unknown as never,
        temperature: 0.2,
        // A textbook can have 15-25 lessons each with 2-4 topics; allow
        // ample tokens so the JSON isn't truncated mid-string.
        maxOutputTokens: 16384,
      },
    });

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await model.generateContent([
          { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
          { text: SYSTEM_PROMPT },
        ]);
        const raw = res.response.text();
        let parsed: TocResult;
        try {
          parsed = JSON.parse(raw) as TocResult;
        } catch {
          // Gemini occasionally truncates mid-string when the response
          // hits maxOutputTokens. Salvage what's parseable: cut at the
          // last completed chapter object inside the `chapters` array.
          parsed = repairTruncatedToc(raw);
        }
        const normalised = tocToChapters(parsed);
        if (normalised.length === 0) {
          throw new Error("invalid TOC shape (no chapters)");
        }
        // Persist cache.
        writeFileSync(cacheFile, JSON.stringify(parsed, null, 2), "utf8");
        return parsed;
      } catch (err) {
        lastErr = err;
        const msg = String((err as Error)?.message ?? err);
        const transient =
          /429|quota|rate|timeout|fetch failed|ECONNRESET/i.test(msg);
        if (!transient || attempt === 3) break;
        const backoff = 2000 * 2 ** attempt;
        console.warn(`    ⚠ TOC retry in ${backoff}ms (${msg.slice(0, 80)})`);
        await sleep(backoff);
      }
    }
    throw lastErr ?? new Error("pdfToToc: failed without specific error");
  } finally {
    if (uploaded) {
      try {
        await fileManager.deleteFile(uploaded.name);
      } catch {
        /* ignore */
      }
    }
  }
}
