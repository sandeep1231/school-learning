/**
 * Pull a few lesson bodies that contain ```mermaid blocks (or image
 * markdown ![...](...)) and inspect what's actually in there. The
 * "Diagram couldn't be rendered" fallback fires for every block whose
 * mermaid.render() throws — knowing whether the source is malformed,
 * stale, or just unusual lets us pick the right fix.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();
  const { data: rows, error } = await sb
    .from("lesson_variants")
    .select("topic_id, variant, body_md")
    .ilike("body_md", "%```mermaid%")
    .limit(5);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Sampled ${rows?.length ?? 0} lessons with mermaid blocks.\n`);
  for (const r of rows ?? []) {
    const body = r.body_md as string;
    const blocks = body.match(/```mermaid\n([\s\S]*?)```/g) ?? [];
    console.log(`---\ntopic_id=${r.topic_id} variant=${r.variant} mermaid blocks=${blocks.length}`);
    for (const b of blocks.slice(0, 2)) {
      console.log("\n" + b.replace(/^/gm, "    "));
    }
  }

  // Also check image markdown to see if any lessons embed images.
  const { data: imgRows } = await sb
    .from("lesson_variants")
    .select("topic_id, variant, body_md")
    .ilike("body_md", "%![%](%")
    .limit(3);
  console.log(`\n\n=== Lessons with image markdown ===`);
  for (const r of imgRows ?? []) {
    const body = r.body_md as string;
    const imgs = body.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
    console.log(`\n---\ntopic_id=${r.topic_id} variant=${r.variant} images=${imgs.length}`);
    for (const i of imgs.slice(0, 3)) console.log(`    ${i}`);
  }
})();
