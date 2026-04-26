/**
 * Phase 7.3/7.4 — BSE Odisha PDF OCR pipeline.
 *
 * Rasterises each page of a BSE Odisha textbook PDF and OCRs it with
 * Tesseract. This bypasses the legacy AkrutiOriSarala/Soumya/ShreeDev
 * font encodings used in BSE PDFs that produce mojibake when text is
 * extracted directly.
 *
 * Output: data/raw/ocr/<subject>/<filename>/page-NNN.txt
 *         data/raw/ocr/<subject>/<filename>/summary.json
 *
 * Usage:
 *   # Smoke test (1 file, first 2 pages)
 *   npx tsx scripts/ingest/ocr-bse-pdfs.ts --smoke --file="9th Class Life Science New Chapter.pdf" --lang=ori+eng --pages=1,2
 *
 *   # Full run for one file
 *   npx tsx scripts/ingest/ocr-bse-pdfs.ts --file="..." --lang=ori+eng
 *
 *   # Full run for all files (driven by AUDIT.json)
 *   npx tsx scripts/ingest/ocr-bse-pdfs.ts --all
 */
import "dotenv/config";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, basename } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

// Polyfill Promise.try for Node < 24
if (typeof (Promise as any).try !== "function") {
  (Promise as any).try = function <T>(
    fn: (...args: any[]) => T | PromiseLike<T>,
    ...args: any[]
  ): Promise<T> {
    return new Promise<T>((resolve) => resolve(fn(...args)));
  };
}

const RAW_DIR = join(process.cwd(), "data", "raw");
const OCR_DIR = join(RAW_DIR, "ocr");
const TRAINEDDATA_DIR = process.cwd(); // ori.traineddata etc. are in repo root

const RENDER_SCALE = 2.0; // higher = better OCR, slower
const DEFAULT_LANG = "ori+eng";

/**
 * Per-file language mapping derived from filename heuristics.
 * Filenames may be in Odia so match on Latin suffix too.
 */
function detectLang(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("hindi")) return "hin+eng";
  if (f.includes("english")) return "eng";
  if (f.includes("sanskrit")) return "san+ori+eng"; // san may not exist; fallback below
  if (f.includes("odia") || f.includes("mil") || f.includes("sahitya")) return "ori+eng";
  // Pure-English BSE books render fine directly, but still OCR for uniformity
  if (f.includes("life science") || f.includes("geography") || f.includes("geog"))
    return "ori+eng";
  return DEFAULT_LANG;
}

/** Find available traineddata files, drop missing langs, warn. */
function resolveLang(requested: string): string {
  const available = readdirSync(TRAINEDDATA_DIR)
    .filter((f) => f.endsWith(".traineddata"))
    .map((f) => f.replace(".traineddata", ""));
  const parts = requested.split("+");
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const p of parts) {
    if (available.includes(p)) kept.push(p);
    else dropped.push(p);
  }
  if (dropped.length) {
    console.warn(
      `  ! dropping missing traineddata: ${dropped.join(", ")} (have: ${available.join(", ")})`,
    );
  }
  return kept.length ? kept.join("+") : "eng";
}

/** Load pdfjs-dist once. Use the ESM legacy build for Node. */
async function loadPdfjs() {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Wire worker to the shipped worker file so pdfjs doesn't try a fake-worker fallback.
  if (pdfjs.GlobalWorkerOptions) {
    const { createRequire } = await import("node:module");
    const { pathToFileURL } = await import("node:url");
    const req = createRequire(import.meta.url);
    try {
      const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }
  }
  return pdfjs;
}

async function renderPageToPng(
  pdfjs: any,
  pdfBuf: Buffer,
  pageNum: number,
): Promise<Buffer> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuf),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true, // we don't care about glyph fidelity; render at bitmap
    verbosity: 0,
  }).promise;

  try {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext("2d");
    // pdfjs expects a CanvasRenderingContext2D-compatible ctx. @napi-rs/canvas
    // is close enough for raster rendering.
    await page.render({ canvas: canvas as any, canvasContext: ctx as any, viewport }).promise;
    return canvas.toBuffer("image/png");
  } finally {
    await doc.destroy();
  }
}

