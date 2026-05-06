import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const sb = createAdminClient();
  for (const cls of [6, 7, 8]) {
    for (const code of ["SAN", "CMP"]) {
      const { data: subj } = await sb
        .from("subjects").select("id")
        .eq("board", "BSE_ODISHA").eq("class_level", cls).eq("code", code).maybeSingle();
      if (!subj) { console.log(`C${cls} ${code}: no subject`); continue; }
      const { data: chs } = await sb.from("chapters").select("id").eq("subject_id", subj.id);
      const chIds = (chs ?? []).map((c) => c.id);
      if (chIds.length === 0) { console.log(`C${cls} ${code}: 0 chapters`); continue; }
      const { data: tops } = await sb.from("topics").select("id").in("chapter_id", chIds);
      const tIds = (tops ?? []).map((t) => t.id);
      const { data: lvs } = await sb
        .from("lesson_variants")
        .select("topic_id")
        .in("topic_id", tIds);
      const counts = new Map<string, number>();
      for (const r of lvs ?? []) counts.set(r.topic_id, (counts.get(r.topic_id) ?? 0) + 1);
      const topicsWith4 = [...counts.values()].filter((n) => n >= 4).length;
      const { count: practiceCount } = await sb
        .from("practice_items").select("id", { count: "exact", head: true }).in("topic_id", tIds);
      console.log(
        `C${cls} ${code}: chapters=${chIds.length} topics=${tIds.length} ` +
        `lessoned=${topicsWith4}/${tIds.length} variants=${lvs?.length ?? 0} practice=${practiceCount}`,
      );
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
