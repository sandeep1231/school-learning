import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.join(process.cwd(), ".env.local") });
import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title_en, chapters!inner(subjects!inner(code))");
  if (error) throw error;
  const bySubject = new Map<string, number>();
  const missing: any[] = [];
  for (const t of data ?? []) {
    const code = (t as any).chapters?.subjects?.code ?? "?";
    bySubject.set(code, (bySubject.get(code) ?? 0) + 1);
  }
  // Now check which topics have variants
  const { data: vs } = await supabase.from("lesson_variants").select("topic_id");
  const have = new Set((vs ?? []).map((v: any) => v.topic_id));
  for (const t of data ?? []) {
    if (!have.has((t as any).id)) {
      missing.push({
        id: (t as any).id,
        title: (t as any).title_en,
        code: (t as any).chapters?.subjects?.code,
      });
    }
  }
  console.log("Topics by subject:", Object.fromEntries(bySubject));
  console.log("Topics without variants:", missing.length);
  for (const m of missing) console.log(` - [${m.code}] ${m.title}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
