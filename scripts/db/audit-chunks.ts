/**
 * Phase 7.7 — DB chunks audit report.
 *
 * Quality baseline for the `chunks` table before/after the Phase-7
 * ingest rework:
 *   - per-subject and per-document counts
 *   - % chunks with topic_id / chapter_id set
 *   - % chunks containing Odia Unicode (U+0B00-U+0B7F)
 *   - % chunks that look like legacy-font mojibake (Latin-1-Supp noise >10%)
 *   - % short chunks (< 50 chars)
 *   - duplicate-content-hash count
 *   - pages distribution (null vs. populated)
 *
 * Writes:
 *   data/reports/chunks-audit-<YYYY-MM-DD>.md
 *
 * Run:
 *   npx tsx scripts/db/audit-chunks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";

function buildClient(): Client {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL not set");
  const m = u.match(
    /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^?]+)/,
  );
  if (!m) throw new Error("cannot parse DATABASE_URL");
  return new Client({
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    database: m[5],
    ssl: { rejectUnauthorized: false },
  });
}

function isOdia(s: string): boolean {
  return /[\u0B00-\u0B7F]/.test(s);
}

function isDevanagari(s: string): boolean {
  return /[\u0900-\u097F]/.test(s);
}

/** Heuristic: >10% of non-space chars in Latin-1 Supplement/Extended range. */
function looksMojibake(s: string): boolean {
  let total = 0;
  let sus = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") continue;
    total++;
    if (
      (cp >= 0x00a0 && cp <= 0x017f && !(cp >= 0x0041 && cp <= 0x007a)) ||
      (cp >= 0x0180 && cp <= 0x024f) ||
      (cp >= 0xe000 && cp <= 0xf8ff)
    )
      sus++;
  }
  if (total < 20) return false;
  return sus / total > 0.1;
}

