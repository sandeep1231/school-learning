/**
 * Diagnose chunk-tagging state for the 6 "zero-chunk" subjects in the
 * earlier audit. The audit only counted chunks whose topic_id matched
 * one of the subject's topic_ids. If chunks exist with subject_id set
 * but topic_id null, they were ingested but not topic-tagged — RAG
 * subject-scope retrieval already finds them (so the tutor works), but
 * topic-scoped retrieval misses them (so lesson generation can fall
 * short). Telling these apart lets us pick the right fix.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

const TARGETS: Array<[number, string]> = [
  [6, "CMP"],
  [7, "CMP"],
  [9, "FLO"],
  [9, "GSC"],
  [9, "SLE"],
  [9, "TLH"],
  // sanity baseline: should have full topic tagging
  [9, "MTH"],
];

(async () => {
  const sb = createAdminClient();
  console.log("\nClass · Subject | docs | chunks-by-doc | chunks-with-topic | chunks-with-chapter-only | chunks-untagged");
  console.log("-".repeat(120));
  for (const [cls, code] of TARGETS) {
    const { data: subj } = await sb
      .from("subjects")
      .select("id")
      .eq("board", "BSE_ODISHA")
      .eq("class_level", cls)
      .eq("code", code)
      .maybeSingle();
    if (!subj) {
      console.log(`C${cls} ${code}: NOT FOUND`);
      continue;
    }
    const { data: docs } = await sb
      .from("documents")
      .select("id")
      .eq("subject_id", subj.id);
    const docIds = (docs ?? []).map((d) => d.id);
    if (docIds.length === 0) {
      console.log(`C${cls} ${code}: 0 docs`);
      continue;
    }
    const [byDoc, withTopic, withChapterOnly, untagged] = await Promise.all([
      sb
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .in("document_id", docIds),
      sb
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .in("document_id", docIds)
        .not("topic_id", "is", null),
      sb
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .in("document_id", docIds)
        .is("topic_id", null)
        .not("chapter_id", "is", null),
      sb
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .in("document_id", docIds)
        .is("topic_id", null)
        .is("chapter_id", null),
    ]);
    console.log(
      `C${cls} ${code}`.padEnd(15) +
        ` ${docIds.length}`.padStart(7) +
        `   ${byDoc.count ?? 0}`.padStart(15) +
        `   ${withTopic.count ?? 0}`.padStart(20) +
        `   ${withChapterOnly.count ?? 0}`.padStart(28) +
        `   ${untagged.count ?? 0}`.padStart(15),
    );
  }
})();
