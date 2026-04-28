/**
 * Gemini Vision PDF OCR.
 *
 * BSE Odisha textbooks are scanned PDFs that use JPEG2000 (JPX) image
 * compression, which pdfjs-dist + tesseract.js cannot decode in Node
 * (OpenJPEG missing). Rather than ship a Poppler/ImageMagick dependency,
 * we use Gemini 2.5 Flash directly: it accepts PDFs natively and reads
 * Odia/Hindi/English script accurately.
 *
 * Strategy:
 *   1. Upload the PDF once via the Files API.
 *   2. Ask Gemini to transcribe in page batches (the model's output token
 *      budget caps a single response, so we loop). Each batch returns
 *      page-tagged text.
 *   3. Caller chunks + embeds the concatenated text.
 *
 * Free tier: 1,500 RPM is plenty (we make ~8-15 calls per textbook).
 */
import { readFileSync, statSync } from "node:fs";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PAGES_PER_BATCH = 20;
const MAX_RETRIES = 3;

function readApiKey(): string {
  const k =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY missing in env");
  return k;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Returns the Gemini Files API URI for the uploaded PDF. Polls the file
 * state until it's ACTIVE (small PDFs are usually instantaneous; bigger
 * ones take a few seconds to be indexed by the model).
 */
async function uploadPdf(
  fileManager: GoogleAIFileManager,
  path: string,
): Promise<{ uri: string; mimeType: string; sizeBytes: number }> {
  const stat = statSync(path);
  const upload = await fileManager.uploadFile(path, {
    mimeType: "application/pdf",
    displayName: path.split(/[\\/]/).pop()!,
  });

  // Poll for ACTIVE.
  let file = upload.file;
  let waited = 0;
  while (file.state === "PROCESSING" && waited < 60_000) {
    await sleep(2_000);
    waited += 2_000;
    file = await fileManager.getFile(file.name);
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini File state=${file.state} after ${waited}ms`);
  }
  return { uri: file.uri, mimeType: file.mimeType, sizeBytes: stat.size };
}

/**
 * Best-effort extraction of total page count by asking Gemini up front.
 * Gemini 2.5 Flash exposes pageCount on file metadata sometimes; otherwise
 * we pessimistically guess via filesize and let the loop detect EOF when
 * a batch returns "no more pages".
 */
async function getPageCount(
  fileManager: GoogleAIFileManager,
  fileName: string,
): Promise<number | null> {
  try {
    const f = await fileManager.getFile(fileName);
    // The Files API exposes videoMetadata for video; PDF metadata isn't
    // surfaced via the SDK type but is sometimes in the raw payload.
    const anyMeta = (f as any).metadata ?? (f as any).pdfMetadata;
    const pc = anyMeta?.pageCount ?? anyMeta?.numPages;
    if (typeof pc === "number" && pc > 0) return pc;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Transcribe a page range. Returns markdown-ish text with explicit
 * `## Page N` headings so callers can split per-page if needed.
 */
async function transcribePages(
  genai: GoogleGenerativeAI,
  fileUri: string,
  fileMime: string,
  fromPage: number,
  toPage: number,
): Promise<string> {
  const model = genai.getGenerativeModel({
    model: process.env.GEMINI_OCR_MODEL ?? "gemini-2.5-flash",
  });

  const prompt = `You are an expert OCR transcriber. Transcribe the text content from pages ${fromPage} through ${toPage} of the attached PDF.

Rules:
- Preserve original script (Odia / Hindi / English) — DO NOT translate.
- Keep mathematical expressions as plain text (e.g. "x^2 + 2x + 1").
- Skip headers, footers, and page numbers.
- Skip purely decorative images. Describe diagrams briefly only if they convey lesson content (e.g. "[Diagram: triangle ABC with angle A = 60°]").
- For each page, start the section with a heading like:
  ## Page <number>
- If a page is blank or you cannot read it, still emit its "## Page <number>" heading followed by "(blank)".
- Output plain text only. No JSON, no commentary, no end-of-document markers.`;

  let attempt = 0;
  while (true) {
    try {
      const res = await model.generateContent([
        { fileData: { fileUri, mimeType: fileMime } },
        { text: prompt },
      ]);
      return res.response.text();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const transient =
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("500") ||
        /quota|rate|temporarily/i.test(msg);
      if (!transient || attempt >= MAX_RETRIES) throw err;
      const backoff = 2000 * 2 ** attempt;
      console.warn(
        `    ⚠ Gemini OCR ${msg.slice(0, 80)} — retry in ${backoff}ms`,
      );
      await sleep(backoff);
      attempt++;
    }
  }
}

/**
 * Read the PDF page count locally via pdfjs-dist. This works even on
 * scanned PDFs with JPEG2000 images we can't render — we only need
 * metadata, not pixels. Authoritative; we use this as the loop bound
 * instead of trusting the model's `## END` self-report (it hallucinates).
 */
async function getPageCountLocal(path: string): Promise<number | null> {
  try {
    const fs = await import("node:fs");
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "";
    const data = new Uint8Array(fs.readFileSync(path));
    const doc = await pdfjs.getDocument({
      data,
      verbosity: 0,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    return doc.numPages;
  } catch {
    return null;
  }
}

/**
 * Public API: upload + transcribe a full PDF, returning concatenated text
 * with `## Page N` separators. Caller is responsible for chunking +
 * embedding.
 *
 * `maxPages` lets callers cap wall-time on huge books while keeping a
 * follow-up pass possible by raising the cap.
 */
export async function pdfToTextViaGemini(
  path: string,
  opts: { maxPages?: number } = {},
): Promise<string> {
  const apiKey = readApiKey();
  const fileManager = new GoogleAIFileManager(apiKey);
  const genai = new GoogleGenerativeAI(apiKey);

  // Read page count BEFORE uploading — if pdfjs can't open the file we
  // still want to try uploading, but we lose authoritative bounds.
  const localPages = await getPageCountLocal(path);

  console.log(`    · Gemini OCR: uploading ${path.split(/[\\/]/).pop()}…`);
  const uploaded = await uploadPdf(fileManager, path);
  const sizeMb = (uploaded.sizeBytes / 1024 / 1024).toFixed(1);
  console.log(`    · uploaded (${sizeMb} MB), URI=${uploaded.uri}`);

  const fileName = uploaded.uri.split("/").pop()!;
  const filesApiPages = localPages
    ? null
    : await getPageCount(
        fileManager,
        `files/${fileName.replace(/^files\//, "")}`,
      );
  const knownPages = localPages ?? filesApiPages;
  if (knownPages) console.log(`    · ${knownPages} pages total`);

  const cap = opts.maxPages ?? 500;
  const ceiling = Math.min(knownPages ?? cap, cap);
  const trustEnd = !knownPages; // only honour ## END when we have no ground truth

  const buffer: string[] = [];
  let from = 1;
  let consecutiveEmpty = 0;

  while (from <= ceiling) {
    const to = Math.min(from + PAGES_PER_BATCH - 1, ceiling);
    process.stdout.write(`    · OCR batch pages ${from}-${to}…  `);
    const t0 = Date.now();
    let text = await transcribePages(
      genai,
      uploaded.uri,
      uploaded.mimeType,
      from,
      to,
    );
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`(${dt}s, ${text.length} chars)\n`);

    // Strip any ## END marker the model emits — we don't trust it when we
    // have an authoritative page count.
    if (/##\s*END\b/.test(text)) {
      const before = text.replace(/##\s*END\b[\s\S]*$/, "").trim();
      if (trustEnd) {
        if (before) buffer.push(before);
        break;
      }
      // Discard the marker but keep the preceding content; continue looping.
      text = before;
    }

    if (text.trim().length < 40) {
      consecutiveEmpty++;
      if (!trustEnd && consecutiveEmpty >= 3) {
        console.warn(
          `    ⚠ 3 sparse batches in a row at page ${to} — stopping early.`,
        );
        break;
      }
      if (trustEnd && consecutiveEmpty >= 2) {
        console.warn(
          `    ⚠ two empty batches in a row — assuming PDF ended.`,
        );
        break;
      }
    } else {
      consecutiveEmpty = 0;
    }

    buffer.push(text);
    from = to + 1;
  }

  // Best-effort cleanup of the uploaded file (not fatal if it fails).
  try {
    await fileManager.deleteFile(`files/${fileName.replace(/^files\//, "")}`);
  } catch {
    /* ignore */
  }

  return buffer.join("\n\n");
}
