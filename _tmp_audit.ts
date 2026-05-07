/**
 * End-to-end content audit for the C6–C9 multi-class rollout.
 *
 * Outputs three views:
 *
 * 1. SHAPE — per-(class, subject): topic count, lesson count, practice count,
 *    chunk count. So you can see which buckets are missing content vs which
 *    are just unevenly seeded.
 *
 * 2. CROSS-CLASS — subject codes that appear in some classes but not others.
 *    Helps spot "is this a real BSE Odisha syllabus difference, or a seeding
 *    gap?" — pair the output with the actual BSE syllabus to decide.
 *
 * 3. ALIGNMENT — for a sample of topics: do the lessons and practice items
 *    cite the same source chunks? If they cite disjoint chunk sets, the MCQs
 *    can ask about content the lesson never covers, which is the "gap"
 *    students hit.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

(async () => {
  const sb = createAdminClient();

  const { data: subs } = await sb
    .from("subjects")
    .select("id,code,class_level,name_en")
    .eq("board", "BSE_ODISHA")
    .in("class_level", [6, 7, 8, 9])
    .order("class_level")
    .order("code");

  type Bucket = {
    classLevel: number;
    code: string;
    name: string;
    topics: number;
    lessons: number;
    practice: number;
    chunks: number;
  };
  const buckets: Bucket[] = [];

  for (const s of subs ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id")
      .eq("subject_id", s.id);
    const cIds = (chs ?? []).map((c: any) => c.id);
    let topics = 0;
    let lessons = 0;
    let practice = 0;
    let chunks = 0;
    if (cIds.length > 0) {
      const { data: tps } = await sb
        .from("topics")
        .select("id")
        .in("chapter_id", cIds);
      const tIds = (tps ?? []).map((t: any) => t.id);
      topics = tIds.length;
      if (tIds.length > 0) {
        const { count: lc } = await sb
          .from("lesson_variants")
          .select("id", { head: true, count: "exact" })
          .in("topic_id", tIds);
        const { count: pc } = await sb
          .from("practice_items")
          .select("id", { head: true, count: "exact" })
          .eq("scope_type", "topic")
          .in("scope_id", tIds);
        const { count: cc } = await sb
          .from("chunks")
          .select("id", { head: true, count: "exact" })
          .in("topic_id", tIds);
        lessons = lc ?? 0;
        practice = pc ?? 0;
        chunks = cc ?? 0;
      }
    }
    buckets.push({
      classLevel: s.class_level,
      code: s.code,
      name: s.name_en,
      topics,
      lessons,
      practice,
      chunks,
    });
  }

  console.log("\n=== 1. SHAPE: per (class, subject) coverage ===\n");
  const colTitle = "C/S".padEnd(11);
  const cols = ["topics", "lessons", "practice", "chunks"];
  console.log(colTitle + cols.map((c) => c.padStart(10)).join(""));
  for (const b of buckets) {
    const tag = `C${b.classLevel} ${b.code}`.padEnd(11);
    console.log(
      tag +
        String(b.topics).padStart(10) +
        String(b.lessons).padStart(10) +
        String(b.practice).padStart(10) +
        String(b.chunks).padStart(10),
    );
  }

  console.log("\n=== 2. CROSS-CLASS: subject codes per class ===\n");
  const codesByClass = new Map<number, Set<string>>();
  for (const b of buckets) {
    if (!codesByClass.has(b.classLevel))
      codesByClass.set(b.classLevel, new Set());
    codesByClass.get(b.classLevel)!.add(b.code);
  }
  const allCodes = new Set<string>();
  for (const set of codesByClass.values())
    for (const c of set) allCodes.add(c);
  const sortedCodes = Array.from(allCodes).sort();
  console.log("subject ".padEnd(10) + [6, 7, 8, 9].map((c) => `C${c}`.padStart(5)).join(""));
  for (const code of sortedCodes) {
    const row =
      code.padEnd(10) +
      [6, 7, 8, 9]
        .map((cls) => (codesByClass.get(cls)?.has(code) ? "  ✓" : "  ·"))
        .map((s) => s.padStart(5))
        .join("");
    console.log(row);
  }

  console.log("\n=== 3. ALIGNMENT (sample): do lessons + MCQs cite the same chunks? ===\n");
  // Pick 5 random topics with both lessons and practice items.
  const candidateTids: string[] = [];
  for (const s of subs?.slice(0, 6) ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id")
      .eq("subject_id", s.id)
      .limit(2);
    const cIds = (chs ?? []).map((c: any) => c.id);
    const { data: tps } = await sb
      .from("topics")
      .select("id,slug")
      .in("chapter_id", cIds)
      .limit(2);
    for (const t of tps ?? []) candidateTids.push(t.id);
    if (candidateTids.length >= 8) break;
  }

  for (const tid of candidateTids.slice(0, 8)) {
    const { data: t } = await sb
      .from("topics")
      .select("slug,title_en")
      .eq("id", tid)
      .maybeSingle();
    const { data: lessons } = await sb
      .from("lesson_variants")
      .select("variant,source_chunk_ids")
      .eq("topic_id", tid);
    const { data: items } = await sb
      .from("practice_items")
      .select("kind,source_chunk_ids")
      .eq("scope_type", "topic")
      .eq("scope_id", tid);
    if (!lessons?.length || !items?.length) {
      console.log(`${t?.slug ?? tid}: no lessons or no practice items`);
      continue;
    }
    const lessonChunkIds = new Set<string>();
    for (const l of lessons) for (const id of l.source_chunk_ids ?? []) lessonChunkIds.add(id);
    const practiceChunkIds = new Set<string>();
    for (const it of items) for (const id of it.source_chunk_ids ?? []) practiceChunkIds.add(id);
    const overlap = new Set(
      [...practiceChunkIds].filter((id) => lessonChunkIds.has(id)),
    );
    const overlapPct =
      practiceChunkIds.size > 0
        ? Math.round((overlap.size / practiceChunkIds.size) * 100)
        : 0;
    console.log(
      `${(t?.slug ?? tid).padEnd(22)} | lessonChunks=${lessonChunkIds.size}, practiceChunks=${practiceChunkIds.size}, overlap=${overlap.size} (${overlapPct}%)`,
    );
  }
})();
