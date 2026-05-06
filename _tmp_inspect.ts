/**
 * Diagnose why 12 topics have no lesson content:
 * - Do they have any chunks tagged to their topic_id?
 * - Do they have any chunks tagged to their parent chapter (without topic)?
 * - Do they have any chunks tagged to their parent subject (without chapter)?
 * - What do similar nearby topics have?
 *
 * This decides whether the fix is (a) re-ingest from PDF, or (b) re-tag
 * existing chunks to the right topic_ids.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

const GAP_SLUGS = [
  "c6-gsc-ch5-t1",
  "c6-gsc-ch5-t2",
  "c6-gsc-ch5-t3",
  "c6-ssc-ch19-t3",
  "c6-tlh-ch2-t3",
  "c7-gsc-ch8-t3",
  "c7-gsc-ch9-t1",
  "c7-gsc-ch9-t2",
  "c7-gsc-ch12-t1",
  "c7-ssc-ch5-t2",
  "c7-ssc-ch15-t1",
  "c7-tlh-ch15-t1",
  "c8-flo-ch3-t8",
  "c8-flo-ch4-t10",
  "c8-sle-ch3-t1",
  "c8-sle-ch3-t2",
  "c9-flo-ch31-t1",
  "c9-flo-ch33-t1",
];

(async () => {
  const sb = createAdminClient();
  for (const slug of GAP_SLUGS) {
    const { data: t } = await sb
      .from("topics")
      .select("id,slug,title_en,chapter_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!t) {
      console.log(`${slug}: TOPIC NOT FOUND`);
      continue;
    }
    const { data: ch } = await sb
      .from("chapters")
      .select("id,subject_id,title_en,number")
      .eq("id", t.chapter_id)
      .maybeSingle();
    const subjectId = ch?.subject_id;

    // Chunks tagged to this exact topic
    const { count: byTopic } = await sb
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", t.id);
    // Chunks tagged to the chapter but topic_id null
    const { count: byChapter } = await sb
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", ch?.id ?? "00000000-0000-0000-0000-000000000000")
      .is("topic_id", null);
    // Chunks tagged only to subject
    const { count: bySubject } = subjectId
      ? await sb
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", subjectId)
          .is("chapter_id", null)
      : { count: 0 };

    console.log(
      `${slug.padEnd(22)} | ch:${(ch?.number ?? "?").toString().padStart(2)} ${(ch?.title_en ?? "?").slice(0, 35).padEnd(35)} | byTopic=${byTopic ?? 0}, byChapterOnly=${byChapter ?? 0}, bySubjectOnly=${bySubject ?? 0}`,
    );
  }

  console.log("\n--- Subject-level totals (sanity) ---");
  const { data: subs } = await sb
    .from("subjects")
    .select("id,code,class_level")
    .eq("board", "BSE_ODISHA")
    .in("class_level", [6, 7, 8, 9])
    .order("class_level");
  for (const s of subs ?? []) {
    const { count } = await sb
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", s.id);
    console.log(`  C${s.class_level} ${s.code}: ${count ?? 0} chunks`);
  }
})();
