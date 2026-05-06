import { config } from "dotenv"; config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const sscIds = ["90acae94-0636-4a74-8746-6bd7d978b351","e52c48ae-889e-4ac9-b098-cec063159042","c5f858cd-06bc-49ee-8725-269bbc264820"];
  const { data: mthNulls } = await s.from("topics").select("id").is("slug", null);
  const allIds = [...sscIds, ...(mthNulls ?? []).map((r) => r.id as string)];
  for (const t of ["chunks", "documents", "lesson_progress", "quiz_attempt"]) {
    const { count, error } = await s.from(t).select("id", { count: "exact", head: true }).in("topic_id", allIds);
    console.log(`  ${t}: ${error ? "(skip:" + error.message.slice(0,40) + ")" : count + " refs"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
