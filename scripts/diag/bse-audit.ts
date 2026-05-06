import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// PostgREST default limit is 1000 rows; paginate.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      console.log(`  ${label} err:`, error.message);
      return out;
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    from += PAGE;
  }
  return out;
}

async function main() {
  console.log("\n=== BSE Odisha — content audit ===\n");

  for (const cls of [6, 7, 8, 9]) {
    const { data: subs, error: subErr } = await supa
      .from("subjects")
      .select("id, code, name_en")
      .eq("board", "BSE_ODISHA")
      .eq("class_level", cls);
    if (subErr) console.log("  subErr:", subErr.message);
    const subjects = subs ?? [];
    const subIds = subjects.map((s) => s.id);

    const chapters = await fetchAll<{ id: string; subject_id: string }>(
      (from, to) =>
        supa
          .from("chapters")
          .select("id, subject_id")
          .in("subject_id", subIds.length ? subIds : ["00000000-0000-0000-0000-000000000000"])
          .range(from, to),
      "chapters",
    );
    const chIds = chapters.map((c) => c.id);

    const topics = await fetchAll<{ id: string; chapter_id: string; slug: string | null }>(
      (from, to) =>
        supa
          .from("topics")
          .select("id, chapter_id, slug")
          .in("chapter_id", chIds.length ? chIds : ["00000000-0000-0000-0000-000000000000"])
          .range(from, to),
      "topics",
    );
    const topicIds = topics.map((t) => t.id);

    // Lesson variants (table is `lesson_variants`)
    let topicsWithLesson = 0;
    if (topicIds.length) {
      const lesTopics = await fetchAll<{ topic_id: string }>(
        (from, to) =>
          supa.from("lesson_variants").select("topic_id").in("topic_id", topicIds).range(from, to),
        "lesson_variants",
      );
      topicsWithLesson = new Set(lesTopics.map((r) => r.topic_id)).size;
    }

    // Practice items (scope_type='topic', scope_id=topic_id)
    let topicsWithPractice = 0;
    if (topicIds.length) {
      const prTopics = await fetchAll<{ scope_id: string }>(
        (from, to) =>
          supa
            .from("practice_items")
            .select("scope_type, scope_id")
            .eq("scope_type", "topic")
            .in("scope_id", topicIds)
            .range(from, to),
        "practice_items",
      );
      topicsWithPractice = new Set(prTopics.map((r) => r.scope_id)).size;
    }

    // Chunks (chunks have document_id, not subject_id — join via documents)
    let chunkTotal = 0,
      chunkWithPage = 0,
      chunkWithTopic = 0,
      chunkWithChapter = 0;
    if (subIds.length) {
      const { data: docs } = await supa
        .from("documents")
        .select("id")
        .in("subject_id", subIds);
      const docIds = (docs ?? []).map((d: { id: string }) => d.id);
      if (docIds.length) {
        const { count: total } = await supa
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .in("document_id", docIds);
        chunkTotal = total ?? 0;
        const { count: withPage } = await supa
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .in("document_id", docIds)
          .not("page", "is", null);
        chunkWithPage = withPage ?? 0;
        const { count: withTopic } = await supa
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .in("document_id", docIds)
          .not("topic_id", "is", null);
        chunkWithTopic = withTopic ?? 0;
        const { count: withChapter } = await supa
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .in("document_id", docIds)
          .not("chapter_id", "is", null);
        chunkWithChapter = withChapter ?? 0;
      }
    }

    console.log(`--- Class ${cls} ---`);
    console.log(
      `  subjects=${subjects.length}  chapters=${chapters.length}  topics=${topics.length}`,
    );
    console.log(
      `  lessons: ${topicsWithLesson} topics covered  ·  practice: ${topicsWithPractice} topics covered`,
    );
    console.log(
      `  chunks: ${chunkTotal} total · ${chunkWithPage} w/page · ${chunkWithTopic} w/topic · ${chunkWithChapter} w/chapter`,
    );

    // Per-subject breakdown
    for (const s of subjects.sort((a, b) => a.code.localeCompare(b.code))) {
      const subChs = chapters.filter((c) => c.subject_id === s.id);
      const subChIds = new Set(subChs.map((c) => c.id));
      const subTops = topics.filter((t) => subChIds.has(t.chapter_id));
      const subTopIds = subTops.map((t) => t.id);

      let lc = 0,
        pc = 0;
      if (subTopIds.length) {
        const ld = await fetchAll<{ topic_id: string }>(
          (from, to) =>
            supa
              .from("lesson_variants")
              .select("topic_id")
              .in("topic_id", subTopIds)
              .range(from, to),
          `lesson_variants[${s.code}]`,
        );
        lc = new Set(ld.map((r) => r.topic_id)).size;
        const pd = await fetchAll<{ scope_id: string }>(
          (from, to) =>
            supa
              .from("practice_items")
              .select("scope_id")
              .eq("scope_type", "topic")
              .in("scope_id", subTopIds)
              .range(from, to),
          `practice_items[${s.code}]`,
        );
        pc = new Set(pd.map((r) => r.scope_id)).size;
      }
      console.log(
        `    ${s.code.padEnd(4)} ch=${String(subChs.length).padStart(3)}  top=${String(subTops.length).padStart(3)}  lesson=${String(lc).padStart(3)}  prac=${String(pc).padStart(3)}`,
      );
    }
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
