import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const sb = createAdminClient();
  const slugs = [
    "c6-san-chapter-one-invocation-prayer-to-lord-ganesha",
    "c6-cmp-basic-concepts-of-computer-what-is-computer",
  ];
  for (const slug of slugs) {
    const { data: t } = await sb
      .from("topics")
      .select("id, slug")
      .eq("slug", slug)
      .single();
    if (!t) { console.log("MISSING", slug); continue; }
    const { data: vs } = await sb
      .from("lesson_variants")
      .select("variant, language, body_md")
      .eq("topic_id", t.id);
    console.log("===", slug, "===");
    for (const v of vs ?? []) {
      console.log(`--- ${v.variant} [${v.language}] (${v.body_md.length} chars) ---`);
      console.log(v.body_md.slice(0, 600));
      console.log();
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
