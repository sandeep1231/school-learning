/**
 * Per-topic stage availability audit.
 *
 * For every topic in the DB across BSE_ODISHA C6–C9, computes the same
 * flags the topic-hub page uses to lock/unlock stages:
 *
 *   - hasLessons:     1+ lesson_variants row matching topic_id
 *   - hasPracticePub: 1+ practice_items row with status='published'
 *   - hasPracticeAny: 1+ practice_items row regardless of status
 *
 * If hasPracticeAny is true but hasPracticePub is false, the items exist
 * but were saved with a status the UI filters out — that's a data bug, not
 * a missing-content bug.
 *
 * Outputs:
 *   - one-line summary per (class, subject)
 *   - up to 5 example topics where the practice items exist but are not
 *     published, so we know which to fix
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();
  const { data: subs } = await sb
    .from("subjects")
    .select("id,code,class_level")
    .eq("board", "BSE_ODISHA")
    .in("class_level", [6, 7, 8, 9])
    .order("class_level")
    .order("code");

  type Sample = { slug: string; statuses: Record<string, number> };
  type Bucket = {
    cls: number;
    code: string;
    topics: number;
    learnOk: number;
    practicePubOk: number;
    practiceAnyOk: number;
    lockedButHasItems: Sample[];
  };
  const buckets: Bucket[] = [];

  for (const s of subs ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id")
      .eq("subject_id", s.id);
    const cIds = (chs ?? []).map((c: any) => c.id);
    if (cIds.length === 0) continue;
    const { data: tps } = await sb
      .from("topics")
      .select("id,slug")
      .in("chapter_id", cIds);

    const bucket: Bucket = {
      cls: s.class_level,
      code: s.code,
      topics: tps?.length ?? 0,
      learnOk: 0,
      practicePubOk: 0,
      practiceAnyOk: 0,
      lockedButHasItems: [],
    };

    for (const t of tps ?? []) {
      const [{ count: lc }, { count: ppc }, { count: pac }] = await Promise.all(
        [
          sb
            .from("lesson_variants")
            .select("id", { head: true, count: "exact" })
            .eq("topic_id", t.id),
          sb
            .from("practice_items")
            .select("id", { head: true, count: "exact" })
            .eq("scope_type", "topic")
            .eq("scope_id", t.id)
            .eq("status", "published"),
          sb
            .from("practice_items")
            .select("id", { head: true, count: "exact" })
            .eq("scope_type", "topic")
            .eq("scope_id", t.id),
        ],
      );
      const hasLessons = (lc ?? 0) > 0;
      const hasPracticePub = (ppc ?? 0) > 0;
      const hasPracticeAny = (pac ?? 0) > 0;
      if (hasLessons) bucket.learnOk += 1;
      if (hasPracticePub) bucket.practicePubOk += 1;
      if (hasPracticeAny) bucket.practiceAnyOk += 1;
      if (
        hasPracticeAny &&
        !hasPracticePub &&
        bucket.lockedButHasItems.length < 5
      ) {
        const { data: rows } = await sb
          .from("practice_items")
          .select("status")
          .eq("scope_type", "topic")
          .eq("scope_id", t.id);
        const statuses: Record<string, number> = {};
        for (const r of rows ?? [])
          statuses[r.status as string] =
            (statuses[r.status as string] ?? 0) + 1;
        bucket.lockedButHasItems.push({ slug: t.slug, statuses });
      }
    }

    buckets.push(bucket);
  }

  console.log("\n=== Per-(class, subject) stage availability ===\n");
  console.log(
    "C/S         topics   learn  practice  any-practice".padEnd(60),
  );
  for (const b of buckets) {
    const tag = `C${b.cls} ${b.code}`.padEnd(11);
    console.log(
      `${tag} ${String(b.topics).padStart(6)} ${String(b.learnOk).padStart(7)} ${String(b.practicePubOk).padStart(9)} ${String(b.practiceAnyOk).padStart(13)}`,
    );
  }

  console.log(
    "\n=== Topics where practice items exist but Practice is locked ===\n",
  );
  let anyMismatch = false;
  for (const b of buckets) {
    if (b.lockedButHasItems.length === 0) continue;
    anyMismatch = true;
    console.log(`\nC${b.cls} ${b.code}:`);
    for (const s of b.lockedButHasItems) {
      const statusList = Object.entries(s.statuses)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      console.log(`  ${s.slug}: ${statusList}`);
    }
  }
  if (!anyMismatch)
    console.log(
      "  (none — wherever Practice is locked, the items genuinely don't exist.)",
    );
})();
