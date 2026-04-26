/**
 * Phase 7.1 — PDF audit for data/raw/.
 *
 * Inspects every .pdf in data/raw/ and reports:
 *  - total pages
 *  - whether a text layer exists
 *  - Odia Unicode coverage  (U+0B00..U+0B7F)
 *  - Devanagari coverage    (U+0900..U+097F)
 *  - Latin/ASCII coverage
 *  - mojibake indicators    (PUA chars, AU_OTF glyph ranges, high-bit noise)
 *  - verdict: "clean" | "mojibake" | "scanned" | "empty"
 *
 * Output: data/raw/AUDIT.md  (human-readable)  +  data/raw/AUDIT.json  (machine).
 *
 * Run:   npx tsx scripts/ingest/audit-pdfs.ts
 */
import "dotenv/config";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

if (typeof (Promise as any).try !== "function") {
  (Promise as any).try = function <T>(
    fn: (...args: any[]) => T | PromiseLike<T>,
    ...args: any[]
  ): Promise<T> {
    return new Promise<T>((resolve) => resolve(fn(...args)));
  };
}

import { extractText, getDocumentProxy } from "unpdf";

const RAW_DIR = join(process.cwd(), "data", "raw");
const SAMPLE_PAGES = 8; // first N pages are representative enough
const MIN_TEXT_CHARS = 400; // below this = likely scanned

type Verdict = "clean" | "mojibake" | "scanned" | "empty";

interface AuditRow {
  file: string;
  sizeMB: number;
  pages: number | null;
  sampledChars: number;
  odiaPct: number;
  devanagariPct: number;
  latinPct: number;
  puaPct: number;
  suspiciousPct: number;
  verdict: Verdict;
  notes: string[];
  sampleSnippet: string;
}

function classifyChars(text: string) {
  let odia = 0;
  let devanagari = 0;
  let latin = 0;
  let pua = 0;
  let suspicious = 0;
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") continue;
    total++;
    if (cp >= 0x0b00 && cp <= 0x0b7f) odia++;
    else if (cp >= 0x0900 && cp <= 0x097f) devanagari++;
    else if ((cp >= 0x0041 && cp <= 0x007a) || (cp >= 0x0030 && cp <= 0x0039)) latin++;
    else if (cp >= 0xe000 && cp <= 0xf8ff) pua++; // private use area — AU_OTF lands here
    else if (
      (cp >= 0x00a0 && cp <= 0x017f && !(cp >= 0x0041 && cp <= 0x007a)) ||
      (cp >= 0x0180 && cp <= 0x024f) ||
      (cp >= 0x2000 && cp <= 0x206f && ch !== "\u200c" && ch !== "\u200d")
    ) {
      // Latin-1 Supplement / extended — often indicates a legacy font remap
      suspicious++;
    }
  }
  if (total === 0)
    return { odiaPct: 0, devanagariPct: 0, latinPct: 0, puaPct: 0, suspiciousPct: 0 };
  return {
    odiaPct: +(odia / total * 100).toFixed(1),
    devanagariPct: +(devanagari / total * 100).toFixed(1),
    latinPct: +(latin / total * 100).toFixed(1),
    puaPct: +(pua / total * 100).toFixed(1),
    suspiciousPct: +(suspicious / total * 100).toFixed(1),
  };
}

function decide(
  pages: number | null,
  chars: number,
  pct: ReturnType<typeof classifyChars>,
  filenameHasOdia: boolean,
): { verdict: Verdict; notes: string[] } {
  const notes: string[] = [];
  if (!pages) return { verdict: "empty", notes: ["pdfjs failed to open"] };
  if (chars < MIN_TEXT_CHARS)
    return { verdict: "scanned", notes: [`only ${chars} text chars in first ${SAMPLE_PAGES} pages`] };

  // Odia-medium file but no Odia Unicode + lots of PUA/suspicious chars → AU_OTF mojibake.
  if (filenameHasOdia && pct.odiaPct < 5 && (pct.puaPct > 5 || pct.suspiciousPct > 20)) {
    notes.push("filename is Odia but text has no Odia Unicode — legacy AU_OTF font encoding");
    return { verdict: "mojibake", notes };
  }
  if (pct.puaPct > 10) {
    notes.push(`${pct.puaPct}% chars in Private Use Area`);
    return { verdict: "mojibake", notes };
  }
  if (filenameHasOdia && pct.odiaPct < 20) {
    notes.push(`only ${pct.odiaPct}% Odia Unicode despite Odia filename`);
    return { verdict: "mojibake", notes };
  }
  // Content-based mojibake: real English should be >80% Latin with <5% Latin-1 Supp noise.
  // AU_OTF-encoded-as-CP1252 shows up as ~50% Latin + 10-20% "suspicious".
  if (pct.suspiciousPct > 10 && pct.latinPct < 80) {
    notes.push(
      `${pct.suspiciousPct}% Latin-extended/suspicious chars with only ${pct.latinPct}% clean Latin — legacy font glyphs rendered as CP1252`,
    );
    return { verdict: "mojibake", notes };
  }
  notes.push(
    `odia=${pct.odiaPct}%  deva=${pct.devanagariPct}%  latin=${pct.latinPct}%  pua=${pct.puaPct}%`,
  );
  return { verdict: "clean", notes };
}

