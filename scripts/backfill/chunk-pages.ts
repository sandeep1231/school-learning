/**
 * Backfill chunks.page + chunks.topic_id for documents ingested by
 * `ingest-class.ts` (Class 6/7/8). The class-aware ingest stored chunks
 * with `page=null`, but the OCR text was assembled with `## Page N\n...`
 * markers which the chunker collapsed into the chunk content. We can
 * therefore recover the page number per chunk by scanning each chunk
 * for the first `## Page N` marker.
 *
 * After page is populated, we re-link chunks to topics using the
 * topic.page_start..page_end ranges captured from `data/.toc-cache/`.
 *
 * Usage:
 *   npx tsx scripts/backfill/chunk-pages.ts            # all classes
 *   npx tsx scripts/backfill/chunk-pages.ts --class 6
 */
import "dotenv/config";
import { config } from "dotenv";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "../../lib/supabase/admin";

config({ path: ".env.local" });

const FLAGS = {
  classLevel: (() => {
    const f = process.argv.find((a) => a.startsWith("--class"));
    if (!f) return null;
    const eq = f.indexOf("=");
    if (eq >= 0) return Number(f.slice(eq + 1));
    const idx = process.argv.indexOf(f);
    return Number(process.argv[idx + 1]);
  })(),
};

type ChunkRow = {
  id: string;
  document_id: string;
  page: number | null;
  content: string;
};

type DocRow = { id: string; title: string };

const TOC_CACHE_ROOT = join(process.cwd(), "data", ".toc-cache");

