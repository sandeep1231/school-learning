/**
 * Final audit: per (subject, language) counts of lesson_variants and
 * practice_items for BSE Odisha Class 9. Writes a TSV-ish report.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const BOARD = "BSE_ODISHA";
const CLASS = 9;
const SUBJECTS = ["FLO", "GSC", "MTH", "SLE", "SSC", "TLH"];

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
  const lines: string[] = [];
  const log = (s: string) => {
    console.log(s);
    lines.push(s);
  };

  log(`# Class 9 final audit · ${new Date().toISOString()}`);
  log("");
  log("subject | topics | lessons (lang→count) | practice (lang→count)");
  log("--------|--------|----------------------|----------------------");

  let totalTopics = 0;
  let totalLessons = 0;
  let totalPractice = 0;

  for (const code of SUBJECTS) {
    const { data: subj } = await supa
      .from("subjects")
      .select("id")
      .eq("board", BOARD)
      .eq("class_level", CLASS)
      .eq("code", code)
      .maybeSingle();
    if (!subj) {
      log(`${code} | (no subject row)`);
      continue;
    }
    const { data: chapters } = await supa
      .from("chapters")
      .select("id")
      .eq("subject_id", subj.id);
    const chapterIds = (chapters ?? []).map((c) => c.id as string);
    if (chapterIds.length === 0) {
      log(`${code} | 0 | – | –`);
      continue;
    }
    const topicIds = await chunkIn(chapterIds, 50, async (slice) => {
      const { data } = await supa
        .from("topics")
        .select("id")
        .in("chapter_id", slice);
      return (data ?? []).map((t) => t.id as string);
    });

    const lessons = await chunkIn(topicIds, 100, async (slice) => {
      const { data } = await supa
        .from("lesson_variants")
        .select("topic_id, language")
        .in("topic_id", slice);
      return (data ?? []) as { topic_id: string; language: string }[];
    });
    const practice = await chunkIn(topicIds, 100, async (slice) => {
      const { data } = await supa
        .from("practice_items")
        .select("scope_id, language")
        .eq("scope_type", "topic")
        .in("scope_id", slice);
      return (data ?? []) as { scope_id: string; language: string }[];
    });

    const lessonsByLang: Record<string, number> = {};
    for (const r of lessons) lessonsByLang[r.language] = (lessonsByLang[r.language] ?? 0) + 1;
    const practiceByLang: Record<string, number> = {};
    for (const r of practice) practiceByLang[r.language] = (practiceByLang[r.language] ?? 0) + 1;

    const fmt = (m: Record<string, number>) =>
      Object.keys(m).length === 0
        ? "–"
        : Object.entries(m)
            .sort()
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");

    log(
      `${code} | ${topicIds.length} | ${fmt(lessonsByLang)} | ${fmt(practiceByLang)}`,
    );
    totalTopics += topicIds.length;
    totalLessons += lessons.length;
    totalPractice += practice.length;
  }

  log("");
  log(`TOTAL · topics=${totalTopics} lesson_variants=${totalLessons} practice_items=${totalPractice}`);

  const out = `data/reports/c9-final-audit.log`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`\nWrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
