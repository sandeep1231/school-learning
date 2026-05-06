/**
 * Class 9 chapter dedup + cleanup for BSE Odisha.
 *
 * Problem: scripts/seed/topics-from-docs.ts ran 3× with `nextChapterOrder =
 * max(existing)+1`, so each pass appended fresh duplicate chapters with
 * incrementing slugs (c9-flo-ch12-... c9-flo-ch47-... c9-flo-ch82-...).
 * Plus there are leftover orphan chapters from the previous hardcoded
 * `lib/curriculum/bse-class9.ts` baselines (slugs like `flo-gr-varna`,
 * `gsc-phy-1`) that have 0 topics.
 *
 * Fix per subject (default: GSC, FLO, SLE, TLH; MTH and SSC are clean):
 *   1. Drop orphan baselines: chapters with 0 topics whose slug does NOT
 *      start with `c{class}-`.
 *   2. Group remaining chapters by `title_en` and keep ONLY the row with
 *      the LOWEST `order_index`. Delete the other rows.
 *      For each deleted topic: also delete `practice_items` rows whose
 *      `scope_type='topic'` and `scope_id=topic.id` (no FK cascade for
 *      polymorphic scope).
 *   3. Renumber `order_index` of the survivors to 1..N (preserving the
 *      original ordering from the kept rows).
 *
 * Usage:
 *   npx tsx scripts/diag/cleanup-c9-duplicates.ts --dry-run        # default
 *   npx tsx scripts/diag/cleanup-c9-duplicates.ts --apply          # commit
 *   npx tsx scripts/diag/cleanup-c9-duplicates.ts --apply --subjects GSC,FLO
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const SUBJECTS = (() => {
  const f = process.argv.find((a) => a.startsWith("--subjects"));
  let raw: string | undefined;
  if (!f) return ["GSC", "FLO", "SLE", "TLH"];
  const eq = f.indexOf("=");
  if (eq >= 0) raw = f.slice(eq + 1);
  else raw = process.argv[process.argv.indexOf(f) + 1];
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
})();
const CLASS = 9;
const BOARD = "BSE_ODISHA";

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
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
    from += 1000;
  }
  return out;
}

type Chapter = { id: string; subject_id: string; order_index: number; slug: string | null; title_en: string | null };
type Topic = { id: string; chapter_id: string; slug: string | null };

async function main() {
  console.log(`\n=== Cleanup Class ${CLASS} duplicates (${BOARD}) ===`);
  console.log(`  Mode: ${APPLY ? "APPLY (DESTRUCTIVE)" : "DRY-RUN (no writes)"}`);
  console.log(`  Subjects: ${SUBJECTS.join(", ")}\n`);

  const { data: subjects, error: sErr } = await supa
    .from("subjects")
    .select("id, code")
    .eq("board", BOARD)
    .eq("class_level", CLASS)
    .in("code", SUBJECTS);
  if (sErr) throw new Error(sErr.message);

  let totalChDeleted = 0;
  let totalTopicsDeleted = 0;
  let totalPracticeDeleted = 0;
  let totalLessonsDeleted = 0;
  let totalRenumbered = 0;

  for (const subj of subjects ?? []) {
    console.log(`--- ${subj.code} ---`);

    const chapters = await fetchAll<Chapter>((f, t) =>
      supa
        .from("chapters")
        .select("id, subject_id, order_index, slug, title_en")
        .eq("subject_id", subj.id)
        .order("order_index")
        .range(f, t),
    );
    const chIds = chapters.map((c) => c.id);
    const topics = chIds.length
      ? await fetchAll<Topic>((f, t) =>
          supa
            .from("topics")
            .select("id, chapter_id, slug")
            .in("chapter_id", chIds)
            .range(f, t),
        )
      : [];
    const topicsByChapter = new Map<string, Topic[]>();
    for (const tp of topics) {
      const list = topicsByChapter.get(tp.chapter_id) ?? [];
      list.push(tp);
      topicsByChapter.set(tp.chapter_id, list);
    }

    // Step 1: orphan baselines (0 topics, slug not starting with c{CLASS}-).
    const prefix = `c${CLASS}-`;
    const orphans = chapters.filter(
      (c) =>
        (topicsByChapter.get(c.id)?.length ?? 0) === 0 &&
        !(c.slug ?? "").toLowerCase().startsWith(prefix),
    );

    // Step 2: dedup by title_en. Keep lowest order_index.
    const remaining = chapters.filter((c) => !orphans.includes(c));
    const byTitle = new Map<string, Chapter[]>();
    for (const c of remaining) {
      const key = (c.title_en ?? "").trim();
      const list = byTitle.get(key) ?? [];
      list.push(c);
      byTitle.set(key, list);
    }
    const toDelete: Chapter[] = [...orphans];
    const survivors: Chapter[] = [];
    for (const [, group] of byTitle) {
      group.sort((a, b) => a.order_index - b.order_index);
      survivors.push(group[0]);
      for (let i = 1; i < group.length; i++) toDelete.push(group[i]);
    }
    survivors.sort((a, b) => a.order_index - b.order_index);

    // Practice items to delete (scope_type='topic' for affected topic ids).
    const topicsToDelete = toDelete.flatMap((c) => topicsByChapter.get(c.id) ?? []);
    const topicIdsToDelete = topicsToDelete.map((t) => t.id);

    let practiceCount = 0;
    let lessonCount = 0;
    if (topicIdsToDelete.length) {
      // Count practice_items
      for (let i = 0; i < topicIdsToDelete.length; i += 200) {
        const chunk = topicIdsToDelete.slice(i, i + 200);
        const { count, error } = await supa
          .from("practice_items")
          .select("id", { count: "exact", head: true })
          .eq("scope_type", "topic")
          .in("scope_id", chunk);
        if (error) throw new Error(`count practice: ${error.message}`);
        practiceCount += count ?? 0;
      }
      // Count lesson_variants
      for (let i = 0; i < topicIdsToDelete.length; i += 200) {
        const chunk = topicIdsToDelete.slice(i, i + 200);
        const { count, error } = await supa
          .from("lesson_variants")
          .select("id", { count: "exact", head: true })
          .in("topic_id", chunk);
        if (error) throw new Error(`count lessons: ${error.message}`);
        lessonCount += count ?? 0;
      }
    }

    console.log(
      `  Chapters: ${chapters.length} total | survive=${survivors.length} | delete=${toDelete.length} (orphans=${orphans.length})`,
    );
    console.log(
      `  Topics to delete: ${topicsToDelete.length} | Lessons to delete: ${lessonCount} | Practice to delete: ${practiceCount}`,
    );

    if (APPLY) {
      // 1. Delete practice_items first (no FK cascade for polymorphic).
      for (let i = 0; i < topicIdsToDelete.length; i += 200) {
        const chunk = topicIdsToDelete.slice(i, i + 200);
        const { error } = await supa
          .from("practice_items")
          .delete()
          .eq("scope_type", "topic")
          .in("scope_id", chunk);
        if (error) throw new Error(`del practice: ${error.message}`);
      }
      // 2. Delete chapters (cascades topics → lesson_variants).
      const delIds = toDelete.map((c) => c.id);
      for (let i = 0; i < delIds.length; i += 200) {
        const chunk = delIds.slice(i, i + 200);
        const { error } = await supa.from("chapters").delete().in("id", chunk);
        if (error) throw new Error(`del chapters: ${error.message}`);
      }
      // 3. Renumber survivors. Avoid unique-constraint clash by going to
      //    a temp negative range first, then back to 1..N.
      let renumbered = 0;
      for (let i = 0; i < survivors.length; i++) {
        const tempOrder = -(i + 1);
        const { error } = await supa
          .from("chapters")
          .update({ order_index: tempOrder })
          .eq("id", survivors[i].id);
        if (error) throw new Error(`temp renumber: ${error.message}`);
      }
      for (let i = 0; i < survivors.length; i++) {
        const finalOrder = i + 1;
        if (survivors[i].order_index !== finalOrder) renumbered++;
        const { error } = await supa
          .from("chapters")
          .update({ order_index: finalOrder })
          .eq("id", survivors[i].id);
        if (error) throw new Error(`final renumber: ${error.message}`);
      }
      console.log(`  ✓ Applied. Renumbered ${renumbered} chapter(s).`);
      totalRenumbered += renumbered;
    }

    totalChDeleted += toDelete.length;
    totalTopicsDeleted += topicsToDelete.length;
    totalPracticeDeleted += practiceCount;
    totalLessonsDeleted += lessonCount;
    console.log();
  }

  console.log("=== Summary ===");
  console.log(`  Chapters deleted: ${totalChDeleted}`);
  console.log(`  Topics deleted:   ${totalTopicsDeleted}`);
  console.log(`  Lessons deleted:  ${totalLessonsDeleted}`);
  console.log(`  Practice deleted: ${totalPracticeDeleted}`);
  if (APPLY) console.log(`  Renumbered:       ${totalRenumbered}`);
  else console.log(`  (dry-run, no writes performed; pass --apply to commit)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