async function extractSample(path: string): Promise<{ pages: number | null; text: string }> {
  try {
    const buf = readFileSync(path);
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const totalPages = (pdf as any).numPages ?? null;
    // unpdf's extractText doesn't expose per-page easily — take whole doc then truncate
    // by doing chars-proportional slice. For audit we want first ~SAMPLE_PAGES pages
    // but unpdf returns joined text; approximate by taking first 20k chars.
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n\n") : text;
    return { pages: totalPages, text: (joined ?? "").slice(0, 20_000) };
  } catch (e) {
    return { pages: null, text: "" };
  }
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.error(`data/raw/ not found`);
    process.exit(1);
  }
  const files = readdirSync(RAW_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  if (files.length === 0) {
    console.error(`No PDFs in data/raw/`);
    process.exit(1);
  }

  const rows: AuditRow[] = [];
  for (const f of files) {
    const path = join(RAW_DIR, f);
    const sizeMB = +(statSync(path).size / 1024 / 1024).toFixed(2);
    const filenameHasOdia = /[\u0B00-\u0B7F]/.test(f);
    process.stdout.write(`▶ ${f}  ...  `);
    const { pages, text } = await extractSample(path);
    const pct = classifyChars(text);
    const { verdict, notes } = decide(pages, text.trim().length, pct, filenameHasOdia);
    const sampleSnippet = text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    rows.push({
      file: f,
      sizeMB,
      pages,
      sampledChars: text.trim().length,
      ...pct,
      verdict,
      notes,
      sampleSnippet,
    });
    console.log(verdict.toUpperCase());
  }

  // Markdown report
  const mdLines: string[] = [];
  mdLines.push(`# Phase 7.1 — PDF audit`);
  mdLines.push("");
  mdLines.push(`Generated: ${new Date().toISOString()}`);
  mdLines.push(`Directory: \`data/raw/\`  ·  ${rows.length} files`);
  mdLines.push("");

  const summary = rows.reduce<Record<Verdict, number>>(
    (acc, r) => {
      acc[r.verdict]++;
      return acc;
    },
    { clean: 0, mojibake: 0, scanned: 0, empty: 0 },
  );
  mdLines.push(
    `**Summary:** clean=${summary.clean}  mojibake=${summary.mojibake}  scanned=${summary.scanned}  empty=${summary.empty}`,
  );
  mdLines.push("");
  mdLines.push(`| # | File | Pages | MB | Verdict | Odia% | Deva% | Latin% | PUA% | Sus% | Notes |`);
  mdLines.push(`|---|------|------:|---:|---------|------:|------:|-------:|-----:|-----:|-------|`);
  rows.forEach((r, i) => {
    mdLines.push(
      `| ${i + 1} | ${r.file} | ${r.pages ?? "?"} | ${r.sizeMB} | **${r.verdict}** | ${r.odiaPct} | ${r.devanagariPct} | ${r.latinPct} | ${r.puaPct} | ${r.suspiciousPct} | ${r.notes.join("; ")} |`,
    );
  });
  mdLines.push("");
  mdLines.push(`## Sample snippets`);
  mdLines.push("");
  for (const r of rows) {
    mdLines.push(`### ${r.file}  _(${r.verdict})_`);
    mdLines.push("```");
    mdLines.push(r.sampleSnippet || "(no text)");
    mdLines.push("```");
    mdLines.push("");
  }

  writeFileSync(join(RAW_DIR, "AUDIT.md"), mdLines.join("\n"), "utf8");
  writeFileSync(join(RAW_DIR, "AUDIT.json"), JSON.stringify(rows, null, 2), "utf8");

  console.log(`\n✓ wrote ${join("data", "raw", "AUDIT.md")}`);
  console.log(`✓ wrote ${join("data", "raw", "AUDIT.json")}`);
  console.log(
    `\nVerdict totals: clean=${summary.clean}  mojibake=${summary.mojibake}  scanned=${summary.scanned}  empty=${summary.empty}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
