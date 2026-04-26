import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.join(process.cwd(), ".env.local") });
import { createAdminClient } from "../../lib/supabase/admin";

const ODIA_RE = /[\u0B00-\u0B7F]/;
const MOJIBAKE_RE = /[ÃÂâ€™“”]|à¬|à­/;

async function main() {
  const supabase = createAdminClient();
  const { data: variants, error: e1 } = await supabase
    .from("lesson_variants")
    .select("topic_id, variant, body_md");
  if (e1) throw e1;
  const { data: items, error: e2 } = await supabase
    .from("practice_items")
    .select("scope_type, scope_id, question_md");
  if (e2) throw e2;
  const { data: topics, error: e3 } = await supabase
    .from("topics")
    .select("id, chapters!inner(subjects!inner(code))");
  if (e3) throw e3;
  const tById = new Map(
    topics!.map((t: any) => [
      t.id,
      { code: t.chapters?.subjects?.code ?? "?" },
    ]),
  );

  const subjStats = new Map<
    string,
    { variants: number; items: number; mojibake: number; odia: number }
  >();

  for (const v of variants ?? []) {
    const t = tById.get((v as any).topic_id) as any;
    if (!t) continue;
    const code = t.code;
    const s = subjStats.get(code) ?? {
      variants: 0,
      items: 0,
      mojibake: 0,
      odia: 0,
    };
    s.variants += 1;
    if (MOJIBAKE_RE.test((v as any).body_md ?? "")) s.mojibake += 1;
    if (ODIA_RE.test((v as any).body_md ?? "")) s.odia += 1;
    subjStats.set(code, s);
  }
  for (const it of items ?? []) {
    if ((it as any).scope_type !== "topic") continue;
    const t = tById.get((it as any).scope_id) as any;
    if (!t) continue;
    const code = t.code;
    const s = subjStats.get(code) ?? {
      variants: 0,
      items: 0,
      mojibake: 0,
      odia: 0,
    };
    s.items += 1;
    if (MOJIBAKE_RE.test((it as any).question_md ?? "")) s.mojibake += 1;
    if (ODIA_RE.test((it as any).question_md ?? "")) s.odia += 1;
    subjStats.set(code, s);
  }

  console.log("Subject content summary:");
  for (const [code, s] of [...subjStats.entries()].sort()) {
    const total = s.variants + s.items;
    const odiaPct = total ? ((s.odia / total) * 100).toFixed(1) : "0.0";
    const mojiPct = total ? ((s.mojibake / total) * 100).toFixed(1) : "0.0";
    console.log(
      `  ${code}: variants=${s.variants}, items=${s.items}, odia=${odiaPct}%, mojibake=${mojiPct}%`,
    );
  }
  console.log(
    `Totals: variants=${variants?.length ?? 0}, items=${items?.length ?? 0}, topics=${topics?.length ?? 0}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
