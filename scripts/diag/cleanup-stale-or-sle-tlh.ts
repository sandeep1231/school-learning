/**
 * Class 9 SLE + TLH stale Odia-row cleanup.
 *
 * Background: SLE (Spoken English) and TLH (Hindi) topics were initially
 * generated with language='or' before the bilingual generators were
 * introduced. Phase A of the regen produced fresh rows in the correct
 * languages (SLE→en, TLH→hi) with Odia helper paragraphs embedded.
 * The `or` rows are now polluting the UI — the API already filters via
 * languageProfile, but the dead rows still consume row count and
 * confuse audits.
 *
 * Action per subject (SLE, TLH) for BSE_ODISHA Class 9:
 *   - Find every topic_id under the subject.
 *   - Delete `lesson_variants` rows where topic_id ∈ list AND language='or'.
 *   - Delete `practice_items`  rows where scope_type='topic' AND
 *     scope_id ∈ list AND language='or'.
 *
 * SAFETY:
 *   - Default = dry-run. Reports counts, deletes nothing.
 *   - Pass --apply to commit.
 *   - Will REFUSE to run unless the corresponding non-`or` rows already
 *     exist (so we don't strip the only content present). Specifically:
 *     for each topic, requires at least one lesson_variant in the target
 *     language (en for SLE, hi for TLH) before allowing its `or` rows to
 *     be deleted.
 *
 * Usage:
 *   npx tsx scripts/diag/cleanup-stale-or-sle-tlh.ts             # dry-run
 *   npx tsx scripts/diag/cleanup-stale-or-sle-tlh.ts --apply
 *   npx tsx scripts/diag/cleanup-stale-or-sle-tlh.ts --subjects SLE
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const SUBJECTS = (() => {
  const f = process.argv.find((a) => a.startsWith("--subjects"));
  let raw: string | undefined;
  if (!f) return ["SLE", "TLH"] as const;
  const eq = f.indexOf("=");
  if (eq >= 0) raw = f.slice(eq + 1);
  else raw = process.argv[process.argv.indexOf(f) + 1];
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean) as readonly string[];
})();
const CLASS = 9;
const BOARD = "BSE_ODISHA";

const TARGET_LANGUAGE: Record<string, string> = { SLE: "en", TLH: "hi" };

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function chunkIn<T>(
  ids: string[],
  size: number,
  fn: (slice: string[]) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(await fn(ids.slice(i, i + size))));
  }
  return out;
}

async function main() {
  console.log(`[cleanup-stale-or] mode=${APPLY ? "APPLY" : "DRY-RUN"} subjects=${SUBJECTS.join(",")}`);

  for (const code of SUBJECTS) {
    const targetLang = TARGET_LANGUAGE[code];
    if (!targetLang) {
      console.log(`  ! skip ${code}: no target language mapping`);
      continue;
    }
    console.log(`\n=== ${code} (target language=${targetLang}) ===`);

    // 1) subject_id
    const { data: subj, error: e1 } = await supa
      .from("subjects")
      .select("id, code")
      .eq("board", BOARD)
      .eq("class_level", CLASS)
      .eq("code", code)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!subj) {
      console.log(`  ! subject ${code} not found`);
      continue;
    }

    // 2) chapter ids
    const { data: chapters, error: e2 } = await supa
      .from("chapters")
      .select("id")
      .eq("subject_id", subj.id);
    if (e2) throw new Error(e2.message);
    const chapterIds = (chapters ?? []).map((c) => c.id as string);
    if (chapterIds.length === 0) {
      console.log(`  ! no chapters under ${code}`);
      continue;
    }

    // 3) topic ids (paginated by chapter)
    const topicIds = await chunkIn(chapterIds, 50, async (slice) => {
      const { data, error } = await supa
        .from("topics")
        .select("id")
        .in("chapter_id", slice);
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => t.id as string);
    });
    console.log(`  topics: ${topicIds.length}`);
    if (topicIds.length === 0) continue;

    // 4) Safety check: ensure target-language lesson_variants exist for at
    // least most topics. Bail if coverage is alarmingly low.
    const targetLessons = await chunkIn(topicIds, 100, async (slice) => {
      const { data, error } = await supa
        .from("lesson_variants")
        .select("topic_id")
        .in("topic_id", slice)
        .eq("language", targetLang);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.topic_id as string);
    });
    const topicsWithTarget = new Set(targetLessons);
    const coverage = topicsWithTarget.size / topicIds.length;
    console.log(
      `  target-language lesson coverage: ${topicsWithTarget.size}/${topicIds.length} (${(coverage * 100).toFixed(1)}%)`,
    );
    if (coverage < 0.8) {
      console.log(
        `  ! REFUSING ${code}: target-language coverage <80%. Run Phase A regen first.`,
      );
      continue;
    }

    // Only delete `or` rows from topics that DO have target-language lessons.
    const safeTopicIds = topicIds.filter((id) => topicsWithTarget.has(id));
    console.log(`  safe-to-delete topics: ${safeTopicIds.length}`);

    // 5) Count `or` rows
    const orLessons = await chunkIn(safeTopicIds, 100, async (slice) => {
      const { data, error } = await supa
        .from("lesson_variants")
        .select("id, topic_id")
        .in("topic_id", slice)
        .eq("language", "or");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; topic_id: string }[];
    });
    const orPractice = await chunkIn(safeTopicIds, 100, async (slice) => {
      const { data, error } = await supa
        .from("practice_items")
        .select("id, scope_id")
        .eq("scope_type", "topic")
        .in("scope_id", slice)
        .eq("language", "or");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; scope_id: string }[];
    });
    console.log(`  stale 'or' lesson_variants: ${orLessons.length}`);
    console.log(`  stale 'or' practice_items : ${orPractice.length}`);

    if (!APPLY) continue;

    // 6) Delete in chunks
    const lvIds = orLessons.map((r) => r.id);
    let lvDeleted = 0;
    for (let i = 0; i < lvIds.length; i += 200) {
      const slice = lvIds.slice(i, i + 200);
      const { error } = await supa
        .from("lesson_variants")
        .delete()
        .in("id", slice);
      if (error) throw new Error(error.message);
      lvDeleted += slice.length;
    }
    const piIds = orPractice.map((r) => r.id);
    let piDeleted = 0;
    for (let i = 0; i < piIds.length; i += 200) {
      const slice = piIds.slice(i, i + 200);
      const { error } = await supa
        .from("practice_items")
        .delete()
        .in("id", slice);
      if (error) throw new Error(error.message);
      piDeleted += slice.length;
    }
    console.log(`  ✓ deleted ${lvDeleted} lesson_variants, ${piDeleted} practice_items`);
  }

  console.log(`\n[cleanup-stale-or] done (${APPLY ? "APPLIED" : "dry-run"})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
