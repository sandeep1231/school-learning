import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "../../lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();
  const { data: subj } = await sb
    .from("subjects")
    .select("id,code,class_level")
    .eq("board", "BSE_ODISHA")
    .in("code", ["SAN", "CMP"])
    .order("class_level");
  for (const s of subj ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id,order_index,slug,title_en")
      .eq("subject_id", s.id)
      .order("order_index");
    const ids = (chs ?? []).map((c: any) => c.id);
    const { count: tc } = await sb
      .from("topics")
      .select("*", { count: "exact", head: true })
      .in("chapter_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    console.log(`=== ${s.code} C${s.class_level} — ${(chs ?? []).length} ch / ${tc ?? 0} topics ===`);
    for (const c of chs ?? []) console.log(`  ch${c.order_index}  ${c.slug}  | ${c.title_en}`);
  }
})();
