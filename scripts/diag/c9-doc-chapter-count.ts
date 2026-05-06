// Diagnostic: per-document chapter & topic counts for BSE Odisha Class 9.
// Helps locate which PDF caused chapter/topic inflation.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await build(from, from + 999);
    if (error) return out;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
    from += 1000;
  }
  return out;
}

async function main() {
  console.log("=== Class 9 documents → chapters → topics breakdown ===\n");
  const { data: subjects } = await supa
    .from("subjects")
    .select("id, code")
    .eq("board", "BSE_ODISHA")
    .eq("class_level", 9);

  for (const s of subjects ?? []) {
    const { data: docs } = await supa
      .from("documents")
      .select("id, title")
      .eq("subject_id", s.id);

    const chapters = await fetchAll<{ id: string; title_en: string; slug: string; order_index: number }>(
      (from, to) =>
        supa
          .from("chapters")
          .select("id, title_en, slug, order_index")
          .eq("subject_id", s.id)
          .order("order_index")
          .range(from, to),
    );
    const chIds = chapters.map((c) => c.id);
    const topics = await fetchAll<{ chapter_id: string }>(
      (from, to) => supa.from("topics").select("chapter_id").in("chapter_id", chIds.length ? chIds : ["00000000-0000-0000-0000-000000000000"]).range(from, to),
    );
    const topicCountByCh = new Map<string, number>();
    for (const t of topics) topicCountByCh.set(t.chapter_id, (topicCountByCh.get(t.chapter_id) ?? 0) + 1);

    console.log(`--- ${s.code} (${(docs ?? []).length} docs, ${chapters.length} chapters, ${topics.length} topics) ---`);
    for (const d of docs ?? []) {
      console.log(`  Document: ${d.title}`);
    }
    console.log(`  All chapters (slug | order | title | #topics):`);
    for (const c of chapters) {
      const n = topicCountByCh.get(c.id) ?? 0;
      console.log(`    ${(c.slug ?? "").padEnd(20)} ord=${String(c.order_index).padStart(3)} t=${String(n).padStart(2)} | ${(c.title_en ?? "").slice(0, 70)}`);
    }
    console.log();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