function findTopicCacheForDocTitle(title: string): {
  topics: Array<{
    title_en: string;
    page_start: number | null;
    page_end: number | null;
  }>;
} | null {
  if (!existsSync(TOC_CACHE_ROOT)) return null;
  // Cache files are named "<base>-<digest>.json" where base is derived
  // from the source PDF filename (sans .pdf, sanitised). The DB document
  // title is "[C<n>] <basename-with-underscores-replaced-by-spaces>".
  // We can match by stripping the "[C<n>] " prefix and slugifying.
  const docCore = title
    .replace(/^\[C\d+\]\s*/i, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 60)
    .toLowerCase();
  const candidates = readdirSync(TOC_CACHE_ROOT).filter((n) =>
    n.toLowerCase().endsWith(".json"),
  );
  // The cache base is derived from the pdf filename, while the doc title is
  // derived from the same filename via `name.replace(/[_]+/g, " ")`. So both
  // collapse back to the same character set when slugified. Match on shared
  // prefix tolerantly.
  const matchKey = docCore.replace(/_+/g, "");
  for (const file of candidates) {
    const base = file.replace(/\.json$/i, "").toLowerCase();
    const baseKey = base
      .replace(/-[a-f0-9]{8,}$/, "") // strip digest suffix
      .replace(/[^a-z0-9]+/g, "");
    if (
      baseKey === matchKey ||
      baseKey.startsWith(matchKey) ||
      matchKey.startsWith(baseKey)
    ) {
      try {
        return JSON.parse(readFileSync(join(TOC_CACHE_ROOT, file), "utf8"));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function pageFromChunk(content: string): number | null {
  // The OCR text used `## Page <N>` markers that survive whitespace
  // collapsing as `## Page <N>`. Pick the FIRST marker — that's where
  // this chunk's content begins (an overlap from the previous page may
  // appear before the first marker but we attribute the chunk to the
  // page where it primarily starts).
  const m = /##\s*Page\s+(\d+)/i.exec(content);
  if (!m) return null;
  return Number(m[1]);
}

async function main() {
  const sb = createAdminClient();

  // Pull documents (optionally class-filtered).
  const docQuery = sb.from("documents").select("id, title");
  const { data: docs, error: docErr } = await (FLAGS.classLevel
    ? docQuery.like("title", `[C${FLAGS.classLevel}]%`)
    : docQuery);
  if (docErr) throw new Error(`load docs: ${docErr.message}`);
  console.log(
    `Backfilling ${docs?.length ?? 0} document(s)${FLAGS.classLevel ? ` for Class ${FLAGS.classLevel}` : ""}`,
  );

  let totalUpdatedPage = 0;
  let totalLinkedToTopic = 0;
  let totalDocsHandled = 0;

  for (const doc of (docs ?? []) as DocRow[]) {
    // 1) Pull the chunks that still have null page.
    const { data: chunks, error: cerr } = await sb
      .from("chunks")
      .select("id, document_id, page, content")
      .eq("document_id", doc.id);
    if (cerr) {
      console.error(`  ✗ load chunks ${doc.title}: ${cerr.message}`);
      continue;
    }
    if (!chunks || chunks.length === 0) continue;

    let pageUpdates = 0;
    const updates: Array<{ id: string; page: number }> = [];
    for (const ch of chunks as ChunkRow[]) {
      if (ch.page != null) continue;
      const p = pageFromChunk(ch.content);
      if (p != null) updates.push({ id: ch.id, page: p });
    }
    if (updates.length === 0) {
      console.log(`  · ${doc.title} — no nulls or no markers, skipping`);
      continue;
    }

    // Apply page updates in batches.
    for (const u of updates) {
      const { error } = await sb
        .from("chunks")
        .update({ page: u.page })
        .eq("id", u.id);
      if (error) {
        console.error(`    ✗ update chunk ${u.id}: ${error.message}`);
      } else {
        pageUpdates++;
      }
    }
    totalUpdatedPage += pageUpdates;
    totalDocsHandled++;
    console.log(`  · ${doc.title} — ${pageUpdates} chunk pages set`);

    // 2) Re-link chunks to topics for this document using the TOC cache.
    const toc = findTopicCacheForDocTitle(doc.title);
    if (!toc || !toc.topics?.length) {
      console.log(`    (no TOC cache match — skipping topic link)`);
      continue;
    }

    // Get the chapter under which topics for this document live so we can
    // also confirm the chapter_id is set on every chunk.
    const { data: chapterRow } = await sb
      .from("chunks")
      .select("chapter_id")
      .eq("document_id", doc.id)
      .not("chapter_id", "is", null)
      .limit(1)
      .maybeSingle();
    const chapterId = chapterRow?.chapter_id ?? null;
    if (!chapterId) {
      console.log(`    (no chapter_id on chunks — run seed:topics first)`);
      continue;
    }

    const { data: topicRows, error: terr } = await sb
      .from("topics")
      .select("id, order_index, title_en")
      .eq("chapter_id", chapterId)
      .order("order_index", { ascending: true });
    if (terr || !topicRows) {
      console.error(`    ✗ load topics: ${terr?.message}`);
      continue;
    }

    // Map topic order_index → cached page range. The seeder inserted
    // topics in the same order they appear in the cache file.
    let docTopicLinks = 0;
    for (let i = 0; i < topicRows.length && i < toc.topics.length; i++) {
      const trow = topicRows[i];
      const tcache = toc.topics[i];
      if (tcache.page_start == null || tcache.page_end == null) continue;
      const { error: uerr, count } = await sb
        .from("chunks")
        .update({ topic_id: trow.id }, { count: "exact" })
        .eq("document_id", doc.id)
        .gte("page", tcache.page_start)
        .lte("page", tcache.page_end);
      if (uerr) {
        console.error(`    ✗ link topic ${trow.title_en}: ${uerr.message}`);
      } else {
        docTopicLinks += count ?? 0;
      }
    }
    totalLinkedToTopic += docTopicLinks;
    console.log(`    ↳ ${docTopicLinks} chunks linked to topics`);
  }

  console.log(`\n=== Done ===`);
  console.log(`  documents touched: ${totalDocsHandled}`);
  console.log(`  chunk.page updated: ${totalUpdatedPage}`);
  console.log(`  chunk.topic_id linked: ${totalLinkedToTopic}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
