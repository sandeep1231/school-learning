import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "../../lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();
  const { data: subj } = await sb
    .from("subjects")
    .select("id, code, class_level")
    .eq("board", "BSE_ODISHA")
    .in("code", ["SAN", "CMP"])
    .order("class_level");

  let totalTopics = 0;
  let totalLessons = 0;
  let totalPractice = 0;
  for (const s of subj ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id")
      .eq("subject_id", s.id);
    const chIds = (chs ?? []).map((c: any) => c.id);
    if (chIds.length === 0) continue;
    const { data: tops } = await sb
      .from("topics")
      .select("id")
      .in("chapter_id", chIds);
    const tIds = (tops ?? []).map((t: any) => t.id);
    const tCount = tIds.length;

    let lvCount = 0;
    let piCount = 0;
    if (tIds.length > 0) {
      const { count: lc } = await sb
        .from("lesson_variants")
        .select("*", { count: "exact", head: true })
        .in("topic_id", tIds);
      lvCount = lc ?? 0;
      const { count: pc } = await sb
        .from("practice_items")
        .select("*", { count: "exact", head: true })
        .eq("scope_type", "topic")
        .in("scope_id", tIds);
      piCount = pc ?? 0;
    }
    totalTopics += tCount;
    totalLessons += lvCount;
    totalPractice += piCount;
    console.log(
      `C${s.class_level} ${s.code}: ${tCount} topics, ${lvCount} lesson_variants, ${piCount} practice_items`,
    );
  }
  console.log(`\nTOTAL: ${totalTopics} topics, ${totalLessons} lessons, ${totalPractice} practice`);
  console.log(`Expected when complete: ${totalTopics * 4} lessons (4 variants), ${totalTopics * 8} practice (8 items)`);
})();
