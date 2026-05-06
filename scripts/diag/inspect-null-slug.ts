import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: nulls } = await s
    .from("topics")
    .select("id, title_en, chapter_id")
    .is("slug", null);
  const list = nulls ?? [];
  console.log("all null-slug topics:", list.length);
  const chapterIds = [...new Set(list.map((t) => t.chapter_id as string))];
  const { data: chaps } = await s
    .from("chapters")
    .select("id, slug, title_en, subject_id")
    .in("id", chapterIds);
  const cl = chaps ?? [];
  const { data: subjs } = await s
    .from("subjects")
    .select("id, code, board, class_level")
    .in("id", [...new Set(cl.map((c) => c.subject_id as string))]);
  const subjMap = new Map((subjs ?? []).map((x) => [x.id as string, x]));
  const chapMap = new Map(cl.map((c) => [c.id as string, c]));
  for (const n of list) {
    const c = chapMap.get(n.chapter_id as string);
    const subj = c ? subjMap.get(c.subject_id as string) : null;
    const sLabel = subj ? `${subj.board}/c${subj.class_level}/${subj.code}` : "?";
    const cLabel = c ? c.slug ?? "?" : "?";
    console.log(`  [${sLabel}] ${cLabel} :: ${n.title_en} (id=${(n.id as string).slice(0, 8)})`);
  }
  const ids = list.map((n) => n.id as string);
  if (ids.length) {
    const { count: lvCount } = await s
      .from("lesson_variants")
      .select("id", { count: "exact", head: true })
      .in("topic_id", ids);
    const { count: piCount } = await s
      .from("practice_items")
      .select("id", { count: "exact", head: true })
      .eq("scope_type", "topic")
      .in("scope_id", ids);
    console.log("attached lesson_variants:", lvCount, "practice_items:", piCount);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
