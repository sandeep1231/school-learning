/**
 * Curriculum seed — syncs the in-code curriculum (bse-class9.ts) to the DB
 * tables `subjects` / `chapters` / `topics`, populating stable `slug`
 * columns so URL routing and multi-board lookups work.
 *
 * Idempotent:
 *   - subjects matched by (board, class_level, code)
 *   - chapters matched by (subject_id, order_index)
 *   - topics   matched by (chapter_id, order_index)
 * UUIDs of existing rows are preserved so FKs from documents/chunks survive.
 *
 * Usage:
 *   npm run seed:curriculum
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import {
  CURRICULUM,
  RAG_ONLY_SUBJECTS,
} from "../../lib/curriculum/bse-class9";
import { createAdminClient } from "../../lib/supabase/admin";

dotenvConfig({ path: ".env.local" });

const BOARD = "BSE_ODISHA";
const CLASS_LEVEL = 9;

type SubjectRow = {
  id: string;
  code: string;
  class_level: number;
  board: string;
};
type ChapterRow = {
  id: string;
  subject_id: string;
  order_index: number;
  slug: string | null;
};
type TopicRow = {
  id: string;
  chapter_id: string;
  order_index: number;
  slug: string | null;
};

async function main() {
  const sb = createAdminClient();

  // 1) SUBJECTS — ensure all 6 BSE-OD Class 9 subjects exist.
  // Code is already globally unique in existing schema.
  const subjectSpecs: Array<{
    code: string;
    name: { en: string; or: string; hi: string };
  }> = [
    ...CURRICULUM.map((s) => ({ code: s.code, name: s.name })),
    ...RAG_ONLY_SUBJECTS.map((s) => ({ code: s.code, name: s.name })),
  ];

  const { data: existingSubjects, error: sErr } = await sb
    .from("subjects")
    .select("id, code, class_level, board")
    .eq("board", BOARD)
    .eq("class_level", CLASS_LEVEL);
  if (sErr) throw new Error(`fetch subjects: ${sErr.message}`);

  const subjectByCode = new Map<string, SubjectRow>(
    (existingSubjects ?? []).map((s) => [s.code as string, s as SubjectRow]),
  );

  for (const spec of subjectSpecs) {
    const existing = subjectByCode.get(spec.code);
    if (existing) {
      // Update display names in case they changed.
      const { error } = await sb
        .from("subjects")
        .update({
          name_en: spec.name.en,
          name_or: spec.name.or,
          name_hi: spec.name.hi,
        })
        .eq("id", existing.id);
      if (error) throw new Error(`update subject ${spec.code}: ${error.message}`);
    } else {
      const { data, error } = await sb
        .from("subjects")
        .insert({
          code: spec.code,
          name_en: spec.name.en,
          name_or: spec.name.or,
          name_hi: spec.name.hi,
          class_level: CLASS_LEVEL,
          board: BOARD,
        })
        .select("id, code, class_level, board")
        .single();
      if (error) throw new Error(`insert subject ${spec.code}: ${error.message}`);
      subjectByCode.set(spec.code, data as SubjectRow);
    }
  }
  console.log(`  ✓ subjects: ${subjectByCode.size}`);

  // 2) CHAPTERS + TOPICS for curated subjects (MTH, SSC) — upsert by
  // (subject_id, order_index), populate slug from the in-code data.
  let chapterCount = 0;
  let topicCount = 0;

  for (const subject of CURRICULUM) {
    const subjRow = subjectByCode.get(subject.code);
    if (!subjRow) {
      console.warn(`  ⚠ subject ${subject.code} missing, skipping chapters`);
      continue;
    }

    // Load existing chapters for this subject once.
    const { data: existingChaptersData } = await sb
      .from("chapters")
      .select("id, subject_id, order_index, slug")
      .eq("subject_id", subjRow.id);
    const existingChapters = new Map<number, ChapterRow>(
      (existingChaptersData ?? []).map((c) => [
        c.order_index as number,
        c as ChapterRow,
      ]),
    );

    for (const chapter of subject.chapters) {
      const existing = existingChapters.get(chapter.order);
      let chapterId: string;
      if (existing) {
        const { error } = await sb
          .from("chapters")
          .update({
            title_en: chapter.title.en,
            title_or: chapter.title.or,
            title_hi: chapter.title.hi,
            slug: chapter.slug,
          })
          .eq("id", existing.id);
        if (error) throw new Error(`update chapter ${chapter.slug}: ${error.message}`);
        chapterId = existing.id;
      } else {
        const { data, error } = await sb
          .from("chapters")
          .insert({
            subject_id: subjRow.id,
            order_index: chapter.order,
            slug: chapter.slug,
            title_en: chapter.title.en,
            title_or: chapter.title.or,
            title_hi: chapter.title.hi,
          })
          .select("id")
          .single();
        if (error) throw new Error(`insert chapter ${chapter.slug}: ${error.message}`);
        chapterId = (data as { id: string }).id;
      }
      chapterCount++;

      // Topics under this chapter.
      const { data: existingTopicsData } = await sb
        .from("topics")
        .select("id, chapter_id, order_index, slug")
        .eq("chapter_id", chapterId);
      const existingTopics = new Map<number, TopicRow>(
        (existingTopicsData ?? []).map((t) => [
          t.order_index as number,
          t as TopicRow,
        ]),
      );

      for (const topic of chapter.topics) {
        const prior = existingTopics.get(topic.order);
        if (prior) {
          const { error } = await sb
            .from("topics")
            .update({
              slug: topic.id,
              title_en: topic.title.en,
              title_or: topic.title.or,
              title_hi: topic.title.hi,
              learning_objectives: topic.objectives,
              approx_duration_min: topic.durationMin,
            })
            .eq("id", prior.id);
          if (error) throw new Error(`update topic ${topic.id}: ${error.message}`);
        } else {
          const { error } = await sb.from("topics").insert({
            chapter_id: chapterId,
            order_index: topic.order,
            slug: topic.id,
            title_en: topic.title.en,
            title_or: topic.title.or,
            title_hi: topic.title.hi,
            learning_objectives: topic.objectives,
            approx_duration_min: topic.durationMin,
          });
          if (error) throw new Error(`insert topic ${topic.id}: ${error.message}`);
        }
        topicCount++;
      }
    }
  }

  // 3) CHAPTERS for RAG-only subjects (GSC/FLO/SLE/TLH). These carry no
  // curated topics yet — tutor chat draws from the ingested textbook.
  for (const subject of RAG_ONLY_SUBJECTS) {
    const subjRow = subjectByCode.get(subject.code);
    if (!subjRow) continue;

    const { data: existingChaptersData } = await sb
      .from("chapters")
      .select("id, subject_id, order_index, slug")
      .eq("subject_id", subjRow.id);
    const existingChapters = new Map<number, ChapterRow>(
      (existingChaptersData ?? []).map((c) => [
        c.order_index as number,
        c as ChapterRow,
      ]),
    );

    for (const chapter of subject.chapters) {
      const existing = existingChapters.get(chapter.order);
      if (existing) {
        const { error } = await sb
          .from("chapters")
          .update({
            slug: chapter.slug,
            title_en: chapter.title.en,
            title_or: chapter.title.or ?? null,
            title_hi: chapter.title.hi ?? null,
          })
          .eq("id", existing.id);
        if (error)
          throw new Error(`update rag-chapter ${chapter.slug}: ${error.message}`);
      } else {
        const { error } = await sb.from("chapters").insert({
          subject_id: subjRow.id,
          order_index: chapter.order,
          slug: chapter.slug,
          title_en: chapter.title.en,
          title_or: chapter.title.or ?? null,
          title_hi: chapter.title.hi ?? null,
        });
        if (error)
          throw new Error(`insert rag-chapter ${chapter.slug}: ${error.message}`);
      }
      chapterCount++;
    }
  }

  console.log(`  ✓ chapters: ${chapterCount}`);
  console.log(`  ✓ topics:   ${topicCount}`);

  // Verify DB totals.
  const { count: subjTotal } = await sb
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("board", BOARD)
    .eq("class_level", CLASS_LEVEL);
  const { count: chTotal } = await sb
    .from("chapters")
    .select("*", { count: "exact", head: true });
  const { count: tpTotal } = await sb
    .from("topics")
    .select("*", { count: "exact", head: true });
  console.log(
    `\nDB totals (BSE-OD/9): subjects=${subjTotal}, chapters=${chTotal}, topics=${tpTotal}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