async function main() {
  const db = buildClient();
  await db.connect();

  const report: string[] = [];
  report.push(`# Chunks audit — ${new Date().toISOString()}`);
  report.push("");

  // Global totals
  const tot = await db.query<{ count: string }>(`select count(*)::text from chunks`);
  const totalChunks = Number(tot.rows[0].count);
  report.push(`**Total chunks:** ${totalChunks}`);

  const dtot = await db.query<{ count: string }>(`select count(*)::text from documents`);
  report.push(`**Total documents:** ${Number(dtot.rows[0].count)}`);
  report.push("");

  // Per-subject counts
  const subj = await db.query<{ code: string; chunks: string; tagged: string }>(
    `select coalesce(s.code, '(none)') as code,
            count(c.*)::text as chunks,
            sum(case when c.topic_id is not null then 1 else 0 end)::text as tagged
       from chunks c
  left join documents d on d.id = c.document_id
  left join subjects s  on s.id = d.subject_id
   group by s.code
   order by s.code nulls last`,
  );
  report.push(`## Per-subject coverage`);
  report.push(``);
  report.push(`| Subject | Chunks | Topic-tagged | Coverage |`);
  report.push(`|---------|-------:|-------------:|---------:|`);
  for (const r of subj.rows) {
    const total = Number(r.chunks);
    const tagged = Number(r.tagged);
    const pct = total ? ((tagged / total) * 100).toFixed(1) : "-";
    report.push(`| ${r.code} | ${total} | ${tagged} | ${pct}% |`);
  }
  report.push("");

  // Per-document sample + stats
  const docs = await db.query<{
    id: string;
    title: string;
    code: string | null;
    chunks: string;
  }>(
    `select d.id, d.title, s.code,
            count(c.*)::text as chunks
       from documents d
  left join subjects s on s.id = d.subject_id
  left join chunks   c on c.document_id = d.id
   group by d.id, d.title, s.code
   order by count(c.*) desc`,
  );

  // Sample content for quality checks (expensive in pg, so cap)
  const CAP = 200;
  const samples = await db.query<{
    document_id: string;
    content: string;
    page: number | null;
  }>(
    `select document_id, content, page
       from (
         select document_id, content, page,
                row_number() over (partition by document_id order by random()) rn
           from chunks
       ) t
      where rn <= ${CAP}`,
  );

  const perDoc = new Map<
    string,
    {
      sampled: number;
      odia: number;
      deva: number;
      mojibake: number;
      short: number;
      hashes: Map<string, number>;
      pageNull: number;
    }
  >();
  for (const s of samples.rows) {
    let d = perDoc.get(s.document_id);
    if (!d) {
      d = {
        sampled: 0,
        odia: 0,
        deva: 0,
        mojibake: 0,
        short: 0,
        hashes: new Map(),
        pageNull: 0,
      };
      perDoc.set(s.document_id, d);
    }
    d.sampled++;
    if (isOdia(s.content)) d.odia++;
    if (isDevanagari(s.content)) d.deva++;
    if (looksMojibake(s.content)) d.mojibake++;
    if (s.content.length < 50) d.short++;
    if (s.page == null) d.pageNull++;
    const h = createHash("sha1").update(s.content).digest("hex").slice(0, 12);
    d.hashes.set(h, (d.hashes.get(h) ?? 0) + 1);
  }

  report.push(`## Per-document quality (sampled ≤${CAP}/doc)`);
  report.push("");
  report.push(
    `| Subject | Title | Chunks | Samp | Odia% | Deva% | Mojibake% | Short% | PageNull% | Dup |`,
  );
  report.push(
    `|---------|-------|-------:|-----:|------:|------:|----------:|-------:|----------:|----:|`,
  );
  for (const d of docs.rows) {
    const pd = perDoc.get(d.id);
    if (!pd || pd.sampled === 0) {
      report.push(`| ${d.code ?? "-"} | ${d.title} | ${d.chunks} | 0 | - | - | - | - | - | - |`);
      continue;
    }
    const odia = +((pd.odia / pd.sampled) * 100).toFixed(1);
    const deva = +((pd.deva / pd.sampled) * 100).toFixed(1);
    const moj = +((pd.mojibake / pd.sampled) * 100).toFixed(1);
    const shrt = +((pd.short / pd.sampled) * 100).toFixed(1);
    const pnull = +((pd.pageNull / pd.sampled) * 100).toFixed(1);
    let dup = 0;
    for (const v of pd.hashes.values()) if (v > 1) dup += v - 1;
    report.push(
      `| ${d.code ?? "-"} | ${d.title.slice(0, 50)} | ${d.chunks} | ${pd.sampled} | ${odia} | ${deva} | ${moj} | ${shrt} | ${pnull} | ${dup} |`,
    );
  }
  report.push("");

  // Aggregate verdict
  let allSampled = 0,
    allMojibake = 0,
    allOdia = 0,
    allPageNull = 0;
  for (const pd of perDoc.values()) {
    allSampled += pd.sampled;
    allMojibake += pd.mojibake;
    allOdia += pd.odia;
    allPageNull += pd.pageNull;
  }
  if (allSampled > 0) {
    report.push(`## Aggregate quality`);
    report.push("");
    report.push(
      `- **Mojibake rate:** ${((allMojibake / allSampled) * 100).toFixed(1)}% (target <2%)`,
    );
    report.push(
      `- **Odia coverage:** ${((allOdia / allSampled) * 100).toFixed(1)}% of sampled chunks contain Odia Unicode`,
    );
    report.push(
      `- **Page-null rate:** ${((allPageNull / allSampled) * 100).toFixed(1)}% (target <5% after Phase 7)`,
    );
    report.push("");
  }

  await db.end();

  const outDir = join(process.cwd(), "data", "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = join(outDir, `chunks-audit-${stamp}.md`);
  writeFileSync(outFile, report.join("\n"), "utf8");
  console.log(`✓ wrote ${outFile}`);
  console.log(report.slice(0, 40).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
