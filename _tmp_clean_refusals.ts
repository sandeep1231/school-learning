/**
 * Delete lesson_variants rows whose body_md is a model refusal stub
 * (RAG returned no chunks → model said "I can't generate this lesson").
 *
 * Heuristic: body_md is < 200 chars AND contains a known refusal marker.
 * The validator already showed all sub-200-char lessons share this pattern;
 * the marker check is a paranoia belt to avoid deleting legitimately short
 * lessons in some future scenario.
 *
 * After deletion the learn page renders its existing "Lesson being prepared"
 * fallback (learn/page.tsx:136) instead of garbage refusal text.
 *
 * Pass --dry to preview without deleting.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

const REFUSAL_MARKERS = [
  "କୌଣସି ସୂଚନା ନାହିଁ",       // "no information"
  "ଉପଲବ୍ଧ ନାହିଁ",             // "not available"
  "ପ୍ରସ୍ତୁତ କରିବା ସମ୍ଭବ ନୁହେଁ", // "cannot be prepared"
  "କୌଣସି ତଥ୍ୟ ଉପଲବ୍ଧ ନାହିଁ",  // "no data available"
  "no information",
  "not available",
  "cannot be prepared",
  "is not possible",
];

(async () => {
  const dryRun = process.argv.includes("--dry");
  const sb = createAdminClient();

  // Pull all lesson rows in pages and filter client-side.
  let from = 0;
  const PAGE = 1000;
  const refusals: { id: string; topic_id: string; variant: string; len: number; preview: string }[] = [];
  for (;;) {
    const { data, error } = await sb
      .from("lesson_variants")
      .select("id,topic_id,variant,body_md")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("query err:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const l of data) {
      const body = (l.body_md ?? "") as string;
      if (body.length >= 200) continue;
      const looksLikeRefusal = REFUSAL_MARKERS.some((m) => body.includes(m));
      if (!looksLikeRefusal) continue;
      refusals.push({
        id: l.id,
        topic_id: l.topic_id,
        variant: l.variant,
        len: body.length,
        preview: body.slice(0, 80).replace(/\n/g, " "),
      });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Found ${refusals.length} refusal-stub lesson rows.`);
  // Map topic_ids to slugs so we can show what we're about to clear.
  const tIds = Array.from(new Set(refusals.map((r) => r.topic_id)));
  const slugByTopicId = new Map<string, string>();
  if (tIds.length > 0) {
    const { data: tps } = await sb.from("topics").select("id,slug").in("id", tIds);
    for (const t of tps ?? []) slugByTopicId.set(t.id, t.slug);
  }
  // Group by topic for the display.
  const byTopic = new Map<string, typeof refusals>();
  for (const r of refusals) {
    const k = r.topic_id;
    (byTopic.get(k) ?? byTopic.set(k, []).get(k))!.push(r);
  }
  for (const [tid, rows] of byTopic) {
    const slug = slugByTopicId.get(tid) ?? tid;
    console.log(`  ${slug}: ${rows.length} variants — "${rows[0].preview}…"`);
  }

  if (dryRun) {
    console.log("\nDry run — no rows deleted. Re-run without --dry to apply.");
    return;
  }
  if (refusals.length === 0) return;

  // Delete in batches.
  let deleted = 0;
  for (let i = 0; i < refusals.length; i += 100) {
    const batch = refusals.slice(i, i + 100).map((r) => r.id);
    const { error } = await sb.from("lesson_variants").delete().in("id", batch);
    if (error) {
      console.error("delete err:", error);
      process.exit(1);
    }
    deleted += batch.length;
  }
  console.log(`\nDeleted ${deleted} rows.`);
})();
