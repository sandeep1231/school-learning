import { config } from "dotenv"; config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // Re-fetch the SSC orphans (now have ssc-ch6-disasters-* slugs from my earlier move,
  // but they are duplicates of existing ssc-6-* topics with content). Match by id.
  const sscIds = ["90acae94-0636-4a74-8746-6bd7d978b351","e52c48ae-889e-4ac9-b098-cec063159042","c5f858cd-06bc-49ee-8725-269bbc264820"];
  const { data: mthNulls } = await s.from("topics").select("id, title_en").is("slug", null);
  const mthIds = (mthNulls ?? []).map((r) => r.id as string);

  console.log("deleting", sscIds.length, "SSC duplicate orphans");
  const r1 = await s.from("topics").delete().in("id", sscIds);
  if (r1.error) throw new Error(r1.error.message);

  console.log("deleting", mthIds.length, "MTH null-slug orphans");
  if (mthIds.length) {
    const r2 = await s.from("topics").delete().in("id", mthIds);
    if (r2.error) throw new Error(r2.error.message);
  }

  // Verify
  const { count: remaining } = await s.from("topics").select("id", { count: "exact", head: true }).is("slug", null);
  console.log("remaining null-slug topics:", remaining);

  // Recount Class 9 topics per subject
  const codes = ["FLO","GSC","MTH","SLE","SSC","TLH"];
  for (const code of codes) {
    const { data: subj } = await s.from("subjects").select("id").eq("board","BSE_ODISHA").eq("class_level",9).eq("code", code).maybeSingle();
    if (!subj) continue;
    const { data: chs } = await s.from("chapters").select("id").eq("subject_id", subj.id);
    const ids = (chs ?? []).map((c) => c.id as string);
    const { count } = await s.from("topics").select("id", { count: "exact", head: true }).in("chapter_id", ids);
    console.log(`  ${code}: ${count} topics`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
