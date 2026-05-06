/**
 * Topic-from-documents seeder.
 *
 * For every ingested chapter PDF in `data/raw/clean/class-N/`, asks
 * Gemini for a structured TOC (chapter title + topics with page ranges)
 * and upserts `chapters` + `topics` rows in the DB. Then back-links the
 * existing `chunks` rows of that document via `chapter_id` and `topic_id`
 * so subject-scope retrieval can refine to per-topic context.
 *
 * Idempotent: re-runs skip documents whose chapter+topics already exist
 * unless `--force` is passed. Gemini responses are cached on disk by
 * `lib/ai/pdf-toc.ts` so re-runs cost nothing.
 *
 * Usage:
 *   npx tsx scripts/seed/topics-from-docs.ts --class 6
 *   npx tsx scripts/seed/topics-from-docs.ts --class 7 --subject MTH
 *   npx tsx scripts/seed/topics-from-docs.ts --class 8 --force
 *   npx tsx scripts/seed/topics-from-docs.ts --class 9 --reset
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "../../lib/supabase/admin";
import { pdfToToc, tocToChapters, type TocResult } from "../../lib/ai/pdf-toc";

dotenvConfig({ path: ".env.local" });

const BOARD = "BSE_ODISHA";

const FLAGS = {
  classLevel: (() => {
    const f = process.argv.find((a) => a.startsWith("--class"));
    if (!f) return null;
    const eq = f.indexOf("=");
    if (eq >= 0) return Number(f.slice(eq + 1));
    const idx = process.argv.indexOf(f);
    return Number(process.argv[idx + 1]);
  })(),
  subjects: (() => {
    // --subject MTH                       -> ["MTH"]
    // --subject FLO,GSC,SLE,TLH           -> ["FLO","GSC","SLE","TLH"]
    // --subject=FLO,GSC                   -> ["FLO","GSC"]
    const f = process.argv.find((a) => a.startsWith("--subject"));
    if (!f) return null as string[] | null;
    const eq = f.indexOf("=");
    let raw: string | undefined;
    if (eq >= 0) raw = f.slice(eq + 1);
    else {
      const idx = process.argv.indexOf(f);
      raw = process.argv[idx + 1];
    }
    if (!raw) return null as string[] | null;
    // PowerShell converts unquoted `--subject FLO,GSC,SLE,TLH` into a single
    // arg "FLO GSC SLE TLH" (commas → spaces), so accept either separator.
    const list = raw
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    return list.length > 0 ? list : null;
  })(),
  force: process.argv.includes("--force"),
  reset: process.argv.includes("--reset"),
  dryRun: process.argv.includes("--dry-run"),
};

if (!FLAGS.classLevel || Number.isNaN(FLAGS.classLevel)) {
  console.error(
    "Usage: npx tsx scripts/seed/topics-from-docs.ts --class <6|7|8|9> [--subject MTH|MTH,SSC] [--force] [--reset] [--dry-run]",
  );
  process.exit(1);
}

const CLASS_LEVEL = FLAGS.classLevel;
const ROOT = join(process.cwd(), "data", "raw", "clean", `class-${CLASS_LEVEL}`);

// -- Filename → subject classifier (kept in sync with ingest-class.ts). ----

function classify(filename: string): { title: string; subjectCode: string | null } {
  const name = filename.replace(/\.pdf$/i, "");
  const lower = name.toLowerCase();
  const has = (...needles: (string | RegExp)[]) =>
    needles.some((n) =>
      typeof n === "string" ? lower.includes(n) || name.includes(n) : n.test(name),
    );
  // SAN/CMP first so Sanskrit/Computer textbooks don't fall through
  // to TLH (Devanagari) or FLO (Odia script) buckets.
  const subjectCode = has("sanskrit", "ସଂସ୍କୃତ", "संस्कृत")
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
    : has("geography", "bhugola", "history", "social", "civics", "ଭୂଗୋଳ", "ଇତିହାସ")
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
  return {
    title: name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim(),
    subjectCode,
  };
}

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

// -- Slug helpers -----------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Content-derived slug (no order_index): re-running the seeder upserts the
// same chapter row instead of appending duplicates with shifted order.
// `orderHint` is used as a stable fallback when titleEn slugifies to empty
// (e.g. Gemini returns the chapter title in Devanagari/Odia for non-English
// textbooks like Sanskrit). The hint should be the TOC chapter position so
// re-runs of the same cached TOC produce the same slug.
function chapterSlug(
  classLevel: number,
  subjectCode: string,
  titleEn: string,
  orderHint: number,
): string {
  const titlePart = slugify(titleEn) || `chapter-${orderHint}`;
  return `c${classLevel}-${subjectCode.toLowerCase()}-${titlePart}`.slice(0, 80);
}

function topicSlug(
  classLevel: number,
  subjectCode: string,
  chapterSlugStr: string,
  topicTitleEn: string,
  topicOrder: number,
): string {
  // Strip the leading c{N}-{subj}- prefix from the chapter slug so the
  // topic slug stays under 80 chars without losing the chapter context.
  const chPart = chapterSlugStr.replace(
    new RegExp(`^c${classLevel}-${subjectCode.toLowerCase()}-`),
    "",
  );
  const tPart = slugify(topicTitleEn) || `t${topicOrder}`;
  return `c${classLevel}-${subjectCode.toLowerCase()}-${chPart}-${tPart}`.slice(
    0,
    80,
  );
}

// -- Main -------------------------------------------------------------------

type SubjectRow = { id: string; code: string; class_level: number };
type DocRow = { id: string; title: string; subject_id: string | null };

async function main() {
  console.log(`\n=== Topic seeding for Class ${CLASS_LEVEL} (${BOARD}) ===\n`);
  if (!existsSync(ROOT)) {
    console.error(`No source folder at ${ROOT}.`);
    process.exit(1);
  }

  const sb = createAdminClient();

  // 1) Map subjects for this class.
  const { data: subjectRows, error: subErr } = await sb
    .from("subjects")
    .select("id, code, class_level")
    .eq("board", BOARD)
    .eq("class_level", CLASS_LEVEL);
  if (subErr) throw new Error(`load subjects: ${subErr.message}`);
  const subjectByCode = new Map<string, SubjectRow>(
    (subjectRows ?? []).map((s) => [s.code as string, s as SubjectRow]),
  );
  console.log(`  · ${subjectByCode.size} subjects in DB for class ${CLASS_LEVEL}`);

  // 2) Map documents (title → row) for fast lookup. Class 6+ docs use the
  //    `[C${classLevel}] ${title}` naming. Class 9 docs predate that and use
  //    the bare title — we load both forms and the per-job lookup below
  //    falls back gracefully.
  const subjectIds = Array.from(subjectByCode.values()).map((s) => s.id);
  const { data: docRows, error: docErr } = await sb
    .from("documents")
    .select("id, title, subject_id")
    .in("subject_id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"]);
  if (docErr) throw new Error(`load documents: ${docErr.message}`);
  const docByTitle = new Map<string, DocRow>(
    (docRows ?? []).map((d) => [d.title as string, d as DocRow]),
  );
  console.log(`  · ${docByTitle.size} documents in DB for class ${CLASS_LEVEL}`);

  // 3) Walk source PDFs and pair them with documents.
  const pdfFiles = walkPdfs(ROOT);
  console.log(`  · ${pdfFiles.length} source PDF(s) on disk\n`);

  // Group PDFs per subject so we can assign chapter_order deterministically
  // by alphabetical filename (the BSE Odisha clean dataset is named
  // sequentially per chapter).
  type Job = {
    pdfPath: string;
    filename: string;
    title: string;
    subjectCode: string;
    document: DocRow;
  };
  const jobsBySubject = new Map<string, Job[]>();

  for (const pdfPath of pdfFiles.sort()) {
    const filename = pdfPath.split(/[\\/]/).pop()!;
    const k = classify(filename);
    if (!k.subjectCode) {
      console.warn(`  ⚠ ${filename} — could not classify, skipping`);
      continue;
    }
    if (FLAGS.subjects && !FLAGS.subjects.includes(k.subjectCode)) continue;
    if (!subjectByCode.has(k.subjectCode)) {
      console.warn(
        `  ⚠ ${filename} — subject ${k.subjectCode} not in DB, run ingest first`,
      );
      continue;
    }
    // Class 6/7/8 docs were ingested with title `[C${classLevel}] ${k.title}`.
    // Class 9 docs predate that convention and are stored without the prefix.
    // Try the prefixed form first, fall back to the bare title.
    const prefixedTitle = `[C${CLASS_LEVEL}] ${k.title}`;
    const document =
      docByTitle.get(prefixedTitle) ?? docByTitle.get(k.title) ?? null;
    if (!document) {
      console.warn(
        `  ⚠ ${filename} — no document row "${prefixedTitle}" or "${k.title}", run ingest first`,
      );
      continue;
    }
    const list = jobsBySubject.get(k.subjectCode) ?? [];
    list.push({
      pdfPath,
      filename,
      title: k.title,
      subjectCode: k.subjectCode,
      document,
    });
    jobsBySubject.set(k.subjectCode, list);
  }

  let chaptersInserted = 0;
  let chaptersUpdated = 0;
  let topicsUpserted = 0;
  let chunksLinked = 0;

  for (const [subjectCode, jobs] of jobsBySubject) {
    const subjectRow = subjectByCode.get(subjectCode)!;
    console.log(`\n--- ${subjectCode} (${jobs.length} chapter PDF${jobs.length === 1 ? "" : "s"}) ---`);

    if (FLAGS.reset) {
      // Cascade-deletes topics via FK; chunks.chapter_id / topic_id become
      // null automatically (`on delete set null`).
      const { error } = await sb
        .from("chapters")
        .delete()
        .eq("subject_id", subjectRow.id);
      if (error) {
        console.error(`  ✗ reset failed: ${error.message}`);
        continue;
      }
      console.log(`  · reset: cleared chapters/topics for ${subjectCode}`);
    }

    // Existing chapter rows for idempotency checks. We index by SLUG
    // (content-derived) so re-runs upsert the same row instead of
    // creating duplicates with shifted order_index.
    const { data: existingChapters } = await sb
      .from("chapters")
      .select("id, order_index, slug")
      .eq("subject_id", subjectRow.id);
    const existingBySlug = new Map<string, { id: string; order_index: number }>(
      (existingChapters ?? [])
        .filter((c) => (c.slug as string | null) != null)
        .map((c) => [
          c.slug as string,
          { id: c.id as string, order_index: c.order_index as number },
        ]),
    );

    // Running chapter order shared across all PDFs of this subject so we
    // don't collide on the (subject_id, order_index) unique constraint
    // when a subject has multiple textbook PDFs. New chapters take the
    // next available order; existing chapters keep their order.
    let nextChapterOrder = (existingChapters ?? []).length > 0
      ? Math.max(...(existingChapters ?? []).map((c) => c.order_index as number)) + 1
      : 1;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      console.log(`  · ${job.filename}`);
      let toc: TocResult;
      try {
        toc = await pdfToToc(job.pdfPath);
      } catch (err) {
        console.error(
          `    ✗ pdfToToc failed: ${(err as Error).message}. Skipping.`,
        );
        continue;
      }

      const tocChapters = tocToChapters(toc);
      if (tocChapters.length === 0) {
        console.warn(`    ⚠ TOC returned no chapters, skipping`);
        continue;
      }

      // Strategy: each TOC chapter becomes one DB chapter. Order from the
      // TOC drives `order_index`. Chunks of this document are dispatched
      // to a chapter by page range; topics within a chapter pick up
      // chunks by their own page range.
      console.log(
        `    · ${tocChapters.length} chapter(s) from "${toc.book_title_en ?? job.title}"`,
      );

      for (let ci = 0; ci < tocChapters.length; ci++) {
        const tc = tocChapters[ci];
        const titleEn = tc.title_en;
        const titleOr = tc.title_or ?? null;
        const titleHi = tc.title_hi ?? null;
        const sectionPrefix = tc.section ? `[${tc.section}] ` : "";
        const slug = chapterSlug(CLASS_LEVEL, subjectCode, titleEn, ci + 1);

        // Idempotency by content slug: if a chapter with the same content
        // already exists, reuse it (and its order_index). Only allocate a
        // new order_index for genuinely new chapters.
        const existing = existingBySlug.get(slug);
        const chapterOrder = existing ? existing.order_index : nextChapterOrder++;

        if (existing && !FLAGS.force) {
          const { count } = await sb
            .from("topics")
            .select("*", { count: "exact", head: true })
            .eq("chapter_id", existing.id);
          if ((count ?? 0) > 0) {
            console.log(
              `    · ch${chapterOrder} ${titleEn} — already seeded (${count} topics), skipping`,
            );
            continue;
          }
        }

        if (FLAGS.dryRun) {
          console.log(
            `    (dry-run) ch${chapterOrder} "${sectionPrefix}${titleEn}" + ${tc.topics.length} topics (p ${tc.page_start}-${tc.page_end})`,
          );
          continue;
        }

        let chapterId: string;
        if (existing) {
          const { error } = await sb
            .from("chapters")
            .update({
              title_en: `${sectionPrefix}${titleEn}`,
              title_or: titleOr,
              title_hi: titleHi,
              slug,
            })
            .eq("id", existing.id);
          if (error) {
            console.error(`    ✗ update chapter: ${error.message}`);
            continue;
          }
          chapterId = existing.id;
          chaptersUpdated++;
        } else {
          const { data, error } = await sb
            .from("chapters")
            .insert({
              subject_id: subjectRow.id,
              order_index: chapterOrder,
              slug,
              title_en: `${sectionPrefix}${titleEn}`,
              title_or: titleOr,
              title_hi: titleHi,
            })
            .select("id")
            .single();
          if (error) {
            console.error(`    ✗ insert chapter: ${error.message}`);
            continue;
          }
          chapterId = (data as { id: string }).id;
          chaptersInserted++;
          existingBySlug.set(slug, { id: chapterId, order_index: chapterOrder });
        }

        if (FLAGS.force || !existing) {
          await sb.from("topics").delete().eq("chapter_id", chapterId);
        }

        type InsertedTopic = {
          id: string;
          order: number;
          page_start: number | null;
          page_end: number | null;
        };
        const insertedTopics: InsertedTopic[] = [];

        // If the model returned no topics for a chapter, synthesise one
        // covering the chapter itself so the chat-with-topic UX still has
        // something to attach chunks to.
        const tcTopics =
          tc.topics.length > 0
            ? tc.topics
            : [
                {
                  title_en: titleEn,
                  title_or: titleOr,
                  title_hi: titleHi,
                  objectives: [
                    `Understand the lesson "${titleEn}" and its main ideas`,
                  ],
                  page_start: tc.page_start,
                  page_end: tc.page_end,
                },
              ];

        // Topics commonly come back without page ranges (Gemini fills the
        // chapter range but skips per-topic). When all topics in a chapter
        // are missing ranges and the chapter has a known span, distribute
        // the span evenly across topics so chunk linkage still works.
        const allTopicsLackRange = tcTopics.every(
          (t) => t.page_start == null || t.page_end == null,
        );
        if (
          allTopicsLackRange &&
          tc.page_start != null &&
          tc.page_end != null &&
          tcTopics.length > 0
        ) {
          const span = tc.page_end - tc.page_start + 1;
          const per = Math.max(1, Math.floor(span / tcTopics.length));
          for (let ti = 0; ti < tcTopics.length; ti++) {
            const start = tc.page_start + ti * per;
            const end =
              ti === tcTopics.length - 1
                ? tc.page_end
                : Math.min(tc.page_end, tc.page_start + (ti + 1) * per - 1);
            tcTopics[ti].page_start = start;
            tcTopics[ti].page_end = end;
          }
        }

        for (let t = 0; t < tcTopics.length; t++) {
          const topic = tcTopics[t];
          const torder = t + 1;
          const tslug = topicSlug(
            CLASS_LEVEL,
            subjectCode,
            slug,
            topic.title_en,
            torder,
          );
          const objectives = (topic.objectives ?? [])
            .map((s) => String(s).trim())
            .filter((s) => s.length > 0)
            .slice(0, 6);

          const { data, error } = await sb
            .from("topics")
            .insert({
              chapter_id: chapterId,
              order_index: torder,
              slug: tslug,
              title_en: topic.title_en,
              title_or: topic.title_or ?? null,
              title_hi: topic.title_hi ?? null,
              learning_objectives: objectives,
              approx_duration_min: 40,
            })
            .select("id")
            .single();
          if (error) {
            console.error(`    ✗ insert topic ${tslug}: ${error.message}`);
            continue;
          }
          insertedTopics.push({
            id: (data as { id: string }).id,
            order: torder,
            page_start: topic.page_start ?? null,
            page_end: topic.page_end ?? null,
          });
          topicsUpserted++;
        }

        // Link chunks to this chapter by page range. Falls back to all
        // chunks of the document only when the TOC chapter has no range
        // (rare) AND there is just one chapter for the doc.
        if (tc.page_start != null && tc.page_end != null) {
          const { error: chErr } = await sb
            .from("chunks")
            .update({ chapter_id: chapterId })
            .eq("document_id", job.document.id)
            .gte("page", tc.page_start)
            .lte("page", tc.page_end);
          if (chErr) {
            console.error(`    ⚠ chunk chapter-link: ${chErr.message}`);
          }
        } else if (tocChapters.length === 1) {
          const { error: chErr } = await sb
            .from("chunks")
            .update({ chapter_id: chapterId })
            .eq("document_id", job.document.id);
          if (chErr) {
            console.error(`    ⚠ chunk chapter-link: ${chErr.message}`);
          }
        }

        // Link chunks to topics by page range.
        for (const it of insertedTopics) {
          if (it.page_start == null || it.page_end == null) continue;
          const { error: tErr, count } = await sb
            .from("chunks")
            .update({ topic_id: it.id }, { count: "exact" })
            .eq("document_id", job.document.id)
            .gte("page", it.page_start)
            .lte("page", it.page_end);
          if (tErr) {
            console.error(
              `    ⚠ chunk topic-link t${it.order}: ${tErr.message}`,
            );
          } else {
            chunksLinked += count ?? 0;
          }
        }

        console.log(
          `      ✓ ch${chapterOrder} "${titleEn}" (${insertedTopics.length} topics, p ${tc.page_start ?? "?"}-${tc.page_end ?? "?"})`,
        );
      }
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  chapters: +${chaptersInserted} new, ${chaptersUpdated} updated`);
  console.log(`  topics:   ${topicsUpserted} upserted`);
  console.log(`  chunks:   ${chunksLinked} linked to a topic by page range`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