async function ocrPng(png: Buffer, lang: string): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const worker = await (Tesseract as any).createWorker(lang, undefined, {
    langPath: TRAINEDDATA_DIR,
    cachePath: TRAINEDDATA_DIR,
    gzip: false,
    
  });
  try {
    const { data } = await worker.recognize(png);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

async function getPageCount(pdfjs: any, pdfBuf: Buffer): Promise<number> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuf),
    verbosity: 0,
  }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

interface OcrSummary {
  file: string;
  subject?: string;
  lang: string;
  totalPages: number;
  ocrdPages: number;
  avgCharsPerPage: number;
  startedAt: string;
  finishedAt: string;
}

async function processFile(
  filePath: string,
  opts: { lang?: string; pages?: number[] } = {},
): Promise<OcrSummary> {
  const filename = basename(filePath);
  const outDir = join(OCR_DIR, filename);
  mkdirSync(outDir, { recursive: true });

  const pdfjs = await loadPdfjs();
  const buf = readFileSync(filePath);
  const totalPages = await getPageCount(pdfjs, buf);

  const lang = resolveLang(opts.lang ?? detectLang(filename));
  const targets = opts.pages && opts.pages.length ? opts.pages : range(1, totalPages);

  const startedAt = new Date().toISOString();
  let totalChars = 0;
  let ocrdPages = 0;

  console.log(`\n▶ ${filename}`);
  console.log(`  pages=${totalPages}  lang=${lang}  targets=${targets.length}`);

  for (const p of targets) {
    const outFile = join(outDir, `page-${String(p).padStart(3, "0")}.txt`);
    if (existsSync(outFile) && statSync(outFile).size > 0) {
      const existing = readFileSync(outFile, "utf8");
      totalChars += existing.length;
      ocrdPages++;
      process.stdout.write(`  page ${p}: skip (${existing.length} chars)\n`);
      continue;
    }
    const t0 = Date.now();
    try {
      const png = await renderPageToPng(pdfjs, buf, p);
      const text = await ocrPng(png, lang);
      writeFileSync(outFile, text, "utf8");
      totalChars += text.length;
      ocrdPages++;
      process.stdout.write(
        `  page ${p}: ${text.length} chars in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
      );
    } catch (e) {
      console.warn(`  page ${p}: FAILED — ${(e as Error).message}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary: OcrSummary = {
    file: filename,
    lang,
    totalPages,
    ocrdPages,
    avgCharsPerPage: ocrdPages ? Math.round(totalChars / ocrdPages) : 0,
    startedAt,
    finishedAt,
  };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  return summary;
}

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

function parseArgs(): {
  smoke: boolean;
  all: boolean;
  file?: string;
  lang?: string;
  pages?: number[];
} {
  const out: any = { smoke: false, all: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--smoke") out.smoke = true;
    else if (a === "--all") out.all = true;
    else if (a.startsWith("--file=")) out.file = a.slice("--file=".length);
    else if (a.startsWith("--lang=")) out.lang = a.slice("--lang=".length);
    else if (a.startsWith("--pages=")) {
      out.pages = a
        .slice("--pages=".length)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  mkdirSync(OCR_DIR, { recursive: true });

  if (args.file) {
    const filePath = join(RAW_DIR, args.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const pages = args.pages ?? (args.smoke ? [1, 2] : undefined);
    const summary = await processFile(filePath, { lang: args.lang, pages });
    console.log(`\n✓ Done.`);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (args.all) {
    const files = readdirSync(RAW_DIR)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort();
    const results: OcrSummary[] = [];
    for (const f of files) {
      try {
        const s = await processFile(join(RAW_DIR, f), { lang: args.lang });
        results.push(s);
      } catch (e) {
        console.error(`  ✗ ${f}: ${(e as Error).message}`);
      }
    }
    writeFileSync(
      join(OCR_DIR, "INDEX.json"),
      JSON.stringify(results, null, 2),
      "utf8",
    );
    console.log(`\n✓ Done. Wrote ${join("data", "raw", "ocr", "INDEX.json")}`);
    return;
  }

  console.error(
    `Usage:\n  --smoke --file="..."           (OCR first 2 pages)\n  --file="..." [--pages=N,N]    (OCR specific pages)\n  --all                         (OCR every PDF in data/raw/)\n  --lang=ori+eng                (override language auto-detect)`,
  );
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
