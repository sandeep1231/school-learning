/**
 * Phase 7.6 — OCR INDEX.json sealer.
 *
 * The full OCR run (`scripts/ingest/ocr-bse-pdfs.ts --all`) writes a
 * top-level `INDEX.json` only on a clean end-to-end pass. When the run
 * completed across multiple sessions (resuming after interruptions) the
 * INDEX file never gets written even though every per-page `.txt` is
 * present on disk.
 *
 * This script reconstructs it from what's actually on disk:
 *   - scans `data/raw/ocr/<filename>/page-NNN.txt`
 *   - re-creates `summary.json` per document (where missing)
 *   - emits `data/raw/ocr/INDEX.json` with a row per document
 *
 * Run:
 *   npx tsx scripts/ingest/ocr-seal-index.ts
 */
import "dotenv/config";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const OCR_DIR = join(process.cwd(), "data", "raw", "ocr");

type DocSummary = {
  file: string;
  lang: string;
  totalPages: number;
  ocrdPages: number;
  avgCharsPerPage: number;
  startedAt: string;
  finishedAt: string;
};

function detectLang(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("hindi")) return "hin+eng";
  if (f.includes("english")) return "eng";
  if (f.includes("sanskrit")) return "san+ori+eng";
  return "ori+eng";
}

function readDocSummary(dir: string, filename: string): DocSummary | null {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;

  // Prefer existing summary.json when present.
  const summaryPath = join(dir, "summary.json");
  if (existsSync(summaryPath)) {
    try {
      const j = JSON.parse(readFileSync(summaryPath, "utf8")) as DocSummary;
      if (j.file && j.totalPages) return j;
    } catch {
      // fall through to scan
    }
  }

  const pages = readdirSync(dir)
    .filter((f) => /^page-\d+\.txt$/.test(f))
    .sort();
  if (pages.length === 0) return null;

  let totalChars = 0;
  let earliest = Infinity;
  let latest = 0;
  for (const p of pages) {
    const stat = statSync(join(dir, p));
    totalChars += stat.size;
    if (stat.mtimeMs < earliest) earliest = stat.mtimeMs;
    if (stat.mtimeMs > latest) latest = stat.mtimeMs;
  }

  const summary: DocSummary = {
    file: filename,
    lang: detectLang(filename),
    totalPages: pages.length,
    ocrdPages: pages.length,
    avgCharsPerPage: Math.round(totalChars / pages.length),
    startedAt: new Date(earliest).toISOString(),
    finishedAt: new Date(latest).toISOString(),
  };

  // Persist per-doc summary so future runs short-circuit.
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}

function main() {
  if (!existsSync(OCR_DIR)) {
    console.error(`No OCR directory at ${OCR_DIR}`);
    process.exit(1);
  }

  const docs = readdirSync(OCR_DIR).filter((f) => {
    const p = join(OCR_DIR, f);
    return existsSync(p) && statSync(p).isDirectory();
  });

  const results: DocSummary[] = [];
  for (const d of docs) {
    const dir = join(OCR_DIR, d);
    const s = readDocSummary(dir, d);
    if (!s) {
      console.warn(`  · skip ${d} (no pages)`);
      continue;
    }
    results.push(s);
    console.log(
      `  ✓ ${d}: ${s.ocrdPages} pages · ${s.avgCharsPerPage} chars/page · ${s.lang}`,
    );
  }

  results.sort((a, b) => a.file.localeCompare(b.file));
  const indexPath = join(OCR_DIR, "INDEX.json");
  writeFileSync(indexPath, JSON.stringify(results, null, 2), "utf8");

  const totalPages = results.reduce((s, r) => s + r.ocrdPages, 0);
  console.log(
    `\n✓ Wrote ${indexPath} — ${results.length} docs, ${totalPages} pages`,
  );
}

main();
