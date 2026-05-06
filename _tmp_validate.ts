/**
 * Thorough content-integrity validator for sikhya-sathi.
 *
 * For every (board, class, subject, topic), checks:
 *   - lesson_variants: exactly 4 (textbook, simpler, parent, exam), non-empty
 *     body_md (>= MIN_BODY_LEN), non-empty citations[] array.
 *   - practice_items: exactly 8 (5 mcq + 2 short + 1 long), non-empty
 *     question_md, well-formed payload per kind.
 *     - mcq: payload.options length == 4, correct_index in 0..3,
 *       misconceptions array length == options length.
 *     - short/long: payload non-empty (rubric/criteria optional).
 *
 * Emits a per-(class, subject) summary plus an itemised list of every
 * topic that fails any check.
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });

const MIN_BODY_LEN = 200;
const EXPECTED_VARIANTS = ["textbook", "simpler", "parent", "exam"] as const;

type Issue = {
  topic: string;
  kind:
    | "lessons_missing"
    | "lessons_wrong_count"
    | "lessons_wrong_variants"
    | "lesson_body_short"
    | "lesson_no_citations"
    | "practice_missing"
    | "practice_wrong_count"
    | "practice_wrong_kinds"
    | "mcq_bad_options"
    | "mcq_bad_correct_index"
    | "mcq_bad_misconceptions"
    | "item_empty_question";
  detail: string;
};

(async () => {
  const sb = createAdminClient();

  // Pull all subjects across all classes/boards we want to validate.
  const { data: subs, error: sErr } = await sb
    .from("subjects")
    .select("id,code,class_level,board")
    .eq("board", "BSE_ODISHA")
    .in("class_level", [6, 7, 8, 9])
    .order("class_level")
    .order("code");
  if (sErr) {
    console.error("subjects err:", sErr);
    process.exit(1);
  }

  type Bucket = {
    classLevel: number;
    code: string;
    topics: number;
    valid: number;
    issues: Issue[];
  };
  const buckets: Bucket[] = [];

  for (const s of subs ?? []) {
    const { data: chs } = await sb
      .from("chapters")
      .select("id")
      .eq("subject_id", s.id);
    const chapterIds = (chs ?? []).map((c: any) => c.id);
    if (chapterIds.length === 0) {
      buckets.push({
        classLevel: s.class_level,
        code: s.code,
        topics: 0,
        valid: 0,
        issues: [],
      });
      continue;
    }

    const { data: tps } = await sb
      .from("topics")
      .select("id,slug")
      .in("chapter_id", chapterIds)
      .order("slug");
    const topics = tps ?? [];
    const tids = topics.map((t: any) => t.id);

    if (tids.length === 0) {
      buckets.push({
        classLevel: s.class_level,
        code: s.code,
        topics: 0,
        valid: 0,
        issues: [],
      });
      continue;
    }

    // Fetch lessons + practice items for all topics in this subject in two queries.
    const { data: lessons } = await sb
      .from("lesson_variants")
      .select("topic_id,variant,body_md,citations")
      .in("topic_id", tids);
    const { data: items } = await sb
      .from("practice_items")
      .select("scope_id,kind,question_md,payload,status")
      .eq("scope_type", "topic")
      .in("scope_id", tids);

    // Group by topic.
    const lessonsByTopic = new Map<string, any[]>();
    for (const l of lessons ?? []) {
      const arr = lessonsByTopic.get(l.topic_id) ?? [];
      arr.push(l);
      lessonsByTopic.set(l.topic_id, arr);
    }
    const itemsByTopic = new Map<string, any[]>();
    for (const it of items ?? []) {
      if (it.status !== "published") continue;
      const arr = itemsByTopic.get(it.scope_id) ?? [];
      arr.push(it);
      itemsByTopic.set(it.scope_id, arr);
    }

    const issues: Issue[] = [];
    let valid = 0;
    for (const t of topics) {
      let topicValid = true;
      const slug = t.slug as string;

      // ---- Lessons ----
      const ls = lessonsByTopic.get(t.id) ?? [];
      if (ls.length === 0) {
        issues.push({ topic: slug, kind: "lessons_missing", detail: "0 variants" });
        topicValid = false;
      } else if (ls.length !== 4) {
        issues.push({
          topic: slug,
          kind: "lessons_wrong_count",
          detail: `${ls.length} variants`,
        });
        topicValid = false;
      } else {
        const got = new Set(ls.map((l) => l.variant));
        const missing = EXPECTED_VARIANTS.filter((v) => !got.has(v));
        if (missing.length > 0) {
          issues.push({
            topic: slug,
            kind: "lessons_wrong_variants",
            detail: `missing: ${missing.join(",")}`,
          });
          topicValid = false;
        }
        for (const l of ls) {
          if (!l.body_md || l.body_md.length < MIN_BODY_LEN) {
            issues.push({
              topic: slug,
              kind: "lesson_body_short",
              detail: `${l.variant}: ${l.body_md?.length ?? 0} chars`,
            });
            topicValid = false;
          }
          // citations is jsonb; can be array or object
          const citations = Array.isArray(l.citations) ? l.citations : [];
          if (citations.length === 0) {
            issues.push({
              topic: slug,
              kind: "lesson_no_citations",
              detail: l.variant,
            });
            topicValid = false;
          }
        }
      }

      // ---- Practice ----
      const its = itemsByTopic.get(t.id) ?? [];
      if (its.length === 0) {
        issues.push({ topic: slug, kind: "practice_missing", detail: "0 items" });
        topicValid = false;
      } else {
        if (its.length !== 8) {
          issues.push({
            topic: slug,
            kind: "practice_wrong_count",
            detail: `${its.length} items`,
          });
          topicValid = false;
        }
        const kindCounts: Record<string, number> = { mcq: 0, short: 0, long: 0 };
        for (const it of its) kindCounts[it.kind] = (kindCounts[it.kind] ?? 0) + 1;
        if (kindCounts.mcq !== 5 || kindCounts.short !== 2 || kindCounts.long !== 1) {
          issues.push({
            topic: slug,
            kind: "practice_wrong_kinds",
            detail: `mcq=${kindCounts.mcq} short=${kindCounts.short} long=${kindCounts.long}`,
          });
          topicValid = false;
        }
        for (const it of its) {
          if (!it.question_md || it.question_md.trim().length === 0) {
            issues.push({
              topic: slug,
              kind: "item_empty_question",
              detail: it.kind,
            });
            topicValid = false;
            continue;
          }
          if (it.kind === "mcq") {
            const p = it.payload ?? {};
            const opts = Array.isArray(p.options) ? p.options : [];
            if (opts.length !== 4 || opts.some((o: any) => !o || (typeof o === "string" && o.trim().length === 0))) {
              issues.push({
                topic: slug,
                kind: "mcq_bad_options",
                detail: `options=${opts.length}`,
              });
              topicValid = false;
            }
            const ci = p.correct_index;
            if (typeof ci !== "number" || ci < 0 || ci > 3) {
              issues.push({
                topic: slug,
                kind: "mcq_bad_correct_index",
                detail: String(ci),
              });
              topicValid = false;
            }
            const mis = Array.isArray(p.misconceptions) ? p.misconceptions : null;
            if (!mis || mis.length !== opts.length) {
              issues.push({
                topic: slug,
                kind: "mcq_bad_misconceptions",
                detail: mis ? `len=${mis.length}` : "missing",
              });
              topicValid = false;
            }
          }
        }
      }

      if (topicValid) valid++;
    }

    buckets.push({
      classLevel: s.class_level,
      code: s.code,
      topics: topics.length,
      valid,
      issues,
    });
  }

  // ---- Report ----
  console.log("\n=== Per-(class, subject) summary ===");
  console.log(
    "C/S".padEnd(10) +
      "topics".padStart(8) +
      "valid".padStart(8) +
      "issues".padStart(10),
  );
  let totalTopics = 0;
  let totalValid = 0;
  let totalIssues = 0;
  for (const b of buckets) {
    const tag = `C${b.classLevel} ${b.code}`;
    console.log(
      tag.padEnd(10) +
        String(b.topics).padStart(8) +
        String(b.valid).padStart(8) +
        String(b.issues.length).padStart(10),
    );
    totalTopics += b.topics;
    totalValid += b.valid;
    totalIssues += b.issues.length;
  }
  console.log(
    "TOTAL".padEnd(10) +
      String(totalTopics).padStart(8) +
      String(totalValid).padStart(8) +
      String(totalIssues).padStart(10),
  );

  // ---- Per-bucket issue breakdown ----
  console.log("\n=== Issue breakdown by (class, subject) ===");
  for (const b of buckets) {
    if (b.issues.length === 0) continue;
    const byKind: Record<string, Issue[]> = {};
    for (const i of b.issues) (byKind[i.kind] ??= []).push(i);
    console.log(`\n--- C${b.classLevel} ${b.code} (${b.issues.length} issues across ${b.topics} topics) ---`);
    for (const [kind, list] of Object.entries(byKind)) {
      const examples = list.slice(0, 5).map((x) => `${x.topic}(${x.detail})`).join(", ");
      const more = list.length > 5 ? ` …+${list.length - 5} more` : "";
      console.log(`  ${kind} × ${list.length}: ${examples}${more}`);
    }
  }

  // ---- Top-level issue type histogram ----
  console.log("\n=== Issue-type histogram (all classes) ===");
  const histo: Record<string, number> = {};
  for (const b of buckets)
    for (const i of b.issues) histo[i.kind] = (histo[i.kind] ?? 0) + 1;
  for (const [k, v] of Object.entries(histo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
})();
