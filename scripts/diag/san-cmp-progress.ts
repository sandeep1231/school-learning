import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const sb = createAdminClient();
  // Count lesson_variants for SAN/CMP topics by class
  for (const cls of [6, 7, 8]) {
    for (const code of ["SAN", "CMP"]) {
      const { data: subj } = await sb
        .from("subjects")
        .select("id")
        .eq("board", "BSE_ODISHA")
        .eq("class_level", cls)
        .eq("code", code)
        .maybeSingle();
      if (!subj) { console.log(`C${cls} ${code}: no subject`); continue; }
      const { data: chs } = await sb.from("chapters").select("id").eq("subject_id", subj.id);
      const chIds = (chs ?? []).map((c) => c.id);
      if (chIds.length === 0) { console.log(`C${cls} ${code}: 0 chapters`); continue; }
      const { data: tops } = await sb.from("topics").select("id").in("chapter_id", chIds);
      const tIds = (tops ?? []).map((t) => t.id);
      const { count: lessonCount } = await sb
        .from("lesson_variants")
        .select("id", { count: "exact", head: true })
        .in("topic_id", tIds);
      const { count: practiceCount } = await sb
        .from("practice_items")
        .select("id", { count: "exact", head: true })
        .in("topic_id", tIds);
      const topicsWith4 = await (async () => {
        let n = 0;
        for (const id of tIds) {
          const { count } = await sb
            .from("lesson_variants")
            .select("id", { count: "exact", head: true })
            .eq("topic_id", id);
          if ((count ?? 0) >= 4) n++;
        }
        return n;
      })();
      console.log(
        `C${cls} ${code}: chapters=${chIds.length} topics=${tIds.length} ` +
        `topics_with_4_lessons=${topicsWith4} total_lesson_variants=${lessonCount} practice_items=${practiceCount}`,
      );
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
